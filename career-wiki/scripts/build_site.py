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


def cells(r):
    return [clean(x.strip()) for x in r.strip("|").split("|")]


def comp_count(f):
    return sum(1 for x in cards if f in comp_by_card.get(x["file"], []))


chips = "".join(
    f'<button type="button" class="chip" data-f="{e(c["file"])}" aria-pressed="false">{e(comp_label(c["file"]))}</button>'
    for c in comps)

card_idx = {c["file"]: i for i, c in enumerate(cards)}
comp_rows = ""
for i, c in enumerate(comps, 1):
    mine = [x for x in cards if c["file"] in comp_by_card.get(x["file"], [])]
    items = "".join(f'<li><button type="button" class="open-card" data-i="{card_idx[x["file"]]}"><span>{e(clean(x.get("period","")))}</span>{e(x["title"])}</button></li>' for x in mine)
    comp_rows += (f'<li class="row"><button type="button" class="row-head" aria-expanded="false" aria-controls="cp{i}">'
        f'<span class="n">{i}</span><span class="rh"><b>{e(comp_label(c["file"]))}</b></span>'
        f'<span class="rp">{e(clean(c["lead"]))}</span><span class="cnt">경험 {comp_count(c["file"]):02d}<i aria-hidden="true">+</i></span></button>'
        f'<div class="row-panel" id="cp{i}" hidden><ul>{items}</ul>'
        f'<button type="button" class="jump" data-f="{e(c["file"])}">이 역량의 경험만 보기 ⟶</button></div></li>')

about_list = "".join(f'<li>— {e(comp_label(c["file"]))}</li>' for c in comps)

card_html = []
for idx, c in enumerate(cards):
    raw_res = c["secs"].get("결과", "")
    res = "" if TODO in raw_res else clean(raw_res)
    tags = comp_by_card.get(c["file"], [])
    aud = clean(c.get("audience", ""))
    did = clean(c["secs"].get("한 일", ""))
    card_html.append(f"""
<article class="work" data-c="{e(' '.join(tags))}" data-i="{idx}" tabindex="0" role="button" aria-label="{e(c['title'])} 자세히 보기">
  <div class="w-top"><span>{e(clean(c.get('period','')))}</span><span>{e(aud) if aud and aud != '—' else ''}</span></div>
  <p class="w-org">{e(clean(c.get('org','')))}</p>
  <h3>{e(c['title'])}</h3>
  <p class="w-line">{e(clean(c['secs'].get('제안서에 쓸 한 줄','')))}</p>
  {f'<p class="w-res"><b>RESULT</b> {e(res)}</p>' if res else ''}
  <div class="w-tags">{''.join(f'<span>[ {e(comp_label(t))} ]</span>' for t in tags)}</div>
  <span class="w-more" aria-hidden="true">VIEW ⟶</span>
  <template class="w-detail"><p class="d-did">{e(did)}</p></template>
</article>""")

aud_html = "".join(
    f'<li><h3>{e(a)}</h3><p>{e(m)}</p><small>{e(k)}</small></li>'
    for a, k, m in (cells(r) for r in aud_rows))
tl_html = "".join(f'<li><span>{e(p)}</span><b>{e(o)}</b></li>' for p, o, *_ in (cells(r) for r in timeline_rows))
cert_html = "".join(f'<li><b>{e(n)}</b><span>{e(o)}</span></li>' for n, o, *_ in (cells(r) for r in cert_rows))

stats = [("25", "YRS", "디자인 실무"), ("20", "YRS", "디지털 교육"),
         (str(len(orgs)), "+", "강의 기관"), (str(len(cert_rows)), "", "AI·디지털 자격증")]
stat_html = "".join(f'<li><b>{n}<small>{u}</small></b><span>{l}</span></li>' for n, u, l in stats)

org_list = sorted(orgs)
marquee = "".join(f'<span>{e(o)}</span><i>✳</i>' for o in org_list)
PHOTO = next((p for p in ("photo.jpg", "photo.png") if os.path.exists(os.path.join(OUT, p))), None)
photo_html = f'<img class="hero-photo" src="{PHOTO}" alt="김세진 강사 사진">' if PHOTO else ""

NAV = [("about", "ABOUT"), ("competencies", "역량"), ("works", "경험"), ("learners", "대상"), ("career", "경력")]
nav_html = "".join(f'<a href="#{i}"><span>{n:02d}</span>[ {l} ]</a>' for n, (i, l) in enumerate(NAV, 1))

GRAIN = ("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>"
         "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>"
         "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0'/></filter>"
         "<rect width='100%' height='100%' filter='url(%23n)'/></svg>")

