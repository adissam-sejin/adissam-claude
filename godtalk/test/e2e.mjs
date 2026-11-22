/* 화면 시험 — 먼저 node test/dev-server.mjs 를 켜 두고: node test/e2e.mjs */
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const B = "http://localhost:8788", shots = new URL("./shots/", import.meta.url).pathname;
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const newCtx = async (opt = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.SCALE) || 1, hasTouch: true, isMobile: true, locale: "ko-KR", acceptDownloads: true, ...opt });
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
const sendAs = async (page, who, text) => { await page.click(`.who [data-w=${who}]`); await page.fill("#msgIn", text); await page.click("#sendBtn"); };
const saved = (page, n) => page.waitForFunction((n) => document.querySelectorAll(".b:not(.wait)").length === n && !document.querySelector(".b.wait"), n);

/* ── 새 사용자 (밝은 화면) ── */
let { ctx, page } = await newCtx({ colorScheme: "light" });
await as(1001, "은혜");
await page.goto(B); await page.waitForSelector("#kakao");
await shot(page, "01-login-light"); step("로그인 화면");
await page.click("#kakao"); await page.waitForSelector("#today");
await page.waitForFunction(() => document.querySelector("#stat").textContent.includes("비어"));
step("카카오 로그인 → 달력");

await page.click("#today"); await page.waitForSelector("#msgIn");
await page.waitForSelector(".empty .face"); await shot(page, "02-chat-empty-light");
await sendAs(page, "me", "오늘은 마음이 자꾸 조급해져요");
await sendAs(page, "god", "조급해하지 마라. 내가 너와 함께 있단다");
await sendAs(page, "me", "네, 그 말씀 붙들게요");
await page.click("#openBible"); await page.waitForSelector("#q");
await page.waitForFunction(() => document.querySelector("#bstat").textContent.includes("구절"), null, { timeout: 20000 });
await page.fill("#q", "마 11:28"); await page.waitForSelector(".vs");
await page.click(".vs");
assert.equal(await page.textContent("#refText"), "마 11:28");
assert.ok(await page.locator(".who [data-w=god].on").count(), "성경에서 고르면 하나님 말씀으로 바뀜");
await page.click("#sendBtn");
await saved(page, 4);
assert.ok((await page.textContent("#cnt")).includes("4개의 말"));
assert.equal(await page.locator("img.av").count(), 3, "프로필은 머리글 1 + 하나님 말 묶음마다 1");
step("아래 입력칸 하나로 내 마음·하나님 말씀 보내기 + 성경에서 넣기");

/* 이모지 남기기 */
const gods = page.locator(".b.god"), mine = page.locator(".b.me");
await gods.nth(0).click(); await page.click('.picker .em[data-e="❤️"]');
await gods.nth(1).click(); await page.click('.picker .em[data-e="🥹"]');
await mine.nth(1).click(); await page.click('.picker .em[data-e="✅"]');
await page.waitForFunction(() => document.querySelectorAll(".rx").length === 3);
await mine.nth(0).click(); await page.click('.picker .em[data-e="👍"]'); await page.waitForFunction(() => document.querySelectorAll(".rx").length === 4);
await mine.nth(0).click(); await page.click('.picker .em[data-e="👍"]'); await page.waitForFunction(() => document.querySelectorAll(".rx").length === 3);
await gods.nth(1).click(); await page.waitForSelector(".picker .em.on");
await shot(page, "03-chat-light"); step("이모지 남기기 · 다시 눌러 지우기");
await page.click(".picker [data-a=more]"); await page.click("[data-a=edit]");
await page.fill(".dialog textarea", "수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라"); await page.click(".dialog [data-a=no]");
await mine.nth(0).click(); await page.click(".picker [data-a=more]"); await page.click("[data-a=edit]");
await page.fill(".dialog textarea", "오늘은 마음이 자꾸 조급했어요"); await page.click(".dialog [data-a=yes]");
await page.waitForFunction(() => document.querySelector(".b.me").textContent.includes("조급했어요"));
step("더보기 → 고치기");

await page.click("#back"); await page.waitForSelector("#today");
await page.waitForFunction(() => document.querySelector("#stat").textContent.includes("1일"));
assert.equal(await page.locator(`.day.has[data-k="${todayK}"]`).count(), 1);
await shot(page, "04-calendar-light"); step("달력에 하트");

await page.click("#toSearch"); await page.fill("#sq", "마음"); await page.press("#sq", "Enter");
await page.waitForSelector(".hit"); await shot(page, "05-search-light");
assert.equal(await page.locator(".hit").count(), 1);
await page.click(".hit"); await page.waitForSelector(".b.flash");
await page.click("#back"); await page.waitForSelector("#sq");
assert.equal(await page.inputValue("#sq"), "마음");
await page.click("#back"); await page.waitForSelector("#today"); step("대화 찾기 → 그날로 → 돌아오기");

await page.click("#toReacts"); await page.waitForSelector(".hit");
await page.waitForFunction(() => document.querySelector(".pill").textContent.includes("전체 3"));
await shot(page, "06-reacts-light");
await page.click('.pill[data-e="🥹"]');
assert.equal(await page.locator(".hit").count(), 1);
assert.ok((await page.textContent(".hit")).includes("마 11:28"));
await page.goBack(); await page.waitForSelector("#today"); step("이모지별로 모아 보기");

