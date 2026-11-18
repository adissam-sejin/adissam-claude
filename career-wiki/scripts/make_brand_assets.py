#!/usr/bin/env python3
"""파비콘·오픈그래프 이미지 생성 → sites/portfolio/brand/

사용법: python3 career-wiki/scripts/make_brand_assets.py
브랜드 톤(검정 바탕 + "아." 빨간 점 + 가는 세리프)으로 HTML을 그려 Playwright로 찍는다.
한 번 만들어 두면 build_site.py가 배포용 폴더에 복사하고 <head>에 태그를 넣는다.
"""
import glob, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sites", "portfolio", "brand")
FONTS = glob.glob("/root/.claude/skills/synced/*/adi-cardnews/assets/fonts")[0]
os.makedirs(OUT, exist_ok=True)

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

HEAD = f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Italiana&display=block">
<style>
@font-face{{font-family:Free;src:url(file://{FONTS}/Freesentation-4Regular.woff2);font-weight:400}}
@font-face{{font-family:Free;src:url(file://{FONTS}/Freesentation-7Bold.woff2);font-weight:700}}
@font-face{{font-family:Free;src:url(file://{FONTS}/Freesentation-9Black.woff2);font-weight:900}}
*{{margin:0;box-sizing:border-box}}
html,body{{background:#161515;color:#F2EFEA;font-family:Free,sans-serif;overflow:hidden}}
.serif{{font-family:Italiana,serif;font-weight:400}}
.red{{color:#E1251A}}
.grain::after{{content:"";position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.08;pointer-events:none}}
</style></head><body>"""

OG = HEAD + """
<div class="grain" style="position:relative;width:1200px;height:630px;padding:44px 64px;display:grid;grid-template-rows:auto 1fr auto">
  <div style="display:flex;justify-content:space-between;font-size:15px;letter-spacing:.24em;color:#9C968F;line-height:1.5">
    <span>PORTFOLIO<br>VOL. 01</span><span style="text-align:right">DESIGN SINCE<br>2000</span>
  </div>
  <div style="display:grid;justify-items:center;align-content:center;text-align:center">
    <p class="serif" style="font-size:22px;letter-spacing:.22em;color:#9C968F">AI BRANDING EDUCATOR &amp; DESIGNER</p>
    <h1 style="display:grid;justify-items:center;line-height:.82;margin-top:14px">
      <b style="font-weight:900;font-size:200px;letter-spacing:-.05em">아는<span class="red">.</span></b>
      <i class="serif" style="font-style:normal;font-size:124px;letter-spacing:.02em;margin-top:6px">Designer</i>
    </h1>
    <p style="font-size:20px;letter-spacing:.3em;color:#9C968F;margin-top:20px">김세진 · KIM SEJIN</p>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:end;border-top:1px solid rgba(242,239,234,.18);padding-top:16px;font-size:17px;color:#9C968F;letter-spacing:.06em">
    <span>디자인 25년 · 생성형 AI 교육 · AI 강사 양성</span>
    <span style="color:#F2EFEA;letter-spacing:.14em">ADIDESIGNER.NETLIFY.APP</span>
  </div>
</div></body></html>"""

ICON = HEAD + """
<div style="width:512px;height:512px;background:#161515;display:grid;place-items:center;position:relative" class="grain">
  <b style="font-weight:900;font-size:380px;letter-spacing:-.06em;line-height:1;margin-top:-18px;margin-left:30px">아<span class="red">.</span></b>
</div></body></html>"""

js = f"""
const {{chromium}}=require('playwright');
(async()=>{{
  const b=await chromium.launch();
  async function shot(html,w,h,path){{
    const p=await b.newPage({{viewport:{{width:w,height:h}},deviceScaleFactor:1}});
    const f=require('path').join(require('os').tmpdir(),'adi_'+Date.now()+'.html');
    require('fs').writeFileSync(f,html);
    await p.goto('file://'+f,{{waitUntil:'networkidle'}});
    await p.evaluate(()=>document.fonts.ready);
    console.log(path.split('/').pop(), await p.evaluate(()=>[...document.fonts].filter(x=>x.status==='loaded').map(x=>x.family+x.weight).join(',')));
    await p.screenshot({{path,clip:{{x:0,y:0,width:w,height:h}}}});
    await p.close();
  }}
  await shot({json.dumps(OG)},1200,630,{json.dumps(OUT + '/og.png')});
  await shot({json.dumps(ICON)},512,512,{json.dumps(OUT + '/icon-512.png')});
  await b.close();
}})();
"""
subprocess.run(["node", "-e", js], check=True, cwd="/tmp")

from PIL import Image
big = Image.open(os.path.join(OUT, "icon-512.png")).convert("RGB")
for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (32, "favicon-32.png"), (16, "favicon-16.png")]:
    big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))
big.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
json.dump({"name": "아는디자이너 김세진", "short_name": "아는디자이너",
           "icons": [{"src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png"}],
           "theme_color": "#161515", "background_color": "#161515", "display": "standalone"},
          open(os.path.join(OUT, "site.webmanifest"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok:", sorted(os.listdir(OUT)))
