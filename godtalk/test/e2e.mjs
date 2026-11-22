/* 화면 시험 — 먼저 node test/dev-server.mjs 를 켜 두고: node test/e2e.mjs */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const B = "http://localhost:8788", shots = new URL("./shots/", import.meta.url).pathname;
const browser = await chromium.launch();
const errors = [];
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: "ko-KR" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_INTERNET_DISCONNECTED")) errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
  return { ctx, page };
};
const as = (id, nick) => fetch(`${B}/__as?id=${id}&nick=${encodeURIComponent(nick)}`);
const shot = async (page, name) => { await page.waitForTimeout(450); await page.screenshot({ path: shots + name + ".png" }); };
const step = (s) => console.log("  ✓ " + s);
const today = new Date(); const pad = (n) => String(n).padStart(2, "0");
const todayK = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

/* ── 새 사용자 ── */
let { ctx, page } = await newCtx();
await as(1001, "은혜");
await page.goto(B); await page.waitForSelector("#kakao");
await shot(page, "01-login"); step("로그인 화면");
await page.click("#kakao"); await page.waitForSelector("#today");
await page.waitForFunction(() => document.querySelector("#stat").textContent.includes("비어"));
await shot(page, "02-calendar-empty"); step("카카오 로그인 → 달력");

await page.click("#today"); await page.waitForSelector("#myIn");
await page.waitForFunction(() => document.querySelector("#cnt").textContent.includes("조용"));
await page.fill("#myIn", "오늘은 마음이 자꾸 무너져요"); await page.click("#mySend");
await page.click("#openBible"); await page.waitForSelector("#q");
await page.waitForFunction(() => document.querySelector("#bstat").textContent.includes("구절"), null, { timeout: 20000 });
await page.fill("#q", "마 11:28"); await page.waitForSelector(".vs");
await shot(page, "03-bible-find");
await page.click(".vs"); 
assert.equal(await page.textContent("#refText"), "마 11:28");
await page.click("#godSend");
await page.fill("#myIn", "그 말씀 붙들고 하루 살아볼게요"); await page.click("#mySend");
await page.waitForFunction(() => document.querySelectorAll(".bub:not(.wait)").length === 3);
assert.equal(await page.textContent("#cnt"), "3개의 말");
await shot(page, "04-chat"); step("글 쓰기 + 성경 주소로 찾아 넣기");

await page.click(".bub.god"); await page.click("[data-a=fav]");
await page.waitForSelector(".bub.god.fav");
await page.click(".bub.me"); await page.click("[data-a=edit]");
await page.fill(".dialog textarea", "오늘은 마음이 자꾸 무너졌어요"); await page.click(".dialog [data-a=yes]");
await page.waitForFunction(() => document.querySelector(".bub.me").textContent.includes("무너졌어요"));
await page.click(".bub.god");
await shot(page, "05-chat-actions"); step("모아두기 · 고치기");

await page.click("#openBible"); await page.click(".tab[data-t=read]"); await page.waitForSelector(".chip");
await shot(page, "06-bible-books");
await page.click(".chip[data-b=시편]"); await page.click(".chip[data-c='23']"); await page.waitForSelector(".verse");
await shot(page, "07-bible-read");
await page.click(".verse[data-v='1']");
assert.equal(await page.textContent("#refText"), "시 23:1");
await page.click("#godSend"); await page.waitForFunction(() => document.querySelectorAll(".bub:not(.wait)").length === 4);
step("성경 장별 읽기에서 넣기");

await page.click("#back"); await page.waitForSelector("#today");
await page.waitForFunction(() => document.querySelector("#stat").textContent.includes("1일"));
assert.equal(await page.locator(`.day.has[data-k="${todayK}"]`).count(), 1);
await shot(page, "08-calendar"); step("달력에 하트");

await page.click("#toSearch"); await page.fill("#sq", "마음"); await page.press("#sq", "Enter");
await page.waitForSelector(".hit"); await shot(page, "09-search");
assert.equal(await page.locator(".hit").count(), 1);
await page.click(".hit"); await page.waitForSelector(".bub.flash");
await page.click("#back"); await page.waitForSelector("#sq");
assert.equal(await page.inputValue("#sq"), "마음");
assert.equal(await page.locator(".hit").count(), 1);
await page.click("#back"); await page.waitForSelector("#today"); step("기록 찾기 → 그날로 → 돌아오기");

await page.click("#toFavs"); await page.waitForSelector(".hit"); await shot(page, "10-favs");
assert.ok((await page.textContent(".hit")).includes("마 11:28"));
await page.goBack(); await page.waitForSelector("#today"); step("모아둔 말 + 브라우저 뒤로 가기");

