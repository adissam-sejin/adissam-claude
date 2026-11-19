"""Everything that moves: the baby's hands/arms (and its unseen body, for shadows and reflections),
the ball, the robot vacuum, the washer drum, mum. Plus per-frame keyframe baking."""
import math, random
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler
from lib import *
import materials as M
import timeline as TL
import toon

rad = math.radians
UP = Vector((0, 0, 1))


def _to_y_axis(o):
    """Meshes lathed around Z -> make their axis local +Y."""
    o.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'X'))
    o.data.update()
    return o


def segment(name, r0, r1, length, mat, extra=None, steps=40, open_start=False):
    """Limb segment along local +Y from the origin, rounded ends."""
    prof = []
    n = 8
    if open_start:
        prof += [(r0 * 0.86, 0.012), (r0 * 0.97, 0.0), (r0, 0.006)]
    else:
        for i in range(n + 1):
            a = math.pi / 2 * i / n
            prof.append((r0 * math.sin(a), -r0 * math.cos(a) * 0.9))
    if extra:
        prof += extra
    for i in range(n + 1):
        a = math.pi / 2 * i / n
        prof.append((r1 * math.cos(a), length + r1 * math.sin(a) * 0.9))
    o = lathe(name, prof, mat, steps=steps)
    o.rotation_mode = 'QUATERNION'
    return _to_y_axis(o)


# =============================================================================== baby
ARM = 0.115
def hand_sdf(mirror):
    fingers = [(-0.0158, -15, 0.027, 0.0063), (-0.0052, -4, 0.0305, 0.0066), (0.0058, 7, 0.0275, 0.0062), (0.0160, 20, 0.022, 0.0055)]
    if toon.PIXAR:                                    # stubbier, rounder fingers
        fingers = [(bx * 1.04, ang * 1.15, L * 0.88, r * 1.13) for bx, ang, L, r in fingers]
    tips = []

    def fn(p):
        if mirror:
            p = p * np.array([-1.0, 1.0, 1.0])
        d = sd_ellipsoid(p, (0, 0.0215, 0.0098), (0.0238, 0.0228, 0.0108))
        d = smin(d, sd_ellipsoid(p, (0, -0.006, 0.0125), (0.0172, 0.0175, 0.0135)), 0.005)
        for bx, ang, L, r in fingers:
            a = rad(ang)
            base = np.array((bx, 0.0375 - abs(bx) * 0.22, 0.0088))
            tip = base + np.array((math.sin(a), math.cos(a), -0.10)) * L
            tip[2] = max(tip[2], r * 0.95)
            d = smin(d, sd_capsule(p, base, tip, r * 1.1, r * 0.93), 0.0042)
            d = smax(d, -sd_sphere(p, base + np.array((0, -0.002, 0.0125)), 0.0036), 0.004)      # knuckle dimples
        tb = np.array((-0.0205, 0.0105, 0.0092))
        tt = tb + np.array((math.sin(rad(-60)), math.cos(rad(-60)), -0.08)) * 0.0235
        d = smin(d, sd_capsule(p, tb, tt, 0.0078, 0.0064), 0.0055)
        d = smax(d, -(p[..., 2] - 0.0006), 0.003)                                                   # flat palm
        return d

    def nails(p):
        if mirror:
            p = p * np.array([-1.0, 1.0, 1.0])
        d = np.full(p.shape[:-1], 1.0)
        for bx, ang, L, r in fingers + [(None, -60, 0.0235, 0.0064)]:
            a = rad(ang)
            if bx is None:
                base = np.array((-0.0205, 0.0105, 0.0092))
                dz = -0.08
            else:
                base = np.array((bx, 0.0375 - abs(bx) * 0.22, 0.0088))
                dz = -0.10
            dirv = np.array((math.sin(a), math.cos(a), dz))
            tip = base + dirv * L
            tip[2] = max(tip[2], r * 0.95)
            c = tip - dirv * 0.0005 + np.array((0, 0, r * 0.74))
            q = p - c
            ca, sa = math.cos(a), math.sin(a)
            qx = q[..., 0] * ca - q[..., 1] * sa
            qy = q[..., 0] * sa + q[..., 1] * ca
            qq = np.stack([qx, qy, q[..., 2]], axis=-1)
            d = np.minimum(d, sd_ellipsoid(qq, (0, 0, 0), (r * 0.50, r * 0.52, 0.00115)))
        return d
    return fn, nails


