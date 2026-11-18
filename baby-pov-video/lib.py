"""Shared helpers: mesh builders, SDF modelling, procedural material graphs."""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix, Euler, Quaternion

COLL = None


def set_collection(c):
    global COLL
    COLL = c


def lin(c):
    """sRGB 0..1 (or hex string) -> linear RGBA tuple."""
    if isinstance(c, str):
        c = c.lstrip('#')
        c = tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


# ----------------------------------------------------------------- node graph helper
class NT:
    def __init__(self, mat):
        self.t = mat.node_tree
        self.nodes = self.t.nodes
        self.links = self.t.links
        self.bsdf = self.nodes.get('Principled BSDF')
        self.out = self.nodes.get('Material Output')
        self._tc = None

    def set(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.links.new(v, sock)
        elif v is not None:
            try:
                sock.default_value = v
            except Exception:
                if isinstance(v, (int, float)):
                    sock.default_value = (v, v, v, 1.0)[:len(sock.default_value)]
                else:
                    sock.default_value = tuple(v)[:len(sock.default_value)]

    def node(self, typ, inp=None, **props):
        n = self.nodes.new(typ)
        for k, v in props.items():
            setattr(n, k, v)
        if inp:
            for k, v in inp.items():
                self.set(n.inputs[k], v)
        return n

    def P(self, **kw):
        for k, v in kw.items():
            self.set(self.bsdf.inputs[k.replace('_', ' ')], v)

    @property
    def obj(self):
        if self._tc is None:
            self._tc = self.node('ShaderNodeTexCoord')
        return self._tc.outputs['Object']

    @property
    def gen(self):
        _ = self.obj
        return self._tc.outputs['Generated']

    def mapping(self, vec, scale=(1, 1, 1), rot=(0, 0, 0), loc=(0, 0, 0)):
        n = self.node('ShaderNodeMapping', inp={'Vector': vec, 'Scale': scale, 'Rotation': rot, 'Location': loc})
        return n.outputs[0]

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.set(n.inputs[0], a)
        if b is not None:
            self.set(n.inputs[1], b)
        if c is not None:
            self.set(n.inputs[2], c)
        return n.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        n = self.node('ShaderNodeVectorMath', operation=op)
        self.set(n.inputs[0], a)
        if b is not None:
            self.set(n.inputs[1], b)
        if scale is not None:
            self.set(n.inputs['Scale'], scale)
        return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        n = self.node('ShaderNodeMixRGB', blend_type=blend)
        self.set(n.inputs[0], fac)
        self.set(n.inputs[1], a)
        self.set(n.inputs[2], b)
        return n.outputs[0]

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.node('ShaderNodeValToRGB')
        cr = n.color_ramp
        cr.interpolation = interp
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for e, (p, c) in zip(cr.elements, stops):
            e.position = p
            e.color = c if not isinstance(c, (int, float)) else (c, c, c, 1)
        self.set(n.inputs[0], fac)
        return n.outputs[0]

    def noise(self, vec, scale=5.0, detail=4.0, rough=0.55, dist=0.0, out='Fac'):
        n = self.node('ShaderNodeTexNoise', inp={'Vector': vec, 'Scale': scale, 'Detail': detail,
                                                 'Roughness': rough, 'Distortion': dist})
        return n.outputs[0] if out == 'Fac' else n.outputs[1]

    def voronoi(self, vec, scale=5.0, feature='F1', out='Distance', rand=1.0):
        n = self.node('ShaderNodeTexVoronoi', feature=feature, inp={'Vector': vec, 'Scale': scale,
                                                                    'Randomness': rand})
        return n.outputs[out]

    def wave(self, vec, scale=5.0, dist=0.0, detail=0.0, dscale=1.0, kind='BANDS', direction='X', profile='SIN'):
        n = self.node('ShaderNodeTexWave', wave_type=kind, wave_profile=profile,
                      inp={'Vector': vec, 'Scale': scale, 'Distortion': dist, 'Detail': detail,
                           'Detail Scale': dscale})
        if kind == 'BANDS':
            n.bands_direction = direction
        else:
            n.rings_direction = direction
        return n.outputs['Fac']

    def bump(self, height, strength=0.3, dist=0.002, normal=None):
        n = self.node('ShaderNodeBump', inp={'Height': height, 'Strength': strength, 'Distance': dist})
        if normal is not None:
            self.set(n.inputs['Normal'], normal)
        return n.outputs[0]

    def sep(self, vec):
        n = self.node('ShaderNodeSeparateXYZ', inp={0: vec})
        return n.outputs

    def comb(self, x=0.0, y=0.0, z=0.0):
        n = self.node('ShaderNodeCombineXYZ', inp={0: x, 1: y, 2: z})
        return n.outputs[0]

    def shader_mix(self, fac, a, b):
        n = self.node('ShaderNodeMixShader')
        self.set(n.inputs[0], fac)
        self.links.new(a, n.inputs[1])
        self.links.new(b, n.inputs[2])
        return n.outputs[0]

    def surface(self, sh):
        self.links.new(sh, self.out.inputs['Surface'])


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, NT(m)


_cache = {}


def pbr(name, color, rough=0.5, metal=0.0, **kw):
    """Simple principled material. kw keys use underscores for socket names."""
    if name in _cache:
        return _cache[name]
    m, nt = new_mat(name)
    if isinstance(color, str) or len(color) == 3:
        color = lin(color)
    nt.P(Base_Color=color, Roughness=rough, Metallic=metal, **kw)
    _cache[name] = m
    return m


def emit(name, color, strength):
    if name in _cache:
        return _cache[name]
    m, nt = new_mat(name)
    if isinstance(color, str) or len(color) == 3:
        color = lin(color)
    nt.P(Base_Color=(0, 0, 0, 1), Emission_Color=color, Emission_Strength=strength, Roughness=0.4)
    _cache[name] = m
    return m


# ----------------------------------------------------------------- object helpers
def link(o, parent=None):
    (COLL or bpy.context.scene.collection).objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    o.location = loc
    o.rotation_mode = 'QUATERNION'
    return link(o, parent)


def mesh_obj(name, bm, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=False, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = rot
    if mat is not None:
        me.materials.append(mat)
    return link(o, parent)


def add_bevel(o, w, segs=2):
    if w <= 0:
        return
    me = o.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    m = o.modifiers.new('bev', 'BEVEL')
    m.width = w
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(40)
    wn = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    wn.keep_sharp = False
    wn.weight = 100


def box(name, size, loc, mat=None, rot=(0, 0, 0), bevel=0.004, segs=2, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    o = mesh_obj(name, bm, mat, loc, rot, parent=parent)
    add_bevel(o, min(bevel, min(size) * 0.45), segs)
    return o


def box2(name, p0, p1, mat=None, **kw):
    """Box from two corners."""
    size = [abs(p1[i] - p0[i]) for i in range(3)]
    loc = [(p1[i] + p0[i]) / 2 for i in range(3)]
    return box(name, size, loc, mat, **kw)


def lathe(name, profile, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), steps=64, smooth=True, parent=None,
          crease_deg=None):
    """Surface of revolution around Z from [(r, z), ...]."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / steps),
                                        r * math.sin(2 * math.pi * i / steps), z)) for i in range(steps)])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(steps):
            j = (i + 1) % steps
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, mat, loc, rot, smooth=smooth, parent=parent)
    if crease_deg is not None:
        o.data.set_sharp_from_angle(angle=math.radians(crease_deg))
    return o


def cyl(name, r, h, loc, mat=None, rot=(0, 0, 0), r2=None, bevel=0.003, steps=48, parent=None):
    """Cylinder (optionally tapered), origin at center, axis Z."""
    r2 = r if r2 is None else r2
    b = min(bevel, r * 0.5, r2 * 0.5, h * 0.4)
    prof = [(0, -h / 2), (r - b, -h / 2), (r, -h / 2 + b), (r2, h / 2 - b), (r2 - b, h / 2), (0, h / 2)]
    return lathe(name, prof, mat, loc, rot, steps=steps, parent=parent, crease_deg=50)


def sphere(name, r, loc, mat=None, scale=(1, 1, 1), seg=48, rings=24, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return mesh_obj(name, bm, mat, loc, rot, smooth=True, parent=parent)


def torus(name, R, r, loc, mat=None, rot=(0, 0, 0), seg=64, rseg=20, parent=None, squash=1.0):
    prof = []
    for i in range(rseg + 1):
        a = 2 * math.pi * i / rseg
        prof.append((R + r * math.cos(a), r * squash * math.sin(a)))
    return lathe(name, prof, mat, loc, rot, steps=seg, parent=parent)


def grid_surface(name, nu, nv, fn, mat=None, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, solid=0.0):
    """fn(u, v) -> (x, y, z) for u, v in [0, 1]."""
    bm = bmesh.new()
    vs = [[bm.verts.new(fn(i / (nu - 1), j / (nv - 1))) for j in range(nv)] for i in range(nu)]
    for i in range(nu - 1):
        for j in range(nv - 1):
            bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
    o = mesh_obj(name, bm, mat, loc, rot, smooth=True, parent=parent)
    if solid > 0:
        m = o.modifiers.new('sol', 'SOLIDIFY')
        m.thickness = solid
        m.offset = 0
    return o


def tube(name, pts, radius, mat=None, parent=None, res=12, cyclic=False, bevel_res=4):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = bevel_res
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (c[0], c[1], c[2], 1.0)
    sp.use_endpoint_u = not cyclic
    sp.use_cyclic_u = cyclic
    sp.order_u = min(4, len(pts))
    o = bpy.data.objects.new(name, cu)
    if mat is not None:
        cu.materials.append(mat)
    return link(o, parent)


def text(name, body, size, loc, mat=None, rot=(0, 0, 0), extrude=0.0005, parent=None, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new(name, cu)
    o.location = loc
    o.rotation_euler = rot
    if mat is not None:
        cu.materials.append(mat)
    return link(o, parent)


# ----------------------------------------------------------------- SDF modelling
def sd_sphere(p, c, r):
    return np.linalg.norm(p - np.asarray(c), axis=-1) - r


def sd_ellipsoid(p, c, r):
    r = np.asarray(r, dtype=np.float64)
    q = (p - np.asarray(c)) / r
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / r, axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def sd_capsule(p, a, b, ra, rb=None):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    rb = ra if rb is None else rb
    pa = p - a
    ba = b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return np.linalg.norm(pa - h[..., None] * ba, axis=-1) - (ra + (rb - ra) * h)


def sd_box(p, c, half, r=0.0):
    q = np.abs(p - np.asarray(c)) - (np.asarray(half) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(axis=-1), 0) - r


def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def sdf_mesh(name, fn, lo, hi, res, mat=None, parent=None, loc=(0, 0, 0), smooth_iter=2):
    from skimage import measure
    lo = np.asarray(lo, float)
    hi = np.asarray(hi, float)
    n = np.maximum(((hi - lo) / res).astype(int) + 1, 4)
    xs = [np.linspace(lo[i], hi[i], n[i]) for i in range(3)]
    g = np.stack(np.meshgrid(*xs, indexing='ij'), axis=-1)
    d = fn(g)
    sp = [(hi[i] - lo[i]) / (n[i] - 1) for i in range(3)]
    verts, faces, _, _ = measure.marching_cubes(d, 0.0, spacing=sp)
    verts += lo
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces[:, ::-1].tolist())
    me.update()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = bpy.data.objects.new(name, me)
    o.location = loc
    if mat is not None:
        me.materials.append(mat)
    link(o, parent)
    if smooth_iter:
        m = o.modifiers.new('sm', 'SMOOTH')
        m.factor = 0.8
        m.iterations = smooth_iter
    return o


# ----------------------------------------------------------------- maths
def quat_from_fwd_up(fwd, up=(0, 0, 1), roll=0.0):
    """Quaternion for an object whose local -Z looks along fwd and +Y is up (camera convention)."""
    f = Vector(fwd).normalized()
    r = f.cross(Vector(up))
    if r.length < 1e-6:
        r = Vector((1, 0, 0))
    r.normalize()
    u = r.cross(f)
    m = Matrix((r, u, -f)).transposed()
    q = m.to_quaternion()
    if roll:
        q = Quaternion(f, roll) @ q
    return q


def quat_y_to(direction, up_hint=(0, 0, 1)):
    """Quaternion rotating local +Y onto direction, keeping local +Z near up_hint."""
    y = Vector(direction).normalized()
    x = y.cross(Vector(up_hint))
    if x.length < 1e-6:
        x = y.cross(Vector((1, 0, 0)))
    x.normalize()
    z = x.cross(y)
    return Matrix((x, y, z)).transposed().to_quaternion()


def ik2(a, c, l1, l2, pole):
    """Two-bone IK: returns the middle joint for root a, target c."""
    a = Vector(a)
    c = Vector(c)
    d = c - a
    L = d.length
    Lc = max(min(L, (l1 + l2) * 0.999), 1e-5)
    x = (l1 * l1 - l2 * l2 + Lc * Lc) / (2 * Lc)
    h = math.sqrt(max(l1 * l1 - x * x, 0.0))
    dn = d / max(L, 1e-9)
    p = Vector(pole) - dn * Vector(pole).dot(dn)
    if p.length < 1e-6:
        p = Vector((0, 0, 1))
    p.normalize()
    scale = L / Lc
    return a + dn * x * scale + p * h
