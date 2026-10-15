// TON Legends — Community War: every player backs one of the 16 heroes' communities. Each week they race for
// points (new stage +2, AI win +1, arena win +5; ×2 while the community card is in your team, ×1.5 under the
// "rally" battle cry, ×3 for arena wins over this week's derby rival). Around that race:
//   territories  — each world belongs to the community with the most stage wins in it this week (+15% coins there)
//   derby        — communities are paired by last week's rank; the pair's winner earns extra gems
//   daily goal   — a shared daily win target; everyone who helped reach it claims a small reward
//   milestones   — all-time points unlock bronze/silver/gold/diamond frames for the community card
//   captain      — last week's top member picks this week's battle cry (gold / might / rally)
//   prediction   — guess the weekly winner during the first days; right guesses earn gems
// When the week ends, members of the top communities who helped (MIN_POINTS+) claim a reward.
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const ECON = require('../src/economy.js');

const C = ECON.COMMUNITY;
const MIN_POINTS = 10;
const REWARDS = [{ gems: 30, coins: 5000 }, { gems: 15, coins: 3000 }, { gems: 8, coins: 1500 }];
const REWARD_REST = { gems: 3, coins: 500 };
const FACTIONS = E.BASE_HEROES.map(h => h.id);
const WORLDS = E.WORLDS.length;
const BASE_POINTS = { stageFirst: 2, ai: 1, pvp: 5 };
const MAX_IMAGE = 700 * 1024;

