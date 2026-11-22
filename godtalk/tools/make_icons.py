"""캐릭터 그림 한 장으로 앱 아이콘·프로필·파비콘을 만듭니다.
   python3 tools/make_icons.py design/character/c1.png
"""
import sys, os
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGB")
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
w, h = src.size
# 얼굴이 더 크게 보이도록 위쪽 가운데를 살짝 당겨 자릅니다
face = src.crop((int(w * .09), int(h * .07), int(w * .91), int(h * .89)))

def save(im, size, name):
    im.resize((size, size), Image.LANCZOS).save(os.path.join(out, name), optimize=True)

save(face, 512, "icons/icon-512.png")
save(face, 192, "icons/icon-192.png")
save(face, 180, "icons/apple-touch-icon.png")
save(src, 512, "icons/icon-maskable-512.png")   # 가장자리가 잘려도 얼굴이 남도록 전체 그림
save(face, 192, "icons/avatar.png")              # 대화창 프로필
face.resize((64, 64), Image.LANCZOS).save(os.path.join(out, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
print("icons written")
