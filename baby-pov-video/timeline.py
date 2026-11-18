"""Pure-python choreography: where the baby, its hands, the ball, the robot vacuum and mum are at time t.
Shared by the scene builder (keyframes) and the audio synthesiser (sound events)."""
import math

FPS = 24
T_TOTAL = 38.0
NF = int(FPS * T_TOTAL)
CUT = 18.5                      # blink-cut: living room -> kitchen

MAT = (-1.0, 1.0, -1.5, 0.0)    # play mat x0, x1, y0, y1
MAT_H = 0.04
WASHER_DOOR = (-2.1, 3.9, 0.47)
CAB_FRONT_Y = 3.9

rad = math.radians


def clamp(x, a, b):
    return a if x < a else b if x > b else x


def sstep(x):
    x = clamp(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def sstep2(x):
    x = clamp(x, 0.0, 1.0)
    return x * x * x * (x * (6 * x - 15) + 10)


def ease(t, a, b):
    return sstep((t - a) / (b - a))


def bump(u):
    return math.sin(math.pi * u) ** 2 if 0.0 < u < 1.0 else 0.0


def lerp(a, b, u):
    if isinstance(a, (int, float)):
        return a + (b - a) * u
    return tuple(x + (y - x) * u for x, y in zip(a, b))


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x * s for x in a)


def norm2(v):
    d = math.hypot(v[0], v[1])
    return (v[0] / d, v[1] / d)


def wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def keyed(keys, t, fn=sstep):
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys[:-1], keys[1:]):
        if t <= t1:
            return lerp(v0, v1, fn((t - t0) / (t1 - t0)))
    return keys[-1][1]


def _h(i, seed):
    x = math.sin(i * 127.1 + seed * 311.7) * 43758.5453
    return (x - math.floor(x)) * 2 - 1


def vnoise(t, seed):
    i = math.floor(t)
    f = t - i
    u = f * f * (3 - 2 * f)
    return _h(i, seed) * (1 - u) + _h(i + 1, seed) * u


def ground(x, y):
    return MAT_H if (MAT[0] <= x <= MAT[1] and MAT[2] <= y <= MAT[3]) else 0.0


# =============================================================================== ball
BALL_R = 0.055
BALL0 = (0.576, -1.03)
BALL_DIR = norm2((0.542, -0.840))
T_BAT = 3.10
_BV0, _BD1 = 0.75, 1.30
_BA1 = _BV0 ** 2 / (2 * _BD1)
BALL1 = add(BALL0, mul(BALL_DIR, _BD1))
_EDGE_D = (BALL0[1] - MAT[2]) / -BALL_DIR[1]
_T_EDGE = T_BAT + (_BV0 - math.sqrt(_BV0 ** 2 - 2 * _BA1 * _EDGE_D)) / _BA1

ROBOT_R = 0.175
ROBOT_Y = -2.02
ROBOT_T0 = 4.57
ROBOT_V = 0.35
ROBOT_DOCK_X = -2.6
ROBOT_BUMP_X = 1.075
T_BUMP = ROBOT_T0 + (ROBOT_BUMP_X - ROBOT_DOCK_X) / ROBOT_V
BALL_DIR2 = norm2((BALL1[0] - ROBOT_BUMP_X, BALL1[1] - ROBOT_Y))
_BV2, _BD2 = 0.45, 0.45
_BA2 = _BV2 ** 2 / (2 * _BD2)


def _roll(tau, v0, a):
    tau = clamp(tau, 0.0, v0 / a)
    return v0 * tau - 0.5 * a * tau * tau


