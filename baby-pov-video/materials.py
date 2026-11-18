"""Procedural (texture-free) Cycles materials."""
import math
from lib import new_mat, pbr, lin, NT

_c = {}


def cached(fn):
    def wrap(*a, **k):
        key = (fn.__name__, a, tuple(sorted(k.items())))
        if key not in _c:
            _c[key] = fn(*a, **k)
        return _c[key]
    return wrap


@cached
def wood_floor():
    m, nt = new_mat('floor_oak')
    co = nt.obj
    v = nt.mapping(co, rot=(0, 0, math.pi / 2))
    br = nt.node('ShaderNodeTexBrick', inp={'Vector': v, 'Color1': (0, 0, 0, 1), 'Color2': (1, 1, 1, 1),
                                            'Mortar': (0.5, 0.5, 0.5, 1), 'Scale': 1.0, 'Mortar Size': 0.0007,
                                            'Mortar Smooth': 0.3, 'Bias': 0.0, 'Brick Width': 1.21,
                                            'Row Height': 0.124})
    br.offset = 0.37
    br.offset_frequency = 2
    pid = nt.math('MULTIPLY', br.outputs['Color'], 1.0)
    gap = br.outputs['Fac']
    off = nt.vmath('SCALE', nt.comb(13.7, 91.3, 5.1), scale=pid)
    gco = nt.vmath('ADD', co, off)
    fine = nt.noise(nt.mapping(gco, scale=(110, 2.2, 1)), scale=1.0, detail=4, rough=0.6, dist=0.25)
    mid = nt.noise(nt.mapping(gco, scale=(22, 0.9, 1)), scale=1.0, detail=3, rough=0.55, dist=0.5)
    big = nt.noise(nt.mapping(gco, scale=(5, 0.35, 1)), scale=1.0, detail=2, rough=0.5)
    grain = nt.math('ADD', nt.math('ADD', nt.math('MULTIPLY', fine, 0.30), nt.math('MULTIPLY', mid, 0.40)),
                    nt.math('MULTIPLY', big, 0.30))
    col = nt.ramp(grain, [(0.33, lin('#BD9566')), (0.50, lin('#CFAA7C')), (0.68, lin('#DCBD93'))])
    tint = nt.ramp(pid, [(0.0, (0.86, 0.84, 0.80, 1)), (0.5, (1, 1, 1, 1)), (1.0, (1.07, 1.02, 0.95, 1))])
    col = nt.mix(1.0, col, tint, 'MULTIPLY')
    col = nt.mix(nt.math('MULTIPLY', gap, 0.6), col, lin('#5E4630'))
    smudge = nt.noise(co, scale=3.1, detail=3, rough=0.6, dist=0.4)
    rough = nt.math('ADD', nt.math('MULTIPLY', smudge, 0.15), nt.math('ADD', 0.18, nt.math('MULTIPLY', fine, 0.06)))
    h = nt.math('SUBTRACT', nt.math('MULTIPLY', fine, 0.10), nt.math('MULTIPLY', gap, 1.0))
    nt.P(Base_Color=col, Roughness=rough, Normal=nt.bump(h, 0.3, 0.0012), Coat_Weight=0.22, Coat_Roughness=0.11,
         Specular_IOR_Level=0.55)
    return m


@cached
def wood(name='oak', light='#C8A070', dark='#9C7448', scale=1.0, rough=0.42, axis='Z'):
    m, nt = new_mat('wood_' + name)
    co = nt.obj
    sc = {'Z': (30 * scale, 30 * scale, 2.2 * scale), 'X': (2.2 * scale, 30 * scale, 30 * scale),
          'Y': (30 * scale, 2.2 * scale, 30 * scale)}[axis]
    g = nt.mapping(co, scale=sc)
    n1 = nt.noise(g, scale=1.0, detail=5, rough=0.6, dist=1.2)
    col = nt.ramp(n1, [(0.3, lin(dark)), (0.72, lin(light))])
    nt.P(Base_Color=col, Roughness=rough, Normal=nt.bump(n1, 0.15, 0.001), Coat_Weight=0.1, Coat_Roughness=0.25)
    return m


