/* 서버 로직 시험 — node test/api.test.mjs */
import assert from "node:assert/strict";
import { memoryStore, fakeKakao, fakeNotion, listen } from "./mocks.mjs";

const kakao = fakeKakao(), notion = fakeNotion();
const kp = await listen(kakao.server), np = await listen(notion.server);
const OWNER_DB = "3b6039e8f183809c8461eaf952782ac0";
Object.assign(process.env, {
  APP_SECRET: "test-secret-0123456789abcdef0123456789",
  KAKAO_REST_KEY: "restkey", KAKAO_CLIENT_SECRET: "csecret", OWNER_CODE: "owner-code-123456",
  NOTION_TOKEN: "ntn_owner_token_000000000000", NOTION_DB: OWNER_DB,
  KAKAO_AUTH_BASE: `http://127.0.0.1:${kp}`, KAKAO_API_BASE: `http://127.0.0.1:${kp}`, NOTION_API_BASE: `http://127.0.0.1:${np}`,
});
const store = memoryStore();
globalThis.__GODTALK_STORE__ = store;
const { default: handler } = await import("../netlify/functions/api.mjs");

const BASE = "https://godtalk.test";
function client() {
  const jar = {};
  const take = (res) => { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); const v = kv.slice(i + 1); if (v) jar[kv.slice(0, i)] = v; else delete jar[kv.slice(0, i)]; } };
  const ck = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  return {
    jar,
    async rpc(body, headers = {}) {
      const res = await handler(new Request(BASE + "/api", { method: "POST", headers: { "Content-Type": "application/json", cookie: ck(), origin: BASE, ...headers }, body: JSON.stringify(body) }));
      take(res); return res.json();
    },
    async login(kakaoId, q = "") {
      kakao.state.nextUser = String(kakaoId);
      let res = await handler(new Request(BASE + "/api/auth/kakao" + q, { headers: { cookie: ck() } })); take(res);
      const k = await fetch(res.headers.get("location"), { redirect: "manual" });
      res = await handler(new Request(k.headers.get("location"), { headers: { cookie: ck() } })); take(res);
      return res.headers.get("location");
    },
  };
}
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("  ✓ " + name); };

/* 주인의 예전 노션 기록을 미리 넣어 둡니다 (처음 버전이 쓰던 모양 그대로) */
notion.addDb(OWNER_DB, process.env.NOTION_TOKEN, { 제목: { type: "title" }, 날짜: { type: "date" } }, "GodTalk");
const oldPage = notion.uid();
notion.pages.set(oldPage, { db: OWNER_DB, properties: { 날짜: { date: { start: "2026-11-23" } } }, children: [] });
notion.mkBlock(oldPage, { type: "paragraph", paragraph: { rich_text: [{ text: { content: "나: " }, annotations: { bold: true } }, { text: { content: "예전에 쓴 글" } }, { text: { content: "  오전 01:53" }, annotations: { color: "gray" } }] } });
notion.mkBlock(oldPage, { type: "paragraph", paragraph: { rich_text: [{ text: { content: "하나님: " }, annotations: { bold: true } }, { text: { content: "예전 말씀" } }, { text: { content: "\n— 욥 22:21" }, annotations: { italic: true, color: "gray" } }, { text: { content: "  오전 02:02" }, annotations: { color: "gray" } }] } });

const a = client(), b = client();

await t("로그인 전에는 아무것도 주지 않는다", async () => {
  assert.equal((await a.rpc({ action: "me" })).user, null);
  for (const action of ["month", "day", "add", "search", "dates", "reacts", "react", "notionCheck", "deleteAccount"])
    assert.equal((await a.rpc({ action, ym: "2026-11", date: "2026-11-23" })).error, "auth", action);
});
await t("다른 사이트에서 온 요청은 막는다", async () => {
  assert.equal((await a.rpc({ action: "me" }, { origin: "https://evil.example" })).error, "bad");
});
await t("위조한 쿠키는 통하지 않는다", async () => {
  const c = client(); c.jar.gt_s = Buffer.from(JSON.stringify({ u: "k1001", v: 1, p: 1, e: Date.now() + 1e9 })).toString("base64url") + ".AAAA";
  assert.equal((await c.rpc({ action: "month", ym: "2026-11" })).error, "auth");
});
await t("카카오 로그인", async () => {
  assert.equal(await a.login(1001), "/");
  assert.equal(kakao.state.lastAuthorize.redirect_uri, BASE + "/api/auth/kakao/callback");
  assert.equal(kakao.state.lastToken.client_secret, "csecret");
  const me = await a.rpc({ action: "me" });
  assert.deepEqual([me.user.nick, me.user.storage, me.user.owner, me.user.hasPin], ["시험이", "cloud", false, false]);
});
await t("state가 다르면 로그인 거부", async () => {
  const c = client();
  const res = await handler(new Request(BASE + "/api/auth/kakao/callback?code=x&state=y"));
  assert.equal(res.headers.get("location"), "/?e=state");
  assert.equal((await c.rpc({ action: "me" })).user, null);
});