def ball_state(t):
    """-> (x, y, z), roll distance 1, roll distance 2, speed"""
    d1 = _roll(t - T_BAT, _BV0, _BA1)
    d2 = _roll(t - T_BUMP, _BV2, _BA2)
    x = BALL0[0] + BALL_DIR[0] * d1 + BALL_DIR2[0] * d2
    y = BALL0[1] + BALL_DIR[1] * d1 + BALL_DIR2[1] * d2
    z = BALL_R + MAT_H
    if t > _T_EDGE:
        dt = t - _T_EDGE
        z = max(BALL_R, BALL_R + MAT_H - 0.5 * 9.8 * dt * dt)
        tb = dt - 0.09
        if tb > 0:
            z += 0.011 * math.exp(-tb * 7) * abs(math.sin(math.pi * tb / 0.11))
    sp = 0.0
    if 0 < t - T_BAT < _BV0 / _BA1:
        sp = _BV0 - _BA1 * (t - T_BAT)
    if 0 < t - T_BUMP < _BV2 / _BA2:
        sp = _BV2 - _BA2 * (t - T_BUMP)
    return (x, y, z), d1, d2, sp


# =============================================================================== robot vacuum
def _robot_table():
    tab = {}
    x, y, h = ROBOT_BUMP_X, ROBOT_Y, 0.0
    dt = 1.0 / 240
    n0 = int(T_BUMP * 240)
    for i in range(n0, int(T_TOTAL * 240) + 2):
        t = i * dt
        if t < T_BUMP + 0.35:
            v = -0.2 * bump((t - T_BUMP) / 0.35) * 1.6
        elif t < T_BUMP + 1.2:
            v = 0.0
            h = rad(62) * ease(t, T_BUMP + 0.38, T_BUMP + 1.2)
        else:
            v = ROBOT_V * ease(t, T_BUMP + 1.2, T_BUMP + 1.5)
            h = rad(62) + rad(28) * ease(t, T_BUMP + 2.2, T_BUMP + 3.6)
        x += math.cos(h) * v * dt
        y += math.sin(h) * v * dt
        tab[i] = (x, y, h)
    return tab


_RT = _robot_table()


def robot_state(t):
    """-> x, y, heading, travelled distance (for wheels / brushes)"""
    if t >= CUT:
        return 2.05, 0.75, rad(140), 0.0
    if t < ROBOT_T0:
        return ROBOT_DOCK_X, ROBOT_Y, 0.0, 0.0
    if t < T_BUMP:
        tt = t - ROBOT_T0
        d = ROBOT_V * (tt - 0.25 * (1 - math.exp(-tt / 0.25)))     # soft start
        d = min(d * (ROBOT_BUMP_X - ROBOT_DOCK_X) / (ROBOT_V * (T_BUMP - ROBOT_T0 - 0.25)), ROBOT_BUMP_X - ROBOT_DOCK_X)
        return ROBOT_DOCK_X + d, ROBOT_Y, 0.0, d
    i = t * 240
    i0 = int(math.floor(i))
    a = _RT[i0]
    b = _RT.get(i0 + 1, a)
    u = i - i0
    return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, (t - ROBOT_T0) * ROBOT_V


# =============================================================================== baby body
B0 = (0.35, -0.85)
PSI0 = rad(-72)
_f0 = (math.cos(PSI0), math.sin(PSI0))
P1 = add(B0, mul(_f0, -0.03))
D1 = norm2((BALL1[0] - P1[0], BALL1[1] - P1[1]))
PSI1 = math.atan2(D1[1], D1[0])

#            plant time, hand, body advance
STR1 = [(5.25, 'L', .085), (5.95, 'R', .085), (6.60, 'L', .085), (7.25, 'R', .085), (7.90, 'L', .085),
        (8.50, 'R', .085), (9.15, 'L', .07)]
PSI2 = rad(-30)
D2 = (math.cos(PSI2), math.sin(PSI2))
STR2 = [(17.55, 'R', .075), (18.15, 'L', .075)]

PSI3 = math.atan2(0.979, -0.206)
D3 = (math.cos(PSI3), math.sin(PSI3))
E3 = (-2.055, CAB_FRONT_Y - 0.225)
STR3 = [(18.95, 'L', .087), (19.60, 'R', .087), (20.25, 'L', .087), (20.90, 'R', .087), (21.55, 'L', .087),
        (22.20, 'R', .085)]
