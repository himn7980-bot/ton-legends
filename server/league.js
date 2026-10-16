// Gram Legends — ranked arena league. Quick-match duels (not private rooms or the AI) move an Elo rating;
// the rating sets the tier (Bronze → Legend) and who you are matched against. Seasons follow the season pass
// (30 days): the best tier reached pays gems next season (Legend also unlocks the Legend card frame), and
// ratings are pulled halfway back to the start.
const ECON = require('../src/economy.js');

const START = 1000, K = 32;
const TIERS = [
  { id: 'bronze', min: 0, gems: 10 }, { id: 'silver', min: 1100, gems: 30 }, { id: 'gold', min: 1250, gems: 60 },
  { id: 'diamond', min: 1400, gems: 120 }, { id: 'legend', min: 1600, gems: 250, frame: 'legend' },
];
const tierOf = r => [...TIERS].reverse().find(t => r >= t.min);

module.exports = function createLeague({ db, persist, profileOut }) {
  const season = () => ECON.seasonOf(Date.now());
  // Each player: { s: season, r: rating, best: tier id, w, l, prev: { s, best } (unclaimed reward) }
  function rec(u) {
    const s = season();
    let L = u.league;
    if (!L) L = u.league = { s, r: START, best: 'bronze', w: 0, l: 0 };
    if (L.s !== s) {
      if (L.w + L.l > 0) L.prev = { s: L.s, best: L.best, claimed: false };
      L.s = s; L.r = Math.round(START + (L.r - START) / 2); L.best = tierOf(L.r).id; L.w = 0; L.l = 0;
    }
    return L;
  }
  const ratingOf = uid => { const u = db.users[uid]; return u ? rec(u).r : START; };
  // score: 1 = a won, 0 = b won, 0.5 = draw. Returns { [uid]: { r, delta, tier } }.
  function result(aUid, bUid, score) {
    const A = db.users[aUid], B = db.users[bUid];
    if (!A || !B) return {};
    const la = rec(A), lb = rec(B), ea = 1 / (1 + Math.pow(10, (lb.r - la.r) / 400));
    const da = Math.round(K * (score - ea)), out = {};
    for (const [u, L, d, won] of [[A, la, da, score === 1], [B, lb, -da, score === 0]]) {
      L.r = Math.max(0, L.r + d);
      if (score !== 0.5) { if (won) L.w++; else L.l++; }
      const t = tierOf(L.r);
      if (TIERS.findIndex(x => x.id === t.id) > TIERS.findIndex(x => x.id === L.best)) L.best = t.id;
      if (u.profile) u.profile.stats.leagueBest = Math.max(u.profile.stats.leagueBest || 0, TIERS.findIndex(x => x.id === t.id));
      out[u.id] = { r: L.r, delta: d, tier: t.id };
    }
    persist();
    return out;
  }
  function view(u) {
    const L = rec(u), t = tierOf(L.r), i = TIERS.indexOf(t), next = TIERS[i + 1] || null;
    const players = Object.values(db.users).filter(x => x.league && x.league.s === L.s && x.league.w + x.league.l > 0)
      .sort((a, b) => b.league.r - a.league.r);
    return {
      season: L.s, ends: ECON.seasonEnds(Date.now()), r: L.r, tier: t.id, best: L.best, w: L.w, l: L.l,
      next: next ? { id: next.id, at: next.min } : null, tiers: TIERS,
      prev: L.prev && !L.prev.claimed ? { s: L.prev.s, best: L.prev.best, gems: TIERS.find(x => x.id === L.prev.best).gems } : null,
      rank: players.findIndex(x => x.id === u.id) + 1 || null,
      top: players.slice(0, 20).map(x => ({ name: x.name || 'Player', av: ECON.avatarOf(x.profile), r: x.league.r, tier: tierOf(x.league.r).id, me: x.id === u.id })),
    };
  }
  const fail = c => { throw Object.assign(new Error(c), { code: 400 }); };
  const routes = {
    'POST /api/league/me': (body, u) => ({ league: view(u) }),
    'POST /api/league/claim': (body, u) => {
      const L = rec(u);
      if (!u.profile) fail('no_profile');
      if (!L.prev || L.prev.claimed) fail('not_ready');
      const t = TIERS.find(x => x.id === L.prev.best);
      L.prev.claimed = true;
      u.profile.gems = (u.profile.gems || 0) + t.gems;
      if (t.frame) ECON.giveCosmetic(u.profile, t.frame);
      persist();
      return { gems: t.gems, frame: t.frame || null, league: view(u), profile: profileOut(u) };
    },
  };
  return { ratingOf, result, view, routes, tierOf, TIERS, START };
};
