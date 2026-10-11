// TON Legends — battle engine and game data (no DOM here, so it can be simulated in Node)

const RARITY = {
  C: { name: 'معمولی', color: '#9aa4b2', mult: 1.0 },
  R: { name: 'کمیاب', color: '#3fa2ff', mult: 1.15 },
  E: { name: 'حماسی', color: '#b66bff', mult: 1.3 },
  L: { name: 'افسانه‌ای', color: '#ffc531', mult: 1.5 },
};

const ROLES = {
  tank:     { name: 'تانک',     icon: '🛡️', hp: 1450, atk: 62,  spd: 1.4 },
  warrior:  { name: 'جنگجو',    icon: '⚔️', hp: 1000, atk: 96,  spd: 1.2 },
  assassin: { name: 'قاتل',     icon: '🗡️', hp: 760,  atk: 128, spd: 1.0 },
  archer:   { name: 'کماندار',  icon: '🏹', hp: 720,  atk: 108, spd: 1.1 },
  mage:     { name: 'جادوگر',   icon: '🔮', hp: 660,  atk: 118, spd: 1.5 },
  control:  { name: 'کنترل',    icon: '❄️', hp: 820,  atk: 90,  spd: 1.3 },
  healer:   { name: 'درمانگر',  icon: '💧', hp: 820,  atk: 72,  spd: 1.3 },
  support:  { name: 'پشتیبان',  icon: '✨', hp: 860,  atk: 76,  spd: 1.3 },
};

const HEROES = [
  { id: 'pinkbull',  name: 'Pink Bull',    title: 'تایتان طلایی',       role: 'tank',     rarity: 'R', skill: 'زمین‌لرزه',       desc: '۱۵۰٪ آسیب به همه دشمنان و گیج کردن آن‌ها به مدت ۱.۵ ثانیه' },
  { id: 'notcoin',   name: 'Notcoin',      title: 'نگهبان طلایی',       role: 'tank',     rarity: 'L', skill: 'سپر طلایی',       desc: 'به همه هم‌تیمی‌ها سپری برابر ۲۵٪ جان خودش می‌دهد' },
  { id: 'volya',     name: 'Volya',        title: 'نگهبان افسانه‌ها',   role: 'warrior',  rarity: 'L', skill: 'پرتو لیزری',      desc: '۴۵۰٪ آسیب به قوی‌ترین دشمن' },
  { id: 'egor',      name: 'Egor',         title: 'معدنچی کریستال',     role: 'warrior',  rarity: 'C', skill: 'شکستن زره',       desc: '۲۵۰٪ آسیب؛ دشمن ۵ ثانیه ۳۰٪ آسیب بیشتر می‌گیرد. (+۱۰٪ سکه)' },
  { id: 'paws',      name: 'PAWS',         title: 'ضربه‌زن پنجه ماه',   role: 'assassin', rarity: 'E', skill: 'پنجه آتشین',      desc: 'سه ضربه‌ی ۱۴۰٪ به دشمن جلویی' },
  { id: 'noctis',    name: 'Noctis Veyl',  title: 'سایه پنهان',         role: 'assassin', rarity: 'L', skill: 'ضربه سایه',       desc: '۵۰۰٪ آسیب به ضعیف‌ترین دشمن و ۳ ثانیه جاخالی دادن' },
  { id: 'gramcat',   name: 'Gramcat',      title: 'کماندار آسمان',      role: 'archer',   rarity: 'C', skill: 'تیر نافذ',        desc: '۱۷۰٪ آسیب به همه دشمنان' },
  { id: 'utya',      name: 'Utya',         title: 'پیشاهنگ بال یخی',    role: 'archer',   rarity: 'E', skill: 'باران یخ',        desc: '۱۴۰٪ آسیب به همه و کند کردن آن‌ها به مدت ۳ ثانیه' },
  { id: 'pengu',     name: 'Pengu',        title: 'تکاور قطبی',         role: 'control',  rarity: 'E', skill: 'انجماد',          desc: '۹۰٪ آسیب به همه و منجمد کردن ۲.۵ ثانیه' },
  { id: 'memegram',  name: 'Memegram',     title: 'جادوگر ستاره',       role: 'mage',     rarity: 'R', skill: 'انفجار ستاره‌ای', desc: '۲۲۰٪ آسیب به همه دشمنان' },
  { id: 'yoda',      name: 'Yoda',         title: 'حکیم باستانی',       role: 'mage',     rarity: 'E', skill: 'نیروی ذهن',       desc: '۱۹۰٪ آسیب به همه و عقب انداختن حمله‌ی دشمنان' },
  { id: 'virus',     name: 'Virus',        title: 'کیمیاگر سبز',        role: 'mage',     rarity: 'R', skill: 'معجون سمی',       desc: 'سم روی همه (۶۰٪ در ثانیه، ۵ ثانیه) و ۲۵٪ کاهش حمله‌ی دشمنان' },
  { id: 'babyshark', name: 'Baby Shark',   title: 'روح اقیانوس',        role: 'healer',   rarity: 'R', skill: 'گرداب شفا',       desc: '۲۵۰٪ درمان برای همه هم‌تیمی‌ها' },
  { id: 'yaya',      name: 'Yaya',         title: 'نگهبان فانوس',       role: 'support',  rarity: 'C', skill: 'فانوس جادویی',    desc: '۴۰٪ افزایش حمله‌ی تیم به مدت ۶ ثانیه و کمی درمان' },
  { id: 'dog',       name: 'telegram.dog', title: 'پیک جادویی',         role: 'support',  rarity: 'C', skill: 'نامه فوری',       desc: '۵۰ انرژی به همه‌ی هم‌تیمی‌ها می‌دهد' },
  { id: 'teddy',     name: 'Teddy',        title: 'رئیس مهربان',        role: 'support',  rarity: 'R', skill: 'بغل طلایی',       desc: '۳۵۰٪ درمان برای ضعیف‌ترین هم‌تیمی و سپر. (+۲۰٪ سکه)' },
];
const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
const STARTERS = ['pinkbull', 'egor', 'gramcat', 'memegram', 'babyshark'];
const MAX_LEVEL = 30;
const COIN_BONUS = { egor: 0.10, teddy: 0.20 };