P3 = add(E3, mul(D3, -sum(s[2] for s in STR3)))
PSI4 = rad(-6)
D4 = (math.cos(PSI4), math.sin(PSI4))
E4A = (-1.915, 3.585)
STR4 = [(30.05, 'R', .065), (30.70, 'L', .065)]
E4 = add(E4A, mul(D4, 0.13))

T_PAT_GLASS = (24.35, 24.95)
T_PAT_FOOT = (31.95, 32.60)
T_LIFT = 36.0


def _crawl(strides, t):
    return sum(L * sstep((t - (tp - 0.12)) / 0.62) for tp, _, L in strides)


def eye_xy(t):
    if t < CUT:
        p = lerp(B0, P1, ease(t, 4.0, 4.9))
        p = add(p, mul(D1, _crawl(STR1, t)))
        p = add(p, mul(D1, 0.018 * math.sin((t - 4.55) * 2 * math.pi * 1.7) * bump((t - 4.5) / 0.75)))  # rocking
        p = add(p, mul(D2, _crawl(STR2, t)))
        return p
    p = add(P3, mul(D3, _crawl(STR3, t)))
    p = add(p, mul(D3, 0.035 * ease(t, 23.6, 24.3) * (1 - ease(t, 25.6, 26.4))))       # lean toward the glass
    k = ease(t, 27.6, 29.7)
    p = add(p, mul((E4A[0] - E3[0], E4A[1] - E3[1]), k))
    p = add(p, mul(D4, _crawl(STR4, t)))
    p = add(p, mul(D4, 0.03 * ease(t, 31.4, 31.95)))                                    # lean to pat the foot
    p = add(p, mul(D4, -0.085 * ease(t, 33.3, 34.6)))                                   # sit back to look up
    p = add(p, mul(D4, 0.05 * ease(t, T_LIFT, 37.8)))                                   # scooped up
    return p


_PSI_A = [(0, PSI0), (4.6, PSI0), (6.0, PSI1), (10.6, PSI1), (11.9, rad(-90)), (15.4, rad(-90)),
          (17.2, rad(-36)), (18.49, PSI2)]
_PSI_B = [(18.5, PSI3), (27.6, PSI3), (29.7, PSI4), (38, PSI4)]


def psi(t):
    return keyed(_PSI_A if t < CUT else _PSI_B, t)


_EZ_A = [(0, .18), (4.0, .18), (4.55, .262), (4.95, .29), (9.8, .29), (10.35, .272), (11.9, .268), (12.6, .285),
         (14.3, .29), (15.5, .285), (17.0, .262), (18.49, .258)]
_EZ_B = [(18.5, .25), (22.7, .25), (24.0, .325), (25.9, .325), (27.7, .30), (29.6, .255), (31.3, .26),
         (33.3, .262), (34.6, .335), (T_LIFT, .335), (37.9, .70)]


def eye_z(t):
    z = keyed(_EZ_A if t < CUT else _EZ_B, t)
    for tp in (14.95, 15.40):                       # excited bouncing while slapping the floor
        z += 0.012 * bump((t - tp + 0.12) / 0.3)
    return z


def body_frame(t):
    p = psi(t)
    return (math.cos(p), math.sin(p)), (-math.sin(p), math.cos(p))


# =============================================================================== mum
MOM_STAND = (-1.38, 3.50)
#             t0,    t1,    foot, target (x, y),   yaw
MOM_STEPS = [(26.20, 26.72, 'L', (0.05, 3.41), 180),
             (26.72, 27.24, 'R', (-0.42, 3.59), 180),
             (27.24, 27.76, 'L', (-0.89, 3.41), 180),
             (27.76, 28.28, 'R', (-1.36, 3.59), 180),
             (28.28, 28.75, 'L', (-1.38, 3.41), 180)]
