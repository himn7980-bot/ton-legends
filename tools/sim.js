// Balance check: for each stage, find the lowest uniform team level that wins >= 60% of auto battles.
const E = require('../src/engine.js');
const teams = {
  starters: E.STARTERS,
  strong: ['notcoin', 'volya', 'noctis', 'babyshark', 'yaya'],
};
for (const [name, team] of Object.entries(teams)) {
  const out = [];
  for (let idx = 0; idx < E.TOTAL_STAGES; idx += 1) {
    let need = '>' + E.MAX_LEVEL;
    for (let lv = 1; lv <= E.MAX_LEVEL; lv++) {
      const levels = Object.fromEntries(team.map(id => [id, lv]));
      let wins = 0;
      for (let i = 0; i < 20; i++) {
        const B = E.createBattle(team, levels, idx); B.autoBy.hero = true;
        while (!B.over) { E.step(B); B.events.length = 0; }
        if (B.over === 'win') wins++;
      }
      if (wins >= 12) { need = lv; break; }
    }
    out.push(`${idx + 1}:${need}`);
  }
  console.log(name, out.join(' '));
}
