// TON Legends — battle engine and game data (no DOM here, so it can be simulated in Node)

// Display text (names of roles/rarities, hero titles, skills, worlds) lives in i18n.js.
const RARITY = {
  C: { color: '#9aa4b2', mult: 1.0 },
  R: { color: '#3fa2ff', mult: 1.15 },
  E: { color: '#b66bff', mult: 1.3 },
  L: { color: '#ffc531', mult: 1.5 },
  M: { color: '#ff5ad1', mult: 1 }, // Mythic — duo fusions
  X: { color: '#46f0ff', mult: 1 }, // Cosmic — trio fusions
};

const ROLES = {
  tank:     { icon: '🛡️', hp: 1450, atk: 62,  spd: 1.4 },
  warrior:  { icon: '⚔️', hp: 1000, atk: 96,  spd: 1.2 },
  assassin: { icon: '🗡️', hp: 760,  atk: 128, spd: 1.0 },
  archer:   { icon: '🏹', hp: 720,  atk: 108, spd: 1.1 },
  mage:     { icon: '🔮', hp: 660,  atk: 118, spd: 1.5 },
  control:  { icon: '❄️', hp: 820,  atk: 90,  spd: 1.3 },
  healer:   { icon: '💧', hp: 820,  atk: 72,  spd: 1.3 },
  support:  { icon: '✨', hp: 860,  atk: 76,  spd: 1.3 },
};

const HEROES = [
  { id: 'pinkbull',  name: 'Pink Bull',    role: 'tank',     rarity: 'R' },
  { id: 'notcoin',   name: 'Notcoin',      role: 'tank',     rarity: 'L' },
  { id: 'volya',     name: 'Volya',        role: 'warrior',  rarity: 'L' },
  { id: 'egor',      name: 'Egor',         role: 'warrior',  rarity: 'C' },
  { id: 'paws',      name: 'PAWS',         role: 'assassin', rarity: 'E' },
  { id: 'noctis',    name: 'Noctis Veyl',  role: 'assassin', rarity: 'L' },
  { id: 'gramcat',   name: 'Gramcat',      role: 'archer',   rarity: 'C' },
  { id: 'utya',      name: 'Utya',         role: 'archer',   rarity: 'E' },
  { id: 'pengu',     name: 'Pengu',        role: 'control',  rarity: 'E' },
  { id: 'memegram',  name: 'Memegram',     role: 'mage',     rarity: 'R' },
  { id: 'yoda',      name: 'Yoda',         role: 'mage',     rarity: 'E' },
  { id: 'virus',     name: 'Virus',        role: 'mage',     rarity: 'R' },
  { id: 'babyshark', name: 'Baby Shark',   role: 'healer',   rarity: 'R' },
  { id: 'yaya',      name: 'Yaya',         role: 'support',  rarity: 'C' },
  { id: 'dog',       name: 'telegram.dog', role: 'support',  rarity: 'C' },
  { id: 'teddy',     name: 'Teddy',        role: 'support',  rarity: 'R' },
];
// Fusion cards (#1–#680, every duo and trio of the 16 heroes; list in fusions-data.js). Crafted in the Fusion Lab
// from heroes you own; their skill fires every part's skill at once. Supply is limited worldwide, so each copy is numbered.
const FD = typeof module !== 'undefined' ? require('./fusions-data.js') : { FUSION_DATA: self.FUSION_DATA, LEGACY_FUSION_IDS: self.LEGACY_FUSION_IDS };
const FUSIONS = FD.FUSION_DATA.map(([num, parts, name, role]) => ({
  id: 'f' + num, num, parts, fusion: true, rarity: parts.length === 3 ? 'X' : 'M',
  name: name || parts.map(p => HEROES.find(h => h.id === p).name).join(' × '),
  role: role || HEROES.find(h => h.id === parts[0]).role,
}));
const LEGACY_FUSION_IDS = FD.LEGACY_FUSION_IDS;
const FUSION_K = { duo: [1.2, 1.05, 0.6], trio: [1.3, 1.1, 0.45] };
// Fusing uses up `burn` levels of every part (they stay in your collection), and a trio also needs a duo of two of its parts.
const FUSION_RULES = { 2: { minLevel: 10, cost: 6000, supply: 300, burn: 9 }, 3: { minLevel: 20, cost: 25000, supply: 30, burn: 19, needDuo: true } };
// A battle team holds at most 2 fusion cards, and only one of them may be a trio.
const TEAM_MAX_FUSIONS = 2, TEAM_MAX_TRIOS = 1;
function teamError(team) {
  const fs = team.map(id => HERO_BY_ID[id]).filter(h => h && h.fusion);
  if (fs.length > TEAM_MAX_FUSIONS || fs.filter(h => h.parts.length === 3).length > TEAM_MAX_TRIOS) return 'fusion_limit';
  return null;
}
// Duos you own whose parts are all inside `parts` (a trio needs at least one).
const duosWithin = (owned, parts) => FUSIONS.filter(f => f.parts.length === 2 && owned[f.id] && f.parts.every(p => parts.includes(p)));
const BASE_HEROES = HEROES.slice();
HEROES.push(...FUSIONS);
const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
const STARTERS = ['pinkbull', 'egor', 'gramcat', 'memegram', 'babyshark'];
const MAX_LEVEL = 100;
const COIN_BONUS = { egor: 0.10, teddy: 0.20 };

