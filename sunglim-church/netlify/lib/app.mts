// 성림교회 홈페이지 서버 기능 (Netlify Functions 에서 실행)
// 읽기는 누구나, 쓰기는 관리자 로그인 후에만 가능합니다.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// 저장소(Netlify Blobs)를 감싼 최소한의 모양 — 테스트에서는 메모리 저장소로 바꿔 끼웁니다.
export interface KV {
  getJSON(key: string): Promise<any | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  getBinary(key: string): Promise<{ data: ArrayBuffer; type: string } | null>;
  setBinary(key: string, data: ArrayBuffer, type: string): Promise<void>;
}

export interface Env {
  adminId: string;       // 관리자 아이디 (환경 변수 ADMIN_ID, 기본 admin)
  adminPassword: string; // 관리자 비밀번호 (환경 변수 ADMIN_PASSWORD) — 코드에는 넣지 않습니다
  offeringPassword: string; // 헌금명단 열람 비밀번호 (환경 변수 OFFERING_PASSWORD)
}

const ADMIN_DAYS = 30;  // 관리자 로그인 유지 기간
const VIEWER_DAYS = 7;  // 헌금명단 열람 유지 기간
const MAX_JSON = 600 * 1024;          // 주보 한 편/설정 최대 크기
const MAX_IMAGE = 4 * 1024 * 1024;    // 이미지 최대 4MB
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
const fail = (status: number, message: string) => json({ message }, status);

// ---------- 로그인 ----------
const digest = (s: string) => createHash("sha256").update(s).digest();
const sameText = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
// 로그인 토큰: "만료시각.서명". 역할(admin/viewer)마다 비밀번호에서 만든 다른 열쇠로 서명합니다.
type Role = "admin" | "viewer";
const sign = (role: Role, exp: number, secret: string) =>
  createHmac("sha256", "sunglim-" + role + ":" + secret).update(role + "." + exp).digest("base64url");

function makeToken(role: Role, secret: string, days: number): { token: string; exp: number } {
  const exp = Date.now() + days * 24 * 3600 * 1000;
  return { token: exp + "." + sign(role, exp, secret), exp };
}

function hasRole(req: Request, role: Role, secret: string): boolean {
  if (!secret) return false;
  const m = (req.headers.get("authorization") || "").match(/^Bearer (\d{13})\.([\w-]{20,100})$/);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!(exp > Date.now())) return false;
  return sameText(m[2], sign(role, exp, secret));
}
export const isAdmin = (req: Request, env: Env) => hasRole(req, "admin", env.adminPassword);
const isViewer = (req: Request, env: Env) => hasRole(req, "viewer", env.offeringPassword);

async function readLogin(req: Request): Promise<any> {
  try { return JSON.parse((await req.text()).slice(0, 2000)); } catch { return null; }
}
const slow = () => new Promise((r) => setTimeout(r, 700)); // 마구잡이 시도를 늦춤

export async function handleLogin(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return fail(405, "method");
  if (!env.adminPassword) return fail(503, "관리자 비밀번호가 아직 설정되지 않았습니다.");
  const body = await readLogin(req);
  const okId = sameText(str(body?.id), env.adminId);
  const okPw = sameText(str(body?.password), env.adminPassword);
  if (!(okId && okPw)) { await slow(); return fail(401, "아이디 또는 비밀번호가 맞지 않습니다."); }
  return json(makeToken("admin", env.adminPassword, ADMIN_DAYS));
}

// 헌금명단 열람 비밀번호 확인
export async function handleOfferingLogin(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return fail(405, "method");
  if (!env.offeringPassword) return fail(503, "헌금명단 비밀번호가 아직 설정되지 않았습니다.");
  const body = await readLogin(req);
  if (!sameText(str(body?.password), env.offeringPassword)) { await slow(); return fail(401, "비밀번호가 맞지 않습니다."); }
  return json(makeToken("viewer", env.offeringPassword, VIEWER_DAYS));
}

// ---------- 본문 읽기 ----------
async function readJSON(req: Request): Promise<any> {
  const text = await req.text();
  if (text.length > MAX_JSON) throw new Error("too large");
  return JSON.parse(text);
}

