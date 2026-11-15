// 링크마다 나무 이름·콘셉트에 맞는 미리보기(오픈그래프)와 앱 아이콘을 내려준다.
//   /t/XXXX/                     → HTML 의 <!--meta--> 구간을 그 나무 것으로 바꿈 (?code=XXXX 는 여기로 이동)
//   /manifest.webmanifest?code=  → 그 나무 전용 홈 화면 앱 정보
import type { Config, Context } from "@netlify/edge-functions";

const SUPABASE_URL = "https://eaibfimzdskdpgvxudgo.supabase.co";
const SUPABASE_KEY = "sb_publishable_q8AcLbXJwTA4E9dyF_90hg_jjW6CPri"; // 공개돼도 되는 키

const THEMES: Record<string, { label: string; desc: string; color: string }> = {
  christmas: { label: "크리스마스 트리", desc: "이름과 메시지를 남기면 트리에 오너먼트가 달려요.", color: "#0a100b" },
  persimmon: { label: "감사 감나무", desc: "감사한 마음을 적으면 감나무에 감이 열려요.", color: "#120c07" },
  cherry: { label: "벚꽃나무", desc: "소감과 리뷰를 남기면 나무에 벚꽃이 피어나요.", color: "#130a10" },
};
const DEFAULT = { name: "메시지 나무", theme: "christmas", desc: "이름과 메시지를 남기면 나무에 카드가 달려요." };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function treeInfo(code: string) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mt_tree_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const t = await res.json();
    return t && THEMES[t.theme] ? (t as { code: string; name: string; theme: string }) : null;
  } catch (_) {
    return null;
  }
}

function metaTags(origin: string, tree: { code: string; name: string; theme: string } | null) {
  const theme = tree ? tree.theme : DEFAULT.theme;
  const title = tree ? `${tree.name} · ${THEMES[theme].label}` : DEFAULT.name;
  const desc = tree ? THEMES[theme].desc : DEFAULT.desc;
  const page = tree ? `${origin}/t/${tree.code}/` : `${origin}/`;
  return `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="${THEMES[theme].color}">
  <meta name="apple-mobile-web-app-title" content="${esc(tree ? tree.name : DEFAULT.name)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="메시지 나무">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(page)}">
  <meta property="og:image" content="${origin}/assets/og-${theme}.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/svg+xml" href="/assets/favicon-${theme}.svg">
  <link rel="apple-touch-icon" href="/assets/icon-${theme}-180.png">
  ${tree ? `<link rel="manifest" href="/manifest.webmanifest?code=${tree.code}">` : ""}
  `;
}

function manifest(tree: { code: string; name: string; theme: string } | null) {
  const theme = tree ? tree.theme : DEFAULT.theme;
  // 나무마다 범위(scope)를 따로 줘야 여러 나무를 각각 홈 화면 앱으로 저장할 수 있다
  const start = tree ? `/t/${tree.code}/` : "/";
  return {
    id: start,
    name: tree ? tree.name : DEFAULT.name,
    short_name: tree ? Array.from(tree.name).slice(0, 12).join("") : DEFAULT.name,
    description: tree ? THEMES[theme].desc : DEFAULT.desc,
    start_url: start,
    scope: start,
    display: "standalone",
    lang: "ko",
    background_color: THEMES[theme].color,
    theme_color: THEMES[theme].color,
    icons: [192, 512].flatMap((size) =>
      ["any", "maskable"].map((purpose) => ({
        src: `/assets/icon-${theme}-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose,
      }))
    ),
  };
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const inPath = url.pathname.match(/^\/t\/([^/]+)\/?$/);
  const raw = inPath ? decodeURIComponent(inPath[1]) : (url.searchParams.get("code") ?? "");
  const code = raw.trim().toUpperCase();

  if (url.pathname === "/manifest.webmanifest") {
    return new Response(JSON.stringify(manifest(code ? await treeInfo(code) : null)), {
      headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  if (!code) return; // 코드가 없으면 기본 HTML 그대로
  // 예전 주소(?code=)나 소문자·슬래시 없는 주소는 나무 전용 주소로 모은다
  const canonical = `/t/${code}/`;
  if (/^[A-Z0-9]{4,12}$/.test(code) && url.pathname !== canonical) {
    return Response.redirect(new URL(canonical, url.origin), 302);
  }
  const tree = await treeInfo(code);
  if (!tree) return;
  const res = await context.next();
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  const html = (await res.text()).replace(/<!--meta-->[\s\S]*?<!--\/meta-->/, metaTags(url.origin, tree));
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(html, { status: res.status, headers });
};

export const config: Config = {
  path: ["/", "/index.html", "/t/*", "/manifest.webmanifest"],
  onError: "bypass",
};
