// 공개 건물 주소(/b/공개키)를 카카오톡 등에 붙였을 때 건물 이름이 미리보기에 뜨도록
// index.html 의 제목·설명을 그 건물 것으로 바꿔 준다. 실패하면 원래 화면을 그대로 보낸다.
import type { Config, Context } from "@netlify/edge-functions";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async (request: Request, context: Context) => {
  const url = Netlify.env.get("VITE_SUPABASE_URL");
  const key = Netlify.env.get("VITE_SUPABASE_KEY");
  const publicKey = new URL(request.url).pathname.split("/")[2] ?? "";
  if (!url || !key || !/^[0-9a-f]{32}$/.test(publicKey)) return;

  const response = await context.next();
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;

  const res = await fetch(`${url}/rest/v1/rpc/get_public_building`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ p_key: publicKey }),
  });
  const b = res.ok ? await res.json() : null;
  if (!b?.profile) return response;

  const name = b.profile.brand_name || `${b.profile.nickname}님의 건물`;
  const title = esc(`${name} · NFb 브랜드 타운`);
  const desc = esc(
    b.profile.tagline || `${b.profile.nickname}님이 짓고 있는 브랜드 건물이에요. 도장 ${b.stamps}개 · 기록 ${b.records}개`,
  );
  const html = (await response.text())
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${desc}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`);

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(html, { status: response.status, headers });
};

export const config: Config = { path: "/b/*", onError: "bypass" };