_MOM_F0 = {'L': ((0.41, 3.62), 90), 'R': ((0.59, 3.62), 90)}
T_SQUAT = (33.4, 34.9)


def mom_foot(f, t):
    """-> (x, y, z), yaw, pitch (heel lift +), toe curl"""
    pos, yaw = _MOM_F0[f]
    z = 0.0
    pitch = 0.0
    for t0, t1, ff, tgt, y1 in MOM_STEPS:
        if ff != f or t < t0:
            continue
        u = clamp((t - t0) / (t1 - t0), 0, 1)
        if u < 1:
            s = sstep(u)
            npos = lerp(pos, tgt, s)
            yaw = yaw + wrap(rad(y1) - rad(yaw)) * s * 180 / math.pi if False else yaw + (y1 - yaw) * s
            z = 0.045 * math.sin(math.pi * u) ** 1.3
            pitch = rad(28) * bump(u * 0.9 + 0.02) * (1 - u) * 1.8 - rad(14) * bump((u - 0.62) / 0.4)
            pos = npos
        else:
            pos, yaw = tgt, y1
    # heel-off just before this foot's next swing
    for t0, t1, ff, tgt, y1 in MOM_STEPS:
        if ff == f and t0 - 0.16 < t <= t0:
            pitch = rad(20) * sstep((t - (t0 - 0.16)) / 0.16)
            z = 0.012 * sstep((t - (t0 - 0.16)) / 0.16)
    sq = ease(t, *T_SQUAT)
    pitch += rad(12) * sq
    z += 0.018 * sq
    toe = 0.0
    if f == 'R' and 32.1 < t < 33.3:
        toe = rad(24) * abs(math.sin(2 * math.pi * 1.5 * (t - 32.1))) * bump((t - 32.1) / 1.2) ** 0.5
        pitch -= toe
    return (pos[0], pos[1], z), rad(yaw), pitch, toe


def mom_state(t):
    L = mom_foot('L', t)
    R = mom_foot('R', t)
    cx = cy = 0.0
    for dt in (-0.16, -0.08, 0, 0.08, 0.16):
        a = mom_foot('L', t + dt)[0]
        b = mom_foot('R', t + dt)[0]
        cx += (a[0] + b[0]) / 10
        cy += (a[1] + b[1]) / 10
    theta = (L[1] + R[1]) / 2
    fx, fy = math.cos(theta), math.sin(theta)
    walking = bump((t - 26.2) / 2.55) ** 0.3 if 26.2 < t < 28.75 else 0.0
    sq = ease(t, *T_SQUAT)
    up = ease(t, T_LIFT + 0.2, 38.2)
    pz = 0.90 - 0.014 * walking * abs(math.sin(math.pi * (t - 26.2) / 0.52)) - 0.50 * sq + 0.22 * up
    px = cx + fx * 0.03 - fx * 0.13 * sq
    py = cy + fy * 0.03 - fy * 0.13 * sq + 0.012 * walking * math.sin(math.pi * (t - 26.2) / 0.52)
    lean = rad(4) + rad(27) * ease(t, 33.6, 35.1) - rad(12) * up
    return dict(pelvis=(px, py, pz), theta=theta, lean=lean, footL=L, footR=R, squat=sq, up=up)


def mom_head(t):
    m = mom_state(t)
    fx, fy = math.cos(m['theta']), math.sin(m['theta'])
    h = 0.66
    s, c = math.sin(m['lean']), math.cos(m['lean'])
    p = m['pelvis']
    return (p[0] + fx * s * h + fx * 0.04, p[1] + fy * s * h, p[2] + c * h)


# =============================================================================== gaze
def _ahead(dist, z=None):
    def fn(t):
        e = eye_xy(t)
        f, _ = body_frame(t)
        x, y = e[0] + f[0] * dist, e[1] + f[1] * dist
        return (x, y, ground(x, y) if z is None else z)
    return fn


