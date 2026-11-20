// 내 컴퓨터에서 사이트를 띄워 보는 서버 (Netlify 없이). 저장 내용은 서버를 끄면 사라집니다.
//   node --experimental-strip-types tools/dev-server.mts   →  http://localhost:8765
//   비밀번호는 환경 변수 ADMIN_PASSWORD 로 넘깁니다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../netlify/lib/app.mts";
import type { KV } from "../netlify/lib/app.mts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "public");
const port = Number(process.env.PORT || 8765);
const env = { adminId: process.env.ADMIN_ID || "admin", adminPassword: process.env.ADMIN_PASSWORD || "", offeringPassword: process.env.OFFERING_PASSWORD || "" };

const json = new Map<string, string>();
const bin = new Map<string, { data: ArrayBuffer; type: string }>();
const kv: KV = {
  getJSON: async (k) => (json.has(k) ? JSON.parse(json.get(k)!) : null),
  setJSON: async (k, v) => { json.set(k, JSON.stringify(v)); },
  remove: async (k) => { json.delete(k); bin.delete(k); },
  getBinary: async (k) => bin.get(k) || null,
  setBinary: async (k, data, type) => { bin.set(k, { data, type }); },
};

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost:" + port);
  if (url.pathname.startsWith("/api/")) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers as HeadersInit, body: body.length ? body : undefined }), kv, env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const file = normalize(join(root, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log("http://localhost:" + port));
