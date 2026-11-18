"""Camera/eye response: linear EXR frames -> graded, bloomed, blinking frames -> H.264."""
import os, sys, math, argparse, subprocess
import numpy as np
import cv2
import OpenEXR
import timeline as TL


def read_exr(path):
    with OpenEXR.File(path) as f:
        ch = f.channels()
        if 'RGB' in ch:
            return np.ascontiguousarray(ch['RGB'].pixels[..., :3], dtype=np.float32)
        if 'RGBA' in ch:
            return np.ascontiguousarray(ch['RGBA'].pixels[..., :3], dtype=np.float32)
        return np.stack([ch[c].pixels for c in 'RGB'], axis=-1).astype(np.float32)


def luminance(img):
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def metering(img):
    """Centre-weighted log-average luminance (what a phone camera / an iris reacts to)."""
    h, w = img.shape[:2]
    small = cv2.resize(img, (96, 54), interpolation=cv2.INTER_AREA)
    lum = np.clip(luminance(small), 1e-4, 50.0)
    yy, xx = np.mgrid[0:54, 0:96]
    wgt = np.exp(-(((xx - 48) / 60.0) ** 2 + ((yy - 30) / 34.0) ** 2))
    return float(np.exp((np.log(lum) * wgt).sum() / wgt.sum()))


def tonemap(x):
    """Filmic curve (ACES-like fit) with a gentle highlight desaturation."""
    lum = luminance(x)[..., None]
    k = np.clip((lum - 0.8) / 6.0, 0, 1) * 0.55
    x = x * (1 - k) + lum * k
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    y = (x * (a * x + b)) / (x * (c * x + d) + e)
    return np.clip(y, 0, 1)


def srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.maximum(x, 1e-8), 1 / 2.4) - 0.055)


