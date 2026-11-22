/* 시험용 가짜 저장소·가짜 카카오·가짜 노션 — 실제 서비스에는 올라가지 않습니다 */
import http from "node:http";
import crypto from "node:crypto";

export function memoryStore() {
  const m = new Map();
  return {
    _m: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async set(k, v) { m.set(k, String(v)); return { modified: true }; },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

const readBody = (req) => new Promise((res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => res(d)); });
const send = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

/* 가짜 카카오: /oauth/authorize 는 곧바로 승인하고 돌려보냅니다. ?as=1234 로 사람을 고릅니다 */
export function fakeKakao(state = { nextUser: "1001", nick: "시험이", lastAuthorize: null }) {
  const codes = new Map(), tokens = new Map();
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/oauth/authorize") {
      state.lastAuthorize = Object.fromEntries(u.searchParams);
      const code = crypto.randomBytes(6).toString("hex");
      codes.set(code, state.nextUser);
      const back = new URL(u.searchParams.get("redirect_uri"));
      back.searchParams.set("code", code);
      back.searchParams.set("state", u.searchParams.get("state"));
      res.writeHead(302, { Location: back.toString() }); return res.end();
    }
    if (u.pathname === "/oauth/token") {
      const f = new URLSearchParams(await readBody(req));
      state.lastToken = Object.fromEntries(f);
      const id = codes.get(f.get("code"));
      if (!id) return send(res, 400, { error: "invalid_grant" });
      codes.delete(f.get("code"));
      const t = crypto.randomBytes(8).toString("hex"); tokens.set(t, id);
      return send(res, 200, { access_token: t, token_type: "bearer" });
    }
    if (u.pathname === "/v2/user/me") {
      const id = tokens.get((req.headers.authorization || "").replace("Bearer ", ""));
      if (!id) return send(res, 401, { msg: "no" });
      return send(res, 200, { id: Number(id), kakao_account: { profile: { nickname: state.nick } } });
    }
    send(res, 404, {});
  });
  return { server, state };
}

/* 가짜 노션: 앱이 쓰는 API만 흉내 냅니다 */
export function fakeNotion() {
  const dbs = new Map();   // id -> { token, title, properties, pages: [] }
  const blocks = new Map(); // id -> { parent, block }
  const pages = new Map();  // id -> { db, properties, children: [ids] }
  const calls = [];
  const uid = () => crypto.randomUUID();
  const rt = (parts) => (parts || []).map((p) => ({
    type: "text", text: { content: p.text.content }, plain_text: p.text.content,
    annotations: Object.assign({ bold: false, italic: false, color: "default" }, p.annotations || {}),
  }));
  const mkBlock = (parent, b) => {
    const id = uid();
    const block = { object: "block", id, type: b.type, paragraph: { rich_text: rt(b.paragraph.rich_text), color: b.paragraph.color || "default" } };
    blocks.set(id, { parent, block });
    pages.get(parent).children.push(id);
    return block;
  };
  const addDb = (id, token, properties, title = "시험 DB") => dbs.set(id, { token, title, properties });
  const match = (pg, f) => {
    if (!f) return true;
    if (f.and) return f.and.every((x) => match(pg, x));
    const v = pg.properties[f.property] && pg.properties[f.property].date && pg.properties[f.property].date.start;
    if (!v) return false;
    if (f.date.equals) return v === f.date.equals;
    if (f.date.on_or_after) return v >= f.date.on_or_after;
    if (f.date.on_or_before) return v <= f.date.on_or_before;
    return true;
  };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    const body = req.method === "GET" || req.method === "DELETE" ? null : JSON.parse((await readBody(req)) || "{}");
    const seg = u.pathname.replace("/v1/", "").split("/");
    calls.push(req.method + " " + u.pathname);
    const known = [...dbs.values()].some((d) => d.token === token);
    if (!known) return send(res, 401, { message: "API token is invalid." });
    const dbOf = (id) => { const d = dbs.get(id.replace(/-/g, "")); return d && d.token === token ? d : null; };
    const pageOk = (id) => { const p = pages.get(id); return p && dbs.get(p.db).token === token ? p : null; };

    if (seg[0] === "databases" && seg.length === 2) {
      const d = dbOf(seg[1]); if (!d) return send(res, 404, { message: "Could not find database" });
      if (req.method === "PATCH") for (const k in body.properties) d.properties[k] = { type: Object.keys(body.properties[k])[0] };
      return send(res, 200, { id: seg[1], title: [{ plain_text: d.title }], properties: d.properties });
    }
    if (seg[0] === "databases" && seg[2] === "query") {
      const id = seg[1].replace(/-/g, ""); const d = dbOf(id); if (!d) return send(res, 404, { message: "Could not find database" });
      let list = [...pages.entries()].filter(([, p]) => p.db === id && !p.archived).map(([pid, p]) => ({ id: pid, properties: p.properties }));
      list = list.filter((p) => match(p, body.filter));
      if (body.sorts && body.sorts[0]) {
        const k = body.sorts[0].property, dir = body.sorts[0].direction === "descending" ? -1 : 1;
        list.sort((a, b) => dir * String(a.properties[k].date.start).localeCompare(b.properties[k].date.start));
      }
      const size = body.page_size || 100;
      const start = body.start_cursor ? list.findIndex((p) => p.id === body.start_cursor) : 0;
      const slice = list.slice(start, start + size);
      const more = start + size < list.length;
      return send(res, 200, { results: slice, has_more: more, next_cursor: more ? list[start + size].id : null });
    }
    if (seg[0] === "pages" && req.method === "POST") {
      const id = body.parent.database_id.replace(/-/g, ""); if (!dbOf(id)) return send(res, 404, { message: "Could not find database" });
      const pid = uid();
      pages.set(pid, { db: id, properties: body.properties, children: [] });
      for (const c of body.children || []) mkBlock(pid, c);
      return send(res, 200, { id: pid });
    }
    if (seg[0] === "blocks" && seg[2] === "children") {
      const p = pageOk(seg[1]); if (!p) return send(res, 404, { message: "Could not find block" });
      if (req.method === "PATCH") {
        if ((body.children || []).length > 100) return send(res, 400, { message: "too many children" });
        return send(res, 200, { results: body.children.map((c) => mkBlock(seg[1], c)) });
      }
      const all = p.children.filter((id) => blocks.has(id)).map((id) => blocks.get(id).block);
      const size = Number(u.searchParams.get("page_size")) || 100;
      const sc = u.searchParams.get("start_cursor");
      const start = sc ? all.findIndex((b) => b.id === sc) : 0;
      const more = start + size < all.length;
      return send(res, 200, { results: all.slice(start, start + size), has_more: more, next_cursor: more ? all[start + size].id : null });
    }
    if (seg[0] === "blocks" && seg.length === 2) {
      const e = blocks.get(seg[1]);
      if (!e || !pageOk(e.parent)) return send(res, 404, { message: "Could not find block" });
      if (req.method === "DELETE") { blocks.delete(seg[1]); return send(res, 200, { id: seg[1], archived: true }); }
      if (req.method === "PATCH") {
        if (body.paragraph.rich_text) e.block.paragraph.rich_text = rt(body.paragraph.rich_text);
        if (body.paragraph.color) e.block.paragraph.color = body.paragraph.color;
      }
      return send(res, 200, e.block);
    }
    send(res, 404, { message: "unknown " + u.pathname });
  });
  return { server, addDb, dbs, pages, blocks, calls, mkBlock, uid };
}

export const listen = (server, port = 0) => new Promise((r) => server.listen(port, "127.0.0.1", () => r(server.address().port)));
