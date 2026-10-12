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
// Fusion cards: crafted in the Fusion Lab from heroes you own. Their skill fires every part's skill at once.
// Supply is limited worldwide (server-side), so each copy gets a serial number.
const FUSIONS = [
  { id: 'f_golden_bull',     name: 'Golden Bull',      role: 'tank',     parts: ['pinkbull', 'notcoin'] },
  { id: 'f_sky_hunters',     name: 'Sky Hunters',      role: 'archer',   parts: ['gramcat', 'utya'] },
  { id: 'f_frost_twins',     name: 'Frost Twins',      role: 'control',  parts: ['pengu', 'utya'] },
  { id: 'f_arctic_tide',     name: 'Arctic Tide',      role: 'healer',   parts: ['babyshark', 'pengu'] },
  { id: 'f_crystal_star',    name: 'Crystal Star',     role: 'mage',     parts: ['egor', 'memegram'] },
  { id: 'f_shadow_paw',      name: 'Shadow Paw',       role: 'assassin', parts: ['noctis', 'paws'] },
  { id: 'f_toxic_sage',      name: 'Toxic Sage',       role: 'mage',     parts: ['virus', 'yoda'] },
  { id: 'f_lantern_hug',     name: 'Lantern Hug',      role: 'support',  parts: ['teddy', 'yaya'] },
  { id: 'f_courier_cat',     name: 'Courier Cat',      role: 'archer',   parts: ['dog', 'gramcat'] },
  { id: 'f_legend_sentinel', name: 'Legend Sentinel',  role: 'tank',     parts: ['volya', 'notcoin'] },
  { id: 'f_bull_market',     name: 'Bull Market Boss', role: 'tank',     parts: ['pinkbull', 'teddy'] },
  { id: 'f_cosmic_sage',     name: 'Cosmic Sage',      role: 'mage',     parts: ['memegram', 'yoda'] },
  { id: 'f_plague_shadow',   name: 'Plague Shadow',    role: 'assassin', parts: ['noctis', 'virus'] },
  { id: 'f_lantern_reef',    name: 'Lantern Reef',     role: 'healer',   parts: ['babyshark', 'yaya'] },
  { id: 'f_crystal_claw',    name: 'Crystal Claw',     role: 'warrior',  parts: ['egor', 'paws'] },
  { id: 'f_sky_courier',     name: 'Sky Courier',      role: 'warrior',  parts: ['volya', 'dog'] },
  { id: 'f_ton_treasury',    name: 'TON Treasury',     role: 'tank',     parts: ['notcoin', 'pinkbull', 'teddy'] },
  { id: 'f_frozen_ocean',    name: 'Frozen Ocean',     role: 'control',  parts: ['babyshark', 'pengu', 'utya'] },
  { id: 'f_night_plague',    name: 'Night Plague',     role: 'assassin', parts: ['noctis', 'paws', 'virus'] },
  { id: 'f_crystal_cosmos',  name: 'Crystal Cosmos',   role: 'mage',     parts: ['egor', 'memegram', 'yoda'] },
  { id: 'f_legend_express',  name: 'Legend Express',   role: 'warrior',  parts: ['volya', 'dog', 'gramcat'] },
  { id: 'f_lantern_festival', name: 'Lantern Festival', role: 'support', parts: ['yaya', 'teddy', 'babyshark'] },
].map(f => ({ ...f, fusion: true, rarity: f.parts.length === 3 ? 'X' : 'M' }));
const FUSION_RULES = { 2: { minLevel: 8, cost: 4000, supply: 300 }, 3: { minLevel: 12, cost: 15000, supply: 30 } };
const BASE_HEROES = HEROES.slice();
HEROES.push(...FUSIONS);
const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
const STARTERS = ['pinkbull', 'egor', 'gramcat', 'memegram', 'babyshark'];
const MAX_LEVEL = 30;
const COIN_BONUS = { egor: 0.10, teddy: 0.20 };

// Each world is guarded by a themed squad of rival cards and a boss card that matches the world's art.
const WORLDS = [
  { key: 'ocean',  bg: 'linear-gradient(180deg,#0a4f8a,#0d7cc2 45%,#e9d39a)', boss: 'babyshark', foes: ['utya', 'pengu', 'dog', 'gramcat'] },
  { key: 'cave',   bg: 'linear-gradient(180deg,#071a3a,#123d7a 50%,#1b1f2e)', boss: 'egor',      foes: ['memegram', 'yoda', 'pengu', 'gramcat'] },
  { key: 'city',   bg: 'linear-gradient(180deg,#05061a,#1a1f6b 55%,#3a1a5c)', boss: 'notcoin',   foes: ['paws', 'pinkbull', 'teddy', 'volya'] },
  { key: 'temple', bg: 'linear-gradient(180deg,#2a0b2e,#8a1f2a 55%,#3b2318)', boss: 'yaya',      foes: ['dog', 'yoda', 'noctis', 'teddy'] },
  { key: 'lab',    bg: 'linear-gradient(180deg,#06210f,#145c2c 55%,#2d1f0e)', boss: 'virus',     foes: ['noctis', 'volya', 'paws', 'pinkbull'] },
];
const STAGES_PER_WORLD = 10;
const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;