def build_baby():
    sk = toon.skin('baby', base='#F8B998', flush='#F47C70', tip_axis=1, tip0=0.025, tip1=0.07, tipk=0.5) if toon.PIXAR else M.skin('baby')
    nailm = pbr('nail', '#F5C3BC', 0.2, Subsurface_Weight=0.6, Subsurface_Radius=(1, 0.4, 0.3), Subsurface_Scale=0.003,
                Coat_Weight=0.4, Coat_Roughness=0.1)
    rig = {}
    for h in 'LR':
        fn, nails = hand_sdf(mirror=(h == 'L'))
        hand = sdf_mesh('hand_' + h, fn, (-0.042, -0.027, -0.002), (0.042, 0.078, 0.03), 0.0008, sk, smooth_iter=3)
        hand.rotation_mode = 'QUATERNION'
        sdf_mesh('nails_' + h, nails, (-0.042, -0.005, 0.0), (0.042, 0.078, 0.03), 0.0005, nailm, parent=hand, smooth_iter=1)
        upper = segment('upperarm_' + h, 0.037, 0.034, ARM, M.sleeve(False))
        fore = segment('forearm_' + h, 0.034, 0.0245, ARM, M.sleeve(True),
                       extra=[(0.031, 0.06), (0.0255, ARM - 0.017), (0.0272, ARM - 0.014), (0.0272, ARM - 0.004), (0.0255, ARM - 0.001)])
        rig[h] = dict(hand=hand, upper=upper, fore=fore)
    # unseen body: casts shadows, shows up in reflections
    onesie = M.fabric('onesie', '#A8CFC0', weave=900)
    body = empty('baby_body')
    head = sphere('baby_head', 0.068, (0, 0, 0), sk, scale=(0.95, 1.05, 1.0), parent=body)
    hair = sphere('baby_hair', 0.0695, (-0.004, 0, 0.004), pbr('babyhair', '#3A2A20', 0.7, Sheen_Weight=0.6), scale=(0.95, 1.03, 0.98),
                  parent=body)
    torso = sphere('baby_torso', 0.1, (-0.17, 0, -0.10), onesie, scale=(1.75, 1.05, 0.95), parent=body)
    bum = sphere('baby_bum', 0.09, (-0.30, 0, -0.105), onesie, scale=(1.1, 1.15, 1.0), parent=body)
    for o in (head, hair, torso, bum):
        o.visible_camera = False
    # hair only on the back/top half: push it backwards
    hair.location = (-0.012, 0, 0.008)
    rig['body'] = body
    return rig