def _const(p):
    return lambda t: p


def _ball(t):
    return ball_state(t - 0.12)[0]


def _robot(t):
    r = robot_state(t - 0.1)
    return (r[0], r[1], 0.07)


def _mom_feet(t):
    a = mom_foot('L', t)[0]
    b = mom_foot('R', t)[0]
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.0)


def _mom_face(t):
    h = mom_head(t)
    e = eye_xy(t)
    ez = eye_z(t)
    # don't crane the neck fully: aim below her face so it sits in the upper third of the frame
    return (h[0] * 0.8 + e[0] * 0.2 + 0.05, h[1], ez + (h[2] - ez) * 0.72)


BLOCKS = (0.265, -1.235)
#        start, blend, target fn
LOOK = [(0.0, 0.0, _const((BLOCKS[0], BLOCKS[1], 0.10))),
        (1.45, 0.55, _ball),
        (5.0, 0.5, _ahead(0.30)),
        (6.25, 0.5, _ball),
        (7.55, 0.4, _ahead(0.33)),
        (8.35, 0.45, _ball),
        (9.7, 0.35, _ahead(0.25, 0.0)),
        (10.5, 0.62, _robot),
        (15.12, 0.28, _ball),
        (16.0, 0.4, _robot),
        (18.5, 0.0, _ahead(0.30)),
        (19.55, 0.55, _const((WASHER_DOOR[0], WASHER_DOOR[1], 0.44))),
        (21.05, 0.45, _ahead(0.28)),
        (21.8, 0.5, _const((WASHER_DOOR[0] + 0.02, WASHER_DOOR[1], 0.47))),
        (24.05, 0.3, _const((-2.20, 3.88, 0.39))),
        (25.05, 0.4, _const((WASHER_DOOR[0], WASHER_DOOR[1], 0.46))),
        (26.35, 0.75, _mom_feet),
        (30.2, 0.45, _const((-1.53, 3.59, 0.05))),
        (33.72, 0.62, _mom_face)]


def look(t):
    """-> (current target, previous target or None, blend 0..1). Blending happens in angle space in cam_state."""
    idx = 0
    for i, (ts, _, _) in enumerate(LOOK):
        if t >= ts:
            idx = i
    ts, bl, fn = LOOK[idx]
    p = fn(t)
    if bl > 0 and t < ts + bl and idx > 0:
        return p, LOOK[idx - 1][2](t), sstep2((t - ts) / bl)
    return p, None, 1.0


# =============================================================================== hands
HANDS = {'L': [], 'R': []}
PLANTS = []          # (time, side sign, strength) -> head bob
SOUNDS = []          # (time, kind, (x, y, z), strength)


def side(h):
    return 1.0 if h == 'L' else -1.0


def shoulder(h, t):
    e = eye_xy(t)
    f, l = body_frame(t)
    return (e[0] - f[0] * 0.04 + l[0] * 0.082 * side(h), e[1] - f[1] * 0.04 + l[1] * 0.082 * side(h), eye_z(t) - 0.09)


def _plant(tp, h, reach, lat=0.085, lead=0.2):
    e = eye_xy(tp)
    p = psi(tp + lead)
    f = (math.cos(p), math.sin(p))
    l = (-f[1], f[0])
    x = e[0] + f[0] * reach + l[0] * lat * side(h)
    y = e[1] + f[1] * reach + l[1] * lat * side(h)
    if tp > CUT:
        y = min(y, CAB_FRONT_Y - 0.075)
    return (x, y, ground(x, y)), p - side(h) * 0.12


def step(h, tp, reach=0.175, lat=0.085, dur=0.40, lift=0.034, amp=1.0, kind=None, lead=0.2):
    pos, yaw = _plant(tp, h, reach, lat, lead)
    HANDS[h].append(dict(t0=tp - dur, t1=tp, pos=pos, yaw=yaw, pitch=0.0, roll=0.0, lift=lift, kind='step'))
    PLANTS.append((tp, side(h), amp))
    surf = kind or ('mat' if pos[2] > 0.01 else 'wood')
    SOUNDS.append((tp, surf, pos, amp))