function fail(code) { const e = new Error(code); e.code = 400; throw e; }
// Monday 00:00 UTC after `t` (the week key switches at the same moment).
function weekEnd(t = Date.now()) {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.getTime();
}
// Pairs [a, b] from an ordered list: 1st vs 2nd, 3rd vs 4th, …
function pairUp(order) {
  const out = {};
  for (let i = 0; i + 1 < order.length; i += 2) { out[order[i]] = order[i + 1]; out[order[i + 1]] = order[i]; }
  return out;
}
// First week (no ranking yet): a fixed shuffle seeded by the week key.
function seededOrder(key) {
  let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const a = [...FACTIONS];
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

module.exports = function createWar({ db, persist, weekKey, shareDir, profileOut = () => null, onWeekEnd = () => {} }) {
  db.war = db.war || { week: weekKey(), points: {}, last: null };
  const W = db.war;
  W.terr = W.terr || {}; W.goals = W.goals || {}; W.total = W.total || {}; W.captains = W.captains || {}; W.cries = W.cries || {};
  if (!W.derby) W.derby = pairUp(seededOrder(W.week));

  const today = () => ECON.day(Date.now());
  const sorted = pts => [...FACTIONS].sort((a, b) => (pts[b] || 0) - (pts[a] || 0));
  // Live owner of each world: the community with the most points there (at least TERRITORY_MIN; ties hold nothing).
  function owners(terr = W.terr) {
    const out = {};
    for (let w = 0; w < WORLDS; w++) {
      const t = terr[w] || {}, rank = sorted(t);
      if ((t[rank[0]] || 0) >= C.TERRITORY_MIN && (t[rank[0]] || 0) > (t[rank[1]] || 0)) out[w] = rank[0];
    }
    return out;
  }
  const cryOf = f => (f && W.captains[f] ? W.cries[f] || 'gold' : null);

  function roll() {
    const wk = weekKey();
    if (W.week === wk) return;
    const pts = W.points || {}, rank = sorted(pts);
    const derbyWinners = Object.entries(W.derby).filter(([a, b]) => (pts[a] || 0) > (pts[b] || 0)).map(([a]) => a);
    // Next week's captains: each community's top member of the week that just ended.
    const captains = {};
    for (const u of Object.values(db.users)) {
      const f = u.profile && u.profile.faction;
      if (!f || !u.war || u.war.week !== W.week || u.war.pts < MIN_POINTS) continue;
      if (!captains[f] || u.war.pts > captains[f].pts) captains[f] = { uid: u.id, name: u.name, pts: u.war.pts };
    }
    W.last = { week: W.week, points: pts, rank, owners: owners(), derby: W.derby, derbyWinners };
    W.week = wk; W.points = {}; W.terr = {}; W.cries = {}; W.captains = captains;
    W.derby = pairUp(rank);
    persist();
    onWeekEnd(W.last, captains);
  }
  // A player's points for this week; last week's are kept in u.warLast when the week turns.
  function userWar(u) {
    roll();
    if (!u.war || u.war.week !== W.week) {
      if (u.war && W.last && u.war.week === W.last.week) u.warLast = u.war;
      u.war = { week: W.week, pts: 0 };
    }
    return u.war;
  }
  const hasOwnCard = p => p.team.some(id => id === p.faction || (E.HERO_BY_ID[id] && E.HERO_BY_ID[id].fusion && E.HERO_BY_ID[id].parts.includes(p.faction)));

  // Every win: counts toward the daily goal and (stages) the world's territory; some wins also earn war points.
  function onWin(uid, kind, info = {}) {
    const u = db.users[uid], p = u && u.profile, f = p && p.faction;
    if (!f) return 0;
    const w = userWar(u), d = today();
    const g = W.goals[d] || (W.goals[d] = {});
    g[f] = (g[f] || 0) + 1; u.goalDay = d;
    for (const k of Object.keys(W.goals)) if (k < ECON.day(Date.now(), -2)) delete W.goals[k];
    if (typeof info.stage === 'number') {
      const wi = Math.floor(info.stage / E.STAGES_PER_WORLD), t = W.terr[wi] || (W.terr[wi] = {});
      t[f] = (t[f] || 0) + (kind === 'stageFirst' ? 2 : 1);
    }
    let got = 0;
    const base = BASE_POINTS[kind] || 0;
    if (base) {
      let mult = hasOwnCard(p) ? 2 : 1;
      if (cryOf(f) === 'rally') mult *= C.CRIES.rally.points;
      if (ECON.eventOf(Date.now()) === 'war') mult *= ECON.EVENT_FX.war; // Monday: war day
      const opp = info.vs && db.users[info.vs] && db.users[info.vs].profile;
      if (kind === 'pvp' && opp && opp.faction && W.derby[f] === opp.faction) mult *= C.DERBY_MULT;
      got = Math.round(base * mult);
      w.pts += got;
      W.points[f] = (W.points[f] || 0) + got;
      W.total[f] = (W.total[f] || 0) + got;
    }
    persist();
    return got;
  }
  // Kept for callers that only award points (counts as a win toward the goal).
  const addPoints = (uid, pts) => onWin(uid, pts >= 5 ? 'pvp' : pts >= 2 ? 'stageFirst' : 'ai');

  // Member counts change slowly; recount at most once a minute.
  let counts = {}, countedAt = 0;
  function members() {
    if (Date.now() - countedAt > 60e3) {
      counts = {};
      for (const u of Object.values(db.users)) if (u.profile && u.profile.faction) counts[u.profile.faction] = (counts[u.profile.faction] || 0) + 1;
      countedAt = Date.now();
    }
    return counts;
  }
  const goalTarget = f => Math.max(C.GOAL.min, Math.min(C.GOAL.max, (members()[f] || 0) * C.GOAL.perMember));
  const tierOf = total => C.MILESTONES.filter(m => total >= m).length;
  const predictOpen = () => Date.now() < weekEnd() - (7 - C.PREDICT_DAYS) * 864e5;

  function lastFor(u) {
    const last = W.last;
    if (!last || !u.profile) return null;
    const f = u.profile.faction, place = f ? last.rank.indexOf(f) : -1;
    const myPts = u.warLast && u.warLast.week === last.week ? u.warLast.pts : 0;
    const eligible = !!f && myPts >= MIN_POINTS;
    const derbyWon = !!f && (last.derbyWinners || []).includes(f);
    const predictOk = !!(u.pred && u.pred.week === last.week && u.pred.f === last.rank[0]);
    const base = place >= 0 ? REWARDS[place] || REWARD_REST : { gems: 0, coins: 0 };
    const reward = { gems: (eligible ? base.gems + (derbyWon ? C.DERBY_WIN_GEMS : 0) : 0) + (predictOk ? C.PREDICT_GEMS : 0), coins: eligible ? base.coins : 0 };
    return { week: last.week, place, myPts, eligible, derbyWon, rival: f && last.derby ? last.derby[f] : null, predictOk, predicted: u.pred && u.pred.week === last.week ? u.pred.f : null,
      reward, claimed: u.warClaimed === last.week, claimable: (eligible || predictOk) && u.warClaimed !== last.week,
      top: last.rank.slice(0, 3).map(id => ({ id, pts: last.points[id] || 0 })) };
  }

  function view(u) {
    const p = u.profile, f = p && p.faction, w = p ? userWar(u) : { pts: 0 }, m = members(), pts = W.points, d = today();
    const own = owners();
    const terr = {};
    for (let wi = 0; wi < WORLDS; wi++) { const t = W.terr[wi] || {}, r = sorted(t).filter(x => t[x]).slice(0, 2); terr[wi] = r.map(id => ({ id, pts: t[id] })); }
    const total = f ? W.total[f] || 0 : 0, tier = tierOf(total);
    const cap = f ? W.captains[f] || null : null;
    return {
      week: W.week, endsAt: weekEnd(), min: MIN_POINTS, rewards: REWARDS, rest: REWARD_REST,
      standings: sorted(pts).map(id => ({ id, pts: pts[id] || 0, members: m[id] || 0, worlds: Object.values(own).filter(x => x === id).length })),
      mine: { pts: w.pts, double: !!(f && hasOwnCard(p)) },
      owners: own, terr,
      derby: f ? { rival: W.derby[f], me: pts[f] || 0, them: pts[W.derby[f]] || 0 } : null,
      goal: f ? { target: goalTarget(f), progress: (W.goals[d] || {})[f] || 0, helped: u.goalDay === d, claimed: u.goalClaimed === d } : null,
      milestone: f ? { total, tier, next: C.MILESTONES[tier] || null } : null,
      captain: cap ? { name: cap.name, pts: cap.pts, me: cap.uid === u.id } : null, cry: cryOf(f), cryChosen: !!(f && W.cries[f]),
      predict: { open: predictOpen(), pick: u.pred && u.pred.week === W.week ? u.pred.f : null },
      last: lastFor(u),
    };
  }

  const routes = {
    'POST /api/war/me': (body, u) => view(u),
    'POST /api/war/claim': (body, u) => {
      if (u.profile) userWar(u);
      const l = lastFor(u);
      if (!l) fail('not_ready');
      if (l.claimed) fail('claimed');
      if (!l.claimable) fail('not_ready');
      u.warClaimed = l.week;
      u.profile.coins += l.reward.coins; u.profile.gems += l.reward.gems;
      return { coins: l.reward.coins, gems: l.reward.gems, profile: profileOut(u) };
    },
    'POST /api/war/goal': (body, u) => {
      const p = u.profile, f = p && p.faction, d = today();
      if (!f) fail('not_ready');
      if (u.goalClaimed === d) fail('claimed');
      if (u.goalDay !== d || ((W.goals[d] || {})[f] || 0) < goalTarget(f)) fail('not_ready');
      u.goalClaimed = d;
      p.coins += C.GOAL.coins; p.gems += C.GOAL.gems;
      return { coins: C.GOAL.coins, gems: C.GOAL.gems, profile: profileOut(u), war: view(u) };
    },
    'POST /api/war/cry': (body, u) => {
      const f = u.profile && u.profile.faction;
      roll();
      if (!f || !W.captains[f] || W.captains[f].uid !== u.id) fail('not_captain');
      if (!C.CRIES[body.key]) fail('bad_action');
      W.cries[f] = body.key;
      return { war: view(u) };
    },
    'POST /api/war/predict': (body, u) => {
      roll();
      if (!predictOpen()) fail('predict_closed');
      if (u.pred && u.pred.week === W.week) fail('claimed');
      if (!FACTIONS.includes(body.f)) fail('bad_action');
      u.pred = { week: W.week, f: body.f };
      return { war: view(u) };
    },
    // The share card the client draws (JPEG data URL) — one file per player, overwritten each time.
    'POST /api/share': async (body, u) => {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || ''));
      if (!m) fail('bad_image');
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length > MAX_IMAGE || buf[0] !== 0xff || buf[1] !== 0xd8) fail('bad_image');
      await fs.promises.mkdir(shareDir, { recursive: true });
      await fs.promises.writeFile(path.join(shareDir, `${u.id}.jpg`), buf);
      return { path: `share/${u.id}.jpg?v=${Date.now().toString(36)}` };
    },
  };
  // What a stage battle needs from the war (frozen into the battle by economy.js).
  const community = p => { roll(); return { owners: owners(), cry: cryOf(p && p.faction) }; };
  return { routes, onWin, addPoints, roll, userWar, community, owners, MIN_POINTS, REWARDS };
};
module.exports.weekEnd = weekEnd;
module.exports.pairUp = pairUp;
