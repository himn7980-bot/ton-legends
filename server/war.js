// TON Legends — Community War: every player backs one of the 16 heroes' communities. Each week the communities
// race for points (new stage +2, AI win +1, arena win +5 — doubled when your community's card is in your team).
// When the week ends, members of the top communities who helped (MIN_POINTS+) claim a reward.
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');

const MIN_POINTS = 10;
const REWARDS = [{ gems: 30, coins: 5000 }, { gems: 15, coins: 3000 }, { gems: 8, coins: 1500 }];
const REWARD_REST = { gems: 3, coins: 500 };
const FACTIONS = E.BASE_HEROES.map(h => h.id);
const MAX_IMAGE = 700 * 1024;

function fail(code) { const e = new Error(code); e.code = 400; throw e; }
// Monday 00:00 UTC after `t` (the week key switches at the same moment).
function weekEnd(t = Date.now()) {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.getTime();
}

module.exports = function createWar({ db, persist, weekKey, shareDir, profileOut = () => null, onWeekEnd = () => {} }) {
  db.war = db.war || { week: weekKey(), points: {}, last: null };

  function roll() {
    const wk = weekKey();
    if (db.war.week === wk) return;
    const pts = db.war.points || {};
    const rank = [...FACTIONS].sort((a, b) => (pts[b] || 0) - (pts[a] || 0));
    db.war.last = { week: db.war.week, points: pts, rank };
    db.war.week = wk; db.war.points = {};
    persist();
    onWeekEnd(db.war.last);
  }
  // A player's points for this week; last week's are kept in u.warLast when the week turns.
  function userWar(u) {
    roll();
    if (!u.war || u.war.week !== db.war.week) {
      if (u.war && db.war.last && u.war.week === db.war.last.week) u.warLast = u.war;
      u.war = { week: db.war.week, pts: 0 };
    }
    return u.war;
  }
  const hasOwnCard = p => p.team.some(id => id === p.faction || (E.HERO_BY_ID[id] && E.HERO_BY_ID[id].fusion && E.HERO_BY_ID[id].parts.includes(p.faction)));

  function addPoints(uid, pts) {
    const u = db.users[uid], p = u && u.profile;
    if (!p || !p.faction) return;
    const w = userWar(u), got = pts * (hasOwnCard(p) ? 2 : 1);
    w.pts += got;
    db.war.points[p.faction] = (db.war.points[p.faction] || 0) + got;
    persist();
  }

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
  function lastFor(u) {
    const last = db.war.last;
    if (!last || !u.profile || !u.profile.faction) return null;
    const place = last.rank.indexOf(u.profile.faction);
    const myPts = u.warLast && u.warLast.week === last.week ? u.warLast.pts : 0;
    return { week: last.week, place, myPts, reward: REWARDS[place] || REWARD_REST, eligible: myPts >= MIN_POINTS, claimed: u.warClaimed === last.week,
      top: last.rank.slice(0, 3).map(id => ({ id, pts: last.points[id] || 0 })) };
  }

  const routes = {
    'POST /api/war/me': (body, u) => {
      const w = u.profile ? userWar(u) : { pts: 0 }, m = members(), pts = db.war.points;
      return { week: db.war.week, endsAt: weekEnd(), min: MIN_POINTS, rewards: REWARDS, rest: REWARD_REST,
        standings: [...FACTIONS].sort((a, b) => (pts[b] || 0) - (pts[a] || 0) || (m[b] || 0) - (m[a] || 0)).map(id => ({ id, pts: pts[id] || 0, members: m[id] || 0 })),
        mine: { pts: w.pts, double: !!(u.profile && u.profile.faction && hasOwnCard(u.profile)) }, last: lastFor(u) };
    },
    'POST /api/war/claim': (body, u) => {
      if (u.profile) userWar(u);
      const l = lastFor(u);
      if (!l) fail('not_ready');
      if (l.claimed) fail('claimed');
      if (!l.eligible) fail('not_ready');
      u.warClaimed = l.week;
      u.profile.coins += l.reward.coins; u.profile.gems += l.reward.gems;
      return { coins: l.reward.coins, gems: l.reward.gems, profile: profileOut(u) };
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
  return { routes, addPoints, roll, userWar, MIN_POINTS, REWARDS };
};
module.exports.weekEnd = weekEnd;
