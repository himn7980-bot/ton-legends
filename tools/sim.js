// Balance check: for sampled stages, the lowest uniform team level that wins >= 60% of auto battles (binary search).
// usage: node tools/sim.js [step=5]
const E = require('../src/engine.js');
const fz = (...p) => E.FUSIONS.find(f => f.parts.length === p.length && p.every(x => f.parts.includes(x))).id;
const teams = {
  starters: E.STARTERS,
  legends: ['notcoin', 'volya', 'noctis', 'babyshark', 'yaya'],
  mixed: ['volya', 'babyshark', 'yaya', fz('noctis', 'paws'), fz('pinkbull', 'notcoin', 'teddy')], // the most a team may hold: 1 duo + 1 trio
};
const only = process.argv[3]; if (only) for (const k of Object.keys(teams)) if (k !== only) delete teams[k];
const step = +process.argv[2] || 5;
function winRate(team, lv, idx, n = 12) {
  const levels = Object.fromEntries(team.map(id => [id, lv]));
  let w = 0;
  for (let i = 0; i < n; i++) { const B = E.createBattle(team, levels, idx); B.autoBy.hero = true; while (!B.over) { E.step(B); B.events.length = 0; } if (B.over === 'win') w++; }
  return w / n;
}
for (const [name, team] of Object.entries(teams)) {
  const out = [];
  for (let idx = step - 1; idx < E.TOTAL_STAGES; idx += step) {
    let lo = 1, hi = E.MAX_LEVEL;
    if (winRate(team, hi, idx) < 0.6) { out.push(`${idx + 1}:>${hi}`); continue; }
    while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate(team, mid, idx) >= 0.6) hi = mid; else lo = mid + 1; }
    out.push(`${idx + 1}:${lo}`);
  }
  console.log(name.padEnd(9), out.join(' '));
}
