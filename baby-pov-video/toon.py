"""Stylised 3D-animation look (BABYPOV_STYLE=pixar): a global material/shape pass plus the pieces that
have to be remodelled for it -- mum's head with big expressive eyes, puffy clouds, a face for the robot."""
import os, math, random, colorsys
import bpy
import numpy as np
from lib import *
from mathutils import Vector
import materials as M

PIXAR = os.environ.get('BABYPOV_STYLE', '') == 'pixar'
rad = math.radians


def pick(real, toon):
    return toon if PIXAR else real


def keep(mat):
    """Exclude a material from the global stylise pass."""
    mat['keep'] = 1
    return mat


# =============================================================================== global pass
def _boost(c, sat=0.78, gain=1.12, val=0.94):
    r, g, b = (max(float(v), 0.0) ** (1 / 2.2) for v in c[:3])
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v > 1.0 or s < 0.02:
        return None
    s2 = min((s ** sat) * gain, 0.93) if s > 0.05 else s
    v2 = v ** val
    r, g, b = colorsys.hsv_to_rgb(h, s2, v2)
    return (r ** 2.2, g ** 2.2, b ** 2.2, c[3] if len(c) > 3 else 1.0)


_COLOR_NODES = {'ShaderNodeMixRGB': ('Color1', 'Color2'), 'ShaderNodeBsdfPrincipled': ('Base Color',),
                'ShaderNodeBsdfDiffuse': ('Color',), 'ShaderNodeBsdfTranslucent': ('Color',)}


def stylize():
    """Cleaner, more saturated surfaces; softer, chunkier edges."""
    for m in bpy.data.materials:
        if not m.node_tree or m.get('keep'):
            continue
        for n in m.node_tree.nodes:
            if n.bl_idname == 'ShaderNodeBump':
                n.inputs['Strength'].default_value *= 0.45
            elif n.bl_idname == 'ShaderNodeValToRGB':
                for e in n.color_ramp.elements:
                    c = _boost(tuple(e.color))
                    if c:
                        e.color = c
            elif n.bl_idname in _COLOR_NODES:
                if n.bl_idname == 'ShaderNodeMixRGB' and n.blend_type != 'MIX':
                    continue
                if n.bl_idname == 'ShaderNodeBsdfPrincipled' and n.inputs['Metallic'].default_value > 0.5:
                    continue
                for k in _COLOR_NODES[n.bl_idname]:
                    s = n.inputs[k]
                    if not s.is_linked:
                        c = _boost(tuple(s.default_value))
                        if c:
                            s.default_value = c
    for o in bpy.data.objects:
        bev = o.modifiers.get('bev') if o.type == 'MESH' else None
        if bev:
            d = [v for v in o.dimensions if v > 1e-6]
            lim = min(d) * 0.32 if d else bev.width
            bev.width = min(bev.width * 2.2, max(lim, bev.width))
            bev.segments = max(bev.segments, 4)


# =============================================================================== materials
def skin(name, base='#FFD0B8', flush='#FF8F82', tip_axis=None, tip0=0.03, tip1=0.07, blush=(), sss=0.006, tipk=0.6):
    m, nt = new_mat('tskin_' + name)
    co = nt.obj
    col = lin(base)
    if tip_axis is not None:
        s = nt.sep(co)
        tipf = nt.node('ShaderNodeMapRange', inp={'Value': s[tip_axis], 'From Min': tip0, 'From Max': tip1,
                                                  'To Min': 0.0, 'To Max': tipk}).outputs[0]
        col = nt.mix(tipf, col, lin(flush))
    for cx, cy, cz, r in blush:
        d = nt.node('ShaderNodeVectorMath', operation='DISTANCE', inp={0: co, 1: (cx, cy, cz)}).outputs['Value']
        f = nt.node('ShaderNodeMapRange', inp={'Value': d, 'From Min': r * 0.2, 'From Max': r, 'To Min': 0.62,
                                               'To Max': 0.0}).outputs[0]
        col = nt.mix(f, col, lin(flush))
    nt.P(Base_Color=col, Subsurface_Weight=1.0, Subsurface_Radius=(1.0, 0.42, 0.26), Subsurface_Scale=sss,
         Roughness=0.42, Specular_IOR_Level=0.4, Sheen_Weight=0.3, Sheen_Roughness=0.4)
    return keep(m)