// Each world is guarded by a themed squad of rival cards and a boss card that matches the world's art.
// 20 worlds = 5 themes × 4 chapters (I–IV). Chapter I is the original campaign; each later chapter brings a
// stronger squad, and the bosses of chapters III and IV are fusion cards (duo, then trio).
const fz = (...parts) => FUSIONS.find(f => f.parts.length === parts.length && parts.every(p => f.parts.includes(p))).id;
const THEMES = {
  ocean:  { bg: 'linear-gradient(180deg,#0a4f8a,#0d7cc2 45%,#e9d39a)',
    foes: [['utya', 'pengu', 'dog', 'gramcat'], ['pengu', 'utya', 'babyshark', 'volya'], ['utya', 'babyshark', 'noctis', 'pengu'], [fz('pengu', 'utya'), 'pengu', fz('babyshark', 'yaya'), 'utya']],
    boss: ['babyshark', 'pengu', fz('babyshark', 'pengu'), fz('babyshark', 'pengu', 'utya')] },
  cave:   { bg: 'linear-gradient(180deg,#071a3a,#123d7a 50%,#1b1f2e)',
    foes: [['memegram', 'yoda', 'pengu', 'gramcat'], ['yoda', 'egor', 'virus', 'memegram'], ['memegram', 'yoda', 'paws', 'egor'], [fz('memegram', 'yoda'), 'yoda', fz('egor', 'paws'), 'memegram']],
    boss: ['egor', 'memegram', fz('egor', 'memegram'), fz('egor', 'memegram', 'yoda')] },
  city:   { bg: 'linear-gradient(180deg,#05061a,#1a1f6b 55%,#3a1a5c)',
    foes: [['paws', 'pinkbull', 'teddy', 'volya'], ['notcoin', 'paws', 'volya', 'teddy'], ['volya', 'pinkbull', 'noctis', 'paws'], [fz('pinkbull', 'teddy'), 'paws', fz('notcoin', 'volya'), 'volya']],
    boss: ['notcoin', 'pinkbull', fz('pinkbull', 'notcoin'), fz('pinkbull', 'notcoin', 'teddy')] },
  temple: { bg: 'linear-gradient(180deg,#2a0b2e,#8a1f2a 55%,#3b2318)',
    foes: [['dog', 'yoda', 'noctis', 'teddy'], ['yaya', 'dog', 'teddy', 'noctis'], ['teddy', 'yaya', 'yoda', 'dog'], [fz('gramcat', 'dog'), 'teddy', fz('volya', 'dog'), 'yaya']],
    boss: ['yaya', 'teddy', fz('yaya', 'teddy'), fz('babyshark', 'yaya', 'teddy')] },
  lab:    { bg: 'linear-gradient(180deg,#06210f,#145c2c 55%,#2d1f0e)',
    foes: [['noctis', 'volya', 'paws', 'pinkbull'], ['virus', 'noctis', 'volya', 'paws'], ['noctis', 'virus', 'notcoin', 'volya'], [fz('virus', 'yoda'), 'virus', fz('paws', 'noctis'), 'noctis']],
    boss: ['virus', 'noctis', fz('noctis', 'virus'), fz('paws', 'noctis', 'virus')] },
};
const CHAPTER_TINT = ['', 'linear-gradient(180deg,rgba(90,0,140,.30),rgba(0,0,0,.25)),', 'linear-gradient(180deg,rgba(150,10,40,.35),rgba(0,0,0,.35)),',
  'linear-gradient(180deg,rgba(0,0,0,.55),rgba(60,0,90,.45)),'];