def baby_pose(rig, t, cam):
    """Returns {object: (loc, quat, scale)}."""
    out = {}
    ps = cam['psi']
    f = Vector((math.cos(ps), math.sin(ps), 0))
    ex, ey, ez = cam['pos']
    # body proxy frame: local +X forward
    qb = Quaternion(UP, ps)
    out[rig['body']] = (Vector((ex, ey, ez)) - f * 0.055, qb, None)
    for h in 'LR':
        s = TL.side(h)
        left = Vector((-f.y, f.x, 0))
        (hx, hy, hz), yaw, pitch, roll = TL.hand_state(h, t)
        W = Vector((hx, hy, hz + 0.012))
        S = Vector(TL.shoulder(h, t))
        fd = Vector((math.cos(yaw), math.sin(yaw), 0))
        # hand orientation: +Y fingers, +Z back of hand
        q = Quaternion(UP, yaw - math.pi / 2)
        lat = Vector((-fd.y, fd.x, 0))
        q = Quaternion(lat, -pitch) @ q
        fwd3 = q @ Vector((0, 1, 0))
        q = Quaternion(fwd3, roll) @ q
        out[rig[h]['hand']] = (Vector((hx, hy, hz)), q, None)
        # wrist joint sits a little behind/above the hand origin
        Wj = Vector((hx, hy, hz)) + q @ Vector((0, -0.006, 0.013))
        l1 = l2 = ARM
        reach = (Wj - S).length
        if reach > 2 * ARM * 1.06:                      # the unseen shoulder follows instead of a rubber arm
            S = Wj + (S - Wj) * (2 * ARM * 1.06 / reach)
        pole = left * s * 1.0 - f * 0.6 + UP * (0.25 if ez > 0.22 else -0.5)
        E = ik2(S, Wj, l1, l2, pole)
        d1 = E - S
        d2 = Wj - E
        out[rig[h]['upper']] = (S, quat_y_to(d1), Vector((1, d1.length / l1, 1)))
        out[rig[h]['fore']] = (E, quat_y_to(d2), Vector((1, d2.length / l2, 1)))
    return out


# =============================================================================== ball
def build_ball():
    o = sphere('ball', TL.BALL_R, (0, 0, 0), M.ball(), seg=64, rings=32)
    o.rotation_mode = 'QUATERNION'
    return o


_BALL_Q0 = Quaternion((1, 0.3, 0.2), rad(63))


def ball_pose(t):
    (x, y, z), d1, d2, _ = TL.ball_state(t)
    a1 = Vector((-TL.BALL_DIR[1], TL.BALL_DIR[0], 0))
    a2 = Vector((-TL.BALL_DIR2[1], TL.BALL_DIR2[0], 0))
    q = Quaternion(a2, d2 / TL.BALL_R) @ Quaternion(a1, d1 / TL.BALL_R) @ _BALL_Q0
    return Vector((x, y, z)), q


# =============================================================================== robot vacuum
def build_robot():
    root = empty('robot')
    R = TL.ROBOT_R
    white = M.plastic('robot_w', '#F2F2F0', 0.3)
    lathe('robot_body', [(0, 0.012), (R - 0.02, 0.012), (R - 0.004, 0.02), (R, 0.032), (R, 0.074), (R - 0.006, 0.082), (R - 0.012, 0.084),
                         (0, 0.084)], white, parent=root, steps=96)
    lathe('robot_top', [(0, 0.0845), (R - 0.02, 0.0845), (R - 0.016, 0.0842), (R - 0.016, 0.083), (0, 0.083)],
          pbr('robot_top', (0.006, 0.006, 0.007), 0.07, Coat_Weight=1.0, Coat_Roughness=0.03), parent=root, steps=96)
    # bumper: darker band across the front half
    def bumper(u, v):
        a = (u - 0.5) * math.pi * 1.02
        r = R + 0.0035
        return (r * math.cos(a), r * math.sin(a), 0.026 + v * 0.05)
    grid_surface('robot_bumper', 48, 3, bumper, pbr('robot_bumper', '#2A2C2F', 0.25, Coat_Weight=0.6), parent=root, solid=0.004)
    lathe('robot_lidar', [(0, 0.084), (0.047, 0.084), (0.047, 0.098), (0.044, 0.106), (0.0, 0.107)], pbr('lidar', '#1B1C1E', 0.3),
          parent=root, loc=(-0.045, 0, 0), steps=48)
    lathe('robot_lidar_cap', [(0, 0.107), (0.036, 0.107), (0.036, 0.1085), (0, 0.1085)], pbr('lidar_cap', '#C9CCCF', 0.2, metal=0.9),
          parent=root, loc=(-0.045, 0, 0), steps=48)
    torus('robot_btn', 0.013, 0.0022, (0.07, 0, 0.0852), emit('led_w2', (0.75, 0.92, 1.0), 12), parent=root, seg=32, rseg=8)
    box('robot_sensor', (0.004, 0.07, 0.016), (R + 0.004, 0, 0.055), pbr('sensor', '#0B0B0C', 0.08, Coat_Weight=1.0), parent=root,
        bevel=0.002)
    rub = pbr('rubber', '#141414', 0.7)
    wheels = []
    for sy in (-1, 1):
        w = cyl('robot_wheel', 0.033, 0.022, (-0.01, sy * 0.115, 0.033), rub, rot=(rad(90), 0, 0), parent=root, steps=24)
        wheels.append(w)
    brush = empty('robot_brush', (0.105, -0.105, 0.012), parent=root)
    brush.rotation_mode = 'XYZ'
    cyl('brush_hub', 0.012, 0.01, (0, 0, 0), pbr('hub', '#E8B23A', 0.4), parent=brush, steps=16)
    for i in range(3):
        a = rad(120 * i)
        box('bristle', (0.085, 0.006, 0.003), (math.cos(a) * 0.05, math.sin(a) * 0.05, -0.006), pbr('bristle', '#E8E4D8', 0.6),
            parent=brush, rot=(0, rad(8), a), bevel=0.001)
    if toon.PIXAR:
        toon.robot_face(root, R)
    return dict(root=root, brush=brush, wheels=wheels)


