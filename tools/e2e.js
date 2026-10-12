// Browser end-to-end test: real server + fake Telegram Bot API + two simulated Telegram users.
// Covers: server-owned profile, verified stage wins, Stars purchase, Telegram BackButton, and a live arena duel.
// usage: node tools/e2e.js <screenshot dir>
const http = require('http'), crypto = require('crypto'), path = require('path'), os = require('os'), fs = require('fs');
const assert = require('assert');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '.';
const TOKEN = '999:E2E';
const queue = [];
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const m = req.url.split('/').pop();
    const out = { getMe: { username: 'TonLegendsBot' }, createInvoiceLink: 'https://t.me/$inv', getUpdates: queue.splice(0) }[m] ?? true;
    setTimeout(() => { res.writeHead(200); res.end(JSON.stringify({ ok: true, result: out })); }, m === 'getUpdates' && !out.length ? 150 : 0);
  });
});
function initData(user, startParam) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  if (startParam) fields.start_param = startParam;
  const p = new URLSearchParams(fields);
  const check = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex'));
  return p.toString();
}
const tgScript = (user, startParam) => `
  window.Telegram = { WebApp: { initData: ${JSON.stringify(initData(user, startParam))}, initDataUnsafe: { user: ${JSON.stringify(user)}, start_param: ${JSON.stringify(startParam || '')} },
    ready(){}, expand(){}, setHeaderColor(){}, setBackgroundColor(){}, isVersionAtLeast: () => true, HapticFeedback: { impactOccurred(){} },
    BackButton: { show(){ window.__bb = true; }, hide(){ window.__bb = false; }, onClick(cb){ window.__bbcb = cb; } },
    enableClosingConfirmation(){}, disableClosingConfirmation(){},
    CloudStorage: { setItem(k, v, cb){ cb && cb(null, true); }, getItem(k, cb){ cb(null, ''); } },
    openTelegramLink(u){ window.__shared = u; },
    openInvoice(link, cb){ window.__invoice = link; fetch('/__pay').finally(() => setTimeout(() => cb('paid'), 300)); } } };`;