# =============================================================================== mum's head
EX, EY, EZ, ER = 0.060, 0.0385, 0.022, 0.032           # eyeball centre / radius, head-local (+X = face)
LID_OPEN, LID_SHUT = rad(-17), rad(40)


def _head_fn(p):
    d = sd_ellipsoid(p, (0, 0, 0.032), (0.096, 0.088, 0.102))                          # big round cranium
    d = smin(d, sd_ellipsoid(p, (0.028, 0, -0.040), (0.060, 0.050, 0.053)), 0.035)     # soft jaw and chin
    d = smin(d, sd_ellipsoid(p, (0.1005, 0, -0.010), (0.0125, 0.0135, 0.0115)), 0.009)   # button nose
    for sy in (-1, 1):
        d = smin(d, sd_ellipsoid(p, (0.062, sy * 0.044, -0.024), (0.029, 0.026, 0.026)), 0.03)     # cheeks
        d = smin(d, sd_ellipsoid(p, (-0.004, sy * 0.089, 0.002), (0.012, 0.010, 0.026)), 0.006)    # ears
        d = smax(d, -sd_sphere(p, (EX, sy * EY, EZ), ER + 0.0005), 0.003)                          # eye sockets
    return d


def _surf_x(y, z):
    lo, hi = 0.03, 0.16
    for _ in range(22):
        mid = (lo + hi) / 2
        if _head_fn(np.array([[mid, y, z]]))[0] < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _cap(name, r, a0, a1, mat, parent, n=14, sign=1.0, steps=48, **kw):
    """Spherical band between polar angles a0..a1 (degrees) around +Z (sign=-1: around -Z)."""
    prof = [(r * math.sin(rad(a0 + (a1 - a0) * i / n)), sign * r * math.cos(rad(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    return lathe(name, prof, mat, parent=parent, steps=steps, **kw)


def _hair_fn(p):
    d = sd_ellipsoid(p, (-0.012, 0, 0.042), (0.108, 0.098, 0.112))
    d = smax(d, -sd_ellipsoid(p, (0.100, 0, -0.035), (0.090, 0.080, 0.142)), 0.016)    # open the face
    d = smax(d, -(p[..., 2] + 0.075), 0.02)
    d = smin(d, sd_sphere(p, (-0.050, 0, 0.150), 0.050), 0.016)                        # top-knot bun
    d = smin(d, sd_ellipsoid(p, (0.066, 0.034, 0.120), (0.034, 0.060, 0.020)), 0.018)  # side-swept fringe
    d = smin(d, sd_ellipsoid(p, (0.056, -0.060, 0.100), (0.030, 0.032, 0.026)), 0.018)
    for sy in (-1, 1):                                                                 # locks in front of the ears
        d = smin(d, sd_capsule(p, (0.040, sy * 0.084, 0.07), (0.034, sy * 0.088, -0.065), 0.017, 0.009), 0.015)
    return d


def mom_head(head):
    """Builds the stylised head under the empty `head`. Returns the two upper eyelids (for blinks)."""
    face = skin('momface', base='#F6BE9F', flush='#F4807A', blush=((0.072, 0.052, -0.022, 0.028), (0.072, -0.052, -0.022, 0.028)),
                sss=0.007)
    lidm = keep(pbr('momlid', '#F5BC9F', 0.45, Sheen_Weight=0.3))
    sdf_mesh('mom_face', _head_fn, (-0.11, -0.105, -0.115), (0.125, 0.105, 0.15), 0.0025, face, parent=head, smooth_iter=2)
    hairm = pbr('mom_hair_t', '#3A2216', 0.34, Sheen_Weight=0.6, Coat_Weight=0.35, Coat_Roughness=0.25)
    hn = NT(hairm)
    hn.P(Normal=hn.bump(hn.wave(hn.mapping(hn.obj, rot=(0.0, 0.35, 0.2)), scale=38, dist=3.0, detail=1, direction='Y'), 0.22, 0.003))
    keep(hairm)
    sdf_mesh('mom_hair', _hair_fn, (-0.17, -0.12, -0.10), (0.125, 0.12, 0.21), 0.003, hairm, parent=head, smooth_iter=3)
    white = keep(pbr('mom_sclera', '#FBF8F3', 0.10, Coat_Weight=1.0, Coat_Roughness=0.03, Subsurface_Weight=0.3,
                     Subsurface_Radius=(0.6, 0.5, 0.5), Subsurface_Scale=0.004))
    NT(white).P(Emission_Color=(1.0, 0.97, 0.94, 1), Emission_Strength=0.12)
    irism, it = new_mat('mom_iris')
    s = it.sep(it.obj)
    rr = it.math('DIVIDE', it.math('SQRT', it.math('ADD', it.math('MULTIPLY', s[0], s[0]), it.math('MULTIPLY', s[1], s[1]))), 0.0167)
    fib = it.noise(it.mapping(it.obj, scale=(900, 900, 1)), scale=1.0, detail=2)
    icol = it.ramp(it.math('ADD', rr, it.math('MULTIPLY', it.math('SUBTRACT', fib, 0.5), 0.10)),
                   [(0.30, lin('#2E1609')), (0.55, lin('#8A4E24')), (0.80, lin('#A9642E')), (0.93, lin('#4A2610')), (1.0, lin('#1D0E06'))])
    it.P(Base_Color=icol, Roughness=0.12, Coat_Weight=1.0, Coat_Roughness=0.03)
    keep(irism)
    pupil = keep(pbr('mom_pupil', (0.004, 0.003, 0.003), 0.06, Coat_Weight=1.0, Coat_Roughness=0.02))
    glint = keep(emit('mom_glint', (1.0, 1.0, 1.0), 3.0))
    lash = keep(pbr('mom_lash', '#24140D', 0.5))
    lids = []
    for sy in (-1, 1):
        eye = empty('mom_eye', (EX, sy * EY, EZ), parent=head)
        sphere('mom_eyeball', ER, (0, 0, 0), white, parent=eye, seg=48, rings=24)
        _cap('mom_iris', ER + 0.0004, 0, 31, irism, eye, rot=(0, rad(90), 0))
        _cap('mom_pupil', ER + 0.0008, 0, 15.5, pupil, eye, rot=(0, rad(90), 0), n=6)
        gd = Vector((1.0, 0.30, 0.36)).normalized() * (ER + 0.0002)
        sphere('mom_glint', 0.0036, gd, glint, parent=eye, seg=16, rings=8)
        gd2 = Vector((1.0, -0.20, -0.22)).normalized() * (ER + 0.0002)
        sphere('mom_glint2', 0.0017, gd2, glint, parent=eye, seg=12, rings=6)
        up = _cap('mom_lid_up', ER + 0.0016, 0, 86, lidm, eye)
        _cap('mom_lash', ER + 0.0032, 82.5, 88.5, lash, up, n=4)
        up.rotation_mode = 'XYZ'
        up.rotation_euler = (0, LID_OPEN, 0)
        lo = _cap('mom_lid_lo', ER + 0.0014, 0, 86, lidm, eye, sign=-1.0)
        lo.rotation_euler = (0, rad(27), 0)
        lids.append(up)
        # eyebrow: a soft arched stroke on the forehead
        def brow(u, v, sy=sy):
            y = sy * (0.017 + 0.050 * u)
            w = 0.0038 * (1 - 0.70 * u) * (0.6 + 0.4 * min(u * 6, 1))
            z = 0.074 + 0.012 * math.sin(math.pi * (0.10 + 0.66 * u)) - 0.004 * u + (v - 0.5) * 2 * w
            return (_surf_x(y, z) + 0.0012, y, z)
        grid_surface('mom_brow', 14, 4, brow, lash, parent=head, solid=0.0022)

    # open, happy smile: dark mouth, a row of teeth, tongue, soft lips around it
    HW = 0.029
    top = lambda a: -0.0445 + 0.0115 * a * a
    bot = lambda a: top(a) - 0.027 * max(1 - a * a, 0.0) ** 0.72 - 0.0006

    def sheet(a0, a1, f0, f1, off):
        def fn(u, v):
            a = a0 + (a1 - a0) * u
            z = top(a) + (bot(a) - top(a)) * (f0(a) + (f1(a) - f0(a)) * v)
            y = a * HW
            return (_surf_x(y, z) + off, y, z)
        return fn
    grid_surface('mom_mouth', 25, 7, sheet(-1, 1, lambda a: 0.0, lambda a: 1.0, 0.0006), keep(pbr('mom_mouth_in', '#4A1719', 0.5)),
                 parent=head)
    grid_surface('mom_teeth', 21, 4, sheet(-0.9, 0.9, lambda a: 0.02, lambda a: 0.36, 0.0013),
                 keep(pbr('mom_teeth_t', '#FDFBF6', 0.22, Coat_Weight=0.5)), parent=head)
    grid_surface('mom_tongue', 15, 5, sheet(-0.6, 0.6, lambda a: 0.60 + 0.25 * (a / 0.6) ** 2, lambda a: 0.985, 0.0012),
                 keep(pbr('mom_tongue_t', '#F27F86', 0.35, Subsurface_Weight=0.5, Subsurface_Radius=(1, 0.4, 0.3),
                          Subsurface_Scale=0.003)), parent=head)
    pts = []
    for i in range(16):
        a = -1 + 2 * i / 15
        pts.append((_surf_x(a * HW, top(a)) + 0.0012, a * HW, top(a)))
    for i in range(1, 15):
        a = 1 - 2 * i / 15
        pts.append((_surf_x(a * HW, bot(a)) + 0.0012, a * HW, bot(a)))
    tube('mom_lips', pts, 0.0024, keep(pbr('mom_lip_t', '#E0625E', 0.36, Subsurface_Weight=0.4, Subsurface_Radius=(1, 0.4, 0.3),
                                         Subsurface_Scale=0.003)), parent=head, cyclic=True)
    return lids


def lid_angle(t):
    """Mum blinks twice while she greets the baby."""
    c = 0.0
    for tb in (33.05, 34.95, 36.05):
        dt = t - tb
        if -0.08 < dt <= 0:
            c = max(c, 1 + dt / 0.08)
        elif 0 < dt < 0.05:
            c = 1.0
        elif 0.05 <= dt < 0.20:
            c = max(c, 1 - (dt - 0.05) / 0.15)
    return LID_OPEN + (LID_SHUT - LID_OPEN) * c


# =============================================================================== robot face
def robot_face(root, R):
    visor = keep(pbr('robot_visor', (0.004, 0.004, 0.006), 0.08, Coat_Weight=1.0, Coat_Roughness=0.03))
    grid_surface('robot_visor', 36, 3, lambda u, v: ((R + 0.0042) * math.cos((u - 0.5) * 1.25), (R + 0.0042) * math.sin((u - 0.5) * 1.25),
                                                    0.034 + v * 0.036), visor, parent=root, solid=0.002)
    led = keep(emit('robot_eye', (0.30, 0.95, 1.0), 16.0))
    for sy in (-1, 1):
        def eye(u, v, sy=sy):
            ph = 2 * math.pi * u
            a = sy * 0.21 + v * 0.060 * math.cos(ph)
            z = 0.0525 + v * 0.0125 * math.sin(ph)
            return ((R + 0.0062) * math.cos(a), (R + 0.0062) * math.sin(a), z)
        grid_surface('robot_eye', 25, 4, eye, led, parent=root)


# =============================================================================== sky
def clouds():
    rnd = random.Random(21)
    m, nt = new_mat('cloud')
    nt.P(Base_Color=(0.95, 0.95, 0.95, 1), Roughness=1.0, Emission_Color=(0.80, 0.88, 1.0, 1), Emission_Strength=1.6,
         Subsurface_Weight=0.0)
    keep(m)
    for i in range(11):
        dist = rnd.uniform(380, 900)
        ang = -1.0 + 2.0 * (i + rnd.uniform(0.1, 0.9)) / 11
        cx, cy = math.sin(ang) * dist, -math.cos(ang) * dist
        cz = dist * rnd.uniform(0.10, 0.52)
        s = dist / 600 * rnd.uniform(0.8, 1.3)
        g = empty('cloud', (cx, cy, cz))
        n = rnd.randint(6, 9)
        for k in range(n):
            f = (k + 0.5) / n - 0.5
            r = (1 - abs(f) * 1.3) * rnd.uniform(34, 52) * s
            o = sphere('puff', r, (f * 210 * s, rnd.uniform(-20, 20) * s, r * 0.45 + rnd.uniform(-4, 6) * s), m,
                       scale=(1.15, 1.0, 0.78), seg=28, rings=14, parent=g)
            o.visible_shadow = False
        g.rotation_euler = (0, 0, -ang + rnd.uniform(-0.3, 0.3))