@cached
def wall_paint(name='wall', color='#EFEAE2', bump=0.12):
    m, nt = new_mat(name)
    co = nt.obj
    n = nt.noise(co, scale=420, detail=2, rough=0.6)
    n2 = nt.noise(co, scale=2.2, detail=2, rough=0.5)
    col = nt.mix(nt.math('MULTIPLY', n2, 0.06), lin(color), (0.75, 0.73, 0.70, 1))
    nt.P(Base_Color=col, Roughness=0.78, Normal=nt.bump(n, bump, 0.0006), Specular_IOR_Level=0.3)
    return m


@cached
def play_mat():
    m, nt = new_mat('playmat')
    co = nt.obj
    vo = nt.node('ShaderNodeTexVoronoi', feature='F1', inp={'Vector': co, 'Scale': 34.0, 'Randomness': 1.0})
    vo.voronoi_dimensions = '2D'
    dist, rc = vo.outputs['Distance'], vo.outputs['Color']
    rcs = nt.sep(rc)
    dot = nt.math('MULTIPLY', nt.math('LESS_THAN', dist, 0.21), nt.math('GREATER_THAN', rcs[0], 0.62))
    pal = nt.ramp(rcs[1], [(0.0, lin('#E9B7A8')), (0.25, lin('#A9C9B8')), (0.5, lin('#EBD08F')),
                           (0.75, lin('#B8C4DC')), (1.0, lin('#D9A7B8'))], 'CONSTANT')
    base = nt.mix(nt.noise(co, scale=1.4, detail=2), lin('#EFE6D6'), lin('#E8DDCB'))
    col = nt.mix(nt.math('MULTIPLY', dot, 0.9), base, pal)
    sx = nt.sep(co)[0]
    fold = nt.math('LESS_THAN', nt.math('ABSOLUTE', nt.math('SUBTRACT', nt.math('FRACT', nt.math(
        'ADD', nt.math('MULTIPLY', sx, 2.0), 0.5)), 0.5)), 0.006)                  # fold seams every 0.5 m
    col = nt.mix(nt.math('MULTIPLY', fold, 0.5), col, lin('#B5A891'))
    emb = nt.voronoi(co, scale=950, out='Distance')
    h = nt.math('SUBTRACT', nt.math('MULTIPLY', emb, 0.25), nt.math('MULTIPLY', fold, 2.5))
    nt.P(Base_Color=col, Roughness=0.47, Normal=nt.bump(h, 0.3, 0.0012), Sheen_Weight=0.15, Specular_IOR_Level=0.45)
    return m


@cached
def fabric(name, color, weave=650, rough=0.92, sheen=0.5, var=0.10, bump=0.5, color2=None):
    m, nt = new_mat('fab_' + name)
    co = nt.obj
    wx = nt.wave(co, scale=weave, direction='X')
    wy = nt.wave(co, scale=weave, direction='Y')
    wz = nt.wave(co, scale=weave, direction='Z')
    h = nt.math('ADD', nt.math('ADD', nt.math('MULTIPLY', wx, wy), nt.math('MULTIPLY', wy, wz)), nt.math('MULTIPLY', wz, wx))
    n = nt.noise(co, scale=14, detail=3, rough=0.6)
    c1 = lin(color)
    c2 = lin(color2) if color2 else tuple(v * 0.72 for v in c1[:3]) + (1,)
    col = nt.mix(nt.math('MULTIPLY', n, var * 4), c1, c2)
    col = nt.mix(nt.math('MULTIPLY', h, 0.12), col, c2)
    nt.P(Base_Color=col, Roughness=rough, Sheen_Weight=sheen, Sheen_Roughness=0.5, Normal=nt.bump(h, bump, 0.0008),
         Specular_IOR_Level=0.25)
    return m


