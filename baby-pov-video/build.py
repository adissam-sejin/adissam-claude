"""Assemble the whole scene, bake the animation and save a .blend."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Quaternion
import lib, room, actors
import timeline as TL

UP = Vector((0, 0, 1))


def build(out_blend, static_only=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    lib.set_collection(sc.collection)
    room.build_shell()
    L = room.build_lights(sc)
    room.build_living()
    room.build_kitchen()
    drum = room.build_washer()
    baby = actors.build_baby()
    ball = actors.build_ball()
    robot = actors.build_robot()
    mom = actors.build_mom()

    # ---- light balance (scene-linear units; exposure is handled in post)
    L['bg'].inputs[1].default_value = 0.085
    L['sun'].energy = 21.0
    for d in L['kitchen']:
        d.energy = 95.0
    L['strip'].energy = 16.0
    for d in L['pendant']:
        d.energy = 9.0
    L['drum'].energy = 11.0

    # ---- camera: the baby's eyes
    cd = bpy.data.cameras.new('eyes')
    cd.lens = 14.5
    cd.sensor_width = 36
    cd.clip_start = 0.012
    cd.clip_end = 3000
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 1.1
    cam = bpy.data.objects.new('eyes', cd)
    cam.rotation_mode = 'QUATERNION'
    lib.link(cam)
    sc.camera = cam

    sc.render.fps = TL.FPS
    sc.frame_start = 0
    sc.frame_end = TL.NF - 1

    bk = actors.Baker()
    fs = None
    for fr in range(0, TL.NF + 2):
        t = min(fr / TL.FPS, TL.T_TOTAL + 0.04)
        c = TL.cam_state(t)
        fwd = Vector((math.cos(c['yaw']) * math.cos(c['pitch']), math.sin(c['yaw']) * math.cos(c['pitch']), math.sin(c['pitch'])))
        bk.key(cam, fr, Vector(c['pos']), lib.quat_from_fwd_up(fwd, UP, c['roll']))
        # slow, baby-like accommodation
        tgt = max(0.11, min(c['focus'], 7.0))
        k_near = TL.ease(t, 33.4, 34.4)
        tgt = tgt * (1 - k_near) + min(tgt, 0.19) * k_near          # eyes stay on its own reaching hands; mum is a warm blur
        if fs is None or abs(t - TL.CUT) < 0.5 / TL.FPS:
            fs = tgt
        fs += (tgt - fs) * (1 - math.exp(-(1 / TL.FPS) / 0.20))
        cd.dof.focus_distance = fs
        cd.dof.keyframe_insert('focus_distance', frame=fr)
        cd.dof.aperture_fstop = 2.2 - 0.45 * (1 - TL.ease(t, 4.0, 5.6)) - 1.25 * TL.ease(t, 33.3, 34.5)
        cd.dof.keyframe_insert('aperture_fstop', frame=fr)
        bk.apply(actors.baby_pose(baby, t, c), fr)
        p, q = actors.ball_pose(t)
        bk.key(ball, fr, p, q)
        rx, ry, rh, rd = TL.robot_state(t)
        bk.key(robot['root'], fr, Vector((rx, ry, 0)), Quaternion(UP, rh))
        robot['brush'].rotation_euler = (0, 0, -t * 2 * math.pi * 2.6 if TL.ROBOT_T0 < t < TL.CUT else 0)
        robot['brush'].keyframe_insert('rotation_euler', frame=fr)
        drum.rotation_euler = (0, actors.drum_angle(t), 0)
        drum.keyframe_insert('rotation_euler', frame=fr)
        bk.apply(actors.mom_pose(mom, t, c), fr)
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print('saved', out_blend, 'objects:', len(bpy.data.objects))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/babypov/scene.blend'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    build(out)
