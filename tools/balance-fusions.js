// Balances alliances: every alliance plays stage BAL_STAGE beside the same four heroes, and the level that team needs
// to win 60% of auto battles is its strength. Each alliance's FUSION_ADJ (HP and ATK factor) is then set so that only
// KEEP of its distance from the median of its kind (duo / trio) is left. Two rounds: a guess, then a measured slope.
// usage: node tools/balance-fusions.js [workers=4]   → rewrites the FUSION_ADJ line in src/engine.js
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const E = require('../src/engine.js');
const BAL_STAGE = 149, FILL = ['notcoin', 'volya', 'babyshark', 'yaya'], KEEP = 0.4, LO = 0.6, HI = 2;
function winRate(team, lv, n = 8) {
  const levels = Object.fromEntries(team.map(id => [id, lv]));
  let w = 0;
  for (let i = 0; i < n; i++) { const B = E.createBattle(team, levels, BAL_STAGE, 1000 + i * 7919, null, null, null, { goblin: false }); B.autoBy.hero = true; while (!B.over) { E.step(B); B.events.length = 0; } if (B.over === 'win') w++; }
  return w / n;
}
function need(id) {
  const team = [id, ...FILL];
  let lo = 1, hi = 250;
  if (winRate(team, hi) < 0.6) return hi;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate(team, mid) >= 0.6) hi = mid; else lo = mid + 1; }
  return lo;
}
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];

if (process.argv[2] === '--worker') {
  process.on('message', ({ ids, adj }) => {
    const out = {};
    for (const id of ids) { E.HERO_BY_ID[id].adj = adj[id]; out[id] = need(id); }
    process.send(out); process.exit(0);
  });
} else {
  const workers = +process.argv[2] || 4;
  const measure = adj => new Promise(done => {
    const res = {}; let left = workers;
    for (let w = 0; w < workers; w++) {
      const c = fork(__filename, ['--worker']);
      c.on('message', m => { Object.assign(res, m); if (--left === 0) done(res); });
      c.send({ ids: E.FUSIONS.filter((_, i) => i % workers === w).map(f => f.id), adj });
    }
  });
  (async () => {
    const one = Object.fromEntries(E.FUSIONS.map(f => [f.id, 1]));
    const n0 = await measure(one);
    const want = {};
    for (const k of [2, 3]) {
      const ids = E.FUSIONS.filter(f => f.parts.length === k).map(f => f.id), med = median(ids.map(id => n0[id]));
      for (const id of ids) want[id] = med * Math.pow(n0[id] / med, KEEP);
      console.error(`${k}: median ${med}, range ${Math.min(...ids.map(id => n0[id]))}-${Math.max(...ids.map(id => n0[id]))}`);
    }
    const clamp = x => Math.min(HI, Math.max(LO, x));
    const a1 = Object.fromEntries(E.FUSIONS.map(f => [f.id, clamp(Math.pow(n0[f.id] / want[f.id], 1.5))]));
    const n1 = await measure(a1);
    const a2 = {};
    for (const f of E.FUSIONS) {
      const id = f.id, da = Math.log(a1[id]), dn = Math.log(n1[id] / n0[id]);
      // slope of log(need) against log(adj); fall back to the guess when the first step changed too little to read
      const s = Math.abs(da) > 0.02 && dn / da < -0.05 ? dn / da : -1 / 1.5;
      a2[id] = +clamp(Math.exp(Math.log(want[id] / n0[id]) / s)).toFixed(3);
    }
    const n2 = await measure(a2);
    for (const k of [2, 3]) { const ids = E.FUSIONS.filter(f => f.parts.length === k).map(f => f.id), v = ids.map(id => n2[id]).sort((x, y) => x - y);
      console.error(`${k} after: p10 ${v[v.length / 10 | 0]} median ${median(v)} p90 ${v[v.length * 0.9 | 0]} range ${v[0]}-${v[v.length - 1]}`); }
    const file = path.join(__dirname, '..', 'src', 'engine.js');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/const FUSION_ADJ = \[[^\]]*\];/, `const FUSION_ADJ = [${E.FUSIONS.map(f => a2[f.id]).join(', ')}];`));
    console.error('FUSION_ADJ written to src/engine.js');
  })();
}
