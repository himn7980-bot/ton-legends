// TON Legends — economy rules (coins, heroes, chests, quests, stages).
// Shared code: runs in the browser for offline play and on the server, which is the source of truth online.
(function (root, factory) {
  if (typeof module !== 'undefined') module.exports = factory(require('./engine.js'));
  // In the browser engine.js declares top-level consts (not window properties), so pass them explicitly.
  else root.ECON = factory({ STAGES_PER_WORLD, STARTERS, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, HERO_BY_ID, MAX_LEVEL, TOTAL_STAGES, COIN_BONUS, heroStats, upgradeCost, stageReward, replayStage });
})(typeof self !== 'undefined' ? self : this, function (E) {
  const CHESTS = {
    basic: { cost: 300, rates: { C: 55, R: 32, E: 11, L: 2 } },
    royal: { cost: 1200, rates: { C: 0, R: 50, E: 38, L: 12 } },
  };
  const DAILY_QUESTS = [
    { id: 'wins', goal: 3, r: 150 },
    { id: 'skills', goal: 15, r: 120 },
    { id: 'upgrades', goal: 2, r: 100 },
    { id: 'chests', goal: 1, r: 100 },
  ];
  const ACHIEVEMENTS = [
    { id: 'win', stat: p => p.stats.wins, tiers: [10, 50, 200, 500], r: [300, 1000, 3000, 8000] },
    { id: 'world', stat: p => Math.floor(p.cleared / E.STAGES_PER_WORLD), tiers: [1, 2, 3, 4, 5], r: [500, 1500, 3000, 6000, 12000] },
    { id: 'heroes', stat: p => Object.keys(p.owned).length, tiers: [8, 12, 16], r: [800, 2500, 8000] },
    { id: 'level', stat: p => Math.max(...Object.values(p.owned)), tiers: [5, 10, 20, 30], r: [300, 1000, 4000, 10000] },
    { id: 'chest', stat: p => p.stats.chests, tiers: [5, 25, 100], r: [500, 2000, 6000] },
    { id: 'skill', stat: p => p.stats.skills, tiers: [50, 300, 1000], r: [300, 1500, 5000] },
  ];
  const DAILY_REWARDS = [200, 300, 400, 500, 700, 900, 'royal'];
  const AFK_CAP_H = 8;
  const HOLO_CHANCE = 0.03; // a chest card has a 3% chance to come out as a shimmering Holo variant (cosmetic)
  const KEYS = ['coins', 'owned', 'team', 'cleared', 'stats', 'daily', 'dq', 'ach', 'afkSince', 'pending', 'serials', 'holo'];

  function newProfile(now) {
    return { coins: 300, owned: Object.fromEntries(E.STARTERS.map(id => [id, 1])), team: [...E.STARTERS], cleared: 0,
      stats: { wins: 0, losses: 0, chests: 0, upgrades: 0, skills: 0, bosses: 0, pvpWins: 0, pvpLosses: 0 },
      daily: { last: null, streak: 0 }, dq: { date: null, p: {}, c: {} }, ach: {}, afkSince: now, pending: null, serials: {}, holo: {} };
  }
  function normalize(p, now) {
    const d = newProfile(now);
    return { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, daily: { ...d.daily, ...(p.daily || {}) }, dq: { ...d.dq, ...(p.dq || {}) },
      ach: { ...(p.ach || {}) }, serials: { ...(p.serials || {}) }, holo: { ...(p.holo || {}) } };
  }
  const pickKeys = p => Object.fromEntries(KEYS.map(k => [k, p[k]]));

  // Days roll over at 00:00 UTC so the server and every client agree.
  const day = (now, off = 0) => new Date(now + off * 864e5).toISOString().slice(0, 10);
  function ensureDQ(p, now) { if (p.dq.date !== day(now)) p.dq = { date: day(now), p: {}, c: {} }; }
  function track(p, key, k, now) {
    p.stats[key] = (p.stats[key] || 0) + k;
    ensureDQ(p, now); p.dq.p[key] = (p.dq.p[key] || 0) + k;
  }
  const dqReward = (p, q) => Math.round(q.r * (1 + p.cleared / 8) / 10) * 10;
  const dailyCanClaim = (p, now) => p.daily.last !== day(now);
  const dailyNext = (p, now) => (p.daily.last === day(now, -1) ? p.daily.streak % 7 + 1 : 1);
  const afkRate = p => Math.round(E.stageReward(Math.max(0, p.cleared - 1)) * 2.5);
  const afkAmount = (p, now) => Math.floor(Math.min(AFK_CAP_H * 3600e3, now - (p.afkSince || now)) / 3600e3 * afkRate(p));
  const achTier = (p, a) => p.ach[a.id] || 0;
  const coinBonus = team => team.reduce((b, id) => b + (E.COIN_BONUS[id] || 0), 0);
  const stageCoins = (p, idx, team, first) => Math.round(E.stageReward(idx) * (1 + coinBonus(team)) * (first ? 2 : 1));
  const teamPower = (p, team = p.team) => team.reduce((sum, id) => { const s = E.heroStats(id, p.owned[id] || 1); return sum + s.hp / 10 + s.atk / s.spd * 2; }, 0);

  function claimable(p, now) {
    ensureDQ(p, now);
    let c = dailyCanClaim(p, now) ? 1 : 0;
    if (afkAmount(p, now) >= afkRate(p) / 2) c++;
    c += DAILY_QUESTS.filter(q => !p.dq.c[q.id] && (p.dq.p[q.id] || 0) >= q.goal).length;
    c += ACHIEVEMENTS.filter(a => achTier(p, a) < a.tiers.length && a.stat(p) >= a.tiers[achTier(p, a)]).length;
    return c;
  }

  function fail(code) { const e = new Error(code); e.code = 400; throw e; }

  function openChest(p, key, rng, now) {
    const c = CHESTS[key];
    let roll = rng() * 100, rarity = 'C';
    for (const [r, v] of Object.entries(c.rates)) { if (roll < v) { rarity = r; break; } roll -= v; }
    const pool = E.HEROES.filter(h => h.rarity === rarity);
    const h = pool[Math.floor(rng() * pool.length)];
    track(p, 'chests', 1, now);
    const holo = !p.holo[h.id] && rng() < HOLO_CHANCE;
    if (holo) p.holo[h.id] = true;
    if (!p.owned[h.id]) {
      p.owned[h.id] = 1;
      const added = p.team.length < 5;
      if (added) p.team.push(h.id);
      return { id: h.id, rarity, outcome: 'new', added, holo };
    }
    if (p.owned[h.id] < E.MAX_LEVEL) { p.owned[h.id]++; return { id: h.id, rarity, outcome: 'dupe', level: p.owned[h.id], holo }; }
    const refund = Math.round(c.cost / 2); p.coins += refund;
    return { id: h.id, rarity, outcome: 'refund', refund, holo };
  }

  // Apply one player action. Mutates p and returns a result; throws on invalid actions.
  // ctx: { now, rng } — the server passes its own clock and RNG.
  function act(p, a, ctx) {
    const { now, rng } = ctx;
    switch (a && a.type) {
      case 'team': {
        const t = Array.isArray(a.team) ? a.team : [];
        if (t.length > 5 || new Set(t).size !== t.length || t.some(id => !p.owned[id])) fail('bad_team');
        p.team = [...t];
        return {};
      }
      case 'upgrade': {
        const lv = p.owned[a.id];
        if (!lv || lv >= E.MAX_LEVEL) fail('cannot_upgrade');
        const cost = E.upgradeCost(a.id, lv);
        if (p.coins < cost) fail('no_coins');
        p.coins -= cost; p.owned[a.id]++; track(p, 'upgrades', 1, now);
        return { level: p.owned[a.id] };
      }
      case 'chest': {
        const c = CHESTS[a.key];
        if (!c) fail('bad_chest');
        if (p.coins < c.cost) fail('no_coins');
        p.coins -= c.cost;
        return openChest(p, a.key, rng, now);
      }
      case 'daily': {
        if (!dailyCanClaim(p, now)) fail('claimed');
        p.daily.streak = dailyNext(p, now); p.daily.last = day(now);
        const r = DAILY_REWARDS[p.daily.streak - 1];
        if (r === 'royal') return { day: p.daily.streak, chest: openChest(p, 'royal', rng, now) };
        p.coins += r;
        return { day: p.daily.streak, coins: r };
      }
      case 'afk': {
        const coins = afkAmount(p, now);
        p.afkSince = now; p.coins += coins;
        return { coins };
      }
      case 'quest': {
        ensureDQ(p, now);
        const q = DAILY_QUESTS.find(x => x.id === a.id);
        if (!q || p.dq.c[q.id] || (p.dq.p[q.id] || 0) < q.goal) fail('not_ready');
        const coins = dqReward(p, q); p.dq.c[q.id] = true; p.coins += coins;
        return { coins };
      }
      case 'ach': {
        const x = ACHIEVEMENTS.find(y => y.id === a.id);
        if (!x) fail('not_ready');
        const tier = achTier(p, x);
        if (tier >= x.tiers.length || x.stat(p) < x.tiers[tier]) fail('not_ready');
        const coins = x.r[tier]; p.ach[x.id] = tier + 1; p.coins += coins;
        return { coins };
      }
      case 'fuse': {
        const f = E.FUSIONS.find(x => x.id === a.id);
        if (!f) fail('bad_action');
        if (p.owned[f.id]) fail('claimed');
        const rule = E.FUSION_RULES[f.parts.length];
        if (f.parts.some(id => (p.owned[id] || 0) < rule.minLevel)) fail('need_parts');
        if (p.coins < rule.cost) fail('no_coins');
        // Online, the server hands out the next serial number (and refuses when the edition is sold out).
        const serial = ctx.mint ? ctx.mint(f.id, rule.supply) : null;
        p.coins -= rule.cost; p.owned[f.id] = 1;
        if (serial) p.serials[f.id] = serial;
        track(p, 'fusions', 1, now);
        return { id: f.id, serial, supply: rule.supply };
      }
      case 'stageStart': {
        const idx = a.stage | 0;
        if (idx < 0 || idx >= E.TOTAL_STAGES || idx > p.cleared) fail('locked');
        if (!p.team.length) fail('bad_team');
        const seed = Math.floor(rng() * 2 ** 32) >>> 0;
        p.pending = { stage: idx, seed, team: [...p.team], levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), at: now };
        return { seed };
      }
      case 'stageEnd': {
        const pd = p.pending;
        if (!pd) fail('no_battle');
        p.pending = null;
        const r = E.replayStage(pd.team, pd.levels, pd.stage, pd.seed, a.inputs);
        if (r.skills) track(p, 'skills', r.skills, now);
        if (r.result !== 'win') { p.stats.losses++; return { result: r.result, stage: pd.stage }; }
        const first = pd.stage === p.cleared;
        const coins = stageCoins(p, pd.stage, pd.team, first);
        if (first) p.cleared = Math.min(E.TOTAL_STAGES, p.cleared + 1);
        p.coins += coins;
        track(p, 'wins', 1, now);
        if (pd.stage % E.STAGES_PER_WORLD === E.STAGES_PER_WORLD - 1) track(p, 'bosses', 1, now);
        return { result: 'win', stage: pd.stage, coins, first };
      }
    }
    fail('bad_action');
  }

  // One-time import of an offline save into a new server profile, clamped so edited saves can't bring in
  // a fortune or maxed heroes.
  function importLocal(local, now) {
    const p = newProfile(now);
    if (!local || typeof local !== 'object') return p;
    const owned = {};
    for (const h of E.BASE_HEROES) { const lv = local.owned && Number(local.owned[h.id]); if (lv >= 1) owned[h.id] = Math.min(5, Math.floor(lv)); }
    for (const id of E.STARTERS) owned[id] = owned[id] || 1;
    p.owned = owned;
    p.team = (Array.isArray(local.team) ? local.team : []).filter((id, i, a) => owned[id] && a.indexOf(id) === i).slice(0, 5);
    if (!p.team.length) p.team = [...E.STARTERS];
    p.coins = Math.max(0, Math.min(5000, Math.floor(Number(local.coins) || 0)));
    p.cleared = Math.max(0, Math.min(E.TOTAL_STAGES, Math.floor(Number(local.cleared) || 0)));
    return p;
  }

  return { HOLO_CHANCE, CHESTS, DAILY_QUESTS, ACHIEVEMENTS, DAILY_REWARDS, AFK_CAP_H, KEYS, newProfile, normalize, pickKeys, day, ensureDQ, track,
    dqReward, dailyCanClaim, dailyNext, afkRate, afkAmount, achTier, coinBonus, stageCoins, teamPower, claimable, act, importLocal };
});