@cached
def knit(name, color, rows=260, rough=0.95, color2=None, band=None, bump=0.8, shade=0.78):
    """Chunky knit: rib rows * stitches. band=(axis_index, threshold, color) paints a contrast region."""
    m, nt = new_mat('knit_' + name)
    co = nt.obj
    s = nt.sep(co)
    diag = nt.comb(nt.math('ADD', s[0], s[1]), s[2], 0)
    rib = nt.wave(diag, scale=rows * 0.55, direction='X')
    st = nt.wave(diag, scale=rows, direction='Y', dist=1.5, detail=1, dscale=3)
    h = nt.math('MULTIPLY', rib, nt.math('ADD', 0.5, nt.math('MULTIPLY', st, 0.5)))
    fuzz = nt.noise(co, scale=900, detail=2)
    c1 = lin(color)
    c2 = lin(color2) if color2 else tuple(v * shade for v in c1[:3]) + (1,)
    col = nt.mix(nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, h), 0.45), c1, c2)
    if band:
        ax, thr, bc = band[:3]
        bcol = nt.mix(nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, h), 0.4), lin(bc), tuple(v * 0.7 for v in lin(bc)[:3]) + (1,))
        sel = nt.math('GREATER_THAN', s[ax], thr)
        if len(band) > 3:                     # second region: below a threshold on another axis (heel)
            sel = nt.math('MAXIMUM', sel, nt.math('LESS_THAN', s[band[3]], band[4]))
        col = nt.mix(sel, col, bcol)
    hh = nt.math('ADD', h, nt.math('MULTIPLY', fuzz, 0.25))
    nt.P(Base_Color=col, Roughness=rough, Sheen_Weight=0.8, Sheen_Roughness=0.6, Normal=nt.bump(hh, bump, 0.0015),
         Specular_IOR_Level=0.2)
    return m


@cached
def sleeve(cuff=False):
    """Baby onesie sleeve: soft mint/cream stripes, optional ribbed cream cuff at local +Y end."""
    m, nt = new_mat('sleeve_cuff' if cuff else 'sleeve')
    co = nt.obj
    s = nt.sep(co)
    stripe = nt.math('GREATER_THAN', nt.math('FRACT', nt.math('MULTIPLY', s[1], 55.0)), 0.5)
    col = nt.mix(stripe, lin('#A8CFC0'), lin('#F3EEE2'))
    rib = nt.wave(co, scale=1300, direction='X')
    fuzz = nt.noise(co, scale=1500, detail=2)
    h = nt.math('ADD', nt.math('MULTIPLY', nt.wave(co, scale=900, direction='Y'), 0.5), nt.math('MULTIPLY', fuzz, 0.6))
    if cuff:
        isc = nt.math('GREATER_THAN', s[1], 0.089)
        col = nt.mix(isc, col, lin('#F6F1E6'))
        h = nt.mix(isc, h, nt.math('MULTIPLY', rib, 2.0))
    nt.P(Base_Color=col, Roughness=0.93, Sheen_Weight=0.7, Sheen_Roughness=0.5, Normal=nt.bump(h, 0.5, 0.0007),
         Specular_IOR_Level=0.2)
    return m


@cached
def skin(name='baby', base='#F2CBBE', flush='#EBA39B', tip_axis=1, tip0=0.03, tip1=0.07, sss=0.004):
    m, nt = new_mat('skin_' + name)
    co = nt.obj
    s = nt.sep(co)
    tipf = nt.node('ShaderNodeMapRange', inp={'Value': s[tip_axis], 'From Min': tip0, 'From Max': tip1,
                                              'To Min': 0.0, 'To Max': 0.55}).outputs[0]
    blot = nt.noise(co, scale=55, detail=2, rough=0.5)
    f = nt.math('ADD', tipf, nt.math('MULTIPLY', nt.math('SUBTRACT', blot, 0.45), 0.35), clamp=True)
    col = nt.mix(f, lin(base), lin(flush))
    pores = nt.noise(co, scale=2600, detail=2)
    nt.P(Base_Color=col, Subsurface_Weight=1.0, Subsurface_Radius=(1.0, 0.36, 0.2), Subsurface_Scale=sss,
         Roughness=0.46, Specular_IOR_Level=0.42, Normal=nt.bump(pores, 0.06, 0.0002), Sheen_Weight=0.12)
    return m