/* PDF */
await page.click("#toSetup"); await page.waitForFunction(() => document.querySelector("#stTotal").textContent === "1일");
await page.click("#pdf"); await page.waitForFunction(() => document.querySelector("#pGo") && document.querySelector("#pGo").textContent.includes("1일"));
await shot(page, "07-pdf-sheet-light");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#pGo")]);
await dl.saveAs(shots + "export.pdf");
assert.ok(/^GodTalk_\d{4}-\d\d-\d\d_\d{4}-\d\d-\d\d\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
assert.ok(fs.readFileSync(shots + "export.pdf").subarray(0, 5).toString() === "%PDF-");
step("기간 골라 PDF 저장 (" + Math.round(fs.statSync(shots + "export.pdf").size / 1024) + "KB)");

/* 글자 크기 · 어두운 화면 */
await page.click('#fsSeg [data-v="1.5"]');
assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--fs").trim()), "1.5");
await page.evaluate(() => document.querySelector("#thSeg").scrollIntoView()); await shot(page, "08-setup-bigfont-light");
await page.click('#fsSeg [data-v="1"]');
await page.click('#thSeg [data-v="dark"]');
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
await page.evaluate(() => document.querySelector(".scroll").scrollTop = 0); await shot(page, "09-setup-dark");
await page.click("#back"); await page.waitForSelector("#today"); await shot(page, "10-calendar-dark");
await page.click(`.day[data-k="${todayK}"]`); await saved(page, 4); await page.locator(".b.god").nth(1).click(); await shot(page, "11-chat-dark");
await page.click("#back"); await page.click("#toReacts"); await page.waitForSelector(".hit"); await shot(page, "12-reacts-dark");
await page.goBack(); await page.waitForSelector("#today");
step("글자 크기 · 밝은/어두운 화면 바꾸기");

/* 잠금 */
const tap = async (digits) => { for (const d of digits) await page.click(`.veil .pad [data-n="${d}"], .gate .pad [data-n="${d}"]`); await page.click(".veil .pad [data-a=ok], .gate .pad [data-a=ok]"); };
await page.click("#toSetup"); await page.click("#pinOn"); await tap("2704"); await page.waitForTimeout(150); await tap("2704");
await page.waitForSelector("#lockNow");
await page.click("#lockNow"); await page.waitForSelector("#forgot"); await shot(page, "13-lock-dark");
await tap("1111"); await page.waitForFunction(() => document.querySelector(".padmsg").textContent.includes("달라요"));
await page.reload(); await page.waitForSelector("#forgot");
assert.equal((await (await page.request.post(B + "/api", { data: { action: "day", date: todayK } })).json()).error, "locked");
await tap("2704"); await page.waitForSelector("#today"); step("비밀번호 걸기 · 잠그기 · 풀기 (서버에서 막힘 확인)");

/* 노션 연결하고 옮기기 */
await page.click("#toSetup"); await page.click("#nOpen");
await page.fill("#nTok", "ntn_user_token_1111111111111"); await page.fill("#nDb", "https://www.notion.so/me/aaaabbbbccccddddeeeeffff00001111?v=1");
await page.click("#nGo"); await page.waitForSelector("#mv");
await page.waitForFunction(() => document.querySelector("#nState").textContent.includes("나의 기도 노트"));
await page.click("#mv"); await page.waitForFunction(() => !document.querySelector("#mv"));
await page.click("#back"); await page.waitForSelector(`.day.has[data-k="${todayK}"]`);
await page.click(`.day[data-k="${todayK}"]`); await saved(page, 4);
assert.equal(await page.locator(".rx").count(), 3); step("내 노션 연결 → 기록 옮기기 → 이모지까지 그대로");

/* 인터넷 끊김 */
await ctx.setOffline(true);
await sendAs(page, "me", "끊긴 동안 쓴 글");
await page.waitForSelector(".b.wait");
await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event("online")));
await saved(page, 5);
step("끊긴 동안 쓴 글이 연결되면 저장됨");
await ctx.close();

/* ── 주인: 예전 노션 기록 이어받기 (어두운 화면) ── */
({ ctx, page } = await newCtx({ colorScheme: "dark" }));
await as(7777, "주인");
await page.goto(B + "/?claim=dev-owner-code-1234"); await page.waitForSelector("#kakao");
assert.equal(new URL(page.url()).search, "");
await shot(page, "14-login-dark");
await page.click("#kakao"); await page.waitForSelector("#today");
if (today.getFullYear() !== 2026 || today.getMonth() !== 10) { for (let i = 0; i < 40 && !(await page.textContent(".month")).includes("2026. 11"); i++) await page.click("#prev"); }
await page.waitForSelector('.day.has[data-k="2026-11-20"]'); await page.waitForSelector('.day.has[data-k="2026-11-21"]');
await page.click('.day[data-k="2026-11-20"]'); await page.waitForSelector(".b.god");
assert.ok((await page.textContent(".b.god")).includes("여호와는 나의 목자시니"));
assert.ok((await page.textContent(".b.god .ref")).includes("시 23:1"));
step("주인 계정: 코드로 예전 노션 기록 이어받음");
await ctx.close();

/* ── 다른 사람은 주인 기록을 못 봄 ── */
({ ctx, page } = await newCtx());
await as(3003, "손님");
await page.goto(B); await page.click("#kakao"); await page.waitForSelector("#today");
const r = await (await page.request.post(B + "/api", { data: { action: "day", date: "2026-11-20" } })).json();
assert.deepEqual(r.messages, []); step("다른 계정에는 보이지 않음");
await ctx.close();

await browser.close();
if (errors.length) { console.log("\n콘솔 오류:\n" + errors.join("\n")); process.exit(1); }
console.log("\n화면 시험 통과");