const WORLDS = [
  { name: 'اقیانوس عمیق',     bg: 'linear-gradient(180deg,#0a4f8a,#0d7cc2 45%,#e9d39a)', foes: [['🦀', 'خرچنگ', 1, 1], ['🐙', 'اختاپوس', 1.2, 0.9], ['🐡', 'بادکنک‌ماهی', 0.8, 1.3]], boss: ['🐋', 'نهنگ غول‌پیکر'] },
  { name: 'غار کریستال',      bg: 'linear-gradient(180deg,#071a3a,#123d7a 50%,#1b1f2e)', foes: [['🦇', 'خفاش', 0.8, 1.3], ['🪨', 'سنگ‌غول', 1.5, 0.8], ['🕷️', 'عنکبوت', 1, 1.1]], boss: ['🐉', 'اژدهای کریستالی'] },
  { name: 'شهر نئونی',        bg: 'linear-gradient(180deg,#05061a,#1a1f6b 55%,#3a1a5c)', foes: [['🤖', 'ربات', 1.3, 0.9], ['👾', 'هکر', 0.9, 1.2], ['🛰️', 'پهپاد', 0.8, 1.3]], boss: ['🛸', 'سفینه‌ی مادر'] },
  { name: 'معبد فانوس',       bg: 'linear-gradient(180deg,#2a0b2e,#8a1f2a 55%,#3b2318)', foes: [['👺', 'شیطانک', 1, 1.1], ['🐍', 'مار', 0.9, 1.2], ['🏮', 'فانوس نفرین‌شده', 1.3, 0.9]], boss: ['🐲', 'اژدهای سرخ'] },
  { name: 'آزمایشگاه سبز',    bg: 'linear-gradient(180deg,#06210f,#145c2c 55%,#2d1f0e)', foes: [['🧟', 'زامبی', 1.4, 0.9], ['🍄', 'قارچ سمی', 0.9, 1.2], ['🦂', 'عقرب', 1, 1.15]], boss: ['💀', 'جادوگر تاریکی'] },
];
const STAGES_PER_WORLD = 10;
const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;

function heroStats(id, level) {
  const h = HERO_BY_ID[id], r = ROLES[h.role];
  const m = RARITY[h.rarity].mult * (1 + 0.12 * (level - 1));
  return { hp: Math.round(r.hp * m), atk: Math.round(r.atk * m), spd: r.spd };
}

function upgradeCost(id, level) {
  const f = { C: 1, R: 1.3, E: 1.7, L: 2.2 }[HERO_BY_ID[id].rarity];
  return Math.round((40 * level + 8 * level * level) * f);
}

function stageReward(idx) {
  const boss = idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
  return Math.round((80 + 25 * idx) * (boss ? 3 : 1));
}

