// TON Legends — clans: create/join/leave, weekly shared points, weekly clan chest, top clans.
// Points: new stage +2, AI win +1, arena win +5 (added via addPoints from the game server).
const crypto = require('crypto');
const ECON = require('../src/economy.js');

const MAX_MEMBERS = 30;
const CREATE_COST = 2000;
const EMBLEMS = ['🛡️', '⚔️', '🐉', '🦁', '🐺', '🦅', '🔥', '❄️', '⚡', '🌙', '💎', '👑', '🚀', '🌊', '🍀', '💀'];
// Weekly chest per member, chosen by the clan's points of the previous week.
const CHEST_TIERS = [
  { min: 1000, gems: 60, coins: 15000 },
  { min: 300, gems: 25, coins: 5000 },
  { min: 100, gems: 10, coins: 2000 },
  { min: 25, gems: 3, coins: 500 },
];

function fail(code) { const e = new Error(code); e.code = 400; throw e; }
// ISO-like week key (UTC), e.g. "2026-W41".
function weekKey(t = Date.now()) {
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const tierFor = pts => CHEST_TIERS.find(t => pts >= t.min) || null;
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

module.exports = function createClans({ db, persist, profileOut = () => null }) {
  db.clans = db.clans || {};

  // Roll the week over: this week's points become "last week" (which decides the chest), contributions reset.
  function roll(c) {
    const wk = weekKey();
    if (c.week !== wk) {
      c.last = { week: c.week || null, points: c.week ? c.points || 0 : 0, claimed: [] };
      c.week = wk; c.points = 0; c.contrib = {};
    }
    return c;
  }
  const clanOf = u => (u.clanId && db.clans[u.clanId] ? roll(db.clans[u.clanId]) : null);
  const summary = c => ({ id: c.id, name: c.name, emblem: c.emblem, members: c.members.length, points: c.points });
  function view(c, u) {
    roll(c);
    const tier = tierFor(c.last.points);
    return { ...summary(c), leader: c.leader, me: u.id, lastPoints: c.last.points,
      chest: tier ? { ...tier, claimed: c.last.claimed.includes(u.id) } : null, tiers: CHEST_TIERS, max: MAX_MEMBERS,
      list: c.members.map(id => { const m = db.users[id] || {}; return { id, name: m.name || '?', stage: m.profile ? m.profile.cleared : 0, pts: c.contrib[id] || 0 }; })
        .sort((a, b) => b.pts - a.pts || b.stage - a.stage) };
  }
  function leave(u) {
    const c = clanOf(u);
    if (!c) return;
    c.members = c.members.filter(id => id !== u.id);
    u.clanId = null;
    if (!c.members.length) delete db.clans[c.id];
    else if (c.leader === u.id) c.leader = c.members[0];
  }

  function addPoints(uid, pts) {
    const u = db.users[uid];
    const c = u && clanOf(u);
    if (!c) return;
    c.points = (c.points || 0) + pts;
    c.contrib[uid] = (c.contrib[uid] || 0) + pts;
    persist();
  }

  const routes = {
    'POST /api/clan/me': (body, u) => ({ clan: clanOf(u) ? view(clanOf(u), u) : null, emblems: EMBLEMS, cost: CREATE_COST, max: MAX_MEMBERS }),
    'POST /api/clan/list': body => {
      const q = cleanName(body.q).toLowerCase();
      const all = Object.values(db.clans).map(roll).filter(c => !q || c.name.toLowerCase().includes(q));
      all.sort((a, b) => b.points - a.points || b.members.length - a.members.length);
      return { clans: all.slice(0, 50).map(summary) };
    },
    'POST /api/clan/create': (body, u) => {
      if (!u.profile) fail('no_profile');
      if (clanOf(u)) fail('in_clan');
      if (!ECON.unlocked(u.profile, 'clan')) fail('locked_feature');
      const name = cleanName(body.name);
      if (name.length < 3) fail('bad_name');
      if (Object.values(db.clans).some(c => c.name.toLowerCase() === name.toLowerCase())) fail('name_taken');
      if (u.profile.coins < CREATE_COST) fail('no_coins');
      u.profile.coins -= CREATE_COST;
      const id = crypto.randomBytes(4).toString('hex');
      db.clans[id] = roll({ id, name, emblem: EMBLEMS.includes(body.emblem) ? body.emblem : EMBLEMS[0], leader: u.id, members: [u.id], created: Date.now() });
      u.clanId = id;
      return { clan: view(db.clans[id], u), profile: profileOut(u) };
    },
    'POST /api/clan/join': (body, u) => {
      if (clanOf(u)) fail('in_clan');
      const c = db.clans[String(body.id || '')];
      if (!c) fail('no_clan');
      roll(c);
      if (c.members.length >= MAX_MEMBERS) fail('clan_full');
      c.members.push(u.id); u.clanId = c.id;
      return { clan: view(c, u) };
    },
    'POST /api/clan/peek': body => { const c = db.clans[String(body.id || '')]; if (!c) fail('no_clan'); return { clan: summary(roll(c)) }; },
    'POST /api/clan/leave': (body, u) => { leave(u); return { ok: true }; },
    'POST /api/clan/kick': (body, u) => {
      const c = clanOf(u);
      if (!c || c.leader !== u.id) fail('not_leader');
      const target = db.users[String(body.id || '')];
      if (!target || target.clanId !== c.id || target.id === u.id) fail('bad_action');
      leave(target);
      return { clan: view(c, u) };
    },
    'POST /api/clan/claim': (body, u) => {
      const c = clanOf(u);
      if (!c) fail('no_clan');
      const tier = tierFor(c.last.points);
      if (!tier) fail('not_ready');
      if (c.last.claimed.includes(u.id)) fail('claimed');
      c.last.claimed.push(u.id);
      u.profile.coins += tier.coins; u.profile.gems = (u.profile.gems || 0) + tier.gems;
      return { coins: tier.coins, gems: tier.gems, profile: profileOut(u), clan: view(c, u) };
    },
  };
  return { routes, addPoints, weekKey, CHEST_TIERS, roll };
};
