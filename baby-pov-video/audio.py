"""Procedural sound track (no samples): everything is synthesised from the same timeline that drives the picture.
Binaural-ish panning follows the baby's head; a synthetic room impulse response glues it together."""
import sys, math
import numpy as np
from scipy import signal
from scipy.io import wavfile
import timeline as TL

SR = 48000
N = int(TL.T_TOTAL * SR)
T = np.arange(N) / SR
rng = np.random.default_rng(11)


# ------------------------------------------------------------------ basic generators
def shaped_noise(n, lo, hi, slope=0.0, seed=None):
    """White noise band-limited to [lo, hi] Hz with a spectral tilt of f**slope."""
    r = np.random.default_rng(seed) if seed is not None else rng
    spec = np.fft.rfft(r.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    mag = np.zeros_like(f)
    band = (f >= lo) & (f <= hi)
    mag[band] = np.maximum(f[band], 1.0) ** slope
    edge = np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-9), 0, 1) * np.clip((hi * 1.3 - f) / (hi * 0.3 + 1e-9), 0, 1)
    mag = np.where(band, mag, edge * np.maximum(f, 1.0) ** slope)
    x = np.fft.irfft(spec * mag, n)
    return x / (np.abs(x).max() + 1e-12)


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def ctrl(fn, rate=100):
    """Evaluate a slow control function of time at `rate` Hz and interpolate to audio rate."""
    tc = np.arange(0, TL.T_TOTAL + 1 / rate, 1 / rate)
    v = np.array([fn(t) for t in tc], dtype=np.float64)
    if v.ndim == 1:
        return np.interp(T, tc, v)
    return np.stack([np.interp(T, tc, v[:, i]) for i in range(v.shape[1])], axis=1)


# ------------------------------------------------------------------ listener
def listener(t):
    c = TL.cam_state(min(max(t, 0.0), TL.T_TOTAL))
    return c['pos'], c['yaw']


def spatial(src, t, d0=0.6):
    """-> (gainL, gainR, distance) for a source at world position src at time t."""
    (ex, ey, ez), yaw = listener(t)
    dx, dy, dz = src[0] - ex, src[1] - ey, src[2] - ez
    d = math.sqrt(dx * dx + dy * dy + dz * dz)
    az = TL.wrap(math.atan2(dy, dx) - yaw)            # + = to the left
    horiz = math.hypot(dx, dy) / max(d, 1e-6)
    pan = math.sin(az) * 0.9 * horiz
    back = 0.8 if abs(az) > math.pi / 2 else 1.0     # things behind the head are a touch duller/quieter
    g = d0 / (d0 + d) * back
    return g * math.sqrt(0.5 * (1 + pan)), g * math.sqrt(0.5 * (1 - pan)), d


class Mix:
    def __init__(self):
        self.dry = np.zeros((N, 2))
        self.send = np.zeros(N)

    def event(self, sig, t, src=None, gain=1.0, d0=0.6, send=0.5):
        """Place a short sound at time t, panned for where it is relative to the baby's head."""
        i0 = int(t * SR)
        if i0 >= N or i0 < 0:
            return
        sig = sig[:N - i0]
        if src is None:
            gl = gr = 0.707
        else:
            gl, gr, _ = spatial(src, t, d0)
        d = int(abs(gl - gr) / (gl + gr + 1e-9) * 0.0006 * SR)       # interaural delay on the far ear
        for ch, g in ((0, gl), (1, gr)):
            dly = d if g < max(gl, gr) else 0
            seg = sig[:max(0, N - i0 - dly)]
            self.dry[i0 + dly:i0 + dly + len(seg), ch] += seg * g * gain
        self.send[i0:i0 + len(sig)] += sig * gain * send * (gl + gr) * 0.6

    def bed(self, sig, pos_fn, gain=1.0, d0=1.0, send=0.5, far_lp=None):
        """Continuous source: per-sample gains from the moving listener / source."""
        g = ctrl(lambda t: spatial(pos_fn(t), t, d0))
        x = sig
        if far_lp:
            dark = lowpass(sig, far_lp)
            near = np.clip(1.6 / (g[:, 2] + 0.3), 0, 1)
            x = sig * near + dark * (1 - near) * 1.3
        self.dry[:, 0] += x * g[:, 0] * gain
        self.dry[:, 1] += x * g[:, 1] * gain
        self.send += x * gain * send * (g[:, 0] + g[:, 1]) * 0.6


