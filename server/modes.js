// Gram Legends — skill modes, server-verified like stages (seed + taps replayed by the engine).
//   Daily challenge: one rule twist a day (glass / toxic / swift / no ultimate), the same seed for everyone, played at
//     your own frontier (your last cleared stage, a bit stronger). Best of CH_TRIES attempts counts; the first attempt
//     each day pays coins, and the day's top 3 get gems. Score: a win = 1000 + HP left + speed; a loss = damage dealt.
//   Endless tower: floor after floor, each a little harder; a card that falls stays down for the rest of the run.
//     Coins every floor, gems every 10th floor (first time), and a best-floor ranking.
const crypto = require('crypto');
const E = require('../src/engine.js');
const ECON = require('../src/economy.js');

const CH_TRIES = 3, CH_MULT = 1.1, CH_PRIZES = [30, 20, 10], MOD_ORDER = ['glass', 'toxic', 'swift', 'noult'];
const TW_MILESTONE = 10, TW_MILESTONE_GEMS = 10;
const towerStage = floor => Math.min(E.TOTAL_STAGES - 1, (floor - 1) * 2);
const towerMult = floor => (floor > 100 ? Math.pow(1.08, floor - 100) : 1);
const dayNo = d => Math.floor(Date.parse(d) / 864e5);
const seedOf = d => crypto.createHash('sha256').update('gl-challenge:' + d).digest().readUInt32BE(0);
// Score of one attempt (higher is better).
const scoreOf = r => (r.result === 'win' ? 1000 + Math.round(r.heroHpLeft * 500) + Math.max(0, Math.round((60 - r.time) * 10)) : Math.round((1 - r.enemyHpLeft) * 500));

