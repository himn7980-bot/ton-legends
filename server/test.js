// End-to-end test against a local fake of the Telegram Bot API (no network needed).
const http = require('http');
const crypto = require('crypto');
const assert = require('assert');
const E = require('../src/engine.js');
const ECON = require('../src/economy.js');
const os = require('os'), path = require('path'), fs = require('fs');

const TOKEN = '123456:TEST_TOKEN';
const calls = [];
const queue = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    if (req.url.includes('/file/bot')) { res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); return res.end('IMG:' + req.url.split('/').pop()); }
    const method = req.url.split('/').pop();
    const data = body && body[0] === '{' ? JSON.parse(body) : body ? { multipart: body.length, head: body.slice(0, 400) } : {};
    calls.push({ method, data });
    const out = { getMe: { username: 'TonLegendsTestBot' }, createInvoiceLink: 'https://t.me/$invoice-test', getUpdates: queue.splice(0),
      getFile: { file_path: 'photos/' + (data.file_id || 'x') + '.jpg' }, getChatMember: { status: data.user_id === 222 ? 'left' : data.user_id ? 'member' : 'administrator' } }[method] ?? true;
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
  // fake CoinGecko: NOT +12% (moon), DOGS −4% (bear)
  const priceCalls = [];
  const cg = http.createServer((req, res) => { priceCalls.push(req.url); res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ notcoin: { usd: 0.0042, usd_24h_change: 12.3 }, 'dogs-2': { usd: 0.0005, usd_24h_change: -4.1 } })); });
  await new Promise(r => cg.listen(0, r));
  process.env.MARKET_API = `http://127.0.0.1:${cg.address().port}`;
  // fake Runway API: one task that is PENDING once, then SUCCEEDED with a PNG
  const rw = { calls: [], polls: 0 };
  const runwaySrv = http.createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      rw.calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, ver: req.headers['x-runway-version'], body: b ? JSON.parse(b) : null });
      if (req.method === 'POST' && req.url === '/v1/text_to_image') { res.writeHead(200); return res.end(JSON.stringify({ id: 'task1' })); }
      if (req.url === '/v1/tasks/task1') { res.writeHead(200); return res.end(JSON.stringify(rw.polls++ ? { status: 'SUCCEEDED', output: [`http://127.0.0.1:${runwaySrv.address().port}/out.png`] } : { status: 'RUNNING' })); }
      if (req.url === '/out.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(Buffer.from('\x89PNG fake')); }
      res.writeHead(404); res.end('{}');
    });
  });
  await new Promise(r => runwaySrv.listen(0, r));
  Object.assign(process.env, { RUNWAY_API: `http://127.0.0.1:${runwaySrv.address().port}`, RUNWAYML_API_SECRET: 'rw_test', RUNWAY_POLL_MS: '50' });
  process.env.TL_EVENT = 'none'; // weekday events are tested explicitly below
  Object.assign(process.env, { ADMIN_IDS: '111', ART_DIR: path.join(path.dirname(dataFile), 'art'), BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://game.example', PORT: '0', DATA_FILE: dataFile, TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('./server.js');
  srv.server.listen(0);
  await new Promise(r => srv.server.once('listening', r));
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  await srv.setupBot(); srv.pollLoop();
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(async r => ({ status: r.status, body: await r.json() }));

  const alice = { id: 111, first_name: 'Alice' }, bob = { id: 222, first_name: 'Bob', last_name: '<script>' };

  // static files
  let r = await fetch(base + '/'); assert.equal(r.status, 200); assert.match(await r.text(), /Gram Legends/);
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
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 0, 'inviter is paid only after the friend plays 5 stages');
  r = await post('/api/claim', { initData: initData(bob) }); assert.equal(r.body.coins, 300);

  // server profiles: first visit imports the offline save, clamped
  r = await post('/api/profile', { initData: initData(alice), local: { coins: 1e9, cleared: 12, owned: { volya: 30, egor: 7 } } });
  assert.equal(r.body.profile.coins, 5000, 'clamped save'); assert.equal(r.body.profile.owned.volya, 5); assert.equal(r.body.profile.cleared, 12);
  r = await post('/api/profile', { initData: initData(alice), local: { coins: 1 } });
  assert.equal(r.body.profile.coins, 5000, 'import happens only once');
  r = await post('/api/profile', { initData: initData(bob), local: { cleared: 999, coins: 3000 } });
  assert.equal(r.body.profile.cleared, 200);
  r = await post('/api/leaderboard', { initData: initData(alice) });
  assert.deepEqual(r.body.top.map(x => [x.name, x.stage]), [['Bob <script>', 200], ['Alice', 12]]);
  assert.deepEqual(r.body.me, { rank: 2, stage: 12 });

  // economy actions are validated and stage wins are verified by replaying the battle
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageEnd', inputs: [] } }); assert.equal(r.status, 400, 'no forged wins');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 40 } }); assert.equal(r.status, 400, 'locked stage');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } }); assert.ok(r.body.result.seed >= 0);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageEnd', inputs: [[0, -1]] } });
  assert.equal(r.body.result.result, 'win'); assert.equal(r.body.profile.coins, 5000 + r.body.result.coins);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'upgrade', id: 'pinkbull' } }); assert.equal(r.body.profile.owned.pinkbull, 2);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['notcoin'] } }); assert.equal(r.status, 400, 'cannot field unowned hero');

  // Stars purchase flow
  r = await post('/api/invoice', { initData: initData(alice), pack: 'gems_m' });
  assert.equal(r.body.link, 'https://t.me/$invoice-test');
  const inv = calls.find(c => c.method === 'createInvoiceLink').data;
  assert.equal(inv.currency, 'XTR'); assert.match(inv.title, /170 💎/); assert.equal(inv.prices[0].amount, 75); assert.equal(inv.payload, '111:gems_m');
  r = await post('/api/invoice', { initData: initData(alice), pack: 'nope' }); assert.equal(r.status, 400);

  queue.push({ update_id: 1, pre_checkout_query: { id: 'pc1', from: alice, currency: 'XTR', total_amount: 75, invoice_payload: '111:gems_m' } });
  queue.push({ update_id: 2, pre_checkout_query: { id: 'pc2', from: alice, currency: 'XTR', total_amount: 1, invoice_payload: '111:gems_m' } });
  queue.push({ update_id: 3, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'ch1', total_amount: 75, invoice_payload: '111:gems_m' } } });
  queue.push({ update_id: 4, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'ch1', total_amount: 75, invoice_payload: '111:gems_m' } } });
  queue.push({ update_id: 5, message: { chat: { id: 333 }, from: { id: 333, first_name: 'Cara' }, text: '/start' } });
  await sleep(1500);
  const pcs = calls.filter(c => c.method === 'answerPreCheckoutQuery').map(c => c.data);
  assert.deepEqual(pcs.map(p => p.ok), [true, false], 'wrong amount rejected');
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.gems, 170, 'duplicate payment credited once'); assert.equal(r.body.coins, 0);
  const aliceAfterPay = r.body.profile.coins;
  const starts = calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 333);
  assert.equal(starts[0].data.reply_markup.inline_keyboard[0][0].web_app.url, 'https://game.example');
  assert.match(starts[0].data.text, /Welcome to Gram Legends/);
  queue.push({ update_id: 6, message: { chat: { id: 444 }, from: { id: 444, first_name: 'Reza', language_code: 'fa' }, text: '/start' } });
  await sleep(800);
  assert.match(calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === 444)[0].data.text, /خوش آمدی/);

  await srv.flushDb();
  assert.ok(JSON.parse(fs.readFileSync(dataFile, 'utf8')).payments.ch1, 'persisted to disk');
  // referral payout once Bob reaches world 2 (stage 10); Alice also banks 10% of Bob's stage coins
  const bobCleared = srv.db.users['222'].profile.cleared;
  srv.db.users['222'].profile.cleared = 9;
  await post('/api/act', { initData: initData(bob), action: { type: 'stageStart', stage: 9 } });
  srv.db.users['222'].profile.pending.levels = { pinkbull: 100, egor: 100, gramcat: 100, memegram: 100, babyshark: 100 };
  r = await post('/api/act', { initData: initData(bob), action: { type: 'stageEnd', inputs: [[0, -1]] } }); assert.equal(r.body.result.result, 'win');
  const bobWon = r.body.result.coins;
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.coins, 500, 'inviter paid at world 2');
  r = await post('/api/ref/me', { initData: initData(alice) });
  assert.equal(r.body.ref.active, 1); assert.equal(r.body.ref.invited, 1); assert.equal(r.body.ref.bank, Math.round(bobWon * 0.1), 'friend coins banked');
  assert.equal(r.body.ref.friends[0].name, 'Bob <script>'); assert.ok(r.body.ref.tiers[0].done);
  r = await post('/api/ref/claim', { initData: initData(alice), tier: 3 }); assert.equal(r.body.error, 'not_ready');
  const ag0 = srv.db.users['111'].profile.gems;
  r = await post('/api/ref/claim', { initData: initData(alice), tier: 1 }); assert.equal(r.body.gems, 10); assert.equal(r.body.profile.gems, ag0 + 10);
  r = await post('/api/ref/claim', { initData: initData(alice), tier: 1 }); assert.equal(r.body.error, 'claimed');
  const ac0 = srv.db.users['111'].profile.coins;
  r = await post('/api/ref/claim', { initData: initData(alice), bank: true }); assert.equal(r.body.profile.coins, ac0 + Math.round(bobWon * 0.1));
  srv.db.users['222'].profile.cleared = Math.max(bobCleared, 10);
  console.log('   referral: paid at world 2, tier gems, 10% friend-coins bank');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } });
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageEnd', inputs: [[0, -1]] } });
  assert.equal(r.body.result.first, false); assert.ok(r.body.result.coins < 100, 'replay pays half');

  // fusion: one rule — any 2 (or 3) owned heroes + coins; heroes are kept; the card starts at their average level
  Object.assign(srv.db.users['111'].profile.owned, { notcoin: 12, pinkbull: 4 }); srv.db.users['111'].profile.coins += 10000;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: 'f1' } }); assert.equal(r.body.error, 'locked_feature', 'duo fusions open in world 4');
  const aliceCleared = srv.db.users['111'].profile.cleared; srv.db.users['111'].profile.cleared = 30;
  const c0f = srv.db.users['111'].profile.coins;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: 'f1' } });
  assert.equal(r.body.result.serial, 1); assert.equal(r.body.profile.serials.f1, 1);
  assert.equal(r.body.profile.owned.f1, 8, 'starts at the average level (12 + 4) / 2'); assert.equal(r.body.result.level, 8);
  assert.equal(r.body.profile.owned.notcoin, 12, 'heroes are kept'); assert.equal(r.body.profile.owned.pinkbull, 4);
  assert.equal(r.body.profile.coins, c0f - E.FUSION_RULES[2].cost);
  // team rule: at most 2 fusion cards, only one trio
  Object.assign(srv.db.users['111'].profile.owned, { f2: 1, f3: 1 });
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['f1', 'f2', 'f3'] } }); assert.equal(r.body.error, 'fusion_limit');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['f1', 'f2', 'pinkbull'] } }); assert.equal(r.status, 200);
  delete srv.db.users['111'].profile.owned.f2; delete srv.db.users['111'].profile.owned.f3;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['f1', 'pinkbull'] } }); assert.equal(r.status, 200);
  // trios open in world 8; no other requirement
  const trio = E.FUSIONS.find(f => f.parts.length === 3 && ['egor', 'gramcat', 'teddy'].every(p => f.parts.includes(p)));
  Object.assign(srv.db.users['111'].profile.owned, { egor: 3, gramcat: 1, teddy: 2 }); srv.db.users['111'].profile.coins += 30000;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: trio.id } }); assert.equal(r.body.error, 'locked_feature');
  srv.db.users['111'].profile.cleared = 70;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: trio.id } }); assert.equal(r.body.result.serial, 1, JSON.stringify(r.body));
  assert.equal(r.body.profile.owned[trio.id], 2, 'trio starts at (3 + 1 + 2) / 3'); assert.equal(r.body.profile.owned.teddy, 2);
  srv.db.users['111'].profile.cleared = aliceCleared;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'fuse', id: 'f1' } }); assert.equal(r.status, 400, 'one copy per player');
  r = await post('/api/act', { initData: initData(bob), action: { type: 'fuse', id: 'f466' } }); assert.equal(r.status, 400, 'parts required');
  srv.db.users['222'].profile.cleared = Math.max(30, srv.db.users['222'].profile.cleared);
  srv.db.mint.f106 = 300; Object.assign(srv.db.users['222'].profile.owned, { virus: 2, yoda: 2 }); srv.db.users['222'].profile.coins += 7000;
  r = await post('/api/act', { initData: initData(bob), action: { type: 'fuse', id: 'f106' } }); assert.equal(r.body.error, 'sold_out');
  srv.db.users['222'].profile.coins -= 7000;
  r = await fetch(base + '/api/health').then(x => x.json()); assert.equal(r.mint.f1, 1);
  console.log('   fusion: serial #1 minted, sold-out edition refused');

  // ---------- fusion art upload through the bot (admin only) ----------
  const said = chat => calls.filter(c => c.method === 'sendMessage' && c.data.chat_id === chat).map(c => c.data.text);
  let uid = 100;
  const send = msg => queue.push({ update_id: uid++, message: { chat: { id: msg.from.id }, ...msg } });
  send({ from: bob, text: '/art' });
  send({ from: alice, text: '/art' });
  send({ from: alice, photo: [{ file_id: 'small' }, { file_id: 'big' }] });                                   // → #1 (the card the bot asked for)
  send({ from: alice, document: { file_id: 'doc37', file_name: '37.png', mime_type: 'image/png' } });         // → #37 from the file name
  send({ from: alice, photo: [{ file_id: 'cap500' }], caption: '500' });                                      // → #500 from the caption
  send({ from: alice, text: '/artlist' });
  await sleep(1500);
  assert.match(said(222).pop(), /Your Telegram ID is 222/);
  const aliceSaid = said(111);
  assert.ok(aliceSaid.some(x => /Next: #1 Golden Bull/.test(x)), aliceSaid.join('\n'));
  assert.ok(aliceSaid.some(x => /Saved #1 Golden Bull/.test(x)));
  assert.ok(aliceSaid.some(x => /Saved #37 /.test(x)));
  assert.ok(aliceSaid.some(x => /Saved #500 /.test(x)));
  assert.match(aliceSaid.pop(), /3\/680 uploaded/);
  r = await fetch(base + '/art/1'); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg'); assert.equal(await r.text(), 'IMG:big.jpg', 'largest photo size saved');
  r = await fetch(base + '/art/37'); assert.equal(r.headers.get('content-type'), 'image/png');
  r = await fetch(base + '/art/2'); assert.equal(r.status, 404);
  r = await fetch(base + '/api/health').then(x => x.json()); assert.deepEqual(Object.keys(r.art).sort(), ['1', '37', '500']);
  console.log('   fusion art: admin uploads by "next card", file name and caption; non-admins get their ID');

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
  r = await post('/api/pvp/room', { initData: initData(alice), stake: 100 }); assert.equal(r.body.error, 'locked_feature', 'PvP opens in world 3');
  srv.db.users['111'].profile.cleared = 20; srv.db.users['222'].profile.cleared = Math.max(20, srv.db.users['222'].profile.cleared);
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
  srv.db.users['555'].profile.cleared = 20; srv.db.users['666'].profile.cleared = 20;
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
  // league: the quick match moved both ratings (equal and opposite), and is listed in the league
  if (ed.data.result !== 'draw') {
    assert.ok(ed.data.league && ed.data.league.delta !== 0, JSON.stringify(ed.data));
    r = await post('/api/league/me', { initData: initData(dan) }); assert.equal(r.body.league.r, 1000 + ed.data.league.delta); assert.equal(r.body.league.w + r.body.league.l, 1);
    r = await post('/api/league/me', { initData: initData(carol) }); assert.equal(r.body.league.r, 1000 - ed.data.league.delta); assert.equal(r.body.league.top.length, 2);
  }
  // season over: best tier pays next season, ratings pulled halfway back
  srv.db.users['666'].league.r = 1700; srv.db.users['666'].league.best = 'legend'; srv.db.users['666'].league.s -= 1;
  r = await post('/api/league/me', { initData: initData(dan) }); assert.equal(r.body.league.r, 1350); assert.equal(r.body.league.prev.best, 'legend');
  r = await post('/api/league/claim', { initData: initData(dan) }); assert.equal(r.body.gems, 250); assert.ok(r.body.profile.cos.own.includes('legend'));
  r = await post('/api/league/claim', { initData: initData(dan) }); assert.equal(r.body.error, 'not_ready');
  console.log('   league: Elo from quick matches, season reset, Legend reward + frame');

  // ---------- AI rival: no stake, daily reward ----------
  srv.db.users['555'].profile.cleared = 10;
  const g0 = srv.db.users['555'].profile.gems, k0 = await coinsOf(carol);
  r = await post('/api/pvp/ai', { initData: initData(carol), level: 'hard' }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const aiT = r.body.ticket; const lai = listen(aiT);
  const mai = await lai.wait('match'); assert.equal(mai.data.ai, 'hard');
  await lai.wait('tick');
  r = await post('/api/pvp/emote', { initData: initData(carol), ticket: aiT, e: 1 }); assert.equal(r.body.ok, true);
  r = await post('/api/pvp/emote', { initData: initData(carol), ticket: aiT, e: 2 }); assert.equal(r.body.ok, false, 'emotes are rate-limited');
  r = await post('/api/pvp/emote', { initData: initData(dan), ticket: aiT, e: 1 }); assert.equal(r.status, 400, 'only your own duel');
  const em = await lai.wait('emote'); assert.equal(em.data.side, 'hero'); assert.equal(em.data.e, 1);
  r = await post('/api/pvp/input', { initData: initData(carol), ticket: aiT, code: -1 });
  const eai = await lai.wait('end'); lai.close();
  assert.ok(eai.data.ai); assert.ok(['win', 'lose', 'draw'].includes(eai.data.result));
  if (eai.data.result === 'win') {
    assert.ok(eai.data.reward.coins > 0); assert.equal(eai.data.reward.gems, 1); assert.equal(eai.data.aiLeft, 4);
    assert.equal(await coinsOf(carol), k0 + eai.data.reward.coins); assert.equal(srv.db.users['555'].profile.gems, g0 + 1);
  } else assert.equal(await coinsOf(carol), k0, 'losing to the AI costs nothing');
  for (let k = 0; k < 4; k++) { // easy rivals: check the reward path once Carol wins
    const before = await coinsOf(carol);
    r = await post('/api/pvp/ai', { initData: initData(carol), level: 'easy' });
    const l2 = listen(r.body.ticket); await post('/api/pvp/input', { initData: initData(carol), ticket: r.body.ticket, code: -1 });
    const e2 = (await l2.wait('end')).data; l2.close();
    if (e2.result !== 'win') continue;
    assert.ok(e2.reward.coins > 0); assert.equal(e2.reward.gems, 0); assert.ok(e2.aiLeft < 5);
    assert.equal(await coinsOf(carol), before + e2.reward.coins);
    console.log('   AI rival (easy) win pays', e2.reward.coins, 'coins, wins left today:', e2.aiLeft); break;
  }
  console.log('   AI rival (hard):', eai.data.result, JSON.stringify(eai.data.reward || {}));

  // ---------- clans ----------
  srv.db.users['555'].profile.coins = 2500;
  r = await post('/api/clan/create', { initData: initData(carol), name: 'Dragons', emblem: '🐉' }); assert.equal(r.body.error, 'locked_feature', 'creating a clan opens in world 5');
  srv.db.users['555'].profile.cleared = 40; srv.db.users['666'].profile.cleared = 40;
  r = await post('/api/clan/create', { initData: initData(carol), name: 'x', emblem: '🐉' }); assert.equal(r.body.error, 'bad_name');
  r = await post('/api/clan/create', { initData: initData(carol), name: 'Dragons', emblem: '🐉' });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.profile.coins, 500); const clanId = r.body.clan.id;
  r = await post('/api/clan/create', { initData: initData(dan), name: 'dragons' }); assert.equal(r.body.error, 'name_taken');
  r = await post('/api/clan/join', { initData: initData(dan), id: clanId }); assert.equal(r.body.clan.members, 2);
  r = await post('/api/clan/join', { initData: initData(dan), id: clanId }); assert.equal(r.body.error, 'in_clan');
  r = await post('/api/clan/list', { initData: initData(alice), q: 'drag' }); assert.equal(r.body.clans[0].name, 'Dragons');
  r = await post('/api/clan/claim', { initData: initData(dan) }); assert.equal(r.body.error, 'not_ready');
  srv.db.users['666'].profile.cleared = 3;
  await post('/api/act', { initData: initData(dan), action: { type: 'stageStart', stage: 3 } });
  srv.db.users['666'].profile.pending.levels = { pinkbull: 100, egor: 100, gramcat: 100, memegram: 100, babyshark: 100 };
  r = await post('/api/act', { initData: initData(dan), action: { type: 'stageEnd', inputs: [[0, -1]] } }); assert.equal(r.body.result.first, true);
  r = await post('/api/clan/me', { initData: initData(dan) }); assert.ok(r.body.clan.points >= 2, 'first clear gives clan points');
  srv.db.clans[clanId].last = { week: 'old', points: 400, claimed: [] };
  const dg = srv.db.users['666'].profile.gems;
  r = await post('/api/clan/claim', { initData: initData(dan) }); assert.equal(r.body.gems, 25); assert.equal(r.body.profile.gems, dg + 25);
  r = await post('/api/clan/claim', { initData: initData(dan) }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/clan/kick', { initData: initData(dan), id: '555' }); assert.equal(r.body.error, 'not_leader');
  r = await post('/api/clan/kick', { initData: initData(carol), id: '666' }); assert.equal(r.body.clan.members, 1);
  r = await post('/api/clan/leave', { initData: initData(carol) }); assert.ok(!srv.db.clans[clanId], 'empty clan removed');
  console.log('   clans: create, join, points, weekly chest, kick, leave');

  // ---------- community war ----------
  r = await post('/api/act', { initData: initData(alice), action: { type: 'faction', id: 'notcoin' } }); assert.equal(r.body.profile.faction, 'notcoin');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'faction', id: 'dog' } }); assert.equal(r.body.error, 'too_soon', 'switching waits a week');
  r = await post('/api/act', { initData: initData(bob), action: { type: 'faction', id: 'dog' } });
  const W = srv.db.war;
  W.derby = require('./war.js').pairUp(['notcoin', 'dog', ...E.BASE_HEROES.map(h => h.id).filter(x => x !== 'notcoin' && x !== 'dog')]);
  srv.db.users['111'].profile.team = ['pinkbull'];
  srv.war.onWin('111', 'pvp', { vs: '555' });                // 5 (no own card, opponent not the rival)
  srv.db.users['111'].profile.team = ['notcoin', 'pinkbull'];
  srv.war.onWin('111', 'stageFirst', { stage: 12 });          // 2×2 = 4, world 2 territory +2
  srv.war.onWin('111', 'pvp', { vs: '222' });                 // 5×2×3 (derby rival Bob) = 30
  srv.war.onWin('222', 'stage', { stage: 12 });               // no points, world 2 territory +1 for dog
  for (let i = 0; i < 3; i++) srv.war.onWin('111', 'stage', { stage: 12 }); // territory: notcoin 5 → holds world 2
  r = await post('/api/war/me', { initData: initData(alice) });
  assert.equal(r.body.mine.pts, 39); assert.equal(r.body.standings[0].id, 'notcoin'); assert.equal(r.body.mine.double, true);
  assert.equal(r.body.owners[1], 'notcoin', 'holds world 2'); assert.equal(r.body.derby.rival, 'dog'); assert.equal(r.body.derby.me, 39);
  assert.equal(r.body.goal.progress, 6); assert.equal(r.body.goal.target, 30); assert.equal(r.body.milestone.total, 39);
  // territory bonus is frozen into the stage: +15% coins in world 2
  srv.db.users['111'].profile.cleared = Math.max(srv.db.users['111'].profile.cleared, 15);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 12 } }); assert.equal(r.body.result.terr, 0.15);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 2 } }); assert.equal(r.body.result.terr, 0);
  // daily goal: 30 wins for a small community
  r = await post('/api/war/goal', { initData: initData(alice) }); assert.equal(r.body.error, 'not_ready');
  for (let i = 0; i < 24; i++) srv.war.onWin('111', 'ai');
  r = await post('/api/war/goal', { initData: initData(alice) }); assert.equal(r.body.gems, 5);
  r = await post('/api/war/goal', { initData: initData(alice) }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/war/goal', { initData: initData(dan) }); assert.equal(r.body.error, 'not_ready', 'only members who helped today');
  // prediction (only during the first days of the week)
  const realNow = Date.now;
  const monday = require('./war.js').weekEnd() - 7 * 864e5;
  Date.now = () => monday + 3600e3;
  r = await post('/api/war/predict', { initData: initData(bob), f: 'notcoin' }); assert.equal(r.body.war.predict.pick, 'notcoin');
  r = await post('/api/war/predict', { initData: initData(bob), f: 'dog' }); assert.equal(r.body.error, 'claimed');
  Date.now = () => monday + 4 * 864e5;
  r = await post('/api/war/predict', { initData: initData(carol), f: 'dog' }); assert.equal(r.body.error, 'predict_closed');
  Date.now = realNow;
  // the week ends
  const oldWeek = W.week;
  W.week = '2000-W01'; for (const id of ['111', '222']) srv.db.users[id].war.week = '2000-W01'; srv.db.users['222'].pred.week = '2000-W01';
  const sentBefore = calls.filter(c => c.method === 'sendMessage').length;
  r = await post('/api/war/me', { initData: initData(alice) });
  assert.equal(W.week, oldWeek); assert.equal(r.body.last.place, 0); assert.equal(r.body.last.derbyWon, true); assert.equal(r.body.mine.pts, 0);
  assert.equal(r.body.captain.me, true, 'top member becomes captain'); assert.equal(r.body.cry, 'gold'); assert.equal(r.body.cryChosen, false);
  assert.deepEqual(r.body.owners, {}, 'territories reset weekly');
  const g0w = srv.db.users['111'].profile.gems;
  r = await post('/api/war/claim', { initData: initData(alice) }); assert.equal(r.body.gems, 30 + 10, 'place + derby'); assert.equal(r.body.profile.gems, g0w + 40);
  r = await post('/api/war/claim', { initData: initData(alice) }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/war/claim', { initData: initData(bob) }); assert.equal(r.body.gems, 10, 'Bob: under 10 points, but predicted the winner');
  // the captain picks a battle cry; "might" makes the community card stronger in the next stage
  r = await post('/api/war/cry', { initData: initData(bob), key: 'might' }); assert.equal(r.body.error, 'not_captain');
  r = await post('/api/war/cry', { initData: initData(alice), key: 'might' }); assert.equal(r.body.war.cry, 'might');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 2 } }); assert.equal(r.body.result.market.notcoin, 1.05);
  await sleep(500);
  const warMsgs = calls.filter(c => c.method === 'sendMessage').slice(sentBefore).map(c => c.data);
  assert.ok(warMsgs.some(m => m.chat_id === 111 && /Notcoin community finished #1/.test(m.text)), JSON.stringify(warMsgs));
  assert.ok(warMsgs.some(m => m.chat_id === 111 && /captain/.test(m.text)));
  console.log('   community war: points (own card ×2, derby ×3), territories, daily goal, prediction, captain + battle cry, weekly claim');

  // ---------- bot reminders ----------
  const nowR = Date.now(), bobU = srv.db.users['222'];
  bobU.profile.afkSince = nowR - 9 * 3600e3; bobU.seen = nowR - 9 * 3600e3 + 60e3;
  const before2 = calls.filter(c => c.method === 'sendMessage').length;
  srv.notifier.sweep(nowR); srv.notifier.sweep(nowR); // the second sweep must not repeat it
  await sleep(500);
  const rem = calls.filter(c => c.method === 'sendMessage').slice(before2).map(c => c.data).filter(m => m.chat_id === 222);
  assert.equal(rem.length, 1); assert.match(rem[0].text, /idle chest is full/); assert.ok(rem[0].reply_markup.inline_keyboard[0][0].web_app);
  r = await post('/api/notify', { initData: initData(bob), on: false }); assert.equal(r.body.on, false);
  bobU.profile.afkSince = nowR - 10 * 3600e3; bobU.seen = nowR - 10 * 3600e3 + 60e3;
  srv.notifier.sweep(nowR); await sleep(300);
  assert.equal(calls.filter(c => c.method === 'sendMessage').slice(before2).filter(c => c.data.chat_id === 222).length, 1, 'muted players get no reminders');
  console.log('   bot reminders: idle chest full sent once; muted players skipped');

  // ---------- share card for stories ----------
  const jpg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64');
  r = await post('/api/share', { initData: initData(alice), image: jpg }); assert.match(r.body.path, /^share\/111\.jpg\?v=/);
  r = await fetch(base + '/share/111.jpg'); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  r = await post('/api/share', { initData: initData(alice), image: 'data:image/png;base64,AAAA' }); assert.equal(r.status, 400);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'share' } }); assert.equal(r.body.result.gems, 3);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'share' } }); assert.equal(r.body.result.gems, 0, 'share reward once a day');
  console.log('   share card uploaded and served; daily share reward');

  // ---------- market mood ----------
  await srv.market.refresh();
  assert.match(priceCalls[0], /ids=notcoin%2Cdogs-2/);
  r = await fetch(base + '/api/health').then(x => x.json());
  assert.equal(r.market.moods.notcoin.change, 12.3); assert.equal(r.market.moods.notcoin.sym, 'NOT'); assert.equal(r.market.moods.dog.src, 'token');
  assert.equal(r.market.moods.pengu.src, 'activity');
  // Alice's team has Notcoin (moon: +10% power) and telegram.dog (bear: +20% coins)
  Object.assign(srv.db.users['111'].profile.owned, { dog: 5 });
  srv.db.users['111'].profile.team = ['notcoin', 'dog', 'pinkbull'];
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } });
  assert.deepEqual(r.body.result.market, { notcoin: 1.155 }, 'moon x1.1 and the captain cry might x1.05'); assert.equal(r.body.result.dip, 0.2);
  assert.equal(srv.db.users['111'].profile.pending.dip, 0.2);
  // community activity drives heroes without a token: yesterday 300 points vs 100 the day before → +200% (capped at +50)
  const ECONm = require('../src/economy.js');
  srv.db.market.activity[ECONm.day(Date.now(), -1)] = { pengu: 300 }; srv.db.market.activity[ECONm.day(Date.now(), -2)] = { pengu: 100 };
  srv.market.compute();
  assert.equal(srv.market.moods().pengu.change, 50); assert.equal(ECONm.moodOf(50).key, 'moon');
  assert.deepEqual(require('./market.js').parseTokens('paws=paws-x:PAWS, nope=x, f1=y'), { paws: { cg: 'paws-x', sym: 'PAWS' } });
  console.log('   market mood: token prices + community activity → battle boosts and dip bonus');
  cg.close();

  // ---------- collection sets + weekly events ----------
  Object.assign(srv.db.users['111'].profile.owned, { utya: 10, pengu: 10, babyshark: 10, dog: 10 });
  process.env.TL_EVENT = 'coins';
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } });
  assert.deepEqual(r.body.result.perks, { hp: 0.05 }, 'ocean set complete'); assert.equal(r.body.result.weekend, 0.5);
  process.env.TL_EVENT = 'sale';
  r = await post('/api/act', { initData: initData(alice), action: { type: 'upgrade', id: 'egor' } }); assert.equal(r.status, 200);
  process.env.TL_EVENT = 'war';
  const wp = srv.db.war.points.notcoin || 0; srv.db.users['111'].profile.team = ['pinkbull']; srv.war.onWin('111', 'ai');
  assert.equal(srv.db.war.points.notcoin - wp, 2, 'war day doubles points');
  process.env.TL_EVENT = 'none';
  console.log('   collection set perks; weekend coins, upgrade sale, war day');
  // rookie journey: day 1 tasks done → reward; day 2 waits until tomorrow
  const rook = { id: 4242, first_name: 'Rook' };
  r = await post('/api/profile', { initData: initData(rook) }); assert.deepEqual(r.body.profile.rookie.claimed, []);
  r = await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: 0 } }); assert.equal(r.body.error, 'not_ready');
  Object.assign(srv.db.users['4242'].profile, { cleared: 3 }); Object.assign(srv.db.users['4242'].profile.stats, { skills: 5, upgrades: 1 });
  r = await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: 0 } }); assert.equal(r.body.result.coins, 500);
  r = await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: 0 } }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: 1 } }); assert.equal(r.body.error, 'not_ready');
  srv.db.users['4242'].profile.rookie.start = '2000-01-01'; Object.assign(srv.db.users['4242'].profile, { cleared: 26, faction: 'dog' });
  Object.assign(srv.db.users['4242'].profile.stats, { skills: 100, wins: 40, chests: 4, upgrades: 12, aiWins: 1, pvpWins: 1 });
  for (let d = 1; d < 6; d++) await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: d } });
  r = await post('/api/act', { initData: initData(rook), action: { type: 'rookie', day: 6 } });
  assert.ok(['notcoin', 'volya', 'noctis'].includes(r.body.result.hero), 'day 7: a Legendary hero');
  console.log('   rookie journey: daily unlocks, claims, Legendary on day 7');

  // ---------- season pass ----------
  const ECONp = require('../src/economy.js');
  const pa = () => srv.db.users['111'].profile; // the server re-normalizes (copies) the profile on every request
  ECONp.passOf(pa(), Date.now()).xp = 0;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'daily' } }); // +20 XP (or already claimed today)
  ECONp.passOf(pa(), Date.now()).xp = 310;                                               // tier 2
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 3, track: 'free' } }); assert.equal(r.body.error, 'not_ready');
  const pc0 = pa().coins;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 2, track: 'free' } }); assert.equal(r.body.result.coins, 500); assert.equal(r.body.profile.coins, pc0 + 500);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 2, track: 'free' } }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 1, track: 'prem' } }); assert.equal(r.body.error, 'no_pass');
  r = await post('/api/invoice', { initData: initData(alice), pack: 'pass' }); assert.equal(r.status, 200);
  assert.equal(calls.filter(c => c.method === 'createInvoiceLink').pop().data.prices[0].amount, ECONp.PASS.PRICE_STARS);
  queue.push({ update_id: 9100, pre_checkout_query: { id: 'pcp', from: alice, currency: 'XTR', total_amount: ECONp.PASS.PRICE_STARS, invoice_payload: '111:pass' } });
  queue.push({ update_id: 9101, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'chpass', total_amount: ECONp.PASS.PRICE_STARS, invoice_payload: '111:pass' } } });
  await sleep(1200);
  r = await post('/api/claim', { initData: initData(alice) }); assert.equal(r.body.pass, true); assert.equal(r.body.profile.pass.prem, true);
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 1, track: 'prem' } }); assert.equal(r.body.result.gems, 5);
  r = await post('/api/invoice', { initData: initData(alice), pack: 'pass' }); assert.equal(r.body.error, 'claimed', 'one premium pass per season');
  ECONp.passOf(pa(), Date.now()).xp = 10 * ECONp.PASS.XP_PER_TIER;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'pass', tier: 10, track: 'prem' } }); assert.ok(r.body.result.chestResult, 'tier 10 premium: Gem Chest');
  r = await fetch(base + '/api/health').then(x => x.json()); assert.ok(!r.packs.some(p => p.id === 'pass'), 'the pass is not in the gem shop');
  console.log('   season pass: XP tiers, free/premium claims, Stars purchase, one per season');

  // ---------- fusion art with Runway (/gen) ----------
  const beforeGen = calls.length;
  queue.push({ update_id: 9200, message: { chat: { id: 222 }, from: bob, text: '/gen 81' } });
  queue.push({ update_id: 9201, message: { chat: { id: 111 }, from: alice, text: '/gen 81' } });
  await sleep(1500);
  const post81 = rw.calls.find(c => c.method === 'POST');
  assert.equal(post81.auth, 'Bearer rw_test'); assert.equal(post81.ver, '2024-11-06'); assert.equal(post81.body.model, 'gen4_image');
  assert.deepEqual(post81.body.referenceImages.map(x => x.tag).sort(), ['babyshark', 'gramcat']);
  assert.match(post81.body.referenceImages[0].uri, /^data:image\/jpeg;base64,/); assert.match(post81.body.promptText, /@gramcat/); assert.ok(post81.body.promptText.length <= 1000);
  r = await fetch(base + '/art/81'); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
  const genMsgs = calls.slice(beforeGen);
  assert.ok(genMsgs.some(c => c.method === 'sendPhoto' && c.data.chat_id === 111 && /#81/.test(c.data.caption)), 'preview sent to the admin');
  assert.ok(genMsgs.some(c => c.method === 'sendMessage' && c.data.chat_id === 222 && /Only admins/.test(c.data.text)));
  assert.deepEqual(require('./runway.js').parseTargets('5-7'), [5, 6, 7]); assert.equal(require('./runway.js').parseTargets('named').length, 22);
  assert.ok(require('./runway.js').parseTargets('bosses').length >= 10);
  runwaySrv.close();
  console.log('   fusion art: /gen 81 → Runway task (2 tagged references) → saved as card art, preview sent; admins only');

  // ---------- analytics (/stats for admins) ----------
  srv.db.users['555'].seen = Date.now() - 5 * 864e5; srv.db.users['555'].created = Date.now() - 9 * 864e5; srv.db.users['555'].profile.cleared = 11;
  const rep = srv.analytics.report();
  assert.ok(rep.players >= 5, rep.players); assert.ok(rep.today.active >= 4, JSON.stringify(rep.today)); assert.ok(rep.today.battles >= 1); assert.ok(rep.starsAll >= 75);
  assert.ok(rep.quitTop.some(([st]) => st === '12'), 'Carol quit at stage 12');
  const before3 = calls.filter(c => c.method === 'sendMessage').length;
  queue.push({ update_id: 9001, message: { chat: { id: 111 }, from: alice, text: '/stats' } });
  queue.push({ update_id: 9002, message: { chat: { id: 222 }, from: bob, text: '/stats' } });
  await sleep(1200);
  const st = calls.filter(c => c.method === 'sendMessage').slice(before3).map(c => c.data);
  assert.ok(st.some(m => m.chat_id === 111 && /Gram Legends — stats/.test(m.text) && /stuck at: .*stage 12/.test(m.text)), JSON.stringify(st));
  assert.ok(st.some(m => m.chat_id === 222 && /Only admins/.test(m.text)));
  console.log('   analytics: daily counters, retention, funnel, quit stages; /stats only for admins');

  // ---------- partner quests (admin /quest), card frames, backups, wallet + NFT requests ----------
  const m0 = calls.length;
  queue.push({ update_id: 9201, message: { chat: { id: 111 }, from: alice, text: '/quest add @notcoin_ch 20 7 Join the Notcoin channel' } });
  queue.push({ update_id: 9202, message: { chat: { id: 111 }, from: alice, text: '/quest add https://t.me/somegamebot 15 3 Play Some Bot' } });
  queue.push({ update_id: 9203, message: { chat: { id: 222 }, from: bob, text: '/quest list' } });
  await sleep(1300);
  assert.ok(calls.slice(m0).some(c => c.method === 'sendMessage' && /Quest #1 added/.test(c.data.text)), 'verified quest added');
  assert.ok(calls.slice(m0).some(c => c.method === 'sendMessage' && c.data.chat_id === 222 && /Only admins/.test(c.data.text)));
  r = await post('/api/partners/list', { initData: initData(alice) }); assert.equal(r.body.quests.length, 2); assert.equal(r.body.quests[0].verify, true);
  const pg0 = srv.db.users['111'].profile.gems;
  r = await post('/api/partners/claim', { initData: initData(alice), id: 1 }); assert.equal(r.body.gems, 20, 'member of the channel'); assert.equal(r.body.profile.gems, pg0 + 20);
  r = await post('/api/partners/claim', { initData: initData(alice), id: 1 }); assert.equal(r.body.error, 'claimed');
  r = await post('/api/partners/claim', { initData: initData(bob), id: 1 }); assert.equal(r.body.error, 'not_member');
  r = await post('/api/partners/claim', { initData: initData(alice), id: 2 }); assert.equal(r.body.error, 'not_ready', 'open the link first');
  await post('/api/partners/open', { initData: initData(alice), id: 2 }); srv.db.users['111'].pq[2].opened -= 10000;
  r = await post('/api/partners/claim', { initData: initData(alice), id: 2 }); assert.equal(r.body.gems, 15);
  // frames: gems frame bought in game, Stars frame through an invoice + payment
  srv.db.users['111'].profile.gems += 300;
  r = await post('/api/act', { initData: initData(alice), action: { type: 'cosmetic', id: 'neon' } }); assert.equal(r.body.profile.cos.on, 'neon');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'cosmetic', id: 'gold' } }); assert.equal(r.body.error, 'locked', 'Stars frames are bought with Stars');
  r = await post('/api/invoice', { initData: initData(alice), pack: 'cos_gold' }); assert.ok(r.body.link);
  queue.push({ update_id: 9204, message: { chat: { id: 111 }, from: alice, successful_payment: { telegram_payment_charge_id: 'chCos', total_amount: 150, invoice_payload: '111:cos_gold' } } });
  await sleep(900);
  assert.ok(srv.db.users['111'].profile.cos.own.includes('gold'));
  r = await post('/api/act', { initData: initData(alice), action: { type: 'cosmetic', id: 'gold' } }); assert.equal(r.body.profile.cos.on, 'gold');
  r = await post('/api/invoice', { initData: initData(alice), pack: 'cos_gold' }); assert.equal(r.body.error, 'claimed');
  // backup on demand: a gzipped database sent as a document
  const bk0 = calls.length;
  queue.push({ update_id: 9205, message: { chat: { id: 111 }, from: alice, text: '/backup' } });
  await sleep(1300);
  const doc = calls.slice(bk0).find(c => c.method === 'sendDocument');
  assert.ok(doc && doc.data.multipart > 100 && /gram-legends-.*\.json\.gz/.test(doc.data.head), 'backup document sent');
  // wallet + NFT request for an owned numbered alliance card
  r = await post('/api/wallet', { initData: initData(alice), address: 'not-an-address' }); assert.equal(r.body.error, 'bad_address');
  r = await post('/api/nft/request', { initData: initData(alice), id: 'f1' }); assert.equal(r.body.error, 'no_wallet');
  r = await post('/api/wallet', { initData: initData(alice), address: '0:' + 'ab'.repeat(32) }); assert.equal(r.body.wallet, '0:' + 'ab'.repeat(32));
  r = await post('/api/nft/request', { initData: initData(alice), id: 'f1' }); assert.equal(r.body.nft[0].status, 'requested'); assert.equal(r.body.nft[0].serial, 1);
  r = await post('/api/nft/request', { initData: initData(alice), id: 'f1' }); assert.equal(r.body.error, 'claimed');
  r = await fetch(base + '/tonconnect-manifest.json').then(x => x.json()); assert.equal(r.name, 'Gram Legends'); assert.equal(r.url, 'https://game.example');
  console.log('   partner quests (verified + open-to-claim), frames (gems + Stars), /backup document, wallet + NFT request');

  // ---------- world boss ----------
  r = await post('/api/raid/me', { initData: initData(alice) });
  assert.equal(r.body.raid.level, 1); assert.equal(r.body.raid.tries, 3); assert.ok(r.body.raid.max >= 400000);
  r = await post('/api/raid/end', { initData: initData(alice), inputs: [] }); assert.equal(r.body.error, 'no_battle');
  r = await post('/api/raid/start', { initData: initData(alice) }); assert.ok(r.body.seed >= 0); assert.equal(r.body.raid.level, 1);
  const pts0 = srv.db.war.points[srv.db.users['111'].profile.faction] || 0;
  r = await post('/api/raid/end', { initData: initData(alice), inputs: [[0, -1]] });
  assert.ok(r.body.dmg > 0, JSON.stringify(r.body)); assert.ok(r.body.coins >= 100); assert.equal(r.body.raid.tries, 2);
  assert.equal(r.body.raid.mine.week, r.body.dmg); assert.equal(r.body.raid.hp, r.body.raid.max - r.body.dmg);
  assert.ok((srv.db.war.points[srv.db.users['111'].profile.faction] || 0) > pts0, 'boss damage earns war points');
  // the final blow: boss nearly down → killed, gems for everyone who hit it, level 2 appears
  srv.db.raid.hp = 1; const giftG = srv.db.users['111'].giftGems || 0;
  r = await post('/api/raid/start', { initData: initData(alice) });
  r = await post('/api/raid/end', { initData: initData(alice), inputs: [[0, -1]] });
  assert.equal(r.body.killed.level, 1); assert.equal(r.body.raid.level, 2); assert.equal(r.body.raid.kills[0].name, 'Alice');
  assert.equal((srv.db.users['111'].giftGems || 0) - giftG, 5 + 25 + 20, 'kill + top 3 + final blow');
  r = await post('/api/raid/start', { initData: initData(alice) }); await post('/api/raid/end', { initData: initData(alice), inputs: [] });
  r = await post('/api/raid/start', { initData: initData(alice) }); assert.equal(r.body.error, 'no_tries');
  const gB = srv.db.users['111'].profile.gems;
  r = await post('/api/raid/start', { initData: initData(alice), buy: true }); assert.equal(r.body.profile.gems, gB - 10, 'extra try for gems');
  await post('/api/raid/end', { initData: initData(alice), inputs: [] });
  console.log('   world boss: verified damage, shared HP, kill rewards, next level, daily tries');

  // ---------- alliance cards: leader, war points for every community on the card, official alliances ----------
  const ap = () => srv.db.users['111'].profile;
  ap().owned.f1 = ap().owned.f1 || 8; ap().faction = 'notcoin';
  assert.equal(ECON.leaderOf(ap(), 'f1'), 'notcoin', 'default leader: your own community');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'leader', id: 'f1', hero: 'pinkbull' } }); assert.equal(r.body.profile.leaders.f1, 'pinkbull');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'leader', id: 'f1', hero: 'dog' } }); assert.equal(r.status, 400, 'leader must be a member');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'team', team: ['f1', 'notcoin'] } }); assert.equal(r.status, 200);
  const pb0 = srv.db.war.points.pinkbull || 0, nc0 = srv.db.war.points.notcoin || 0;
  srv.war.onWin('111', 'pvp', {});
  assert.ok((srv.db.war.points.notcoin || 0) - nc0 >= 10, 'own community: ×2 with its card in the team');
  assert.equal((srv.db.war.points.pinkbull || 0) - pb0, Math.round(5 * ECON.ALLY_SHARE), 'allied community earns a share');
  srv.db.war.total.notcoin = 12000;
  assert.equal(srv.war.community(ap()).tier, 2, 'two milestones reached');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } });
  assert.equal(r.body.result.perks.mascot, 2 * ECON.MASCOT_PER_TIER, 'mascot power from milestones');
  const msgs0 = calls.filter(c => c.method === 'sendMessage').length;
  queue.push({ update_id: 9101, message: { chat: { id: 222 }, from: bob, text: '/ally notcoin pinkbull' } });
  queue.push({ update_id: 9102, message: { chat: { id: 111 }, from: alice, text: '/ally Notcoin "pinkbull" 12 7' } });
  queue.push({ update_id: 9103, message: { chat: { id: 111 }, from: alice, text: '/ally notcoin pinkbull 12 7' } });
  await sleep(1200);
  const am = calls.filter(c => c.method === 'sendMessage').slice(msgs0).map(c => c.data);
  assert.ok(am.some(m => m.chat_id === 222 && /Only admins/.test(m.text)));
  assert.ok(am.some(m => m.chat_id === 111 && /Unknown heroes/.test(m.text)));
  assert.ok(am.some(m => m.chat_id === 111 && /Official alliance: Notcoin × Pink Bull · \+12% for 7 days/.test(m.text)), JSON.stringify(am));
  assert.equal(srv.db.alliances.length, 1);
  r = await fetch(base + '/api/health').then(x => x.json()); assert.equal(r.alliances[0].pct, 12);
  assert.ok(am.some(m => /([1-9]\d*) members will be told/.test(m.text)), 'members are told');
  r = await post('/api/act', { initData: initData(alice), action: { type: 'stageStart', stage: 0 } });
  assert.ok(r.body.result.market.f1 >= 1.12 - 1e-9, JSON.stringify(r.body.result.market));
  queue.push({ update_id: 9104, message: { chat: { id: 111 }, from: alice, text: '/ally remove pinkbull notcoin' } });
  await sleep(1200);
  assert.equal(srv.db.alliances.length, 0);
  console.log('   alliances: leader, shared war points, mascot milestones, official /ally boost');

  r = await fetch(base + '/api/status').then(x => x.json());
  assert.equal(r.webappUrlOk, true); assert.ok(r.updatesHandled >= 6); assert.equal(r.lastHandleError, null);
  assert.ok(!JSON.stringify(r).includes(TOKEN), 'status never leaks the token');
  console.log('✅ all server tests passed');
  srv.stop(); fake.close(); process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
