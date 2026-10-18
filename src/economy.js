// Gram Legends — economy rules (coins, heroes, chests, quests, stages).
// Shared code: runs in the browser for offline play and on the server, which is the source of truth online.
(function (root, factory) {
  if (typeof module !== 'undefined') module.exports = factory(require('./engine.js'));
  // In the browser engine.js declares top-level consts (not window properties), so pass them explicitly.
  else root.ECON = factory({ STAGES_PER_WORLD, STARTERS, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, fusionStartLevel, LEGACY_FUSION_IDS, teamError, duosWithin, factionMult, marketMult, HERO_BY_ID, MAX_LEVEL, TOTAL_STAGES, COIN_BONUS, heroStats, upgradeCost, stageReward, replayStage, deckSynergies });
})(typeof self !== 'undefined' ? self : this, function (E) {
  const CHESTS = {
    basic: { cost: 300, rates: { C: 55, R: 32, E: 11, L: 2 } },
    royal: { cost: 1200, rates: { C: 0, R: 50, E: 38, L: 12 } },
    gem: { cost: 100, currency: 'gems', rates: { C: 0, R: 20, E: 55, L: 25 }, holo: 0.12 },
  };
  // Gem chest pity: at most GEM_PITY gem chests in a row without a Legendary (the last one is always Legendary).
  const GEM_PITY = 8;
  // Duplicates turn into shards of that card (shown as coins of upgrade credit): DUPE_VALUE[chest] × SHARD_RARITY[rarity].
  // Shards pay for that card's upgrades first, and level it up on the spot while they cover the next level,
  // so low-level duplicates still feel like a level-up while chests stay fair against upgrading with coins.
  const DUPE_VALUE = { basic: 250, royal: 900, gem: 1500 }, SHARD_RARITY = { C: 1, R: 1.2, E: 1.5, L: 2 };
  // Idle chest, AI duels and the world boss pay by progress — the normal (non-boss) reward of the last cleared stage,
  // so clearing a boss (×3 stage) never lowers them.
  const progressReward = p => 80 + 25 * Math.max(0, (p.cleared || 0) - 1);
  // Gems: the rare currency. Earned slowly (achievements, day-7 reward, arena, AI, clan chest) or bought with Stars.
  // One-way exchange to coins at a rate that grows with progress; coins can never become gems.
  const START_GEMS = 20, DAY7_GEMS = 15, WARP_COST = 30, WARP_HOURS = 4;
  const gemRate = p => Math.round(50 * (1 + p.cleared / 25));
  const achGems = tier => 5 * (tier + 1);
  // Features open up as the player clears stages (value = stages cleared, i.e. 10 = reached world 2).
  // Joining a friend's duel or clan from an invite is always allowed, so invite links work for new players.
  // New players see a few things at a time: the season pass after 5 stages, the community war in world 2, the world
  // boss after 15 stages, saved decks, collection sets and achievements in world 3 (their progress counts from day one);
  // the daily challenge opens in world 2 and the endless tower in world 3.
  // Book of Legends (the comic): chapter k opens once COMIC_UNLOCK[k-1] stages are cleared; the first read pays gems.
  const COMIC_UNLOCK = [1, 10, 30, 50, 70], COMIC_GEMS = 10;
  const comicOpen = (p, ch) => (p.cleared || 0) >= COMIC_UNLOCK[ch - 1];
  const UNLOCKS = { pass: 5, royal: 10, ai: 10, war: 10, challenge: 10, raid: 15, tower: 20, pvp: 20, exchange: 20, decks: 20, sets: 20, ach: 20, duo: 30, gemChest: 40, clan: 40, trio: 70 };
  const unlocked = (p, key) => (p.cleared || 0) >= UNLOCKS[key];
  const needUnlock = (p, key) => { if (!unlocked(p, key)) fail('locked_feature'); };
  // AI duels: no stake; the first AI_DAILY wins each day pay a reward based on progress.
  const AI_DAILY = 5;
  // Coin duels: both players pay the same entry; the winner gets the prize = both entries minus a PVP_CUT house
  // share (a coin sink, so duels can't be used to move coins between accounts for free). A draw refunds both.
  // Quick match only pairs decks within PVP_GAP× power (PVP_GAP_LATE× after waiting PVP_WAIT_MS), and the same
  // two players can play at most PVP_PAIR_DAILY coin duels a day.
  const PVP_CUT = 0.1, PVP_GAP = 1.5, PVP_GAP_LATE = 2, PVP_WAIT_MS = 30e3, PVP_PAIR_DAILY = 5;
  // Trio alliance cards: each 30-day season from launch mints one more edition (30 more copies of every trio),
  // so they stay rare but never sell out for good. Duo editions are fixed.
  const LAUNCH = Date.UTC(2026, 9, 1);
  const fusionSupply = (parts, now = Date.now()) => E.FUSION_RULES[parts].supply * (parts === 3 ? 1 + Math.max(0, seasonOf(now) - seasonOf(LAUNCH)) : 1);
  const pvpPrize = stake => Math.floor(stake * 2 * (1 - PVP_CUT));
  // Alliance cards (fusions): the leader is shown big. The player picks it when crafting and can change it;
  // by default it is their own community's hero when that hero is part of the card.
  const leaderOf = (p, id) => {
    const f = E.HERO_BY_ID[id]; if (!f || !f.fusion) return id;
    const l = p.leaders && p.leaders[id];
    return l && f.parts.includes(l) ? l : f.parts.includes(p.faction) ? p.faction : f.parts[0];
  };
  // Community milestones (bronze..diamond) make the community's own card stronger: +2% power per tier.
  const MASCOT_PER_TIER = 0.02;
  // Card frames: purely cosmetic (no power). Bought with gems or Telegram Stars, or earned (invites, arena league).
  const COSMETICS = {
    neon: { ico: '💜', gems: 300 }, frost: { ico: '❄️', gems: 600 },
    gold: { ico: '👑', stars: 100 }, galaxy: { ico: '🌌', stars: 175 }, fire: { ico: '🔥', stars: 250 },
    friend: { ico: '🤝', earn: 'ref' }, legend: { ico: '🏆', earn: 'league' },
  };
  const giveCosmetic = (p, id) => { p.cos = p.cos || { own: [], on: null }; if (!p.cos.own.includes(id)) p.cos.own.push(id); if (!p.cos.on) p.cos.on = id; };
  // Featured hero of the week: shown on the chest screen and much likelier to drop from every chest.
  const FEATURED_CHANCE = { basic: 0.06, royal: 0.1, gem: 0.15 };
  const featuredOf = now => { const ids = E.BASE_HEROES.map(h => h.id), w = Math.floor((now - Date.UTC(2026, 0, 5)) / (7 * 864e5)); return ids[((w * 5) % ids.length + ids.length) % ids.length]; };
  // Official alliances (real projects working together, approved by the admin): [{a, b, pct, until}].
  // Every alliance card holding both communities gets +pct% power while the alliance lasts → { cardId: mult }.
  const ALLY_DEFAULT = { pct: 10, days: 30 }, ALLY_SHARE = 0.5;
  function allianceBoosts(list, now = Date.now()) {
    const out = {};
    for (const x of list || []) {
      if (!x || x.until <= now) continue;
      for (const f of E.FUSIONS) if (f.parts.includes(x.a) && f.parts.includes(x.b)) out[f.id] = Math.max(out[f.id] || 1, 1 + x.pct / 100);
    }
    return out;
  }
  // Season pass: 30-day seasons, 30 tiers. Playing earns XP; each tier has a free reward and a premium one
  // (premium is unlocked with Telegram Stars for the current season).
  const PASS = { DAYS: 30, EPOCH: Date.UTC(2026, 0, 1), TIERS: 30, XP_PER_TIER: 150, PRICE_STARS: 250,
    XP: { stage: 10, first: 20, ai: 10, pvp: 25, quest: 15, daily: 20, ach: 30 } };
  const seasonOf = now => Math.floor((now - PASS.EPOCH) / (PASS.DAYS * 864e5));
  const seasonEnds = now => PASS.EPOCH + (seasonOf(now) + 1) * PASS.DAYS * 864e5;
  // Premium: gems on every tier plus coins, more gems every 5th tier and a Gem Chest every 10th.
  const passReward = (tier, track) => track === 'prem'
    ? (tier % 10 === 0 ? { chest: 'gem', gems: 50 } : tier % 5 === 0 ? { gems: 40 } : { gems: 10, coins: 500 + tier * 150 })
    : (tier % 10 === 0 ? { chest: 'royal' } : tier % 5 === 0 ? { gems: 5 } : { coins: 300 + tier * 100 });
  function passOf(p, now) {
    const s = seasonOf(now);
    if (!p.pass || p.pass.s !== s) p.pass = { s, xp: 0, prem: false, cf: [], cp: [] };
    return p.pass;
  }
  const passTier = (p, now) => Math.min(PASS.TIERS, Math.floor(passOf(p, now).xp / PASS.XP_PER_TIER));
  const addPassXp = (p, xp, now) => { passOf(p, now).xp += xp; };
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
  // Every hero is in two sets. Each set has three tiers: all four heroes at level 10 / 30 / 60 → its bonus ×1 / ×1.5 / ×2.
  const SETS = [
    { id: 'ocean', ico: '🌊', heroes: ['utya', 'pengu', 'babyshark', 'dog'], perk: { hp: 0.05 } },
    { id: 'crystal', ico: '💎', heroes: ['egor', 'memegram', 'yoda', 'gramcat'], perk: { atk: 0.05 } },
    { id: 'neon', ico: '🌃', heroes: ['pinkbull', 'notcoin', 'volya', 'teddy'], perk: { coins: 0.10 } },
    { id: 'shadow', ico: '🌿', heroes: ['paws', 'noctis', 'virus', 'yaya'], perk: { energy: 25 } },
    { id: 'beasts', ico: '🐾', heroes: ['pinkbull', 'paws', 'dog', 'teddy'], perk: { hp: 0.04 } },
    { id: 'legends', ico: '👑', heroes: ['notcoin', 'volya', 'noctis', 'yoda'], perk: { atk: 0.04 } },
    { id: 'frost', ico: '❄️', heroes: ['utya', 'pengu', 'gramcat', 'babyshark'], perk: { energy: 15 } },
    { id: 'mystic', ico: '🔮', heroes: ['virus', 'memegram', 'yaya', 'egor'], perk: { coins: 0.08 } },
  ];
  const SET_TIERS = [10, 30, 60], SET_MULT = [0, 1, 1.5, 2];
  const setTier = (p, s) => SET_TIERS.filter(l => s.heroes.every(id => (p.owned[id] || 0) >= l)).length;
  const setDone = (p, s) => setTier(p, s) >= 1;
  const perksOf = p => SETS.reduce((a, s) => { const m = SET_MULT[setTier(p, s)]; if (m) for (const [k, v] of Object.entries(s.perk)) a[k] = +((a[k] || 0) + v * m).toFixed(4); return a; }, {});
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
  // sets today's mood. It never changes card power (a token's price must not decide battles); down days pay a
  // "dip bonus" of extra stage coins while the card is in your team.
  const MOODS = [
    { key: 'moon', min: 10, power: 1, coins: 0 },
    { key: 'bull', min: 2, power: 1, coins: 0 },
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
  // Coins still needed for the next level once this card's shards are used.
  const upgradeCoins = (p, id, lv = p.owned[id], now = Date.now()) => Math.max(0, upgradePrice(p, id, lv, now) - ((p.shards && p.shards[id]) || 0));
  const AI_LEVELS = { easy: { power: 0.8, coins: 0.5, gems: 0 }, normal: { power: 1, coins: 1, gems: 0 }, hard: { power: 1.25, coins: 2, gems: 1 } };
  const aiLeft = (p, now) => (p.aiDay && p.aiDay.date === day(now) ? Math.max(0, AI_DAILY - p.aiDay.wins) : AI_DAILY);
  // (a ghost duel — a real player's saved deck — pays like Normal)
  const aiReward = (p, level, now = Date.now()) => { const L = AI_LEVELS[level] || AI_LEVELS.normal; return { coins: Math.round(progressReward(p) * L.coins * (eventOf(now) === 'ai' ? EVENT_FX.ai : 1)), gems: L.gems }; };
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
    { id: 'sets', stat: p => SETS.reduce((a, s) => a + setTier(p, s), 0), tiers: [1, 4, 8, 16, 24], r: [500, 2000, 6000, 20000, 60000] },
    { id: 'stars', stat: p => E.BASE_HEROES.reduce((a, h) => a + starsOf(p.owned[h.id]), 0), tiers: [10, 30, 60, 80], r: [1000, 5000, 20000, 60000] },
    { id: 'awaken', stat: p => E.BASE_HEROES.filter(h => (p.owned[h.id] || 0) >= E.MAX_LEVEL).length, tiers: [1, 4, 16], r: [20000, 60000, 200000] },
    { id: 'holo', stat: p => Object.keys(p.holo || {}).length, tiers: [1, 4, 10, 16], r: [500, 1500, 4000, 10000] },
    { id: 'alliance', stat: p => Object.keys(p.owned).filter(id => E.HERO_BY_ID[id] && E.HERO_BY_ID[id].fusion).length, tiers: [1, 5, 20, 60], r: [1000, 4000, 15000, 50000] },
    { id: 'boss', stat: p => p.stats.bosses || 0, tiers: [5, 20, 50, 100], r: [1000, 4000, 12000, 30000] },
    { id: 'upgrade', stat: p => p.stats.upgrades || 0, tiers: [20, 100, 500, 1500], r: [500, 2500, 10000, 30000] },
    { id: 'login', stat: p => p.stats.logins || 0, tiers: [7, 30, 100, 365], r: [1000, 5000, 20000, 80000] },
    { id: 'pvp', stat: p => p.stats.pvpWins || 0, tiers: [5, 25, 100, 300], r: [800, 3000, 10000, 30000] },
    { id: 'ai', stat: p => p.stats.aiWins || 0, tiers: [5, 25, 100], r: [500, 2000, 8000] },
    { id: 'league', stat: p => p.stats.leagueBest || 0, tiers: [1, 2, 3, 4], r: [1000, 4000, 12000, 40000] },
    { id: 'raid', stat: p => p.stats.raidDmg || 0, tiers: [1e5, 1e6, 1e7, 1e8], r: [1000, 5000, 20000, 80000] },
    { id: 'raidKill', stat: p => p.stats.raidKills || 0, tiers: [1, 5, 20], r: [1000, 5000, 20000] },
    { id: 'friends', stat: p => p.stats.refs || 0, tiers: [1, 5, 20], r: [1000, 5000, 20000] },
    { id: 'partner', stat: p => p.stats.partners || 0, tiers: [1, 5, 15], r: [300, 1500, 5000] },
  ];
  const DAILY_REWARDS = [200, 300, 400, 500, 700, 900, 'royal'];
  const AFK_CAP_H = 8;
  // One-time starter pack, and the monthly Gram Club (Telegram Stars subscription): daily gems + a bigger idle chest.
  const STARTER = { stars: 99, gems: 500, coins: 30000 };
  const CLUB = { stars: 300, days: 30, gems: 15, afkH: 12 };
  const clubActive = (p, now) => !!(p.club && p.club.until > now);
  const afkCap = (p, now = Date.now()) => (clubActive(p, now) ? CLUB.afkH : AFK_CAP_H);
  // Playing a stage by hand (Auto never switched on, at least one skill used) pays MANUAL_BONUS more coins.
  const MANUAL_BONUS = 0.25;
  // Stage stars: ★ win · ★★ no card lost · ★★★ also played by hand (no Auto) and won within STAR_TIME battle seconds.
  // Stars of a world open its world chest in three steps (STAR_CHEST stars).
  const STAR_TIME = 30, STAR_CHEST = [10, 20, 30];
  const starsFor = (r, manual) => (r.result !== 'win' ? 0 : 1 + (r.lost && r.lost.length ? 0 : 1) + (r.lost && !r.lost.length && manual && r.time <= STAR_TIME ? 1 : 0));
  const worldStars = (p, w) => { let k = 0; for (let i = w * E.STAGES_PER_WORLD; i < (w + 1) * E.STAGES_PER_WORLD; i++) k += (p.stars && p.stars[i]) || 0; return k; };
  const starChestReward = (w, tier) => [{ coins: E.stageReward(w * E.STAGES_PER_WORLD + 9) * 2 }, { coins: E.stageReward(w * E.STAGES_PER_WORLD + 9) * 3, gems: 10 }, { gems: 20, chest: 'royal' }][tier];
  // Hard mode: a world you finished can be played again with much stronger enemies; only the first clear pays.
  const HARD = { mult: 1.8, coins: 3, bossGems: 5 };
  const hardOpen = (p, idx) => idx >= 0 && idx < Math.floor((p.cleared || 0) / E.STAGES_PER_WORLD) * E.STAGES_PER_WORLD && idx <= (p.hard || 0);
  // Treasure goblin: catching it pays GOBLIN_COINS × the stage reward (and sometimes a gem).
  const GOBLIN_COINS = 0.6;
  // Comeback: after COMEBACK_AFTER stage losses in a row the next stage battles get +COMEBACK power until a win.
  const COMEBACK_AFTER = 3, COMEBACK = 0.1;
  // War blitz: every day at BLITZ.hour:00 UTC, for BLITZ.minutes, community-war points count ×BLITZ.mult.
  const BLITZ = { hour: 18, minutes: 30, mult: 3 };
  const blitzWindow = (now, hour = BLITZ.hour) => { const d = new Date(now); const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour); const next = now < start + BLITZ.minutes * 60e3 ? start : start + 864e5; return { on: now >= start && now < start + BLITZ.minutes * 60e3, start: next, end: next + BLITZ.minutes * 60e3 }; };
  // Rewarded video ads (Adsgram): each watched ad pays ADS.hours of idle coins, ADS.daily times a day.
  // The reward is granted by the ad network's server callback (server.js), never by the game client.
  const ADS = { daily: 5, hours: 2 };
  const adsLeft = (p, now) => (p.ads && p.ads.day === day(now) ? Math.max(0, ADS.daily - p.ads.n) : ADS.daily);
  // Streak freeze: once per week (Monday–Sunday UTC weeks) a single missed day doesn't break the login streak.
  const weekNo = now => Math.floor((Math.floor(now / 864e5) + 3) / 7);
  const HOLO_CHANCE = 0.03; // a chest card has a 3% chance to come out as a shimmering Holo variant (cosmetic)
  const KEYS = ['comic', 'stars', 'starClaims', 'hard', 'lossStreak', 'ads', 'starter', 'club', 'shards', 'pity', 'decks', 'deck', 'avatar', 'cos', 'leaders', 'pass', 'rookie', 'fv', 'faction', 'factionAt', 'shareDay', 'coins', 'gems', 'owned', 'team', 'cleared', 'stats', 'daily', 'dq', 'ach', 'afkSince', 'pending', 'serials', 'holo', 'replays', 'aiDay'];

  function newProfile(now) {
    return { comic: [], stars: {}, starClaims: {}, hard: 0, lossStreak: 0, shards: {}, pity: 0, decks: null, deck: 0, avatar: null, cos: { own: [], on: null }, leaders: {}, rookie: { start: day(now), claimed: [] }, fv: FUSION_VERSION, faction: null, factionAt: 0, shareDay: null, coins: 300, gems: START_GEMS, aiDay: null, owned: Object.fromEntries(E.STARTERS.map(id => [id, 1])), team: [...E.STARTERS], cleared: 0,
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
      p.team = keep.filter(id => Object.prototype.hasOwnProperty.call(E.HERO_BY_ID, id) && p.owned && Object.prototype.hasOwnProperty.call(p.owned, id));
    }
    return { ...d, ...p, stats: { ...d.stats, ...(p.stats || {}) }, daily: { ...d.daily, ...(p.daily || {}) }, dq: { ...d.dq, ...(p.dq || {}) },
      comic: Array.isArray(p.comic) ? p.comic.filter(x => Number.isInteger(x)) : [], ach: { ...(p.ach || {}) }, stars: { ...(p.stars || {}) }, starClaims: { ...(p.starClaims || {}) }, shards: { ...(p.shards || {}) }, serials: { ...(p.serials || {}) }, holo: { ...(p.holo || {}) }, replays: { ...(p.replays || {}) } };
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
  const freezeReady = (p, now) => p.daily.freeze !== weekNo(now);
  const dailyFrozen = (p, now) => p.daily.last === day(now, -2) && p.daily.streak > 0 && freezeReady(p, now);
  const dailyNext = (p, now) => (p.daily.last === day(now, -1) || dailyFrozen(p, now) ? p.daily.streak % 7 + 1 : 1);
  const afkRate = p => Math.round(progressReward(p) * 1.2);
  const afkAmount = (p, now) => Math.floor(Math.min(afkCap(p, now) * 3600e3, now - (p.afkSince || now)) / 3600e3 * afkRate(p));
  const achTier = (p, a) => p.ach[a.id] || 0;
  const coinBonus = team => team.reduce((b, id) => b + (E.COIN_BONUS[id] || 0), 0);
  // First clear pays ×2. Every win on an already-cleared stage pays half of the previous replay (50%, 25%, 12.5%…),
  // so farming old stages dries up and progress comes from new stages, the idle chest, quests and the arena.
  const replayFactor = (p, idx) => (idx < p.cleared ? Math.pow(0.5, (p.replays[idx] || 0) + 1) : 2);
  const stageCoins = (p, idx, team, dip = 0) => Math.floor(E.stageReward(idx) * (1 + coinBonus(team) + dip) * replayFactor(p, idx));
  // Deck power: card stats with community, set perks and deck synergies (start energy counts a little too).
  const teamPower = (p, team = p.team) => {
    const pk = perksOf(p), sy = E.deckSynergies(team).fx;
    return team.reduce((sum, id) => {
      const s0 = E.heroStats(id, p.owned[id] || 1), k = E.factionMult(id, p.faction);
      const hp = s0.hp * k * (1 + (pk.hp || 0)) * (1 + sy.hp), atk = s0.atk * k * (1 + (pk.atk || 0)) * (1 + sy.atk);
      return sum + hp / 10 + atk / s0.spd * 2;
    }, 0) * (1 + sy.energy / 300);
  };

  function claimable(p, now) {
    ensureDQ(p, now);
    let c = dailyCanClaim(p, now) ? 1 : 0;
    if (clubActive(p, now) && p.club.day !== day(now)) c++;
    for (let w = 0; w * E.STAGES_PER_WORLD < Math.min(E.TOTAL_STAGES, (p.cleared || 0) + 1); w++) c += STAR_CHEST.filter((n, i) => i >= ((p.starClaims && p.starClaims[w]) || 0) && worldStars(p, w) >= n).length;
    if (afkAmount(p, now) >= afkRate(p) / 2) c++;
    c += DAILY_QUESTS.filter(q => !p.dq.c[q.id] && (p.dq.p[q.id] || 0) >= q.goal).length;
    if (unlocked(p, 'ach')) c += ACHIEVEMENTS.filter(a => achTier(p, a) < a.tiers.length && a.stat(p) >= a.tiers[achTier(p, a)]).length;
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
    if (key === 'gem' && (p.pity || 0) >= GEM_PITY - 1) rarity = 'L';
    // The very first chest always brings a new hero (of the rolled rarity when one is missing, else any missing one).
    const first = !(p.stats.chests > 0), missing = E.BASE_HEROES.filter(x => !p.owned[x.id] && rates[x.rarity] > 0);
    if (first && missing.length && !missing.some(x => x.rarity === rarity)) rarity = missing[0].rarity;
    // Your community's hero is FACTION_CHEST_WEIGHT times as likely as the others of its rarity.
    const pool = E.HEROES.filter(h => h.rarity === rarity && (!first || !missing.length || !p.owned[h.id])), w = h => (h.id === p.faction ? FACTION_CHEST_WEIGHT : 1);
    let pickW = rng() * pool.reduce((a, h) => a + w(h), 0), h = pool[pool.length - 1];
    for (const x of pool) { if (pickW < w(x)) { h = x; break; } pickW -= w(x); }
    const feat = E.HERO_BY_ID[featuredOf(now)];
    if (rng() < (FEATURED_CHANCE[key] || 0) && !(first && missing.length && p.owned[feat.id]) && !(rarity === 'L' && feat.rarity !== 'L' && key === 'gem' && (p.pity || 0) >= GEM_PITY - 1)) { h = feat; rarity = h.rarity; }
    if (key === 'gem') p.pity = rarity === 'L' ? 0 : (p.pity || 0) + 1;
    track(p, 'chests', 1, now);
    const holo = !p.holo[h.id] && rng() < (c.holo || HOLO_CHANCE);
    if (holo) p.holo[h.id] = true;
    if (!p.owned[h.id]) {
      p.owned[h.id] = 1;
      const added = p.team.length < 5;
      if (added) p.team.push(h.id);
      return { id: h.id, rarity, outcome: 'new', added, holo };
    }
    if (p.owned[h.id] < E.MAX_LEVEL) {
      const shards = Math.round((DUPE_VALUE[key] || DUPE_VALUE.basic) * (SHARD_RARITY[rarity] || 1)), from = p.owned[h.id];
      p.shards = p.shards || {}; p.shards[h.id] = (p.shards[h.id] || 0) + shards;
      while (p.owned[h.id] < E.MAX_LEVEL && p.shards[h.id] >= upgradePrice(p, h.id, p.owned[h.id], now)) { p.shards[h.id] -= upgradePrice(p, h.id, p.owned[h.id], now); p.owned[h.id]++; }
      if (p.owned[h.id] >= E.MAX_LEVEL) delete p.shards[h.id];
      return { id: h.id, rarity, outcome: 'dupe', shards, level: p.owned[h.id], levels: p.owned[h.id] - from, left: (p.shards[h.id] || 0), holo };
    }
    const refund = Math.round(c.cost / 2); p.coins += refund;
    return { id: h.id, rarity, outcome: 'refund', refund, holo };
  }

  // Apply one player action. Mutates p and returns a result; throws on invalid actions.
  // ctx: { now, rng } — the server passes its own clock and RNG.
  // Ids/keys from requests are looked up in plain objects: names like "__proto__" or "constructor" are never valid.
  const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype).concat(['__proto__', 'prototype']));
  const badKey = v => typeof v === 'string' && PROTO_KEYS.has(v);
  function act(p, a, ctx) {
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') fail('bad_action');
    for (const k of ['id', 'key', 'hero', 'leader', 'type']) if (badKey(a[k])) fail('bad_action');
    if (Array.isArray(a.team) && a.team.some(x => typeof x !== 'string' || badKey(x) || !Object.prototype.hasOwnProperty.call(E.HERO_BY_ID, x) || !Object.prototype.hasOwnProperty.call(p.owned, x))) fail('bad_team');
    if (!Number.isFinite(p.coins)) p.coins = 0;
    if (!Number.isFinite(p.gems)) p.gems = 0;
    const { now, rng } = ctx;
    switch (a && a.type) {
      case 'team': {
        const t = Array.isArray(a.team) ? a.team : [];
        if (t.length > 5 || new Set(t).size !== t.length || t.some(id => !p.owned[id])) fail('bad_team');
        const te = E.teamError(t); if (te) fail(te);
        p.team = [...t];
        p.decks = fixDecks(p); p.decks[p.deck || 0] = [...t]; // editing the deck saves it into the active preset
        return {};
      }
      case 'deck': { // switch to one of the DECKS saved decks (an empty one starts as a copy of the current deck)
        const i = Math.floor(Number(a.slot));
        if (!(i >= 0 && i < DECKS)) fail('bad_action');
        p.decks = fixDecks(p);
        if (!p.decks[i] || !p.decks[i].length) p.decks[i] = [...p.team];
        p.deck = i; p.team = [...p.decks[i]];
        return { deck: i };
      }
      case 'upgrade': {
        const lv = p.owned[a.id];
        if (!lv || lv >= E.MAX_LEVEL) fail('cannot_upgrade');
        const cost = upgradePrice(p, a.id, lv, now), sh = Math.min(cost, (p.shards && p.shards[a.id]) || 0);
        if (p.coins < cost - sh) fail('no_coins');
        p.coins -= cost - sh; p.owned[a.id]++; track(p, 'upgrades', 1, now);
        if (sh) { p.shards[a.id] -= sh; if (!p.shards[a.id] || p.owned[a.id] >= E.MAX_LEVEL) delete p.shards[a.id]; }
        return { level: p.owned[a.id], shards: sh };
      }
      case 'avatar': { // profile picture: any card you own (alliance cards show their members together)
        if (!Object.prototype.hasOwnProperty.call(E.HERO_BY_ID, a.id) || !p.owned[a.id]) fail('not_owned');
        p.avatar = a.id;
        return { avatar: a.id };
      }
      case 'cosmetic': { // buy (gems) or equip a frame; null takes it off
        p.cos = p.cos || { own: [], on: null };
        if (a.id === null) { p.cos.on = null; return { on: null }; }
        const c = COSMETICS[a.id];
        if (!c) fail('bad_item');
        if (!p.cos.own.includes(a.id)) {
          if (!c.gems) fail('locked');
          if ((p.gems || 0) < c.gems) fail('no_gems');
          p.gems -= c.gems; p.cos.own.push(a.id);
        }
        p.cos.on = a.id;
        return { on: a.id, own: p.cos.own };
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
        const frozen = dailyFrozen(p, now), next = dailyNext(p, now);
        if (frozen) p.daily.freeze = weekNo(now);
        p.daily.streak = next; p.daily.last = day(now); addPassXp(p, PASS.XP.daily, now); p.stats.logins = (p.stats.logins || 0) + 1;
        const r = DAILY_REWARDS[p.daily.streak - 1];
        if (r === 'royal') { p.gems += DAY7_GEMS; return { day: p.daily.streak, gems: DAY7_GEMS, frozen, chest: openChest(p, 'royal', rng, now) }; }
        p.coins += r;
        return { day: p.daily.streak, coins: r, frozen };
      }
      case 'comic': { // Book of Legends: a chapter read for the first time pays gems once
        const ch = a.ch | 0;
        if (ch < 1 || ch > COMIC_UNLOCK.length || !comicOpen(p, ch)) fail('locked_feature');
        if (p.comic.includes(ch)) fail('not_ready');
        p.comic = [...p.comic, ch]; p.gems += COMIC_GEMS;
        return { ch, gems: COMIC_GEMS };
      }
      case 'starChest': { // world chest opened by stars: tiers at STAR_CHEST stars
        const w = a.world | 0, tier = (p.starClaims[w] || 0);
        if (w < 0 || w >= E.TOTAL_STAGES / E.STAGES_PER_WORLD || tier >= STAR_CHEST.length || worldStars(p, w) < STAR_CHEST[tier]) fail('not_ready');
        p.starClaims[w] = tier + 1;
        const r = starChestReward(w, tier);
        if (r.coins) p.coins += r.coins;
        if (r.gems) p.gems += r.gems;
        return { world: w, tier, ...r, chestResult: r.chest ? openChest(p, r.chest, rng, now) : null };
      }
      case 'club': { // Gram Club members collect their daily gems
        if (!clubActive(p, now)) fail('no_club');
        if (p.club.day === day(now)) fail('claimed');
        p.club.day = day(now); p.gems += CLUB.gems;
        return { gems: CLUB.gems };
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
        const coins = dqReward(p, q); p.dq.c[q.id] = true; p.coins += coins; addPassXp(p, PASS.XP.quest, now);
        return { coins };
      }
      case 'ach': {
        needUnlock(p, 'ach');
        const x = ACHIEVEMENTS.find(y => y.id === a.id);
        if (!x) fail('not_ready');
        const tier = achTier(p, x);
        if (tier >= x.tiers.length || x.stat(p) < x.tiers[tier]) fail('not_ready');
        const coins = x.r[tier], gems = achGems(tier); p.ach[x.id] = tier + 1; p.coins += coins; p.gems += gems; addPassXp(p, PASS.XP.ach, now);
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
      case 'pass': {
        needUnlock(p, 'pass');
        const tier = a.tier | 0, track = a.track === 'prem' ? 'prem' : 'free', ps = passOf(p, now), list = track === 'prem' ? ps.cp : ps.cf;
        if (tier < 1 || tier > PASS.TIERS || tier > passTier(p, now)) fail('not_ready');
        if (track === 'prem' && !ps.prem) fail('no_pass');
        if (list.includes(tier)) fail('claimed');
        list.push(tier);
        const r = passReward(tier, track);
        if (r.coins) p.coins += r.coins;
        if (r.gems) p.gems += r.gems;
        return { tier, track, ...r, chestResult: r.chest ? openChest(p, r.chest, rng, now) : null };
      }
      case 'leader': {
        const f = E.HERO_BY_ID[a.id];
        if (!f || !f.fusion || !p.owned[f.id] || !f.parts.includes(a.hero)) fail('bad_action');
        p.leaders = p.leaders || {}; p.leaders[f.id] = a.hero;
        return { id: f.id, leader: a.hero };
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
        const supply = fusionSupply(f.parts.length, now), serial = ctx.mint ? ctx.mint(f.id, supply) : null;
        // The heroes are kept; the new card starts at their average level.
        p.coins -= rule.cost; p.owned[f.id] = E.fusionStartLevel(p.owned, f.parts);
        if (f.parts.includes(a.leader)) { p.leaders = p.leaders || {}; p.leaders[f.id] = a.leader; }
        if (serial) p.serials[f.id] = serial;
        track(p, 'fusions', 1, now);
        return { id: f.id, serial, supply, level: p.owned[f.id] };
      }
      case 'stageStart': {
        const idx = a.stage | 0, hard = !!a.hard;
        if (idx < 0 || idx >= E.TOTAL_STAGES || idx > p.cleared) fail('locked');
        if (hard && !hardOpen(p, idx)) fail('locked');
        if (!p.team.length) fail('bad_team');
        const seed = Math.floor(rng() * 2 ** 32) >>> 0;
        // Today's market, territory and battle cry are frozen into the battle so the replay (and the coins)
        // match what the player saw.
        const boosts = marketBoosts(ctx.market), market = Object.fromEntries(Object.entries(boosts).filter(([id]) => p.team.some(t => t === id || (E.HERO_BY_ID[t].fusion && E.HERO_BY_ID[t].parts.includes(id)))));
        const com = ctx.community || {}, cry = p.faction ? com.cry || null : null;
        for (const [fid, k] of Object.entries(allianceBoosts(com.allies, now))) if (p.team.includes(fid)) market[fid] = +((market[fid] || 1) * k).toFixed(4);
        if (cry === 'might') market[p.faction] = +((market[p.faction] || 1) * COMMUNITY.CRIES.might.power).toFixed(4);
        const dip = marketCoinBonus(ctx.market, p.team);
        const terr = p.faction && com.owners && com.owners[Math.floor(idx / E.STAGES_PER_WORLD)] === p.faction ? COMMUNITY.TERRITORY_BONUS : 0;
        const gold = cry === 'gold' ? COMMUNITY.CRIES.gold.coins : 0;
        const perks = { ...perksOf(p), ...(com.tier ? { mascot: com.tier * MASCOT_PER_TIER } : {}), ...((p.lossStreak || 0) >= COMEBACK_AFTER ? { comeback: COMEBACK } : {}) }, weekend = eventOf(now) === 'coins' ? EVENT_FX.coins : 0;
        p.pending = { stage: idx, seed, team: [...p.team], levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), faction: p.faction || null,
          market, perks, dip, extra: +(dip + terr + gold + (perks.coins || 0) + weekend).toFixed(4), at: now, ...(hard ? { hard: true } : {}) };
        return { seed, market, perks, dip, terr, gold, weekend, hard, opts: hard ? { enemyMult: HARD.mult } : {} };
      }
      case 'stageEnd': {
        const pd = p.pending;
        if (!pd) fail('no_battle');
        p.pending = null;
        const r = E.replayStage(pd.team, pd.levels, pd.stage, pd.seed, a.inputs, pd.faction || null, pd.market || null, pd.perks || null, pd.hard ? { enemyMult: HARD.mult } : {});
        if (r.skills) track(p, 'skills', r.skills, now);
        const manual = r.skills > 0 && !(Array.isArray(a.inputs) && a.inputs.some(x => Array.isArray(x) && x[1] === -1));
        // the goblin pays even when the fight is lost
        let goblin = null;
        if (r.goblin && r.goblin.caught) { goblin = { coins: Math.round(E.stageReward(pd.stage) * GOBLIN_COINS), gems: r.goblin.gem ? 1 : 0 }; p.coins += goblin.coins; p.gems += goblin.gems; }
        const skill = { perfects: r.perfects, maxChain: r.maxChain, time: r.time, enemyHpLeft: r.enemyHpLeft };
        if (r.result !== 'win') { p.stats.losses++; p.lossStreak = (p.lossStreak || 0) + 1; return { result: r.result, stage: pd.stage, goblin, ...skill, comeback: p.lossStreak >= COMEBACK_AFTER }; }
        p.lossStreak = 0;
        if (pd.hard) {
          const firstHard = pd.stage === (p.hard || 0), boss = pd.stage % E.STAGES_PER_WORLD === E.STAGES_PER_WORLD - 1;
          const coins = firstHard ? Math.floor(E.stageReward(pd.stage) * HARD.coins) : 0, gems = firstHard && boss ? HARD.bossGems : 0;
          if (firstHard) p.hard = (p.hard || 0) + 1;
          p.coins += coins; p.gems += gems; track(p, 'wins', 1, now);
          return { result: 'win', stage: pd.stage, hard: true, coins, gems, first: firstHard, manual, goblin, ...skill };
        }
        const first = pd.stage === p.cleared;
        const stars = starsFor(r, manual), prevStars = (p.stars[pd.stage] || 0);
        if (stars > prevStars) p.stars[pd.stage] = stars;
        const coins = stageCoins(p, pd.stage, pd.team, ((pd.extra !== undefined ? pd.extra : pd.dip) || 0) + (manual ? MANUAL_BONUS : 0));
        if (first) p.cleared = Math.min(E.TOTAL_STAGES, p.cleared + 1);
        else p.replays[pd.stage] = (p.replays[pd.stage] || 0) + 1;
        p.coins += coins;
        addPassXp(p, first ? PASS.XP.first : PASS.XP.stage, now);
        track(p, 'wins', 1, now);
        if (pd.stage % E.STAGES_PER_WORLD === E.STAGES_PER_WORLD - 1) track(p, 'bosses', 1, now);
        return { result: 'win', stage: pd.stage, coins, first, manual, stars, newStars: Math.max(0, stars - prevStars), goblin, ...skill };
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
    p.cleared = 0; // progress is never taken from an offline save (it can be edited); stages are replayed on the server
    return p;
  }

  // Shown next to the player's name everywhere: the chosen card, else their community's hero, else the deck leader.
  // Saved decks: DECKS presets; the active one is p.team. Cards that are gone (or no longer fit) are dropped.
  const DECKS = 5;
  function fixDecks(p) {
    const out = Array.from({ length: DECKS }, (_, i) => {
      const d = Array.isArray(p.decks) && Array.isArray(p.decks[i]) ? p.decks[i] : null;
      if (!d) return null;
      const keep = [];
      for (const id of d) if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(E.HERO_BY_ID, id) && p.owned[id] && !keep.includes(id) && keep.length < 5 && !E.teamError([...keep, id])) keep.push(id);
      return keep;
    });
    if (!out[p.deck || 0]) out[p.deck || 0] = [...(p.team || [])];
    return out;
  }
  const avatarOf = p => (p ? (p.avatar && p.owned && p.owned[p.avatar] ? p.avatar : p.faction || (p.team && p.team[0]) || null) : null);
  return { COMIC_UNLOCK, COMIC_GEMS, comicOpen, STAR_TIME, STAR_CHEST, starsFor, worldStars, starChestReward, HARD, hardOpen, GOBLIN_COINS, COMEBACK_AFTER, COMEBACK, BLITZ, blitzWindow, ADS, adsLeft, STARTER, CLUB, clubActive, afkCap, MANUAL_BONUS, weekNo, freezeReady, dailyFrozen, LAUNCH, fusionSupply, PVP_CUT, PVP_GAP, PVP_GAP_LATE, PVP_WAIT_MS, PVP_PAIR_DAILY, pvpPrize, GEM_PITY, DUPE_VALUE, SHARD_RARITY, progressReward, upgradeCoins, DECKS, fixDecks, avatarOf, COSMETICS, giveCosmetic, FEATURED_CHANCE, featuredOf, leaderOf, MASCOT_PER_TIER, ALLY_DEFAULT, ALLY_SHARE, allianceBoosts, PASS, seasonOf, seasonEnds, passReward, passOf, passTier, addPassXp, ROOKIE, rookieStat, rookieOpenDays, rookieDayDone, rookieActive, SET_LEVEL, SETS, SET_TIERS, SET_MULT, setTier, setDone, perksOf, STAR_LEVELS, starsOf, EVENTS, EVENT_FX, eventOf, COMMUNITY, MOODS, moodOf, marketBoosts, marketCoinBonus, FACTION_SWITCH_GEMS, FACTION_SWITCH_DAYS, FACTION_UPGRADE_DISCOUNT, FACTION_CHEST_WEIGHT, SHARE_GEMS, upgradePrice, UNLOCKS, unlocked, START_GEMS, DAY7_GEMS, WARP_COST, WARP_HOURS, gemRate, achGems, AI_DAILY, AI_LEVELS, aiLeft, aiReward, migrateIds, HOLO_CHANCE, CHESTS, DAILY_QUESTS, ACHIEVEMENTS, DAILY_REWARDS, AFK_CAP_H, KEYS, newProfile, normalize, pickKeys, day, ensureDQ, track,
    dqReward, dailyCanClaim, dailyNext, afkRate, afkAmount, achTier, coinBonus, replayFactor, stageCoins, teamPower, claimable, act, importLocal };
});
