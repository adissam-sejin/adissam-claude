#!/usr/bin/env python3
"""Assemble section images into one long detail-page preview.

Usage:
    python3 assemble_page.py <out_dir> <section1.png> <section2.png> ... [--width 720] [--name 상세페이지_전체.jpg]

- Copies sections in the given order to <out_dir>/전체순서/NN_<name>.png
  (leading "NN_" prefixes in the source file name is stripped so numbering is clean).
- Stacks them vertically (each resized to --width, keeping aspect ratio) and saves
  <out_dir>/<name>. Upload tools often cap images at 8000px tall; the full file is
  kept on disk regardless.
"""
import re
import shutil
import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    args = sys.argv[1:]
    width = 720
    name = "상세페이지_전체.jpg"
    if "--width" in args:
        i = args.index("--width"); width = int(args[i + 1]); del args[i:i + 2]
    if "--name" in args:
        i = args.index("--name"); name = args[i + 1]; del args[i:i + 2]
    if len(args) < 2:
        print(__doc__)
        sys.exit(1)

    out_dir = Path(args[0])
    sections = [Path(p) for p in args[1:]]
    order_dir = out_dir / "전체순서"
    order_dir.mkdir(parents=True, exist_ok=True)

    images = []
    for n, src in enumerate(sections, 1):
        base = re.sub(r"^(\d+_)+", "", src.name)
        shutil.copy(src, order_dir / f"{n:02d}_{base}")
        im = Image.open(src).convert("RGB")
        images.append(im.resize((width, round(im.height * width / im.width))))

    total_h = sum(im.height for im in images)
    canvas = Image.new("RGB", (width, total_h), "white")
    y = 0
    for im in images:
        canvas.paste(im, (0, y)); y += im.height
    out = out_dir / name
    canvas.save(out, quality=82)
    print(f"{len(images)} sections -> {out} ({width}x{total_h})")
    print(f"ordered copies -> {order_dir}")


if __name__ == "__main__":
    main()
