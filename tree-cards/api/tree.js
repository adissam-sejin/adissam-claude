/*
 * 메시지 나무 API — 노션 DB에 읽고 쓰는 서버 함수 (Vercel Serverless Function)
 *
 *   GET  /api/tree?code=XXXX          나무 + 카드 목록
 *   POST /api/tree  { action, ... }   카드 쓰기, 관리자 기능
 *
 * 필요한 환경 변수
 *   NOTION_TOKEN     노션 통합(Integration) 시크릿
 *   ADMIN_PASSWORD   관리자 화면 비밀번호
 * 선택
 *   NOTION_TREES_DB / NOTION_CARDS_DB   DB를 옮겼을 때만 지정
 */
const crypto = require("crypto");

const NOTION = process.env.NOTION_API_BASE || "https://api.notion.com/v1";
const TREES_DB = process.env.NOTION_TREES_DB || "419039e8f1838122ae9dfa2d77a471fc";
const CARDS_DB = process.env.NOTION_CARDS_DB || "419039e8f18381b6a512ffe61a7a1f7f";

// 노션 속성 이름
const P = {
  name: "나무 이름", code: "코드", theme: "콘셉트", start: "작성 시작", end: "작성 종료",
  author: "이름", body: "내용", tree: "나무",
};
const THEME_LABEL = { christmas: "크리스마스 트리", persimmon: "감사 감나무", cherry: "벚꽃나무" };
const THEME_KEY = Object.fromEntries(Object.entries(THEME_LABEL).map(([k, v]) => [v, k]));
const LIMITS = { author: 12, body: 500, name: 40 };

class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status || 400; }
}

/* ---------- 노션 호출 ---------- */
async function notion(path, method, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(NOTION + path, {
      method: method || "GET",
      headers: {
        Authorization: "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 1, 3);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Notion error", res.status, data.code, data.message);
      throw new ApiError(res.status === 401 || res.status === 404 ? "NOTION_SETUP" : "NOTION_ERROR", 502);
    }
    return data;
  }
}

