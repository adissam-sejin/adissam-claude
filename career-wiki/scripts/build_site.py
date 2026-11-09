#!/usr/bin/env python3
"""위키(wiki/) → 포트폴리오 웹사이트(sites/portfolio/) 생성.

사용법: python3 career-wiki/scripts/build_site.py
- 경험 카드·역량·프로필·대상별 이력을 읽어 index.html 한 장을 만든다.
- "(확인 필요)"가 들어간 줄은 공개 사이트에 내보내지 않는다.
- Freesentation 폰트는 페이지에 쓰인 글자만 잘라(subset) sites/portfolio/fonts/에 둔다.
"""
import html, os, re, subprocess, sys, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = os.path.join(ROOT, "wiki")
OUT = os.path.join(ROOT, "sites", "portfolio")
FONT_SRC = glob.glob("/root/.claude/skills/synced/*/adi-cardnews/assets/fonts")
TODO = "확인 필요"


def read(p):
    return open(p, encoding="utf-8").read()


def parse(path):
    t = read(path)
    meta, body = {}, t
    m = re.match(r"---\n(.*?)\n---\n(.*)", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2)
    title = re.search(r"^# (.+)$", body, re.M)
    meta["title"] = title.group(1).strip() if title else os.path.basename(path)[:-3]
    secs, cur = {}, None
    for line in body.splitlines():
        if line.startswith("## "):
            cur = line[3:].strip(); secs[cur] = []
        elif cur:
            secs[cur].append(line)
    meta["secs"] = {k: "\n".join(v).strip() for k, v in secs.items()}
    pre = body.split("## ")[0]
    meta["lead"] = "\n".join(l for l in pre.splitlines()[1:] if l.strip()).strip()
    meta["file"] = os.path.basename(path)[:-3]
    return meta


def clean(s):
    """마크다운 링크·강조 제거, 확인 필요 문구 제거."""
    if not s or TODO in s and len(re.sub(r"\(?확인 필요\)?.*", "", s).strip(" -—")) < 2:
        return ""
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\s*[—-]?\s*\(?확인 필요\)?.*$", "", s)
    return s.strip()


e = html.escape

# ---------- 데이터 ----------
cards = [parse(p) for p in sorted(glob.glob(os.path.join(W, "cards", "*.md")))]
comps = [parse(p) for p in sorted(glob.glob(os.path.join(W, "competencies", "*.md")))]
comp_by_card = {}
for c in comps:
    for f in re.findall(r"\(\.\./cards/([^)]+)\.md\)", read(os.path.join(W, "competencies", c["file"] + ".md"))):
        comp_by_card.setdefault(f, []).append(c["file"])

overview = parse(os.path.join(W, "overview.md"))
intro = clean(overview["secs"].get("강사 소개 (제안서에 바로 쓰는 문단)", "")).replace("\n", " ")
timeline_rows = [r for r in read(os.path.join(W, "profile", "경력-타임라인.md")).splitlines()
                 if r.startswith("| ") and "---" not in r and "기간" not in r]
cert_rows = [r for r in read(os.path.join(W, "profile", "자격증.md")).splitlines()
             if r.startswith("| ") and "---" not in r and "발급" not in r]
aud_rows = [r for r in read(os.path.join(W, "queries", "대상별-앞세울-이력.md")).splitlines()
            if r.startswith("| ") and "---" not in r and "앞세울" not in r]


def year_key(c):
    m = re.search(r"(\d{4})", c.get("period", ""))
    return int(m.group(1)) if m else 0


cards = [c for c in cards if clean(c["secs"].get("제안서에 쓸 한 줄", ""))]
cards.sort(key=lambda c: (-year_key(c), c["file"]))
orgs = set()
for c in cards:
    for o in re.split(r"[·,]", c.get("org", "")):
        o = o.strip()
        if o and not any(x in o for x in ("자체", "인스타", "오브북", "갓피플", "슬림", "오브디자인", "협회", "모어랭귀지스")):
            orgs.add(o)

# ---------- HTML 조각 ----------
def comp_label(f):
    return f.replace("-", " ")


chips = "".join(
    f'<button type="button" class="chip" data-f="{e(c["file"])}" aria-pressed="false">{e(comp_label(c["file"]))}</button>'
    for c in comps)