type IndexRow = { date: string; issue: string; published: boolean };
const getIndex = async (kv: KV): Promise<IndexRow[]> => (await kv.getJSON("index")) || [];
const getRoster = async (kv: KV): Promise<any[]> => (await kv.getJSON("roster")) || [];
const inRange = (rows: any[], from: string | null, to: string | null) =>
  rows.filter((r) => (!isDate(from) || r.date >= from) && (!isDate(to) || r.date <= to));
// 헌금 명단은 주보와 따로(offering/날짜) 보관하고, 주보를 내보낼 때는 항상 빼고 보냅니다.
type Offering = { category: string; names: string };
function cleanOfferings(v: unknown): Offering[] {
  return (Array.isArray(v) ? v : []).slice(0, 60)
    .map((o: any) => ({ category: str(o?.category, 80), names: str(o?.names, 6000) }))
    .filter((o) => o.category || o.names);
}
function withoutOfferings(b: any): any {
  if (!b || !b.content || !("offerings" in b.content)) return b;
  const { offerings, ...content } = b.content;
  return { ...b, content };
}
async function getOfferings(kv: KV, date: string, bulletin?: any): Promise<Offering[]> {
  const saved = await kv.getJSON("offering/" + date);
  if (saved) return saved;
  return cleanOfferings((bulletin ?? (await kv.getJSON("bulletin/" + date)))?.content?.offerings); // 예전 방식으로 저장된 주보
}

function plusDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- 요청 처리 ----------
export async function handle(req: Request, kv: KV, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [head, arg] = parts;
  const method = req.method;
  const admin = isAdmin(req, env);
  const needAdmin = () => (admin ? null : fail(401, "로그인이 필요합니다."));

  try {
    if (head === "login") return handleLogin(req, env);
    if (head === "offerings" && arg === "login") return handleOfferingLogin(req, env);
    if (head === "session" && method === "GET") return admin ? json({ ok: true }) : fail(401, "로그인이 필요합니다.");

    // 한 번에 불러오기: 설정 + 주보(지정 날짜 또는 최신) + 그 주부터 8주 명단 + 공개된 주보 목록
    if (head === "view" && method === "GET") {
      const index = await getIndex(kv);
      const want = url.searchParams.get("d");
      const row = isDate(want) ? index.find((r) => r.date === want && r.published) : index.find((r) => r.published);
      const [settings, bulletin, roster] = await Promise.all([
        kv.getJSON("settings"),
        row ? kv.getJSON("bulletin/" + row.date) : null,
        getRoster(kv),
      ]);
      return json({
        settings,
        bulletin: withoutOfferings(bulletin),
        roster: bulletin ? inRange(roster, bulletin.date, plusDays(bulletin.date, 56)) : [],
        list: index.filter((r) => r.published),
      });
    }

    if (head === "settings") {
      if (method === "GET") return json({ data: await kv.getJSON("settings") });
      if (method === "PUT") {
        const no = needAdmin(); if (no) return no;
        const data = await readJSON(req);
        if (!data || typeof data !== "object" || Array.isArray(data)) return fail(400, "형식이 올바르지 않습니다.");
        await kv.setJSON("settings", data);
        return json({ ok: true });
      }
    }

    if (head === "bulletins") {
      if (!arg && method === "GET") {
        const index = await getIndex(kv);
        return json(admin ? index : index.filter((r) => r.published));
      }
      if (arg === "latest" && method === "GET") {
        const row = (await getIndex(kv)).find((r) => r.published);
        return json(row ? withoutOfferings(await kv.getJSON("bulletin/" + row.date)) : null);
      }
      if (!isDate(arg)) return fail(400, "날짜가 올바르지 않습니다.");
      if (method === "GET") {
        const b = await kv.getJSON("bulletin/" + arg);
        if (!b || !(b.published || admin)) return json(null);
        // 헌금 명단은 관리자에게만 함께 보냄
        return json(admin ? { ...withoutOfferings(b), offerings: await getOfferings(kv, arg, b) } : withoutOfferings(b));
      }
      const no = needAdmin(); if (no) return no;
      if (method === "PUT") {
        const body = await readJSON(req);
        if (!body || typeof body.content !== "object" || !body.content) return fail(400, "형식이 올바르지 않습니다.");
        const row = withoutOfferings({ date: arg, issue: str(body.issue, 60), published: !!body.published, content: body.content });
        await kv.setJSON("offering/" + arg, cleanOfferings(body.offerings ?? body.content.offerings));
        await kv.setJSON("bulletin/" + arg, row);
        const index = (await getIndex(kv)).filter((r) => r.date !== arg);
        index.push({ date: arg, issue: row.issue, published: row.published });
        index.sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신순
        await kv.setJSON("index", index);
        return json({ ok: true });
      }
      if (method === "DELETE") {
        await kv.remove("bulletin/" + arg);
        await kv.remove("offering/" + arg);
        await kv.setJSON("index", (await getIndex(kv)).filter((r) => r.date !== arg));
        return json({ ok: true });
      }
    }

    // 헌금명단: 열람 비밀번호를 넣은 사람(또는 관리자)만, 공개된 주보의 명단만 볼 수 있음
    if (head === "offerings" && !arg && method === "GET") {
      if (!(admin || isViewer(req, env))) return fail(401, "비밀번호가 필요합니다.");
      const list = (await getIndex(kv)).filter((r) => r.published);
      const want = url.searchParams.get("d");
      const row = isDate(want) ? list.find((r) => r.date === want) : list[0];
      return json({ date: row?.date ?? null, issue: row?.issue ?? "", offerings: row ? await getOfferings(kv, row.date) : [], list });
    }

    // 생일 명단(1년치): 전체 명단은 관리자만 볼 수 있음. 주보에는 그 주 생일자만 실림.
    if (head === "birthdays") {
      const no = needAdmin(); if (no) return no;
      if (method === "GET") return json((await kv.getJSON("birthdays")) || []);
      if (method === "PUT") {
        const body = await readJSON(req);
        const list = (Array.isArray(body) ? body : []).slice(0, 3000)
          .map((p: any) => ({ name: str(p?.name, 60).trim(), month: Math.trunc(Number(p?.month)), day: Math.trunc(Number(p?.day)), lunar: !!p?.lunar }))
          .filter((p) => p.name && p.month >= 1 && p.month <= 12 && p.day >= 1 && p.day <= 31)
          .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, "ko"));
        await kv.setJSON("birthdays", list);
        return json({ ok: true });
      }
    }

    if (head === "roster") {
      if (method === "GET") return json(inRange(await getRoster(kv), url.searchParams.get("from"), url.searchParams.get("to")));
      if (method === "POST") {
        const no = needAdmin(); if (no) return no;
        const body = await readJSON(req);
        const map = new Map<string, any>((await getRoster(kv)).map((r) => [r.date, r]));
        for (const d of Array.isArray(body?.deleted) ? body.deleted : []) if (isDate(d)) map.delete(d);
        for (const r of Array.isArray(body?.rows) ? body.rows : []) {
          if (!isDate(r?.date)) continue;
          map.set(r.date, { date: r.date, prayer1: str(r.prayer1), prayer2: str(r.prayer2), reader2: str(r.reader2), dish: str(r.dish) });
        }
        await kv.setJSON("roster", [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1)));
        return json({ ok: true });
      }
    }

    if (head === "images" && arg && /^[\w.-]{1,80}$/.test(arg)) {
      if (method === "GET") {
        const img = await kv.getBinary("image/" + arg);
        if (!img) return fail(404, "not found");
        return new Response(img.data, {
          headers: { "content-type": IMAGE_TYPES.includes(img.type) ? img.type : "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
        });
      }
      if (method === "POST") {
        const no = needAdmin(); if (no) return no;
        const type = (req.headers.get("content-type") || "").split(";")[0].trim();
        if (!IMAGE_TYPES.includes(type)) return fail(400, "PNG, JPG, WEBP 이미지만 올릴 수 있습니다.");
        const data = await req.arrayBuffer();
        if (data.byteLength === 0 || data.byteLength > MAX_IMAGE) return fail(400, "이미지는 4MB 이하여야 합니다.");
        await kv.setBinary("image/" + arg, data, type);
        return json({ url: "/api/images/" + arg });
      }
    }

    return fail(404, "not found");
  } catch (e) {
    console.error("api error", method, url.pathname, e);
    return fail(e instanceof SyntaxError || (e as Error)?.message === "too large" ? 400 : 500, "요청을 처리하지 못했습니다.");
  }
}
