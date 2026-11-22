/* 긴 기간·긴 글 PDF 시험 — dev-server를 켜 두고: node test/pdf-long.cjs */
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const B = "http://localhost:8788", out = path.join(__dirname, "shots");
  fs.mkdirSync(out, { recursive: true });
  await fetch(B + "/__as?id=8801&nick=" + encodeURIComponent("긴기록"));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, locale: "ko-KR" });
  const p = await ctx.newPage();
  await p.goto(B); await p.click("#kakao"); await p.waitForSelector("#today");
  const post = (data) => p.request.post(B + "/api", { data }).then((r) => r.json());
  const verses = ["여호와는 나의 목자시니 내게 부족함이 없으리로다", "두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라 참으로 나의 의로운 오른손으로 너를 붙들리라", "항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라"];
  const rx = ["❤️", "👍", "🥹", "🙏", "✅", ""];
  for (let d = 1; d <= 12; d++) {
    const date = "2026-10-" + String(d).padStart(2, "0");
    for (let i = 0; i < 4; i++) {
      const who = i % 2 ? "god" : "me";
      const text = who === "god" ? verses[(d + i) % 3] : (d === 5 && i === 0 ? ("오늘은 정말 길게 적어 봅니다. 감사한 일이 참 많았어요. ".repeat(60)) : "오늘 하루도 감사합니다 😊 마음이 조금 무거웠지만 다시 일어나 볼게요.\n두 번째 줄도 적어요.");
      const r = await post({ action: "add", date, who, text, ref: who === "god" ? "시 23:1" : "", time: "오전 06:3" + i });
      const e = rx[(d + i) % 6]; if (e) await post({ action: "react", date, id: r.id, rx: e });
    }
  }
  await p.reload(); await p.waitForSelector("#today");
  await p.click("#toSetup"); await p.click("#pdf"); await p.waitForSelector("#pGo");
  await p.click('#pq [data-q="year"]');
  await p.waitForFunction(() => document.querySelector("#pGo").textContent.includes("12일"));
  const t0 = Date.now();
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#pGo")]);
  await dl.saveAs(path.join(out, "long.pdf"));
  console.log("long.pdf", Math.round(fs.statSync(path.join(out, "long.pdf")).size / 1024) + "KB", (Date.now() - t0) + "ms", dl.suggestedFilename());
  await b.close();
})();