comp_blocks = "".join(
    f'<li><h3>{e(comp_label(c["file"]))}</h3><p>{e(clean(c["lead"]))}</p>'
    f'<span class="count">경험 {sum(1 for x in cards if c["file"] in comp_by_card.get(x["file"], []))}</span></li>'
    for c in comps)

card_html = []
for c in cards:
    res = clean(c["secs"].get("결과", ""))
    did = clean(c["secs"].get("한 일", ""))
    tags = comp_by_card.get(c["file"], [])
    aud = clean(c.get("audience", ""))
    card_html.append(f"""
<article class="card" data-c="{e(' '.join(tags))}">
  <div class="card-top"><span class="period">{e(clean(c.get('period','')))}</span><span class="org">{e(clean(c.get('org','')))}</span></div>
  <h3>{e(c['title'])}</h3>
  <p class="line">{e(clean(c['secs'].get('제안서에 쓸 한 줄','')))}</p>
  {f'<p class="did">{e(did)}</p>' if did else ''}
  {f'<p class="res"><b>결과</b> {e(res)}</p>' if res else ''}
  <div class="card-foot">{f'<span class="aud">{e(aud)}</span>' if aud and aud != '—' else ''}{''.join(f'<span class="tag">{e(comp_label(t))}</span>' for t in tags)}</div>
</article>""")


def cells(r):
    return [clean(x.strip()) for x in r.strip("|").split("|")]


aud_html = "".join(
    f'<li><h3>{e(a)}</h3><p>{e(m)}</p><small>{e(k)}</small></li>'
    for a, k, m in (cells(r) for r in aud_rows))
tl_html = "".join(f'<li><span>{e(p)}</span><b>{e(o)}</b></li>' for p, o, *_ in (cells(r) for r in timeline_rows))
cert_html = "".join(f'<li><b>{e(n)}</b><span>{e(o)}</span></li>' for n, o, *_ in (cells(r) for r in cert_rows))

stats = [("25", "년", "디자인 실무"), ("20", "년", "디지털 교육"),
         (str(len(orgs)), "곳+", "강의 기관"), (str(len(cert_rows)), "개", "AI·디지털 자격증")]
stat_html = "".join(f'<li><b>{n}<small>{u}</small></b><span>{l}</span></li>' for n, u, l in stats)

