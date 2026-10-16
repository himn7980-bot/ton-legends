// Gram Legends — invite friends. A friend counts as "active" once they reach world 2 (stage 10): the inviter gets
// coins right away, climbs reward tiers (gems, and the Friend card frame at 5), and earns a share of the coins the
// friend wins in stages (capped per day), banked until claimed on the Friends screen.
const ECON = require('../src/economy.js');

const TIERS = [
  { n: 1, gems: 10 }, { n: 3, gems: 30 }, { n: 5, gems: 50, frame: 'friend' },
  { n: 10, gems: 120 }, { n: 25, gems: 300 }, { n: 50, gems: 700 },
];
const SHARE = 0.1, DAY_CAP = 3000, ACTIVE_AT = 10, INVITER_COINS = 500, NEWCOMER_COINS = 300;

module.exports = function createReferral({ db, persist, credit, profileOut, inviteLink = () => null }) {
  const today = () => ECON.day(Date.now());

  // Friend reached world 2 → pay the inviter once.
  function check(u) {
    if (!u.refBy || u.refPaid || !u.profile || u.profile.cleared < ACTIVE_AT) return;
    const inviter = db.users[u.refBy];
    u.refPaid = true;
    if (inviter) { inviter.refActive = (inviter.refActive || 0) + 1; credit(inviter, INVITER_COINS); }
    persist();
  }
  // A friend won stage coins → the inviter banks SHARE of them (DAY_CAP per day).
  function onCoins(u, coins) {
    if (!u.refBy || !u.refPaid || !(coins > 0)) return;
    const inviter = db.users[u.refBy];
    if (!inviter) return;
    const d = today();
    if (!inviter.refDay || inviter.refDay.d !== d) inviter.refDay = { d, amt: 0 };
    const add = Math.min(Math.round(coins * SHARE), DAY_CAP - inviter.refDay.amt);
    if (add <= 0) return;
    inviter.refDay.amt += add; inviter.refBank = (inviter.refBank || 0) + add;
  }
  function view(u) {
    const friends = Object.values(db.users).filter(x => x.refBy === u.id)
      .map(x => ({ name: x.name || 'Player', stage: x.profile ? x.profile.cleared : 0, active: !!x.refPaid }))
      .sort((a, b) => b.stage - a.stage);
    const active = u.refActive || 0, claimed = u.refTiers || [];
    return {
      link: inviteLink(u), invited: friends.length, active, bank: u.refBank || 0, today: u.refDay && u.refDay.d === today() ? u.refDay.amt : 0,
      rules: { share: SHARE, cap: DAY_CAP, activeAt: ACTIVE_AT, inviter: INVITER_COINS, newcomer: NEWCOMER_COINS },
      tiers: TIERS.map(t => ({ ...t, done: active >= t.n, claimed: claimed.includes(t.n) })),
      friends: friends.slice(0, 50),
    };
  }
  const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code: status }); };
  const routes = {
    'POST /api/ref/me': (body, u) => ({ ref: view(u) }),
    'POST /api/ref/claim': (body, u) => {
      if (!u.profile) fail('no_profile');
      if (body.bank) {
        const coins = u.refBank || 0;
        if (!coins) fail('not_ready');
        u.refBank = 0; u.profile.coins += coins; persist();
        return { coins, ref: view(u), profile: profileOut(u) };
      }
      const t = TIERS.find(x => x.n === +body.tier);
      if (!t) fail('bad_tier');
      if ((u.refActive || 0) < t.n) fail('not_ready');
      u.refTiers = u.refTiers || [];
      if (u.refTiers.includes(t.n)) fail('claimed');
      u.refTiers.push(t.n);
      u.profile.gems = (u.profile.gems || 0) + t.gems;
      if (t.frame) ECON.giveCosmetic(u.profile, t.frame);
      persist();
      return { gems: t.gems, frame: t.frame || null, ref: view(u), profile: profileOut(u) };
    },
  };
  return { check, onCoins, view, routes, TIERS, ACTIVE_AT, INVITER_COINS, NEWCOMER_COINS };
};