def move(h, t0, t1, pos, yaw, pitch=0.0, roll=0.0, lift=0.0, rel=False, kind='reach'):
    HANDS[h].append(dict(t0=t0, t1=t1, pos=pos, yaw=yaw, pitch=pitch, roll=roll, lift=lift, kind=kind, rel=rel))


def _build_hands():
    # ---- tummy time
    for h in 'LR':
        pos, yaw = _plant(0.0, h, 0.135, 0.075, 0)
        move(h, -1, -0.5, pos, yaw - side(h) * 0.25)
    # bat the ball with the left hand
    sh = shoulder('L', 2.8)
    u = norm2((BALL0[0] - sh[0], BALL0[1] - sh[1]))
    yawb = math.atan2(u[1], u[0])
    c = (BALL0[0] - u[0] * 0.098, BALL0[1] - u[1] * 0.098, MAT_H + 0.045)
    move('L', 2.30, T_BAT, c, yawb, pitch=0.35, lift=0.045)
    move('L', T_BAT, 3.45, (c[0] + BALL_DIR[0] * 0.065, c[1] + BALL_DIR[1] * 0.065, MAT_H), yawb + 0.1, lift=0.01)
    SOUNDS.append((T_BAT, 'ball', (BALL0[0], BALL0[1], 0.09), 1.0))
    SOUNDS.append((3.45, 'mat', c, 0.5))
    # push up
    step('L', 4.38, 0.125, dur=0.34, amp=0.5)
    step('R', 4.78, 0.125, dur=0.34, amp=0.5)
    for tp, h, _ in STR1:
        step(h, tp)
    step('R', 10.28, 0.215, dur=0.5, lift=0.05, amp=0.9)                  # down off the mat edge
    # pivot right to watch the robot
    step('L', 11.15, 0.19, amp=0.6)
    step('R', 11.65, 0.20, amp=0.6)
    step('L', 12.15, 0.20, amp=0.5)
    # reach for the robot, then slap the floor with excitement
    def toward_robot(t, d, z):
        e = eye_xy(t)
        r = robot_state(t)
        v = norm2((r[0] - e[0], r[1] - e[1]))
        return (e[0] + v[0] * d + 0.03, e[1] + v[1] * d, z), math.atan2(v[1], v[0])
    p, yw = toward_robot(14.3, 0.21, 0.19)
    move('L', 13.75, 14.3, p, yw, pitch=0.5, roll=0.3)
    p2, yw2 = toward_robot(14.75, 0.22, 0.21)
    move('L', 14.3, 14.75, p2, yw2, pitch=0.3, roll=0.2)
    step('L', 14.95, 0.20, dur=0.2, lift=0.0, amp=1.3)
    step('L', 15.40, 0.20, dur=0.3, lift=0.10, amp=1.3)
    # pivot left to follow it
    step('R', 16.05, 0.19, amp=0.6)
    step('L', 16.55, 0.19, amp=0.6)
    step('R', 17.02, 0.19, amp=0.6)
    for tp, h, _ in STR2:
        step(h, tp)
    # ---- blink cut -> kitchen
    for h, r in (('L', 0.10), ('R', 0.17)):
        pos, yaw = _plant(CUT, h, r, lead=0)
        move(h, CUT, CUT, pos, yaw, kind='teleport')
    for i, (tp, h, _) in enumerate(STR3):
        step(h, tp, reach=0.175 if i < 4 else 0.15)
    # pat the washer glass
    g = (-2.215, CAB_FRONT_Y - 0.02, 0.385)
    move('L', 23.55, T_PAT_GLASS[0], g, rad(92), pitch=rad(78), lift=0.02, kind='reach')
    move('L', 24.55, 24.75, (g[0], g[1] - 0.05, g[2] + 0.01), rad(92), pitch=rad(70))
    move('L', 24.75, T_PAT_GLASS[1], (g[0] + 0.01, g[1], g[2] + 0.015), rad(96), pitch=rad(80))
    for tp in T_PAT_GLASS:
        SOUNDS.append((tp, 'glass', g, 1.0))
    move('L', 25.3, 25.9, (g[0] + 0.005, g[1], g[2] - 0.07), rad(100), pitch=rad(80))     # slides down the glass
    SOUNDS.append((25.3, 'squeak', g, 1.0))
    step('L', 26.75, 0.15, dur=0.6, lift=0.05, amp=0.6)
    # pivot right towards mum
    step('R', 27.95, 0.17, amp=0.6)
    step('L', 28.45, 0.17, amp=0.6)
    step('R', 28.95, 0.17, amp=0.6)
    step('L', 29.45, 0.17, amp=0.6)
    for tp, h, _ in STR4:
        step(h, tp, reach=0.17)
    step('L', 31.2, 0.13, amp=0.4, dur=0.3)
    # pat mum's foot
    ft = (-1.575, 3.592, 0.066)
    move('R', 31.40, T_PAT_FOOT[0], ft, rad(-4), pitch=rad(-12), lift=0.06)
    move('R', 32.15, 32.38, (ft[0] - 0.015, ft[1], ft[2] + 0.055), rad(-4), pitch=rad(10))
    move('R', 32.38, T_PAT_FOOT[1], ft, rad(-2), pitch=rad(-12))
    for tp in T_PAT_FOOT:
        SOUNDS.append((tp, 'sock', ft, 1.0))
    step('R', 34.0, 0.13, dur=0.5, lift=0.05, amp=0.3)
    # "pick me up" arms: out to the sides first, then up towards mum
    for h in 'LR':
        d = 0.10 if h == 'R' else 0.0
        move(h, 34.45 + d, 34.85 + d, (0.10, 0.19 * side(h), -0.06), 0.0, pitch=rad(25), roll=rad(40) * side(h), rel=True)
        move(h, 34.85 + d, 35.45 + d, (0.175, 0.135 * side(h), 0.115), 0.0, pitch=rad(62), roll=rad(55) * side(h), rel=True)
        move(h, 35.9, 36.6, (0.165, 0.14 * side(h), 0.15), 0.0, pitch=rad(70), roll=rad(60) * side(h), rel=True)
    for h in 'LR':
        HANDS[h].sort(key=lambda e: e['t0'])
    PLANTS.sort()
    SOUNDS.sort(key=lambda s: s[0])