def exp_env(n, tau, attack=0.002):
    t = np.arange(n) / SR
    return np.minimum(t / attack, 1.0) * np.exp(-t / tau)


# ------------------------------------------------------------------ voices (additive formant synthesis)
VOW = {'a': (1050, 1900, 3800), 'e': (820, 2900, 4300), 'i': (460, 3500, 4800), 'u': (520, 1350, 3600),
       'o': (720, 1450, 3700), 'x': (800, 2250, 4000), 'm': (340, 1500, 3300),
       # adult female
       'M': (270, 1150, 2600), 'A': (850, 1350, 2850), 'U': (380, 950, 2700)}


def voice(segs, breath=0.06, jitter=0.012, tilt=1.5, seed=0, bw=(130, 200, 320)):
    """segs: [(dur, f0_start, f0_end, vowel_start, vowel_end, amp_start, amp_end)], dur<0 = silence.
    Returns mono signal."""
    r = np.random.default_rng(seed)
    f0s, Fs, amps = [], [], []
    for dur, fa, fb, va, vb, aa, ab in segs:
        n = int(abs(dur) * SR)
        u = np.linspace(0, 1, n)
        us = u * u * (3 - 2 * u)
        f0s.append(fa * (fb / fa) ** us)
        A, B = np.array(VOW[va], float), np.array(VOW[vb], float)
        Fs.append(A[None, :] + (B - A)[None, :] * us[:, None])
        amps.append((aa + (ab - aa) * u) * (0.0 if dur < 0 else 1.0))
    f0 = np.concatenate(f0s)
    F = np.concatenate(Fs)
    amp = np.concatenate(amps)
    n = len(f0)
    # smooth the control signals (articulators and the larynx can't jump)
    k = int(0.022 * SR)
    win = np.hanning(k * 2 + 1)
    win /= win.sum()
    sm = lambda x: np.convolve(np.pad(x, k, mode='edge'), win, mode='valid')
    amp = sm(amp)
    f0 = sm(f0)
    F = np.stack([sm(F[:, i]) for i in range(3)], axis=1)
    wob = lowpass(r.standard_normal(n), 14.0) * 14.0
    t = np.arange(n) / SR
    f0 = f0 * (1 + jitter * wob + 0.012 * np.sin(2 * np.pi * 5.3 * t + r.uniform(0, 6)))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)

    def tract(f):
        h = np.ones_like(f)
        for i in range(3):
            Fi = F[:, i]
            h = h / np.sqrt((1 - (f / Fi) ** 2) ** 2 + (f * bw[i] / Fi ** 2) ** 2)
        return h
    kmax = int(9500 / max(f0.min(), 80))
    for kk in range(1, kmax + 1):
        fk = kk * f0
        g = tract(fk) / kk ** tilt
        g = np.where(fk < 10000, g, 0.0)
        out += np.sin(kk * ph + r.uniform(0, 6.28)) * g
    # aspiration through the same (average) tract
    nz = r.standard_normal(n)
    asp = np.zeros(n)
    for i in range(3):
        fc = float(np.mean(F[:, i]))
        b, a = signal.iirpeak(fc / (SR / 2), fc / (bw[i] * 2.5))
        asp += signal.lfilter(b, a, nz) * (1.0, 0.7, 0.4)[i]
    asp *= (0.6 + 0.4 * np.sin(ph))                      # breath pulses with the glottis
    out = out / (np.abs(out).max() + 1e-9) + breath * asp / (np.abs(asp).max() + 1e-9)
    return out * amp


def breath_puff(dur, lo=700, hi=4200, seed=0):
    n = int(dur * SR)
    x = shaped_noise(n, lo, hi, -0.6, seed)
    return x * np.hanning(n) ** 1.2


