// TON Legends — online 1v1 arena with coin stakes.
// The server holds both stakes, runs the battle itself (so neither client can cheat), streams it to both
// players over Server-Sent Events, accepts their skill taps, and pays the whole pot to the winner.
const crypto = require('crypto');
const E = require('../src/engine.js');
const ECON = require('../src/economy.js');

const STAKES = [100, 500, 1000, 5000, 10000];
const COUNTDOWN_MS = 3500;
const STATUS_BITS = ['freeze', 'stun', 'slow', 'poison', 'vuln', 'weak', 'buff', 'dodge'];

function fail(code) { const e = new Error(code); e.code = 400; throw e; }
const rid = n => crypto.randomBytes(n).toString('hex');
const roomCode = () => Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

const PVP_WIN_GEMS = 2;
const AI_NAMES = ['Neon Ronin', 'Frost Byte', 'Crypto Kraken', 'Shadow Bot', 'Lucky Lynx', 'Iron Gecko', 'Moon Mantis', 'Pixel Paladin', 'Turbo Tiger', 'Volt Viper'];

module.exports = function createArena({ db, persist, notify = () => {}, onPoints = () => {}, market = () => null }) {
  const tickets = new Map();   // ticket id (secret) -> ticket
  const queues = new Map();    // stake -> waiting tickets
  const rooms = new Map();     // invite code -> waiting host ticket
  db.escrow = db.escrow || {};

  // Matches live in memory; if the server restarted mid-match, give everyone their stake back.
  for (const [id, e] of Object.entries(db.escrow)) {
    const u = db.users[e.uid];
    if (u && u.profile) u.profile.coins += e.stake;
    delete db.escrow[id];
  }
  persist();

  const now = () => Date.now();
  const busyTicket = uid => [...tickets.values()].find(t => t.uid === uid && t.status !== 'done');

  function send(t, type, data) {
    if (!t.client) return;
    try { t.client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { t.client = null; }
  }

  function open(u, stake, mode) {
    stake = Number(stake);
    if (!STAKES.includes(stake)) fail('bad_stake');
    const p = u.profile;
    if (!p) fail('no_profile');
    if (!p.team.length) fail('bad_team');
    if (busyTicket(u.id)) fail('busy');
    if (p.coins < stake) fail('no_coins');
    p.coins -= stake;
    const t = { id: rid(16), uid: u.id, name: u.name, stake, mode, team: [...p.team], faction: p.faction || null,
      levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), power: Math.round(ECON.teamPower(p)),
      status: 'waiting', client: null, auto: false, created: now(), lastSeen: now() };
    db.escrow[t.id] = { uid: u.id, stake };
    tickets.set(t.id, t);
    persist();
    return t;
  }

  function unlist(t) {
    const q = queues.get(t.stake);
    if (q) queues.set(t.stake, q.filter(x => x !== t));
    if (t.code) rooms.delete(t.code);
  }

  function refund(t) {
    const e = db.escrow[t.id];
    if (e) { const u = db.users[e.uid]; if (u && u.profile) u.profile.coins += e.stake; delete db.escrow[t.id]; }
  }

  function cancelWaiting(t) {
    unlist(t); refund(t); t.status = 'done'; t.end = { result: 'cancelled' };
    send(t, 'cancelled', {}); persist();
  }

  // ---------- match ----------
  function snapshot(B) {
    return [...B.heroes, ...B.enemies].map(u => [u.uid, Math.round(u.hp), Math.round(u.shield), Math.round(u.energy),
      STATUS_BITS.reduce((bits, k, i) => bits | (((u.fx[k] || 0) > B.t) ? 1 << i : 0), 0)]);
  }
  function matchInfo(m, t) {
    const opp = t === m.a ? m.b : m.a;
    return { side: t.side, ai: m.ai, stake: m.stake, pot: m.stake * 2, startIn: Math.max(0, m.startAt - now()),
      you: { name: t.name, power: t.power }, opp: { name: opp.name, power: opp.power },
      units: [...m.B.heroes, ...m.B.enemies].map(u => ({ uid: u.uid, side: u.side, id: u.id, name: u.name, maxHp: u.maxHp })) };
  }

  function startMatch(a, b) {
    unlist(a); unlist(b);
    const B = E.createPvpBattle(a.team, a.levels, b.team, b.levels, crypto.randomInt(2 ** 32), a.faction || null, b.faction || null, market());
    const m = { id: rid(8), ai: a.aiLevel || null, a, b, B, stake: a.stake, startAt: now() + COUNTDOWN_MS, inputs: [], ev: [], timer: null };
    a.side = 'hero'; b.side = 'enemy';
    for (const t of [a, b]) { t.match = m; t.status = 'playing'; send(t, 'match', matchInfo(m, t)); }
    setTimeout(() => { m.timer = setInterval(() => tick(m), E.TICK * 1000); }, COUNTDOWN_MS);
    return m;
  }

  function tick(m) {
    const B = m.B;
    // A player who closed the game keeps fighting on auto, so leaving never helps.
    B.autoBy.hero = m.a.client ? m.a.auto : true;
    B.autoBy.enemy = m.b.client ? m.b.auto : true;
    for (const inp of m.inputs.splice(0)) {
      const list = inp.side === 'hero' ? B.heroes : B.enemies;
      const u = list.find(x => x.uid === inp.code);
      if (u) E.castSkill(B, u);
    }
    E.step(B);
    m.ev.push(...B.events); B.events.length = 0;
    if (B.tick % 2 === 0 || B.over) {
      const data = { t: B.t, ev: m.ev.splice(0), u: snapshot(B) };
      send(m.a, 'tick', data); send(m.b, 'tick', data);
    }
    if (B.over) finish(m);
  }

  function finish(m) {
    clearInterval(m.timer);
    const winner = m.B.over === 'win' ? m.a : m.B.over === 'lose' ? m.b : null;
    if (m.ai) return finishAi(m, winner);
    const pot = m.stake * 2;
    for (const t of [m.a, m.b]) {
      const u = db.users[t.uid], p = u && u.profile;
      delete db.escrow[t.id];
      let result;
      if (!winner) { result = 'draw'; if (p) p.coins += m.stake; }
      else if (t === winner) {
        result = 'win';
        if (p) { p.coins += pot; p.gems = (p.gems || 0) + PVP_WIN_GEMS; p.stats.pvpWins = (p.stats.pvpWins || 0) + 1; ECON.track(p, 'wins', 1, now()); }
        onPoints(t.uid, 5);
      }
      else { result = 'lose'; if (p) p.stats.pvpLosses = (p.stats.pvpLosses || 0) + 1; }
      t.status = 'done';
      t.end = { result, stake: m.stake, pot, gemsWon: result === 'win' ? PVP_WIN_GEMS : 0, coins: p ? p.coins : 0, gems: p ? p.gems : 0, opp: (t === m.a ? m.b : m.a).name };
      send(t, 'end', t.end);
      if (!t.client) notify(t.uid, t.end);
    }
    persist();
  }

  // ---------- AI rival ----------
  // An AI team of random heroes whose power is scaled to the player's (easy 80%, normal 100%, hard 125%).
  function aiTeam(p, level) {
    const pool = E.BASE_HEROES.map(h => h.id);
    const team = [];
    while (team.length < 5) { const id = pool.splice(crypto.randomInt(pool.length), 1)[0]; team.push(id); }
    const target = ECON.teamPower(p) * ECON.AI_LEVELS[level].power;
    let lo = 1, hi = E.MAX_LEVEL;
    const power = L => ECON.teamPower({ owned: Object.fromEntries(team.map(id => [id, L])) }, team);
    while (lo < hi) { const mid = (lo + hi) >> 1; if (power(mid) >= target) hi = mid; else lo = mid + 1; }
    return { team, levels: Object.fromEntries(team.map(id => [id, lo])), power: Math.round(power(lo)) };
  }
  function finishAi(m, winner) {
    const t = m.a, u = db.users[t.uid], p = u && u.profile;
    const result = !winner ? 'draw' : winner === t ? 'win' : 'lose';
    let reward = { coins: 0, gems: 0 };
    if (p && result === 'win') {
      p.stats.aiWins = (p.stats.aiWins || 0) + 1;
      ECON.track(p, 'wins', 1, now());
      onPoints(t.uid, 1);
      if (ECON.aiLeft(p, now()) > 0) {
        reward = ECON.aiReward(p, m.ai);
        p.coins += reward.coins; p.gems = (p.gems || 0) + reward.gems;
        const d = ECON.day(now());
        p.aiDay = p.aiDay && p.aiDay.date === d ? { date: d, wins: p.aiDay.wins + 1 } : { date: d, wins: 1 };
      }
    }
    t.status = 'done'; m.b.status = 'done';
    t.end = { result, ai: m.ai, reward, aiLeft: p ? ECON.aiLeft(p, now()) : 0, coins: p ? p.coins : 0, gems: p ? p.gems : 0, opp: m.b.name };
    send(t, 'end', t.end);
    tickets.delete(m.b.id);
    persist();
  }

  // Clean up abandoned searches and finished tickets.
  const sweeper = setInterval(() => {
    for (const t of tickets.values()) {
      if (t.status === 'waiting' && !t.client && now() - t.lastSeen > 60e3) cancelWaiting(t);
      if (t.status === 'done' && now() - t.lastSeen > 10 * 60e3) tickets.delete(t.id);
    }
  }, 10e3);
  sweeper.unref();

  // ---------- API ----------
  const own = (u, id) => { const t = tickets.get(String(id || '')); if (!t || t.uid !== u.id) fail('no_ticket'); return t; };
  const routes = {
    'POST /api/pvp/find': (body, u) => {
      if (u.profile && !ECON.unlocked(u.profile, 'pvp')) fail('locked_feature');
      const t = open(u, body.stake, 'queue');
      const q = (queues.get(t.stake) || []).filter(x => x.status === 'waiting' && x.uid !== u.id);
      if (q.length) {
        const opp = q.reduce((best, x) => (Math.abs(x.power - t.power) < Math.abs(best.power - t.power) ? x : best), q[0]);
        startMatch(opp, t);
      } else queues.set(t.stake, [...(queues.get(t.stake) || []), t]);
      return { ticket: t.id, coins: u.profile.coins };
    },
    'POST /api/pvp/room': (body, u) => {
      if (u.profile && !ECON.unlocked(u.profile, 'pvp')) fail('locked_feature');
      const t = open(u, body.stake, 'room');
      do { t.code = roomCode(); } while (rooms.has(t.code));
      rooms.set(t.code, t);
      return { ticket: t.id, code: t.code, coins: u.profile.coins };
    },
    'POST /api/pvp/peek': body => {
      const t = rooms.get(String(body.code || '').toUpperCase());
      if (!t || t.status !== 'waiting') fail('room_gone');
      return { stake: t.stake, host: t.name, power: t.power };
    },
    'POST /api/pvp/join': (body, u) => {
      const host = rooms.get(String(body.code || '').toUpperCase());
      if (!host || host.status !== 'waiting') fail('room_gone');
      if (host.uid === u.id) fail('own_room');
      const t = open(u, host.stake, 'join');
      startMatch(host, t);
      return { ticket: t.id, coins: u.profile.coins };
    },
    'POST /api/pvp/cancel': (body, u) => {
      const t = own(u, body.ticket);
      if (t.status === 'waiting') cancelWaiting(t);
      return { ok: true, coins: u.profile.coins };
    },
    'POST /api/pvp/input': (body, u) => {
      const t = own(u, body.ticket);
      const m = t.match;
      if (!m || m.B.over || t.status !== 'playing') return { ok: false };
      const code = Number(body.code);
      if (code === -1 || code === -2) t.auto = code === -1;
      else if (Number.isInteger(code)) m.inputs.push({ side: t.side, code });
      return { ok: true };
    },
    'POST /api/pvp/ai': (body, u) => {
      if (u.profile && !ECON.unlocked(u.profile, 'ai')) fail('locked_feature');
      const level = ECON.AI_LEVELS[body.level] ? body.level : 'normal';
      const p = u.profile;
      if (!p) fail('no_profile');
      if (!p.team.length) fail('bad_team');
      if (busyTicket(u.id)) fail('busy');
      const t = { id: rid(16), uid: u.id, name: u.name, stake: 0, mode: 'ai', team: [...p.team], faction: p.faction || null,
        levels: Object.fromEntries(p.team.map(id => [id, p.owned[id]])), power: Math.round(ECON.teamPower(p)),
        status: 'waiting', client: null, auto: false, created: now(), lastSeen: now() };
      const ai = aiTeam(p, level);
      const bot = { id: rid(16), uid: null, ai: true, name: '🤖 ' + AI_NAMES[crypto.randomInt(AI_NAMES.length)], stake: 0, ...ai,
        status: 'waiting', client: null, auto: true, created: now(), lastSeen: now() };
      tickets.set(t.id, t); tickets.set(bot.id, bot);
      t.aiLevel = level;
      startMatch(t, bot);
      return { ticket: t.id, aiLeft: ECON.aiLeft(p, now()) };
    },
    'POST /api/pvp/state': (body, u) => {
      const t = busyTicket(u.id);
      return t ? { ticket: t.id, status: t.status, stake: t.stake, code: t.code || null } : { ticket: null };
    },
  };

  // GET /api/pvp/stream?ticket=… — the ticket id is a random secret, so it authenticates the stream.
  function stream(req, res, ticketId) {
    const t = tickets.get(String(ticketId || ''));
    if (!t) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(': ok\n\n');
    if (t.client) try { t.client.end(); } catch (e) {}
    t.client = res; t.lastSeen = now();
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 15e3);
    res.on('close', () => { clearInterval(ping); if (t.client === res) { t.client = null; t.lastSeen = now(); } });
    if (t.status === 'waiting') send(t, 'waiting', { stake: t.stake, code: t.code || null });
    else if (t.status === 'playing') { send(t, 'match', matchInfo(t.match, t)); send(t, 'tick', { t: t.match.B.t, ev: [], u: snapshot(t.match.B) }); }
    else if (t.end) send(t, t.end.result === 'cancelled' ? 'cancelled' : 'end', t.end);
  }

  return { routes, stream, STAKES, stop: () => { clearInterval(sweeper); for (const t of tickets.values()) if (t.match) clearInterval(t.match.timer); } };
};