await t("Netlify 저장: 쓰기·읽기·달력", async () => {
  const r1 = await a.rpc({ action: "add", date: "2026-11-20", who: "me", text: "  첫 글  ", time: "오전 07:01" });
  const r2 = await a.rpc({ action: "add", date: "2026-11-20", who: "god", text: "두려워하지 말라", ref: "사 41:10", time: "오전 07:02" });
  await a.rpc({ action: "add", date: "2026-10-03", who: "me", text: "시월의 글", time: "오후 09:00" });
  assert.ok(r1.id && r2.id);
  const d = await a.rpc({ action: "day", date: "2026-11-20" });
  assert.deepEqual(d.messages.map((m) => [m.who, m.text, m.ref, m.time]), [["me", "첫 글", "", "오전 07:01"], ["god", "두려워하지 말라", "사 41:10", "오전 07:02"]]);
  assert.deepEqual((await a.rpc({ action: "month", ym: "2026-11" })).days, ["2026-11-20"]);
  assert.deepEqual((await a.rpc({ action: "dates" })).dates, ["2026-10-03", "2026-11-20"]);
});
await t("저장된 기록은 암호화되어 있다", async () => {
  const raw = [...store._m.entries()].filter(([k]) => k.startsWith("d/k1001/"));
  assert.equal(raw.length, 2);
  for (const [, v] of raw) { assert.ok(v.startsWith("v1.")); assert.ok(!v.includes("두려워")); }
});
await t("고치기·모아두기·찾기·지우기", async () => {
  const d = await a.rpc({ action: "day", date: "2026-11-20" });
  const [m1, m2] = d.messages;
  assert.ok((await a.rpc({ action: "edit", date: "2026-11-20", id: m1.id, text: "고친 글" })).ok);
  assert.equal((await a.rpc({ action: "react", date: "2026-11-20", id: m2.id, rx: "😈" })).error, "bad");
  assert.ok((await a.rpc({ action: "react", date: "2026-11-20", id: m2.id, rx: "🥹" })).ok);
  assert.ok((await a.rpc({ action: "react", date: "2026-11-20", id: m1.id, rx: "✅" })).ok);
  const favs = await a.rpc({ action: "reacts" });
  assert.deepEqual(favs.hits.map((h) => [h.date, h.text, h.rx]), [["2026-11-20", "고친 글", "✅"], ["2026-11-20", "두려워하지 말라", "🥹"]]);
  await a.rpc({ action: "react", date: "2026-11-20", id: m1.id, rx: "" });
  const s = await a.rpc({ action: "search", q: "글" });
  assert.deepEqual(s.hits.map((h) => h.text), ["고친 글", "시월의 글"]); assert.equal(s.cursor, null);
  assert.deepEqual((await a.rpc({ action: "search", q: "사 41" })).hits.map((h) => h.ref), ["사 41:10"]);
  await a.rpc({ action: "react", date: "2026-11-20", id: m2.id, rx: "" });
  assert.deepEqual((await a.rpc({ action: "reacts" })).hits, []);
  assert.equal((await a.rpc({ action: "me" })).user.rxDays, 0);
  assert.ok((await a.rpc({ action: "del", date: "2026-11-20", id: m1.id })).ok);
  assert.equal((await a.rpc({ action: "day", date: "2026-11-20" })).messages.length, 1);
  assert.equal((await a.rpc({ action: "del", date: "2026-11-20", id: m1.id })).error, "gone");
});
await t("잘못된 입력은 거절", async () => {
  assert.equal((await a.rpc({ action: "add", date: "2026-13-40", who: "me", text: "x" })).error, "bad");
  assert.equal((await a.rpc({ action: "add", date: "2026-11-20", who: "admin", text: "x" })).error, "bad");
  assert.equal((await a.rpc({ action: "add", date: "2026-11-20", who: "me", text: "   " })).error, "bad");
  assert.equal((await a.rpc({ action: "add", date: "2026-11-20", who: "me", text: "x".repeat(5001) })).error, "bad");
  assert.equal((await a.rpc({ action: "month", ym: "../u/k1001" })).error, "bad");
  assert.equal((await a.rpc({ action: "nope" })).error, "bad");
});
await t("다른 사람은 내 기록을 볼 수 없다", async () => {
  await b.login(2002);
  assert.deepEqual((await b.rpc({ action: "month", ym: "2026-11" })).days, []);
  assert.deepEqual((await b.rpc({ action: "day", date: "2026-11-20" })).messages, []);
  assert.deepEqual((await b.rpc({ action: "search", q: "두려워" })).hits, []);
  const mine = (await a.rpc({ action: "day", date: "2026-11-20" })).messages[0];
  assert.equal((await b.rpc({ action: "del", date: "2026-11-20", id: mine.id })).error, "gone");
  assert.equal((await b.rpc({ action: "edit", date: "2026-11-20", id: mine.id, text: "해킹" })).error, "gone");
  assert.equal((await a.rpc({ action: "day", date: "2026-11-20" })).messages[0].text, "두려워하지 말라");
});

