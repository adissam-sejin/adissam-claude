const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto("file://" + __dirname + "/mockups.html");
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  for (const k of ["A", "B", "C"]) await p.locator("#board" + k).screenshot({ path: __dirname + "/시안-" + k + ".png" });
  await b.close();
})();
