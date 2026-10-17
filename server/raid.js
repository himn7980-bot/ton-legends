// Gram Legends — world boss. One giant boss a week, shared by every player: each attempt is a 45-second fight
// (server-verified replay, like stages) whose damage comes off the boss's shared HP. When it falls, everyone who hit
// it gets gems (more for the top 3 and the final blow) and a stronger one appears. Damage also earns community war
// points. 3 free attempts a day; more cost gems. The weekly ranking shows players and communities by damage.
const crypto = require('crypto');
const E = require('../src/engine.js');
const ECON = require('../src/economy.js');

const BOSSES = ['teddy', 'notcoin', 'pinkbull', 'noctis', 'yoda', 'babyshark', 'volya', 'virus'];
const WEAK = ['stun', 'freeze', 'poison', 'vuln', 'slow'];
const FREE_TRIES = 3, MAX_EXTRA = 3, EXTRA_GEMS = 10, KILL_GEMS = 5, TOP_GEMS = 25, LAST_HIT_GEMS = 20;

module.exports = function createRaid({ db, persist, weekKey, credit, profileOut, ctxFor, onDamage = () => {} }) {
  db.raid = db.raid || null;
  const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code: status }); };
  const today = () => ECON.day(Date.now());
  // Boss HP grows with the number of players active in the last day (so a crowd still needs days, not minutes).
  function activePlayers() { const t = Date.now() - 864e5; return Object.values(db.users).filter(u => u.profile && (u.seen || 0) > t).length; }
  function spawn(level, week) {
    const wk = week || weekKey(), n = parseInt(String(wk).replace(/\D/g, '').slice(-3), 10) || 0;
    const boss = BOSSES[(n + level - 1) % BOSSES.length], max = Math.round(Math.max(400000, activePlayers() * 120000) * Math.pow(1.5, level - 1));
    db.raid = { week: wk, level, boss, weak: WEAK[(n + level) % WEAK.length], max, hp: max, dmg: {}, total: db.raid && db.raid.week === wk ? db.raid.total : {}, coms: db.raid && db.raid.week === wk ? db.raid.coms : {}, kills: db.raid && db.raid.week === wk ? db.raid.kills : [] };
    persist();
  }
  function roll() { if (!db.raid || db.raid.week !== weekKey()) spawn(1); return db.raid; }
  function triesLeft(u) { const d = today(); if (!u.raidDay || u.raidDay.d !== d) u.raidDay = { d, used: 0, extra: 0 }; return FREE_TRIES + u.raidDay.extra - u.raidDay.used; }

  function kill(R, killer) {
    const ranked = Object.entries(R.dmg).sort((a, b) => b[1] - a[1]);
    ranked.forEach(([uid], i) => { const u = db.users[uid]; if (u && u.profile) u.profile.stats.raidKills = (u.profile.stats.raidKills || 0) + 1; if (u) credit(u, 0, KILL_GEMS + (i < 3 ? TOP_GEMS : 0) + (uid === killer ? LAST_HIT_GEMS : 0)); });
    R.kills.push({ level: R.level, boss: R.boss, by: killer, name: (db.users[killer] || {}).name || 'Player', at: Date.now(), players: ranked.length });
    spawn(R.level + 1, R.week);
  }
  function view(u) {
    const R = roll(), top = Object.entries(R.total).sort((a, b) => b[1] - a[1]);
    return {
      week: R.week, level: R.level, boss: R.boss, weak: R.weak, hp: R.hp, max: R.max, time: E.RAID_TIME,
      tries: triesLeft(u), free: FREE_TRIES, extraGems: EXTRA_GEMS, rewards: { kill: KILL_GEMS, top: TOP_GEMS, last: LAST_HIT_GEMS },
      mine: { boss: R.dmg[u.id] || 0, week: R.total[u.id] || 0, rank: top.findIndex(([id]) => id === u.id) + 1 || null },
      top: top.slice(0, 10).map(([id, d]) => ({ name: (db.users[id] || {}).name || 'Player', av: ECON.avatarOf((db.users[id] || {}).profile), dmg: d, me: id === u.id })),
      coms: Object.entries(R.coms).sort((a, b) => b[1] - a[1]).map(([id, d]) => ({ id, dmg: d })),
      kills: R.kills.slice(-5).reverse(),
    };
  }
  const routes = {
    'POST /api/raid/me': (body, u) => ({ raid: view(u) }),
    'POST /api/raid/start': (body, u) => {
      const p = u.profile; if (!p) fail('no_profile');
      if (!ECON.unlocked(p, 'raid')) fail('locked_feature');
      if (!p.team.length) fail('bad_team');
      if (triesLeft(u) <= 0) {
        if (!body.buy || u.raidDay.extra >= MAX_EXTRA) fail('no_tries');
        if ((p.gems || 0) < EXTRA_GEMS) fail('no_gems');
        p.gems -= EXTRA_GEMS; u.raidDay.extra++;
      }
      const R = roll(), seed = crypto.randomInt(2 ** 32), { market, perks } = ctxFor(u);
      u.raidPending = { seed, level: R.level, boss: R.boss, weak: R.weak, team: [...p.team], levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), faction: p.faction || null, market, perks, at: Date.now() };
      u.raidDay.used++;
      persist();
      return { seed, raid: { boss: R.boss, level: R.level, weak: R.weak, hp: R.hp, max: R.max }, market, perks, profile: profileOut(u) };
    },
    'POST /api/raid/end': (body, u) => {
      const pd = u.raidPending; if (!pd) fail('no_battle');
      u.raidPending = null;
      if (Date.now() - pd.at > 10 * 60e3) fail('expired');
      // A fight plays for at least RAID_TIME / 3 seconds of real time (×3 speed); a scripted instant end is refused.
      if (Date.now() - pd.at < (process.env.RAID_MIN_MS !== undefined ? +process.env.RAID_MIN_MS : E.RAID_TIME / 3 * 1000 - 3000)) { u.raidPending = pd; fail('too_soon'); }
      const r = E.replayRaid(pd.team, pd.levels, pd.seed, body.inputs, { boss: pd.boss, level: pd.level, weak: pd.weak }, pd.faction, pd.market, pd.perks);
      const R = roll();
      // The fight counts against the boss that is up now (if it fell meanwhile, the damage goes to the next one).
      // Coins scale with the player's progress (about one stage reward per fight, up to 1.5× for big damage).
      const dmg = r.dmg, coins = Math.max(50, Math.round(ECON.progressReward(u.profile) * Math.max(0.5, Math.min(1.5, Math.sqrt(dmg) / 200))));
      u.profile.coins += coins; u.profile.stats.raidDmg = (u.profile.stats.raidDmg || 0) + dmg;
      R.dmg[u.id] = (R.dmg[u.id] || 0) + dmg; R.total[u.id] = (R.total[u.id] || 0) + dmg;
      if (u.profile.faction) R.coms[u.profile.faction] = (R.coms[u.profile.faction] || 0) + dmg;
      R.hp = Math.max(0, R.hp - dmg);
      onDamage(u.id, dmg);
      let killed = null;
      if (R.hp <= 0) { killed = { level: R.level, boss: R.boss }; kill(R, u.id); }
      persist();
      return { dmg, coins, killed, raid: view(u), profile: profileOut(u) };
    },
  };
  return { routes, view, roll, spawn, FREE_TRIES, EXTRA_GEMS };
};