@cached
def brushed_steel(name='steel', grubby=True, direction='X'):
    m, nt = new_mat(name)
    co = nt.obj
    sc = {'X': (0.6, 380, 380), 'Z': (380, 380, 0.6)}[direction]
    br = nt.noise(nt.mapping(co, scale=sc), scale=1.0, detail=3, rough=0.7)
    rough = nt.math('ADD', 0.24, nt.math('MULTIPLY', br, 0.14))
    if grubby:                                   # little handprints low on the appliance
        s = nt.sep(co)
        low = nt.node('ShaderNodeMapRange', inp={'Value': s[2], 'From Min': -0.2, 'From Max': -0.75,
                                                 'To Min': 0.0, 'To Max': 1.0}).outputs[0]
        blobs = nt.ramp(nt.noise(co, scale=17, detail=3, rough=0.7, dist=0.6), [(0.56, 0.0), (0.66, 1.0)])
        rough = nt.math('ADD', rough, nt.math('MULTIPLY', nt.math('MULTIPLY', blobs, low), 0.22))
    nt.P(Base_Color=lin('#C9CBCD'), Metallic=1.0, Roughness=rough, Normal=nt.bump(br, 0.05, 0.0003))
    return m


@cached
def glass(name='glass', tint=(1, 1, 1, 1), refl=1.0, ior=1.5, rough=0.0):
    """Thin architectural glass: fresnel mirror over straight-through transparency (shadow friendly)."""
    m, nt = new_mat(name)
    tr = nt.node('ShaderNodeBsdfTransparent', inp={'Color': tint})
    gl = nt.node('ShaderNodeBsdfGlossy', inp={'Color': (refl, refl, refl, 1), 'Roughness': rough})
    # Schlick fresnel on |N.I| (the stock Fresnel node goes fully mirror-black on back faces past 42 degrees)
    geo = nt.node('ShaderNodeNewGeometry')
    dot = nt.node('ShaderNodeVectorMath', operation='DOT_PRODUCT')
    nt.links.new(geo.outputs['Incoming'], dot.inputs[0])
    nt.links.new(geo.outputs['Normal'], dot.inputs[1])
    c = nt.math('ABSOLUTE', dot.outputs['Value'])
    f0 = ((ior - 1) / (ior + 1)) ** 2
    fr = nt.math('ADD', f0, nt.math('MULTIPLY', nt.math('POWER', nt.math('SUBTRACT', 1.0, c), 5.0), 1 - f0))
    nt.surface(nt.shader_mix(fr, tr.outputs[0], gl.outputs[0]))
    return m


@cached
def sheer():
    m, nt = new_mat('sheer_curtain')
    co = nt.obj
    wv = nt.math('MULTIPLY', nt.wave(co, scale=900, direction='X'), nt.wave(co, scale=900, direction='Z'))
    tl = nt.node('ShaderNodeBsdfTranslucent', inp={'Color': (0.92, 0.9, 0.86, 1)})
    df = nt.node('ShaderNodeBsdfDiffuse', inp={'Color': (0.9, 0.88, 0.84, 1)})
    tr = nt.node('ShaderNodeBsdfTransparent', inp={'Color': (1, 1, 1, 1)})
    a = nt.shader_mix(0.45, df.outputs[0], tl.outputs[0])
    # sheers glow with the daylight caught in their folds (keeps deep pleats from going black)
    em = nt.node('ShaderNodeEmission', inp={'Color': (1.0, 0.96, 0.90, 1), 'Strength': 0.2})
    add = nt.node('ShaderNodeAddShader')
    nt.links.new(a, add.inputs[0])
    nt.links.new(em.outputs[0], add.inputs[1])
    nt.surface(nt.shader_mix(nt.math('ADD', 0.30, nt.math('MULTIPLY', wv, 0.25)), add.outputs[0], tr.outputs[0]))
    return m