# =============================================================================== washer drum
def drum_angle(t):
    return 2 * math.pi * 0.85 * t


# =============================================================================== mum
MOM = dict(thigh=0.40, shin=0.36, hip_w=0.095, ankle_h=0.15, uarm=0.285, farm=0.255, sh_w=0.175, sh_h=0.44, neck=0.56)


def foot_sdf(mirror):
    def fn(p):
        if mirror:
            p = p * np.array([-1.0, 1.0, 1.0])
        d = sd_ellipsoid(p, (0, -0.022, 0.036), (0.033, 0.042, 0.036))
        d = smin(d, sd_capsule(p, (0, -0.012, 0.042), (0.002, 0.105, 0.027), 0.035, 0.030), 0.02)
        d = smin(d, sd_ellipsoid(p, (0.002, 0.112, 0.021), (0.047, 0.036, 0.021)), 0.015)
        for x, y, z, r in ((-0.027, 0.166, 0.0145, 0.0148), (-0.0085, 0.171, 0.012, 0.0115), (0.0065, 0.167, 0.011, 0.0105),
                           (0.0195, 0.159, 0.0102, 0.0098), (0.031, 0.148, 0.0098, 0.0092)):
            d = smin(d, sd_ellipsoid(p, (x, y, z), (r, r * 1.5, r)), 0.011)
        d = smin(d, sd_capsule(p, (0, -0.036, 0.075), (0, -0.046, 0.33), 0.031, 0.040), 0.02)
        d = smin(d, sd_sphere(p, (0.03, -0.03, 0.078), 0.012), 0.012)
        d = smin(d, sd_sphere(p, (-0.03, -0.026, 0.085), 0.012), 0.012)
        d = smax(d, -(p[..., 2] - 0.0005), 0.004)
        return d
    return fn


BALL_Y = 0.108          # toe hinge
HEAD_OFF = toon.pick((0.01, 0, MOM['neck'] + 0.07), (0.055, 0, MOM['neck'] + 0.135))     # head joint in torso space


