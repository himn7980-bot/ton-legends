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
  await srv.setupBot(); srv.pollLoop();
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
  await post('/api/hello', { initData: initData(bob), startParam: 'ref_111' });
  await post('/api/hello', { initData: initData(bob), startParam: 'ref_111' }); // second time: no double bonus
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 500);
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 0);
  r = await post('/api/claim', { initData: initData(bob) }); assert.equal(r.body.coins, 300);

  // server profiles: first visit imports the offline save, clamped
  r = await post('/api/profile', { initData: initData(alice), local: { coins: 1e9, cleared: 12, owned: { volya: 30, egor: 7 } } });
  assert.equal(r.body.profile.coins, 5000 + 500, 'clamped save + referral reward'); assert.equal(r.body.profile.owned.volya, 5); assert.equal(r.body.profile.cleared, 12);
  r = await post('/api/profile', { initData: initData(alice), local: { coins: 1 } });
  assert.equal(r.body.profile.coins, 5500, 'import happens only once');
  r = await post('/api/profile', { initData: initData(bob), local: { cleared: 999, coins: 3000 } });
  assert.equal(r.body.profile.cleared, 50);
  r = await post('/api/leaderboard', { initData: initData(alice) });
  assert.deepEqual(r.body.top.map(x => [x.name, x.stage]), [['Bob <script>', 50], ['Alice', 12]]);
  assert.deepEqual(r.body.me, { rank: 2, stage: 12 });

  // economy actions are validated and stage wins are verified by replaying the battle
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageEnd', inputs: [] } }); assert.equal(r.status, 400, 'no forged wins');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 40 } }); assert.equal(r.status, 400, 'locked stage');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } }); assert.ok(r.body.result.seed >= 0);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageEnd', inputs: [[0, -1]] } });
  assert.equal(r.body.result.result, 'win'); assert.equal(r.body.profile.coins, 5500 + r.body.result.coins);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'upgrade', id: 'pinkbull' } }); assert.equal(r.body.profile.owned.pinkbull, 2);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['notcoin'] } }); assert.equal(r.status, 400, 'cannot field unowned hero');

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
  const aliceAfterPay = r.body.profile.coins;
  const starts = calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 333);
  assert.equal(starts[0].data.reply_markup.inline_keyboard[0][0].web_app.url, 'https://game.example');
  assert.match(starts[0].data.text, /Welcome to TON Legends/);
  queue.push({ update_id: 6, message: { chat: { id: 444 }, from: { id: 444, first_name: 'Reza', language_code: 'fa' }, text: '/start' } });
  await sleep(800);
  assert.match(calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 444)[0].data.text, /خوش آمدی/);

  await sleep(400);
  assert.ok(JSON.parse(fs.readFileSync(dataFile, 'utf8')).payments.ch1, 'persisted to disk');
  // fusion: limited, numbered editions
  srv.db.users['111'].profile.owned.notcoin = 8; srv.db.users['111'].profile.owned.pinkbull = 8; srv.db.users['111'].profile.coins += 10000;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: 'f_golden_bull' } });
  assert.equal(r.body.result.serial, 1); assert.equal(r.body.profile.owned.f_golden_bull, 1); assert.equal(r.body.profile.serials.f_golden_bull, 1);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: 'f_golden_bull' } }); assert.equal(r.status, 400, 'one copy per player');
  r = await post('/api/act', { initData: initData(bob), action: { type: 'fuse', id: 'f_night_plague' } }); assert.equal(r.status, 400, 'parts required');
  srv.db.mint.f_toxic_sage = 300; Object.assign(srv.db.users['222'].profile.owned, { virus: 9, yoda: 9 }); srv.db.users['222'].profile.coins += 5000;
  r = await post('/api/act', { initData: initData(bob), action: { type: 'fuse', id: 'f_toxic_sage' } }); assert.equal(r.body.error, 'sold_out');
  srv.db.users['222'].profile.coins -= 5000;
  r = await fetch(base + '/api/health').then(x => x.json()); assert.equal(r.mint.f_golden_bull, 1);
  console.log('   fusion: serial #1 minted, sold-out edition refused');

  // ---------- arena ----------
  const coinsOf = async who => (await post('/api/profile', { initData: initData(who) })).body.profile.coins;
  function listen(ticket) {
    const events = []; const ctl = new AbortController();
    const done = (async () => {
      const res = await fetch(`${base}/api/pvp/stream?ticket=${ticket}`, { signal: ctl.signal });
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const ev = /^event: (.*)$/m.exec(chunk), data = /^data: (.*)$/m.exec(chunk);
            if (ev) events.push({ type: ev[1], data: JSON.parse(data[1]) });
          }
        }
      } catch (e) { if (e.name !== 'AbortError') console.log('   [sse error]', e.message); }
    })();
    return { events, close: () => ctl.abort(), done, wait: async type => { for (let k = 0; k < 400; k++) { const e = events.find(x => x.type === type); if (e) return e; await sleep(100); } throw new Error('timeout waiting for ' + type + ' got ' + JSON.stringify(events.map(x => x.type))); } };
  }
  r = await post('/api/pvp/find', { initData: initData(alice), stake: 777 }); assert.equal(r.status, 400, 'only fixed stakes');
  r = await post('/api/pvp/find', { initData: initData(bob), stake: 10000 }); assert.equal(r.status, 400, 'cannot stake more than you have');

  // private room: Alice hosts 500, Bob joins with the code
  const a0 = await coinsOf(alice), b0 = await coinsOf(bob);
  r = await post('/api/pvp/room', { initData: initData(alice), stake: 500 }); const aT = r.body.ticket, code = r.body.code;
  assert.equal(r.body.coins, a0 - 500, 'stake held');
  r = await post('/api/pvp/room', { initData: initData(alice), stake: 500 }); assert.equal(r.status, 400, 'one duel at a time');
  r = await post('/api/pvp/peek', { initData: initData(bob), code }); assert.equal(r.body.stake, 500); assert.equal(r.body.host, 'Alice');
  r = await post('/api/pvp/join', { initData: initData(alice), code }); assert.equal(r.status, 400, 'cannot join own room');
  const la = listen(aT);
  r = await post('/api/pvp/join', { initData: initData(bob), code }); assert.equal(r.status, 200, JSON.stringify(r.body)); const bT = r.body.ticket;
  const lb = listen(bT);
  const ma = await la.wait('match'), mb = await lb.wait('match');
  assert.equal(ma.data.side, 'hero'); assert.equal(mb.data.side, 'enemy'); assert.equal(ma.data.pot, 1000); assert.equal(ma.data.opp.name, 'Bob <script>');
  await la.wait('tick');
  r = await post('/api/pvp/input', { initData: initData(bob), ticket: bT, code: -1 }); assert.equal(r.body.ok, true);
  r = await post('/api/pvp/input', { initData: initData(alice), ticket: bT, code: -1 }); assert.equal(r.status, 400, 'cannot steer the other player');
  const ea = await la.wait('end'), eb = await lb.wait('end');
  la.close(); lb.close();
  const results = [ea.data.result, eb.data.result].sort().join(',');
  assert.ok(['lose,win', 'draw,draw'].includes(results), results);
  const a1 = await coinsOf(alice), b1 = await coinsOf(bob);
  assert.equal(a1 + b1, a0 + b0, 'coins are conserved: the winner gets exactly the pot');
  if (ea.data.result === 'win') assert.equal(a1, a0 + 500); else if (ea.data.result === 'lose') assert.equal(a1, a0 - 500);
  console.log('   arena duel:', ea.data.result, 'for Alice,', eb.data.result, 'for Bob');

  // quick match by stake, and cancelling a search refunds
  const carol = { id: 555, first_name: 'Carol' }, dan = { id: 666, first_name: 'Dan' };
  await post('/api/profile', { initData: initData(carol), local: { coins: 300 } });
  await post('/api/profile', { initData: initData(dan), local: { coins: 300 } });
  r = await post('/api/pvp/find', { initData: initData(carol), stake: 100 }); const cT = r.body.ticket; assert.equal(r.body.coins, 200);
  r = await post('/api/pvp/cancel', { initData: initData(carol), ticket: cT }); assert.equal(r.body.coins, 300, 'cancel refunds');
  r = await post('/api/pvp/find', { initData: initData(carol), stake: 100 }); const cT2 = r.body.ticket;
  r = await post('/api/pvp/find', { initData: initData(dan), stake: 100 }); const dT = r.body.ticket;
  const lc = listen(cT2), ld = listen(dT);
  await lc.wait('match'); await ld.wait('match');
  lc.close(); // Carol leaves mid-fight: her cards keep fighting on auto and the duel still ends
  const ed = await ld.wait('end'); ld.close();
  const c1 = await coinsOf(carol), d1 = await coinsOf(dan);
  assert.equal(c1 + d1, 600);
  console.log('   quick match:', ed.data.result, 'for Dan; Carol left early and was notified by the bot:',
    calls.some(c => c.method === 'sendMessage' && c.data.chat_id === 555));
  assert.equal(Object.keys(srv.db.escrow).length, 0, 'no stakes left in escrow');

  r = await fetch(base + '/api/status').then(x => x.json());
  assert.equal(r.webappUrlOk, true); assert.ok(r.updatesHandled >= 6); assert.equal(r.lastHandleError, null);
  assert.ok(!JSON.stringify(r).includes(TOKEN), 'status never leaks the token');
  console.log('✅ all server tests passed');
  srv.stop(); fake.close(); process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