@cached
def drape():
    m, nt = new_mat('drape')
    co = nt.obj
    wv = nt.math('MULTIPLY', nt.wave(co, scale=520, direction='X'), nt.wave(co, scale=520, direction='Z'))
    df = nt.node('ShaderNodeBsdfPrincipled', inp={'Base Color': lin('#C9BFB0'), 'Roughness': 0.9, 'Sheen Weight': 0.3,
                                                  'Normal': nt.bump(wv, 0.5, 0.0008)})
    tl = nt.node('ShaderNodeBsdfTranslucent', inp={'Color': lin('#D8C9B4')})
    nt.surface(nt.shader_mix(0.35, df.outputs[0], tl.outputs[0]))
    return m


@cached
def leaf():
    m, nt = new_mat('leaf')
    co = nt.obj
    s = nt.sep(co)
    rib = nt.math('LESS_THAN', nt.math('ABSOLUTE', s[0]), 0.004)
    veins = nt.wave(nt.comb(nt.math('ABSOLUTE', s[0]), s[1], 0), scale=38, direction='DIAGONAL')
    n = nt.noise(co, scale=30, detail=2)
    col = nt.mix(n, lin('#2F5D2B'), lin('#3E7434'))
    col = nt.mix(nt.math('MULTIPLY', rib, 0.8), col, lin('#9DBF78'))
    pr = nt.node('ShaderNodeBsdfPrincipled', inp={'Base Color': col, 'Roughness': 0.28,
                                                  'Normal': nt.bump(veins, 0.15, 0.001)})
    tl = nt.node('ShaderNodeBsdfTranslucent', inp={'Color': lin('#8FC24F')})
    nt.surface(nt.shader_mix(0.3, pr.outputs[0], tl.outputs[0]))
    return m


@cached
def ball():
    m, nt = new_mat('ball')
    co = nt.obj
    s = nt.sep(co)
    ang = nt.math('ADD', nt.math('DIVIDE', nt.math('ARCTAN2', s[1], s[0]), 2 * math.pi), 0.5)
    pal = nt.ramp(ang, [(0.0, lin('#E8503A')), (1 / 6, lin('#F6C644')), (2 / 6, lin('#3F8FD6')), (3 / 6, lin('#F4F1E8')),
                        (4 / 6, lin('#48B078')), (5 / 6, lin('#F08A3C'))], 'CONSTANT')
    cap = nt.math('GREATER_THAN', nt.math('ABSOLUTE', s[2]), 0.047)
    col = nt.mix(cap, pal, lin('#F4F1E8'))
    seam = nt.math('LESS_THAN', nt.math('ABSOLUTE', nt.math('SUBTRACT', nt.math('FRACT', nt.math('MULTIPLY', ang, 6.0)),
                                                              0.5)), 0.47)
    nt.P(Base_Color=col, Roughness=0.33, Specular_IOR_Level=0.5, Coat_Weight=0.3, Coat_Roughness=0.15,
         Normal=nt.bump(seam, 0.25, 0.0008), Subsurface_Weight=0.15, Subsurface_Radius=(0.4, 0.4, 0.4),
         Subsurface_Scale=0.01)
    return m


