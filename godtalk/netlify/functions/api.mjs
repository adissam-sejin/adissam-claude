/* ────────────────────────────────────────────────
   하나님과의 대화 — 서버 (Netlify Function)

   · 카카오 로그인으로 사람을 구분합니다.
   · 기록은 기본으로 Netlify Blobs에 암호화해 두고,
     노션을 연결한 사람은 자기 노션 데이터베이스에 저장합니다.
   · 비밀값은 전부 Netlify 환경변수에서 읽습니다. 이 파일에는 아무 값도 적지 않습니다.

   환경변수
     APP_SECRET            (필수) 로그인 쿠키 서명·기록 암호화 열쇠. 한번 정하면 바꾸지 않습니다.
     KAKAO_REST_KEY        (필수) 카카오 REST API 키
     KAKAO_CLIENT_SECRET   (카카오에서 클라이언트 시크릿을 켰다면 필수)
     OWNER_CODE            (선택) 기존 노션 기록을 이어받을 때 쓰는 일회용 코드
     NOTION_TOKEN / NOTION_DB  (선택) 주인 계정이 쓰는 기존 노션 데이터베이스
   ──────────────────────────────────────────────── */

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const env = (k) => {
  try {
    if (typeof Netlify !== "undefined" && Netlify.env) {
      const v = Netlify.env.get(k);
      if (v) return v;
    }
  } catch (e) { /* 로컬 시험 환경 */ }
  return process.env[k] || "";
};

const KAUTH = () => env("KAKAO_AUTH_BASE") || "https://kauth.kakao.com";
const KAPI = () => env("KAKAO_API_BASE") || "https://kapi.kakao.com";
const NOTION = () => env("NOTION_API_BASE") || "https://api.notion.com";
const NOTION_V = "2022-06-28";

const SESSION_COOKIE = "gt_s";
const STATE_COOKIE = "gt_o";
const SESSION_DAYS = 90;
const DAY_MS = 86400000;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const FAV_COLOR = "yellow_background";
const MAX_TEXT = 5000;
const MAX_PER_DAY = 400;

/* ── 저장소 ── */
const store = () => globalThis.__GODTALK_STORE__ || getStore({ name: "godtalk", consistency: "strong" });
const getJSON = async (key) => {
  const raw = await store().get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
};
const setJSON = (key, val) => store().set(key, JSON.stringify(val));

/* ── 암호 도구 ── */
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const keyFor = (purpose) => Buffer.from(crypto.hkdfSync("sha256", env("APP_SECRET"), "godtalk", purpose, 32));
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function seal(text, purpose) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyFor(purpose), iv);
  const ct = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return "v1." + b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}
