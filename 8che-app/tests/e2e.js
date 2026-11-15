// 사용법: node tests/e2e.js <스크린샷 폴더>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const shot = n => p.screenshot({ path: path.join(out, n + '.png'), fullPage: true });
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await shot('1-home');
  await p.click('text=테스트 시작'); await p.click('text=시작하기'); await shot('2-quiz');
  // 목양체질 전형 응답
  const v = await p.evaluate(() => C8.QUESTIONS.map(q => Math.sign(q.v[4])));
  for (const a of v) await p.click(`.opt >> nth=${a > 0 ? 0 : a < 0 ? 2 : 1}`);
  await p.waitForSelector('.result-hero'); await shot('3-result');
  if (!(await p.textContent('.result-hero h1')).includes('목양체질')) throw new Error('판정 오류');
  if (await p.locator('text=카카오').count()) throw new Error('로그인 버튼이 남아 있음');
  if (await p.evaluate(() => C8.store.profile.constitution !== 'mokyang')) throw new Error('브라우저 저장 실패');
  await p.click('text=일주일 추천 식단 보기'); await p.click('text=3끼+간식1'); await shot('4-plan');
  if (await p.locator('.meal').count() !== 4) throw new Error('끼니 수 오류');
  await p.click('nav >> text=음식 확인'); await p.fill('#q', '고등어'); await p.press('#q', 'Enter'); await shot('5-check');
  if (!(await p.textContent('.verdict .badge')).includes('안 좋아요')) throw new Error('음식 확인 오류');
  await p.fill('#q', '쇠고기'); await p.press('#q', 'Enter'); await shot('5b-check-good');
  await p.reload(); await p.click('nav >> text=내 정보'); await shot('6-me');
  await p.click('text=체질 테스트 다시 하기'); await p.click('text=시작하기');
  const w = await p.evaluate(() => C8.QUESTIONS.map(q => Math.sign(q.v[6])));
  for (const a of w) await p.click(`.opt >> nth=${a > 0 ? 0 : a < 0 ? 2 : 1}`);
  await p.waitForSelector('.result-hero');
  const st = await p.evaluate(() => ({ c: C8.store.profile.constitution, h: C8.store.profile.history.length }));
  if (st.c !== 'suyang' || st.h !== 2) throw new Error('재검사 업데이트 실패 ' + JSON.stringify(st));
  await p.setViewportSize({ width: 1200, height: 900 }); await p.goto('file://' + path.resolve(__dirname, '../index.html') + '#/about'); await shot('7-about-desktop');
  if (errs.length) throw new Error(errs.join('\n'));
  console.log('e2e ok'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