def _mom_arms(rig, card):
    def mhand(mirror):
        def fn(p):
            if mirror:
                p = p * np.array([-1.0, 1.0, 1.0])
            d = sd_ellipsoid(p, (0, 0.045, 0), (0.042, 0.05, 0.016))
            for x, a, L, r in ((-0.03, -9, 0.07, 0.0092), (-0.0105, -3, 0.078, 0.0096), (0.009, 3, 0.073, 0.0092), (0.027, 10, 0.058, 0.0082)):
                b = np.array((x, 0.085, 0.0))
                tip = b + np.array((math.sin(rad(a)), math.cos(rad(a)), -0.25)) * L
                d = smin(d, sd_capsule(p, b, tip, r, r * 0.85), 0.008)
            d = smin(d, sd_capsule(p, (-0.036, 0.03, -0.004), (-0.07, 0.085, -0.02), 0.0125, 0.0098), 0.012)
            d = smin(d, sd_capsule(p, (0, -0.03, 0), (0, 0.01, 0), 0.027, 0.03), 0.015)
            return d
        return fn
    handm = M.skin('momhand', base='#EBCDBD', flush='#DDB3A6', tip_axis=1, tip0=0.05, tip1=0.2, sss=0.0012)
    if toon.PIXAR:
        handm = toon.skin('momhand', base='#F6BE9F', flush='#F4807A', tip_axis=1, tip0=0.06, tip1=0.16, tipk=0.35, sss=0.003)
    for f in 'LR':
        k = toon.pick(1.0, 0.82)
        ua = segment('muarm_' + f, 0.056 * k, 0.05 * k, MOM['uarm'], card, steps=40)
        fa = segment('mfarm_' + f, 0.05 * k, 0.043 * k, MOM['farm'], card, steps=40,
                     extra=[(0.044 * k, MOM['farm'] - 0.05), (0.047 * k, MOM['farm'] - 0.046), (0.047 * k, MOM['farm'] - 0.004)])
        hd = sdf_mesh('mhand_' + f, mhand(f == 'L'), (-0.09, -0.06, -0.06), (0.06, 0.18, 0.035), 0.0022, handm, smooth_iter=2)
        hd.rotation_mode = 'QUATERNION'
        sph = sphere('mshoulder_' + f, 0.054 * k, (0, 0, 0), card, seg=32, rings=16)
        rig[f].update(uarm=ua, farm=fa, hand=hd, shoulder=sph)


