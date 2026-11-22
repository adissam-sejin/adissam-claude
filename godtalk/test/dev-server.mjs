/* 내 컴퓨터에서 돌려 보기 — node test/dev-server.mjs  →  http://localhost:8788
   가짜 카카오·가짜 노션·메모리 저장소를 씁니다. 실제 서비스와 이어지지 않습니다. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { memoryStore, fakeKakao, fakeNotion, listen } from "./mocks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public");
const PORT = Number(process.env.PORT) || 8788;
export const kakao = fakeKakao(), notion = fakeNotion();
const kp = await listen(kakao.server), np = await listen(notion.server);
const OWNER_DB = "3b6039e8f183809c8461eaf952782ac0";
Object.assign(process.env, {
  APP_SECRET: "dev-secret-0123456789abcdef0123456789", KAKAO_REST_KEY: process.env.NO_KAKAO ? "" : "devkey", OWNER_CODE: "dev-owner-code-1234",
  NOTION_TOKEN: "ntn_owner_token_000000000000", NOTION_DB: OWNER_DB,
  KAKAO_AUTH_BASE: `http://127.0.0.1:${kp}`, KAKAO_API_BASE: `http://127.0.0.1:${kp}`, NOTION_API_BASE: `http://127.0.0.1:${np}`,
});
globalThis.__GODTALK_STORE__ = memoryStore();
notion.addDb(OWNER_DB, process.env.NOTION_TOKEN, { 제목: { type: "title" }, 날짜: { type: "date" } }, "GodTalk");
notion.addDb("aaaabbbbccccddddeeeeffff00001111", "ntn_user_token_1111111111111", { 이름: { type: "title" } }, "나의 기도 노트");
const seed = (date, lines) => {
  const id = notion.uid();
  notion.pages.set(id, { db: OWNER_DB, properties: { 날짜: { date: { start: date } } }, children: [] });
  for (const [who, text, time, ref] of lines) {
    const rt = [{ text: { content: who + ": " }, annotations: { bold: true } }, { text: { content: text } }];
    if (ref) rt.push({ text: { content: "\n— " + ref }, annotations: { italic: true, color: "gray" } });
    rt.push({ text: { content: "  " + time }, annotations: { color: "gray" } });
    notion.mkBlock(id, { type: "paragraph", paragraph: { rich_text: rt } });
  }
};
seed("2026-11-20", [["나", "오늘 하루도 감사합니다", "오전 06:30"], ["하나님", "여호와는 나의 목자시니 내게 부족함이 없으리로다", "오전 06:31", "시 23:1"]]);
seed("2026-11-21", [["나", "마음이 조급해요", "오후 10:02"], ["하나님", "조급해하지 마라", "오후 10:03"]]);

const { default: handler } = await import("../netlify/functions/api.mjs");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/__as") { kakao.state.nextUser = url.searchParams.get("id"); kakao.state.nick = url.searchParams.get("nick") || "시험이"; res.end("ok"); return; }
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    const headers = {}; r.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
    const sc = r.headers.getSetCookie(); if (sc.length) headers["set-cookie"] = sc;
    res.writeHead(r.status, headers); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
