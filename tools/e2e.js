// Browser end-to-end test: real server + fake Telegram Bot API + simulated Telegram WebApp client.
// usage: node tools/e2e.js <screenshot dir>
const http = require('http'), crypto = require('crypto'), path = require('path'), os = require('os'), fs = require('fs');
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
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const check = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex'));
  return p.toString();
}
(async () => {
  await new Promise(r => fake.listen(0, r));
  Object.assign(process.env, { BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://x', DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tle-')), 'db.json'), TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('../server/server.js');
  srv.server.listen(0); await new Promise(r => srv.server.once('listening', r));
  await srv.setupBot(); srv.pollLoop();
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  // seed a rival on the leaderboard
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  await post('/api/score', { initData: initData({ id: 5, first_name: 'Rival' }), stage: 14, power: 9000 });
  await fetch(base + '/api/health'); await new Promise(r => setTimeout(r, 300)); // let getMe resolve

  const user = { id: 777, first_name: 'Sara' };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.g/, r => r.abort());
  // Simulated Telegram client: WebApp object + CloudStorage + openInvoice that triggers a real payment update.
  await p.route(/telegram-web-app\.js/, r => r.fulfill({ contentType: 'application/javascript', body: `
    const store = {};
    window.Telegram = { WebApp: { initData: ${JSON.stringify(initData(user))}, initDataUnsafe: { user: ${JSON.stringify(user)}, start_param: '' },
      ready(){}, expand(){}, setHeaderColor(){}, setBackgroundColor(){}, isVersionAtLeast: () => true,
      HapticFeedback: { impactOccurred(){} },
      CloudStorage: { setItem(k, v, cb){ store[k] = v; window.__cloud = store; cb && cb(null, true); }, getItem(k, cb){ cb(null, store[k] || ''); } },
      openTelegramLink(u){ window.__shared = u; },
      openInvoice(link, cb){ window.__invoice = link; fetch('/__pay').finally(() => setTimeout(() => cb('paid'), 300)); } } };` }));
  await p.route('**/__pay', r => { queue.push({ update_id: 1, message: { chat: { id: 777 }, from: user, successful_payment: { telegram_payment_charge_id: 'c1', total_amount: 25, invoice_payload: '777:coins_s' } } }); r.fulfill({ body: 'ok' }); });

  await p.goto(base + '/'); await p.waitForTimeout(800);
  await p.click('#ok'); await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '/e1-daily.png' });
  await p.click('#daily'); await p.waitForTimeout(300); await p.click('#gm-ok');
  // win two stages
  await p.evaluate(() => { S.auto = true; S.speed = 3; save(); });
  for (let i = 0; i < 2; i++) { await p.click('#go'); await p.waitForSelector('#r-map', { timeout: 60000 }); await p.click('#r-map'); }
  await p.click('[data-tab=quests]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/e2-quests.png', fullPage: true });
  await p.click('[data-tab=chest]'); await p.waitForTimeout(300);
  const coinsBefore = await p.evaluate(() => S.coins);
  await p.screenshot({ path: OUT + '/e3-shop.png', fullPage: true });
  await p.click('[data-pack=coins_s]'); await p.waitForSelector('#gm-ok', { timeout: 15000 });
  await p.screenshot({ path: OUT + '/e4-bought.png' });
  const coinsAfter = await p.evaluate(() => S.coins);
  await p.click('#gm-ok');
  await p.waitForTimeout(1500); // score submit debounce
  await p.click('[data-tab=rank]'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/e5-rank.png', fullPage: true });
  await p.click('#invite');
  await p.click('#settings'); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/e6-settings.png' });
  const res = await p.evaluate(() => ({ shared: window.__shared, cloud: !!(window.__cloud && window.__cloud.save), invoice: window.__invoice, stage: S.cleared }));
  console.log({ coinsBefore, coinsAfter, ...res, errors: errs });
  await b.close(); srv.stop(); fake.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
