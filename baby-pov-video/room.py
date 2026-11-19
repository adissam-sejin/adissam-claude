"""The apartment: shell, daylight, furniture, appliances, toys (everything static)."""
import math, random
import bpy
from mathutils import Vector, Matrix
from lib import *
import materials as M
import timeline as TL
import toon

rad = math.radians
SUN_DIR = Vector((0.35, 0.80, -0.50)).normalized()      # direction the light travels


def grp(name, loc, rz=0.0):
    e = empty(name, loc)
    e.rotation_mode = 'XYZ'
    e.rotation_euler = (0, 0, rz)
    return e


# =============================================================================== shell
def build_shell():
    wallm = M.wall_paint(color=toon.pick('#EFEAE2', '#F7E1BE'))
    trim = pbr('trim_white', '#F3F1EC', 0.42)
    box2('floor', (-3.2, -2.7, -0.12), (3.2, 4.7, 0.0), M.wood_floor(), bevel=0)
    box2('ceiling', (-3.2, -2.7, 2.4), (3.2, 4.7, 2.52), pbr('ceil', '#F6F4F0', 0.9), bevel=0)
    box2('wall_w', (-3.15, -2.65, 0), (-3.0, 4.65, 2.4), wallm, bevel=0)
    box2('wall_e', (3.0, -2.65, 0), (3.15, 4.65, 2.4), wallm, bevel=0)
    box2('wall_n', (-3.0, 4.5, 0), (3.0, 4.65, 2.4), wallm, bevel=0)
    box2('wall_s_l', (-3.0, -2.65, 0), (-2.2, -2.5, 2.4), wallm, bevel=0)
    box2('wall_s_r', (2.2, -2.65, 0), (3.0, -2.5, 2.4), wallm, bevel=0)
    box2('wall_s_t', (-2.2, -2.65, 2.25), (2.2, -2.5, 2.4), wallm, bevel=0)
    # baseboards
    bb = lambda a, b: box2('baseboard', a, b, trim, bevel=0.003)
    bb((-3.0, -2.5, 0), (-2.988, 1.85, 0.07))
    bb((-3.0, 2.85, 0), (-2.988, 3.9, 0.07))
    bb((2.988, -2.5, 0), (3.0, 3.75, 0.07))
    bb((-3.0, -2.5, 0), (-2.2, -2.488, 0.07))
    bb((2.2, -2.5, 0), (3.0, -2.488, 0.07))
    # ---- window: frame, mullions, glass
    fr = pbr('pvc', '#EEEDEA', 0.3, Coat_Weight=0.3, Coat_Roughness=0.1)
    box2('win_bottom', (-2.2, -2.58, 0.0), (2.2, -2.49, 0.04), fr, bevel=0.004)
    box2('win_top', (-2.2, -2.58, 2.20), (2.2, -2.49, 2.25), fr, bevel=0.004)
    for x in (-2.175, 2.175):
        box2('win_side', (x - 0.025, -2.58, 0.04), (x + 0.025, -2.49, 2.20), fr, bevel=0.004)
    for x, w in ((-1.08, 0.07), (0.0, 0.10), (1.08, 0.07)):
        box2('win_mullion', (x - w / 2, -2.575, 0.04), (x + w / 2, -2.495, 2.20), fr, bevel=0.004)
    box2('win_handle', (0.02, -2.497, 0.95), (0.035, -2.47, 1.13), M.metal('alu', '#B9BCC0', 0.35), bevel=0.003)
    gl = M.glass('window_glass')
    for a, b in ((-2.15, -1.115), (-1.045, -0.05), (0.05, 1.045), (1.115, 2.15)):
        grid_surface('win_glass', 2, 2, lambda u, v, a=a, b=b: (a + (b - a) * u, -2.537, 0.04 + 2.16 * v), gl)
    # ---- exterior: ledge, safety railing, distant city
    conc = pbr('concrete', '#B9B5AD', 0.85)
    box2('ledge', (-2.7, -3.05, -0.3), (2.7, -2.65, -0.005), conc, bevel=0.005)
    rail = pbr('rail', '#4A4D50', 0.85)
    box2('rail_top', (-2.25, -2.80, 1.08), (2.25, -2.75, 1.115), rail, bevel=0.006)
    box2('rail_bot', (-2.25, -2.785, 0.10), (2.25, -2.765, 0.125), rail, bevel=0.003)
    x = -2.2
    while x <= 2.21:
        cyl('rail_bar', 0.008, 0.96, (x, -2.775, 0.60), rail, steps=12, bevel=0)
        x += 0.11
    box2('city_ground', (-2500, -3500, -46), (2500, -3.2, -45), pbr('cityg', toon.pick('#56624F', '#7FB869'), 0.95), bevel=0)
    rnd = random.Random(4)
    hazes = [pbr('bldg%d' % i, c, 0.9) for i, c in enumerate(toon.pick(('#AEB6C0', '#B9C0C8', '#C3C9D0', '#A3ADB8', '#CBD0D5'),
                                                                      ('#EBD3C2', '#C3D7EA', '#EFE5C6', '#DAD0E6', '#CDE4D6')))]
    if toon.PIXAR:
        for m in hazes:
            toon.keep(m)
    for i in range(46):                                   # hazy skyline
        dist = rnd.uniform(160, 620)
        ang = rnd.uniform(-1.05, 1.05)
        w, d, h = rnd.uniform(20, 55), rnd.uniform(14, 22), rnd.uniform(30, 110) * (0.6 + dist / 600)
        box('bldg', (w, d, h), (math.sin(ang) * dist + 30, -math.cos(ang) * dist, h / 2 - 45), hazes[i % 5], bevel=0,
            rot=(0, 0, rnd.choice((0, 0, 0.3, -0.25))))
    for i in range(7):                                    # distant hills
        sphere('hill', 1.0, (rnd.uniform(-1500, 1500), rnd.uniform(-2300, -1500), -45), pbr('hill', toon.pick('#8FA0A6', '#86C08A'), 1.0),
               scale=(rnd.uniform(500, 900), 300, rnd.uniform(110, 230)), seg=32, rings=12)
    # ---- curtains
    def panel(name, x0, w, folds, amp, mat, seed, y=-2.41, sway=True, h=2.31):
        rnd = random.Random(seed)
        ph = [rnd.uniform(0, 6.28) for _ in range(4)]

        def fn(u, v):
            a = amp * (0.55 + 0.45 * (1 - v)) * (1 + 0.25 * math.sin(u * 9 + ph[0]))
            z = a * math.sin(2 * math.pi * folds * u + ph[1] + 0.6 * math.sin(u * 5 + ph[2])) \
                + 0.012 * (1 - v) * math.sin(u * 3.1 + ph[3])
            return (x0 + u * w, 0.02 + v * h, z)
        o = grid_surface(name, int(folds * 14) + 2, 20, fn, mat, loc=(0, y, 0), rot=(math.pi / 2, 0, 0))
        if sway:
            m = o.modifiers.new('wave', 'WAVE')
            m.use_x, m.use_y = True, False
            m.height, m.width, m.narrowness, m.speed = 0.012, 1.3, 1.1, 0.01
            m.time_offset = -200 - seed * 37
            m.damping_time = 0
            m.lifetime = 0
        return o
    panel('sheer_l', -2.36, 1.22, 11, 0.032, M.sheer(), 1)
    panel('sheer_r', 1.14, 1.22, 11, 0.032, M.sheer(), 2)
    drape = M.drape()
    panel('drape_l', -2.50, 0.25, 2.5, 0.02, drape, 3, y=-2.385, sway=False)
    panel('drape_r', 2.25, 0.25, 2.5, 0.02, drape, 4, y=-2.385, sway=False)
    box2('pelmet', (-2.6, -2.49, 2.33), (2.6, -2.30, 2.40), trim, bevel=0.004)
    # ---- door on the west wall (kitchen side)
    box2('door_frame_t', (-3.0, 1.85, 2.05), (-2.975, 2.85, 2.13), trim, bevel=0.004)
    for y in (1.85, 2.77):
        box2('door_frame_s', (-3.0, y, 0), (-2.975, y + 0.08, 2.05), trim, bevel=0.004)
    box2('door_leaf', (-3.0, 1.93, 0.005), (-2.985, 2.77, 2.05), pbr('door', '#EDEAE4', 0.4), bevel=0.002)
    for z0, z1 in ((0.15, 0.95), (1.05, 1.95)):
        box2('door_panel', (-2.987, 2.03, z0), (-2.981, 2.67, z1), pbr('door', '#EDEAE4', 0.4), bevel=0.006)
    stl = M.metal('satin', '#A9ABAE', 0.32)
    cyl('door_knob_rose', 0.026, 0.008, (-2.981, 2.69, 1.0), stl, rot=(0, rad(90), 0))
    box2('door_lever', (-2.975, 2.57, 0.992), (-2.955, 2.70, 1.008), stl, bevel=0.005, segs=3)
    # ---- wall sockets with baby-proof covers
    def socket(loc, rz):
        g = grp('socket', loc, rz)
        box('plate', (0.076, 0.008, 0.118), (0, -0.004, 0), pbr('socket', '#F2F1EE', 0.35), bevel=0.003, parent=g)
        for dz in (-0.028, 0.028):
            cyl('cover', 0.019, 0.006, (0, -0.009, dz), pbr('cover', '#E3E6E8', 0.25), rot=(rad(90), 0, 0), parent=g)
    socket((2.998, 0.42, 0.29), rad(-90))
    socket((-2.998, -2.30, 0.29), rad(90))
    socket((-2.998, 0.75, 0.29), rad(90))
    socket((2.62, -2.498, 0.29), rad(180))
    # light switch
    box('switch', (0.008, 0.075, 0.118), (-2.996, 1.72, 1.2), pbr('socket', '#F2F1EE', 0.35), bevel=0.003)
    # ---- recessed ceiling lights
    off = pbr('lens_off', '#F2F0EA', 0.3)
    on = emit('lens_on', (1.0, 0.88, 0.74), 13.0)
    ring = pbr('trim_white', '#F3F1EC', 0.42)
    for x in (-1.5, 0.0, 1.5):
        for y in (-1.3, 0.3):
            torus('dl_ring', 0.052, 0.007, (x, y, 2.398), ring, seg=32, rseg=8)
            cyl('dl_lens', 0.048, 0.004, (x, y, 2.399), off, steps=32, bevel=0)
    for x, y in TL_DOWNLIGHTS:
        torus('dl_ring', 0.052, 0.007, (x, y, 2.398), ring, seg=32, rseg=8)
        cyl('dl_lens', 0.048, 0.004, (x, y, 2.399), on, steps=32, bevel=0)


