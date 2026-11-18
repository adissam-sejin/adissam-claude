"""Render frames of the baked scene with Cycles to linear OpenEXR (resumable)."""
import sys, os, time, argparse
import bpy

ap = argparse.ArgumentParser()
ap.add_argument('--blend', default='/tmp/babypov/scene.blend')
ap.add_argument('--out', default='/tmp/babypov/exr')
ap.add_argument('--frames', default='')          # "0,10,20" or "0-911" or "0-911:4"
ap.add_argument('--res', default='1280x720')
ap.add_argument('--spp', type=int, default=20)
ap.add_argument('--blur', type=int, default=1)
ap.add_argument('--fastgi', type=int, default=1)
ap.add_argument('--cam', default='')        # debug camera: x,y,z,tx,ty,tz,lens
ap.add_argument('--tag', default='f')
ap.add_argument('--opt', default='')        # python statements run after setup, e.g. "c.max_bounces=4"
a = ap.parse_args()

bpy.ops.wm.open_mainfile(filepath=a.blend)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
c = sc.cycles
c.device = 'CPU'
c.samples = a.spp
c.use_adaptive_sampling = False
c.use_denoising = True
c.denoiser = 'OPENIMAGEDENOISE'
c.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
c.denoising_prefilter = 'FAST'
c.max_bounces = 6
c.diffuse_bounces = 3
c.glossy_bounces = 3
c.transmission_bounces = 6
c.transparent_max_bounces = 10
c.sample_clamp_indirect = 8.0
c.sample_clamp_direct = 0.0
c.caustics_reflective = False
c.caustics_refractive = False
c.blur_glossy = 0.8
c.use_fast_gi = bool(a.fastgi)
c.fast_gi_method = 'REPLACE'
c.ao_bounces_render = 2
c.use_light_tree = False
c.seed = 7
c.use_animated_seed = False
c.pixel_filter_type = 'BLACKMAN_HARRIS'
c.filter_width = 1.6
w, h = (int(v) for v in a.res.split('x'))
r = sc.render
r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
r.threads_mode = 'FIXED'
r.threads = os.cpu_count()
r.use_persistent_data = True
r.use_motion_blur = bool(a.blur)
r.motion_blur_shutter = 0.45
r.motion_blur_position = 'START'
r.film_transparent = False
r.image_settings.file_format = 'OPEN_EXR'
r.image_settings.color_mode = 'RGB'
r.image_settings.color_depth = '16'
r.image_settings.exr_codec = 'ZIP'
try:
    sc.world.light_settings.distance = 1.5
except Exception:
    pass

if a.cam:
    from mathutils import Vector
    v = [float(x) for x in a.cam.split(',')]
    cd = bpy.data.cameras.new('dbg')
    cd.lens = v[6]
    cd.clip_start = 0.005
    co = bpy.data.objects.new('dbg', cd)
    sc.collection.objects.link(co)
    co.location = v[0:3]
    d = Vector(v[3:6]) - Vector(v[0:3])
    co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
exec(a.opt)
frames = []
for part in a.frames.split(','):
    if not part:
        continue
    step = 1
    if ':' in part:
        part, step = part.split(':')
        step = int(step)
    if '-' in part:
        s, e = part.split('-')
        frames += list(range(int(s), int(e) + 1, step))
    else:
        frames.append(int(part))
os.makedirs(a.out, exist_ok=True)
for f in frames:
    path = os.path.join(a.out, a.tag + '%04d.exr' % f)
    if os.path.exists(path):
        continue
    t0 = time.time()
    sc.frame_set(f)
    tmp = os.path.join(a.out, 'tmp_%d_%s%04d.exr' % (os.getpid(), a.tag, f))
    r.filepath = tmp
    bpy.ops.render.render(write_still=True)
    os.replace(tmp, path)
    print('FRAME %d done in %.1fs' % (f, time.time() - t0), flush=True)