const WORLDS = [];
for (let ch = 0; ch < 4; ch++) {
  for (const key of ['ocean', 'cave', 'city', 'temple', 'lab']) {
    const th = THEMES[key];
    WORLDS.push({ key, chapter: ch, bg: CHAPTER_TINT[ch] + th.bg, boss: th.boss[ch], foes: th.foes[ch] });
  }
}
const STAGES_PER_WORLD = 10;
const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;

function heroStats(id, level) {
  const h = HERO_BY_ID[id], r = ROLES[h.role];
  if (h.fusion) {
    // Fusion level 1 = its parts at the level required to fuse them, then boosted (FUSION_K: [HP, ATK, skill power]).
    const offset = FUSION_RULES[h.parts.length].minLevel - 1;
    const ps = h.parts.map(p => heroStats(p, level + offset)), k = ps.length === 3 ? [FUSION_K.trio[0], FUSION_K.trio[1]] : [FUSION_K.duo[0], FUSION_K.duo[1]];
    const avg = key => ps.reduce((a, s) => a + s[key], 0) / ps.length;
    return { hp: Math.round(avg('hp') * k[0]), atk: Math.round(avg('atk') * k[1]), spd: r.spd };
  }
  const m = RARITY[h.rarity].mult * (1 + 0.12 * (level - 1));
  return { hp: Math.round(r.hp * m), atk: Math.round(r.atk * m), spd: r.spd };
}

// Linear per level, so the total cost of a level grows like the coins the stages pay (both ~ stage²).
function upgradeCost(id, level) {
  const f = { C: 1, R: 1.3, E: 1.7, L: 2.2, M: 3, X: 4 }[HERO_BY_ID[id].rarity];
  return Math.round((60 + 90 * level) * f);
}

function stageReward(idx) {
  const boss = idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
  return Math.round((80 + 25 * idx) * (boss ? 3 : 1));
}