def build_mom():
    rig = {}
    sockm = M.knit('sock', '#F1E9D8', rows=300, bump=0.9, band=(1, 0.150, '#D9A441', 1, -0.045), shade=0.82)
    pants = M.fabric('denim', '#6C7F95', weave=780, rough=0.85, sheen=0.25, var=0.2, bump=0.6, color2='#4C5E75')
    card = M.knit('cardigan', toon.pick('#F3EBDB', '#EE8468'), rows=120, bump=1.0, shade=0.86)
    skinm = M.skin('mom', base='#EBC6AE', flush='#DFA594', tip_axis=1, tip0=0.05, tip1=0.2, sss=0.006)
    if toon.PIXAR:
        skinm = toon.skin('momneck', base='#F6BE9F', sss=0.006)
    ptex = bpy.data.textures.new('pants_folds', 'CLOUDS')
    ptex.noise_scale = 0.11
    ptex.noise_depth = 1
    for f in 'LR':
        fn = foot_sdf(mirror=(f == 'L'))
        rear = sdf_mesh('mfoot_' + f, fn, (-0.06, -0.075, -0.002), (0.06, 0.20, 0.34), 0.002, sockm, smooth_iter=2)
        rear.rotation_mode = 'QUATERNION'
        shin = segment('mshin_' + f, 0.074, 0.088, MOM['shin'], pants, steps=48, open_start=True)
        thigh = segment('mthigh_' + f, 0.090, 0.108, MOM['thigh'], pants, steps=48)
        knee = sphere('mknee_' + f, 0.0895, (0, 0, 0), pants, seg=32, rings=16)
        for o in (shin, thigh):
            sub = o.modifiers.new('sub', 'SUBSURF')
            sub.levels = sub.render_levels = 1
            d = o.modifiers.new('folds', 'DISPLACE')
            d.texture = ptex
            d.strength = 0.016
            d.mid_level = 0.5
        rig[f] = dict(rear=rear, shin=shin, thigh=thigh, knee=knee)
    pelvis = empty('mom_pelvis')
    sphere('mom_hips', 0.1, (0, 0, 0.0), pants, scale=(1.25, 1.85, 1.3), parent=pelvis)
    torso = empty('mom_torso', (0, 0, 0.02), parent=pelvis)
    # torso local: +X forward, +Z up the spine
    prof = [(0.0, -0.06), (0.150, -0.06), (0.176, 0.0), (0.172, 0.12), (0.168, 0.26), (0.176, 0.36), (0.165, 0.43), (0.12, 0.475),
            (0.06, 0.50), (0.0, 0.505)]
    tor = lathe('mom_cardigan', prof, card, parent=torso, steps=64)
    tor.scale = toon.pick((0.70, 1.0, 1.0), (0.66, 0.90, 1.0))
    if toon.PIXAR:                       # slimmer, longer neck leaning into the bigger head; low collar keeps the chin in view
        nk = lathe('mom_neck', [(0, 0.0), (0.040, 0.0), (0.035, 0.22), (0, 0.22)], skinm, parent=torso, steps=32, loc=(0.0, 0, 0.46))
        nk.rotation_euler = (0, rad(13), 0)
        lathe('mom_tee', [(0, 0.44), (0.075, 0.44), (0.066, 0.485), (0.045, 0.497), (0, 0.497)], pbr('tee', '#FAF8F4', 0.8),
              parent=torso, steps=32, loc=(0.012, 0, 0))
    else:
        lathe('mom_neck', [(0, 0.47), (0.05, 0.47), (0.046, 0.60), (0, 0.60)], skinm, parent=torso, steps=32)
        lathe('mom_tee', [(0, 0.44), (0.085, 0.44), (0.075, 0.50), (0.052, 0.522), (0, 0.522)], pbr('tee', '#FAF8F4', 0.8),
              parent=torso, steps=32, loc=(0.02, 0, 0))
    head = empty('mom_head', HEAD_OFF, parent=torso)
    if toon.PIXAR:
        head.scale = (1.42, 1.42, 1.42)
        rig['lids'] = toon.mom_head(head)
        _mom_arms(rig, card)
        rig.update(pelvis=pelvis, torso=torso, head=head)
        return rig

    def head_fn(p):                      # head local: +X = face direction, +Z up
        d = sd_ellipsoid(p, (0, 0, 0.03), (0.092, 0.074, 0.105))
        d = smin(d, sd_ellipsoid(p, (0.03, 0, -0.035), (0.062, 0.058, 0.062)), 0.03)           # jaw / chin
        d = smin(d, sd_ellipsoid(p, (0.094, 0, 0.004), (0.016, 0.013, 0.022)), 0.012)          # nose
        for sy in (-1, 1):
            d = smin(d, sd_ellipsoid(p, (0.065, sy * 0.045, -0.012), (0.03, 0.028, 0.026)), 0.03)   # cheeks
            d = smin(d, sd_ellipsoid(p, (-0.005, sy * 0.076, 0.0), (0.012, 0.008, 0.026)), 0.006)   # ears
            d = smax(d, -sd_ellipsoid(p, (0.083, sy * 0.033, 0.03), (0.012, 0.017, 0.009)), 0.012)  # eye sockets
        return d
    sdf_mesh('mom_face', head_fn, (-0.11, -0.095, -0.115), (0.125, 0.095, 0.15), 0.003, skinm, parent=head, smooth_iter=2)

    def hair_fn(p):
        d = sd_ellipsoid(p, (-0.012, 0, 0.042), (0.103, 0.086, 0.108))
        cut = sd_ellipsoid(p, (0.085, 0, -0.03), (0.085, 0.066, 0.115))                        # open the face
        d = smax(d, -cut, 0.02)
        d = smax(d, -(p[..., 2] + 0.07), 0.02)
        d = smin(d, sd_sphere(p, (-0.105, 0, 0.075), 0.042), 0.02)                             # bun
        for sy in (-1, 1):
            d = smin(d, sd_capsule(p, (0.045, sy * 0.073, 0.06), (0.03, sy * 0.079, -0.07), 0.016, 0.009), 0.015)
        return d
    hairm = pbr('mom_hair', '#2B1D16', 0.38, Sheen_Weight=0.5, Coat_Weight=0.2, Coat_Roughness=0.3)
    hn = NT(hairm)
    hn.P(Normal=hn.bump(hn.wave(hn.obj, scale=420, dist=3.0, detail=2, direction='Y'), 0.5, 0.001))
    sdf_mesh('mom_hair', hair_fn, (-0.16, -0.11, -0.09), (0.11, 0.11, 0.17), 0.003, hairm, parent=head, smooth_iter=2)
    eyem = pbr('mom_eye', '#1E120D', 0.25, Coat_Weight=0.6)
    browm = pbr('mom_brow', '#33221A', 0.6)
    lipm = pbr('mom_lip', '#C4655F', 0.38)
    for sy in (-1, 1):
        sphere('mom_eye', 0.012, (0.0805, sy * 0.033, 0.03), eyem, scale=(0.5, 1.25, 0.62), parent=head, seg=20, rings=10)
        box('mom_brow', (0.006, 0.036, 0.006), (0.089, sy * 0.034, 0.053), browm, parent=head, bevel=0.003, rot=(sy * 0.12, 0, sy * 0.25))

    def smile(u, v):                     # a warm, open smile
        a = (u - 0.5) * 2
        y = a * 0.027
        x = 0.0925 - abs(a) ** 2 * 0.017
        z = -0.050 + abs(a) ** 2 * 0.012 + (v - 0.5) * 0.011 * (1 - abs(a) ** 2)
        return (x, y, z)
    grid_surface('mom_mouth', 16, 3, smile, lipm, parent=head, solid=0.003)
    grid_surface('mom_teeth', 16, 3, lambda u, v: (smile(u, 0.5)[0] - 0.0008, smile(u, 0.5)[1] * 0.8, smile(u, 0.5)[2] + (v - 0.5) * 0.005),
                 pbr('teeth', '#F5F0E6', 0.3), parent=head, solid=0.003)
    for sy in (-1, 1):                    # blush
        sphere('mom_blush', 0.02, (0.078, sy * 0.05, -0.016), pbr('blush', '#E7A193', 0.5, Subsurface_Weight=0.8,
                                                               Subsurface_Radius=(1, 0.4, 0.3), Subsurface_Scale=0.005),
               scale=(0.35, 1, 0.8), parent=head, seg=16, rings=8)
    _mom_arms(rig, card)
    rig.update(pelvis=pelvis, torso=torso, head=head)
    return rig


