#!/usr/bin/env python3
"""Download generated section images and make small JPG previews for visual QA.

Usage:
    python3 fetch_and_preview.py <save_dir> <preview_dir> "name1.png=URL1" "name2.png=URL2" ...

- Saves each original PNG into <save_dir>/<name>.
- Writes an 880px-wide JPG preview into <preview_dir>/<name stem>.jpg so it can be
  opened with the Read tool without loading a huge image.
"""
import sys
import urllib.request
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    save_dir = Path(sys.argv[1])
    preview_dir = Path(sys.argv[2])
    save_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    for pair in sys.argv[3:]:
        if "=" not in pair:
            print(f"skip (expected name=url): {pair}")
            continue
        name, url = pair.split("=", 1)
        dest = save_dir / name
        urllib.request.urlretrieve(url, dest)
        im = Image.open(dest).convert("RGB")
        w = 880
        h = round(im.height * w / im.width)
        prev = preview_dir / (Path(name).stem + ".jpg")
        im.resize((w, h)).save(prev, quality=85)
        print(f"{dest}  ({im.width}x{im.height})  preview: {prev}")


if __name__ == "__main__":
    main()
