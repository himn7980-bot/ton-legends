// Gram Legends — battle engine and game data (no DOM here, so it can be simulated in Node)

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
// Every fusion card has its own name (shown under the card in battle). 22 are hand-named in fusions-data.js;
// the rest are built from one word per part: [first word, second word, third word (trios)]. The word order
// rotates with the card number for variety, and every combination of heroes gives a different name.
const FUSION_WORDS = {
  pinkbull: ['Raging', 'Bull', 'Titan'], notcoin: ['Golden', 'Sentinel', 'Vault'], volya: ['Legend', 'Guardian', 'Hero'],
  egor: ['Crystal', 'Miner', 'Quake'], paws: ['Lunar', 'Claw', 'Fang'], noctis: ['Shadow', 'Phantom', 'Eclipse'],
  gramcat: ['Sky', 'Archer', 'Arrow'], utya: ['Frost', 'Wing', 'Storm'], pengu: ['Polar', 'Ranger', 'Glacier'],
  memegram: ['Star', 'Mage', 'Nova'], yoda: ['Ancient', 'Sage', 'Oracle'], virus: ['Toxic', 'Plague', 'Venom'],
  babyshark: ['Ocean', 'Shark', 'Tide'], yaya: ['Lantern', 'Keeper', 'Flame'], dog: ['Swift', 'Courier', 'Express'],
  teddy: ['Velvet', 'Bear', 'Boss'],
};
function fusionName(num, parts) {
  const k = parts.length, r = num % k, order = parts.slice(r).concat(parts.slice(0, r));
  return order.map((p, i) => FUSION_WORDS[p][i]).join(' ');
}
const FUSIONS = FD.FUSION_DATA.map(([num, parts, name, role]) => ({
  id: 'f' + num, num, parts, fusion: true, rarity: parts.length === 3 ? 'X' : 'M',
  name: name || fusionName(num, parts),
  role: role || HEROES.find(h => h.id === parts[0]).role,
}));
const LEGACY_FUSION_IDS = FD.LEGACY_FUSION_IDS;
const FUSION_K = { duo: [1.2, 1.05, 0.6], trio: [1.3, 1.1, 0.45] };
// Per-alliance stat factor (same order as FUSION_DATA), written by tools/balance-fusions.js: it pulls the strongest and
// weakest alliances toward the middle so the choice of parts matters, without one combo being far ahead of the rest.
const FUSION_ADJ = [0.716, 0.903, 0.991, 0.977, 0.94, 1.017, 0.991, 0.696, 0.991, 0.932, 0.991, 1.019, 1.019, 0.981, 1, 0.991, 0.991, 1, 0.822, 1.065, 0.87, 0.806, 1.019, 0.87, 0.816, 0.991, 0.991, 1, 0.857, 1.019, 1.055, 0.911, 1.182, 0.981, 0.767, 1.095, 0.913, 0.953, 1.047, 1.019, 1.037, 1.072, 1.164, 0.95, 1.436, 1.009, 0.767, 1.13, 1.037, 1.15, 2, 1.203, 1.253, 1.431, 0.723, 1.009, 0.911, 0.6, 1.025, 0.813, 0.753, 0.991, 1, 0.981, 0.965, 0.934, 0.789, 0.6, 0.824, 0.625, 0.659, 0.87, 0.908, 0.725, 0.794, 1.15, 0.6, 1.366, 1.019, 0.972, 1.103, 1.103, 1.191, 1.142, 0.6, 1.037, 0.696, 0.857, 1.009, 1.094, 1.009, 1, 0.724, 0.6, 0.739, 0.788, 0.849, 0.6, 0.614, 1.203, 1.028, 1.4, 1.436, 1.164, 1.321, 0.981, 1.047, 1.125, 0.962, 1.019, 1.085, 1.4, 1.056, 1.037, 1.315, 1.009, 1.019, 1.056, 1.195, 1.125, 0.778, 0.674, 0.875, 0.812, 0.928, 0.812, 0.767, 0.918, 0.874, 0.868, 0.881, 0.812, 0.674, 0.857, 0.952, 0.969, 0.913, 1.02, 0.976, 0.917, 1.01, 0.949, 0.976, 1.01, 0.981, 0.949, 0.857, 1.01, 0.98, 1.093, 0.99, 0.937, 1.088, 0.99, 1.028, 1.01, 1.01, 1, 1, 0.99, 1.115, 0.99, 0.937, 1.075, 1, 1.028, 1.01, 1.01, 1, 1, 1.018, 0.959, 0.93, 1.018, 0.969, 0.962, 0.906, 0.975, 0.967, 0.937, 1.079, 0.99, 1.116, 1.05, 1.051, 1.093, 1.061, 1.065, 1.06, 0.906, 1.048, 1, 1.02, 1.056, 1.019, 1, 1, 0.974, 0.943, 0.906, 0.967, 0.943, 0.943, 0.943, 1.079, 1.041, 1.079, 1.051, 1.048, 1.03, 1.025, 1.01, 1, 1, 1, 1.038, 1.033, 1.018, 1, 1.02, 1.01, 1, 1.025, 1.01, 1, 1.044, 1.065, 0.687, 1.223, 0.906, 0.767, 1.478, 0.943, 1.01, 1.079, 1.033, 1.02, 1, 1.16, 0.875, 1.156, 1.033, 0.741, 1.199, 1.012, 1.05, 1.115, 1.165, 1.012, 0.996, 0.855, 1.153, 1.033, 0.808, 1.162, 1.041, 1.042, 1.051, 1.246, 1.025, 1, 0.988, 0.739, 0.6, 0.857, 0.845, 0.965, 0.82, 0.859, 0.875, 0.875, 1.056, 0.917, 1.342, 1.02, 1.036, 1.188, 1.18, 1.079, 1.246, 0.812, 1.056, 0.969, 0.981, 0.99, 0.98, 1, 0.959, 0.827, 0.887, 0.808, 0.777, 0.887, 0.6, 0.6, 1.01, 1.03, 1.223, 1.156, 1.104, 1.115, 0.963, 1.01, 1.012, 0.981, 0.962, 1.01, 1.01, 1.033, 0.976, 1.076, 1.246, 1.056, 1.16, 0.992, 0.99, 1.241, 1.056, 1.209, 1.056, 0.723, 1.25, 1, 1.05, 1.071, 1.081, 1.214, 1.031, 1.01, 1.18, 1.165, 0.808, 1.241, 1, 1.01, 1.129, 1.121, 1.061, 1.071, 1.01, 1.01, 0.723, 1.01, 0.894, 0.938, 1, 1.056, 1.01, 1, 1.177, 0.855, 1.443, 1.115, 1.079, 1.336, 1.182, 1.443, 1.209, 0.767, 1.214, 0.99, 0.967, 1.05, 1.031, 0.99, 0.988, 0.836, 0.705, 0.693, 0.887, 0.762, 0.6, 0.702, 1.044, 1.031, 2, 1.188, 1.241, 1.071, 0.894, 1.02, 1.025, 0.994, 0.99, 1.025, 1.02, 1.031, 0.976, 1.348, 1.092, 1.102, 1.129, 1.214, 1.16, 1, 1.308, 1.129, 0.703, 1.209, 1.051, 1.214, 1.18, 1.161, 1.137, 1.443, 1.051, 0.98, 0.736, 1.051, 0.959, 0.857, 1.01, 1.031, 1.02, 0.99, 1.177, 0.859, 1.788, 1.051, 1.241, 1.262, 1.262, 1.264, 1.336, 0.836, 1.153, 1, 0.99, 1.101, 1.16, 1.05, 1.056, 0.855, 0.682, 0.635, 0.6, 0.6, 0.767, 0.752, 1.279, 1.162, 1.241, 1.25, 1.153, 1.354, 0.99, 1.165, 1.031, 1.01, 1.056, 1.214, 1.478, 1.246, 1.01, 1.277, 1.443, 1.276, 1.276, 1.639, 1.246, 0.859, 0.836, 0.6, 0.858, 0.718, 0.762, 0.833, 0.833, 0.88, 0.895, 0.981, 0.6, 1.214, 0.903, 0.959, 1.041, 1.079, 1.025, 1.056, 0.6, 0.976, 0.703, 0.836, 0.988, 0.99, 1.01, 0.969, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.674, 0.949, 1.052, 1.014, 1.01, 0.99, 0.814, 0.928, 0.949, 0.99, 0.929, 0.952, 0.98, 0.992, 0.881, 1.16, 1.199, 1.033, 1.104, 1.103, 1.246, 0.903, 0.6, 0.949, 0.833, 0.64, 0.952, 0.952, 0.952, 0.906, 0.6, 0.858, 0.701, 0.749, 0.82, 0.859, 0.922, 0.778, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.788, 0.735, 0.956, 0.959, 0.949, 0.959, 0.705, 0.85, 0.836, 0.798, 0.752, 0.788, 0.741, 0.788, 0.752, 0.945, 0.925, 0.674, 0.903, 0.845, 0.946, 0.6, 1.188, 1, 0.925, 1.071, 1.071, 1.639, 1.348, 0.856, 0.654, 0.6, 0.856, 0.6, 0.856, 0.856, 1.354, 1.056, 2, 1.673, 1.289, 1.103, 0.938, 1.06, 1.104, 1.188, 1.028, 1.01, 0.99, 0.99, 0.976, 1.402, 1.289, 1.276, 1.304, 1.093, 1.405, 0.6, 0.6, 0.6, 0.949, 0.6, 0.856, 0.6, 0.969, 0.962, 1.104, 1.067, 1.092, 1.076, 0.858, 0.906, 0.969, 0.99, 0.739, 0.82, 0.82, 0.943, 0.812, 1.031, 1.101, 1.014, 1.137, 1.01, 1.06, 0.808, 0.741, 0.859, 0.928, 0.703, 0.904, 0.6, 0.6, 0.6, 0.6, 0.6, 0.808, 0.735, 0.6, 0.752, 0.845, 0.6, 0.801, 0.6, 0.812, 0.856, 1.079, 1.478, 1.071, 1.056, 1.16, 1.246, 1.081, 1.101, 1.115, 1.378, 2, 1.812, 1.132, 2, 1.67, 0.99, 1.031, 1, 1.031, 1.279, 1, 1.071, 1.02, 1.348, 1.01, 1.308, 1.548, 1.241, 1.405, 1.443, 1.246, 1.348, 1.812, 1.165, 1.112];
FUSIONS.forEach((f, i) => { f.adj = FUSION_ADJ[i] || 1; });
// Fusion is one simple rule: pick any 2 (duo) or 3 (trio) of your heroes and pay the coins. The heroes are kept,
// and the new card starts at their average level. `boost`: a fusion fights like its parts that many levels higher.
const FUSION_RULES = { 2: { cost: 5000, supply: 300, boost: 6 }, 3: { cost: 20000, supply: 30, boost: 12 } };
const fusionStartLevel = (owned, parts) => Math.max(1, Math.floor(parts.reduce((a, p) => a + (owned[p] || 1), 0) / parts.length));
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
// Each theme's boss has a weak spot: while it suffers that status it takes double damage.
const BOSS_WEAK = { ocean: 'slow', cave: 'vuln', city: 'stun', temple: 'poison', lab: 'freeze' };
const WEAK_BY = { slow: ['utya'], vuln: ['egor'], stun: ['pinkbull', 'pengu'], poison: ['virus'], freeze: ['pengu'] };
const CHAPTER_TINT = ['', 'linear-gradient(180deg,rgba(90,0,140,.30),rgba(0,0,0,.25)),', 'linear-gradient(180deg,rgba(150,10,40,.35),rgba(0,0,0,.35)),',
  'linear-gradient(180deg,rgba(0,0,0,.55),rgba(60,0,90,.45)),'];