def giggle(n_pulses, f_hi, f_lo, seed=0, rate=6.3):
    """A run of little 'heh-heh-heh' bursts, pitch tumbling down."""
    segs = []
    for i in range(n_pulses):
        u = i / max(n_pulses - 1, 1)
        f = f_hi * (f_lo / f_hi) ** u
        a = 0.9 * (1 - 0.45 * u)
        on = 0.085
        segs += [(on, f * 1.07, f * 0.93, 'x', 'e' if i % 2 else 'a', a, a * 0.7),
                 (-(1 / rate - on), f, f, 'x', 'x', 0, 0)]
    v = voice(segs, breath=0.22, jitter=0.03, tilt=1.2, seed=seed) * 0.8
    # breathy 'h' before each pulse
    for i in range(n_pulses):
        p = breath_puff(0.05, 1200, 6000, seed + i)
        i0 = int(i / rate * SR) - int(0.03 * SR)
        if i0 > 0:
            v[i0:i0 + len(p)] += p[:len(v) - i0] * 0.18
    return v


# ------------------------------------------------------------------ impacts
def thud(f=150, dur=0.12, bright=0.0, seed=0, body=1.0, click=0.3):
    """Soft body hitting a surface: pitch-dropping thump + filtered noise slap."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 0.9 * np.exp(-t / 0.012))
    th = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / (dur * 0.28)) * body
    slap = shaped_noise(n, 500 + 900 * bright, 2500 + 5500 * bright, -0.4, seed) * exp_env(n, 0.006 + 0.012 * (1 - bright))
    return th + slap * click * (0.6 + bright)


def modal(freqs, decays, amps, dur, seed=0, strike=0.002):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    r = np.random.default_rng(seed)
    for f, d, a in zip(freqs, decays, amps):
        x += a * np.sin(2 * np.pi * f * t + r.uniform(0, 6.28)) * np.exp(-t / d)
    return x * np.minimum(t / strike, 1.0)


def add(*sigs):
    n = max(len(x) for x in sigs)
    out = np.zeros(n)
    for x in sigs:
        out[:len(x)] += x
    return out


def build():
    mx = Mix()
    cut = TL.CUT

    # ============================================================ room tone & the world outside
    air = shaped_noise(N, 40, 9000, -1.0, 1)
    mx.dry[:, 0] += air * 0.010
    mx.dry[:, 1] += np.roll(air, 7919) * 0.010
    city = lowpass(shaped_noise(N, 30, 600, -1.2, 2), 320) * (0.75 + 0.25 * np.sin(2 * np.pi * T / 9.0))
    mx.bed(city, lambda t: (0.0, -2.7, 1.2), gain=0.085, d0=2.5, send=0.3)
    # a few sparrows somewhere beyond the glass
    for tb, base in ((2.3, 3900), (2.62, 4300), (8.7, 3600), (9.0, 4100), (9.22, 3800), (16.3, 4200), (16.55, 3700)):
        n = int(0.11 * SR)
        t = np.arange(n) / SR
        ch = np.sin(2 * np.pi * (base * t + 1400 * t * t * (1 if base > 3800 else -1) * 4)) * np.hanning(n)
        mx.event(lowpass(ch, 5200), tb, (rng.uniform(-3, 3), -6.0, 3.0), gain=0.12, d0=2.0, send=0.25)
    # fridge compressor hum
    hum = sum(a * np.sin(2 * np.pi * f * T + p) for f, a, p in ((60, 1.0, 0), (120, 0.55, 1.0), (180, 0.22, 2.1), (240, 0.1, 0.4)))
    hum = hum * (0.9 + 0.1 * np.sin(2 * np.pi * 0.31 * T)) + shaped_noise(N, 200, 1500, -1.0, 3) * 0.12
    mx.bed(hum, lambda t: (1.95, 4.0, 0.8), gain=0.035, d0=1.2, send=0.3)

    # ============================================================ washing machine
    rev = 0.85
    drone = sum(a * np.sin(2 * np.pi * f * T + p) for f, a, p in ((49, 1.0, 0), (98, 0.6, 0.3), (147, 0.25, 1.2), (331, 0.07, 2.2), (414, 0.05, 0.7)))
    slosh = shaped_noise(N, 250, 2600, -0.9, 4) * (0.45 + 0.55 * np.maximum(0, np.sin(2 * np.pi * rev * 3 * T)) ** 2)
    tumble = np.zeros(N)
    r2 = np.random.default_rng(8)
    for k in range(int(TL.T_TOTAL * rev * 3)):               # wet cloth flopping off each lifter
        tt = (k + r2.uniform(-0.08, 0.08)) / (rev * 3)
        i0 = int(tt * SR)
        s = thud(70 + r2.uniform(-10, 20), 0.16, 0.05, 100 + k, click=0.15) * r2.uniform(0.5, 1.0)
        if 0 <= i0 < N - len(s):
            tumble[i0:i0 + len(s)] += s
    washer = drone * 0.33 + slosh * 0.5 + tumble * 0.6
    mx.bed(washer, lambda t: (TL.WASHER_DOOR[0], 4.05, 0.47), gain=0.21, d0=0.5, send=0.35, far_lp=500)

    # ============================================================ mum at the sink (before she comes over)
    tap = shaped_noise(N, 900, 9000, -0.5, 5) * (0.8 + 0.2 * lowpass(rng.standard_normal(N), 6) * 3)
    tap_env = np.clip((T - 0.0) / 0.5, 0, 1) * (1 - np.clip((T - 25.55) / 0.25, 0, 1))
    tap_env *= 1 - 0.75 * ((T > 5.2) & (T < 12.8))          # she turns it down for a while
    tap_env = lowpass(tap_env, 3.0)
    mx.bed(tap * tap_env, lambda t: (0.4, 4.25, 0.95), gain=0.11, d0=0.9, send=0.5, far_lp=1800)
    for tb, f in ((1.9, 2300), (6.9, 2900), (7.15, 2500), (12.9, 3100), (20.4, 2700), (22.6, 2350), (22.85, 3000), (25.75, 1900)):
        clink = modal([f, f * 2.32, f * 3.71, f * 5.3], [0.09, 0.06, 0.04, 0.02], [1, 0.6, 0.35, 0.2], 0.4, int(tb * 10))
        mx.event(clink, tb, (0.45 + rng.uniform(-0.2, 0.2), 4.25, 0.95), gain=0.20, d0=0.9, send=0.9)
    # footsteps in socks
    for t0, t1, ff, tgt, _ in TL.MOM_STEPS:
        s = add(thud(88, 0.2, 0.08, int(t1 * 100), body=1.0, click=0.22), breath_puff(0.12, 1500, 5000, int(t1 * 7)) * 0.05)
        mx.event(s, t1 - 0.03, (tgt[0], tgt[1], 0.0), gain=0.85, d0=0.7, send=0.7)
        sw = breath_puff(0.3, 2500, 7000, int(t0 * 13)) * 0.035                       # trouser legs brushing
        mx.event(sw, t0 + 0.05, (tgt[0], tgt[1], 0.5), gain=0.8, d0=0.7, send=0.4)
    # her voice: wordless, sing-song hums
    def mom(t, segs, gain=0.5, seed=0):
        h = TL.mom_head(t)
        v = voice(segs, breath=0.10, jitter=0.008, tilt=2.15, seed=seed, bw=(110, 160, 260))
        mx.event(lowpass(v, 4200), t, h, gain=gain, d0=0.9, send=1.1)
    mom(28.9, [(0.16, 235, 247, 'M', 'M', 0.0, 0.8), (0.42, 247, 335, 'M', 'M', 0.8, 0.5), (0.1, 335, 330, 'M', 'M', 0.5, 0)], 0.42, 1)
    mom(32.35, [(0.11, 310, 290, 'M', 'M', 0.7, 0.6), (-0.07, 290, 290, 'M', 'M', 0, 0), (0.12, 285, 262, 'M', 'M', 0.7, 0.5),
                (-0.07, 262, 262, 'M', 'M', 0, 0), (0.16, 262, 240, 'M', 'M', 0.6, 0.0)], 0.38, 2)
    mom(34.15, [(0.26, 294, 294, 'M', 'M', 0.2, 0.8), (0.24, 330, 330, 'M', 'U', 0.8, 0.8), (0.55, 392, 330, 'U', 'A', 0.85, 0.6),
                (0.3, 330, 294, 'A', 'M', 0.6, 0.0)], 0.46, 3)
    mom(36.25, [(0.2, 262, 294, 'M', 'U', 0.3, 0.8), (0.45, 294, 415, 'U', 'A', 0.8, 0.9), (0.4, 415, 370, 'A', 'A', 0.9, 0.0)], 0.5, 4)
    # clothes rustle as she crouches
    mx.event(breath_puff(1.2, 1800, 7500, 77) * 0.08, 33.5, (-1.4, 3.5, 0.6), gain=1.0, d0=0.8, send=0.5)

    # ============================================================ robot vacuum
    def robot_pos(t):
        if t >= cut:
            return (1.4, -0.6, 0.05)
        x, y, h, _ = TL.robot_state(t)
        return (x, y, 0.05)
    spd = ctrl(lambda t: 0.0 if t < TL.ROBOT_T0 else min(1.0, (t - TL.ROBOT_T0) / 0.7))
    turning = ctrl(lambda t: 1.0 if TL.T_BUMP < t < TL.T_BUMP + 1.2 else 0.0)
    turning = lowpass(turning, 4)
    fan_f = 196 * (0.25 + 0.75 * spd) * (1 - 0.06 * turning)
    ph = 2 * np.pi * np.cumsum(fan_f) / SR
    whir = sum(a * np.sin(k * ph + k) for k, a in ((1, 0.8), (2, 0.5), (3, 0.3), (4.02, 0.2), (6.03, 0.12), (9.1, 0.07)))
    suck = shaped_noise(N, 300, 7000, -0.55, 6) * (0.85 + 0.15 * np.sin(2 * np.pi * 43 * T))
    brush = np.sign(np.sin(2 * np.pi * 2.6 * 3 * T)) * 0.0 + bandpass(shaped_noise(N, 100, 900, 0, 7), 150, 600) * (0.6 + 0.4 * np.sin(2 * np.pi * 7.8 * T))
    robot = (whir * 0.33 + suck * 0.6 + brush * 0.25) * spd
    mx.bed(robot, robot_pos, gain=0.26, d0=0.75, send=0.45, far_lp=900)
    for i, f in enumerate((880, 1175)):                                             # "starting cleaning" chirp
        n = int(0.13 * SR)
        t = np.arange(n) / SR
        beep = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.hanning(n)
        mx.event(beep, TL.ROBOT_T0 - 0.42 + i * 0.16, (TL.ROBOT_DOCK_X, TL.ROBOT_Y, 0.1), gain=0.22, d0=1.2, send=0.8)
    bx = (TL.ROBOT_BUMP_X + 0.2, TL.ROBOT_Y, 0.05)
    mx.event(add(thud(210, 0.09, 0.5, 31, click=0.7), modal([640, 1310, 2050], [0.05, 0.03, 0.02], [1, 0.5, 0.3], 0.2, 32) * 0.6),
             TL.T_BUMP, bx, gain=0.6, d0=0.8, send=0.7)

    # ============================================================ ball
    def ball_pos(t):
        return TL.ball_state(t)[0]
    bs = ctrl(lambda t: TL.ball_state(t)[3])
    on_mat = ctrl(lambda t: 1.0 if TL.ball_state(t)[0][2] > TL.BALL_R + 0.02 else 0.0)
    roll = shaped_noise(N, 120, 1500, -0.8, 9) * (0.7 + 0.3 * lowpass(rng.standard_normal(N), 30) * 4)
    roll = roll * (bs / 0.75) ** 0.8 * (0.35 + 0.65 * (1 - on_mat))
    mx.bed(roll, ball_pos, gain=0.33, d0=0.6, send=0.4)
    # the little beads inside
    beads = np.zeros(N)
    r3 = np.random.default_rng(21)
    tt = 0.0
    while tt < TL.T_TOTAL:
        sp = TL.ball_state(tt)[3]
        if sp > 0.02:
            tt += r3.exponential(0.035 / (sp + 0.1))
            f = r3.uniform(3200, 6500)
            s = modal([f, f * 1.47], [0.012, 0.008], [1, 0.5], 0.05, int(tt * 1000)) * r3.uniform(0.3, 1.0) * min(1.0, sp * 2.2)
            i0 = int(tt * SR)
            if i0 < N - len(s):
                beads[i0:i0 + len(s)] += s
        else:
            tt += 0.02
    mx.bed(beads, ball_pos, gain=0.30, d0=0.6, send=0.5)
    tok = lambda seed: add(modal([520, 790, 1480, 2300], [0.035, 0.03, 0.02, 0.012], [1, 0.7, 0.4, 0.25], 0.2, seed), thud(180, 0.07, 0.5, seed, click=0.5) * 0.5)
    mx.event(tok(1), TL.T_BAT, (TL.BALL0[0], TL.BALL0[1], 0.09), gain=0.55, d0=0.5, send=0.5)
    te = TL._T_EDGE + 0.09
    for i, (dt, g) in enumerate(((0, 0.5), (0.11, 0.25), (0.2, 0.12))):
        mx.event(tok(5 + i), te + dt, ball_pos(te + dt), gain=g, d0=0.7, send=0.7)
    mx.event(tok(9), TL.T_BUMP + 0.01, ball_pos(TL.T_BUMP), gain=0.4, d0=0.8, send=0.7)

    # ============================================================ the baby: hands, clothes, breath, voice
    r4 = np.random.default_rng(5)
    for tp, kind, pos, amp in TL.SOUNDS:
        sd = int(tp * 1000)
        if kind == 'mat':
            s = thud(105 + r4.uniform(-12, 12), 0.13, 0.08, sd, body=1.0, click=0.25)
            g = 0.50
        elif kind == 'wood':
            s = add(thud(165 + r4.uniform(-15, 20), 0.11, 0.62, sd, body=0.8, click=1.0),
                    modal([238, 415, 690], [0.05, 0.035, 0.02], [0.5, 0.3, 0.2], 0.2, sd) * 0.5)
            g = 0.62
        elif kind == 'glass':
            s = add(thud(140, 0.12, 0.3, sd, body=0.9, click=0.6), modal([410, 933, 1620, 2480], [0.11, 0.07, 0.04, 0.025],
                                                                          [0.7, 0.5, 0.3, 0.15], 0.4, sd) * 0.6)
            g = 0.7
        elif kind == 'squeak':
            n = int(0.55 * SR)
            t = np.arange(n) / SR
            f = 1500 + 500 * np.sin(2 * np.pi * 2.5 * t) - 500 * t
            sq = np.sin(2 * np.pi * np.cumsum(f) / SR) * (np.sin(2 * np.pi * 38 * t) > -0.2) * np.hanning(n)
            s = add(sq * 0.35, breath_puff(0.55, 1500, 5000, sd) * 0.25)
            g = 0.28
        elif kind == 'sock':
            s = thud(95, 0.12, 0.04, sd, body=0.7, click=0.18)
            g = 0.5
        elif kind == 'ball':
            continue
        else:
            continue
        mx.event(s, tp - 0.004, pos, gain=g * (0.55 + 0.45 * amp), d0=0.45, send=0.45)
        # sleeve / knee shuffle just before each plant
        mx.event(breath_puff(0.26, 2200, 8000, sd + 1) * 0.06, tp - 0.3, pos, gain=0.9, d0=0.45, send=0.25)

    # breathing (in through the nose, out a little open-mouthed), faster when busy
    def effort(t):
        return 0.0 + 0.5 * TL.ease(t, 4.0, 5.5) + 0.3 * TL.ease(t, 14.0, 15.0) - 0.4 * TL.ease(t, 22.5, 24.0) + 0.5 * TL.ease(t, 27.5, 29.0) \
            - 0.3 * TL.ease(t, 33.0, 35.0)
    tt = 0.35
    k = 0
    while tt < TL.T_TOTAL - 0.8:
        e = effort(tt)
        per = 1.25 / (1 + 0.55 * e)
        mx.event(breath_puff(per * 0.38, 900, 3800, 300 + k) * (0.035 + 0.03 * e), tt, None, send=0.15)
        mx.event(breath_puff(per * 0.45, 500, 2600, 400 + k) * (0.05 + 0.05 * e), tt + per * 0.45, None, send=0.15)
        tt += per
        k += 1

    def baby(t, segs, gain=0.55, seed=0, breath=0.07):
        v = voice(segs, breath=breath, jitter=0.016, tilt=1.2, seed=seed)
        mx.event(v, t, None, gain=gain * 0.78, send=0.6)
    S = lambda d: (-d, 400, 400, 'x', 'x', 0, 0)
    baby(0.95, [(0.2, 370, 425, 'x', 'u', 0.0, 0.7), (0.3, 425, 355, 'u', 'u', 0.7, 0.0)], 0.40, 1)                      # coo
    baby(3.02, [(0.07, 520, 540, 'x', 'a', 0.0, 0.9), (0.2, 540, 430, 'a', 'x', 0.9, 0.0)], 0.5, 2, breath=0.2)          # "ha!"
    baby(4.22, [(0.34, 300, 345, 'm', 'm', 0.2, 0.8), (0.12, 345, 320, 'm', 'x', 0.8, 0.0)], 0.38, 3)                    # effort grunt
    mx.event(breath_puff(0.35, 700, 3500, 55) * 0.12, 4.78, None, send=0.2)
    baby(6.85, [(0.05, 400, 420, 'm', 'a', 0.1, 0.8), (0.15, 430, 405, 'a', 'a', 0.8, 0.6), (0.06, 400, 400, 'a', 'm', 0.5, 0.05),
                (0.05, 410, 430, 'm', 'a', 0.1, 0.8), (0.22, 440, 365, 'a', 'x', 0.8, 0.0)], 0.48, 4)                    # "ba-ba"
    baby(10.95, [(0.12, 385, 400, 'o', 'o', 0.0, 0.7), (0.28, 400, 565, 'o', 'u', 0.7, 0.0)], 0.48, 5)                   # "oh?"
    baby(13.1, [(0.2, 415, 455, 'a', 'a', 0.0, 0.6), (0.4, 455, 395, 'a', 'x', 0.6, 0.0)], 0.42, 6)                      # "aah"
    baby(14.72, [(0.14, 600, 820, 'a', 'a', 0.0, 0.9), (0.26, 820, 900, 'a', 'e', 0.9, 0.85), (0.24, 900, 720, 'e', 'x', 0.85, 0.0)], 0.6, 7,
         breath=0.12)                                                                                                    # squeal
    baby(15.42, [(0.06, 560, 580, 'x', 'a', 0.0, 0.8), (0.18, 580, 470, 'a', 'x', 0.8, 0.0)], 0.5, 8, breath=0.18)
    baby(17.62, [(0.2, 420, 380, 'x', 'x', 0.5, 0.0)], 0.36, 9)
    mx.event(breath_puff(0.25, 800, 3500, 56) * 0.11, 19.3, None, send=0.2)
    baby(21.95, [(0.18, 400, 470, 'u', 'u', 0.0, 0.7), (0.4, 470, 425, 'u', 'o', 0.7, 0.0)], 0.46, 10)                   # "ooh"
    baby(24.4, [(0.05, 500, 520, 'x', 'a', 0.0, 0.8), (0.17, 520, 440, 'a', 'x', 0.8, 0.0)], 0.48, 11, breath=0.15)
    baby(25.0, [(0.15, 480, 455, 'a', 'a', 0.75, 0.3), S(0.07), (0.22, 500, 410, 'a', 'x', 0.8, 0.0)], 0.48, 12)        # "ah-ah"
    baby(26.55, [(0.1, 380, 400, 'm', 'm', 0.0, 0.7), (0.24, 400, 525, 'm', 'x', 0.7, 0.0)], 0.40, 13)                   # "hm?"
    for i, tb in enumerate((28.2, 28.62)):
        mx.event(breath_puff(0.22, 900, 4200, 60 + i) * 0.13, tb, None, send=0.2)
    baby(30.15, [(0.07, 440, 450, 'm', 'm', 0.5, 0.5), (0.15, 455, 440, 'a', 'a', 0.85, 0.7), (0.07, 430, 430, 'm', 'm', 0.45, 0.45),
                 (0.15, 445, 425, 'a', 'a', 0.85, 0.7), (0.07, 420, 420, 'm', 'm', 0.45, 0.45), (0.24, 430, 370, 'a', 'x', 0.85, 0.0)],
         0.52, 14)                                                                                                       # "ma-ma-ma"
    mx.event(giggle(5, 610, 470, 15), 32.05, None, gain=0.42, send=0.5)
    mx.event(giggle(4, 640, 500, 16), 32.72, None, gain=0.40, send=0.5)
    baby(34.85, [(0.14, 480, 620, 'a', 'a', 0.0, 0.85), (0.34, 620, 530, 'a', 'x', 0.85, 0.0)], 0.52, 17)                # "ah!" (up!)
    baby(36.35, [(0.14, 650, 900, 'a', 'a', 0.0, 0.9), (0.2, 900, 960, 'a', 'e', 0.9, 0.85), (0.22, 960, 780, 'e', 'x', 0.85, 0.0)], 0.55, 18,
         breath=0.12)
    mx.event(giggle(5, 700, 520, 19), 36.95, None, gain=0.40, send=0.6)

    # ============================================================ a wind-up music box on the shelf (living room)
    notes = {'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99, 'A5': 880.0, 'C6': 1046.5, 'D6': 1174.66, 'E6': 1318.5,
             'G4': 392.0, 'A4': 440.0, 'C4': 261.63, 'E4': 329.63, 'F4': 349.23}
    tune = ['E5', 'G5', 'C6', 'A5', 'G5', 'E5', 'D5', 'E5', 'G5', 'E5', 'D5', 'C5',
            'E5', 'G5', 'C6', 'D6', 'C6', 'A5', 'G5', 'A5', 'E5', 'D5', 'E5', 'C5',
            'A5', 'C6', 'E6', 'D6', 'C6', 'A5', 'G5', 'E5', 'G5', 'A5', 'G5', 'E5']
    bass = ['C4', None, None, 'F4', None, None, 'G4', None, None, 'C4', None, None]
    box = np.zeros(N)
    tt = 0.6
    step = 0.42
    for i, nm in enumerate(tune):
        slow = 1.0 + 0.25 * (i / len(tune)) ** 3                                  # the spring winds down
        f = notes[nm]
        tine = modal([f, f * 2.0, f * 5.4, f * 8.9], [1.1, 0.6, 0.12, 0.05], [1.0, 0.18, 0.12, 0.05], 2.2, i)
        i0 = int(tt * SR)
        box[i0:i0 + len(tine)] += tine[:max(0, N - i0)] * 0.9
        b = bass[i % len(bass)]
        if b:
            tine = modal([notes[b], notes[b] * 2, notes[b] * 5.4], [1.4, 0.7, 0.15], [0.8, 0.2, 0.08], 2.5, 100 + i)
            box[i0:i0 + len(tine)] += tine[:max(0, N - i0)] * 0.7
        click = shaped_noise(int(0.01 * SR), 3000, 9000, 0, 200 + i) * 0.06
        box[i0:i0 + len(click)] += click
        tt += step * slow
    mx.bed(box, lambda t: (-2.8, 1.5, 0.9), gain=0.09, d0=1.6, send=1.2, far_lp=2500)

    # ============================================================ room response
    def ir(rt60, seed):
        n = int(rt60 * 1.3 * SR)
        r = np.random.default_rng(seed)
        t = np.arange(n) / SR
        x = r.standard_normal(n) * np.exp(-6.9 * t / rt60)
        x = lowpass(x, 5200) * 0.6 + lowpass(x, 1400) * 0.9
        pre = int(0.011 * SR)
        x = np.concatenate([np.zeros(pre), x])
        for d, g in ((0.004, 0.5), (0.0075, -0.35), (0.013, 0.3), (0.021, 0.22)):          # early reflections off the floor/walls
            x[int(d * SR)] += g * 6
        return x / np.sqrt((x ** 2).sum())
    wet = np.stack([signal.fftconvolve(mx.send, ir(0.42, s))[:N] for s in (1, 2)], axis=1)
    out = mx.dry + wet * 0.55

    # the brief hush of a blink-cut, fade in, and the white-out at the end
    out *= (1 - 0.35 * np.exp(-((T - cut) / 0.12) ** 2))[:, None]
    out *= np.clip(T / 0.6, 0, 1)[:, None]
    out *= (1 - 0.92 * np.clip((T - 36.9) / 1.05, 0, 1) ** 1.5)[:, None]
    # master: tame peaks, normalise
    out = signal.lfilter(*signal.butter(2, 28 / (SR / 2), 'high'), out, axis=0)
    peak = np.percentile(np.abs(out), 99.97)
    out = np.tanh(out / peak * 1.1) / 1.1 * 0.89
    return out


if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/babypov/audio.wav'
    out = build()
    wavfile.write(path, SR, (out * 32767).astype(np.int16))
    rms = np.sqrt((out.reshape(-1, SR // 2, 2) ** 2).mean(axis=(1, 2)))
    print('wrote', path, 'peak %.3f' % np.abs(out).max(), 'rms/0.5s (dB):')
    print(' '.join('%d' % round(20 * math.log10(v + 1e-9)) for v in rms))