const ENEMY_HP = 0.56, ENEMY_ATK = 0.23, SC2 = 0.13;
// Worlds 1–4 keep their original hand-tuned curve (made for the starter cards); calibration starts at world 5.
const CALIBRATED_FROM = 40;
const WORLD_K = [1.907, 1.371, 1.198, 1.137, 0.887, 1.117, 1.383, 1.18, 1.631, 1.322, 1.452, 1.587, 1.374, 2.074, 1.545, 1.704, 1.795, 1.714, 2.517, 1.626];
const LOCAL_K = [1.596, 1.572, 1.532, 1.195, 1.246, 0.956, 0.958, 1.019, 0.848, 1.025]; // per stage inside a world (more enemy cards later in a world); see tools/calibrate.js
function stageEnemies(idx) {
  const w = WORLDS[Math.floor(idx / STAGES_PER_WORLD)], local = idx % STAGES_PER_WORLD;
  // Difficulty follows the level a team of five non-fusion cards needs: ~5 at stage 20, ~45 at stage 100, ~95 at stage 200.
  // The per-world factor (tools/calibrate.js) evens out how strong each world's line-up is.
  const sc = (idx < 50 ? 2.4 + 0.32 * idx : 18.08 + SC2 * (idx - 50)) * (idx < CALIBRATED_FROM ? 1 : WORLD_K[Math.floor(idx / STAGES_PER_WORLD)] * LOCAL_K[idx % STAGES_PER_WORLD]);
  const card = (id, boss) => {
    const h = HERO_BY_ID[id], r = ROLES[h.role];
    // Enemy fusion cards bring their combined skills, not the fusion level bonus (that would make chapters III–IV a wall).
    const b = h.fusion ? h.parts.map(p => heroStats(p, 1)).reduce((a, x) => ({ hp: a.hp + x.hp / h.parts.length, atk: a.atk + x.atk / h.parts.length }), { hp: 0, atk: 0 }) : heroStats(id, 1);
    const hpM = boss ? 3.2 : 1, atkM = boss ? 1.35 : 1;
    return { id, role: HERO_BY_ID[id].role, name: HERO_BY_ID[id].name, boss: !!boss,
      hp: b.hp * ENEMY_HP * sc * hpM, atk: b.atk * ENEMY_ATK * sc * atkM * (r.spd / 1.3), spd: r.spd };
  };
  if (local === STAGES_PER_WORLD - 1) return [card(w.foes[0]), card(w.boss, true), card(w.foes[1])];
  const n = Math.min(5, 2 + Math.floor(local / 2.5));
  return Array.from({ length: n }, (_, i) => card(w.foes[(i + local) % w.foes.length]));
}

// ---------- battle ----------
// Deterministic: all randomness comes from a per-battle seeded RNG and time advances in fixed ticks,
// so the server can replay a battle from (seed, inputs) and get exactly the same result.
const TICK = 0.05, MAX_TICKS = Math.round(120 / TICK);
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeUnit(B, side, o) {
  return {
    uid: B.nextUid++, side, id: o.id, name: o.name, role: o.role, boss: !!o.boss,
    maxHp: Math.round(o.hp), hp: Math.round(o.hp), atk: o.atk, spd: o.spd,
    timer: B.rng() * o.spd * 0.6, energy: side === 'hero' || B.pvp ? 20 : 0, shield: 0, fx: {}, alive: true,
    bossCd: 7, poisonNext: 0, shieldUntil: 0, skillK: 1,
  };
}
function newBattle(seed, pvp) {
  return { t: 0, tick: 0, seed: seed >>> 0, rng: mulberry32(seed >>> 0), nextUid: 1, events: [], over: null, pvp: !!pvp,
    autoBy: { hero: false, enemy: !pvp } };
}
// Community (faction): every player backs one of the 16 heroes. That hero's card fights harder for them,
// and so (a little) does any fusion card that contains it.
const FACTION_BONUS = 0.15, FACTION_FUSION_BONUS = 0.08;
function factionMult(id, faction) {
  if (!faction) return 1;
  if (id === faction) return 1 + FACTION_BONUS;
  const h = HERO_BY_ID[id];
  return h && h.fusion && h.parts.includes(faction) ? 1 + FACTION_FUSION_BONUS : 1;
}
// Market mood: today's power multiplier per hero ({ id: 1.05 }); a fusion gets half of its best part's boost.
function marketMult(id, market) {
  if (!market) return 1;
  const h = HERO_BY_ID[id];
  if (!h || !h.fusion) return market[id] || 1;
  return 1 + Math.max(0, ...h.parts.map(p => (market[p] || 1) - 1)) * 0.5;
}
function teamUnits(B, side, team, levels, faction, market) {
  return team.map(id => {
    const s = heroStats(id, levels[id] || 1), k = factionMult(id, faction) * marketMult(id, market);
    return makeUnit(B, side, { ...HERO_BY_ID[id], ...s, hp: s.hp * k, atk: s.atk * k });
  });
}
function createBattle(team, levels, idx, seed = (Math.random() * 2 ** 32) >>> 0, faction = null, market = null) {
  const B = newBattle(seed, false);
  B.idx = idx;
  B.heroes = teamUnits(B, 'hero', team, levels, faction, market);
  B.enemies = stageEnemies(idx).map(e => makeUnit(B, 'enemy', e));
  return B;
}
// PvP: side A plays as 'hero', side B as 'enemy'; both sides use the same (hero) rules.
function createPvpBattle(teamA, levelsA, teamB, levelsB, seed, factionA = null, factionB = null, market = null) {
  const B = newBattle(seed, true);
  B.heroes = teamUnits(B, 'hero', teamA, levelsA, factionA, market);
  B.enemies = teamUnits(B, 'enemy', teamB, levelsB, factionB, market);
  return B;
}