@cached
def stone(name='counter', a='#E8E4DC', b='#CFC8BC'):
    m, nt = new_mat(name)
    co = nt.obj
    n = nt.noise(co, scale=9, detail=6, rough=0.7, dist=1.0)
    sp = nt.math('GREATER_THAN', nt.voronoi(co, scale=160), 0.42)
    col = nt.mix(nt.ramp(n, [(0.4, 0.0), (0.7, 1.0)]), lin(a), lin(b))
    col = nt.mix(nt.math('MULTIPLY', sp, 0.2), col, lin('#9A948A'))
    nt.P(Base_Color=col, Roughness=0.22, Specular_IOR_Level=0.5)
    return m


@cached
def tiles(name='tiles', color='#F1EEE8', w=0.15, h=0.075):
    m, nt = new_mat(name)
    co = nt.obj
    v = nt.mapping(co, rot=(math.pi / 2, 0, 0))
    br = nt.node('ShaderNodeTexBrick', inp={'Vector': v, 'Color1': (0.5, 0.5, 0.5, 1), 'Color2': (1, 1, 1, 1),
                                            'Mortar': (0, 0, 0, 1), 'Scale': 1.0, 'Mortar Size': 0.0018,
                                            'Mortar Smooth': 0.2, 'Brick Width': w, 'Row Height': h})
    gap = br.outputs['Fac']
    col = nt.mix(gap, nt.mix(nt.math('MULTIPLY', br.outputs['Color'], 0.08), lin(color), (0.7, 0.7, 0.68, 1)),
                 lin('#B9B4AA'))
    nt.P(Base_Color=col, Roughness=nt.math('ADD', 0.12, nt.math('MULTIPLY', gap, 0.6)),
         Normal=nt.bump(nt.math('SUBTRACT', 1.0, gap), 0.5, 0.001))
    return m


@cached
def perforated(name='perf', color='#F2F2F0', scale=260):
    m, nt = new_mat(name)
    co = nt.obj
    vo = nt.voronoi(co, scale=scale, rand=0.0)
    hole = nt.math('LESS_THAN', vo, 0.33)
    col = nt.mix(hole, lin(color), (0.02, 0.02, 0.02, 1))
    nt.P(Base_Color=col, Roughness=0.4, Normal=nt.bump(nt.math('SUBTRACT', 1.0, hole), 0.6, 0.001))
    return m


@cached
def wicker(name='wicker', color='#C9A774'):
    m, nt = new_mat(name)
    co = nt.obj
    s = nt.sep(co)
    ang = nt.math('MULTIPLY', nt.math('ARCTAN2', s[1], s[0]), 14.0)
    a = nt.math('SINE', nt.math('ADD', ang, nt.math('MULTIPLY', nt.math('FLOOR', nt.math('MULTIPLY', s[2], 60)), math.pi)))
    b = nt.math('SINE', nt.math('MULTIPLY', s[2], 60 * 2 * math.pi))
    h = nt.math('MULTIPLY', nt.math('ABSOLUTE', a), nt.math('ABSOLUTE', b))
    col = nt.mix(h, lin('#8A6A3F'), lin(color))
    nt.P(Base_Color=col, Roughness=0.6, Normal=nt.bump(h, 0.9, 0.004))
    return m


@cached
def art(seed=0.0):
    m, nt = new_mat('art%d' % int(seed * 10))
    co = nt.obj
    n = nt.noise(nt.mapping(co, loc=(seed * 7, seed * 3, 0)), scale=3.2, detail=1, rough=0.4, dist=1.6)
    pal = [(0.30, lin('#E9DCC8')), (0.42, lin('#D99A6C')), (0.5, lin('#E9DCC8')), (0.58, lin('#7FA092')),
           (0.70, lin('#34495E'))]
    nt.P(Base_Color=nt.ramp(n, pal, 'CONSTANT'), Roughness=0.7)
    return m


def plastic(name, color, rough=0.35):
    return pbr('pl_' + name, color, rough, Specular_IOR_Level=0.5, Coat_Weight=0.15, Coat_Roughness=0.2)


def metal(name, color, rough=0.25):
    return pbr('mt_' + name, color, rough, metal=1.0)
