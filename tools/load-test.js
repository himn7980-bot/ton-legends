// Load test: N simultaneous arena duels (2N players with live streams) on one server process.
// Reports event-loop delay (how late the 50 ms battle ticks run) and memory. usage: node tools/load-test.js [duels=100]
const http = require('http'), crypto = require('crypto'), os = require('os'), path = require('path'), fs = require('fs');
const { monitorEventLoopDelay } = require('perf_hooks');
const DUELS = +process.argv[2] || 100, TOKEN = '1:LOAD';
const fake = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  const m = req.url.split('/').pop(); const out = { getMe: { username: 'LoadBot' }, getUpdates: [] }[m] ?? true;
  setTimeout(() => { res.writeHead(200); res.end(JSON.stringify({ ok: true, result: out })); }, m === 'getUpdates' ? 1000 : 0); }); });
const initData = user => { const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const check = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex')); return p.toString(); };
(async () => {
  await new Promise(r => fake.listen(0, r));
  Object.assign(process.env, { BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://x', DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tll-')), 'db.json'), TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('../server/server.js'), ECON = require('../src/economy.js');
  srv.server.listen(0); await new Promise(r => srv.server.once('listening', r));
  const base = `http://127.0.0.1:${srv.server.address().port}`;
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  const users = Array.from({ length: DUELS * 2 }, (_, i) => ({ id: 10000 + i, first_name: 'P' + i }));
  for (const u of users) srv.db.users[u.id] = { id: String(u.id), pending: 0, gift: 0, refs: 0, created: Date.now(), profile: { ...ECON.newProfile(Date.now()), coins: 5000, cleared: 20, owned: { pinkbull: 20, egor: 20, gramcat: 20, memegram: 20, babyshark: 20 } } };
  const lag = monitorEventLoopDelay({ resolution: 10 }); lag.enable();
  const t0 = Date.now(); let ended = 0, ticks = 0;
  const streams = [];
  for (const u of users) {
    const r = await post('/api/pvp/find', { initData: initData(u), stake: 100 });
    const res = await fetch(`${base}/api/pvp/stream?ticket=${r.ticket}`);
    const reader = res.body.getReader(), dec = new TextDecoder(); streams.push(reader);
    (async () => { let buf = ''; for (;;) { const { value, done } = await reader.read().catch(() => ({ done: true })); if (done) break;
      buf += dec.decode(value); ticks += (buf.match(/event: tick/g) || []).length; if (buf.includes('event: end')) { ended++; break; } buf = buf.slice(-20); } })();
  }
  const mem0 = process.memoryUsage().rss;
  while (ended < users.length && Date.now() - t0 < 180e3) await new Promise(r => setTimeout(r, 500));
  lag.disable();
  console.log(`${DUELS} simultaneous duels (${users.length} players): finished ${ended}/${users.length} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(`tick messages streamed: ${ticks}`);
  console.log(`event-loop delay: p50 ${(lag.percentile(50) / 1e6).toFixed(1)} ms, p99 ${(lag.percentile(99) / 1e6).toFixed(1)} ms, max ${(lag.max / 1e6).toFixed(0)} ms`);
  console.log(`memory (RSS, incl. test clients): ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB (at start of duels ${(mem0 / 1048576).toFixed(0)} MB)`);
  const total = users.reduce((s, u) => s + srv.db.users[u.id].profile.coins, 0);
  console.log(`coins conserved: ${total === users.length * 5000} · escrow left: ${Object.keys(srv.db.escrow).length}`);
  srv.stop(); fake.close(); process.exit(0);
})();