page = f"""<title>아는디자이너 김세진</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Italiana&display=swap">
<style>
/* 레이아웃: 흑백 에디토리얼 — 굵은 고딕 + 가는 세리프를 겹친 대형 타이틀, 번호 붙은 섹션, 어두운/밝은 밴드 교차.
   빨강은 포인트(점, 번호, 한 개의 밴드, 버튼)에만 쓴다. 한 가지 룩으로 고정한 디자인이라 다크모드 분기 없음. */
@font-face{{font-family:"Free";src:url(fonts/r.woff2) format("woff2");font-weight:400;font-display:swap}}
@font-face{{font-family:"Free";src:url(fonts/b.woff2) format("woff2");font-weight:700;font-display:swap}}
@font-face{{font-family:"Free";src:url(fonts/k.woff2) format("woff2");font-weight:900;font-display:swap}}
:root{{
  --night:#161515; --char:#232121; --stone:#D8D5D0; --fog:#ECEAE6; --white:#FAF9F7;
  --red:#E1251A; --wine:#8C0001;
  --on-dark:#F2EFEA; --on-dark-2:#9C968F; --on-light:#161515; --on-light-2:#5E5954;
  --rule-dark:rgba(242,239,234,.16); --rule-light:rgba(22,21,21,.18);
  --sans:"Free","Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
  --serif:"Italiana","Didot","Bodoni 72","Times New Roman",serif;
  color-scheme:dark;
}}
*{{box-sizing:border-box}}
[hidden]{{display:none!important}}
html{{scroll-behavior:smooth}}
body{{background:var(--night);color:var(--on-dark);font-family:var(--sans);font-size:16px;line-height:1.7;word-break:keep-all}}
h1,h2,h3,p{{margin:0}}
ul{{list-style:none;margin:0;padding:0}}
a{{color:inherit}}
.wrap{{max-width:1180px;margin:0 auto;padding-left:max(20px,env(safe-area-inset-left,0px));padding-right:max(20px,env(safe-area-inset-right,0px))}}
.grain{{position:relative;isolation:isolate}}
.grain::after{{content:"";position:absolute;inset:0;background-image:url("{GRAIN}");opacity:.07;pointer-events:none;z-index:-1}}
.dark{{background:var(--night);color:var(--on-dark)}}
.light{{background:var(--stone);color:var(--on-light);color-scheme:light}}
.paper{{background:var(--fog);color:var(--on-light);color-scheme:light}}
.redband{{background:var(--wine);color:var(--on-dark)}}
.micro{{font-size:11px;letter-spacing:.22em;text-transform:uppercase;line-height:1.5}}
.dot{{color:var(--red)}}

/* 큰 제목: 굵은 고딕 + 가는 세리프 */
.big{{display:grid;line-height:.86;margin-block:6px 0}}
.big b{{font-weight:900;font-size:clamp(56px,11vw,150px);letter-spacing:-.045em}}
.big i{{font-family:var(--serif);font-style:normal;font-weight:400;font-size:clamp(58px,11.5vw,158px);letter-spacing:-.01em;text-transform:uppercase}}
.big.right{{justify-items:end;text-align:right}}
.sec-meta{{display:flex;justify-content:space-between;gap:16px;align-items:baseline}}
.sec-meta .num{{font-family:var(--serif);font-size:28px}}

/* 히어로 */
.hero .wrap{{min-height:min(92vh,880px);display:grid;grid-template-rows:auto 1fr auto auto;padding-block:28px 26px;gap:28px}}
.topbar{{display:flex;justify-content:space-between;gap:16px;color:var(--on-dark-2)}}
.hero-center{{display:grid;align-content:center;justify-items:center;text-align:center;gap:18px;position:relative}}
.hero-role{{font-family:var(--serif);font-size:clamp(15px,1.7vw,20px);letter-spacing:.2em;color:var(--on-dark-2);text-transform:uppercase}}
.hero h1{{display:grid;justify-items:center;line-height:.82}}
.hero h1 b{{font-weight:900;font-size:clamp(76px,17vw,232px);letter-spacing:-.05em}}
.hero h1 i{{font-family:var(--serif);font-style:normal;font-size:clamp(46px,10.5vw,148px);letter-spacing:.02em;margin-top:.08em}}
.hero h1 .dot{{font-weight:900}}
.hero-photo{{position:absolute;width:clamp(110px,14vw,180px);aspect-ratio:3/4;object-fit:cover;filter:grayscale(1) contrast(1.05);left:50%;top:50%;transform:translate(-50%,-58%);z-index:1;max-width:100%}}
.hero-name{{font-size:15px;color:var(--on-dark-2);letter-spacing:.3em}}
.nav{{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;border-top:1px solid var(--rule-dark);padding-top:14px}}
.nav a{{display:grid;gap:2px;text-decoration:none;font-size:13px;letter-spacing:.08em}}
.nav a span{{font-size:11px;color:var(--on-dark-2)}}
.nav a:hover,.nav a:focus-visible{{color:var(--red);outline:none}}
.stats{{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--rule-dark)}}
.stats li{{padding:16px 12px 0 0;display:grid;gap:2px}}
.stats li+li{{padding-left:16px;border-left:1px solid var(--rule-dark)}}
.stats b{{font-size:clamp(30px,4.4vw,48px);font-weight:900;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}}
.stats small{{font-size:.34em;margin-left:4px;color:var(--red);letter-spacing:.1em;vertical-align:top}}
.stats span{{font-size:13px;color:var(--on-dark-2)}}
.scroll{{justify-self:center;font-size:12px;letter-spacing:.24em;text-decoration:underline;text-underline-offset:5px;color:var(--on-dark-2)}}

section{{padding-block:88px}}

/* 01 ABOUT */
.about-grid{{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;margin-top:34px}}
.about-grid>*{{min-width:0}}
.about-intro{{font-size:18px;max-width:34em}}
.about-sig{{font-family:var(--serif);font-size:22px;margin-top:22px;text-transform:uppercase;letter-spacing:.06em}}
.about-cols{{display:grid;grid-template-columns:auto 1fr;gap:18px 32px;align-content:start;border-top:1px solid var(--rule-light);padding-top:20px}}
.about-cols h3{{font-size:12px;font-weight:900;letter-spacing:.1em;line-height:1.5}}
.about-cols h3::after{{content:"⟶";display:block;font-weight:400;margin-top:4px}}
.about-cols li{{font-size:15px;color:var(--on-light-2)}}
.btn{{display:inline-block;margin-top:28px;background:var(--on-light);color:var(--white);text-decoration:none;font-size:13px;letter-spacing:.16em;padding:14px 26px;font-weight:700}}
.btn:hover,.btn:focus-visible{{background:var(--red);outline:none}}

/* 02 역량 — 레드 밴드 */
.rows{{margin-top:44px;border-top:1px solid rgba(255,255,255,.28)}}
.rows li{{display:grid;grid-template-columns:90px minmax(0,1.1fr) minmax(0,1.6fr) auto;gap:24px;align-items:center;padding:24px 0;border-bottom:1px solid rgba(255,255,255,.28)}}
.rows .n{{font-size:48px;font-weight:900;line-height:1;text-align:center}}
.rows h3{{font-size:20px;font-weight:900;letter-spacing:.02em}}
.rows p{{font-size:14px;opacity:.82}}
.rows .cnt{{font-size:12px;letter-spacing:.14em;opacity:.8;font-variant-numeric:tabular-nums}}

/* 03 경험 */
.filters{{display:flex;flex-wrap:wrap;gap:6px 18px;margin:40px 0 28px}}
.chip{{font:inherit;font-size:13px;letter-spacing:.06em;background:none;border:0;color:var(--on-dark-2);cursor:pointer;padding:6px 0}}
.chip::before{{content:"[ "}} .chip::after{{content:" ]"}}
.chip[aria-pressed="true"]{{color:var(--on-dark)}}
.chip[aria-pressed="true"]::before,.chip[aria-pressed="true"]::after{{color:var(--red)}}
.chip:hover{{color:var(--on-dark)}}
.chip:focus-visible{{outline:1px solid var(--red);outline-offset:4px}}
.works{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--rule-dark);border-left:1px solid var(--rule-dark)}}
.work{{padding:26px 24px 22px;border-right:1px solid var(--rule-dark);border-bottom:1px solid var(--rule-dark);display:flex;flex-direction:column;gap:10px;min-width:0;transition:background .2s}}
.work:hover{{background:var(--char)}}
.w-top{{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.12em;color:var(--on-dark-2)}}
.w-top span:first-child{{color:var(--red);font-weight:700}}
.w-org{{font-family:var(--serif);font-size:20px;line-height:1.2;color:var(--on-dark-2)}}
.work h3{{font-size:18px;font-weight:700;line-height:1.4}}
.w-line{{font-size:14px;color:var(--on-dark-2)}}
.w-res{{font-size:13px;color:var(--on-dark)}}
.w-res b{{font-size:10px;letter-spacing:.2em;color:var(--red);margin-right:6px}}
.w-tags{{margin-top:auto;padding-top:10px;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:var(--on-dark-2);letter-spacing:.04em}}
.empty{{color:var(--on-dark-2);padding:24px 0}}

/* 04 대상 — 검정 밴드 3열 */
.learners{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:40px 32px;margin-top:44px}}
.learners li{{display:grid;gap:8px;align-content:start;border-top:1px solid var(--rule-dark);padding-top:16px}}
.learners h3{{font-size:17px;font-weight:900;letter-spacing:.04em}}
.learners h3::before{{content:"●";color:var(--red);font-size:8px;vertical-align:middle;margin-right:8px}}
.learners p{{font-size:14px}}
.learners small{{font-size:12px;color:var(--on-dark-2);line-height:1.6}}

/* 05 경력 */
.two{{display:grid;grid-template-columns:1fr 1fr;gap:64px;margin-top:44px}}
.two>div{{min-width:0}}
.two h3{{font-size:12px;letter-spacing:.22em;font-weight:900;margin-bottom:8px}}
.tl li,.certs li{{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:14px 0;border-bottom:1px solid var(--rule-light);font-size:15px}}
.tl span{{font-size:13px;color:var(--wine);font-weight:700;font-variant-numeric:tabular-nums;padding-top:2px}}
.certs li{{grid-template-columns:1fr auto}}
.certs span{{color:var(--on-light-2);font-size:13px;text-align:right}}

/* 푸터 */
footer .wrap{{padding-block:96px 36px;display:grid;gap:36px}}
footer .big{{justify-items:center;text-align:center}}
.contact{{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}}
.contact a{{border:1px solid var(--rule-dark);text-decoration:none;padding:13px 22px;font-size:13px;letter-spacing:.12em}}
.contact a:hover,.contact a:focus-visible{{border-color:var(--red);color:var(--red);outline:none}}
.foot{{display:flex;justify-content:space-between;gap:16px;color:var(--on-dark-2);border-top:1px solid var(--rule-dark);padding-top:16px}}

/* ---- 인터랙션 ---- */
.hero h1 b,.hero h1 i,.hero-role{{will-change:transform;transition:transform .25s ease-out}}
.big i,.big b{{will-change:transform}}
.sticky{{position:fixed;left:0;right:0;top:0;z-index:20;background:rgba(22,21,21,.92);backdrop-filter:blur(8px);color:var(--on-dark);
  padding-top:env(safe-area-inset-top,0px);transform:translateY(-110%);transition:transform .35s ease}}
.sticky.on{{transform:none}}
.sticky .wrap{{display:flex;align-items:center;justify-content:space-between;gap:16px;height:54px}}
.s-logo{{font-weight:900;font-size:18px;text-decoration:none;letter-spacing:-.02em}}
.s-logo i{{font-family:var(--serif);font-style:normal;font-weight:400;margin-left:2px}}
.s-nav{{display:flex;gap:22px;font-size:12px;letter-spacing:.1em}}
.s-nav a{{text-decoration:none;color:var(--on-dark-2);transition:color .2s}}
.s-nav a.act,.s-nav a:hover,.s-nav a:focus-visible{{color:var(--on-dark);outline:none}}
.s-nav a.act::before{{content:"● ";color:var(--red);font-size:8px;vertical-align:middle}}
.bar{{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--red);transform-origin:left;transform:scaleX(0)}}
.marquee{{background:var(--night);color:var(--on-dark);overflow:hidden;border-block:1px solid var(--rule-dark);padding-block:18px}}
.mq-track{{display:flex;width:max-content;gap:28px;align-items:center;animation:mq 50s linear infinite;font-family:var(--serif);font-size:clamp(22px,3vw,34px);white-space:nowrap}}
.mq-track i{{font-style:normal;color:var(--red);font-size:.6em}}
.marquee:hover .mq-track{{animation-play-state:paused}}
@keyframes mq{{to{{transform:translateX(-50%)}}}}
.row-head{{all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:grid;grid-template-columns:90px minmax(0,1.1fr) minmax(0,1.6fr) auto;gap:24px;align-items:center;padding:24px 12px;transition:background .25s,color .25s}}
.row-head:hover,.row-head:focus-visible,.row-head[aria-expanded="true"]{{background:var(--white);color:var(--wine)}}
.row-head:focus-visible{{outline:2px solid var(--white);outline-offset:2px}}
.row-head .rh b{{font-size:20px;font-weight:900}}
.row-head .rp{{font-size:14px;opacity:.85}}
.row-head .cnt i{{font-style:normal;display:inline-block;margin-left:14px;font-size:22px;line-height:1;transition:transform .3s;vertical-align:middle}}
.row-head[aria-expanded="true"] .cnt i{{transform:rotate(45deg)}}
.rows li.row{{display:block;padding:0}}
.row-panel{{background:var(--white);color:var(--on-light);padding:6px 24px 26px 126px}}
.row-panel ul{{display:grid;gap:2px;margin-bottom:16px}}
.open-card{{all:unset;cursor:pointer;display:grid;grid-template-columns:130px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--rule-light);font-size:15px;width:100%;box-sizing:border-box}}
.open-card span{{font-size:12px;color:var(--wine);font-weight:700;padding-top:2px}}
.open-card:hover,.open-card:focus-visible{{color:var(--red)}}
.jump{{font:inherit;font-size:13px;letter-spacing:.1em;font-weight:700;background:var(--on-light);color:var(--white);border:0;padding:12px 20px;cursor:pointer}}
.jump:hover,.jump:focus-visible{{background:var(--red);outline:none}}
.work{{cursor:pointer;position:relative}}
.work:focus-visible{{outline:1px solid var(--red);outline-offset:-1px}}
.w-more{{position:absolute;right:22px;bottom:20px;font-size:11px;letter-spacing:.2em;color:var(--red);opacity:0;transform:translateX(-8px);transition:.25s}}
.work:hover .w-more,.work:focus-visible .w-more{{opacity:1;transform:none}}
.work.pop{{animation:pop .45s cubic-bezier(.2,.8,.2,1) both}}
@keyframes pop{{from{{transform:translateY(14px) scale(.98)}}to{{transform:none}}}}
.learners li{{transition:border-color .25s}}
.learners li:hover{{border-top-color:var(--red)}}
.modal{{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:max(20px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(20px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:rgba(10,10,10,.72);backdrop-filter:blur(4px)}}
.m-box{{background:var(--fog);color:var(--on-light);width:min(680px,100%);max-height:100%;overflow:auto;padding:40px 36px 32px;position:relative;animation:pop .35s cubic-bezier(.2,.8,.2,1)}}
.m-close{{position:absolute;top:14px;right:16px;font:inherit;font-size:13px;letter-spacing:.14em;background:none;border:0;cursor:pointer;color:var(--on-light-2)}}
.m-close:hover,.m-close:focus-visible{{color:var(--red);outline:none}}
.m-meta{{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;letter-spacing:.12em;color:var(--on-light-2)}}
.m-meta b{{color:var(--red)}}
.m-org{{font-family:var(--serif);font-size:30px;line-height:1.15;margin-top:14px}}
.m-box h3{{font-size:24px;font-weight:900;line-height:1.35;margin-top:8px}}
.m-line{{margin-top:18px;font-size:17px;border-left:3px solid var(--red);padding-left:14px}}
.m-sec{{margin-top:22px;display:grid;gap:4px}}
.m-sec small{{font-size:11px;letter-spacing:.22em;color:var(--on-light-2)}}
.m-tags{{margin-top:22px;display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--on-light-2)}}
.m-nav{{display:flex;justify-content:space-between;margin-top:30px;border-top:1px solid var(--rule-light);padding-top:16px}}
.m-nav button{{font:inherit;font-size:13px;letter-spacing:.1em;background:none;border:0;cursor:pointer;color:var(--on-light)}}
.m-nav button:hover,.m-nav button:focus-visible{{color:var(--red);outline:none}}
.cursor{{position:fixed;left:0;top:0;z-index:50;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--red);pointer-events:none;
  display:grid;place-items:center;font-size:0;color:#fff;letter-spacing:.14em;font-weight:700;transition:width .25s,height .25s,margin .25s,font-size .2s;opacity:0}}
.cursor.big{{width:74px;height:74px;margin:-37px 0 0 -37px;font-size:11px}}
.cursor.link{{width:34px;height:34px;margin:-17px 0 0 -17px;background:transparent;border:1px solid var(--red)}}
@media (pointer:fine){{.cursor.ready{{opacity:1}}}}
@media (max-width:760px){{.s-nav{{display:none}}}}

@media (max-width:900px){{
  .works{{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .learners{{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .about-grid,.two{{grid-template-columns:1fr;gap:40px}}
  .row-head{{grid-template-columns:56px 1fr;gap:6px 16px;padding:20px 8px}}
  .row-head .rp,.row-head .cnt{{grid-column:2}}
  .row-panel{{padding:6px 18px 22px}}
  .open-card{{grid-template-columns:1fr;gap:0}}
  .m-box{{padding:36px 22px 24px}}
  .rows .n{{font-size:36px;grid-row:span 3;align-self:start}}
  .rows p,.rows .cnt{{grid-column:2}}
}}
@media (max-width:600px){{
  section{{padding-block:64px}}
  .works,.learners{{grid-template-columns:1fr}}
  .nav{{grid-template-columns:repeat(3,1fr)}}
  .stats{{grid-template-columns:1fr 1fr}}
  .stats li:nth-child(3){{border-left:0;padding-left:0}}
  .stats li:nth-child(n+3){{padding-top:14px}}
  .tl li{{grid-template-columns:118px 1fr}}
  .sec-meta .num{{font-size:22px}}
}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}.work{{transition:none}}.mq-track{{animation:none}}.work.pop,.m-box{{animation:none}}}}
</style>

<div class="sticky" id="sticky"><div class="wrap">
  <a class="s-logo" href="#top">아는<span class="dot">.</span><i>Designer</i></a>
  <nav class="s-nav" aria-label="섹션">{''.join(f'<a href="#{i}" data-s="{i}">{l}</a>' for i, l in NAV)}<a href="#contact" data-s="contact">문의</a></nav>
</div><span class="bar" id="bar"></span></div>
<div class="cursor" id="cursor" aria-hidden="true"></div>

<header class="hero dark grain" id="top"><div class="wrap">
  <div class="topbar micro"><span>Portfolio<br>Vol. 01</span><span style="text-align:right">Design since<br>2000</span></div>
  <div class="hero-center">
    <p class="hero-role">AI Branding Educator &amp; Designer</p>
    {photo_html}
    <h1><b>아는<span class="dot">.</span></b><i>Designer</i></h1>
    <p class="hero-name">김세진 · KIM SEJIN</p>
  </div>
  <nav class="nav" aria-label="섹션 바로가기">{nav_html}</nav>
  <ul class="stats">{stat_html}</ul>
</div></header>

<main>
  <section id="about" class="light grain"><div class="wrap">
    <div class="sec-meta"><span class="num">01</span><span class="micro">/ 소개</span></div>
    <h2 class="big"><b>ABOUT</b><i style="padding-left:.9em">Me</i></h2>
    <div class="about-grid">
      <div>
        <p class="about-intro">{e(intro)}</p>
        <p class="about-sig">Kim Sejin<span class="dot">.</span></p>
      </div>
      <div>
        <div class="about-cols">
          <h3>이런 강의를<br>합니다</h3><ul>{about_list}</ul>
          <h3>운영하는<br>브랜드</h3><ul><li>— 오브디자인 · 오브인교육원</li><li>— 출판 브랜드 오브북</li><li>— 인스타그램 @oho.adi</li></ul>
        </div>
        <a class="btn" href="#contact">강의 문의하기</a>
      </div>
    </div>
  </div></section>

  <div class="marquee" aria-label="강의한 기관"><div class="mq-track">{marquee}{marquee}</div></div>

  <section id="competencies" class="redband grain"><div class="wrap">
    <div class="sec-meta"><span class="micro">/ 역량</span><span class="num">02</span></div>
    <h2 class="big right"><b>WHAT</b><i>I Teach</i></h2>
    <ul class="rows">{comp_rows}</ul>
  </div></section>

  <section id="works" class="dark grain"><div class="wrap">
    <div class="sec-meta"><span class="num">03</span><span class="micro">/ 강의·프로젝트 경험</span></div>
    <h2 class="big" style="justify-items:center;text-align:center"><b>WORKS</b><i>Works</i></h2>
    <div class="filters" role="group" aria-label="역량으로 거르기">
      <button type="button" class="chip" data-f="" aria-pressed="true">전체</button>{chips}
    </div>
    <div class="works" id="grid">{''.join(card_html)}</div>
    <p class="empty" id="empty" hidden>해당 역량의 경험이 아직 없습니다.</p>
  </div></section>

  <section id="learners" class="dark" style="background:var(--char)"><div class="wrap">
    <div class="sec-meta"><span class="micro">/ 대상별 강점</span><span class="num">04</span></div>
    <h2 class="big right"><b>FOR EVERY</b><i>Learner</i></h2>
    <ul class="learners">{aud_html}</ul>
  </div></section>

  <section id="career" class="paper grain"><div class="wrap">
    <div class="sec-meta"><span class="num">05</span><span class="micro">/ 경력과 자격</span></div>
    <h2 class="big"><b>CAREER</b><i style="padding-left:.6em">&amp; Licenses</i></h2>
    <div class="two">
      <div><h3>CAREER</h3><ul class="tl">{tl_html}</ul></div>
      <div><h3>CERTIFICATES</h3><ul class="certs">{cert_html}</ul></div>
    </div>
  </div></section>
</main>

<footer id="contact" class="dark grain"><div class="wrap">
  <h2 class="big"><b>LET'S</b><i>Talk<span class="dot">.</span></i></h2>
  <div class="contact">
    <a href="https://adi.liveklass.com" target="_blank" rel="noopener">ADI.LIVEKLASS.COM</a>
    <a href="https://www.instagram.com/oho.adi/" target="_blank" rel="noopener">INSTAGRAM @OHO.ADI</a>
  </div>
  <div class="foot micro"><span>아는디자이너 김세진</span><span>오브디자인 · 오브인교육원</span></div>
</div></footer>

<div class="modal" id="modal" hidden role="dialog" aria-modal="true" aria-labelledby="m-title">
  <div class="m-box" id="m-box">
    <button type="button" class="m-close" id="m-close">CLOSE ✕</button>
    <div class="m-meta" id="m-meta"></div>
    <p class="m-org" id="m-org"></p>
    <h3 id="m-title"></h3>
    <p class="m-line" id="m-line"></p>
    <div id="m-body"></div>
    <div class="m-tags" id="m-tags"></div>
    <div class="m-nav"><button type="button" id="m-prev">⟵ 이전</button><button type="button" id="m-next">다음 ⟶</button></div>
  </div>
</div>

<script>
(function(){{
  var $=function(s,r){{return (r||document).querySelector(s)}}, $$=function(s,r){{return [].slice.call((r||document).querySelectorAll(s))}};
  var still=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia('(pointer: fine)').matches;

  /* 필터 */
  var chips=$$('.chip'), cards=$$('.work'), empty=$('#empty');
  function filter(f){{
    var n=0;
    chips.forEach(function(x){{x.setAttribute('aria-pressed',x.getAttribute('data-f')===f?'true':'false')}});
    cards.forEach(function(c){{
      var on=!f||(' '+c.getAttribute('data-c')+' ').indexOf(' '+f+' ')>-1;
      c.hidden=!on; c.classList.remove('pop');
      if(on){{ if(!still){{void c.offsetWidth; c.style.animationDelay=(n*35)+'ms'; c.classList.add('pop');}} n++; }}
    }});
    empty.hidden=n>0;
  }}
  chips.forEach(function(b){{b.addEventListener('click',function(){{filter(b.getAttribute('data-f'))}})}});

  /* 역량 아코디언 */
  $$('.row-head').forEach(function(h){{h.addEventListener('click',function(){{
    var open=h.getAttribute('aria-expanded')==='true';
    $$('.row-head').forEach(function(x){{x.setAttribute('aria-expanded','false');$('#'+x.getAttribute('aria-controls')).hidden=true}});
    if(!open){{h.setAttribute('aria-expanded','true');$('#'+h.getAttribute('aria-controls')).hidden=false}}
  }})}});
  $$('.jump').forEach(function(b){{b.addEventListener('click',function(){{
    filter(b.getAttribute('data-f'));
    $('#works').scrollIntoView({{behavior:still?'auto':'smooth'}});
  }})}});

  /* 카드 상세 */
  var modal=$('#modal'), cur=0, lastFocus=null;
  function visible(){{return cards.filter(function(c){{return !c.hidden}})}}
  function show(i){{
    var c=cards[i]; if(!c) return; cur=i;
    var top=$$('.w-top span',c);
    $('#m-meta').innerHTML='<b>'+top[0].textContent+'</b><span>'+top[1].textContent+'</span>';
    $('#m-org').textContent=$('.w-org',c).textContent;
    $('#m-title').textContent=$('h3',c).textContent;
    $('#m-line').textContent=$('.w-line',c).textContent;
    var body='', did=$('.w-detail',c).content.textContent.trim(), res=$('.w-res',c);
    if(did) body+='<div class="m-sec"><small>WHAT I DID</small><p></p></div>';
    if(res) body+='<div class="m-sec"><small>RESULT</small><p></p></div>';
    $('#m-body').innerHTML=body;
    var ps=$$('#m-body p'), k=0;
    if(did) ps[k++].textContent=did;
    if(res) ps[k].textContent=res.textContent.replace(/^RESULT\\s*/,'');
    $('#m-tags').innerHTML=$('.w-tags',c).innerHTML;
    if(modal.hidden){{lastFocus=document.activeElement; modal.hidden=false; document.body.style.overflow='hidden';}}
    $('#m-close').focus();
  }}
  function close(){{modal.hidden=true;document.body.style.overflow='';if(lastFocus)lastFocus.focus()}}
  function step(d){{var v=visible(),p=v.indexOf(cards[cur]);var n=v[(p+d+v.length)%v.length];show(cards.indexOf(n))}}
  cards.forEach(function(c,i){{
    c.addEventListener('click',function(){{show(i)}});
    c.addEventListener('keydown',function(ev){{if(ev.key==='Enter'||ev.key===' '){{ev.preventDefault();show(i)}}}});
  }});
  $$('.open-card').forEach(function(b){{b.addEventListener('click',function(){{show(+b.getAttribute('data-i'))}})}});
  $('#m-close').addEventListener('click',close);
  $('#m-prev').addEventListener('click',function(){{step(-1)}});
  $('#m-next').addEventListener('click',function(){{step(1)}});
  modal.addEventListener('click',function(ev){{if(ev.target===modal)close()}});
  document.addEventListener('keydown',function(ev){{
    if(modal.hidden) return;
    if(ev.key==='Escape') close();
    if(ev.key==='ArrowRight') step(1);
    if(ev.key==='ArrowLeft') step(-1);
    if(ev.key==='Tab'){{var f=$$('button',modal),a=f[0],z=f[f.length-1];
      if(ev.shiftKey&&document.activeElement===a){{ev.preventDefault();z.focus()}}
      else if(!ev.shiftKey&&document.activeElement===z){{ev.preventDefault();a.focus()}}}}
  }});

  /* 스크롤: 상단바, 진행바, 현재 섹션, 세리프 글자 슬라이드 */
  var sticky=$('#sticky'), bar=$('#bar'), hero=$('#top');
  var links=$$('.s-nav a'), secs=links.map(function(a){{return $('#'+a.getAttribute('data-s'))}});
  var slides=$$('section .big i, footer .big i');
  var ticking=false;
  function onScroll(){{
    ticking=false;
    var y=window.scrollY, h=document.documentElement.scrollHeight-window.innerHeight, vh=window.innerHeight;
    sticky.classList.toggle('on', y>hero.offsetHeight-80);
    bar.style.transform='scaleX('+(h>0?y/h:0)+')';
    var act=-1; secs.forEach(function(s,i){{if(s&&s.getBoundingClientRect().top<vh*.4)act=i}});
    links.forEach(function(a,i){{a.classList.toggle('act',i===act)}});
    if(!still) slides.forEach(function(el){{
      var r=el.getBoundingClientRect(); if(r.bottom<0||r.top>vh) return;
      var p=(r.top+r.height/2-vh/2)/vh;
      el.style.transform='translateX('+(p*-60).toFixed(1)+'px)';
    }});
  }}
  window.addEventListener('scroll',function(){{if(!ticking){{ticking=true;requestAnimationFrame(onScroll)}}}},{{passive:true}});
  onScroll();

  /* 히어로: 마우스 따라 글자 시차 */
  if(fine&&!still){{
    var hb=$('.hero h1 b'), hi=$('.hero h1 i'), hr=$('.hero-role');
    hero.addEventListener('mousemove',function(ev){{
      var x=ev.clientX/window.innerWidth-.5, y=ev.clientY/window.innerHeight-.5;
      hb.style.transform='translate('+(x*-26)+'px,'+(y*-14)+'px)';
      hi.style.transform='translate('+(x*30)+'px,'+(y*12)+'px)';
      hr.style.transform='translate('+(x*12)+'px,0)';
    }});
    hero.addEventListener('mouseleave',function(){{hb.style.transform=hi.style.transform=hr.style.transform=''}});
  }}

  /* 빨간 점 커서 */
  if(fine){{
    var cu=$('#cursor'), mx=0,my=0,cx=0,cy=0;
    document.addEventListener('mousemove',function(ev){{mx=ev.clientX;my=ev.clientY;cu.classList.add('ready')}});
    document.addEventListener('mouseleave',function(){{cu.classList.remove('ready')}});
    (function loop(){{cx+=(mx-cx)*(still?1:.22);cy+=(my-cy)*(still?1:.22);cu.style.transform='translate('+cx+'px,'+cy+'px)';requestAnimationFrame(loop)}})();
    document.addEventListener('mouseover',function(ev){{
      var w=ev.target.closest('.work'), l=ev.target.closest('a,button');
      cu.classList.toggle('big',!!w); cu.classList.toggle('link',!w&&!!l);
      cu.textContent=w?'VIEW':'';
    }});
  }}
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

print(f"ok: 카드 {len(cards)}장, 역량 {len(comps)}개, 기관 {len(orgs)}곳, 사진 {'있음' if PHOTO else '없음'} → {OUT}/index.html")