await t("비밀번호 잠금: 서버에서 막는다", async () => {
  assert.equal((await a.rpc({ action: "setPin", pin: "12" })).error, "bad");
  assert.ok((await a.rpc({ action: "setPin", pin: "2704" })).ok);
  assert.ok((await a.rpc({ action: "month", ym: "2026-11" })).days);
  await a.rpc({ action: "lock" });
  assert.equal((await a.rpc({ action: "me" })).user.locked, true);
  for (const action of ["month", "day", "add", "search", "setPin", "clearPin", "notionConnect", "deleteAccount", "claim"])
    assert.equal((await a.rpc({ action, ym: "2026-11", date: "2026-11-20", pin: "9999" })).error, "locked", action);
  assert.equal((await a.rpc({ action: "unlock", pin: "0000" })).error, "pin");
  assert.ok((await a.rpc({ action: "unlock", pin: "2704" })).ok);
  assert.ok((await a.rpc({ action: "month", ym: "2026-11" })).days);
  const c = client(); await c.login(1001);
  assert.equal((await c.rpc({ action: "day", date: "2026-11-20" })).error, "locked");
});
await t("비밀번호를 걸면 다른 기기는 다시 들어와야 한다", async () => {
  const x = client(), y = client(); await x.login(5005); await y.login(5005);
  assert.ok((await y.rpc({ action: "month", ym: "2026-11" })).days);
  assert.ok((await x.rpc({ action: "setPin", pin: "123456" })).ok);
  assert.ok((await x.rpc({ action: "month", ym: "2026-11" })).days);
  assert.equal((await y.rpc({ action: "month", ym: "2026-11" })).error, "auth");
  await y.login(5005);
  assert.equal((await y.rpc({ action: "month", ym: "2026-11" })).error, "locked");
});
await t("다섯 번 틀리면 잠시 막힌다", async () => {
  await a.rpc({ action: "lock" });
  for (let i = 0; i < 4; i++) assert.equal((await a.rpc({ action: "unlock", pin: "1111" })).error, "pin");
  assert.equal((await a.rpc({ action: "unlock", pin: "1111" })).error, "pinlock");
  assert.equal((await a.rpc({ action: "unlock", pin: "2704" })).error, "pinlock");
});
await t("비밀번호를 잊으면 카카오 재인증으로 푼다", async () => {
  assert.equal(await a.login(1001, "?reset=1"), "/?e=pinreset");
  assert.equal(kakao.state.lastAuthorize.prompt, "login");
  const me = await a.rpc({ action: "me" });
  assert.deepEqual([me.user.hasPin, me.user.locked], [false, false]);
  assert.equal((await a.rpc({ action: "day", date: "2026-11-20" })).messages.length, 1);
});