const alive = arr => arr.filter(u => u.alive);
const on = (B, u, k) => (u.fx[k] || 0) > B.t;
const pick = (B, arr) => arr[Math.floor(B.rng() * arr.length)];
const heroRules = (B, u) => u.side === 'hero' || B.pvp;
function atkOf(B, u) { return u.atk * (on(B, u, 'buff') ? 1.4 : 1) * (on(B, u, 'weak') ? 0.75 : 1); }
function foesOf(B, u) { return alive(u.side === 'hero' ? B.enemies : B.heroes); }
function friendsOf(B, u) { return alive(u.side === 'hero' ? B.heroes : B.enemies); }
function lowest(arr) { return arr.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a), arr[0]); }

// Shields are sized from the protected card's own max HP, never stack above half of it and fade after 6 s,
// so two shield teams can't lock a fight forever.
const SHIELD_CAP = 0.5, SHIELD_TIME = 6;
function addShield(B, f, amount) {
  f.shield = Math.round(Math.min(f.maxHp * SHIELD_CAP, f.shield + amount / rage(B)));
  f.shieldUntil = B.t + SHIELD_TIME;
  B.events.push({ type: 'shield', uid: f.uid });
}
// Sudden death: after 60 s every hit grows stronger (+6% per second) and healing/shields weaker, so every fight ends.
const ENRAGE_AT = 60;
const rage = B => (B.t > ENRAGE_AT ? 1 + 0.06 * (B.t - ENRAGE_AT) : 1);

function damage(B, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  if (!opts.pure && on(B, tgt, 'dodge')) { B.events.push({ type: 'miss', uid: tgt.uid }); return 0; }
  let dmg = amount * rage(B);
  if (on(B, tgt, 'vuln')) dmg *= 1.3;
  let crit = false;
  if (src && heroRules(B, src) && !opts.pure && B.rng() < 0.12) { dmg *= 1.6; crit = true; }
  dmg = Math.max(1, Math.round(dmg * (0.92 + B.rng() * 0.16)));
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; if (dmg === 0) { B.events.push({ type: 'block', uid: tgt.uid }); return 0; } }
  tgt.hp -= dmg;
  tgt.energy = Math.min(100, tgt.energy + (heroRules(B, tgt) ? 3 : 2));
  B.events.push({ type: 'dmg', uid: tgt.uid, amount: dmg, crit, poison: !!opts.poison });
  if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; B.events.push({ type: 'die', uid: tgt.uid }); }
  return dmg;
}

function heal(B, tgt, amount) {
  if (!tgt || !tgt.alive) return;
  const v = Math.round(Math.min(tgt.maxHp - tgt.hp, amount / rage(B)));
  tgt.hp += v;
  if (v > 0) B.events.push({ type: 'heal', uid: tgt.uid, amount: v });
}

function heroTarget(B, u) {
  const foes = foesOf(B, u);
  if (!foes.length) return null;
  if (u.role === 'assassin') return lowest(foes);
  if (u.role === 'archer' || u.role === 'mage') return pick(B, foes);
  return foes[0];
}

function enemyTarget(B, u) {
  const hs = alive(B.heroes);
  const tanks = hs.filter(h => h.role === 'tank');
  if (tanks.length && B.rng() < 0.7) return pick(B, tanks);
  const front = hs.filter(h => h.role === 'warrior' || h.role === 'assassin' || h.role === 'tank');
  if (front.length && B.rng() < 0.5) return pick(B, front);
  return pick(B, hs);
}

