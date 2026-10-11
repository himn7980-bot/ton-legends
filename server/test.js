// End-to-end test against a local fake of the Telegram Bot API (no network needed).
const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const os = require('os'), path = require('path'), fs = require('fs');

const TOKEN = '123456:TEST_TOKEN';
const calls = [];
const queue = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const method = req.url.split('/').pop();
    const data = body ? JSON.parse(body) : {};
    calls.push({ method, data });
    const out = { getMe: { username: 'TonLegendsTestBot' }, createInvoiceLink: 'https://t.me/$invoice-test', getUpdates: queue.splice(0) }[method] ?? true;
    setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: out })); }, method === 'getUpdates' && !out.length ? 200 : 0);
  });
});

function initData(user, ageSec = 0) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - ageSec), query_id: 'AAA', user: JSON.stringify(user) });
  const check = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return p.toString();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => fake.listen(0, r));
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tl-')), 'db.json');
  Object.assign(process.env, { BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://game.example', PORT: '0', DATA_FILE: dataFile, TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('./server.js');
  srv.server.listen(0);
  await new Promise(r => srv.server.once('listening', r));
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  srv.pollLoop();
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.json() }));

  const alice = { id: 111, first_name: 'Alice' }, bob = { id: 222, first_name: 'Bob', last_name: '<script>' };

  // static files
  let r = await fetch(base + '/'); assert.equal(r.status, 200); assert.match(await r.text(), /TON Legends/);
  r = await fetch(base + '/images/pengu.jpg'); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  r = await fetch(base + '/..%2fserver%2fserver.js'); assert.notEqual(r.status, 200);

  // health
  r = await fetch(base + '/api/health').then(x => x.json()); assert.equal(r.ok, true); assert.equal(r.packs.length, 3);

  // auth
  r = await post('/api/hello', { initData: 'user=%7B%22id%22%3A1%7D&auth_date=1&hash=abc' }); assert.equal(r.status, 401);
  r = await post('/api/hello', { initData: initData(alice, 2 * 86400) }); assert.equal(r.status, 401, 'expired initData rejected');
  r = await post('/api/hello', { initData: initData(alice) }); assert.equal(r.status, 200);

  // referral: bob joins through alice's link
  r = await post('/api/hello', { initData: initData(bob), startParam: 'ref_111' }); assert.equal(r.body.pending, 300);
  r = await post('/api/hello', { initData: initData(bob), startParam: 'ref_111' }); assert.equal(r.body.pending, 300, 'referral applied once');
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 500);
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 0);
  r = await post('/api/claim', { initData: initData(bob) }); assert.equal(r.body.coins, 300);

  // scores + leaderboard (clamped, monotonic)
  await post('/api/score', { initData: initData(alice), stage: 12, power: 5000 });
  await post('/api/score', { initData: initData(bob), stage: 999, power: 1 });
  await post('/api/score', { initData: initData(alice), stage: 3, power: 1 });
  r = await post('/api/leaderboard', { initData: initData(alice) });
  assert.deepEqual(r.body.top.map(x => [x.name, x.stage]), [['Bob <script>', 50], ['Alice', 12]]);
  assert.deepEqual(r.body.me, { rank: 2, stage: 12 });

  // Stars purchase flow
  r = await post('/api/invoice', { initData: initData(alice), pack: 'coins_m' });
  assert.equal(r.body.link, 'https://t.me/$invoice-test');
  const inv = calls.find(c => c.method === 'createInvoiceLink').data;
  assert.equal(inv.currency, 'XTR'); assert.match(inv.title, /10,000 coins/); assert.equal(inv.prices[0].amount, 75); assert.equal(inv.payload, '111:coins_m');
  r = await post('/api/invoice', { initData: initData(alice), pack: 'nope' }); assert.equal(r.status, 400);

  queue.push({ update_id: 1, pre_checkout_query: { id: 'pc1', from: alice, currency: 'XTR', total_amount: 75, invoice_payload: '111:coins_m' } });
  queue.push({ update_id: 2, pre_checkout_query: { id: 'pc2', from: alice, currency: 'XTR', total_amount: 1, invoice_payload: '111:coins_m' } });
  queue.push({ update_id: 3, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'ch1', total_amount: 75, invoice_payload: '111:coins_m' } } });
  queue.push({ update_id: 4, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'ch1', total_amount: 75, invoice_payload: '111:coins_m' } } });
  queue.push({ update_id: 5, message: { chat: { id: 333 }, from: { id: 333, first_name: 'Cara' }, text: '/start' } });
  await sleep(1500);
  const pcs = calls.filter(c => c.method === 'answerPreCheckoutQuery').map(c => c.data);
  assert.deepEqual(pcs.map(p => p.ok), [true, false], 'wrong amount rejected');
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 10000, 'duplicate payment credited once');
  const starts = calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 333);
  assert.equal(starts[0].data.reply_markup.inline_keyboard[0][0].web_app.url, 'https://game.example');
  assert.match(starts[0].data.text, /Welcome to TON Legends/);
  queue.push({ update_id: 6, message: { chat: { id: 444 }, from: { id: 444, first_name: 'Reza', language_code: 'fa' }, text: '/start' } });
  await sleep(800);
  assert.match(calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 444)[0].data.text, /خوش آمدی/);

  await sleep(400);
  assert.ok(JSON.parse(fs.readFileSync(dataFile, 'utf8')).payments.ch1, 'persisted to disk');
  console.log('✅ all server tests passed');
  srv.stop(); fake.close(); process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
