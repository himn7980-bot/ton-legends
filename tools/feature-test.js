// Feature test (offline build): Fusion Lab, holo cards, guide, language picker incl. RTL.
// usage: node tools/feature-test.js <dist html> <screenshot dir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/telegram\.org|fonts\.g/, r => r.abort());
  await p.goto('file://' + file); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => LANG), 'ru', 'auto-detected phone language');
  console.log('✓ language auto-detected from the device (ru)');
  await p.click('#m-close'); await p.waitForTimeout(500); if (await p.$('#modal:not([hidden])')) await p.click('#m-close');
  // give the player what a fusion needs
  await p.evaluate(() => { Object.assign(S.owned, { notcoin: 8, pinkbull: 8, egor: 12, memegram: 12, yoda: 12 }); S.coins = 30000; S.holo.pinkbull = true; save(); showCoins(); });
  await p.click('[data-tab=heroes]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l1-heroes-ru.png' });
  await p.click('#to-lab'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/l2-lab-empty.png' });
  const pick = async ids => { for (const id of ids) { await p.click('.altar-slot:not(.filled)'); await p.click(`[data-pick=${id}]`); await p.waitForTimeout(150); } };
  // a combination whose parts are too low: shown, but the fuse button stays off
  await pick(['gramcat', 'babyshark']);
  assert.ok(await p.$eval('#lab-fuse', b => b.disabled), 'low-level parts cannot fuse');
  assert.match(await p.textContent('.fresult'), /#81/);
  await p.screenshot({ path: out + '/l2b-lab-low.png' });
  await p.click('.altar-slot.filled'); await p.click('.altar-slot.filled');
  // the player's own pick: Pink Bull + Notcoin → #1 Golden Bull
  await pick(['pinkbull', 'notcoin']);
  assert.match(await p.textContent('.fresult'), /Golden Bull/);
  await p.screenshot({ path: out + '/l2c-lab-ready.png' });
  await p.click('#lab-fuse'); await p.waitForSelector('#fr-ok');
  await p.screenshot({ path: out + '/l3-fused.png' });
  await p.click('#fr-ok');
  await pick(['egor', 'memegram', 'yoda']);
  await p.click('#lab-fuse'); await p.waitForSelector('#fr-ok'); await p.click('#fr-ok');
  await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l3b-lab-mine.png', fullPage: true });
  assert.equal(await p.evaluate(() => S.owned.f1 && S.owned.f440), 1);
  assert.equal(await p.evaluate(() => S.coins), 30000 - 4000 - 15000);
  console.log('✓ duo + trio fusion crafted, coins charged');
  // fusion in team and fights
  await p.evaluate(async () => { await act({ type: 'team', team: ['f1', 'f440', 'babyshark'] }); S.auto = true; S.speed = 3; save(); });
  await p.click('[data-tab=map]'); await p.click('#go'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '/l4-fusion-battle.png' });
  await p.waitForSelector('#r-map', { timeout: 60000 }); await p.click('#r-map');
  console.log('✓ fusion cards battle (both parts’ skills)');
  await p.click('[data-tab=heroes]'); await p.click('.card[data-id=f1]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l5-fusion-detail.png' }); await p.click('#m-close');
  await p.click('.card[data-id=pinkbull]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l6-holo.png' }); await p.click('#m-close');
  // languages
  for (const code of ['ar', 'zh', 'hi', 'en']) {
    await p.click('#settings'); await p.click('#s-lang'); await p.click(`[data-lang=${code}]`); await p.waitForTimeout(150);
    await p.click('#m-close'); await p.click('[data-tab=map]'); await p.waitForTimeout(150);
    const dir = await p.evaluate(() => document.documentElement.dir);
    assert.equal(dir, code === 'ar' ? 'rtl' : 'ltr');
    await p.screenshot({ path: `${out}/l7-map-${code}.png` });
  }
  console.log('✓ language switch ar (RTL) / zh / hi / en');
  await p.click('#settings'); await p.click('#s-guide'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l8-guide.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