def _pose(ev, t):
    if ev.get('rel'):
        e = eye_xy(t)
        f, l = body_frame(t)
        ez = eye_z(t)
        a, b, c = ev['pos']
        pos = (e[0] + f[0] * a + l[0] * b, e[1] + f[1] * a + l[1] * b, ez + c)
        return pos, psi(t) + ev['yaw'], ev['pitch'], ev['roll']
    return ev['pos'], ev['yaw'], ev['pitch'], ev['roll']


def hand_state(h, t):
    """-> (x, y, z) of the wrist, yaw (finger heading), pitch (fingers up +), roll"""
    evs = HANDS[h]
    idx = 0
    for i, ev in enumerate(evs):
        if t >= ev['t0']:
            idx = i
    ev = evs[idx]
    pos, yaw, pitch, roll = _pose(ev, t)
    if t < ev['t1'] and idx > 0:
        p0, y0, pi0, r0 = _pose(evs[idx - 1], t)
        u = (t - ev['t0']) / (ev['t1'] - ev['t0'])
        s = sstep(u)
        if ev['kind'] == 'step':
            s = sstep(u ** 0.85)
        pos2 = lerp(p0, pos, s)
        z = pos2[2] + ev['lift'] * math.sin(math.pi * u ** 0.8)
        pos = (pos2[0], pos2[1], z)
        yaw = y0 + wrap(yaw - y0) * s
        pitch = pi0 + (pitch - pi0) * s
        roll = r0 + (roll - r0) * s
        if ev['kind'] == 'step':
            pitch += -0.55 * math.sin(math.pi * u) * (1 - u) * 2.0 + 0.22 * bump((u - 0.6) / 0.4)
    return pos, yaw, pitch, roll