def bloom(img, strength=0.11):
    h, w = img.shape[:2]
    bright = np.clip(img - 1.0, 0, 60.0)
    acc = np.zeros_like(img)
    for i, (s, wt) in enumerate(((0.006, 0.42), (0.02, 0.33), (0.06, 0.25))):
        sc = max(1, int(2 ** (i + 1)))
        small = cv2.resize(bright, (w // sc, h // sc), interpolation=cv2.INTER_AREA)
        sig = s * w / sc
        small = cv2.GaussianBlur(small, (0, 0), sig)
        acc += cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR) * wt
    halo = cv2.GaussianBlur(cv2.resize(img, (w // 4, h // 4), interpolation=cv2.INTER_AREA), (0, 0), w / 4 * 0.035)
    halo = cv2.resize(halo, (w, h), interpolation=cv2.INTER_LINEAR)
    return img * 0.955 + halo * 0.045 + acc * strength


_maps = {}


def lens_maps(w, h, k1=-0.045, ca=0.0016):
    key = (w, h)
    if key not in _maps:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cx, cy = (w - 1) / 2, (h - 1) / 2
        nx, ny = (xx - cx) / cx, (yy - cy) / cx
        r2 = nx * nx + ny * ny
        out = []
        for chs in (-ca, 0.0, ca):
            f = (1 + k1 * r2) * (1 + chs * r2) / (1 + k1 * (1 + (cy / cx) ** 2) * 0.86)
            out.append(((nx * f * cx + cx).astype(np.float32), (ny * f * cx + cy).astype(np.float32)))
        vig = 1 - 0.30 * np.clip(r2 / (1 + (cy / cx) ** 2), 0, 1) ** 1.3
        _maps[key] = (out, vig.astype(np.float32)[..., None])
    return _maps[key]


def eyelids(w, h, close):
    """Mask (1 = open) for a blink: upper lid sweeps down, lower lid rises a little."""
    if close <= 0:
        return None
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2)
    ny = yy / h
    upper = close * 0.80 + 0.16 * close * (nx * nx) - 0.10 * (1 - close) * (1 - nx * nx)
    lower = 1 - close * 0.26 - 0.10 * close * (nx * nx) + 0.10 * (1 - close)
    soft = 0.05 + 0.05 * close
    m = np.clip((ny - upper) / soft, 0, 1) * np.clip((lower - ny) / soft, 0, 1)
    m = m * m * (3 - 2 * m)
    return m[..., None]


def blink_amount(t):
    c = 0.0
    for tb, kind in TL.BLINKS:
        dt = t - tb
        if kind == 'blink':
            if -0.11 < dt <= 0:
                c = max(c, 1 - (-dt / 0.11) ** 1.5)
            elif 0 < dt < 0.09:
                c = max(c, 1.0)
            elif 0.09 <= dt < 0.30:
                c = max(c, 1 - ((dt - 0.09) / 0.21) ** 0.7)
        else:  # blink-cut: fully closed over the cut
            if -0.15 < dt <= -0.05:
                c = max(c, 1 - ((-dt - 0.05) / 0.10) ** 1.5)
            elif -0.05 < dt < 0.12:
                c = max(c, 1.0)
            elif 0.12 <= dt < 0.42:
                c = max(c, 1 - ((dt - 0.12) / 0.30) ** 0.7)
    return c


def grade(img, t, exposure, rng, out_size):
    w, h = out_size
    x = img * exposure
    x = bloom(x)
    x = tonemap(x * 0.92)
    x = srgb(x)
    # warm home-video grade: lifted blacks, soft contrast, a little extra saturation
    x = x * np.array([1.0, 0.985, 0.955], dtype=np.float32)[None, None, :] if False else x
    lum = luminance(x)[..., None]
    x = lum + (x - lum) * 1.08
    x = np.clip(0.018 + x * 0.985, 0, 1)
    x = x.astype(np.float32)
    if (x.shape[1], x.shape[0]) != (w, h):
        x = cv2.resize(x, (w, h), interpolation=cv2.INTER_LANCZOS4)
        blur = cv2.GaussianBlur(x, (0, 0), 1.2)
        x = np.clip(x + (x - blur) * 0.35, 0, 1)
    maps, vig = lens_maps(w, h)
    x = np.stack([cv2.remap(x[..., i], maps[i][0], maps[i][1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT) for i in range(3)], axis=-1)
    x = x * vig
    # sensor grain (luma-weighted, stronger in the shadows)
    g = rng.standard_normal((h // 2 + 1, w // 2 + 1)).astype(np.float32)
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LINEAR) * 0.6 + rng.standard_normal((h, w)).astype(np.float32) * 0.5
    lum = luminance(x)
    x = x + (g * (0.022 - 0.012 * lum))[..., None]
    # blinks
    m = eyelids(w, h, blink_amount(t))
    if m is not None:
        lid = np.array([0.045, 0.022, 0.016], dtype=np.float32)
        x = x * m + lid * (1 - m)
    # fade in from sleep-dark, fade out to white as mum lifts the baby
    fin = TL.ease(t, 0.0, 0.7)
    x = x * fin
    fo = TL.ease(t, 36.45, 37.55)
    if fo > 0:
        x = x + (np.array([1.0, 0.985, 0.95], dtype=np.float32) - x) * fo
    return np.clip(x, 0, 1)


class Exposure:
    """Slowly adapting auto exposure + partial auto white balance, like an iris / a phone camera."""

    def __init__(self, key=0.21, tau=0.55, comp=0.72, awb=0.42):
        self.key, self.tau, self.comp, self.awb, self.state, self.wb = key, tau, comp, awb, None, None

    def step(self, img, dt, reset=False):
        m = metering(img)
        small = cv2.resize(img, (96, 54), interpolation=cv2.INTER_AREA)
        small = np.clip(small, 0, 4.0 * max(m, 1e-3))
        avg = small.reshape(-1, 3).mean(axis=0) + 1e-6
        avg = avg / (avg[0] * 0.2126 + avg[1] * 0.7152 + avg[2] * 0.0722)
        if self.state is None or reset:
            self.state, self.wb = m, avg
        k = 1 - math.exp(-dt / self.tau)
        self.state += (m - self.state) * k
        self.wb = self.wb + (avg - self.wb) * (1 - math.exp(-dt / 1.2))
        gain = (1.0 / self.wb) ** self.awb
        gain = gain / (gain[0] * 0.2126 + gain[1] * 0.7152 + gain[2] * 0.0722)
        return (self.key / (self.state ** self.comp * 0.20 ** (1 - self.comp))) * gain.astype(np.float32)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--exr', default='/tmp/babypov/exr')
    ap.add_argument('--out', default='/tmp/babypov/video.mp4')
    ap.add_argument('--size', default='1920x1080')
    ap.add_argument('--stills', default='')         # dir: write PNG stills for whatever frames exist instead of a video
    ap.add_argument('--audio', default='')
    ap.add_argument('--crf', default='20')
    ap.add_argument('--range', default='')          # "a-b": encode only these frames (preview of a section)
    a = ap.parse_args()
    f0, f1 = (int(v) for v in a.range.split('-')) if a.range else (0, TL.NF - 1)
    W, H = (int(v) for v in a.size.split('x'))
    rng = np.random.default_rng(3)
    exp = Exposure()
    if a.stills:
        os.makedirs(a.stills, exist_ok=True)
        for fn in sorted(os.listdir(a.exr)):
            if not fn.endswith('.exr'):
                continue
            fr = int(fn[-8:-4])
            img = read_exr(os.path.join(a.exr, fn))
            e = Exposure()
            ev = e.step(img, 1 / TL.FPS)
            x = grade(img, max(fr / TL.FPS, 1.0) if fr / TL.FPS < 36.4 else fr / TL.FPS, ev, rng, (W, H))
            cv2.imwrite(os.path.join(a.stills, fn[:-4] + '.jpg'), (x[..., ::-1] * 255 + 0.5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
            print(fr, 'meter %.3f' % e.state, ev)
        sys.exit()
    cmd = ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(TL.FPS), '-i', '-']
    if a.audio:
        cmd += ['-ss', '%.4f' % (f0 / TL.FPS), '-i', a.audio]
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', a.crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']
    if a.audio:
        cmd += ['-c:a', 'aac', '-b:a', '256k', '-shortest']
    cmd += [a.out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    cut = int(round(TL.CUT * TL.FPS))
    prev = None
    for fr in range(f0, f1 + 1):
        img = read_exr(os.path.join(a.exr, 'f%04d.exr' % fr))
        # gentle temporal denoise: lean on the previous frame only where nothing moved
        if prev is not None and fr != cut:
            la, lb = np.log1p(luminance(img)), np.log1p(luminance(prev))
            diff = cv2.GaussianBlur(np.abs(la - lb), (0, 0), 1.5)
            wgt = (0.42 * np.exp(-(diff / 0.035) ** 2))[..., None]
            img = img * (1 - wgt) + prev * wgt
        prev = img
        ev = exp.step(img, 1 / TL.FPS, reset=(fr == cut))
        x = grade(img, fr / TL.FPS, ev, rng, (W, H))
        p.stdin.write((x * 255 + 0.5).astype(np.uint8).tobytes())
        if fr % 48 == 0:
            print('post', fr, flush=True)
    p.stdin.close()
    p.wait()