module.exports = function createModes({ db, persist, credit, profileOut, ctxFor }) {
  db.challenge = db.challenge || { scores: {}, paid: null };
  const C = db.challenge;
  const fail = code => { throw Object.assign(new Error(code), { code: 400 }); };
  const today = () => ECON.day(Date.now());
  const needProfile = u => { if (!u.profile) fail('no_profile'); if (!u.profile.team.length) fail('bad_team'); return u.profile; };
  const battle = (u, p, team) => ({ team: [...team], levels: Object.fromEntries(team.map(id => [id, p.owned[id]])), faction: p.faction || null, ...ctxFor(u) });

  // ---------- daily challenge ----------
  const modOf = d => MOD_ORDER[((dayNo(d) % MOD_ORDER.length) + MOD_ORDER.length) % MOD_ORDER.length];
  const challengeStage = p => Math.max(0, Math.min(E.TOTAL_STAGES - 1, (p.cleared || 0) - 1));
  // Yesterday's top 3 are paid the first time anyone opens the challenge today.
  function settle() {
    const y = ECON.day(Date.now(), -1);
    if (C.paid !== y && C.scores[y]) {
      Object.entries(C.scores[y]).sort((a, b) => b[1].score - a[1].score).slice(0, CH_PRIZES.length).forEach(([uid], i) => { const w = db.users[uid]; if (w) credit(w, 0, CH_PRIZES[i]); });
      C.paid = y;
    }
    for (const k of Object.keys(C.scores)) if (k < ECON.day(Date.now(), -3)) delete C.scores[k];
  }
  function chDay(u) { const d = today(); if (!u.ch || u.ch.d !== d) u.ch = { d, tries: 0, best: null, paid: false }; return u.ch; }
  function challengeView(u) {
    settle();
    const d = today(), list = Object.entries(C.scores[d] || {}).sort((a, b) => b[1].score - a[1].score), y = Object.entries(C.scores[ECON.day(Date.now(), -1)] || {}).sort((a, b) => b[1].score - a[1].score);
    const ch = chDay(u);
    return { day: d, mod: modOf(d), stage: u.profile ? challengeStage(u.profile) : 0, tries: CH_TRIES - ch.tries, maxTries: CH_TRIES, best: ch.best, prizes: CH_PRIZES,
      coins: u.profile ? ECON.progressReward(u.profile) * 3 : 0, paid: ch.paid, ends: Date.parse(d) + 864e5,
      rank: list.findIndex(([id]) => id === u.id) + 1 || null, players: list.length,
      top: list.slice(0, 10).map(([id, x]) => ({ name: x.name, av: x.av, score: x.score, me: id === u.id })),
      yesterday: y.slice(0, 3).map(([id, x]) => ({ name: x.name, av: x.av, score: x.score, me: id === u.id })) };
  }

  // ---------- endless tower ----------
  function tower(u) { u.tower = u.tower || { run: null, best: 0, ms: 0 }; return u.tower; }
  function towerView(u) {
    const T = tower(u), all = Object.values(db.users).filter(x => x.tower && x.tower.best > 0).sort((a, b) => b.tower.best - a.tower.best);
    return { run: T.run, best: T.best, next: T.run ? T.run.floor : 1, stage: towerStage(T.run ? T.run.floor : 1), mult: towerMult(T.run ? T.run.floor : 1),
      milestone: TW_MILESTONE, milestoneGems: TW_MILESTONE_GEMS, rank: all.findIndex(x => x.id === u.id) + 1 || null,
      top: all.slice(0, 20).map(x => ({ name: x.name || 'Player', av: ECON.avatarOf(x.profile), best: x.tower.best, me: x.id === u.id })) };
  }

  const routes = {
    'POST /api/challenge/me': (body, u) => ({ challenge: challengeView(u) }),
    'POST /api/challenge/start': (body, u) => {
      const p = needProfile(u);
      if (!ECON.unlocked(p, 'challenge')) fail('locked_feature');
      const ch = chDay(u);
      if (ch.tries >= CH_TRIES) fail('no_tries');
      const d = today(), b = battle(u, p, p.team), stage = challengeStage(p), opts = { enemyMult: CH_MULT, mod: modOf(d), goblin: false };
      ch.tries++;
      u.chPending = { d, seed: seedOf(d), stage, opts, ...b, at: Date.now() };
      persist();
      return { seed: u.chPending.seed, stage, opts, market: b.market, perks: b.perks, challenge: challengeView(u) };
    },
    'POST /api/challenge/end': (body, u) => {
      const pd = u.chPending; if (!pd) fail('no_battle');
      u.chPending = null;
      const p = needProfile(u), ch = chDay(u);
      const r = E.replayStage(pd.team, pd.levels, pd.stage, pd.seed, body.inputs, pd.faction, pd.market, pd.perks, pd.opts);
      const score = pd.d === ch.d ? scoreOf(r) : 0;
      let coins = 0;
      if (pd.d === ch.d) {
        if (!ch.paid) { ch.paid = true; coins = ECON.progressReward(p) * 3; p.coins += coins; }
        if (ch.best === null || score > ch.best) {
          ch.best = score;
          const day = C.scores[pd.d] || (C.scores[pd.d] = {});
          day[u.id] = { score, name: u.name || 'Player', av: ECON.avatarOf(p) };
        }
      }
      persist();
      return { result: r.result, score, coins, perfects: r.perfects, maxChain: r.maxChain, time: r.time, challenge: challengeView(u), profile: profileOut(u) };
    },
    'POST /api/tower/me': (body, u) => ({ tower: towerView(u) }),
    'POST /api/tower/start': (body, u) => {
      const p = needProfile(u);
      if (!ECON.unlocked(p, 'tower')) fail('locked_feature');
      const T = tower(u);
      if (!T.run) T.run = { floor: 1, dead: [] };
      const team = p.team.filter(id => !T.run.dead.includes(id));
      if (!team.length) fail('tower_dead');
      const floor = T.run.floor, b = battle(u, p, team), opts = { enemyMult: towerMult(floor), goblin: false };
      u.twPending = { floor, seed: crypto.randomInt(2 ** 32), stage: towerStage(floor), opts, ...b, at: Date.now() };
      persist();
      return { seed: u.twPending.seed, stage: u.twPending.stage, team, opts, market: b.market, perks: b.perks, floor };
    },
    'POST /api/tower/end': (body, u) => {
      const pd = u.twPending; if (!pd) fail('no_battle');
      u.twPending = null;
      const p = needProfile(u), T = tower(u);
      if (!T.run || T.run.floor !== pd.floor) fail('no_battle');
      const r = E.replayStage(pd.team, pd.levels, pd.stage, pd.seed, body.inputs, pd.faction, pd.market, pd.perks, pd.opts);
      let coins = 0, gems = 0, over = false;
      if (r.result === 'win') {
        coins = Math.round(E.stageReward(pd.stage) * 0.5);
        T.run.dead = [...new Set([...T.run.dead, ...r.lost])];
        T.best = Math.max(T.best, pd.floor);
        if (pd.floor % TW_MILESTONE === 0 && pd.floor / TW_MILESTONE > T.ms) { T.ms = pd.floor / TW_MILESTONE; gems = TW_MILESTONE_GEMS; }
        T.run.floor++;
        if (!p.team.some(id => !T.run.dead.includes(id))) { over = true; T.run = null; }
      } else { over = true; T.run = null; }
      p.coins += coins; p.gems += gems;
      persist();
      return { result: r.result, floor: pd.floor, coins, gems, over, lost: r.lost, perfects: r.perfects, maxChain: r.maxChain, tower: towerView(u), profile: profileOut(u) };
    },
    'POST /api/tower/reset': (body, u) => { tower(u).run = null; persist(); return { tower: towerView(u) }; },
  };
  return { routes, challengeView, towerView, modOf, scoreOf, CH_TRIES, towerStage, towerMult };
};