def mom_pose(rig, t, cam):
    out = {}
    m = TL.mom_state(t)
    th = m['theta']
    fwd = Vector((math.cos(th), math.sin(th), 0))
    left = Vector((-fwd.y, fwd.x, 0))
    P = Vector(m['pelvis'])
    qyaw = Quaternion(UP, th)
    out[rig['pelvis']] = (P, qyaw, None)
    lean = m['lean']
    qt = Quaternion((0, 1, 0), lean)                          # torso local: lean forward about local +Y
    out[rig['torso']] = (Vector((0, 0, 0.02)), qt, None)
    Tw = qyaw @ qt                                            # torso world rotation
    To = P + Vector((0, 0, 0.02))
    eye = Vector(cam['pos'])
    # head: look at the baby once crouching, otherwise slightly down
    head_w = To + Tw @ Vector(HEAD_OFF)
    want = (eye - head_w).normalized()
    k = TL.ease(t, 33.2, 34.6)
    base_dir = (Tw @ Vector((1, 0, -0.25))).normalized()
    d = base_dir.lerp(want, k).normalized()
    # world quaternion with +X = d, +Z ~ up ; convert to torso-local
    y = UP.cross(d)
    y.normalize()
    z = d.cross(y)
    qw = Matrix((d, y, z)).transposed().to_quaternion()
    out[rig['head']] = (Vector(HEAD_OFF), Tw.inverted() @ qw, None)
    for lid in rig.get('lids', ()):
        out[lid] = ('euler', (0, toon.lid_angle(t), 0))
    for f in 'LR':
        s = TL.side(f)
        (fx, fy, fz), fyaw, fpitch, toe = m['foot' + f]
        ffd = Vector((math.cos(fyaw), math.sin(fyaw), 0))
        flat = Vector((-ffd.y, ffd.x, 0))
        q = Quaternion(UP, fyaw - math.pi / 2)
        q = Quaternion(flat, fpitch) @ q                       # +pitch: heel up
        pivot = Vector((0, BALL_Y, 0)) if fpitch > 0 else Vector((0, -0.04, 0))
        base = Vector((fx, fy, fz))
        loc = base + (Quaternion(UP, fyaw - math.pi / 2) @ pivot) - (q @ pivot)
        out[rig[f]['rear']] = (loc, q, None)
        ankle = loc + q @ Vector((0, -0.042, MOM['ankle_h']))
        hip = P + left * s * MOM['hip_w'] + Vector((0, 0, -0.02))
        pole = fwd * 1.0 + left * s * (0.25 + 0.5 * m['squat'])
        knee = ik2(hip, ankle, MOM['thigh'], MOM['shin'], pole)
        d1 = knee - ankle
        d2 = hip - knee
        out[rig[f]['shin']] = (ankle, quat_y_to(d1, fwd), Vector((1, d1.length / MOM['shin'], 1)))
        out[rig[f]['thigh']] = (knee, quat_y_to(d2, fwd), Vector((1, d2.length / MOM['thigh'], 1)))
        out[rig[f]['knee']] = (knee, Quaternion(), None)
        # arms
        sh = To + Tw @ Vector((0.0, s * MOM['sh_w'], MOM['sh_h']))
        rest = To + Tw @ Vector((0.21, s * 0.045, 0.20))                     # hands clasped in front
        e2 = Vector(TL.eye_xy(t)).to_3d()
        e2.z = TL.eye_z(t)
        bf, bl = TL.body_frame(t)
        grab = e2 + Vector((bf[0], bf[1], 0)) * (-0.02) + Vector((bl[0], bl[1], 0)) * (-s * 0.135) + Vector((0, 0, -0.105))
        # (mum faces the baby, so her left hand goes to the baby's right side)
        wide = To + Tw @ Vector((0.17, s * 0.24, 0.10))                     # arms open before scooping the baby up
        base = rest.lerp(wide, TL.ease(t, 33.4, 34.3))
        kk = TL.ease(t, 34.3 + (0.15 if f == 'L' else 0), 35.9)
        tgt = base.lerp(grab, kk)
        pole_a = left * s * 1.0 - UP * 0.8 - fwd * 0.3
        el = ik2(sh, tgt, MOM['uarm'], MOM['farm'], pole_a)
        d1 = el - sh
        d2 = tgt - el
        out[rig[f]['shoulder']] = (sh, Quaternion(), None)
        out[rig[f]['uarm']] = (sh, quat_y_to(d1), Vector((1, d1.length / MOM['uarm'], 1)))
        out[rig[f]['farm']] = (el, quat_y_to(d2), Vector((1, d2.length / MOM['farm'], 1)))
        # hand: fingers continue the forearm, palm towards the body centre line
        hq = quat_y_to(d2, left * -s)
        out[rig[f]['hand']] = (tgt + d2.normalized() * 0.01, hq, None)
    return out


# =============================================================================== baking
class Baker:
    def __init__(self):
        self.prev = {}
        bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'

    def key(self, o, frame, loc=None, quat=None, scale=None):
        if loc is not None:
            o.location = loc
            o.keyframe_insert('location', frame=frame)
        if quat is not None:
            p = self.prev.get(o.name)
            if p is not None and p.dot(quat) < 0:
                quat = -quat
            self.prev[o.name] = quat.copy()
            o.rotation_mode = 'QUATERNION'
            o.rotation_quaternion = quat
            o.keyframe_insert('rotation_quaternion', frame=frame)
        if scale is not None:
            o.scale = scale
            o.keyframe_insert('scale', frame=frame)

    def apply(self, poses, frame):
        for o, v in poses.items():
            if v[0] == 'euler':
                o.rotation_euler = v[1]
                o.keyframe_insert('rotation_euler', frame=frame)
            else:
                self.key(o, frame, *v)