TL_DOWNLIGHTS = [(-2.0, 3.55), (-1.0, 3.55), (0.0, 3.55), (1.0, 3.55), (-1.5, 2.3), (0.0, 2.3)]


def build_lights(scene):
    w = bpy.data.worlds.new('sky')
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except Exception:
        pass
    sky.sun_disc = False
    sky.sun_elevation = math.asin(-SUN_DIR.z)
    sky.sun_rotation = math.atan2(-SUN_DIR.x, SUN_DIR.y)
    for k, v in (('altitude', 60.0), ('air_density', 1.0), ('aerosol_density', 3.2), ('ozone_density', 0.8)):
        try:
            setattr(sky, k, v)
        except Exception:
            pass
    mixn = nt.nodes.new('ShaderNodeMixRGB')
    mixn.inputs[0].default_value = toon.pick(0.32, 0.10)
    nt.links.new(sky.outputs[0], mixn.inputs[1])
    mixn.inputs[2].default_value = (9.0, 10.5, 12.5, 1.0)        # milky afternoon haze
    nt.links.new(mixn.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 1.0
    try:
        w.cycles_visibility.camera = True
    except Exception:
        pass
    # sun
    sd = bpy.data.lights.new('sun', 'SUN')
    sd.energy = 1.0
    sd.color = (1.0, 0.86, 0.68)
    sd.angle = rad(1.3)
    so = bpy.data.objects.new('sun', sd)
    so.rotation_mode = 'QUATERNION'
    so.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(SUN_DIR)
    link(so)
    # sky portal on the window
    pd = bpy.data.lights.new('portal', 'AREA')
    pd.shape = 'RECTANGLE'
    pd.size, pd.size_y = 4.3, 2.2
    pd.cycles.is_portal = True
    po = bpy.data.objects.new('portal', pd)
    po.location = (0, -2.60, 1.13)
    po.rotation_euler = (math.pi / 2, 0, 0)
    link(po)
    lights = {'sun': sd, 'bg': bg, 'kitchen': []}
    # kitchen downlights
    for x, y in TL_DOWNLIGHTS:
        d = bpy.data.lights.new('downlight', 'SPOT')
        d.energy = 1.0
        d.color = (1.0, 0.89, 0.76)
        d.spot_size = rad(125)
        d.spot_blend = 0.7
        d.shadow_soft_size = 0.045
        o = bpy.data.objects.new('downlight', d)
        o.location = (x, y, 2.385)
        link(o)
        lights['kitchen'].append(d)
    # under-cabinet LED strip
    d = bpy.data.lights.new('strip', 'AREA')
    d.shape = 'RECTANGLE'
    d.size, d.size_y = 3.7, 0.025
    d.color = (1.0, 0.86, 0.70)
    o = bpy.data.objects.new('strip', d)
    o.location = (-0.5, 4.22, 1.445)
    link(o)
    lights['strip'] = d
    # pendants over the dining table
    lights['pendant'] = []
    for x in (1.60, 2.30):
        d = bpy.data.lights.new('pendant', 'POINT')
        d.color = (1.0, 0.72, 0.45)
        d.shadow_soft_size = 0.07
        o = bpy.data.objects.new('pendant', d)
        o.location = (x, 2.4, 1.52)
        link(o)
        lights['pendant'].append(d)
    # washer drum light
    d = bpy.data.lights.new('drumlight', 'POINT')
    d.color = (0.85, 0.93, 1.0)
    d.shadow_soft_size = 0.02
    o = bpy.data.objects.new('drumlight', d)
    o.location = (TL.WASHER_DOOR[0], 3.975, TL.WASHER_DOOR[2] + 0.165)
    link(o)
    lights['drum'] = d
    return lights


# =============================================================================== living room
def build_living():
    oak = M.wood('oak', '#CDA677', '#A47D52')
    walnut = M.wood('walnut', '#8B5F3E', '#5F3F28')
    # ---- play mat
    mat = box2('playmat', (TL.MAT[0], TL.MAT[2], 0.0), (TL.MAT[1], TL.MAT[3], TL.MAT_H), M.play_mat(), bevel=0.014, segs=4)
    # ---- sofa
    g = grp('sofa', (-2.50, -0.65, 0))
    fab = M.fabric('sofa', toon.pick('#B5AA9A', '#7FAAC2'), weave=520)
    Wd, Dp = 2.1, 0.95
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('sofa_leg', 0.02, 0.13, (sx * (Dp / 2 - 0.07), sy * (Wd / 2 - 0.08), 0.065), walnut, r2=0.03, parent=g)
    box('sofa_base', (Dp, Wd, 0.17), (0, 0, 0.215), fab, bevel=0.025, segs=4, parent=g)
    box('sofa_back', (0.2, Wd, 0.62), (-Dp / 2 + 0.10, 0, 0.5), fab, bevel=0.05, segs=5, parent=g)
    for sy in (-1, 1):
        box('sofa_arm', (Dp, 0.17, 0.48), (0, sy * (Wd / 2 - 0.085), 0.43), fab, bevel=0.06, segs=5, parent=g)
    cw = (Wd - 0.34) / 3
    for i in range(3):
        y = -Wd / 2 + 0.17 + cw * (i + 0.5)
        box('sofa_seat', (0.70, cw - 0.012, 0.17), (0.10, y, 0.385), fab, bevel=0.05, segs=5, parent=g)
        box('sofa_cush', (0.20, cw - 0.02, 0.42), (-0.20, y, 0.66), fab, bevel=0.07, segs=6, rot=(0, rad(-12), 0), parent=g)
    box('pillow', (0.14, 0.42, 0.42), (0.06, -0.60, 0.64), M.fabric('pillow', '#C8704C', weave=380), bevel=0.065, segs=6,
        rot=(0.1, rad(-22), 0.3), parent=g)
    box('pillow2', (0.13, 0.40, 0.40), (0.02, 0.62, 0.63), M.fabric('pillow2', '#6F8A82', weave=380), bevel=0.06, segs=6,
        rot=(-0.1, rad(-18), -0.2), parent=g)

    def throw(u, v):                              # knitted throw over the south arm, hanging to the floor side
        prof = [(-0.70, 0.475), (-0.80, 0.50), (-0.885, 0.66), (-0.965, 0.675), (-1.06, 0.64), (-1.085, 0.40), (-1.09, 0.2)]
        s = v * (len(prof) - 1)
        i = min(int(s), len(prof) - 2)
        a, b = prof[i], prof[i + 1]
        f = s - i
        y = a[0] + (b[0] - a[0]) * f
        z = a[1] + (b[1] - a[1]) * f
        wr = 0.012 * math.sin(u * 23 + v * 7) * (0.3 + v)
        return (-0.18 + u * 0.55 + 0.03 * math.sin(v * 6), y - wr * 0.6, z + wr * 0.5 + 0.004)
    grid_surface('throw', 40, 40, throw, M.knit('throw', '#D9A441', rows=150), parent=g, solid=0.008)
    # ---- robot vacuum dock
    dockm = M.plastic('dock', '#F1F1EF', 0.35)
    box2('dock', (-2.995, TL.ROBOT_Y - 0.16, 0), (-2.80, TL.ROBOT_Y + 0.16, 0.36), dockm, bevel=0.03, segs=4)
    box2('dock_ramp', (-2.80, TL.ROBOT_Y - 0.14, 0), (-2.64, TL.ROBOT_Y + 0.14, 0.008), pbr('dockr', '#2B2D2F', 0.5), bevel=0.003)
    box2('dock_led', (-2.799, TL.ROBOT_Y - 0.02, 0.30), (-2.797, TL.ROBOT_Y + 0.02, 0.305), emit('led_w', (0.8, 0.95, 1), 8), bevel=0)
    # ---- floor lamp (off) by the sofa
    lm = M.metal('lampblk', '#1E1E1F', 0.4)
    cyl('lamp_base', 0.15, 0.02, (-2.72, 0.62, 0.01), lm)
    cyl('lamp_pole', 0.011, 1.45, (-2.72, 0.62, 0.745), lm, steps=16)
    lathe('lamp_shade', [(0.13, 1.33), (0.19, 1.60), (0.185, 1.60), (0.126, 1.335)], M.fabric('shade', '#E9E1D2', weave=700),
          loc=(-2.72, 0.62, 0))
    # ---- cube shelf with toy bins
    g = grp('shelf', (-2.81, 1.36, 0))
    wm = pbr('shelf_w', '#F1EFEA', 0.45)
    for z in (0.0, 0.385, 0.77):
        box('shelf_h', (0.38, 0.80, 0.03), (0, 0, z + 0.015), wm, parent=g, bevel=0.002)
    for y in (-0.385, 0.0, 0.385):
        box('shelf_v', (0.38, 0.03, 0.77), (0, y, 0.40), wm, parent=g, bevel=0.002)
    bins = ['#D8B9A0', '#9FB7A7', '#E6D3A0', '#A9B5C9']
    k = 0
    for z in (0.20, 0.585):
        for y in (-0.19, 0.19):
            if k == 3:                                               # one compartment with picture books
                rnd = random.Random(2)
                yy = y - 0.15
                for c in ('#D95B43', '#ECD078', '#53777A', '#C02942', '#F2E8CF', '#6A994E', '#457B9D', '#E9C46A'):
                    t = rnd.uniform(0.012, 0.03)
                    hh = rnd.uniform(0.22, 0.31)
                    box('book', (0.24, t, hh), (0.02, yy + t / 2, z - 0.17 + hh / 2), pbr('book' + c, c, 0.6), parent=g,
                        bevel=0.002, rot=(rnd.uniform(-0.03, 0.03), 0, 0))
                    yy += t + 0.002
            else:
                box('bin', (0.34, 0.33, 0.31), (0.01, y, z - 0.01), M.fabric('bin%d' % k, bins[k], weave=300, bump=0.8),
                    bevel=0.02, segs=3, parent=g)
            k += 1
    sphere('shelf_ball', 0.06, (0.0, 0.2, 0.86), M.plastic('sb', '#E9A23B'), parent=g)
    box('shelf_frame', (0.02, 0.2, 0.26), (-0.12, -0.15, 0.93), walnut, parent=g, rot=(0, rad(-8), 0), bevel=0.003)
    # ---- coffee table (pushed aside)
    g = grp('coffee', (-1.62, 0.85, 0))
    cyl('ct_top', 0.42, 0.028, (0, 0, 0.40), oak, parent=g, bevel=0.008)
    for i in range(3):
        a = rad(90 + i * 120)
        cyl('ct_leg', 0.02, 0.41, (math.cos(a) * 0.27, math.sin(a) * 0.27, 0.195), oak, r2=0.026, parent=g,
            rot=(-math.sin(a) * 0.18, math.cos(a) * 0.18, 0))
    lathe('mug', [(0.0, 0.0), (0.036, 0.0), (0.04, 0.005), (0.04, 0.09), (0.036, 0.09), (0.036, 0.008), (0, 0.008)],
          pbr('mug', '#3D5A80', 0.25), loc=(0.12, -0.1, 0.414), parent=g)
    box('ct_book', (0.21, 0.28, 0.022), (-0.12, 0.08, 0.425), pbr('ctb', '#D9C7A7', 0.6), rot=(0, 0, 0.4), parent=g)
    # ---- TV console + TV
    g = grp('console', (2.775, -0.8, 0))
    blk = M.metal('blk', '#1C1C1D', 0.4)
    box('con_body', (0.44, 1.8, 0.36), (0, 0, 0.36), oak, parent=g, bevel=0.006)
    for i in range(3):
        box('con_door', (0.016, 0.585, 0.33), (-0.226, -0.598 + i * 0.598, 0.36), M.wood('oak2', '#C29A6C', '#9A744B'), parent=g,
            bevel=0.003)
        cyl('con_knob', 0.012, 0.02, (-0.243, -0.598 + i * 0.598 + (0.24 if i != 1 else 0), 0.46), blk, rot=(0, rad(90), 0),
            parent=g)
    for sx in (-0.17, 0.17):
        for sy in (-0.82, 0.82):
            cyl('con_leg', 0.012, 0.18, (sx, sy, 0.09), blk, parent=g, steps=16)
    box('tv', (0.028, 1.23, 0.71), (0.10, 0, 1.015), pbr('tv_back', '#101011', 0.4), parent=g, bevel=0.004)
    box('tv_screen', (0.004, 1.21, 0.69), (0.084, 0, 1.015), pbr('tv_screen', (0.004, 0.004, 0.005), 0.06, Coat_Weight=1.0,
                                                               Coat_Roughness=0.03), parent=g, bevel=0)
    box('tv_stand', (0.2, 0.5, 0.012), (0.08, 0, 0.546), blk, parent=g, bevel=0.003)
    box('tv_neck', (0.03, 0.08, 0.12), (0.11, 0, 0.60), blk, parent=g, bevel=0.003)
    box('soundbar', (0.08, 0.86, 0.058), (-0.12, 0, 0.571), M.fabric('sbar', '#2B2B2D', weave=900), parent=g, bevel=0.012, segs=3)
    box('stb', (0.13, 0.19, 0.03), (-0.08, 0.66, 0.557), pbr('stb', '#151516', 0.3), parent=g, bevel=0.004)
    box('stb_led', (0.002, 0.006, 0.003), (-0.146, 0.60, 0.556), emit('led_g', (0.2, 1.0, 0.35), 30), parent=g, bevel=0)
    # cable clutter under the console
    cab = pbr('cable', '#151515', 0.5)
    box('powerstrip', (0.055, 0.30, 0.035), (0.10, 0.35, 0.0175), pbr('pstrip', '#ECEBE8', 0.4), parent=g, bevel=0.006)
    box('ps_switch', (0.02, 0.022, 0.006), (0.10, 0.475, 0.037), emit('led_r', (1.0, 0.12, 0.05), 6), parent=g, bevel=0.002)
    rnd = random.Random(7)
    for i in range(5):
        y0 = rnd.uniform(-0.5, 0.6)
        pts = [(0.16, y0, 0.60), (0.20, y0, 0.40), (0.19, y0 + rnd.uniform(-0.1, 0.1), 0.18),
               (0.16, (y0 + 0.35) / 2 + rnd.uniform(-0.1, 0.1), 0.012 + 0.01 * i), (0.12, 0.30 + i * 0.03, 0.02),
               (0.10, 0.25 + i * 0.045, 0.04)]
        tube('cable', pts, 0.0032 + 0.0008 * (i % 2), cab, parent=g)
    tube('cable_loop', [(0.02, 0.5, 0.006), (-0.08, 0.62, 0.006), (-0.02, 0.75, 0.006), (0.1, 0.7, 0.01), (0.12, 0.52, 0.02)],
         0.003, cab, parent=g)
    # ---- air purifier
    g = grp('purifier', (2.72, 0.62, 0))
    pm = M.plastic('pur', '#F3F3F1', 0.3)
    box('pur_body', (0.30, 0.30, 0.60), (0, 0, 0.31), pm, parent=g, bevel=0.05, segs=6)
    box('pur_grill', (0.302, 0.24, 0.30), (-0.001, 0, 0.20), M.perforated('pgrill', '#EDEDEB', 330), parent=g, bevel=0.002)
    torus('pur_ring', 0.085, 0.006, (0, 0, 0.612), emit('pur_led', (0.25, 0.75, 1.0), 6), parent=g, seg=48, rseg=8)
    cyl('pur_top', 0.08, 0.006, (0, 0, 0.612), pbr('pur_top', '#2A2C2E', 0.3), parent=g)
    # ---- potted rubber plant by the window
    g = grp('plant', (2.38, -1.98, 0))
    lathe('pot', [(0, 0), (0.16, 0), (0.175, 0.01), (0.215, 0.36), (0.225, 0.385), (0.21, 0.39), (0.20, 0.37), (0.19, 0.33),
                  (0, 0.33)], pbr('pot', '#E7E2D8', 0.55), parent=g)
    cyl('soil', 0.195, 0.02, (0, 0, 0.335), pbr('soil', '#2B2018', 0.95), parent=g)
    trunk = pbr('trunk', '#5A4632', 0.7)
    rnd = random.Random(11)
    lf = M.leaf()
    for s in range(3):
        a0 = rnd.uniform(0, 6.28)
        top = (0.07 * math.cos(a0), 0.07 * math.sin(a0), rnd.uniform(1.15, 1.5))
        base = (0.03 * math.cos(a0), 0.03 * math.sin(a0), 0.33)
        mid = ((base[0] + top[0]) / 2 + rnd.uniform(-0.04, 0.04), (base[1] + top[1]) / 2 + rnd.uniform(-0.04, 0.04),
               (base[2] + top[2]) / 2)
        tube('trunk', [base, mid, top], 0.011, trunk, parent=g)
        n = 9
        for i in range(n):
            f = 0.25 + 0.75 * i / (n - 1)
            p = Vector(base).lerp(Vector(mid), min(f * 2, 1)) if f < 0.5 else Vector(mid).lerp(Vector(top), f * 2 - 1)
            ang = a0 + i * 2.4 + rnd.uniform(-0.3, 0.3)
            L = rnd.uniform(0.20, 0.30)
            Wl = L * rnd.uniform(0.42, 0.5)
            droop = rnd.uniform(0.5, 1.6)

            def leaf_fn(u, v, L=L, Wl=Wl, droop=droop):
                w = Wl * (math.sin(math.pi * min(u * 1.08, 1.0)) ** 0.7) * 0.5
                x = (v - 0.5) * 2 * w
                y = 0.03 + u * L
                z = -droop * (u * L) ** 2 * 2.2 + abs(x) * 0.22
                return (x, y, z)
            o = grid_surface('leaf', 12, 7, leaf_fn, lf, loc=p, parent=g)
            o.rotation_euler = (rnd.uniform(0.3, 0.9), 0, ang)
    # ---- wall art above the sofa
    for i, (y, w, h) in enumerate(((-1.25, 0.5, 0.7), (-0.62, 0.5, 0.7), (0.0, 0.5, 0.7))):
        box('frame', (0.025, w, h), (-2.985, y, 1.55), oak, bevel=0.003)
        box('art', (0.004, w - 0.09, h - 0.09), (-2.972, y, 1.55), M.art(i * 1.7 + 0.3), bevel=0)
    # ---- toys on the mat
    build_toys()


def build_toys():
    maple = M.wood('maple', '#E9CFA3', '#D4B482', scale=3)
    # alphabet blocks spelling the baby's name
    g = grp('adi_blocks', (TL.BLOCKS[0], TL.BLOCKS[1], TL.MAT_H), rad(167.5))
    S = 0.045

    def block(ch, color, loc, rz, parent):
        b = grp('block_' + ch, loc, rz)
        b.parent = parent
        box('blk', (S, S, S), (0, 0, 0), maple, bevel=0.0035, segs=3, parent=b)
        cm = pbr('paint' + color, color, 0.45)
        text('t', ch, 0.036, (0, -S / 2 - 0.0002, 0), cm, rot=(math.pi / 2, 0, 0), parent=b)
        text('t2', ch, 0.036, (0, S / 2 + 0.0002, 0), cm, rot=(math.pi / 2, 0, math.pi), parent=b)
        text('t3', ch, 0.036, (0, 0, S / 2 + 0.0002), cm, rot=(0, 0, 0), parent=b)
        for sx in (-1, 1):
            box('side', (0.0008, S * 0.72, S * 0.72), (sx * (S / 2 + 0.0002), 0, 0), cm, bevel=0, parent=b)
        return b
    block('A', '#E4572E', (-0.026, 0, S / 2), rad(4), g)
    block('D', '#2E86AB', (0.024, 0.004, S / 2), rad(-6), g)
    block('I', '#F2B134', (0.002, 0.002, S * 1.5), rad(9), g)
    g2 = grp('loose_blocks', (0, 0, TL.MAT_H))
    block('B', '#76B041', (-0.62, -0.55, S / 2), rad(35), g2)
    block('O', '#9B5DE5', (0.80, -0.30, S / 2), rad(-20), g2)
    block('2', '#E4572E', (-0.30, -0.22, S / 2), rad(62), g2)
    # stacking rings
    g = grp('rings', (-0.02, -1.38, TL.MAT_H))
    cyl('ring_base', 0.07, 0.012, (0, 0, 0.006), M.plastic('rb', '#F4F1EA'), parent=g)
    cyl('ring_pole', 0.011, 0.20, (0, 0, 0.11), M.plastic('rb', '#F4F1EA'), r2=0.008, parent=g, steps=24)
    z = 0.012
    for R, r, c in ((0.052, 0.020, '#E4572E'), (0.045, 0.018, '#F29E4C'), (0.039, 0.0165, '#F2D03B'),
                    (0.033, 0.015, '#59B36B'), (0.027, 0.0135, '#3F8FD6')):
        torus('ring', R, r, (0, 0, z + r * 0.92), M.plastic('ring' + c, c, 0.3), parent=g, seg=48, rseg=16, squash=0.92)
        z += r * 1.84
    sphere('ring_top', 0.021, (0, 0, z + 0.016), M.plastic('rt', '#9B5DE5'), parent=g)
    # plush bear
    plush = M.fabric('plush', '#C79A63', weave=1500, sheen=1.0, bump=1.0, var=0.15)

    def bear(p):
        d = sd_ellipsoid(p, (0, 0, 0.075), (0.07, 0.06, 0.075))
        d = smin(d, sd_sphere(p, (0, -0.012, 0.178), 0.058), 0.012)
        d = smin(d, sd_ellipsoid(p, (0, -0.06, 0.166), (0.028, 0.024, 0.022)), 0.01)
        for sx in (-1, 1):
            d = smin(d, sd_sphere(p, (sx * 0.046, 0.0, 0.228), 0.022), 0.008)
            d = smin(d, sd_capsule(p, (sx * 0.06, -0.01, 0.115), (sx * 0.098, -0.055, 0.062), 0.022), 0.012)
            d = smin(d, sd_capsule(p, (sx * 0.04, -0.03, 0.03), (sx * 0.075, -0.115, 0.03), 0.028), 0.012)
        return d
    g = grp('bear', (-0.38, -1.30, TL.MAT_H), rad(-70))
    sdf_mesh('bear_body', bear, (-0.13, -0.16, -0.005), (0.13, 0.08, 0.26), 0.0035, plush, parent=g)
    blk = pbr('bear_eye', '#0B0B0B', 0.1, Coat_Weight=1.0)
    for sx in (-1, 1):
        sphere('bear_eye', 0.0065, (sx * 0.022, -0.062, 0.19), blk, parent=g, seg=16, rings=8)
    sphere('bear_nose', 0.009, (0, -0.083, 0.172), pbr('bear_nose', '#3A2618', 0.4), scale=(1.3, 0.8, 0.9), parent=g, seg=16, rings=8)
    # cloth book, rattle, pacifier
    box('clothbook', (0.15, 0.15, 0.022), (0.74, -0.60, TL.MAT_H + 0.011), M.fabric('cbook', '#7FB7BE', weave=500), bevel=0.01, segs=4,
        rot=(0, 0, 0.5))
    box('clothbook_tag', (0.03, 0.02, 0.003), (0.80, -0.50, TL.MAT_H + 0.004), M.fabric('ctag', '#E4572E', weave=500), bevel=0.001,
        rot=(0, 0, 0.9))
    g = grp('rattle', (0.12, -1.02, TL.MAT_H + 0.014), rad(40))
    torus('rattle_ring', 0.033, 0.0075, (0, 0, 0), M.plastic('rr', '#F5D76E'), parent=g, seg=40, rseg=12)
    for i, c in enumerate(('#E4572E', '#3F8FD6', '#59B36B')):
        a = rad(120 * i + 20)
        sphere('rattle_bead', 0.0125, (math.cos(a) * 0.033, math.sin(a) * 0.033, 0), M.plastic('bead' + c, c), parent=g, seg=20, rings=10)
    g = grp('pacifier', (0.15, -0.70, TL.MAT_H), rad(130))
    lathe('paci_shield', [(0, 0.012), (0.022, 0.011), (0.026, 0.014), (0.022, 0.017), (0, 0.018)], M.plastic('paci', '#A9D6E5', 0.3),
          parent=g, steps=32, rot=(rad(75), 0, 0), loc=(0, 0, 0.022))
    sphere('paci_teat', 0.01, (0, 0.02, 0.027), pbr('teat', '#F3E9D2', 0.3, Transmission_Weight=0.3), scale=(1, 1.5, 1), parent=g,
           seg=16, rings=8)
    torus('paci_ring', 0.014, 0.0025, (0, -0.012, 0.016), M.plastic('paci2', '#F4F1EA'), parent=g, seg=24, rseg=8)


# =============================================================================== kitchen + dining
def build_kitchen():
    Yf, Yb = TL.CAB_FRONT_Y, 4.5
    doorm = pbr('cab_door', toon.pick('#E3DED3', '#9ECDB8'), 0.48)
    dark = pbr('carcass', '#1B1A19', 0.7)
    blk = M.metal('hblk', '#1D1D1E', 0.38)
    steel = M.brushed_steel('steel', grubby=False)
    box2('toekick', (-3.0, Yf + 0.05, 0), (1.45, Yf + 0.07, 0.10), pbr('kick', '#2A2725', 0.6), bevel=0)
    box2('carcass', (-3.0, Yf + 0.021, 0.10), (-2.40, Yb, 0.87), dark, bevel=0)
    box2('carcass2', (-1.80, Yf + 0.021, 0.10), (1.45, Yb, 0.87), dark, bevel=0)
    wsh = pbr('washer_shell', '#6C7074', 0.5)
    box2('washer_back', (-2.40, 4.36, 0.10), (-1.80, Yb, 0.87), wsh, bevel=0)
    box2('washer_floor', (-2.40, Yf + 0.021, 0.10), (-1.80, 4.36, 0.16), wsh, bevel=0)
    box2('counter', (-2.40, Yf - 0.02, 0.87), (1.45, Yb, 0.905), M.stone(), bevel=0.004)
    box2('backsplash', (-2.40, Yb - 0.008, 0.905), (1.45, Yb, 1.45), M.tiles(), bevel=0)

    def front(x0, x1, z0, z1, handle='top', mat=doorm):
        g = 0.0015
        box2('cab_front', (x0 + g, Yf, z0 + g), (x1 - g, Yf + 0.02, z1 - g), mat, bevel=0.002)
        if handle == 'top':
            box2('cab_handle', ((x0 + x1) / 2 - 0.08, Yf - 0.026, z1 - 0.045), ((x0 + x1) / 2 + 0.08, Yf - 0.014, z1 - 0.033), blk,
                 bevel=0.003)
            for dx in (-0.07, 0.07):
                box2('cab_hpost', ((x0 + x1) / 2 + dx - 0.004, Yf - 0.02, z1 - 0.043), ((x0 + x1) / 2 + dx + 0.004, Yf, z1 - 0.035), blk,
                     bevel=0)
        elif handle in ('left', 'right'):
            x = x1 - 0.04 if handle == 'right' else x0 + 0.04
            zc = (z0 + z1) / 2 if z1 - z0 > 1.0 else z1 - 0.13
            box2('cab_handle', (x - 0.006, Yf - 0.026, zc - 0.08), (x + 0.006, Yf - 0.014, zc + 0.08), blk, bevel=0.003)
            for dz in (-0.07, 0.07):
                box2('cab_hpost', (x - 0.004, Yf - 0.02, zc + dz - 0.004), (x + 0.004, Yf, zc + dz + 0.004), blk, bevel=0)
    # pantry (tall)
    box2('pantry_body', (-3.0, Yf + 0.021, 0.87), (-2.40, Yb, 2.2), dark, bevel=0)
    front(-3.0, -2.70, 0.10, 2.2, 'right')
    front(-2.70, -2.40, 0.10, 2.2, 'left')
    # base units
    front(-1.8, -1.2, 0.10, 0.86, 'top')
    for z0, z1 in ((0.10, 0.36), (0.36, 0.62), (0.62, 0.86)):
        front(-0.6, 0.0, z0, z1, 'top')
    front(0.0, 0.4, 0.10, 0.86, 'right')
    front(0.4, 0.8, 0.10, 0.86, 'left')
    front(0.8, 1.4, 0.10, 0.86, 'top')
    box2('filler', (1.4, Yf, 0.10), (1.45, Yf + 0.02, 0.86), doorm, bevel=0.002)
    # ---- oven
    box2('oven_frame', (-1.198, Yf, 0.102), (-0.602, Yf + 0.02, 0.858), pbr('oven_blk', '#0E0E0F', 0.25), bevel=0.002)
    box2('oven_glass', (-1.17, Yf - 0.006, 0.16), (-0.63, Yf, 0.69), pbr('oven_glass', (0.006, 0.006, 0.007), 0.04, Coat_Weight=1.0,
                                                                        Coat_Roughness=0.02), bevel=0.002)
    box2('oven_handle', (-1.14, Yf - 0.05, 0.705), (-0.66, Yf - 0.032, 0.723), steel, bevel=0.007, segs=3)
    for x in (-1.11, -0.69):
        box2('oven_hpost', (x - 0.008, Yf - 0.04, 0.708), (x + 0.008, Yf, 0.72), steel, bevel=0.002)
    box2('oven_panel', (-1.17, Yf - 0.004, 0.745), (-0.63, Yf, 0.845), pbr('oven_panel', (0.004, 0.004, 0.005), 0.08, Coat_Weight=1.0),
         bevel=0.002)
    text('oven_clock', '3:42', 0.034, (-0.90, Yf - 0.0045, 0.795), emit('led_amber', (1.0, 0.45, 0.08), 9), rot=(math.pi / 2, 0, 0))
    for x in (-1.10, -0.70):
        cyl('oven_knob', 0.019, 0.022, (x, Yf - 0.014, 0.795), steel, rot=(rad(90), 0, 0))
    # ---- upper cabinets
    box2('upper_body', (-2.40, 4.17, 1.45), (1.45, Yb, 2.2), dark, bevel=0)
    x = -2.40
    while x < 1.4:
        g = 0.0015
        x1 = min(x + 0.55, 1.45)
        box2('upper_front', (x + g, 4.15, 1.45 + g), (x1 - g, 4.17, 2.2 - g), doorm, bevel=0.002)
        x = x1
    box2('fridge_top_cab', (1.45, 3.82, 1.86), (2.45, Yb, 2.2), doorm, bevel=0.002)
    box2('upper_filler', (-3.0, 4.16, 2.2), (2.45, Yb, 2.4), doorm, bevel=0)
    box2('pantry_filler', (-3.0, Yf + 0.005, 2.2), (-2.40, 4.16, 2.4), doorm, bevel=0)
    # ---- counter clutter
    lathe('kettle', [(0, 0), (0.075, 0), (0.085, 0.01), (0.07, 0.17), (0.05, 0.20), (0.02, 0.215), (0, 0.22)],
          M.metal('kettle', '#C8CACC', 0.18), loc=(-0.95, 4.25, 0.905))
    torus('kettle_handle', 0.055, 0.008, (-0.95, 4.25, 1.11), blk, rot=(rad(90), 0, 0), seg=32, rseg=8)
    box('board', (0.3, 0.02, 0.4), (-1.5, 4.44, 1.10), M.wood('board', '#B98A58', '#8E6238'), rot=(rad(-6), 0, 0), bevel=0.004)
    lathe('bowl', [(0, 0.005), (0.06, 0.005), (0.13, 0.07), (0.135, 0.075), (0.125, 0.075), (0.058, 0.014), (0, 0.014)],
          pbr('bowl', '#EDE7DB', 0.3), loc=(1.05, 4.2, 0.905))
    for i, c in enumerate(('#E8A33B', '#D9512C', '#E8A33B', '#7DA83E')):
        sphere('fruit', 0.038, (1.05 + 0.05 * math.cos(i * 1.7), 4.2 + 0.05 * math.sin(i * 1.7), 0.96 + 0.012 * (i % 2)),
               pbr('fruit' + c, c, 0.4), seg=20, rings=10)
    tube('faucet', [(0.4, 4.40, 0.905), (0.4, 4.40, 1.22), (0.4, 4.36, 1.27), (0.4, 4.24, 1.27), (0.4, 4.20, 1.22), (0.4, 4.20, 1.18)],
         0.012, M.metal('chrome', '#DADCDD', 0.08))
    box2('sink_towel', (0.44, Yf - 0.035, 0.52), (0.72, Yf - 0.022, 0.85), M.fabric('towel', '#D8C7A8', weave=420, bump=0.8), bevel=0.006)
    # ---- fridge
    fs = M.brushed_steel('fridge_steel', grubby=True, direction='X')
    box2('fridge_body', (1.5, 3.80, 0.05), (2.40, Yb, 1.82), pbr('fridge_side', '#55585C', 0.4, metal=0.6), bevel=0.004)
    box2('fridge_kick', (1.52, 3.79, 0.0), (2.38, 3.83, 0.06), pbr('kick', '#2A2725', 0.6), bevel=0)
    for a, b in ((1.502, 1.948), (1.952, 2.398)):
        box2('fridge_door', (a, 3.74, 0.74), (b, 3.80, 1.82), fs, bevel=0.012, segs=4)
    box2('fridge_drawer', (1.502, 3.74, 0.065), (2.398, 3.80, 0.735), fs, bevel=0.012, segs=4)
    chrome = M.metal('chrome', '#DADCDD', 0.08)
    for x in (1.915, 1.985):
        box2('fridge_handle', (x - 0.011, 3.685, 0.88), (x + 0.011, 3.705, 1.60), chrome, bevel=0.008, segs=3)
        for z in (0.92, 1.56):
            box2('fridge_hpost', (x - 0.007, 3.70, z - 0.01), (x + 0.007, 3.745, z + 0.01), chrome, bevel=0.002)
    box2('fridge_handle2', (1.62, 3.685, 0.655), (2.28, 3.705, 0.677), chrome, bevel=0.008, segs=3)
    for x in (1.66, 2.24):
        box2('fridge_hpost', (x - 0.01, 3.70, 0.659), (x + 0.01, 3.745, 0.673), chrome, bevel=0.002)
    # magnets + a crayon drawing, at toddler height
    box('fridge_drawing', (0.19, 0.001, 0.14), (1.72, 3.7395, 0.52), M.art(4.4), rot=(0, rad(-7), 0), bevel=0)
    for i, (x, z, c) in enumerate(((1.64, 0.585, '#E4572E'), (1.80, 0.59, '#3F8FD6'), (2.10, 0.50, '#F2B134'), (2.22, 0.36, '#59B36B'),
                                    (2.05, 0.30, '#9B5DE5'))):
        cyl('magnet', 0.016, 0.006, (x, 3.737, z), M.plastic('mag' + c, c), rot=(rad(90), 0, 0), steps=24)
    # ---- dining set
    oak = M.wood('oak', '#CDA677', '#A47D52')
    g = grp('dining', (1.98, 2.42, 0))
    box('table_top', (1.4, 0.8, 0.032), (0, 0, 0.735), oak, parent=g, bevel=0.006)
    box('table_apron', (1.24, 0.64, 0.07), (0, 0, 0.685), oak, parent=g, bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('table_leg', 0.022, 0.72, (sx * 0.62, sy * 0.33, 0.36), oak, r2=0.032, parent=g, rot=(-sy * 0.045, sx * 0.045, 0))

    def chair(loc, rz, seat='#3E4A52'):
        c = grp('chair', loc, rz)
        c.parent = g
        blackw = pbr('chair_w', '#1F1F20', 0.45)
        box('seat', (0.42, 0.40, 0.035), (0, 0, 0.45), M.fabric('seat' + seat, seat, weave=600), parent=c, bevel=0.012, segs=3)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl('leg', 0.012, 0.44, (sx * 0.17, sy * 0.16, 0.22), blackw, r2=0.016, parent=c, steps=16,
                    rot=(-sy * 0.06, sx * 0.06, 0))
            cyl('backpost', 0.012, 0.42, (sx * 0.17, 0.185, 0.66), blackw, parent=c, steps=16, rot=(rad(-6), 0, 0))
        box('backrest', (0.40, 0.022, 0.14), (0, 0.20, 0.80), blackw, parent=c, bevel=0.008, rot=(rad(-6), 0, 0))
    chair((-0.33, -0.52, 0), rad(180))
    chair((0.33, -0.60, 0), rad(172))
    chair((-0.33, 0.56, 0), rad(5))
    chair((0.33, 0.52, 0), 0)
    # baby high chair at the head of the table
    h = grp('highchair', (-1.02, 0.02, 0), rad(90))
    h.parent = g
    wh = M.plastic('hc', '#F4F3F0', 0.3)
    beech = M.wood('beech', '#DDBE8E', '#C4A06D')
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('hc_leg', 0.014, 0.60, (sx * 0.21, sy * 0.20, 0.285), beech, r2=0.017, parent=h, steps=16,
                rot=(-sy * 0.24, sx * 0.24, 0))
    lathe('hc_seat', [(0, 0.55), (0.15, 0.55), (0.185, 0.58), (0.195, 0.74), (0.185, 0.745), (0.165, 0.60), (0, 0.585)], wh, parent=h,
          steps=40)
    box('hc_tray', (0.44, 0.26, 0.016), (0, -0.20, 0.745), wh, parent=h, bevel=0.008, segs=3)
    sphere('hc_cup', 0.03, (0.1, -0.22, 0.785), M.plastic('cup', '#F29E4C'), parent=h, scale=(1, 1, 1.1), seg=20, rings=10)
    # pendants
    cordm = pbr('cord', '#161616', 0.5)
    glassy = emit('pendant_glass', (1.0, 0.78, 0.52), 7.0)
    for x in (1.60, 2.30):
        cyl('cord', 0.003, 0.76, (x, 2.4, 2.02), cordm, steps=8, bevel=0)
        cyl('p_cap', 0.03, 0.05, (x, 2.4, 1.63), M.metal('brass', '#B08D57', 0.3))
        sphere('p_globe', 0.085, (x, 2.4, 1.52), glassy, seg=32, rings=16)
    # wall clock
    lathe('clock', [(0, 0.0), (0.15, 0.0), (0.155, 0.006), (0.155, 0.02), (0.14, 0.022), (0.138, 0.01), (0, 0.01)],
          pbr('clock', '#EDEAE3', 0.4), loc=(2.998, 2.4, 1.7), rot=(0, rad(-90), 0))
    box('clock_h', (0.003, 0.012, 0.075), (2.985, 2.4, 1.73), blk, bevel=0, rot=(rad(35), 0, 0))
    box('clock_m', (0.003, 0.008, 0.11), (2.984, 2.4, 1.74), blk, bevel=0, rot=(rad(-80), 0, 0))
    # ---- laundry basket + stray toys on the kitchen floor
    g = grp('basket', (-2.70, 3.50, 0))
    lathe('basket_body', [(0, 0.004), (0.16, 0.004), (0.17, 0.012), (0.21, 0.30), (0.216, 0.31), (0.205, 0.312), (0.196, 0.30),
                          (0.158, 0.02), (0, 0.016)], M.wicker(), parent=g)
    tex = bpy.data.textures.new('cloth_n', 'CLOUDS')
    tex.noise_scale = 0.09
    for i, (c, p, s) in enumerate((('#F2EDE4', (0.02, 0.0, 0.23), (1.5, 1.4, 0.75)), ('#8FB3C7', (-0.06, 0.05, 0.29), (1.0, 1.1, 0.6)),
                                   ('#E7B7B0', (0.09, -0.07, 0.30), (0.9, 0.8, 0.55)))):
        o = sphere('laundry', 0.11, p, M.fabric('laundry%d' % i, c, weave=500, bump=0.7), scale=s, parent=g, seg=40, rings=20)
        d = o.modifiers.new('d', 'DISPLACE')
        d.texture = tex
        d.strength = 0.07
    box('towel_hang', (0.012, 0.20, 0.24), (0.212, 0.0, 0.20), M.fabric('laundry0', '#F2EDE4', weave=500, bump=0.7), parent=g,
        bevel=0.005, rot=(0, rad(-7), 0))
    # wooden toy car
    g = grp('toycar', (-1.42, 3.12, 0), rad(25))
    beech2 = M.wood('beech', '#DDBE8E', '#C4A06D')
    box('car_body', (0.11, 0.05, 0.03), (0, 0, 0.03), beech2, parent=g, bevel=0.012, segs=4)
    box('car_cab', (0.05, 0.046, 0.028), (-0.012, 0, 0.056), M.plastic('car', '#E4572E'), parent=g, bevel=0.01, segs=4)
    for sx in (-0.033, 0.033):
        for sy in (-0.03, 0.03):
            cyl('wheel', 0.016, 0.01, (sx, sy, 0.016), M.plastic('wheel', '#2E86AB'), parent=g, rot=(rad(90), 0, 0), steps=24)
    # one lost baby sock
    def sock(p):
        d = sd_capsule(p, (0, 0, 0.012), (0, 0.06, 0.012), 0.016, 0.014)
        d = smin(d, sd_capsule(p, (0, 0.0, 0.014), (-0.035, -0.012, 0.012), 0.015, 0.013), 0.012)
        return smax(d, sd_box(p, (0, 0, -0.1), (1, 1, 0.1005)) * -1, 0.003)
    o = sdf_mesh('babysock', sock, (-0.06, -0.04, 0.0), (0.03, 0.085, 0.032), 0.0018, M.knit('bsock', '#F1E9DA', rows=900, bump=0.3),
                 loc=(-2.46, 3.22, 0))
    o.rotation_euler = (0, 0, rad(70))
    o.scale = (1, 1, 0.75)


def build_washer():
    """Front-loader under the counter. Returns the spinning drum empty."""
    cx, Yf, cz = TL.WASHER_DOOR[0], TL.CAB_FRONT_Y, TL.WASHER_DOOR[2]
    wh = M.plastic('washer', '#F5F5F3', 0.28)
    y0 = Yf - 0.012
    x0, x1 = cx - 0.297, cx + 0.297
    hs = 0.15
    box2('w_left', (x0, y0, 0.16), (cx - hs, Yf + 0.02, 0.74), wh, bevel=0.003)
    box2('w_right', (cx + hs, y0, 0.16), (x1, Yf + 0.02, 0.74), wh, bevel=0.003)
    box2('w_bot', (cx - hs, y0, 0.16), (cx + hs, Yf + 0.02, cz - hs), wh, bevel=0)
    box2('w_top', (cx - hs, y0, cz + hs), (cx + hs, Yf + 0.02, 0.74), wh, bevel=0)
    box2('w_kick', (x0, y0 + 0.006, 0.10), (x1, Yf + 0.02, 0.158), pbr('wkick', '#DCDCD9', 0.4), bevel=0.003)
    box2('w_panel', (x0, y0 - 0.006, 0.742), (x1, Yf + 0.02, 0.862), wh, bevel=0.006, segs=3)
    box2('w_drawer', (x0 + 0.02, y0 - 0.009, 0.757), (x0 + 0.20, y0 - 0.005, 0.847), wh, bevel=0.004)
    box2('w_drawer_grip', (x0 + 0.06, y0 - 0.013, 0.762), (x0 + 0.16, y0 - 0.008, 0.776), pbr('wgrip', '#CFCFCC', 0.4), bevel=0.003)
    chrome = M.metal('chrome', '#DADCDD', 0.08)
    lathe('w_dial', [(0, 0.0), (0.036, 0.0), (0.036, 0.012), (0.031, 0.016), (0.027, 0.03), (0.0, 0.031)], chrome,
          loc=(cx + 0.03, y0 - 0.006, 0.802), rot=(rad(90), 0, 0), steps=48)
    box2('w_display', (cx + 0.10, y0 - 0.0085, 0.777), (cx + 0.27, y0 - 0.005, 0.827), pbr('wdisp', (0.003, 0.003, 0.004), 0.06,
                                                                                         Coat_Weight=1.0), bevel=0.002)
    text('w_time', '0:38', 0.030, (cx + 0.172, y0 - 0.0092, 0.803), emit('led_cyan', (0.35, 0.9, 1.0), 10), rot=(math.pi / 2, 0, 0))
    for i in range(4):
        cyl('w_led', 0.0025, 0.002, (cx + 0.115 + i * 0.012, y0 - 0.009, 0.785), emit('led_cyan2', (0.35, 0.9, 1.0), 14 if i < 2 else 1),
            rot=(rad(90), 0, 0), steps=10, bevel=0)
    # door: ring + glass
    door = grp('w_door', (cx, y0, cz))
    door.rotation_euler = (math.pi / 2, 0, 0)            # local +Z -> world -Y (towards the room)
    lathe('w_ring', [(0.150, -0.01), (0.150, 0.004), (0.214, 0.004), (0.226, 0.014), (0.224, 0.030), (0.206, 0.042),
                     (0.176, 0.041), (0.166, 0.033), (0.160, 0.02), (0.158, -0.01)],
          pbr('w_ring', '#D9DBDD', 0.2, metal=0.85), parent=door, steps=96)
    lathe('w_glass', [(0.0, 0.046), (0.05, 0.045), (0.10, 0.041), (0.14, 0.034), (0.166, 0.026)],
          M.glass('washer_glass', tint=(0.86, 0.90, 0.92, 1), refl=0.75, ior=1.42), parent=door, steps=96)
    box('w_handle', (0.022, 0.07, 0.016), (0.215, 0.0, 0.043), pbr('whandle', '#E9E9E7', 0.3), parent=door, bevel=0.006, segs=3)
    lathe('w_gasket', [(0.150, -0.012), (0.168, -0.012), (0.20, -0.05), (0.205, -0.06), (0.19, -0.06), (0.152, -0.03)],
          pbr('gasket', '#4A4C4F', 0.6), parent=door, steps=64)
    # drum
    drum = empty('w_drum', (cx, Yf + 0.045, cz))
    drum.rotation_mode = 'XYZ'
    dm = M.perforated('drum_steel', '#B9BCBF', 210)
    NT(dm).P(Metallic=0.9, Roughness=0.28)
    lathe('drum_wall', [(0.205, 0.0), (0.207, 0.36), (0.0, 0.36)], dm, parent=drum, rot=(-math.pi / 2, 0, 0), steps=64)
    for i in range(3):
        a = rad(120 * i)
        box('drum_lifter', (0.045, 0.30, 0.035), (math.cos(a) * 0.19, 0.18, math.sin(a) * 0.19), pbr('lifter', '#D5D8DA', 0.35),
            parent=drum, rot=(0, -a + math.pi / 2, 0), bevel=0.012, segs=3)
    tex = bpy.data.textures.new('wash_n', 'CLOUDS')
    tex.noise_scale = 0.05
    rnd = random.Random(5)
    cols = ['#E4572E', '#F2EDE4', '#2E86AB', '#F2B134', '#E9A6B3', '#59B36B', '#F2EDE4', '#7B5EA7', '#E8E2D0']
    for i, c in enumerate(cols):
        a = rad(40 * i) + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(0.105, 0.15)
        o = sphere('wash', 0.075, (math.cos(a) * r, rnd.uniform(0.07, 0.24), math.sin(a) * r),
                   M.fabric('wash%d' % i, c, weave=500, rough=0.6, sheen=0.2, bump=0.5), parent=drum,
                   scale=(rnd.uniform(0.8, 1.3), rnd.uniform(0.9, 1.5), rnd.uniform(0.55, 0.8)), seg=32, rings=16,
                   rot=(0, -a + math.pi / 2, rnd.uniform(-0.5, 0.5)))
        d = o.modifiers.new('d', 'DISPLACE')
        d.texture = tex
        d.strength = 0.05
    return drum