await t("주인: 코드로 예전 노션 기록을 이어받는다", async () => {
  const o = client(); await o.login(7777);
  assert.equal((await o.rpc({ action: "claim", code: "wrong-code-000000" })).error, "bad");
  assert.deepEqual((await o.rpc({ action: "month", ym: "2026-11" })).days, []);
  const r = await o.rpc({ action: "claim", code: "owner-code-123456" });
  assert.ok(r.ok && r.user.owner && r.user.storage === "notion");
  assert.deepEqual((await o.rpc({ action: "month", ym: "2026-11" })).days, ["2026-11-23"]);
  const d = await o.rpc({ action: "day", date: "2026-11-23" });
  assert.deepEqual(d.messages.map((m) => [m.who, m.text, m.ref, m.time]), [["me", "예전에 쓴 글", "", "오전 01:53"], ["god", "예전 말씀", "욥 22:21", "오전 02:02"]]);
  assert.equal((await b.rpc({ action: "claim", code: "owner-code-123456" })).error, "bad");
  assert.deepEqual((await b.rpc({ action: "month", ym: "2026-11" })).days, []);
  globalThis.owner = o;
});
await t("주인: 노션에 쓰기·고치기·모아두기·찾기·지우기", async () => {
  const o = globalThis.owner;
  const r = await o.rpc({ action: "add", date: "2026-11-23", who: "god", text: "새 말씀", ref: "시 23:1", time: "오후 03:10", pageId: oldPage });
  assert.ok(r.id);
  const n1 = await o.rpc({ action: "add", date: "2026-12-01", who: "me", text: "새 날", time: "오전 06:00" });
  assert.ok(n1.id && n1.pageId);
  const pg = notion.pages.get(n1.pageId);
  assert.equal(pg.properties["제목"].title[0].text.content, "2026년 12월 1일 (화)");
  assert.equal(pg.properties["날짜"].date.start, "2026-12-01");
  const raw = notion.blocks.get(r.id).block.paragraph.rich_text.map((x) => x.plain_text).join("");
  assert.equal(raw, "하나님: 새 말씀\n— 시 23:1  오후 03:10");
  await o.rpc({ action: "edit", date: "2026-11-23", id: r.id, text: "고친 말씀" });
  await o.rpc({ action: "react", date: "2026-11-23", id: r.id, rx: "❤️" });
  assert.equal(notion.blocks.get(r.id).block.paragraph.rich_text.map((x) => x.plain_text).join(""), "하나님: 고친 말씀\n— 시 23:1  오후 03:10  ❤️");
  const d = await o.rpc({ action: "day", date: "2026-11-23" });
  assert.deepEqual(d.messages[2], { id: r.id, who: "god", text: "고친 말씀", ref: "시 23:1", time: "오후 03:10", rx: "❤️" });
  assert.deepEqual((await o.rpc({ action: "reacts" })).hits.map((h) => [h.text, h.rx]), [["고친 말씀", "❤️"]]);
  await o.rpc({ action: "react", date: "2026-11-23", id: r.id, rx: "👍" });
  assert.equal((await o.rpc({ action: "day", date: "2026-11-23" })).messages[2].rx, "👍");
  const amen = await o.rpc({ action: "add", date: "2026-11-23", who: "me", text: "아멘 🙏", time: "오후 03:11" });
  const dd = await o.rpc({ action: "day", date: "2026-11-23" });
  assert.deepEqual([dd.messages[3].text, dd.messages[3].rx], ["아멘 🙏", undefined]);
  await o.rpc({ action: "del", date: "2026-11-23", id: amen.id });
  assert.deepEqual((await o.rpc({ action: "search", q: "말씀" })).hits.map((h) => h.text), ["예전 말씀", "고친 말씀"]);
  assert.deepEqual((await o.rpc({ action: "dates" })).dates, ["2026-11-23", "2026-12-01"]);
  await o.rpc({ action: "del", date: "2026-11-23", id: r.id });
  assert.equal((await o.rpc({ action: "day", date: "2026-11-23" })).messages.length, 2);
  assert.equal((await o.rpc({ action: "edit", date: "2026-11-23", id: "../../databases/x", text: "y" })).error, "bad");
});

