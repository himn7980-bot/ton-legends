// Calibrates WORLD_K in engine.js: for each world, the factor at which a team of five non-fusion cards needs
// about TARGET(stage) levels (median over the world's 10 stages) to win 60% of auto battles.
// usage: node tools/calibrate.js   → prints the WORLD_K line to paste into src/engine.js
const E = require('../src/engine.js');
const TEAM = ['notcoin', 'volya', 'noctis', 'babyshark', 'yaya'];
const TARGET = idx => 1 + 95 * Math.pow(idx / 199, 1.1);
function winRate(lv, idx, n = 16) {
  const levels = Object.fromEntries(TEAM.map(id => [id, lv]));
  let w = 0;
  for (let i = 0; i < n; i++) { const B = E.createBattle(TEAM, levels, idx, 1000 + i * 7919); B.autoBy.hero = true; while (!B.over) { E.step(B); B.events.length = 0; } if (B.over === 'win') w++; }
  return w / n;
}
function need(idx) {
  let lo = 1, hi = 130;
  if (winRate(hi, idx) < 0.6) return 999;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate(mid, idx) >= 0.6) hi = mid; else lo = mid + 1; }
  return lo;
}
const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
// Inside a world the first stage should be ~15% easier than the world's middle and the boss ~20% harder.
const RAMP = [0.86, 0.88, 0.91, 0.94, 0.97, 1.0, 1.03, 1.06, 1.1, 1.2];
// Pass 1: LOCAL_K from the need/target ratio per stage position (worlds 5–20), one proportional correction.
const ratios = Array.from({ length: 10 }, () => []);
for (let w = 4; w < 20; w += 1) {
  const r = Array.from({ length: 10 }, (_, i) => need(w * 10 + i) / TARGET(w * 10 + i));
  const m = median(r);
  r.forEach((x, i) => ratios[i].push(x / m));
}
ratios.forEach((r, i) => { E.LOCAL_K[i] = +(E.LOCAL_K[i] * RAMP[i] / median(r)).toFixed(3); });
console.error('LOCAL_K', E.LOCAL_K.join(', '));
// Pass 2: WORLD_K so each world's median stage needs TARGET levels.
for (let w = 0; w < 20; w++) {
  const stages = Array.from({ length: 10 }, (_, i) => w * 10 + i);
  const gap = () => median(stages.map(i => need(i) - TARGET(i)));
  let lo = 0.2, hi = 5;
  for (let it = 0; it < 12; it++) { const mid = Math.sqrt(lo * hi); E.WORLD_K[w] = mid; if (gap() > 0) hi = mid; else lo = mid; }
  E.WORLD_K[w] = +Math.sqrt(lo * hi).toFixed(3);
  console.error(`world ${w + 1}: k=${E.WORLD_K[w]}  need ${stages.map(need).join(',')}  target ${stages.map(i => Math.round(TARGET(i))).join(',')}`);
}
console.log(`const WORLD_K = [${E.WORLD_K.join(', ')}];\nconst LOCAL_K = [${E.LOCAL_K.join(', ')}];`);