(async () => {
  await new Promise(r => fake.listen(0, r));
  Object.assign(process.env, { BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://x', DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tle-')), 'db.json'), TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('../server/server.js');
  srv.server.listen(0); await new Promise(r => srv.server.once('listening', r));
  await srv.setupBot(); srv.pollLoop();
  const base = `http://127.0.0.1:${srv.server.address().port}`;

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errs = [];
  async function player(user, startParam) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${user.first_name}: ${e.message}`));
    await p.route(/fonts\.g/, r => r.abort());
    await p.route(/telegram-web-app\.js/, r => r.fulfill({ contentType: 'application/javascript', body: tgScript(user, startParam) }));
    await p.route('**/__pay', r => { queue.push({ update_id: Date.now(), message: { chat: { id: user.id }, from: user, successful_payment: { telegram_payment_charge_id: 'c' + Date.now(), total_amount: 25, invoice_payload: `${user.id}:gems_s` } } }); r.fulfill({ body: 'ok' }); });
    await p.goto(base + '/'); await p.waitForFunction(() => Online.state.profile === true, null, { timeout: 15000 });
    await p.waitForTimeout(300);
    return p;
  }
  const ECON = require('../src/economy.js');
  const serverProfile = uid => srv.db.users[String(uid)].profile;
  const dismiss = async p => { for (let i = 0; i < 4; i++) { if (await p.$('#modal:not([hidden])')) { await p.click('#m-close'); await p.waitForTimeout(250); } } };

  // ---- player 1: profile, verified stage wins, purchase ----
  const sara = { id: 777, first_name: 'Sara' };
  const p1 = await player(sara);
  await dismiss(p1);
  await p1.evaluate(() => { S.auto = true; S.speed = 3; save(); });
  for (let i = 0; i < 2; i++) { await p1.click('#go'); await p1.waitForSelector('#r-map', { timeout: 60000 }); await p1.click('#r-map'); }
  assert.equal(serverProfile(777).cleared, 2, 'server verified both stage wins');
  assert.equal(await p1.evaluate(() => S.coins), serverProfile(777).coins, 'client shows server coins');
  console.log('✓ stage wins verified by the server replay; coins', serverProfile(777).coins);
  const before = serverProfile(777).gems;
  await p1.click('[data-tab=chest]'); await p1.click('[data-pack=gems_s]'); await p1.waitForSelector('#gm-ok', { timeout: 15000 });
  await p1.screenshot({ path: OUT + '/g1-bought.png' }); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).gems, before + 50); assert.equal(await p1.evaluate(() => S.gems), before + 50);
  assert.equal(await p1.textContent('#gems span'), String(before + 50));
  console.log('✓ Stars purchase credited on the server (+50 gems)');
  // gems → coins exchange and time warp
  const c0 = serverProfile(777).coins, g0 = serverProfile(777).gems, rate = ECON.gemRate(serverProfile(777));
  await p1.screenshot({ path: OUT + '/g2-shop.png', fullPage: true });
  await p1.click('[data-ex="10"]'); await p1.waitForSelector('#gm-ok'); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).coins, c0 + 10 * rate); assert.equal(serverProfile(777).gems, g0 - 10);
  serverProfile(777).gems += 200; // e.g. from achievements; arrives with the next server reply
  await p1.click('#warp'); await p1.waitForSelector('#gm-ok'); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).gems, g0 + 200 - 10 - ECON.WARP_COST);
  await p1.click('[data-k=gem]'); await p1.waitForSelector('#cl'); await p1.screenshot({ path: OUT + '/g3-gemchest.png' }); await p1.click('#cl');
  assert.equal(serverProfile(777).gems, g0 + 200 - 10 - ECON.WARP_COST - ECON.CHESTS.gem.cost, 'gem chest paid in gems');
  assert.equal(await p1.textContent('#gems span'), String(serverProfile(777).gems));
  console.log('✓ exchange (1 💎 = 🪙', rate + '), time warp');
  // Cheating attempt: editing coins locally changes nothing on the server.
  await p1.evaluate(() => { S.coins = 999999; save(); });
  await p1.click('[data-tab=heroes]'); await p1.click('.card[data-id=egor]'); await p1.click('#up'); await p1.waitForTimeout(400);
  assert.ok(await p1.evaluate(() => S.coins) < 999999, 'server overwrote the edited balance');
  await p1.click('#m-close');
  console.log('✓ locally edited coins are ignored (server balance wins)');

  // ---- arena: Sara hosts a 500 duel, Omid opens the invite link ----
  await p1.click('[data-tab=arena]'); await p1.waitForTimeout(200);
  await p1.click('[data-stake="500"]');
  await p1.screenshot({ path: OUT + '/a1-arena.png', fullPage: true });
  const s0 = serverProfile(777).coins;
  await p1.click('#pv-room'); await p1.waitForSelector('.duel-code');
  const code = await p1.textContent('.duel-code');
  assert.equal(serverProfile(777).coins, s0 - 500, 'stake held');
  await p1.click('#pv-share');
  assert.ok((await p1.evaluate(() => window.__shared)).includes(encodeURIComponent(`startapp=duel_${code}`)), 'invite link shared');
  await p1.screenshot({ path: OUT + '/a2-waiting.png' });

  const omid = { id: 888, first_name: 'Omid' };
  srv.db.users['888'] = { id: '888', pending: 0, gift: 0, refs: 0, created: Date.now(), profile: { ...ECON.newProfile(Date.now()), coins: 2500 } };
  const p2 = await player(omid, 'duel_' + code); // opened from the invite link
  await p2.waitForSelector('#dj-yes'); await p2.waitForTimeout(200);
  await p2.screenshot({ path: OUT + '/a3-invite.png' });
  const o0 = serverProfile(888).coins;
  await p2.click('#dj-yes');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p2.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p1.waitForTimeout(1500);
  await p1.screenshot({ path: OUT + '/a4-countdown.png' });
  await p1.waitForTimeout(4500);
  await p1.screenshot({ path: OUT + '/a5-duel-sara.png' });
  await p2.screenshot({ path: OUT + '/a5-duel-omid.png' });
  // tap any glowing card on both sides while it lasts
  for (let i = 0; i < 40; i++) {
    for (const p of [p1, p2]) { const c = await p.$('.hcard.hero.full'); if (c) await c.click().catch(() => {}); }
    if (await p1.$('#pr-arena') && await p2.$('#pr-arena')) break;
    await p1.waitForTimeout(500);
  }
  await p1.waitForSelector('#pr-arena', { timeout: 150000 }); await p2.waitForSelector('#pr-arena', { timeout: 150000 });
  await p1.screenshot({ path: OUT + '/a6-result-sara.png' });
  await p2.screenshot({ path: OUT + '/a6-result-omid.png' });
  const s1 = serverProfile(777).coins, o1 = serverProfile(888).coins;
  assert.equal(s1 + o1, s0 + o0, 'pot conserved');
  assert.equal(await p1.evaluate(() => S.coins), s1); assert.equal(await p2.evaluate(() => S.coins), o1);
  console.log(`✓ duel finished: Sara ${s1 - s0 >= 0 ? '+' : ''}${s1 - s0}, Omid ${o1 - o0 >= 0 ? '+' : ''}${o1 - o0} (pot conserved, both screens match the server)`);
  await p1.click('#pr-arena'); await p2.click('#pr-map');
  assert.equal(Object.keys(srv.db.escrow).length, 0);

  // ---- AI rival from the arena screen ----
  await p1.click('[data-tab=arena]'); await p1.waitForTimeout(200);
  await p1.screenshot({ path: OUT + '/ai1-arena.png', fullPage: true });
  const k0 = serverProfile(777).coins;
  await p1.click('[data-ai=easy]');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p1.waitForTimeout(4000); await p1.screenshot({ path: OUT + '/ai2-fight.png' });
  await p1.waitForSelector('#pr-again', { timeout: 150000 });
  await p1.screenshot({ path: OUT + '/ai3-result.png' });
  const won = serverProfile(777).stats.aiWins || 0;
  console.log(`✓ AI duel: ${won ? 'won, +' + (serverProfile(777).coins - k0) + ' coins' : 'lost, no coins lost'} (${serverProfile(777).coins >= k0})`);
  assert.ok(serverProfile(777).coins >= k0, 'AI duel never costs coins');
  await p1.click('#pr-arena');

  // ---- clans: Sara creates one, Lina joins from the invite link ----
  serverProfile(777).coins += 2500;
  await p1.click('[data-tab=rank]'); await p1.click('#to-clan'); await p1.waitForSelector('#cl-create');
  await p1.fill('#cl-name', 'Night Owls'); await p1.click('[data-emb="🦅"]'); await p1.click('#cl-create');
  await p1.waitForSelector('#cl-invite'); await p1.click('#cl-invite');
  const clanId = Object.keys(srv.db.clans)[0];
  assert.ok((await p1.evaluate(() => window.__shared)).includes(encodeURIComponent(`startapp=clan_${clanId}`)), 'clan link shared');
  const lina = { id: 999, first_name: 'Lina' };
  const p3 = await player(lina, 'clan_' + clanId);
  await p3.waitForSelector('#cj-yes'); await p3.screenshot({ path: OUT + '/c1-invite.png' }); await p3.click('#cj-yes');
  await p3.waitForSelector('#cl-leave'); await p3.waitForTimeout(200);
  assert.equal(srv.db.clans[clanId].members.length, 2);
  await p3.screenshot({ path: OUT + '/c2-clan.png', fullPage: true });
  await p3.evaluate(() => window.__bbcb()); await p3.waitForTimeout(150);
  assert.equal(await p3.evaluate(() => S.tab), 'rank', 'back from the clan goes to Ranks');
  await p1.click('#m-close').catch(() => {}); await p1.click('[data-tab=rank]'); await p1.click('#to-clan'); await p1.waitForSelector('.crow');
  await p1.screenshot({ path: OUT + '/c3-leader.png', fullPage: true });
  console.log('✓ clan created, invite link opened, member joined');

  // ---- Telegram BackButton still drives navigation ----
  await p2.click('[data-tab=heroes]'); await p2.waitForTimeout(150);
  await p2.evaluate(() => window.__bbcb()); await p2.waitForTimeout(150);
  assert.equal(await p2.evaluate(() => S.tab), 'map');
  console.log('✓ Telegram BackButton');

  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.stop(); fake.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
