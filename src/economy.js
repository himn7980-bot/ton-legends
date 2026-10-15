// TON Legends — economy rules (coins, heroes, chests, quests, stages).
// Shared code: runs in the browser for offline play and on the server, which is the source of truth online.
(function (root, factory) {
  if (typeof module !== 'undefined') module.exports = factory(require('./engine.js'));
  // In the browser engine.js declares top-level consts (not window properties), so pass them explicitly.
  else root.ECON = factory({ STAGES_PER_WORLD, STARTERS, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, fusionStartLevel, LEGACY_FUSION_IDS, teamError, duosWithin, factionMult, marketMult, HERO_BY_ID, MAX_LEVEL, TOTAL_STAGES, COIN_BONUS, heroStats, upgradeCost, stageReward, replayStage });
})(typeof self !== 'undefined' ? self : this, function (E) {
  const CHESTS = {
    basic: { cost: 300, rates: { C: 55, R: 32, E: 11, L: 2 } },
    royal: { cost: 1200, rates: { C: 0, R: 50, E: 38, L: 12 } },
    gem: { cost: 120, currency: 'gems', rates: { C: 0, R: 40, E: 42, L: 18 }, holo: 0.10 },
  };
  // Gems: the rare currency. Earned slowly (achievements, day-7 reward, arena, AI, clan chest) or bought with Stars.
  // One-way exchange to coins at a rate that grows with progress; coins can never become gems.
  const START_GEMS = 20, DAY7_GEMS = 15, WARP_COST = 30, WARP_HOURS = 4;
  const gemRate = p => Math.round(50 * (1 + p.cleared / 25));
  const achGems = tier => 5 * (tier + 1);
  // Features open up as the player clears stages (value = stages cleared, i.e. 10 = reached world 2).
  // Joining a friend's duel or clan from an invite is always allowed, so invite links work for new players.
  const UNLOCKS = { royal: 10, ai: 10, pvp: 20, exchange: 20, duo: 30, gemChest: 40, clan: 40, trio: 70 };
  const unlocked = (p, key) => (p.cleared || 0) >= UNLOCKS[key];
  const needUnlock = (p, key) => { if (!unlocked(p, key)) fail('locked_feature'); };
  // AI duels: no stake; the first AI_DAILY wins each day pay a reward based on progress.
  const AI_DAILY = 5;
  // Rookie journey: 7 days of 3 simple tasks for new players; day N opens N-1 days after joining (missed days
  // stay open), and day 7 gives a Legendary hero. Tasks count totals, so progress is never lost.
  const ROOKIE = [
    { tasks: [['cleared', 3], ['skills', 5], ['upgrades', 1]], coins: 500, gems: 5 },
    { tasks: [['cleared', 6], ['chests', 1], ['wins', 8]], coins: 800, gems: 5 },
    { tasks: [['cleared', 10], ['faction', 1], ['upgrades', 5]], coins: 1200, gems: 10 },
    { tasks: [['cleared', 14], ['aiWins', 1], ['skills', 40]], coins: 1500, gems: 10 },
    { tasks: [['cleared', 18], ['chests', 4], ['wins', 25]], coins: 2000, gems: 15 },
    { tasks: [['cleared', 22], ['pvpWins', 1], ['upgrades', 12]], coins: 2500, gems: 15 },
    { tasks: [['cleared', 26], ['skills', 100], ['wins', 40]], coins: 3000, gems: 20, legend: true },
  ];
  const rookieStat = (p, k) => (k === 'cleared' ? p.cleared : k === 'faction' ? (p.faction ? 1 : 0) : (p.stats && p.stats[k]) || 0);
  const rookieOpenDays = (p, now) => (p.rookie ? Math.floor((Date.parse(day(now)) - Date.parse(p.rookie.start)) / 864e5) + 1 : 0);
  const rookieDayDone = (p, d) => ROOKIE[d].tasks.every(([k, n]) => rookieStat(p, k) >= n);
  const rookieActive = p => !!(p.rookie && p.rookie.claimed.length < ROOKIE.length);
  // Collection sets: own all four heroes of a set at level SET_LEVEL+ and every card in your team gets the bonus.
  const SET_LEVEL = 10;
  const SETS = [
    { id: 'ocean', ico: '🌊', heroes: ['utya', 'pengu', 'babyshark', 'dog'], perk: { hp: 0.05 } },
    { id: 'crystal', ico: '💎', heroes: ['egor', 'memegram', 'yoda', 'gramcat'], perk: { atk: 0.05 } },
    { id: 'neon', ico: '🌃', heroes: ['pinkbull', 'notcoin', 'volya', 'teddy'], perk: { coins: 0.10 } },
    { id: 'shadow', ico: '🌿', heroes: ['paws', 'noctis', 'virus', 'yaya'], perk: { energy: 25 } },
  ];
  const setDone = (p, s) => s.heroes.every(id => (p.owned[id] || 0) >= SET_LEVEL);
  const perksOf = p => SETS.filter(s => setDone(p, s)).reduce((a, s) => { for (const [k, v] of Object.entries(s.perk)) a[k] = (a[k] || 0) + v; return a; }, {});
  // Stars are earned with levels (10/25/50/75/100); five stars = awakened.
  const STAR_LEVELS = [10, 25, 50, 75, 100];
  const starsOf = lv => STAR_LEVELS.filter(l => (lv || 0) >= l).length;
  // Weekly events (by UTC weekday): every day has something special.
  const EVENTS = ['coins', 'war', 'ai', 'chest', 'sale', 'arena', 'coins']; // Sun..Sat
  const EVENT_FX = { coins: 0.5, war: 2, ai: 2, chest: 1.5, sale: 0.2, arena: 2 };
  // (tests pin the day's event with TL_EVENT, e.g. 'none')
  const eventOf = now => (typeof process !== 'undefined' && process.env && process.env.TL_EVENT) || EVENTS[new Date(now).getUTCDay()];
  // Community war extras (server/war.js keeps the weekly state; these numbers are shared with the client).
  const COMMUNITY = {
    TERRITORY_BONUS: 0.15,        // +stage coins in a world your community holds this week
    TERRITORY_MIN: 5,             // points needed before a world can be held
    CRIES: { gold: { coins: 0.10 }, might: { power: 1.05 }, rally: { points: 1.5 } }, // the captain's battle cry
    DERBY_MULT: 3, DERBY_WIN_GEMS: 10, // arena wins vs the derby rival count triple; derby winners get gems
    PREDICT_GEMS: 10, PREDICT_DAYS: 3, // guess the weekly winner during the first 3 days
    GOAL: { perMember: 4, min: 30, max: 20000, gems: 5, coins: 500 }, // shared daily win target
    MILESTONES: [1000, 10000, 100000, 1000000], // all-time points → bronze, silver, gold, diamond frames
  };
  // Market mood: each hero's 24h change (its token's price, or its community's activity when it has no token)
  // sets today's mood. Up days make the card stronger; down days pay extra stage coins while it is in your team.
  const MOODS = [
    { key: 'moon', min: 10, power: 1.10, coins: 0 },
    { key: 'bull', min: 2, power: 1.05, coins: 0 },
    { key: 'calm', min: -2, power: 1, coins: 0 },
    { key: 'bear', min: -10, power: 1, coins: 0.2 },
    { key: 'crash', min: -Infinity, power: 1, coins: 0.4 },
  ];
  const moodOf = change => (typeof change === 'number' && isFinite(change) ? MOODS.find(m => change >= m.min) : MOODS[2]);
  // { id: power multiplier } for the heroes having a good day (what battles use).
  const marketBoosts = moods => {
    const out = {};
    for (const [id, m] of Object.entries(moods || {})) { const md = moodOf(m && m.change); if (md.power > 1) out[id] = md.power; }
    return out;
  };
  // Extra stage coins: the best "dip bonus" among the team's cards (fusions count their parts).
  const marketCoinBonus = (moods, team) => Math.max(0, ...team.flatMap(id => (E.HERO_BY_ID[id] && E.HERO_BY_ID[id].fusion ? E.HERO_BY_ID[id].parts : [id]))
    .map(id => moodOf(moods && moods[id] && moods[id].change).coins));
  // Communities: joining is free; switching costs gems and is allowed once a week. Your community's card is
  // cheaper to upgrade and drops more often from chests. Sharing the game once a day pays a few gems.
  const FACTION_SWITCH_GEMS = 100, FACTION_SWITCH_DAYS = 7, FACTION_UPGRADE_DISCOUNT = 0.25, FACTION_CHEST_WEIGHT = 3, SHARE_GEMS = 3;
  const upgradePrice = (p, id, lv = p.owned[id], now = Date.now()) => Math.round(E.upgradeCost(id, lv) * (id === p.faction ? 1 - FACTION_UPGRADE_DISCOUNT : 1) * (eventOf(now) === 'sale' ? 1 - EVENT_FX.sale : 1));
  const AI_LEVELS = { easy: { power: 0.8, coins: 0.5, gems: 0 }, normal: { power: 1, coins: 1, gems: 0 }, hard: { power: 1.25, coins: 2, gems: 1 } };
  const aiLeft = (p, now) => (p.aiDay && p.aiDay.date === day(now) ? Math.max(0, AI_DAILY - p.aiDay.wins) : AI_DAILY);
  const aiReward = (p, level, now = Date.now()) => ({ coins: Math.round(E.stageReward(Math.max(0, p.cleared - 1)) * AI_LEVELS[level].coins * (eventOf(now) === 'ai' ? EVENT_FX.ai : 1)), gems: AI_LEVELS[level].gems });
  const DAILY_QUESTS = [
    { id: 'wins', goal: 3, r: 150 },
    { id: 'skills', goal: 15, r: 120 },
    { id: 'upgrades', goal: 2, r: 100 },
    { id: 'chests', goal: 1, r: 100 },
  ];
  const ACHIEVEMENTS = [
    { id: 'win', stat: p => p.stats.wins, tiers: [10, 50, 200, 500], r: [300, 1000, 3000, 8000] },
    { id: 'world', stat: p => Math.floor(p.cleared / E.STAGES_PER_WORLD), tiers: [1, 2, 3, 5, 8, 10, 13, 16, 20], r: [500, 1500, 3000, 6000, 12000, 20000, 35000, 60000, 100000] },
    { id: 'heroes', stat: p => Object.keys(p.owned).length, tiers: [8, 12, 16], r: [800, 2500, 8000] },
    { id: 'level', stat: p => Math.max(...Object.values(p.owned)), tiers: [5, 10, 20, 30, 50, 75, 100], r: [300, 1000, 4000, 10000, 25000, 50000, 100000] },
    { id: 'chest', stat: p => p.stats.chests, tiers: [5, 25, 100], r: [500, 2000, 6000] },
    { id: 'skill', stat: p => p.stats.skills, tiers: [50, 300, 1000], r: [300, 1500, 5000] },
  ];
  const DAILY_REWARDS = [200, 300, 400, 500, 700, 900, 'royal'];
  const AFK_CAP_H = 8;
  const HOLO_CHANCE = 0.03; // a chest card has a 3% chance to come out as a shimmering Holo variant (cosmetic)
  const KEYS = ['rookie', 'fv', 'faction', 'factionAt', 'shareDay', 'coins', 'gems', 'owned', 'team', 'cleared', 'stats', 'daily', 'dq', 'ach', 'afkSince', 'pending', 'serials', 'holo', 'replays', 'aiDay'];

  function newProfile(now) {
    return { rookie: { start: day(now), claimed: [] }, fv: FUSION_VERSION, faction: null, factionAt: 0, shareDay: null, coins: 300, gems: START_GEMS, aiDay: null, owned: Object.fromEntries(E.STARTERS.map(id => [id, 1])), team: [...E.STARTERS], cleared: 0,
      stats: { wins: 0, losses: 0, chests: 0, upgrades: 0, skills: 0, bosses: 0, pvpWins: 0, pvpLosses: 0 },
      daily: { last: null, streak: 0 }, dq: { date: null, p: {}, c: {} }, ach: {}, afkSince: now, pending: null, serials: {}, holo: {}, replays: {} };
  }
  // Fusion cards were renamed to numbers (f_golden_bull → f1); move old ids over.
  function migrateIds(obj) {
    if (!obj) return obj;
    for (const [old, id] of Object.entries(E.LEGACY_FUSION_IDS || {})) if (old in obj) { obj[id] = obj[old]; delete obj[old]; }
    return obj;
  }
  // v2 fusion rules: the old cards fought like their parts +9 (duo) / +19 (trio) levels, now +6 / +12 —
  // move owned fusion cards up by the difference so they keep their power.
  const FUSION_VERSION = 2, FUSION_V2_SHIFT = { 2: 3, 3: 7 };
  function normalize(p, now) {
    const d = newProfile(now);
    // Players who joined before the rookie journey: new-ish ones get it, veterans skip it.
    if (!p.rookie) p.rookie = (p.cleared || 0) >= 30 ? { start: day(now), claimed: [0, 1, 2, 3, 4, 5, 6] } : { start: day(now), claimed: [] };
    if (p.fv !== FUSION_VERSION) {
      for (const f of E.FUSIONS) if (p.owned && p.owned[f.id]) p.owned[f.id] = Math.min(E.MAX_LEVEL, p.owned[f.id] + FUSION_V2_SHIFT[f.parts.length]);
      p.fv = FUSION_VERSION;
    }
    if (typeof p.gems !== 'number') p.gems = START_GEMS;
    migrateIds(p.owned); migrateIds(p.serials); migrateIds(p.holo);
    if (Array.isArray(p.team)) {
      p.team = p.team.map(id => (E.LEGACY_FUSION_IDS || {})[id] || id);
      // Older saves may field more fusion cards than allowed: keep the first ones that fit.
      const keep = [];
      for (const id of p.team) if (!E.teamError([...keep, id])) keep.push(id);
      p.team = keep;
    }
    return { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, daily: { ...d.daily, ...(p.daily || {}) }, dq: { ...d.dq, ...(p.dq || {}) },
      ach: { ...(p.ach || {}) }, serials: { ...(p.serials || {}) }, holo: { ...(p.holo || {}) }, replays: { ...(p.replays || {}) } };
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
  // First clear pays ×2. Every win on an already-cleared stage pays half of the previous replay (50%, 25%, 12.5%…),
  // so farming old stages dries up and progress comes from new stages, the idle chest, quests and the arena.
  const replayFactor = (p, idx) => (idx < p.cleared ? Math.pow(0.5, (p.replays[idx] || 0) + 1) : 2);
  const stageCoins = (p, idx, team, dip = 0) => Math.floor(E.stageReward(idx) * (1 + coinBonus(team) + dip) * replayFactor(p, idx));
  const teamPower = (p, team = p.team) => { const pk = perksOf(p); return team.reduce((sum, id) => { const s0 = E.heroStats(id, p.owned[id] || 1), k = E.factionMult(id, p.faction), s = { hp: s0.hp * k * (1 + (pk.hp || 0)), atk: s0.atk * k * (1 + (pk.atk || 0)), spd: s0.spd }; return sum + s.hp / 10 + s.atk / s.spd * 2; }, 0); };

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
    // Chest day: Epic and Legendary odds ×1.5 (Common/Rare shrink to make room).
    let rates = c.rates;
    if (eventOf(now) === 'chest') {
      const up = { ...rates, E: rates.E * EVENT_FX.chest, L: rates.L * EVENT_FX.chest }, extra = up.E + up.L - rates.E - rates.L, low = rates.C + rates.R;
      rates = { ...up, C: rates.C - extra * rates.C / low, R: rates.R - extra * rates.R / low };
    }
    let roll = rng() * 100, rarity = 'C';
    for (const [r, v] of Object.entries(rates)) { if (roll < v) { rarity = r; break; } roll -= v; }
    // Your community's hero is FACTION_CHEST_WEIGHT times as likely as the others of its rarity.
    const pool = E.HEROES.filter(h => h.rarity === rarity), w = h => (h.id === p.faction ? FACTION_CHEST_WEIGHT : 1);
    let pickW = rng() * pool.reduce((a, h) => a + w(h), 0), h = pool[pool.length - 1];
    for (const x of pool) { if (pickW < w(x)) { h = x; break; } pickW -= w(x); }
    track(p, 'chests', 1, now);
    const holo = !p.holo[h.id] && rng() < (c.holo || HOLO_CHANCE);
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
        const te = E.teamError(t); if (te) fail(te);
        p.team = [...t];
        return {};
      }
      case 'upgrade': {
        const lv = p.owned[a.id];
        if (!lv || lv >= E.MAX_LEVEL) fail('cannot_upgrade');
        const cost = upgradePrice(p, a.id, lv, now);
        if (p.coins < cost) fail('no_coins');
        p.coins -= cost; p.owned[a.id]++; track(p, 'upgrades', 1, now);
        return { level: p.owned[a.id] };
      }
      case 'chest': {
        const c = CHESTS[a.key];
        if (!c) fail('bad_chest');
        if (a.key === 'royal') needUnlock(p, 'royal');
        if (a.key === 'gem') needUnlock(p, 'gemChest');
        const cur = c.currency || 'coins';
        if ((p[cur] || 0) < c.cost) fail(cur === 'gems' ? 'no_gems' : 'no_coins');
        p[cur] -= c.cost;
        return openChest(p, a.key, rng, now);
      }
      case 'daily': {
        if (!dailyCanClaim(p, now)) fail('claimed');
        p.daily.streak = dailyNext(p, now); p.daily.last = day(now);
        const r = DAILY_REWARDS[p.daily.streak - 1];
        if (r === 'royal') { p.gems += DAY7_GEMS; return { day: p.daily.streak, gems: DAY7_GEMS, chest: openChest(p, 'royal', rng, now) }; }
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
        const coins = x.r[tier], gems = achGems(tier); p.ach[x.id] = tier + 1; p.coins += coins; p.gems += gems;
        return { coins, gems };
      }
      case 'exchange': {
        needUnlock(p, 'exchange');
        const g = Math.floor(Number(a.gems));
        if (!(g >= 1 && g <= 100000)) fail('bad_action');
        if (p.gems < g) fail('no_gems');
        const coins = g * gemRate(p);
        p.gems -= g; p.coins += coins;
        return { gems: g, coins };
      }
      case 'faction': {
        const id = String(a.id || '');
        if (!E.BASE_HEROES.some(h => h.id === id)) fail('bad_action');
        if (p.faction === id) return { faction: id };
        if (p.faction) {
          if (now - (p.factionAt || 0) < FACTION_SWITCH_DAYS * 864e5) fail('too_soon');
          if (p.gems < FACTION_SWITCH_GEMS) fail('no_gems');
          p.gems -= FACTION_SWITCH_GEMS;
        }
        p.faction = id; p.factionAt = now;
        return { faction: id };
      }
      case 'rookie': {
        const d = a.day | 0;
        if (!p.rookie || !ROOKIE[d] || p.rookie.claimed.includes(d)) fail('claimed');
        if (d >= rookieOpenDays(p, now) || !rookieDayDone(p, d)) fail('not_ready');
        const r = ROOKIE[d];
        p.rookie.claimed.push(d); p.coins += r.coins; p.gems += r.gems;
        let hero = null, level = null;
        if (r.legend) {
          // A Legendary hero you don't have yet; if you own them all, your weakest one gains 3 levels.
          const legends = E.BASE_HEROES.filter(h => h.rarity === 'L'), missing = legends.filter(h => !p.owned[h.id]);
          if (missing.length) { hero = missing[Math.floor(rng() * missing.length)].id; p.owned[hero] = 1; if (p.team.length < 5) p.team.push(hero); }
          else { hero = legends.reduce((a, h) => (p.owned[h.id] < p.owned[a.id] ? h : a), legends[0]).id; p.owned[hero] = Math.min(E.MAX_LEVEL, p.owned[hero] + 3); }
          level = p.owned[hero];
        }
        return { coins: r.coins, gems: r.gems, hero, level };
      }
      case 'share': {
        if (p.shareDay === day(now)) return { gems: 0 };
        p.shareDay = day(now); p.gems += SHARE_GEMS;
        return { gems: SHARE_GEMS };
      }
      case 'warp': {
        needUnlock(p, 'exchange');
        if (p.gems < WARP_COST) fail('no_gems');
        const coins = afkRate(p) * WARP_HOURS;
        p.gems -= WARP_COST; p.coins += coins;
        return { coins };
      }
      case 'fuse': {
        const f = E.FUSIONS.find(x => x.id === a.id);
        if (!f) fail('bad_action');
        if (p.owned[f.id]) fail('claimed');
        const rule = E.FUSION_RULES[f.parts.length];
        needUnlock(p, f.parts.length === 3 ? 'trio' : 'duo');
        if (f.parts.some(id => !p.owned[id])) fail('need_parts');
        if (p.coins < rule.cost) fail('no_coins');
        // Online, the server hands out the next serial number (and refuses when the edition is sold out).
        const serial = ctx.mint ? ctx.mint(f.id, rule.supply) : null;
        // The heroes are kept; the new card starts at their average level.
        p.coins -= rule.cost; p.owned[f.id] = E.fusionStartLevel(p.owned, f.parts);
        if (serial) p.serials[f.id] = serial;
        track(p, 'fusions', 1, now);
        return { id: f.id, serial, supply: rule.supply, level: p.owned[f.id] };
      }
      case 'stageStart': {
        const idx = a.stage | 0;
        if (idx < 0 || idx >= E.TOTAL_STAGES || idx > p.cleared) fail('locked');
        if (!p.team.length) fail('bad_team');
        const seed = Math.floor(rng() * 2 ** 32) >>> 0;
        // Today's market, territory and battle cry are frozen into the battle so the replay (and the coins)
        // match what the player saw.
        const boosts = marketBoosts(ctx.market), market = Object.fromEntries(Object.entries(boosts).filter(([id]) => p.team.some(t => t === id || (E.HERO_BY_ID[t].fusion && E.HERO_BY_ID[t].parts.includes(id)))));
        const com = ctx.community || {}, cry = p.faction ? com.cry || null : null;
        if (cry === 'might') market[p.faction] = +((market[p.faction] || 1) * COMMUNITY.CRIES.might.power).toFixed(4);
        const dip = marketCoinBonus(ctx.market, p.team);
        const terr = p.faction && com.owners && com.owners[Math.floor(idx / E.STAGES_PER_WORLD)] === p.faction ? COMMUNITY.TERRITORY_BONUS : 0;
        const gold = cry === 'gold' ? COMMUNITY.CRIES.gold.coins : 0;
        const perks = perksOf(p), weekend = eventOf(now) === 'coins' ? EVENT_FX.coins : 0;
        p.pending = { stage: idx, seed, team: [...p.team], levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), faction: p.faction || null,
          market, perks, dip, extra: +(dip + terr + gold + (perks.coins || 0) + weekend).toFixed(4), at: now };
        return { seed, market, perks, dip, terr, gold, weekend };
      }
      case 'stageEnd': {
        const pd = p.pending;
        if (!pd) fail('no_battle');
        p.pending = null;
        const r = E.replayStage(pd.team, pd.levels, pd.stage, pd.seed, a.inputs, pd.faction || null, pd.market || null, pd.perks || null);
        if (r.skills) track(p, 'skills', r.skills, now);
        if (r.result !== 'win') { p.stats.losses++; return { result: r.result, stage: pd.stage }; }
        const first = pd.stage === p.cleared;
        const coins = stageCoins(p, pd.stage, pd.team, (pd.extra !== undefined ? pd.extra : pd.dip) || 0);
        if (first) p.cleared = Math.min(E.TOTAL_STAGES, p.cleared + 1);
        else p.replays[pd.stage] = (p.replays[pd.stage] || 0) + 1;
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

  return { ROOKIE, rookieStat, rookieOpenDays, rookieDayDone, rookieActive, SET_LEVEL, SETS, setDone, perksOf, STAR_LEVELS, starsOf, EVENTS, EVENT_FX, eventOf, COMMUNITY, MOODS, moodOf, marketBoosts, marketCoinBonus, FACTION_SWITCH_GEMS, FACTION_SWITCH_DAYS, FACTION_UPGRADE_DISCOUNT, FACTION_CHEST_WEIGHT, SHARE_GEMS, upgradePrice, UNLOCKS, unlocked, START_GEMS, DAY7_GEMS, WARP_COST, WARP_HOURS, gemRate, achGems, AI_DAILY, AI_LEVELS, aiLeft, aiReward, migrateIds, HOLO_CHANCE, CHESTS, DAILY_QUESTS, ACHIEVEMENTS, DAILY_REWARDS, AFK_CAP_H, KEYS, newProfile, normalize, pickKeys, day, ensureDQ, track,
    dqReward, dailyCanClaim, dailyNext, afkRate, afkAmount, achTier, coinBonus, replayFactor, stageCoins, teamPower, claimable, act, importLocal };
});