function stageEnemies(idx) {
  const w = WORLDS[Math.floor(idx / STAGES_PER_WORLD)], local = idx % STAGES_PER_WORLD;
  const sc = 2.4 + 0.32 * idx;
  const base = { hp: 700 * sc, atk: 31 * sc, spd: 1.6 };
  const list = [];
  const minion = (i) => {
    const f = w.foes[i % w.foes.length];
    return { emoji: f[0], name: f[1], hp: base.hp * f[2], atk: base.atk * f[3], spd: base.spd };
  };
  if (local === STAGES_PER_WORLD - 1) {
    list.push(minion(0));
    list.push({ emoji: w.boss[0], name: w.boss[1], hp: base.hp * 5, atk: base.atk * 1.5, spd: 1.8, boss: true });
    list.push(minion(1));
  } else {
    const n = Math.min(5, 2 + Math.floor(local / 2.5));
    for (let i = 0; i < n; i++) list.push(minion(i + local));
  }
  return list;
}

// ---------- battle ----------
let UID = 1;
function makeUnit(side, o) {
  return {
    uid: UID++, side, id: o.id || null, name: o.name, emoji: o.emoji || null, role: o.role || null, boss: !!o.boss,
    maxHp: Math.round(o.hp), hp: Math.round(o.hp), atk: o.atk, spd: o.spd,
    timer: Math.random() * o.spd * 0.6, energy: side === 'hero' ? 20 : 0, shield: 0, fx: {}, alive: true,
    bossCd: 7, poisonNext: 0,
  };
}

function createBattle(team, levels, idx) {
  const B = { t: 0, idx, events: [], over: null, auto: false };
  B.heroes = team.map(id => { const s = heroStats(id, levels[id] || 1); return makeUnit('hero', { ...HERO_BY_ID[id], ...s }); });
  B.enemies = stageEnemies(idx).map(e => makeUnit('enemy', e));
  return B;
}

const alive = arr => arr.filter(u => u.alive);
const on = (B, u, k) => (u.fx[k] || 0) > B.t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
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
  if (src && src.side === 'hero' && !opts.pure && Math.random() < 0.12) { dmg *= 1.6; crit = true; }
  dmg = Math.max(1, Math.round(dmg * (0.92 + Math.random() * 0.16)));
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; if (dmg === 0) { B.events.push({ type: 'block', uid: tgt.uid }); return 0; } }
  tgt.hp -= dmg;
  if (tgt.side === 'hero') tgt.energy = Math.min(100, tgt.energy + 3);
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
  if (u.role === 'archer' || u.role === 'mage') return pick(foes);
  return foes[0];
}

function enemyTarget(B, u) {
  const hs = alive(B.heroes);
  const tanks = hs.filter(h => h.role === 'tank');
  if (tanks.length && Math.random() < 0.7) return pick(tanks);
  const front = hs.filter(h => h.role === 'warrior' || h.role === 'assassin' || h.role === 'tank');
  if (front.length && Math.random() < 0.5) return pick(front);
  return pick(hs);
}

function basicAttack(B, u) {
  if (u.side === 'hero') {
    const t = heroTarget(B, u);
    if (!t) return;
    B.events.push({ type: 'atk', uid: u.uid, target: t.uid });
    damage(B, u, t, atkOf(B, u));
    if (u.role === 'healer') heal(B, lowest(friendsOf(B, u)), atkOf(B, u) * 0.5);
    u.energy = Math.min(100, u.energy + 14);
  } else {
    const t = enemyTarget(B, u);
    if (!t) return;
    B.events.push({ type: 'atk', uid: u.uid, target: t.uid });
    damage(B, u, t, atkOf(B, u));
  }
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

function castSkill(B, u) {
  if (!u.alive || u.energy < 100 || B.over || !foesOf(B, u).length) return false;
  u.energy = 0;
  B.events.push({ type: 'skill', uid: u.uid, id: u.id });
  SKILLS[u.id](B, u);
  checkEnd(B);
  return true;
}

function checkEnd(B) {
  if (B.over) return;
  if (!alive(B.enemies).length) B.over = 'win';
  else if (!alive(B.heroes).length) B.over = 'lose';
}

function step(B, dt) {
  if (B.over) return;
  B.t += dt;
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
    if (B.auto && u.side === 'hero' && u.energy >= 100) castSkill(B, u);
  }
  checkEnd(B);
  if (B.t > 120 && !B.over) B.over = 'lose'; // time limit
}

if (typeof module !== 'undefined') {
  module.exports = { RARITY, ROLES, HEROES, HERO_BY_ID, STARTERS, WORLDS, TOTAL_STAGES, STAGES_PER_WORLD, MAX_LEVEL,
    heroStats, upgradeCost, stageReward, stageEnemies, createBattle, step, castSkill };
}