const WORLDS = [];
for (let ch = 0; ch < 4; ch++) {
  for (const key of ['ocean', 'cave', 'city', 'temple', 'lab']) {
    const th = THEMES[key];
    WORLDS.push({ key, chapter: ch, bg: CHAPTER_TINT[ch] + th.bg, boss: th.boss[ch], foes: th.foes[ch], weak: BOSS_WEAK[key] });
  }
}
const STAGES_PER_WORLD = 10;
const TOTAL_STAGES = WORLDS.length * STAGES_PER_WORLD;

function heroStats(id, level) {
  const h = HERO_BY_ID[id], r = ROLES[h.role];
  if (h.fusion) {
    // Fusion level 1 = its parts at the level required to fuse them, then boosted (FUSION_K: [HP, ATK, skill power]).
    const offset = FUSION_RULES[h.parts.length].boost;
    const ps = h.parts.map(p => heroStats(p, level + offset)), k = ps.length === 3 ? [FUSION_K.trio[0], FUSION_K.trio[1]] : [FUSION_K.duo[0], FUSION_K.duo[1]];
    const avg = key => ps.reduce((a, s) => a + s[key], 0) / ps.length;
    return { hp: Math.round(avg('hp') * k[0] * h.adj), atk: Math.round(avg('atk') * k[1] * h.adj), spd: r.spd };
  }
  const m = RARITY[h.rarity].mult * (1 + 0.12 * (level - 1));
  return { hp: Math.round(r.hp * m), atk: Math.round(r.atk * m), spd: r.spd };
}