await t("다른 사람: 자기 노션 연결하고 기록 옮기기", async () => {
  const DB2 = "aaaabbbbccccddddeeeeffff00001111";
  notion.addDb(DB2, "ntn_user_b_token_11111111111", { 이름: { type: "title" } }, "B의 기도");
  await b.rpc({ action: "add", date: "2026-11-05", who: "me", text: "B의 클라우드 글", time: "오전 05:00" });
  const g = await b.rpc({ action: "add", date: "2026-11-05", who: "god", text: "B의 말씀", ref: "요 3:16", time: "오전 05:01" });
  await b.rpc({ action: "react", date: "2026-11-05", id: g.id, rx: "🙏" });
  assert.equal((await b.rpc({ action: "notionConnect", token: "ntn_wrong_token_000000000000", db: DB2 })).error, "notion");
  assert.equal((await b.rpc({ action: "notionConnect", token: "ntn_user_b_token_11111111111", db: OWNER_DB })).error, "notion");
  const r = await b.rpc({ action: "notionConnect", token: "ntn_user_b_token_11111111111", db: `https://www.notion.so/ws/B-${DB2}?v=99998888777766665555444433332222` });
  assert.ok(r.ok, JSON.stringify(r)); assert.equal(r.title, "B의 기도"); assert.equal(r.cloudDays, 1);
  assert.equal(notion.dbs.get(DB2).properties["날짜"].type, "date");
  const rec = JSON.parse(store._m.get("u/k2002"));
  assert.ok(rec.notion.tok.startsWith("v1.") && !JSON.stringify(rec).includes("ntn_user_b"));
  assert.deepEqual((await b.rpc({ action: "month", ym: "2026-11" })).days, []);
  assert.deepEqual((await b.rpc({ action: "cloudDates" })).dates, ["2026-11-05"]);
  assert.equal((await b.rpc({ action: "moveDay", date: "2026-11-05" })).moved, 2);
  assert.deepEqual((await b.rpc({ action: "cloudDates" })).dates, []);
  const d = await b.rpc({ action: "day", date: "2026-11-05" });
  assert.deepEqual(d.messages.map((m) => [m.who, m.text, m.ref, m.rx || ""]), [["me", "B의 클라우드 글", "", ""], ["god", "B의 말씀", "요 3:16", "🙏"]]);
  assert.deepEqual((await b.rpc({ action: "reacts" })).hits.map((h) => h.text), ["B의 말씀"]);
  assert.ok((await b.rpc({ action: "notionCheck" })).ok);
  assert.equal((await b.rpc({ action: "notionDisconnect" })).user.storage, "cloud");
  assert.deepEqual((await b.rpc({ action: "month", ym: "2026-11" })).days, []);
});

await t("긴 찾기는 나누어 이어진다 (노션)", async () => {
  const o = globalThis.owner;
  for (let i = 1; i <= 14; i++) await o.rpc({ action: "add", date: `2027-01-${String(i).padStart(2, "0")}`, who: "me", text: "은혜 " + i, time: "오전 06:00" });
  const p1 = await o.rpc({ action: "search", q: "은혜" });
  assert.equal(p1.hits.length, 12); assert.ok(p1.cursor);
  const p2 = await o.rpc({ action: "search", q: "은혜", cursor: p1.cursor });
  assert.equal(p2.hits.length, 2); assert.equal(p2.cursor, null);
});

await t("로그아웃·계정 지우기", async () => {
  await a.rpc({ action: "logout" });
  assert.equal((await a.rpc({ action: "me" })).user, null);
  await a.login(1001);
  assert.ok((await a.rpc({ action: "deleteAccount" })).ok);
  assert.equal([...store._m.keys()].filter((k) => k.includes("k1001")).length, 0);
  assert.equal((await a.rpc({ action: "me" })).user, null);
});
await t("서버 설정이 없으면 안내만 한다", async () => {
  const keep = process.env.APP_SECRET; process.env.APP_SECRET = "";
  const c = client();
  assert.deepEqual((await c.rpc({ action: "me" })).ready, { kakao: true, secret: false });
  assert.equal((await c.rpc({ action: "month", ym: "2026-11" })).error, "setup");
  const res = await handler(new Request(BASE + "/api/auth/kakao"));
  assert.equal(res.headers.get("location"), "/?e=setup");
  process.env.APP_SECRET = keep;
});

console.log(`\n${n}개 시험 통과`);
kakao.server.close(); notion.server.close();
