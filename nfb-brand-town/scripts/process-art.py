"""힉스필드로 만든 원본 그림을 화면에서 쓰는 조각으로 가공한다.

  python3 scripts/process-art.py <원본 폴더> [public/art] [이름...]

- 방 그림: 크기를 줄여 webp 로 저장
- 로비·옥상: 파란색으로 칠해 둔 부분(차양·문·깃발)을 회색 음영으로 바꾸고, 그 자리를 알려주는 마스크를 따로 저장
  → 화면에서 회원의 브랜드 색을 곱해 칠한다
- 물건 묶음 그림(3x3 등): 낱개로 잘라 저장
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/art')
ONLY = set(sys.argv[3:])  # 이름을 주면 그것만 다시 만든다

ROOMS = ['lobby', 'classroom', 'library', 'blog', 'instagram', 'youtube', 'threads', 'etc']
ROOM_SIZE = (1440, 576)

SHEETS = {
    # 파일 이름: (행, 열, [낱개 이름...], 저장 폴더, 긴 변 크기)
    'itemsA': (3, 3, ['plant', 'cactus', 'coffee', 'bouquet', 'basket', 'books', 'teaset', 'teddy', 'chair'], 'items', 360),
    'itemsB': (3, 3, ['lantern', 'ringlight', 'typewriter', 'mic', 'guitar', 'tree', 'sofa', 'parasol', 'camera'], 'items', 420),
    'itemsC': (3, 3, ['cat', 'dog', 'piano', 'trophy', 'gradcap', 'floorlamp', 'globe', 'bookcase', 'recordplayer'], 'items', 420),
    'itemsD': (3, 3, ['calendar', 'frame', 'windchime', 'clock', 'map', 'mirror', 'painting', 'window', 'medal'], 'items', 320),
    'props1': (3, 3, ['tree_round', 'tree_pine', 'tree_cherry', 'lamp', 'bench', 'fountain', 'flowerbed', 'noticeboard', 'mailbox'], 'town', 420),
    'props2': (3, 3, ['bridge', 'pond', 'gazebo', 'stall', 'well', 'signpost', 'bush', 'rock', 'bicycle'], 'town', 480),
    'taste1': (3, 3, ['coffee', 'tea', 'bread', 'cake', 'cooking', 'noodles', 'stew', 'wine', 'strawberry'], 'taste', 220),
    'taste2': (3, 3, ['mandarin', 'cat', 'dog', 'bird', 'butterfly', 'flower', 'sunflower', 'sprout', 'sea'], 'taste', 220),
    'taste3': (3, 3, ['mountain', 'spring', 'autumn', 'snow', 'rain', 'nightwalk', 'morning', 'hiking', 'bicycle'], 'taste', 220),
    'taste4': (3, 3, ['yoga', 'swimming', 'golf', 'dance', 'camping', 'travel', 'fishing', 'soccer', 'baseball'], 'taste', 220),
    'taste5': (3, 3, ['reading', 'movie', 'drama', 'music', 'singing', 'radio', 'theater', 'museum', 'photo'], 'taste', 220),
    'taste6': (3, 3, ['writing', 'handwriting', 'painting', 'knitting', 'sewing', 'pottery', 'piano', 'guitar', 'candle'], 'taste', 220),
    'taste7': (3, 3, ['puzzle', 'robot', 'home', 'book', 'record', 'letter', 'scrapbook', 'memo', 'polaroid'], 'taste', 220),
    'books': (2, 5, [f'book{i}' for i in range(1, 11)], 'books', 200),
    'landmarks': (2, 2, ['school', 'library', 'museum', 'clocktower'], 'town', 640),
    # 책상·선반 위에 놓는 작은 소품
    'tableA': (3, 3, ['desklamp', 'laptop', 'pencup', 'alarmclock', 'photoframe', 'monitor', 'candle', 'snowglobe', 'radio'], 'items', 300),
    'tableB': (3, 3, ['dslr', 'deskmic', 'brushjar', 'bonsai', 'fishbowl', 'fan', 'gifts', 'hourglass', 'hangingivy'], 'items', 300),
    'mart': (1, 1, ['mart'], 'town', 640),
}

# 하늘에서 내려다본 건물(마을 지도용). 낱개로 자른 뒤 브랜드 색 칠할 자리도 함께 만든다.
TINT_SHEETS = {
    'houseA': (2, 2, ['ha1', 'ha2', 'ha3', 'ha4'], 'town', 460),
    'houseB': (2, 2, ['hb1', 'hb2', 'hb3', 'hb4'], 'town', 460),
}

# 바닥 무늬(이어 붙여 쓰는 그림): 이름 → (크기, 채도, 밝기)
TEXTURES = {'grass': (512, 0.82, 0.9), 'cobble': (512, 0.5, 1.02)}


def blue_mask(rgb: np.ndarray) -> np.ndarray:
    """선명한 파란색(색상 205~255도)인 정도를 0~1 로 돌려준다."""
    r, g, b = [rgb[..., i].astype(np.float32) / 255 for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = mx - mn
    sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    hue = np.zeros_like(mx)
    m = (mx == b) & (d > 0)
    hue[m] = 240 + 60 * (r[m] - g[m]) / d[m]
    m = (mx == g) & (d > 0)
    hue[m] = 120 + 60 * (b[m] - r[m]) / d[m]
    m = (mx == r) & (d > 0)
    hue[m] = (60 * (g[m] - b[m]) / d[m]) % 360
    near = np.clip(1 - np.abs(hue - 228) / 30, 0, 1)        # 228도에서 멀어질수록 0
    strong = np.clip((sat - 0.30) / 0.25, 0, 1)             # 채도가 낮으면(흰 반사광) 제외
    return np.clip(near * 1.6, 0, 1) * strong


def tintable(im: Image.Image, name: str, folder: Path):
    """파란 부분을 회색 음영으로 바꾼 그림과, 그 자리를 알려주는 마스크를 저장한다."""
    rgba = np.array(im.convert('RGBA'))
    rgb = rgba[..., :3]
    mask = blue_mask(rgb)
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    mask = np.array(mask_img).astype(np.float32) / 255
    value = rgb.max(axis=-1).astype(np.float32) / 255
    gray = np.clip(value / 0.92, 0, 1) * 255                # 가장 밝은 파랑이 흰색이 되게
    out = rgb.astype(np.float32) * (1 - mask[..., None]) + gray[..., None] * mask[..., None]
    rgba[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    base = Image.fromarray(rgba)
    if im.mode != 'RGBA':
        base = base.convert('RGB')
    base.save(folder / f'{name}.webp', quality=88, method=4)
    m = np.zeros((*mask.shape, 4), np.uint8)
    m[..., :3] = 255
    m[..., 3] = (mask * rgba[..., 3] / 255 * 255).astype(np.uint8)
    mimg = Image.fromarray(m)
    mimg.save(folder / f'{name}_mask.webp', lossless=True, method=4)
    small(base, folder, name)
    small(mimg, folder, f'{name}_mask', lossless=True)
    print(f'  {name}: 색칠 영역 {mask.mean() * 100:.1f}%')


def small(im: Image.Image, folder: Path, name: str, lossless=False):
    (folder / 'sm').mkdir(exist_ok=True)
    w = 480
    sm = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
    sm.save(folder / 'sm' / f'{name}.webp', quality=82, method=4, lossless=lossless)


def bands(profile: np.ndarray, want: int):
    """투명한 띠로 나뉜 구간을 찾고, 원하는 개수보다 많으면 가까운 것끼리 합친다."""
    on = profile > 0
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        if not v and start is not None:
            segs.append([start, i])
            start = None
    if start is not None:
        segs.append([start, len(on)])
    segs = [s for s in segs if s[1] - s[0] > 6]
    while len(segs) > want:
        gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
        i = int(np.argmin(gaps))
        segs[i] = [segs[i][0], segs[i + 1][1]]
        del segs[i + 1]
    return segs


def save_cell(im, box, name, folder, size, tint):
    cell = im.crop(box)
    # 투명한 테두리를 잘라낸다 (투명한 곳에도 색 값이 남아 있을 수 있어 투명도만 보고 자른다)
    cell = cell.crop(cell.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    scale = min(1, size / max(cell.size))
    cell = cell.resize((max(1, round(cell.size[0] * scale)), max(1, round(cell.size[1] * scale))), Image.LANCZOS)
    if tint:
        tintable(cell, name, folder)
    else:
        cell.save(folder / f'{name}.webp', quality=90, method=4)


def split_sheet(path: Path, rows: int, cols: int, names, folder: Path, size: int, tint=False):
    im = Image.open(path).convert('RGBA')
    alpha = np.array(im)[..., 3]
    # 옅은 그림자가 줄 사이를 잇는 경우가 있어, 점점 또렷한 부분만 보며 다시 나눠 본다.
    for cut in (24, 90, 170, 230):
        a = alpha > cut
        # 1) 가로 줄을 먼저 나누고 그 안에서 칸을 나눈다
        row_segs = bands(a.sum(axis=1), rows)
        if len(row_segs) == rows:
            cells = [bands(a[y0:y1].sum(axis=0), cols) for y0, y1 in row_segs]
            if all(len(c) == cols for c in cells):
                for r, (y0, y1) in enumerate(row_segs):
                    for c, (x0, x1) in enumerate(cells[r]):
                        save_cell(im, (x0, y0, x1, y1), names[r * cols + c], folder, size, tint)
                print(f'  {path.name}: {rows * cols}개')
                return
        # 2) 위아래 물건이 겹쳐 보이면, 세로 줄을 먼저 나눈다
        col_segs = bands(a.sum(axis=0), cols)
        if len(col_segs) == cols:
            cells = [bands(a[:, x0:x1].sum(axis=1), rows) for x0, x1 in col_segs]
            if all(len(c) == rows for c in cells):
                for c, (x0, x1) in enumerate(col_segs):
                    for r, (y0, y1) in enumerate(cells[c]):
                        save_cell(im, (x0, y0, x1, y1), names[r * cols + c], folder, size, tint)
                print(f'  {path.name}: {rows * cols}개 (세로 줄 기준)')
                return
    print(f'  !! {path.name}: 낱개로 나누지 못했어요')


def main():
    (OUT / 'rooms').mkdir(parents=True, exist_ok=True)
    print('방')
    for name in ROOMS:
        p = RAW / f'{name}.png'
        if not p.exists() or (ONLY and name not in ONLY):
            continue
        im = Image.open(p).convert('RGB').resize(ROOM_SIZE, Image.LANCZOS)
        if name == 'lobby':
            tintable(im, name, OUT / 'rooms')
        else:
            im.save(OUT / 'rooms' / f'{name}.webp', quality=86, method=4)
            small(im, OUT / 'rooms', name)
            print(f'  {name}')
    p = RAW / 'rooftop.png'
    if p.exists() and (not ONLY or 'rooftop' in ONLY):
        im = Image.open(p).convert('RGBA')
        # 옅은 그림자까지 포함하면 아래에 빈 틈이 생기므로, 또렷한 부분만 기준으로 자른다.
        solid = np.array(im)[..., 3] > 120
        ys, xs = np.where(solid)
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        w = 1440
        im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        tintable(im, 'rooftop', OUT / 'rooms')
        print(f'  rooftop 크기 {im.size}')
    print('물건')
    for sheet, (rows, cols, names, folder, size) in SHEETS.items():
        p = RAW / f'{sheet}.png'
        if not p.exists() or (ONLY and sheet not in ONLY):
            continue
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        split_sheet(p, rows, cols, names, OUT / folder, size)
    for sheet, (rows, cols, names, folder, size) in TINT_SHEETS.items():
        p = RAW / f'{sheet}.png'
        if not p.exists() or (ONLY and sheet not in ONLY):
            continue
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        split_sheet(p, rows, cols, names, OUT / folder, size, tint=True)
    from PIL import ImageEnhance
    for name, (size, sat, bright) in TEXTURES.items():
        p = RAW / f'{name}.png'
        if not p.exists() or (ONLY and name not in ONLY):
            continue
        im = Image.open(p).convert('RGB').resize((size, size), Image.LANCZOS)
        im = ImageEnhance.Brightness(ImageEnhance.Color(im).enhance(sat)).enhance(bright)
        im.save(OUT / 'town' / f'{name}.webp', quality=82, method=4)
        print(f'  바닥 무늬 {name}')


main()