// Grows a little faster than linear: early levels stay cheap, the last levels (the late-game) cost about 3× more.
const UPGRADE_CURVE = 20;
function upgradeCost(id, level) {
  const f = { C: 1, R: 1.3, E: 1.7, L: 2.2, M: 3, X: 4 }[HERO_BY_ID[id].rarity];
  return Math.round((60 + 90 * level) * f * (1 + level / UPGRADE_CURVE));
}

function stageReward(idx) {
  const boss = idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
  return Math.round((80 + 25 * idx) * (boss ? 3 : 1));
}

const ENEMY_HP = 0.56, ENEMY_ATK = 0.23, SC2 = 0.13;
// Worlds 1–4 keep their original hand-tuned curve (made for the starter cards); calibration starts at world 5.
const CALIBRATED_FROM = 20;
// Per-stage difficulty factor (worlds 3–20), calibrated by tools/calibrate.js against several reference teams so
// the level a stage needs rises smoothly: a little easier at a world's start, a bump for the boss.
const STAGE_K = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.885, 2.112, 1.719, 1.39, 1.675, 1.008, 1.144, 1.295, 0.995, 1.273, 2.205, 1.726, 2.099, 1.826, 1.571, 1.417, 1.329, 1.335, 1.276, 1.528, 1.895, 2.173, 2.542, 1.399, 1.477, 1.275, 1.219, 1.14, 1.057, 1.249, 2.298, 2.724, 2.432, 1.536, 1.91, 1.609, 1.396, 1.421, 1.4, 1.304, 2.673, 2.922, 2.333, 2.024, 2.182, 1.582, 1.809, 1.745, 1.502, 1.533, 2.049, 2.078, 2.538, 1.927, 1.674, 1.704, 1.57, 1.589, 1.427, 1.547, 4.695, 4.214, 2.381, 2.246, 3.287, 1.742, 1.918, 1.974, 1.599, 2.362, 2.394, 2.006, 2.204, 1.714, 1.898, 1.453, 1.436, 1.449, 1.298, 1.329, 3.071, 2.497, 2.246, 2.118, 1.964, 1.515, 1.605, 1.647, 1.386, 1.87, 2.434, 2.52, 2.841, 2.088, 2.066, 2.03, 1.932, 1.759, 1.693, 1.735, 2.821, 2.307, 2.145, 2.043, 1.789, 1.338, 1.662, 1.586, 1.255, 1.835, 4.481, 2.778, 3.449, 3.574, 2.58, 2.288, 2.738, 2.187, 1.945, 2.687, 2.294, 3.454, 2.518, 1.851, 2.069, 1.635, 1.467, 1.634, 1.448, 1.652, 2.983, 3.439, 3.28, 2.208, 2.526, 1.786, 1.807, 1.971, 1.601, 1.782, 2.633, 3.005, 2.757, 2.365, 2.339, 2.006, 1.928, 2.043, 1.858, 1.754, 2.834, 2.741, 2.739, 2.133, 2.246, 2.023, 1.728, 1.859, 1.785, 1.856, 4.565, 4.237, 4.394, 3.61, 3.334, 2.668, 2.632, 2.739, 2.461, 2.821, 3.244, 3.056, 2.15, 2.106, 2.354, 1.725, 1.859, 1.833, 1.551, 1.907];
// Tower story: every 10th floor is a villain of the Silo Empire (parody rivals of the free network). A villain fights
// with a hero's skill set (base) under its own face (skin), flanked by two minions; its twist is a battle rule (mod).
const VILLAINS = {
  spam:    { base: 'virus',    weak: 'stun',   mod: null,     minion: 'egor',     icon: '🤖', mIcon: '📨', col: ['#1d2333', '#5d6b86'] },
  gas:     { base: 'pinkbull', weak: 'freeze', mod: 'swift',  minion: 'dog',      icon: '⛽', mIcon: '🧾', col: ['#3a1a0a', '#b5651d'] },
  rug:     { base: 'paws',     weak: 'slow',   mod: 'toxic',  minion: 'gramcat',  icon: '🐀', mIcon: '🪙', col: ['#2a1630', '#8a4fa8'] },
  pump:    { base: 'volya',    weak: 'vuln',   mod: 'glass',  minion: 'memegram', icon: '📈', mIcon: '📣', col: ['#0f2a16', '#2fa84f'] },
  bitcorn: { base: 'notcoin',  weak: 'poison', mod: null,     minion: 'egor',     icon: '🌽', mIcon: '⛏️', col: ['#3a2200', '#f7931a'] },
  hydra:   { base: 'yoda',     weak: 'stun',   mod: 'toxic',  minion: 'virus',    icon: '🐉', mIcon: '💨', col: ['#14143a', '#6f7bd8'] },
  bubble:  { base: 'teddy',    weak: 'vuln',   mod: 'noult',  minion: 'pengu',    icon: '💬', mIcon: '✔️', col: ['#06301e', '#25d366'] },
  eye:     { base: 'pengu',    weak: 'poison', mod: 'swift',  minion: 'utya',     icon: '👁️', mIcon: '🍪', col: ['#101a33', '#3b82f6'] },
  meta:    { base: 'noctis',   weak: 'freeze', mod: 'glass',  minion: 'paws',     icon: '🥽', mIcon: '🕶️', col: ['#0b1030', '#4f6cff'] },
  silo:    { base: 'volya',    weak: 'slow',   mod: 'noult',  minion: 'notcoin',  icon: '🏛️', mIcon: '🔒', col: ['#1a1a1a', '#9a9a9a'] },
};
const TOWER_STORY = Object.keys(VILLAINS), STORY_EVERY = 10;
const villainAt = floor => (floor > 0 && floor % STORY_EVERY === 0 ? TOWER_STORY[(floor / STORY_EVERY - 1) % TOWER_STORY.length] : null);
function stageEnemies(idx, villain = null) {
  const w = WORLDS[Math.floor(idx / STAGES_PER_WORLD)], local = idx % STAGES_PER_WORLD;
  // Difficulty follows the level a team of five non-fusion cards needs: ~5 at stage 20, ~45 at stage 100, ~95 at stage 200.
  // The per-stage factor (tools/calibrate.js) evens out how strong each stage's line-up is.
  const sc = (idx < 50 ? 2.4 + 0.32 * idx : 18.08 + SC2 * (idx - 50)) * (idx < CALIBRATED_FROM ? 1 : STAGE_K[idx] || 1);
  const card = (id, boss) => {
    const h = HERO_BY_ID[id], r = ROLES[h.role];
    // Enemy fusion cards bring their combined skills, not the fusion level bonus (that would make chapters III–IV a wall).
    const b = h.fusion ? h.parts.map(p => heroStats(p, 1)).reduce((a, x) => ({ hp: a.hp + x.hp / h.parts.length, atk: a.atk + x.atk / h.parts.length }), { hp: 0, atk: 0 }) : heroStats(id, 1);
    const hpM = boss ? 3.2 : 1, atkM = boss ? 1.35 : 1;
    return { id, role: HERO_BY_ID[id].role, name: HERO_BY_ID[id].name, boss: !!boss, weak: boss ? w.weak : null,
      hp: b.hp * ENEMY_HP * sc * hpM, atk: b.atk * ENEMY_ATK * sc * atkM * (r.spd / 1.3), spd: r.spd };
  };
  const V = villain && VILLAINS[villain];
  if (V) {
    const boss = card(V.base, true), m = i => ({ ...card(V.minion), skin: 'v:' + villain + ':m', name: '' });
    return [m(0), { ...boss, skin: 'v:' + villain, name: '', weak: V.weak }, m(1)];
  }
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
    uid: B.nextUid++, side, id: o.id, skin: o.skin || null, name: o.name, role: o.role, boss: !!o.boss, weak: o.weak || null, row: o.row || 'front',
    maxHp: Math.round(o.hp), hp: Math.round(o.hp), atk: o.atk, spd: o.spd,
    timer: B.rng() * o.spd * 0.6, energy: side === 'hero' || B.pvp ? 20 : 0, shield: 0, fx: {}, alive: true,
    bossCd: 7, poisonNext: 0, shieldUntil: 0, skillK: 1,
  };
}
function newBattle(seed, pvp) {
  return { t: 0, tick: 0, seed: seed >>> 0, rng: mulberry32(seed >>> 0), nextUid: 1, events: [], over: null, pvp: !!pvp,
    autoBy: { hero: false, enemy: !pvp }, ult: { hero: 0, enemy: 0 }, casting: false, comboSeen: null,
    castMul: 1, focus: { hero: 0, enemy: 0 }, chain: { hero: { n: 0, at: -99 }, enemy: { n: 0, at: -99 } }, perfects: 0, maxChain: 0, mod: null };
}
// ---------- skill play (only a player's own taps count; Auto never gets these) ----------
// Perfect: a skill tapped PERFECT_FROM..PERFECT_TO ticks after its card filled up hits PERFECT_MULT harder.
const PERFECT_FROM = 2, PERFECT_TO = 15, PERFECT_MULT = 1.25;
// Chain: skills tapped within CHAIN_GAP s of each other build a chain; each link adds CHAIN_STEP (up to CHAIN_MAX).
const CHAIN_GAP = 2.5, CHAIN_STEP = 0.08, CHAIN_MAX = 1.4;
// Boss weak spot: every EXPOSE_EVERY s a boss opens up for EXPOSE_FOR s; skills that hit it then deal ×EXPOSE_MULT.
const EXPOSE_EVERY = 7, EXPOSE_AT = 4, EXPOSE_FOR = 1.5, EXPOSE_MULT = 1.75;
const exposed = (B, u) => !!(u && u.boss && !B.pvp && (B.t % EXPOSE_EVERY) >= EXPOSE_AT && (B.t % EXPOSE_EVERY) < EXPOSE_AT + EXPOSE_FOR);
// Aimed ultimate: the ultimate hits the focused enemy AIM_MULT harder.
const AIM_MULT = 1.35;
// Treasure goblin (stages): sometimes runs across the field for a moment — tap it to catch it (coins, maybe a gem).
const GOBLIN_CHANCE = 0.125, GOBLIN_FOR = 2.5;
// Challenge modifiers (daily challenge): change the rules for both sides.
const MODS = { glass: { hp: 0.6, atk: 1.4 }, toxic: { poison: 2 }, swift: { spd: 0.75 }, noult: { noUlt: true } };
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
  return (market[id] || 1) * (1 + Math.max(0, ...h.parts.map(p => (market[p] || 1) - 1)) * 0.5);
}
// Formation: the first two cards stand in the front row; while a front-row ally stands, back-row cards
// take less damage from basic attacks (tanks in front, archers and mages behind).
const FRONT = 2, BACK_GUARD = 0.65;
const rowOf = i => (i < FRONT ? 'front' : 'back');
// perks: collection-set bonuses { hp: 0.05, atk: 0.05, energy: 25 } for the whole team.
// Deck synergies: card pairings that make the whole deck stronger (green) — or weaker (red, `bad`). Alliance cards
// count as every hero on them (they fire all those skills). The first two cards are the front row.
const BURST = ['volya', 'noctis', 'paws', 'egor'], AREA = ['gramcat', 'utya', 'memegram', 'yoda'];
const SYNERGIES = [
  { id: 'wall', ico: '🛡️', fx: { hp: 0.08 }, test: d => d.front.includes('tank') },
  { id: 'lifeline', ico: '💧', fx: { hp: 0.06 }, test: d => d.roles.includes('tank') && (d.roles.includes('healer') || d.roles.includes('support')) },
  { id: 'shatter', ico: '❄️', fx: { atk: 0.08 }, test: d => d.any(['pengu', 'pinkbull']) && d.any(BURST) },
  { id: 'plague', ico: '☠️', fx: { atk: 0.06 }, test: d => d.any(['virus']) && d.any(AREA) },
  { id: 'charge', ico: '⚡', fx: { energy: 15 }, test: d => d.any(['dog']) && d.roles.includes('mage') },
  { id: 'balance', ico: '🌈', fx: { hp: 0.04, atk: 0.04 }, test: d => new Set(d.roles).size >= 4 },
  { id: 'exposed', ico: '⚠️', bad: true, fx: { hp: -0.08 }, test: d => d.size >= 3 && !d.front.some(r => r === 'tank' || r === 'warrior') },
  { id: 'crowd', ico: '⚠️', bad: true, fx: { atk: -0.06 }, test: d => Math.max(...Object.values(d.roles.reduce((a, r) => ((a[r] = (a[r] || 0) + 1), a), {}))) >= 3 },
];
function deckSynergies(team) {
  const hs = (team || []).map(id => HERO_BY_ID[id]).filter(Boolean);
  const heroes = new Set(hs.flatMap(h => (h.fusion ? h.parts : [h.id])));
  const d = { size: hs.length, roles: hs.map(h => h.role), front: hs.slice(0, FRONT).map(h => h.role), any: ids => ids.some(id => heroes.has(id)) };
  const on = hs.length ? SYNERGIES.filter(x => x.test(d)) : [];
  const fx = { hp: 0, atk: 0, energy: 0 };
  for (const x of on) for (const k in x.fx) fx[k] += x.fx[k];
  return { ids: on.map(x => x.id), fx };
}
function teamUnits(B, side, team, levels, faction, market, perks) {
  const pk = perks || {}, sy = deckSynergies(team).fx, cb = 1 + (pk.comeback || 0);
  return team.map((id, i) => {
    const h = HERO_BY_ID[id], ms = pk.mascot && faction ? (id === faction ? pk.mascot : h && h.fusion && h.parts.includes(faction) ? pk.mascot / 2 : 0) : 0;
    const s = heroStats(id, levels[id] || 1), k = factionMult(id, faction) * marketMult(id, market) * (1 + ms) * cb;
    const u = makeUnit(B, side, { ...HERO_BY_ID[id], ...s, hp: s.hp * k * (1 + (pk.hp || 0)) * (1 + sy.hp), atk: s.atk * k * (1 + (pk.atk || 0)) * (1 + sy.atk), row: rowOf(i) });
    u.energy = Math.min(100, u.energy + (pk.energy || 0) + sy.energy);
    return u;
  });
}
// opts: { enemyMult (hard mode / tower), mod (challenge modifier key), goblin: false to turn the goblin off }
function createBattle(team, levels, idx, seed = (Math.random() * 2 ** 32) >>> 0, faction = null, market = null, perks = null, opts = {}) {
  const B = newBattle(seed, false);
  B.idx = idx;
  B.heroes = teamUnits(B, 'hero', team, levels, faction, market, perks);
  const em = opts.enemyMult || 1;
  const V = opts.villain && VILLAINS[opts.villain] ? opts.villain : null;
  B.enemies = stageEnemies(idx, V).map((e, i) => makeUnit(B, 'enemy', { ...e, hp: e.hp * em, atk: e.atk * em, row: rowOf(i) }));
  const mod = opts.mod || (V && VILLAINS[V].mod);
  if (mod && MODS[mod]) applyMod(B, mod);
  // The goblin uses its own dice so the fight itself stays the same with or without it.
  const g = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  if (opts.goblin !== false && idx >= 1 && idx % STAGES_PER_WORLD !== STAGES_PER_WORLD - 1 && g() < GOBLIN_CHANCE) B.goblin = { at: +(6 + g() * 14).toFixed(2), dur: GOBLIN_FOR, gem: g() < 0.25, caught: false, shown: false };
  return B;
}
function applyMod(B, key) {
  const m = MODS[key]; B.mod = key;
  for (const u of [...B.heroes, ...B.enemies]) {
    if (m.hp) { u.maxHp = Math.round(u.maxHp * m.hp); u.hp = u.maxHp; }
    if (m.atk) u.atk *= m.atk;
    if (m.spd) u.spd *= m.spd;
  }
}
const goblinUp = B => !!(B.goblin && !B.goblin.caught && B.t >= B.goblin.at && B.t < B.goblin.at + B.goblin.dur);
// World boss (raid): one giant boss shared by every player. It never falls inside a fight — the fight lasts
// RAID_TIME seconds (or until your deck is down) and what counts is the damage dealt. Its attack is set from your
// own deck (so every player meets a fair fight) and keeps growing, so stronger decks last longer and hit harder.
const RAID_TIME = 45;
// raid.enrage: the boss is below 10% HP — it hits much harder (everyone races for the last hit).
const RAID_ENRAGE_ATK = 1.6;
function createRaid(team, levels, seed, raid, faction = null, market = null, perks = null) {
  const B = newBattle(seed, false);
  B.raid = { dmg: 0 }; B.idx = -1;
  B.heroes = teamUnits(B, 'hero', team, levels, faction, market, perks);
  const h = HERO_BY_ID[raid.boss], avgHp = B.heroes.reduce((a, u) => a + u.maxHp, 0) / Math.max(1, B.heroes.length);
  const atk = avgHp * 0.11 * (1 + 0.04 * ((raid.level || 1) - 1)) * (raid.enrage ? RAID_ENRAGE_ATK : 1);
  const u = makeUnit(B, 'enemy', { id: raid.boss, name: h.name, role: h.role, boss: true, weak: raid.weak || null, hp: 1e12, atk, spd: 1.4, row: 'front' });
  u.raidBoss = true; u.baseAtk = atk;
  B.enemies = [u]; B.raidEnrage = !!raid.enrage;
  return B;
}
function replayRaid(team, levels, seed, inputs, raid, faction = null, market = null, perks = null) {
  const B = createRaid(team, levels, seed, raid, faction, market, perks);
  const q = (Array.isArray(inputs) ? inputs : []).filter(x => Array.isArray(x) && Number.isInteger(x[0]) && Number.isInteger(x[1])).sort((a, b) => a[0] - b[0]);
  let i = 0;
  while (!B.over) { while (i < q.length && q[i][0] <= B.tick) applyInput(B, q[i++][1]); step(B); B.events.length = 0; }
  return { dmg: Math.round(B.raid.dmg), time: +B.t.toFixed(2), perfects: B.perfects, maxChain: B.maxChain };
}
// PvP: side A plays as 'hero', side B as 'enemy'; both sides use the same (hero) rules.
function createPvpBattle(teamA, levelsA, teamB, levelsB, seed, factionA = null, factionB = null, market = null, perksA = null, perksB = null) {
  const B = newBattle(seed, true);
  B.heroes = teamUnits(B, 'hero', teamA, levelsA, factionA, market, perksA);
  B.enemies = teamUnits(B, 'enemy', teamB, levelsB, factionB, market, perksB);
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
  let dmg = amount * rage(B) * (B.casting && !opts.pure ? B.castMul : 1);
  if (on(B, tgt, 'vuln')) dmg *= 1.3;
  if (B.casting && src && !opts.pure && heroRules(B, src) && exposed(B, tgt)) { dmg *= EXPOSE_MULT; if (!B.exposedSeen) { B.exposedSeen = true; B.events.push({ type: 'exposedhit', uid: tgt.uid }); } }
  // Combos: skills hit harder on frozen (shatter), stunned (crush) or poisoned (toxic) targets.
  if (B.casting && src && !opts.pure) {
    const c = on(B, tgt, 'freeze') ? ['shatter', 1.5] : on(B, tgt, 'stun') ? ['crush', 1.3] : on(B, tgt, 'poison') ? ['toxic', 1.25] : null;
    if (c) { dmg *= c[1]; if (B.comboSeen && !B.comboSeen.has(tgt.uid)) { B.comboSeen.add(tgt.uid); B.events.push({ type: 'combo', uid: tgt.uid, kind: c[0] }); } }
  }
  if (tgt.weak && on(B, tgt, tgt.weak)) { dmg *= 2; if (!tgt.weakShown || B.t - tgt.weakShown > 2) { tgt.weakShown = B.t; B.events.push({ type: 'weakhit', uid: tgt.uid }); } }
  if (opts.basic && tgt.row === 'back' && friendsOf(B, tgt).some(f => f.row === 'front')) dmg *= BACK_GUARD;
  let crit = false;
  if (src && heroRules(B, src) && !opts.pure && B.rng() < 0.12) { dmg *= 1.6; crit = true; }
  dmg = Math.max(1, Math.round(dmg * (0.92 + B.rng() * 0.16)));
  if (tgt.shield > 0) { const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a; if (dmg === 0) { B.events.push({ type: 'block', uid: tgt.uid }); return 0; } }
  tgt.hp -= dmg;
  if (tgt.raidBoss && B.raid) B.raid.dmg += dmg;
  tgt.energy = Math.min(100, tgt.energy + (heroRules(B, tgt) ? 3 : 2));
  B.events.push({ type: 'dmg', uid: tgt.uid, amount: dmg, crit, poison: !!opts.poison });
  if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; B.events.push({ type: 'die', uid: tgt.uid, by: src ? src.id : null }); }
  return dmg;
}

