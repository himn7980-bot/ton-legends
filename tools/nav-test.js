// Navigation test: every screen can be left with ✕ / header back / device back (browser history).
// usage: node tools/nav-test.js <dist html> <screenshot dir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/telegram\.org|fonts\.g/, r => r.abort());
  await p.goto('file://' + file); await p.waitForTimeout(400);
  const st = () => p.evaluate(() => ({ tab: S.tab, modal: !$('#modal').hidden, battle: !$('#battle').hidden, bt: !!BT, paused: !!(BT && BT.paused), back: !$('#back').hidden }));
  const deviceBack = async () => { await p.evaluate(() => history.back()); await p.waitForTimeout(250); };
  const step = async (name, fn, expect) => { await fn(); await p.waitForTimeout(250); const s = await st(); for (const k in expect) assert.equal(s[k], expect[k], `${name}: ${k} = ${s[k]}`); console.log('✓', name); };

  await step('help closes with ✕ (daily reward next; the community is picked after the first win)', async () => { await p.click('#m-close'); await p.waitForTimeout(700); }, { modal: true });
  assert.equal(await p.$('#fac-ok'), null, 'no community picker before the first battle'); assert.ok(await p.$('#daily'), 'daily reward shown');
  await step('daily popup closes with device back', deviceBack, { modal: false, tab: 'map', back: false });
  await step('open Heroes tab → header back visible', () => p.click('[data-tab=heroes]'), { tab: 'heroes', back: true });
  await step('open hero details', () => p.click('.card[data-id=pinkbull]'), { modal: true });
  await p.screenshot({ path: out + '/n1-hero.png' });
  await step('✕ closes hero details, stays on Heroes', () => p.click('#m-close'), { modal: false, tab: 'heroes' });
  await p.evaluate(() => { S.coins = 9999; save(); });
  await step('reopen hero, upgrade', async () => { await p.click('.card[data-id=egor]'); await p.click('#up'); }, { modal: true });
  await step('device back closes it', deviceBack, { modal: false, tab: 'heroes' });
  await step('tap outside closes popup', async () => { await p.click('.card[data-id=egor]'); await p.mouse.click(195, 830); }, { modal: false });
  await step('Heroes → Chests', () => p.click('[data-tab=chest]'), { tab: 'chest' });
  await step('header back → Map (home)', () => p.click('#back'), { tab: 'map', back: false });
  await step('Quests → device back → Map', async () => { await p.click('[data-tab=quests]'); await deviceBack(); }, { tab: 'map' });
  await p.evaluate(() => { S.tutDone = true; save(); }); // the guided first battle is tested on its own
  await step('start battle', () => p.click('#go'), { bt: true, battle: true });
  await step('device back asks to confirm + pauses', deviceBack, { modal: true, paused: true });
  await p.screenshot({ path: out + '/n2-leave.png' });
  await step('back again = keep fighting', deviceBack, { modal: false, paused: false, bt: true });
  await step('✕ in battle → confirm → Leave', async () => { await p.click('#b-exit'); await p.click('#lv-yes'); }, { bt: false, battle: false, tab: 'map', modal: false });
  await p.evaluate(() => { S.auto = true; S.speed = 3; S.tutDone = true; save(); });
  await step('win a battle', async () => { await p.click('#go'); await p.waitForSelector('#r-map', { timeout: 60000 }); }, { modal: true, battle: true });
  await step('device back on result → community picker (first win)', deviceBack, { modal: true, battle: false });
  assert.ok(await p.$('#fac-ok'), 'community picker shown after the first win');
  await step('pick a community → Map', async () => { await p.click('[data-fac=egor]'); await p.click('#fac-ok'); await p.waitForTimeout(500); }, { modal: false, tab: 'map' });
  assert.equal(await p.evaluate(() => S.faction), 'egor');
  await step('Ranks → Community War → back → Map', async () => { await p.click('[data-tab=rank]'); await p.click('#to-war2'); await p.waitForTimeout(200); await deviceBack(); }, { tab: 'map', modal: false });
  await step('settings ✕', async () => { await p.click('#settings'); await p.click('#m-close'); }, { modal: false });
  await step('Persian: back still works', async () => { await p.evaluate(() => { S.lang = 'fa'; applyLang('fa'); }); await p.click('[data-tab=rank]'); await p.click('#back'); }, { tab: 'map' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