await page.click("#toSetup"); await page.waitForFunction(() => document.querySelector("#stTotal").textContent === "1일");
await page.waitForFunction(() => document.querySelector("#bib").textContent.includes("구절"));
await shot(page, "11-setup"); 
await page.evaluate(() => document.querySelector("#storeBox").scrollIntoView()); await shot(page, "12-setup-store");
step("설정");

const tap = async (digits) => { for (const d of digits) await page.click(`.veil .pad [data-n="${d}"], .gate .pad [data-n="${d}"]`); await page.click(".veil .pad [data-a=ok], .gate .pad [data-a=ok]"); };
await page.click("#pinOn"); await tap("2704"); await page.waitForTimeout(150); await tap("2704");
await page.waitForSelector("#lockNow");
await page.click("#lockNow"); await page.waitForSelector("#forgot"); await shot(page, "13-lock");
await tap("1111"); await page.waitForFunction(() => document.querySelector(".padmsg").textContent.includes("달라요"));
await page.reload(); await page.waitForSelector("#forgot");
assert.equal((await (await page.request.post(B + "/api", { data: { action: "day", date: todayK } })).json()).error, "locked");
await tap("2704"); await page.waitForSelector("#today"); step("비밀번호 걸기 · 잠그기 · 풀기 (서버에서 막힘 확인)");

/* 노션 연결하고 옮기기 */
await page.click("#toSetup"); await page.click("#nOpen");
await page.fill("#nTok", "ntn_user_token_1111111111111"); await page.fill("#nDb", "https://www.notion.so/me/aaaabbbbccccddddeeeeffff00001111?v=1");
await page.click("#nGo"); await page.waitForSelector("#mv");
await page.waitForFunction(() => document.querySelector("#nState").textContent.includes("나의 기도 노트"));
await page.evaluate(() => document.querySelector("#storeBox").scrollIntoView()); await shot(page, "14-notion-connected");
await page.click("#mv"); await page.waitForFunction(() => !document.querySelector("#mv"));
await page.click("#back"); await page.waitForSelector(`.day.has[data-k="${todayK}"]`);
await page.click(`.day[data-k="${todayK}"]`); await page.waitForFunction(() => document.querySelectorAll(".bub").length === 4);
assert.equal(await page.locator(".bub.fav").count(), 1); step("내 노션 연결 → 기록 옮기기 → 그대로 보임");

/* 인터넷 끊김 */
await ctx.setOffline(true);
await page.fill("#myIn", "끊긴 동안 쓴 글"); await page.click("#mySend");
await page.waitForSelector(".bub.wait"); await shot(page, "15-offline-pending");
await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForFunction(() => document.querySelectorAll(".bub:not(.wait)").length === 5 && !document.querySelector(".bub.wait"));
step("끊긴 동안 쓴 글이 연결되면 저장됨");
await ctx.close();

/* ── 주인: 예전 노션 기록 이어받기 ── */
({ ctx, page } = await newCtx());
await as(7777, "주인");
await page.goto(B + "/?claim=dev-owner-code-1234"); await page.waitForSelector("#kakao");
assert.equal(new URL(page.url()).search, "");
await page.click("#kakao"); await page.waitForSelector("#today");
if (today.getFullYear() !== 2026 || today.getMonth() !== 10) { for (let i = 0; i < 40 && !(await page.textContent(".month")).includes("2026. 11"); i++) await page.click("#prev"); }
await page.waitForSelector('.day.has[data-k="2026-11-20"]'); await page.waitForSelector('.day.has[data-k="2026-11-21"]');
await shot(page, "16-owner-calendar");
await page.click('.day[data-k="2026-11-20"]'); await page.waitForSelector(".bub.god");
assert.ok((await page.textContent(".bub.god")).includes("여호와는 나의 목자시니"));
assert.ok((await page.textContent(".bub.god .vref")).includes("시 23:1"));
await shot(page, "17-owner-day"); step("주인 계정: 코드로 예전 노션 기록 이어받음");
await ctx.close();

/* ── 다른 사람은 주인 기록을 못 봄 ── */
({ ctx, page } = await newCtx());
await as(3003, "손님");
await page.goto(B); await page.click("#kakao"); await page.waitForSelector("#today");
const r = await (await page.request.post(B + "/api", { data: { action: "day", date: "2026-11-20" } })).json();
assert.deepEqual(r.messages, []); step("다른 계정에는 보이지 않음");
await ctx.close();

/* ── 넓은 화면 ── */
const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "ko-KR" });
const wp = await wide.newPage(); await as(1001, "은혜");
await wp.goto(B); await wp.click("#kakao"); await wp.waitForSelector("#forgot, #today"); await shot(wp, "18-desktop");
await wide.close();

await browser.close();
if (errors.length) { console.log("\n콘솔 오류:\n" + errors.join("\n")); process.exit(1); }
console.log("\n화면 시험 통과");