_build_hands()


# =============================================================================== camera
def cam_state(t):
    ex, ey = eye_xy(t)
    ez = eye_z(t)
    ps = psi(t)
    f, l = body_frame(t)
    dz = dl = roll = dpitch = 0.0
    for tp, sgn, amp in PLANTS:
        u = (t - tp + 0.06) / 0.42
        if 0 < u < 1:
            b = bump(u)
            dz -= 0.010 * amp * b
            dl += 0.011 * sgn * amp * b
            roll += rad(2.4) * sgn * amp * b
            dpitch -= rad(2.6) * amp * b
    ex += l[0] * dl + 0.003 * vnoise(t * 1.7, 5)
    ey += l[1] * dl + 0.003 * vnoise(t * 1.9, 7)
    ez += dz + 0.0025 * math.sin(2 * math.pi * t / 1.25) + 0.002 * vnoise(t * 2.1, 3)
    def aim(p):
        dx, dy, dzz = p[0] - ex, p[1] - ey, p[2] - ez
        yw = ps + clamp(wrap(math.atan2(dy, dx) - ps), -rad(84), rad(84))
        return yw, clamp(math.atan2(dzz, math.hypot(dx, dy)), -rad(68), rad(72)), math.sqrt(dx * dx + dy * dy + dzz * dzz)
    tgt, old, k = look(t)
    yaw, pitch, focus = aim(tgt)
    if old is not None:
        y0, p0, f0 = aim(old)
        yaw = y0 + wrap(yaw - y0) * k
        pitch = p0 + (pitch - p0) * k
        focus = f0 + (focus - f0) * k
    wob = 1.0 - 0.6 * ease(t, 35.5, 37.0)
    yaw += (rad(0.9) * vnoise(t * 1.3, 11) + rad(0.35) * vnoise(t * 4.1, 13)) * wob
    pitch += dpitch + (rad(0.7) * vnoise(t * 1.5, 17) + rad(0.3) * vnoise(t * 4.6, 19)) * wob
    roll += rad(1.7) * vnoise(t * 0.9, 23) + rad(0.5) * vnoise(t * 3.3, 29)
    roll += rad(7) * ease(t, 22.9, 23.8) * (1 - ease(t, 25.8, 26.6))          # head tilt: fascinated by the drum
    roll -= rad(5) * ease(t, 34.0, 35.0) * (1 - ease(t, 36.5, 37.6))
    return dict(pos=(ex, ey, ez), yaw=yaw, pitch=pitch, roll=roll, focus=focus, psi=ps)


BLINKS = [(9.62, 'blink'), (CUT, 'cut'), (29.25, 'blink'), (34.0, 'blink')]

if __name__ == '__main__':
    print('E1', eye_xy(10.4), 'BALL1', BALL1, 'T_BUMP', T_BUMP, 'T_EDGE', _T_EDGE, 'P3', P3)
    for t in (0, 3, 6, 10, 14, 18, 19, 24, 28, 32, 35, 37.5):
        c = cam_state(t)
        print(t, [round(v, 3) for v in c['pos']], round(math.degrees(c['yaw'])), round(math.degrees(c['pitch'])),
              round(c['focus'], 2), 'L', [round(v, 2) for v in hand_state('L', t)[0]], 'R',
              [round(v, 2) for v in hand_state('R', t)[0]])
    print(mom_state(27.5), mom_head(35.5))