function heal(B, tgt, amount) {
  if (!tgt || !tgt.alive) return;
  const v = Math.round(Math.min(tgt.maxHp - tgt.hp, amount * (B.casting ? B.castMul : 1) / rage(B)));
  tgt.hp += v;
  if (v > 0) B.events.push({ type: 'heal', uid: tgt.uid, amount: v });
}

// The enemy the player tapped (focus) while it lives, else null.
function focusOf(B, u) { const id = B.focus[u.side]; return id ? foesOf(B, u).find(e => e.uid === id) || null : null; }
const primary = (B, u) => focusOf(B, u) || foesOf(B, u)[0];
function heroTarget(B, u) {
  const foes = foesOf(B, u);
  if (!foes.length) return null;
  const f = focusOf(B, u); if (f) return f;
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
  damage(B, u, t, atkOf(B, u), { basic: true });
  if (u.role === 'healer') heal(B, lowest(friendsOf(B, u)), atkOf(B, u) * 0.5);
  u.energy = Math.min(100, u.energy + (hr ? 14 : 10));
}

const SKILLS = {
  pinkbull(B, u) { for (const e of foesOf(B, u)) { damage(B, u, e, atkOf(B, u) * 1.5); e.fx.stun = B.t + 1.5; } },
  notcoin(B, u) { for (const f of friendsOf(B, u)) addShield(B, f, f.maxHp * 0.25 * (u.skillK || 1)); },
  volya(B, u) { const fs = foesOf(B, u); const t = focusOf(B, u) || fs.reduce((a, b) => (b.hp > a.hp ? b : a), fs[0]); damage(B, u, t, atkOf(B, u) * 4.5); },
  egor(B, u) { const t = primary(B, u); damage(B, u, t, atkOf(B, u) * 2.5); if (t) t.fx.vuln = B.t + 5; },
  paws(B, u) { for (let i = 0; i < 3; i++) damage(B, u, primary(B, u), atkOf(B, u) * 1.4); },
  noctis(B, u) { damage(B, u, focusOf(B, u) || lowest(foesOf(B, u)), atkOf(B, u) * 5); u.fx.dodge = B.t + 3; },
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

// manual: the player tapped it (perfect timing and chains only count for taps).
function castSkill(B, u, manual = false) {
  if (!u || !u.alive || u.energy < 100 || B.over || !foesOf(B, u).length) return false;
  const age = B.tick - (u.fullAt == null ? B.tick : u.fullAt);
  u.energy = 0; u.fullAt = null;
  B.events.push({ type: 'skill', uid: u.uid, id: u.id, side: u.side });
  let mul = 1;
  if (manual && heroRules(B, u)) {
    if (age >= PERFECT_FROM && age <= PERFECT_TO) { mul *= PERFECT_MULT; if (u.side === 'hero') B.perfects++; B.events.push({ type: 'perfect', uid: u.uid, side: u.side }); }
    const c = B.chain[u.side]; c.n = B.t - c.at <= CHAIN_GAP ? c.n + 1 : 1; c.at = B.t;
    if (c.n >= 2) { mul *= Math.min(CHAIN_MAX, 1 + CHAIN_STEP * (c.n - 1)); if (u.side === 'hero') B.maxChain = Math.max(B.maxChain, c.n); B.events.push({ type: 'chain', n: c.n, side: u.side }); }
  }
  B.casting = true; B.comboSeen = new Set(); B.castMul = mul; B.exposedSeen = false;
  try { SKILLS[u.id](B, u); } finally { B.casting = false; B.comboSeen = null; B.castMul = 1; }
  // Every skill charges the team's ultimate.
  if (B.pvp || u.side === 'hero') B.ult[u.side] = Math.min(100, B.ult[u.side] + ULT_PER_SKILL);
  checkEnd(B);
  return true;
}

// Team ultimate: when the meter is full, every living card strikes together (250% of the team's average attack
// to every enemy) and the team heals 15%. In stages only the player has it; in PvP both sides do.
const ULT_PER_SKILL = 25;
function castUlt(B, side) {
  if (B.over || B.ult[side] < 100 || (B.mod && MODS[B.mod].noUlt)) return false;
  const mine = alive(side === 'hero' ? B.heroes : B.enemies);
  if (!mine.length) return false;
  B.ult[side] = 0;
  const atk = mine.reduce((a, u) => a + atkOf(B, u), 0) / mine.length;
  B.events.push({ type: 'ult', side });
  B.casting = true; B.comboSeen = new Set();
  try {
    const aim = B.focus[side];
    for (const e of alive(side === 'hero' ? B.enemies : B.heroes)) damage(B, mine[0], e, atk * 2.5 * (aim && e.uid === aim ? AIM_MULT : 1));
    for (const f of mine) heal(B, f, f.maxHp * 0.15);
  } finally { B.casting = false; B.comboSeen = null; }
  checkEnd(B);
  return true;
}

function checkEnd(B) {
  if (B.over) return;
  if (!alive(B.enemies).length) B.over = 'win';
  else if (!alive(B.heroes).length) B.over = 'lose';
}

// Inputs are [tick, code]: code > 0 casts the skill of unit `code`; -1 / -2 turn hero auto on / off; -3 = team ultimate;
// -4 catches the treasure goblin; -100 - uid focuses that enemy; -200 - uid aims the ultimate at it.
function applyInput(B, code, side = 'hero') {
  const mine = side === 'hero' ? B.heroes : B.enemies, foes = side === 'hero' ? B.enemies : B.heroes;
  if (code === -1) B.autoBy[side] = true;
  else if (code === -2) B.autoBy[side] = false;
  else if (code === -3) castUlt(B, side);
  else if (code === -4) { if (side === 'hero' && goblinUp(B)) { B.goblin.caught = true; B.events.push({ type: 'goblincaught', gem: B.goblin.gem }); } }
  else if (code <= -200) { const e = foes.find(x => x.uid === -200 - code && x.alive); if (e) { B.focus[side] = e.uid; castUlt(B, side); } }
  else if (code <= -100) { const e = foes.find(x => x.uid === -100 - code && x.alive); if (e) { B.focus[side] = e.uid; B.events.push({ type: 'focus', uid: e.uid, side }); } }
  else { const u = mine.find(x => x.uid === code); if (u) castSkill(B, u, true); }
}

// Advance exactly one fixed tick.
function step(B) {
  if (B.over) return;
  B.tick++;
  B.t = B.tick * TICK;
  const dt = TICK;
  if (B.raid) for (const e of B.enemies) if (e.raidBoss) e.atk = e.baseAtk * (1 + B.t / 12);
  if (!B.enraged && B.t >= ENRAGE_AT) { B.enraged = true; B.events.push({ type: 'enrage' }); }
  for (const u of [...B.heroes, ...B.enemies]) {
    if (!u.alive) continue;
    if (u.shield > 0 && B.t >= u.shieldUntil) u.shield = 0;
    if (on(B, u, 'poison') && B.t >= u.poisonNext) { u.poisonNext += 1; damage(B, null, u, u.poisonDps * (B.mod && MODS[B.mod].poison || 1), { pure: true, poison: true }); if (!u.alive) continue; }
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
  // when each card filled up (perfect timing is measured from here)
  for (const u of [...B.heroes, ...B.enemies]) if (u.alive) { if (u.energy >= 100) { if (u.fullAt == null) u.fullAt = B.tick; } else u.fullAt = null; }
  // boss weak spot opens / closes; the goblin appears / runs off
  for (const e of B.enemies) if (e.boss && e.alive && !B.pvp) { const x = exposed(B, e); if (x !== !!e.exposedNow) { e.exposedNow = x; B.events.push({ type: x ? 'exposed' : 'covered', uid: e.uid }); } }
  if (B.goblin && !B.goblin.caught) {
    if (!B.goblin.shown && goblinUp(B)) { B.goblin.shown = true; B.events.push({ type: 'goblin' }); }
    else if (B.goblin.shown && !B.goblin.gone && !goblinUp(B)) { B.goblin.gone = true; B.events.push({ type: 'goblingone' }); }
  }
  for (const side of ['hero', 'enemy']) if (B.autoBy[side] && B.ult[side] >= 100) castUlt(B, side);
  checkEnd(B);
  if (B.raid && !B.over && B.t >= RAID_TIME) { B.over = 'win'; B.timeout = true; }
  // Time's up: the side with more HP left (as a share of its total) wins.
  if (B.tick >= MAX_TICKS && !B.over) {
    const share = arr => arr.reduce((a, u) => a + u.hp, 0) / arr.reduce((a, u) => a + u.maxHp, 0);
    const h = share(B.heroes), e = share(B.enemies);
    B.timeout = true;
    B.over = h > e ? 'win' : h < e || !B.pvp ? 'lose' : 'draw';
  }
}

// Server-side verification of a stage battle: replay it from its seed and the player's inputs.
function replayStage(team, levels, idx, seed, inputs, faction = null, market = null, perks = null, opts = {}) {
  const B = createBattle(team, levels, idx, seed, faction, market, perks, opts);
  const q = (Array.isArray(inputs) ? inputs : []).filter(x => Array.isArray(x) && Number.isInteger(x[0]) && Number.isInteger(x[1])).sort((a, b) => a[0] - b[0]);
  let i = 0, skills = 0;
  while (!B.over) {
    while (i < q.length && q[i][0] <= B.tick) applyInput(B, q[i++][1]);
    for (const e of B.events) if (e.type === 'skill' && e.side === 'hero') skills++;
    B.events.length = 0;
    step(B);
  }
  for (const e of B.events) if (e.type === 'skill' && e.side === 'hero') skills++;
  const lost = B.heroes.filter(u => !u.alive).map(u => u.id), hpLeft = (arr => arr.reduce((a, u) => a + u.hp, 0) / arr.reduce((a, u) => a + u.maxHp, 0))(B.enemies);
  return { result: B.over, ticks: B.tick, time: +B.t.toFixed(2), skills, lost, perfects: B.perfects, maxChain: B.maxChain,
    goblin: B.goblin ? { caught: B.goblin.caught, gem: B.goblin.gem } : null, enemyHpLeft: +hpLeft.toFixed(4), heroHpLeft: +(arr => arr.reduce((a, u) => a + u.hp, 0) / arr.reduce((a, u) => a + u.maxHp, 0))(B.heroes).toFixed(4) };
}

if (typeof module !== 'undefined') {
  module.exports = { RARITY, ROLES, HEROES, BASE_HEROES, FUSIONS, FUSION_RULES, fusionStartLevel, TEAM_MAX_FUSIONS, TEAM_MAX_TRIOS, teamError, duosWithin, ENRAGE_AT, LEGACY_FUSION_IDS, HERO_BY_ID, STARTERS, WORLDS, TOTAL_STAGES, STAGES_PER_WORLD, MAX_LEVEL, COIN_BONUS, TICK,
    PERFECT_FROM, PERFECT_TO, PERFECT_MULT, CHAIN_GAP, CHAIN_STEP, CHAIN_MAX, EXPOSE_EVERY, EXPOSE_AT, EXPOSE_FOR, EXPOSE_MULT, exposed, AIM_MULT, GOBLIN_CHANCE, goblinUp, MODS, RAID_ENRAGE_ATK,
    RAID_TIME, FUSION_ADJ, VILLAINS, TOWER_STORY, STORY_EVERY, villainAt, createRaid, replayRaid, SYNERGIES, deckSynergies, STAGE_K, CALIBRATED_FROM, FACTION_BONUS, FACTION_FUSION_BONUS, factionMult, marketMult, BOSS_WEAK, WEAK_BY, heroStats, upgradeCost, stageReward, stageEnemies, createBattle, createPvpBattle, step, castSkill, castUlt, applyInput, replayStage };
}