function basicAttack(B, u) {
  const hr = heroRules(B, u);
  const t = hr ? heroTarget(B, u) : enemyTarget(B, u);
  if (!t) return;
  B.events.push({ type: 'atk', uid: u.uid, target: t.uid });
  damage(B, u, t, atkOf(B, u));
  if (u.role === 'healer') heal(B, lowest(friendsOf(B, u)), atkOf(B, u) * 0.5);
  u.energy = Math.min(100, u.energy + (hr ? 14 : 10));
}

const SKILLS = {
  pinkbull(B, u) { for (const e of foesOf(B, u)) { damage(B, u, e, atkOf(B, u) * 1.5); e.fx.stun = B.t + 1.5; } },
  notcoin(B, u) { for (const f of friendsOf(B, u)) addShield(B, f, f.maxHp * 0.25 * (u.skillK || 1)); },
  volya(B, u) { const fs = foesOf(B, u); const t = fs.reduce((a, b) => (b.hp > a.hp ? b : a), fs[0]); damage(B, u, t, atkOf(B, u) * 4.5); },
  egor(B, u) { const t = foesOf(B, u)[0]; damage(B, u, t, atkOf(B, u) * 2.5); if (t) t.fx.vuln = B.t + 5; },
  paws(B, u) { for (let i = 0; i < 3; i++) damage(B, u, foesOf(B, u)[0], atkOf(B, u) * 1.4); },
  noctis(B, u) { damage(B, u, lowest(foesOf(B, u)), atkOf(B, u) * 5); u.fx.dodge = B.t + 3; },
  gramcat(B, u) { for (const e of foesOf(B, u)) damage(B, u, e, atkOf(B, u) * 1.7); },
  utya(B, u) { for (const e of foesOf(B, u)) { damage(B, u, e, atkOf(B, u) * 1.4); e.fx.slow = B.t + 3; } },
  pengu(B, u) { for (const e of foesOf(B, u)) { damage(B, u, e, atkOf(B, u) * 0.9); e.fx.stun = B.t + 2.5; e.fx.freeze = B.t + 2.5; } },
  memegram(B, u) { for (const e of foesOf(B, u)) damage(B, u, e, atkOf(B, u) * 2.2); },
  yoda(B, u) { for (const e of foesOf(B, u)) { damage(B, u, e, atkOf(B, u) * 1.9); e.timer = -e.spd * 0.8; } },
  virus(B, u) { for (const e of foesOf(B, u)) { e.fx.poison = B.t + 5; e.poisonDps = atkOf(B, u) * 0.6; e.poisonNext = B.t + 1; e.fx.weak = B.t + 5; } },
  babyshark(B, u) { for (const f of friendsOf(B, u)) heal(B, f, atkOf(B, u) * 2.5); },
  yaya(B, u) { for (const f of friendsOf(B, u)) { f.fx.buff = B.t + 6; heal(B, f, atkOf(B, u) * 0.8); } },
  dog(B, u) { for (const f of friendsOf(B, u)) if (f !== u) f.energy = Math.min(100, f.energy + 50); },
  teddy(B, u) { const t = lowest(friendsOf(B, u)); heal(B, t, atkOf(B, u) * 3.5); addShield(B, t, t.maxHp * 0.3 * (u.skillK || 1)); },
};
// A fusion fires every part's skill, each at reduced power (otherwise 3 skills per cast would dwarf everything).
for (const f of FUSIONS) SKILLS[f.id] = (B, u) => {
  const atk = u.atk, k = f.parts.length === 3 ? FUSION_K.trio[2] : FUSION_K.duo[2];
  u.atk *= k; u.skillK = k;
  try { for (const p of f.parts) if (foesOf(B, u).length) SKILLS[p](B, u); } finally { u.atk = atk; u.skillK = 1; }
};

function castSkill(B, u) {
  if (!u || !u.alive || u.energy < 100 || B.over || !foesOf(B, u).length) return false;
  u.energy = 0;
  B.events.push({ type: 'skill', uid: u.uid, id: u.id, side: u.side });
  SKILLS[u.id](B, u);
  checkEnd(B);
  return true;
}