async function queryAll(db, body) {
  const out = [];
  let cursor;
  do {
    const page = await notion(`/databases/${db}/query`, "POST", {
      ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
    });
    out.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

/* ---------- 변환 ---------- */
const plain = (prop, kind) => ((prop && prop[kind]) || []).map((t) => t.plain_text).join("");
const text = (s) => [{ text: { content: s } }];
const sameId = (a, b) => String(a).replace(/-/g, "") === String(b).replace(/-/g, "");

// 노션에서 날짜만(시간 없이) 고친 경우: 시작은 그날 0시, 종료는 그날 끝(한국 시간)으로 본다
function readDate(prop, isEnd) {
  const s = prop && prop.date && prop.date.start;
  if (!s) return null;
  if (s.length === 10) return new Date(s + (isEnd ? "T23:59:59+09:00" : "T00:00:00+09:00")).toISOString();
  return new Date(s).toISOString();
}

function toTree(page) {
  const p = page.properties;
  return {
    id: page.id,
    code: plain(p[P.code], "rich_text").trim().toUpperCase(),
    name: plain(p[P.name], "title"),
    theme: THEME_KEY[p[P.theme] && p[P.theme].select && p[P.theme].select.name] || "christmas",
    start_at: readDate(p[P.start], false),
    end_at: readDate(p[P.end], true),
    created_at: page.created_time,
  };
}
const toCard = (page) => ({
  id: page.id,
  author: plain(page.properties[P.author], "title"),
  body: plain(page.properties[P.body], "rich_text"),
  created_at: page.created_time,
});
const publicTree = ({ id, created_at, ...t }) => t;

const normCode = (c) => String(c || "").trim().toUpperCase();

async function findTree(code) {
  code = normCode(code);
  if (!/^[A-Z0-9]{4,12}$/.test(code)) throw new ApiError("TREE_NOT_FOUND", 404);
  const res = await notion(`/databases/${TREES_DB}/query`, "POST", {
    filter: { property: P.code, rich_text: { equals: code } }, page_size: 1,
  });
  if (!res.results.length) throw new ApiError("TREE_NOT_FOUND", 404);
  return toTree(res.results[0]);
}

function checkAdmin(pw) {
  const real = process.env.ADMIN_PASSWORD || "";
  const a = crypto.createHash("sha256").update(String(pw || "")).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  if (!real || !crypto.timingSafeEqual(a, b)) throw new ApiError("BAD_PASSWORD", 401);
}

/* ---------- 기능 ---------- */
async function getTree(code) {
  const tree = await findTree(code);
  const cards = await queryAll(CARDS_DB, {
    filter: { property: P.tree, relation: { contains: tree.id } },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
  return { tree: publicTree(tree), cards: cards.map(toCard) };
}

async function addCard({ code, author, body }) {
  author = String(author || "").trim();
  body = String(body || "").trim();
  if (!author || !body || Array.from(author).length > LIMITS.author || Array.from(body).length > LIMITS.body) {
    throw new ApiError("BAD_INPUT");
  }
  const tree = await findTree(code);
  const now = Date.now();
  if (tree.start_at && now < Date.parse(tree.start_at)) throw new ApiError("NOT_STARTED");
  if (tree.end_at && now > Date.parse(tree.end_at)) throw new ApiError("ENDED");
  const page = await notion("/pages", "POST", {
    parent: { database_id: CARDS_DB },
    properties: {
      [P.author]: { title: text(author) },
      [P.body]: { rich_text: text(body) },
      [P.tree]: { relation: [{ id: tree.id }] },
    },
  });
  return toCard(page);
}

async function adminListTrees() {
  const [trees, cards] = await Promise.all([
    queryAll(TREES_DB, { sorts: [{ timestamp: "created_time", direction: "descending" }] }),
    queryAll(CARDS_DB, {}),
  ]);
  const counts = {};
  cards.forEach((c) => {
    ((c.properties[P.tree] && c.properties[P.tree].relation) || []).forEach((r) => {
      counts[r.id] = (counts[r.id] || 0) + 1;
    });
  });
  return trees.map(toTree).filter((t) => t.code).map((t) => ({ ...publicTree(t), created_at: t.created_at, card_count: counts[t.id] || 0 }));
}

async function adminSaveTree({ code, name, theme, start_at, end_at, is_new }) {
  code = normCode(code);
  name = String(name || "").trim();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) throw new ApiError("BAD_CODE");
  if (!name || Array.from(name).length > LIMITS.name || !THEME_LABEL[theme]) throw new ApiError("BAD_INPUT");
  const start = start_at ? new Date(start_at) : null, end = end_at ? new Date(end_at) : null;
  if ((start && isNaN(start)) || (end && isNaN(end))) throw new ApiError("BAD_INPUT");
  if (start && end && end <= start) throw new ApiError("BAD_PERIOD");

  let existing = null;
  try { existing = await findTree(code); } catch (e) { if (e.code !== "TREE_NOT_FOUND") throw e; }
  if (is_new && existing) throw new ApiError("CODE_EXISTS");
  if (!is_new && !existing) throw new ApiError("TREE_NOT_FOUND", 404);

  const properties = {
    [P.name]: { title: text(name) },
    [P.code]: { rich_text: text(code) },
    [P.theme]: { select: { name: THEME_LABEL[theme] } },
    [P.start]: { date: start ? { start: start.toISOString() } : null },
    [P.end]: { date: end ? { start: end.toISOString() } : null },
  };
  if (existing) await notion(`/pages/${existing.id}`, "PATCH", { properties });
  else await notion("/pages", "POST", { parent: { database_id: TREES_DB }, properties });
  return { code };
}

// 나무를 노션 휴지통으로 보낸다. 카드는 노션에 그대로 남는다(사이트에서는 더 이상 보이지 않음).
async function adminDeleteTree({ code }) {
  const tree = await findTree(code);
  await notion(`/pages/${tree.id}`, "PATCH", { archived: true });
  return true;
}

async function adminDeleteCard({ id }) {
  if (!/^[0-9a-f-]{32,36}$/i.test(String(id || ""))) throw new ApiError("BAD_INPUT");
  let page;
  try { page = await notion(`/pages/${id}`); } catch (_) { throw new ApiError("BAD_INPUT"); }
  // 카드 DB에 있는 페이지만 지울 수 있다
  if (!page.parent || !sameId(page.parent.database_id || "", CARDS_DB)) throw new ApiError("BAD_INPUT");
  await notion(`/pages/${id}`, "PATCH", { archived: true });
  return true;
}

/* ---------- 진입점 ---------- */
module.exports = async function handler(req, res) {
  try {
    if (!process.env.NOTION_TOKEN) throw new ApiError("NOTION_SETUP", 500);

    if (req.method === "GET") {
      const data = await getTree(req.query.code);
      // 여러 사람이 동시에 봐도 노션 호출이 몰리지 않도록 잠깐 캐시한다
      res.setHeader("Cache-Control", "public, s-maxage=8, stale-while-revalidate=30");
      return res.status(200).json(data);
    }
    if (req.method !== "POST") throw new ApiError("BAD_INPUT", 405);

    const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body) || {};
    res.setHeader("Cache-Control", "no-store");
    let out;
    if (b.action === "addCard") out = await addCard(b);
    else {
      checkAdmin(b.pw);
      if (b.action === "adminListTrees") out = await adminListTrees();
      else if (b.action === "adminSaveTree") out = await adminSaveTree(b);
      else if (b.action === "adminDeleteTree") out = await adminDeleteTree(b);
      else if (b.action === "adminDeleteCard") out = await adminDeleteCard(b);
      else throw new ApiError("BAD_INPUT");
    }
    return res.status(200).json(out);
  } catch (e) {
    if (!(e instanceof ApiError)) console.error(e);
    res.setHeader("Cache-Control", "no-store");
    return res.status(e.status || 500).json({ message: e.code || "SERVER_ERROR" });
  }
};