function open(sealed, purpose) {
  if (typeof sealed !== "string" || !sealed.startsWith("v1.")) throw new Error("bad seal");
  const raw = Buffer.from(sealed.slice(3), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", keyFor(purpose), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

const sign = (data) => b64u(crypto.createHmac("sha256", keyFor("session")).update(data).digest());
function makeToken(payload) {
  const body = b64u(JSON.stringify(payload));
  return body + "." + sign(body);
}
function readToken(tok) {
  if (!tok || tok.indexOf(".") < 0) return null;
  const [body, sig] = tok.split(".");
  if (!safeEq(sig, sign(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p && p.e > Date.now() ? p : null;
  } catch (e) { return null; }
}

const hashPin = (pin, salt) => crypto.scryptSync(String(pin), Buffer.from(salt, "hex"), 32).toString("hex");

/* ── 응답 도구 ── */
function cookies(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function cookie(name, value, maxAgeSec, secure) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}` + (secure ? "; Secure" : "");
}
function json(body, setCookies) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const c of setCookies || []) h.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status: 200, headers: h });
}
function redirect(to, setCookies) {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  for (const c of setCookies || []) h.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers: h });
}

class Oops extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/* ── 입력 검사 ── */
const isDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const isYm = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const isNotionId = (s) => typeof s === "string" && /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(s);
const need = (ok, message) => { if (!ok) throw new Oops("bad", message || "요청을 읽지 못했어요"); };

function cleanMsg(b) {
  need(b.who === "god" || b.who === "me");
  need(typeof b.text === "string");
  const text = b.text.replace(/\r\n/g, "\n").trim();
  need(text.length > 0, "빈 글은 저장하지 않아요");
  need(text.length <= MAX_TEXT, "글이 너무 길어요. 나누어 적어 주세요");
  const ref = b.who === "god" && typeof b.ref === "string" ? b.ref.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  const time = typeof b.time === "string" && /^(오전|오후) \d{1,2}:\d{2}$/.test(b.time) ? b.time : "";
  return { who: b.who, text, ref, time };
}

/* ══════════════════════════════════════════════
   저장 방식 1 — Netlify (기본)
   한 달에 한 덩어리로 암호화해 둡니다.
   ══════════════════════════════════════════════ */
function cloudBackend(uid) {
  const prefix = `d/${uid}/`;
  const load = async (ym) => {
    const raw = await store().get(prefix + ym);
    if (!raw) return { days: {} };
    return JSON.parse(open(raw, "data:" + uid));
  };
  const save = async (ym, doc) => {
    for (const d of Object.keys(doc.days)) if (!doc.days[d].length) delete doc.days[d];
    if (!Object.keys(doc.days).length) return store().delete(prefix + ym);
    return store().set(prefix + ym, seal(JSON.stringify(doc), "data:" + uid));
  };
  const months = async () => {
    const { blobs } = await store().list({ prefix });
    return blobs.map((b) => b.key.slice(prefix.length)).filter(isYm).sort();
  };
  const change = async (date, id, fn) => {
    const ym = date.slice(0, 7), doc = await load(ym);
    const list = doc.days[date] || [];
    const i = list.findIndex((m) => m.id === id);
    if (i < 0) throw new Oops("gone", "이미 지워진 글이에요");
    fn(list, i);
    await save(ym, doc);
  };

  return {
    kind: "cloud",
    async month(ym) {
      const doc = await load(ym);
      return Object.keys(doc.days).filter((d) => doc.days[d].length).sort();
    },
    async day(date) {
      const doc = await load(date.slice(0, 7));
      return { pageId: null, messages: doc.days[date] || [] };
    },
    async add(date, msg) {
      const ym = date.slice(0, 7), doc = await load(ym);
      const full = { id: crypto.randomUUID(), ...msg };
      if ((doc.days[date] || []).length >= MAX_PER_DAY) throw new Oops("bad", "하루에 적을 수 있는 만큼 다 적었어요");
      (doc.days[date] = doc.days[date] || []).push(full);
      await save(ym, doc);
      return { id: full.id, pageId: null };
    },
    edit: (date, id, text) => change(date, id, (l, i) => { l[i].text = text; }),
    del: (date, id) => change(date, id, (l, i) => { l.splice(i, 1); }),
    fav: (date, id, on) => change(date, id, (l, i) => { if (on) l[i].fav = true; else delete l[i].fav; }),
    async allDates() {
      const docs = await Promise.all((await months()).map(load));
      return docs.flatMap((d) => Object.keys(d.days).filter((k) => d.days[k].length)).sort();
    },
    async search(q, cursor) {
      const list = (await months()).reverse();
      let i = Math.max(0, parseInt(cursor, 10) || 0);
      const end = Math.min(list.length, i + 12), hits = [];
      for (; i < end; i++) {
        const doc = await load(list[i]);
        for (const date of Object.keys(doc.days).sort().reverse())
          for (const m of doc.days[date]) if (matches(m, q)) hits.push({ date, ...m });
      }
      return { hits, cursor: i < list.length ? String(i) : null };
    },
    async takeDay(date) {
      const ym = date.slice(0, 7), doc = await load(ym);
      return { list: doc.days[date] || [], drop: async () => { delete doc.days[date]; await save(ym, doc); } };
    },
    async wipe() {
      for (const ym of await months()) await store().delete(prefix + ym);
    },
  };
}

const matches = (m, q) => (m.text + "\n" + (m.ref || "")).toLowerCase().includes(q);

/* ══════════════════════════════════════════════
   저장 방식 2 — 노션
   하루에 페이지 하나, 대화 한 줄이 문단 하나.
   (처음 버전과 똑같은 모양이라 예전 기록이 그대로 읽힙니다)
   ══════════════════════════════════════════════ */
const plain = (rich) => (rich && rich.length ? rich.map((r) => r.plain_text).join("") : "");

function dayTitle(date) {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

function richText(msg) {
  const parts = [{ text: { content: `${msg.who === "god" ? "하나님" : "나"}: ` }, annotations: { bold: true } }];
  const body = String(msg.text);
  for (let i = 0; i < body.length; i += 1800) parts.push({ text: { content: body.slice(i, i + 1800) } });
  if (msg.ref) parts.push({ text: { content: `\n— ${msg.ref}` }, annotations: { italic: true, color: "gray" } });
  if (msg.time) parts.push({ text: { content: `  ${msg.time}` }, annotations: { color: "gray" } });
  return parts;
}
const toBlock = (msg) => ({
  object: "block", type: "paragraph",
  paragraph: { rich_text: richText(msg), color: msg.fav ? FAV_COLOR : "default" },
});

function fromBlock(b) {
  if (!b || b.type !== "paragraph") return null;
  let txt = plain(b.paragraph.rich_text);
  if (!txt.trim()) return null;

  let time = "";
  const mt = txt.match(/\s\s(오전|오후)\s(\d{1,2}:\d{2})\s*$/);
  if (mt) { time = `${mt[1]} ${mt[2]}`; txt = txt.slice(0, mt.index); }

  let ref = "";
  const mr = txt.match(/\n—\s*(.+)$/);
  if (mr) { ref = mr[1].trim(); txt = txt.slice(0, mr.index); }

  let who = "me";
  if (txt.startsWith("하나님: ")) { who = "god"; txt = txt.slice(5); }
  else if (txt.startsWith("나: ")) { txt = txt.slice(3); }

  const out = { id: b.id, who, text: txt, ref, time };
  if (b.paragraph.color === FAV_COLOR) out.fav = true;
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

function notionClient(token) {
  return async function call(path, method, payload, retry) {
    let res;
    try {
      res = await fetch(`${NOTION()}/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_V, "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) { throw new Oops("notion", "노션이 응답하지 않았어요. 잠시 뒤 다시 해보세요"); }
    if (res.status === 429 && !retry) {
      const wait = Math.min(2500, (parseFloat(res.headers.get("retry-after")) || 1) * 1000);
      await new Promise((r) => setTimeout(r, wait));
      return call(path, method, payload, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) throw new Oops("notion", "노션 토큰이 맞지 않아요. 토큰을 다시 확인해 주세요");
      if (res.status === 404) throw new Oops("notion", "노션에서 찾지 못했어요. 데이터베이스에 연결(Connection)을 붙였는지 확인해 주세요");
      throw new Oops("notion", data && data.message ? data.message : "노션이 응답하지 않았어요");
    }
    return data;
  };
}

function notionBackend({ token, db, pTitle, pDate }) {
  const api = notionClient(token);

  const readChildren = async (pageId) => {
    const out = [];
    let cursor;
    for (let i = 0; i < 20; i++) {
      const q = cursor ? `?start_cursor=${cursor}&page_size=100` : "?page_size=100";
      const data = await api(`blocks/${pageId}/children${q}`, "GET");
      out.push(...data.results);
      if (!data.has_more) break;
      cursor = data.next_cursor;
    }
    return out;
  };
  const dateOf = (pg) => {
    const d = pg.properties && pg.properties[pDate];
    return d && d.date && d.date.start ? d.date.start.slice(0, 10) : null;
  };
  const queryAll = async (filter) => {
    const out = [];
    let cursor;
    for (let i = 0; i < 40; i++) {
      const body = { page_size: 100 };
      if (filter) body.filter = filter;
      if (cursor) body.start_cursor = cursor;
      const data = await api(`databases/${db}/query`, "POST", body);
      out.push(...data.results);
      if (!data.has_more) break;
      cursor = data.next_cursor;
    }
    return out;
  };
  const dayPages = async (date) => {
    const r = await api(`databases/${db}/query`, "POST", {
      page_size: 5, filter: { property: pDate, date: { equals: date } },
    });
    return r.results.map((p) => p.id);
  };
  const createPage = async (date, children) => {
    const props = {};
    props[pTitle] = { title: [{ text: { content: dayTitle(date) } }] };
    props[pDate] = { date: { start: date } };
    return api("pages", "POST", { parent: { database_id: db }, properties: props, children });
  };
  const rewrite = async (id, fn) => {
    const cur = fromBlock(await api(`blocks/${id}`, "GET"));
    if (!cur) throw new Oops("gone", "이 글은 앱에서 고칠 수 없는 모양이에요");
    const next = fn(cur);
    await api(`blocks/${id}`, "PATCH", { paragraph: { rich_text: richText(next), color: next.fav ? FAV_COLOR : "default" } });
  };

  return {
    kind: "notion",
    async month(ym) {
      const [y, m] = ym.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const pages = await queryAll({ and: [
        { property: pDate, date: { on_or_after: `${ym}-01` } },
        { property: pDate, date: { on_or_before: `${ym}-${String(last).padStart(2, "0")}` } },
      ] });
      return [...new Set(pages.map(dateOf).filter(Boolean))].sort();
    },
    async day(date) {
      const ids = await dayPages(date);
      if (!ids.length) return { pageId: null, messages: [] };
      const lists = await mapLimit(ids, 3, readChildren);
      return { pageId: ids[0], messages: lists.flat().map(fromBlock).filter(Boolean) };
    },
    async add(date, msg, pageHint) {
      let pageId = isNotionId(pageHint) ? pageHint : (await dayPages(date))[0];
      if (!pageId) {
        const page = await createPage(date, [toBlock(msg)]);
        const kids = await readChildren(page.id);
        return { pageId: page.id, id: kids.length ? kids[kids.length - 1].id : null };
      }
      const r = await api(`blocks/${pageId}/children`, "PATCH", { children: [toBlock(msg)] });
      return { pageId, id: r.results && r.results.length ? r.results[0].id : null };
    },
    async edit(date, id, text) { need(isNotionId(id)); await rewrite(id, (m) => ({ ...m, text })); },
    async fav(date, id, on) { need(isNotionId(id)); await rewrite(id, (m) => ({ ...m, fav: !!on })); },
    async del(date, id) { need(isNotionId(id)); await api(`blocks/${id}`, "DELETE"); },
    async allDates() {
      return [...new Set((await queryAll()).map(dateOf).filter(Boolean))].sort();
    },
    async search(q, cursor) {
      const body = { page_size: 12, sorts: [{ property: pDate, direction: "descending" }] };
      if (isNotionId(cursor)) body.start_cursor = cursor;
      const data = await api(`databases/${db}/query`, "POST", body);
      const pages = data.results.map((p) => ({ id: p.id, date: dateOf(p) })).filter((p) => p.date);
      const lists = await mapLimit(pages, 3, (p) => readChildren(p.id));
      const hits = [];
      pages.forEach((p, i) => {
        for (const m of lists[i].map(fromBlock).filter(Boolean)) if (matches(m, q)) hits.push({ date: p.date, ...m });
      });
      return { hits, cursor: data.has_more ? data.next_cursor : null };
    },
    async appendDay(date, msgs) {
      let pageId = (await dayPages(date))[0];
      let rest = msgs.map(toBlock);
      if (!pageId) { pageId = (await createPage(date, rest.slice(0, 90))).id; rest = rest.slice(90); }
      for (let i = 0; i < rest.length; i += 90)
        await api(`blocks/${pageId}/children`, "PATCH", { children: rest.slice(i, i + 90) });
    },
  };
}

/* 노션 데이터베이스가 쓸 수 있는 모양인지 살핍니다 */
async function inspectNotion(token, db) {
  const api = notionClient(token);
  let info = await api(`databases/${db}`, "GET");
  const props = info.properties || {};
  const names = Object.keys(props);
  const pTitle = names.find((n) => props[n].type === "title");
  let pDate = props["날짜"] && props["날짜"].type === "date" ? "날짜" : names.find((n) => props[n].type === "date");
  if (!pDate) {
    const add = props["날짜"] ? "대화 날짜" : "날짜";
    try {
      info = await api(`databases/${db}`, "PATCH", { properties: { [add]: { date: {} } } });
      pDate = add;
    } catch (e) {
      throw new Oops("notion", "데이터베이스에 '날짜' 속성(종류: 날짜)을 하나 만들어 주세요");
    }
  }
  if (!pTitle) throw new Oops("notion", "제목 속성을 찾지 못했어요. 표 데이터베이스가 맞는지 확인해 주세요");
  return { title: plain(info.title) || "데이터베이스", pTitle, pDate };
}

function pickDbId(input) {
  const s = String(input || "").trim().split(/[?#]/)[0];
  const m = s.match(/([0-9a-f]{32})\/?$/i)
    || s.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  return m ? m[1].replace(/-/g, "").toLowerCase() : null;
}

/* ── 사람 ── */
const userKey = (uid) => `u/${uid}`;
const getUser = (uid) => getJSON(userKey(uid));
const saveUser = (u) => setJSON(userKey(u.id), u);

const ownerNotion = () => (env("NOTION_TOKEN") && env("NOTION_DB")
  ? { token: env("NOTION_TOKEN"), db: pickDbId(env("NOTION_DB")), pTitle: "제목", pDate: "날짜" } : null);

function backendFor(user) {
  if (user.owner && ownerNotion()) return notionBackend(ownerNotion());
  if (user.notion) {
    return notionBackend({
      token: open(user.notion.tok, "notion:" + user.id),
      db: user.notion.db, pTitle: user.notion.pTitle, pDate: user.notion.pDate,
    });
  }
  return cloudBackend(user.id);
}

function publicUser(user, sess) {
  const viaOwner = !!(user.owner && ownerNotion());
  return {
    nick: user.nick || "",
    tag: sign("tag:" + user.id).slice(0, 12),
    owner: !!user.owner,
    storage: viaOwner || user.notion ? "notion" : "cloud",
    notionTitle: viaOwner ? "" : (user.notion ? user.notion.title : ""),
    notionFixed: viaOwner,
    hasPin: !!user.pin,
    locked: !!user.pin && !sess.p,
    favDays: (user.favDays || []).length,
  };
}

const sessionCookie = (user, unlocked, secure) =>
  cookie(SESSION_COOKIE, makeToken({ u: user.id, v: user.sv || 1, p: unlocked ? 1 : 0, e: Date.now() + SESSION_DAYS * DAY_MS }), SESSION_DAYS * 86400, secure);

/* ── 카카오 로그인 ── */
function siteOrigin(url) {
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return (local ? url.protocol : "https:") + "//" + url.host;
}
const redirectUri = (url) => siteOrigin(url) + "/api/auth/kakao/callback";

function kakaoStart(url, secure) {
  if (!env("KAKAO_REST_KEY") || !env("APP_SECRET")) return redirect("/?e=setup");
  const state = crypto.randomBytes(16).toString("hex");
  const reset = url.searchParams.get("reset") === "1";
  const q = new URLSearchParams({
    response_type: "code", client_id: env("KAKAO_REST_KEY"), redirect_uri: redirectUri(url), state,
  });
  if (reset) q.set("prompt", "login");
  return redirect(`${KAUTH()}/oauth/authorize?${q}`, [cookie(STATE_COOKIE, state + (reset ? ".r" : ".n"), 600, secure)]);
}

async function kakaoCallback(req, url, secure) {
  const clear = cookie(STATE_COOKIE, "", 0, secure);
  const [state, mode] = (cookies(req)[STATE_COOKIE] || "").split(".");
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return redirect("/?e=cancel", [clear]);
  if (!state || !safeEq(state, url.searchParams.get("state") || "")) return redirect("/?e=state", [clear]);

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code", client_id: env("KAKAO_REST_KEY"), redirect_uri: redirectUri(url), code,
    });
    if (env("KAKAO_CLIENT_SECRET")) form.set("client_secret", env("KAKAO_CLIENT_SECRET"));
    const tr = await fetch(`${KAUTH()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: form.toString(), signal: AbortSignal.timeout(15000),
    });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || !tok.access_token) {
      console.error("kakao token", tr.status, tok.error, tok.error_code, tok.error_description);
      return redirect("/?e=kakao", [clear]);
    }
    const mr = await fetch(`${KAPI()}/v2/user/me`, {
      headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(15000),
    });
    const me = await mr.json().catch(() => ({}));
    if (!mr.ok || me.id === undefined || me.id === null) return redirect("/?e=kakao", [clear]);

    const uid = "k" + String(me.id).replace(/[^0-9A-Za-z]/g, "");
    const nick = String((me.kakao_account && me.kakao_account.profile && me.kakao_account.profile.nickname)
      || (me.properties && me.properties.nickname) || "").slice(0, 30);
    const now = new Date().toISOString();
    const user = (await getUser(uid)) || { id: uid, createdAt: now, sv: 1, notion: null, pin: null, favDays: [] };
    if (nick) user.nick = nick;
    user.lastLoginAt = now;
    if (mode === "r") { user.pin = null; user.pinFails = 0; user.pinLockUntil = 0; }
    await saveUser(user);
    return redirect("/" + (mode === "r" ? "?e=pinreset" : ""), [clear, sessionCookie(user, !user.pin, secure)]);
  } catch (e) {
    console.error("kakao callback", e && e.message);
    return redirect("/?e=kakao", [clear]);
  }
}

/* ── 비밀번호(앱 잠금) ── */
async function checkPin(user, pin) {
  const now = Date.now();
  if (user.pinLockUntil && user.pinLockUntil > now)
    throw new Oops("pinlock", `여러 번 틀렸어요. ${Math.ceil((user.pinLockUntil - now) / 60000)}분 뒤 다시 해보세요`);
  if (typeof pin === "string" && safeEq(hashPin(pin, user.pin.salt), user.pin.hash)) {
    if (user.pinFails) { user.pinFails = 0; user.pinLockUntil = 0; await saveUser(user); }
    return;
  }
  user.pinFails = (user.pinFails || 0) + 1;
  if (user.pinFails >= 5) { user.pinFails = 0; user.pinLockUntil = now + 5 * 60000; }
  await saveUser(user);
  throw new Oops(user.pinLockUntil > now ? "pinlock" : "pin",
    user.pinLockUntil > now ? "여러 번 틀렸어요. 5분 뒤 다시 해보세요" : "비밀번호가 달라요");
}
const validPin = (p) => typeof p === "string" && /^\d{4,8}$/.test(p);

/* ── 앱이 부르는 요청들 ── */
async function rpc(req, url, secure) {
  const origin = req.headers.get("origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch (e) { /* 아래에서 막힘 */ }
    if (host !== url.host) return json({ error: "bad", message: "허용되지 않은 곳에서 온 요청이에요" });
  }
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: "bad", message: "요청을 읽지 못했어요" }); }
  if (!b || typeof b !== "object") return json({ error: "bad", message: "요청을 읽지 못했어요" });

  const ready = { kakao: !!env("KAKAO_REST_KEY"), secret: env("APP_SECRET").length >= 16 };
  if (!ready.secret) {
    return json(b.action === "me" ? { ready, user: null }
      : { error: "setup", message: "서버 설정(APP_SECRET)이 아직이에요" });
  }

  const sess = readToken(cookies(req)[SESSION_COOKIE]);
  let user = sess ? await getUser(sess.u) : null;
  if (user && (user.sv || 1) !== sess.v) user = null;
  const out = [];

  try {
    if (b.action === "me") {
      if (!user) return json({ ready, user: null });
      if (sess.e - Date.now() < (SESSION_DAYS - 30) * DAY_MS) out.push(sessionCookie(user, !!sess.p, secure));
      return json({ ready, user: publicUser(user, sess) }, out);
    }
    if (!user) return json({ error: "auth", message: "다시 로그인해 주세요" });

    if (b.action === "logout") return json({ ok: true }, [cookie(SESSION_COOKIE, "", 0, secure)]);

    /* 잠금 */
    if (b.action === "unlock") {
      if (!user.pin) return json({ ok: true });
      await checkPin(user, b.pin);
      return json({ ok: true }, [sessionCookie(user, true, secure)]);
    }
    if (user.pin && !sess.p) return json({ error: "locked", message: "잠겨 있어요" });

    if (b.action === "lock") {
      return json({ ok: true }, user.pin ? [sessionCookie(user, false, secure)] : []);
    }
    if (b.action === "setPin") {
      need(validPin(b.pin), "숫자 4~8자리로 정해 주세요");
      if (user.pin) await checkPin(user, b.current);
      const salt = crypto.randomBytes(16).toString("hex");
      user.pin = { salt, hash: hashPin(b.pin, salt) };
      user.pinFails = 0; user.pinLockUntil = 0;
      user.sv = (user.sv || 1) + 1; /* 다른 기기는 다시 로그인하고 비밀번호를 눌러야 열립니다 */
      await saveUser(user);
      return json({ ok: true }, [sessionCookie(user, true, secure)]);
    }
    if (b.action === "clearPin") {
      if (user.pin) await checkPin(user, b.current);
      user.pin = null; user.pinFails = 0; user.pinLockUntil = 0;
      await saveUser(user);
      return json({ ok: true }, [sessionCookie(user, true, secure)]);
    }

    /* 기존 기록 이어받기 (주인 한 사람만) */
    if (b.action === "claim") {
      const code = env("OWNER_CODE");
      if (!code || code.length < 12 || typeof b.code !== "string" || !safeEq(b.code, code))
        throw new Oops("bad", "코드가 맞지 않아요");
      if (!ownerNotion()) throw new Oops("setup", "이어받을 노션 설정이 서버에 없어요");
      const cur = await getJSON("sys/owner");
      if (cur && cur.uid !== user.id) throw new Oops("bad", "이미 다른 계정이 이어받았어요");
      await setJSON("sys/owner", { uid: user.id, at: new Date().toISOString() });
      user.owner = true;
      await saveUser(user);
      return json({ ok: true, user: publicUser(user, sess) });
    }

    /* 노션 연결 */
    if (b.action === "notionConnect") {
      const token = String(b.token || "").trim();
      const db = pickDbId(b.db);
      need(/^[A-Za-z0-9_-]{20,200}$/.test(token), "토큰을 다시 확인해 주세요. ntn_ 으로 시작하는 긴 글자예요");
      need(db, "데이터베이스 주소(또는 32자리 ID)를 다시 확인해 주세요");
      const info = await inspectNotion(token, db);
      user.notion = { tok: seal(token, "notion:" + user.id), db, title: info.title, pTitle: info.pTitle, pDate: info.pDate };
      await saveUser(user);
      const cloudDays = (await cloudBackend(user.id).allDates()).length;
      return json({ ok: true, title: info.title, cloudDays, user: publicUser(user, sess) });
    }
    if (b.action === "notionCheck") {
      const o = user.owner && ownerNotion();
      if (!o && !user.notion) return json({ ok: false });
      const info = await inspectNotion(o ? o.token : open(user.notion.tok, "notion:" + user.id), o ? o.db : user.notion.db);
      return json({ ok: true, title: info.title });
    }
    if (b.action === "notionDisconnect") {
      user.notion = null;
      await saveUser(user);
      return json({ ok: true, user: publicUser(user, sess) });
    }
    if (b.action === "cloudDates") {
      return json({ dates: await cloudBackend(user.id).allDates() });
    }
    if (b.action === "moveDay") {
      need(isDate(b.date));
      const be = backendFor(user);
      if (be.kind !== "notion") throw new Oops("bad", "노션이 연결되어 있지 않아요");
      const { list, drop } = await cloudBackend(user.id).takeDay(b.date);
      if (list.length) { await be.appendDay(b.date, list); await drop(); }
      return json({ ok: true, moved: list.length });
    }

    if (b.action === "deleteAccount") {
      await cloudBackend(user.id).wipe();
      if (user.owner) await store().delete("sys/owner");
      await store().delete(userKey(user.id));
      return json({ ok: true }, [cookie(SESSION_COOKIE, "", 0, secure)]);
    }

    /* 기록 */
    const be = backendFor(user);

    if (b.action === "month") {
      need(isYm(b.ym));
      return json({ days: await be.month(b.ym) });
    }
    if (b.action === "day") {
      need(isDate(b.date));
      return json(await be.day(b.date));
    }
    if (b.action === "add") {
      need(isDate(b.date));
      return json(await be.add(b.date, cleanMsg(b), b.pageId));
    }
    if (b.action === "edit") {
      need(isDate(b.date) && typeof b.id === "string" && typeof b.text === "string");
      const text = b.text.replace(/\r\n/g, "\n").trim();
      need(text.length > 0 && text.length <= MAX_TEXT, "글 길이를 확인해 주세요");
      await be.edit(b.date, b.id, text);
      return json({ ok: true });
    }
    if (b.action === "del") {
      need(isDate(b.date) && typeof b.id === "string");
      await be.del(b.date, b.id);
      return json({ ok: true });
    }
    if (b.action === "fav") {
      need(isDate(b.date) && typeof b.id === "string");
      await be.fav(b.date, b.id, !!b.on);
      const set = new Set(user.favDays || []);
      if (b.on && !set.has(b.date)) {
        set.add(b.date);
        user.favDays = [...set].sort();
        await saveUser(user);
      }
      return json({ ok: true });
    }
    if (b.action === "favs") {
      const days = (user.favDays || []).slice().sort().reverse();
      const start = Math.max(0, parseInt(b.cursor, 10) || 0);
      const chunk = days.slice(start, start + 8);
      const loaded = await mapLimit(chunk, 2, (d) => be.day(d));
      const hits = [], empty = [];
      chunk.forEach((d, i) => {
        const favs = loaded[i].messages.filter((m) => m.fav);
        if (!favs.length) empty.push(d);
        for (const m of favs) hits.push({ date: d, ...m });
      });
      if (empty.length) {
        user.favDays = (user.favDays || []).filter((d) => !empty.includes(d));
        await saveUser(user);
      }
      const next = start + chunk.length - empty.length;
      return json({ hits, cursor: start + chunk.length < days.length ? String(next) : null });
    }
    if (b.action === "dates") {
      return json({ dates: await be.allDates() });
    }
    if (b.action === "search") {
      const q = String(b.q || "").trim().toLowerCase();
      need(q.length >= 1 && q.length <= 50, "찾을 낱말을 적어 주세요");
      return json(await be.search(q, b.cursor));
    }

    return json({ error: "bad", message: "모르는 요청이에요" });
  } catch (e) {
    if (e instanceof Oops) return json({ error: e.code, message: e.message });
    console.error("rpc", b.action, e && e.message);
    return json({ error: "server", message: "잠시 문제가 생겼어요. 다시 해보세요" });
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const secure = !(url.hostname === "localhost" || url.hostname === "127.0.0.1");
  const path = url.pathname.replace(/\/+$/, "");

  if (req.method === "GET" && path === "/api/auth/kakao") return kakaoStart(url, secure);
  if (req.method === "GET" && path === "/api/auth/kakao/callback") return kakaoCallback(req, url, secure);
  if (req.method === "POST" && path === "/api") return rpc(req, url, secure);
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
};

export const config = { path: ["/api", "/api/*"] };