function heroStats(id, level) {
  const h = HERO_BY_ID[id], r = ROLES[h.role];
  if (h.fusion) {
    // Fusion level 1 = its parts at the level required to fuse them; then boosted: duo ×1.5 HP / ×1.25 ATK, trio ×1.8 / ×1.4.
    const offset = (h.parts.length === 3 ? 12 : 8) - 1;
    const ps = h.parts.map(p => heroStats(p, level + offset)), k = ps.length === 3 ? [1.8, 1.4] : [1.5, 1.25];
    const avg = key => ps.reduce((a, s) => a + s[key], 0) / ps.length;
    return { hp: Math.round(avg('hp') * k[0]), atk: Math.round(avg('atk') * k[1]), spd: r.spd };
  }
  const m = RARITY[h.rarity].mult * (1 + 0.12 * (level - 1));
  return { hp: Math.round(r.hp * m), atk: Math.round(r.atk * m), spd: r.spd };
}

function upgradeCost(id, level) {
  const f = { C: 1, R: 1.3, E: 1.7, L: 2.2, M: 3, X: 4 }[HERO_BY_ID[id].rarity];
  return Math.round((40 * level + 8 * level * level) * f);
}

function stageReward(idx) {
  const boss = idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
  return Math.round((80 + 25 * idx) * (boss ? 3 : 1));
}

const ENEMY_HP = 0.56, ENEMY_ATK = 0.23;
function stageEnemies(idx) {
  const w = WORLDS[Math.floor(idx / STAGES_PER_WORLD)], local = idx % STAGES_PER_WORLD;
  const sc = 2.4 + 0.32 * idx;
  const card = (id, boss) => {
    const b = heroStats(id, 1), r = ROLES[HERO_BY_ID[id].role];
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
    bossCd: 7, poisonNext: 0,
  };
}
function newBattle(seed, pvp) {
  return { t: 0, tick: 0, seed: seed >>> 0, rng: mulberry32(seed >>> 0), nextUid: 1, events: [], over: null, pvp: !!pvp,
    autoBy: { hero: false, enemy: !pvp } };
}
function teamUnits(B, side, team, levels) {
  return team.map(id => { const s = heroStats(id, levels[id] || 1); return makeUnit(B, side, { ...HERO_BY_ID[id], ...s }); });
}
function createBattle(team, levels, idx, seed = (Math.random() * 2 ** 32) >>> 0) {
  const B = newBattle(seed, false);
  B.idx = idx;
  B.heroes = teamUnits(B, 'hero', team, levels);
  B.enemies = stageEnemies(idx).map(e => makeUnit(B, 'enemy', e));
  return B;
}
// PvP: side A plays as 'hero', side B as 'enemy'; both sides use the same (hero) rules.
function createPvpBattle(teamA, levelsA, teamB, levelsB, seed) {
  const B = newBattle(seed, true);
  B.heroes = teamUnits(B, 'hero', teamA, levelsA);
  B.enemies = teamUnits(B, 'enemy', teamB, levelsB);
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

function damage(B, src, tgt, amount, opts = {}) {
  if (!tgt || !tgt.alive) return 0;
  if (!opts.pure && on(B, tgt, 'dodge')) { B.events.push({ type: 'miss', uid: tgt.uid }); return 0; }
  let dmg = amount;
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
  const v = Math.round(Math.min(tgt.maxHp - tgt.hp, amount));
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
  notcoin(B, u) { for (const f of friendsOf(B, u)) { f.shield += u.maxHp * 0.25; B.events.push({ type: 'shield', uid: f.uid }); } },
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
  teddy(B, u) { const t = lowest(friendsOf(B, u)); heal(B, t, atkOf(B, u) * 3.5); t.shield += atkOf(B, u) * 2; B.events.push({ type: 'shield', uid: t.uid }); },
};
for (const f of FUSIONS) SKILLS[f.id] = (B, u) => { for (const p of f.parts) if (foesOf(B, u).length) SKILLS[p](B, u); };

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
  for (const u of [...B.heroes, ...B.enemies]) {
    if (!u.alive) continue;
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
  if (B.tick >= MAX_TICKS && !B.over) B.over = B.pvp ? 'draw' : 'lose';
}

// Server-side verification of a stage battle: replay it from its seed and the player's inputs.
function replayStage(team, levels, idx, seed, inputs) {
  const B = createBattle(team, levels, idx, seed);
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
  module.exports = { RARITY, ROLES, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, HERO_BY_ID, STARTERS, WORLDS, TOTAL_STAGES, STAGES_PER_WORLD, MAX_LEVEL, COIN_BONUS, TICK,
    heroStats, upgradeCost, stageReward, stageEnemies, createBattle, createPvpBattle, step, castSkill, applyInput, replayStage };
}
