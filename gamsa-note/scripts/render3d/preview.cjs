const { chromium } = require('playwright');
const serve = require('./serve.cjs');
const fs = require('fs');
(async () => {
  const srv = await serve(5181);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('LOG', m.text()));
  await p.goto('http://localhost:5181/scripts/render3d/index.html');
  await p.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const out = process.argv[2];
  const per = await p.evaluate(() => window.renderPersimmon(400));
  fs.writeFileSync(out + '/persimmon.png', Buffer.from(per.split(',')[1], 'base64'));
  for (const st of [0,1,2,3,4,5]) {
    const r = await p.evaluate((st) => window.renderTree(st, 300, 330, st === 5 ? 40 : 0), st);
    fs.writeFileSync(`${out}/tree${st}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
    if (r.meta) console.log('spots', r.meta.length);
  }
  await b.close(); srv.close();
})();