function checkEnd(B) {
  if (B.over) return;
  if (!alive(B.enemies).length) B.over = 'win';
  else if (!alive(B.heroes).length) B.over = 'lose';
}

// Inputs are [tick, code]: code > 0 casts the skill of unit `code`; -1 / -2 turn hero auto on / off.
function applyInput(B, code) {
  if (code === -1) B.autoBy.hero = true;
  else if (code === -2) B.autoBy.hero = false;
  else { const u = B.heroes.find(x => x.uid === code); if (u) castSkill(B, u); }
}

// Advance exactly one fixed tick.
function step(B) {
  if (B.over) return;
  B.tick++;
  B.t = B.tick * TICK;
  const dt = TICK;
  if (!B.enraged && B.t >= ENRAGE_AT) { B.enraged = true; B.events.push({ type: 'enrage' }); }
  for (const u of [...B.heroes, ...B.enemies]) {
    if (!u.alive) continue;
    if (u.shield > 0 && B.t >= u.shieldUntil) u.shield = 0;
    if (on(B, u, 'poison') && B.t >= u.poisonNext) { u.poisonNext += 1; damage(B, null, u, u.poisonDps, { pure: true, poison: true }); if (!u.alive) continue; }
    if (on(B, u, 'stun')) continue;
    u.timer += dt * (on(B, u, 'slow') ? 0.55 : 1);
    if (u.timer >= u.spd) { u.timer -= u.spd; basicAttack(B, u); }
    if (u.boss) {
      u.bossCd -= dt;
      if (u.bossCd <= 0) {
        u.bossCd = 8;
        B.events.push({ type: 'bossaoe', uid: u.uid });
        for (const h of alive(B.heroes)) damage(B, u, h, atkOf(B, u) * 0.9);
      }
    }
    if (u.energy >= 100 && B.autoBy[u.side]) castSkill(B, u);
  }
  checkEnd(B);
  // Time's up: the side with more HP left (as a share of its total) wins.
  if (B.tick >= MAX_TICKS && !B.over) {
    const share = arr => arr.reduce((a, u) => a + u.hp, 0) / arr.reduce((a, u) => a + u.maxHp, 0);
    const h = share(B.heroes), e = share(B.enemies);
    B.timeout = true;
    B.over = h > e ? 'win' : h < e || !B.pvp ? 'lose' : 'draw';
  }
}

// Server-side verification of a stage battle: replay it from its seed and the player's inputs.
function replayStage(team, levels, idx, seed, inputs, faction = null, market = null) {
  const B = createBattle(team, levels, idx, seed, faction, market);
  const q = (Array.isArray(inputs) ? inputs : []).filter(x => Array.isArray(x) && Number.isInteger(x[0]) && Number.isInteger(x[1])).sort((a, b) => a[0] - b[0]);
  let i = 0, skills = 0;
  while (!B.over) {
    while (i < q.length && q[i][0] <= B.tick) applyInput(B, q[i++][1]);
    for (const e of B.events) if (e.type === 'skill' && e.side === 'hero') skills++;
    B.events.length = 0;
    step(B);
  }
  for (const e of B.events) if (e.type === 'skill' && e.side === 'hero') skills++;
  return { result: B.over, ticks: B.tick, skills };
}

if (typeof module !== 'undefined') {
  module.exports = { RARITY, ROLES, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, TEAM_MAX_FUSIONS, TEAM_MAX_TRIOS, teamError, duosWithin, ENRAGE_AT, LEGACY_FUSION_IDS, HERO_BY_ID, STARTERS, WORLDS, TOTAL_STAGES, STAGES_PER_WORLD, MAX_LEVEL, COIN_BONUS, TICK,
    WORLD_K, LOCAL_K, FACTION_BONUS, FACTION_FUSION_BONUS, factionMult, marketMult, heroStats, upgradeCost, stageReward, stageEnemies, createBattle, createPvpBattle, step, castSkill, applyInput, replayStage };
}