page = f"""<title>아는디자이너 김세진</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 레이아웃: 강의 슬라이드처럼 각진 다크 밴드(히어로) → 크림 지면 위 카드 그리드, 와인색은 강조에만 */
@font-face{{font-family:"Free";src:url(fonts/r.woff2) format("woff2");font-weight:400;font-display:swap}}
@font-face{{font-family:"Free";src:url(fonts/b.woff2) format("woff2");font-weight:700;font-display:swap}}
@font-face{{font-family:"Free";src:url(fonts/k.woff2) format("woff2");font-weight:900;font-display:swap}}
:root{{
  --ink:#2B2A2A; --paper:#F4F1EA; --wine:#8C0001; --volt:#E1251A;
  --bg:var(--paper); --fg:var(--ink); --muted:#6E6A64; --line:#CFC8BA; --surface:#FFFFFF; --accent:var(--wine);
  --band:#2B2A2A; --band-fg:#F4F1EA; --band-muted:#B5AEA4;
  --f:"Free","Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{
  --bg:#1F1E1E; --fg:#EDE8DF; --muted:#A39C92; --line:#3D3A38; --surface:#2B2A2A; --accent:#E1453A; color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#1F1E1E; --fg:#EDE8DF; --muted:#A39C92; --line:#3D3A38; --surface:#2B2A2A; --accent:#E1453A; color-scheme:dark}}
*{{box-sizing:border-box}}
body{{background:var(--bg);color:var(--fg);font-family:var(--f);font-size:16px;line-height:1.65;word-break:keep-all}}
.wrap{{max-width:1120px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}}
h1,h2,h3{{margin:0;text-wrap:balance;line-height:1.25}}
p{{margin:0}}
ul{{list-style:none;margin:0;padding:0}}
.eyebrow{{font-size:13px;font-weight:700;letter-spacing:.14em;color:var(--accent);text-transform:uppercase}}

/* 히어로 */
.hero{{background:var(--band);color:var(--band-fg)}}
.hero .wrap{{padding-block:72px 56px;display:grid;gap:28px}}
.hero .eyebrow{{color:var(--volt)}}
.hero h1{{font-size:clamp(44px,9vw,104px);font-weight:900;letter-spacing:-.03em;line-height:1}}
.hero h1 span{{display:block;font-size:.36em;font-weight:700;letter-spacing:0;color:var(--band-muted);margin-top:14px}}
.hero .intro{{max-width:40em;font-size:18px;color:var(--band-fg);opacity:.88}}
.links{{display:flex;flex-wrap:wrap;gap:10px}}
.links a{{color:var(--band-fg);text-decoration:none;border:1px solid #57524E;padding:10px 16px;font-weight:700;font-size:15px}}
.links a:hover,.links a:focus-visible{{border-color:var(--volt);color:#fff;outline:none}}
.stats{{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #4A4643;margin-top:12px}}
.stats li{{padding:22px 16px 0 0;display:grid;gap:4px}}
.stats li+li{{padding-left:20px;border-left:1px solid #4A4643}}
.stats b{{font-size:clamp(34px,5vw,52px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums}}
.stats small{{font-size:.42em;margin-left:3px;color:var(--volt)}}
.stats span{{font-size:14px;color:var(--band-muted)}}

section{{padding-block:72px 0}}
.sec-head{{display:grid;gap:8px;margin-bottom:28px;border-bottom:3px solid var(--fg);padding-bottom:14px}}
.sec-head h2{{font-size:clamp(26px,4vw,36px);font-weight:900}}

/* 역량 */
.comps{{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}}
.comps li{{background:var(--bg);padding:22px;display:grid;gap:8px;align-content:start}}
.comps h3{{font-size:19px;font-weight:700}}
.comps p{{color:var(--muted);font-size:15px}}
.count{{font-size:13px;font-weight:700;color:var(--accent)}}

/* 필터 + 카드 */
.filters{{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}}
.chip{{font:inherit;font-size:14px;font-weight:700;padding:8px 14px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}}
.chip[aria-pressed="true"]{{background:var(--accent);border-color:var(--accent);color:#fff}}
.chip:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}}
.card{{background:var(--surface);border:1px solid var(--line);padding:22px;display:flex;flex-direction:column;gap:10px;min-width:0}}
.card-top{{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;font-size:13px}}
.period{{font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}}
.org{{color:var(--muted)}}
.card h3{{font-size:18px;font-weight:700}}
.line{{font-size:15px;border-left:3px solid var(--accent);padding-left:10px}}
.did,.res{{font-size:14px;color:var(--muted)}}
.res b{{color:var(--fg);margin-right:4px}}
.card-foot{{margin-top:auto;display:flex;flex-wrap:wrap;gap:6px;padding-top:8px}}
.tag,.aud{{font-size:12px;padding:3px 8px;border:1px solid var(--line);color:var(--muted)}}
.aud{{background:var(--fg);color:var(--bg);border-color:var(--fg)}}
.empty{{color:var(--muted)}}

/* 대상별 */
.aud-list{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}}
.aud-list li{{border-top:3px solid var(--accent);padding-top:14px;display:grid;gap:6px;align-content:start}}
.aud-list h3{{font-size:18px;font-weight:700}}
.aud-list small{{color:var(--muted);font-size:13px}}

/* 경력·자격 */
.two{{display:grid;grid-template-columns:1fr 1fr;gap:48px}}
.two>div{{min-width:0}}
.two h3{{font-size:20px;font-weight:900;margin-bottom:12px}}
.tl li,.certs li{{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:15px}}
.tl span{{color:var(--accent);font-weight:700;font-variant-numeric:tabular-nums}}
.certs li{{grid-template-columns:1fr auto}}
.certs span{{color:var(--muted);font-size:14px;text-align:right}}

footer{{margin-top:88px;background:var(--band);color:var(--band-fg)}}
footer .wrap{{padding-block:48px;display:grid;gap:14px}}
footer h2{{font-size:clamp(26px,4vw,36px);font-weight:900}}
footer p{{color:var(--band-muted)}}

@media (max-width:760px){{
  .stats{{grid-template-columns:1fr 1fr}}
  .stats li:nth-child(3){{border-left:0;padding-left:0}}
  .two{{grid-template-columns:1fr;gap:40px}}
  .grid{{grid-template-columns:1fr}}
  .tl li{{grid-template-columns:120px 1fr}}
}}
@media (prefers-reduced-motion:no-preference){{.card{{transition:transform .15s}}.card:hover{{transform:translateY(-2px)}}}}
</style>

<header class="hero"><div class="wrap">
  <p class="eyebrow">AI Branding Educator · Designer 25yrs</p>
  <h1>아는디자이너<span>김세진 · 오브디자인 · 오브인교육원 대표</span></h1>
  <p class="intro">{e(intro)}</p>
  <div class="links">
    <a href="https://adi.liveklass.com" target="_blank" rel="noopener">강의사이트 adi.liveklass.com</a>
    <a href="https://www.instagram.com/oho.adi/" target="_blank" rel="noopener">인스타그램 @oho.adi</a>
  </div>
  <ul class="stats">{stat_html}</ul>
</div></header>

<main class="wrap">
  <section id="competencies">
    <div class="sec-head"><p class="eyebrow">Competencies</p><h2>이런 강의를 합니다</h2></div>
    <ul class="comps">{comp_blocks}</ul>
  </section>

  <section id="experience">
    <div class="sec-head"><p class="eyebrow">Experience</p><h2>강의·프로젝트 경험</h2></div>
    <div class="filters" role="group" aria-label="역량으로 거르기">
      <button type="button" class="chip" data-f="" aria-pressed="true">전체</button>{chips}
    </div>
    <div class="grid" id="grid">{''.join(card_html)}</div>
    <p class="empty" id="empty" hidden>해당 역량의 경험이 아직 없습니다.</p>
  </section>

  <section id="audiences">
    <div class="sec-head"><p class="eyebrow">For Every Learner</p><h2>대상별 강점</h2></div>
    <ul class="aud-list">{aud_html}</ul>
  </section>

  <section id="career">
    <div class="sec-head"><p class="eyebrow">Career &amp; Certificates</p><h2>경력과 자격</h2></div>
    <div class="two">
      <div><h3>경력</h3><ul class="tl">{tl_html}</ul></div>
      <div><h3>자격증</h3><ul class="certs">{cert_html}</ul></div>
    </div>
  </section>
</main>

<footer><div class="wrap">
  <p class="eyebrow" style="color:var(--volt)">Contact</p>
  <h2>강의 문의</h2>
  <p>강의사이트 adi.liveklass.com 또는 인스타그램 @oho.adi 로 연락 주세요.</p>
</div></footer>

<script>
(function(){{
  var chips=[].slice.call(document.querySelectorAll('.chip'));
  var cards=[].slice.call(document.querySelectorAll('.card'));
  var empty=document.getElementById('empty');
  chips.forEach(function(b){{b.addEventListener('click',function(){{
    var f=b.getAttribute('data-f'), n=0;
    chips.forEach(function(x){{x.setAttribute('aria-pressed',x===b?'true':'false')}});
    cards.forEach(function(c){{var on=!f||(' '+c.getAttribute('data-c')+' ').indexOf(' '+f+' ')>-1;c.hidden=!on;if(on)n++}});
    empty.hidden=n>0;
  }})}});
}})();
</script>
"""

os.makedirs(os.path.join(OUT, "fonts"), exist_ok=True)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)

# ---------- 폰트 서브셋 ----------
if FONT_SRC:
    text = "".join(sorted(set(re.sub(r"<[^>]+>", "", page)))) + "0123456789"
    tf = os.path.join(OUT, "fonts", ".chars.txt")
    open(tf, "w", encoding="utf-8").write(text)
    for short, name in [("r", "4Regular"), ("b", "7Bold"), ("k", "9Black")]:
        subprocess.run([sys.executable, "-m", "fontTools.subset",
                        os.path.join(FONT_SRC[0], f"Freesentation-{name}.woff2"),
                        f"--text-file={tf}", "--flavor=woff2",
                        f"--output-file={os.path.join(OUT, 'fonts', short + '.woff2')}"], check=True)
    os.remove(tf)
else:
    print("! Freesentation 폰트를 찾지 못해 기존 fonts/를 그대로 둡니다")

print(f"ok: 카드 {len(cards)}장, 역량 {len(comps)}개, 기관 {len(orgs)}곳 → {OUT}/index.html")
