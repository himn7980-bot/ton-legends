// Calibrates STAGE_K in engine.js: for every stage from world 3 on, the factor at which the reference teams need
// TARGET(stage) × RAMP(position in world) levels to win 60% of auto battles. Several teams (plain heroes, alliance
// cards) are averaged so no single line-up makes a stage spike; each team is first scaled by its own overall strength.
// Worlds 3–4 ramp linearly from the level world 2 needs up to world 5's target, so there is no wall at world 5.
// usage: node tools/calibrate.js [from=20] [to=200] [workers=4]   → rewrites the STAGE_K line in src/engine.js
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const E = require('../src/engine.js');
const fz = (...p) => E.FUSIONS.find(f => f.parts.length === p.length && p.every(x => f.parts.includes(x))).id;
const TEAMS = [
  ['notcoin', 'volya', 'noctis', 'babyshark', 'yaya'],
  ['volya', 'babyshark', 'yaya', fz('noctis', 'paws'), fz('pinkbull', 'notcoin', 'teddy')],
  [fz('paws', 'noctis', 'pengu'), fz('notcoin', 'volya'), 'noctis', 'paws', 'volya'],
];
const TARGET = idx => 1 + 95 * Math.pow(idx / 199, 1.1);
const RAMP = [0.93, 0.95, 0.97, 0.99, 1.0, 1.01, 1.02, 1.03, 1.04, 1.1];
const EARLY_FROM = 19, EARLY_LEVEL = 3, EARLY_TO = 40;
// Late game is tuned on alliance decks: past ALLY_TO the alliance teams themselves need ALLY_TARGET levels (no
// strength discount), so a deck of fusions is not a free pass. Between EARLY_TO and ALLY_TO the goal blends over.
const ALLY_TARGET = idx => 1 + 75 * Math.pow(idx / 199, 1.1), ALLY_TO = 90;
const goal = idx => (idx < EARLY_TO ? EARLY_LEVEL + (TARGET(EARLY_TO) - EARLY_LEVEL) * (idx - EARLY_FROM) / (EARLY_TO - EARLY_FROM) : TARGET(idx)) * RAMP[idx % 10];
const allyW = idx => Math.max(0, Math.min(1, (idx - EARLY_TO) / (ALLY_TO - EARLY_TO)));
function winRate(team, lv, idx, n = 16) {
  const levels = Object.fromEntries(team.map(id => [id, lv]));
  let w = 0;
  for (let i = 0; i < n; i++) { const B = E.createBattle(team, levels, idx, 1000 + i * 7919); B.autoBy.hero = true; while (!B.over) { E.step(B); B.events.length = 0; } if (B.over === 'win') w++; }
  return w / n;
}
function need(team, idx) {
  let lo = 1, hi = 200;
  if (winRate(team, hi, idx) < 0.6) return 400;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate(team, mid, idx) >= 0.6) hi = mid; else lo = mid + 1; }
  return lo;
}
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
const gmean = a => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);

if (process.argv[2] === '--worker') {
  // Worker: { stages, factors } → { idx: k }
  process.on('message', ({ stages, factors }) => {
    const out = {};
    for (const idx of stages) {
      // Worlds 3–4 come before alliance cards, so only the plain-hero team counts there.
      const teams = idx < EARLY_TO ? TEAMS.slice(0, 1) : TEAMS;
      const w = allyW(idx), ally = factors.slice(1), aref = Math.min(...ally);
      const score = () => {
        const n = teams.map(t => need(t, idx));
        const plain = gmean(n.map((x, i) => x / factors[i]));
        if (!w) return plain - goal(idx);
        // alliance teams scaled to the strongest one, aiming at ALLY_TARGET
        const al = gmean(n.slice(1).map((x, i) => x * aref / ally[i]));
        return Math.exp((1 - w) * Math.log(plain / goal(idx)) + w * Math.log(al / (ALLY_TARGET(idx) * RAMP[idx % 10])));
      };
      let lo = Math.log(E.STAGE_K[idx] / 3), hi = Math.log(E.STAGE_K[idx] * 3);
      for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; E.STAGE_K[idx] = Math.exp(mid); if (w ? score() > 1 : score() > 0) hi = mid; else lo = mid; }
      out[idx] = +Math.exp((lo + hi) / 2).toFixed(3);
      process.send({ progress: idx });
    }
    process.send({ out }); process.exit(0);
  });
} else {
  const from = +process.argv[2] || E.CALIBRATED_FROM, to = +process.argv[3] || E.TOTAL_STAGES, workers = +process.argv[4] || 4;
  // Each team's strength relative to the plain-hero team (sampled stages, current factors).
  // (measured from world 5 on, where the target curve applies)
  const sample = []; for (let i = Math.max(from, EARLY_TO) + 5; i < E.TOTAL_STAGES; i += 10) sample.push(i, i + 4);
  const factors = TEAMS.map(t => median(sample.map(i => need(t, i) / TARGET(i))));
  console.error('team factors', factors.map(f => f.toFixed(3)).join(' '));
  const stages = []; for (let i = from; i < to; i++) stages.push(i);
  const K = [...E.STAGE_K]; let left = workers, done = 0;
  for (let w = 0; w < workers; w++) {
    const c = fork(__filename, ['--worker']);
    c.on('message', m => {
      if (m.progress !== undefined) { if (++done % 10 === 0) console.error(`${done}/${stages.length}`); return; }
      Object.assign(K, Object.fromEntries(Object.entries(m.out).map(([k, v]) => [+k, v])));
      if (--left === 0) {
        const file = path.join(__dirname, '..', 'src', 'engine.js');
        const src = fs.readFileSync(file, 'utf8').replace(/const STAGE_K = \[[^\]]*\];/, `const STAGE_K = [${K.join(', ')}];`);
        fs.writeFileSync(file, src);
        console.error('STAGE_K written to src/engine.js');
      }
    });
    c.send({ stages: stages.filter((_, i) => i % workers === w), factors });
  }
}
