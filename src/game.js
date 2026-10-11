// TON Legends — UI layer
const IMAGES = {/*IMAGES*/};
const img = id => IMAGES[id] || `images/${id}.jpg`;
const fa = n => Math.round(n).toLocaleString('fa-IR');
const $ = s => document.querySelector(s);
const stageLabel = idx => `${fa(Math.floor(idx / STAGES_PER_WORLD) + 1)}-${fa(idx % STAGES_PER_WORLD + 1)}`;

// ---------- state ----------
const SAVE_KEY = 'tonlegends_v1';
const defaultState = () => ({ coins: 300, owned: Object.fromEntries(STARTERS.map(id => [id, 1])), team: [...STARTERS],
  cleared: 0, sel: 0, world: 0, speed: 1, auto: false, tab: 'map', seenHelp: false,
  sfx: true, music: true, updatedAt: 0, afkSince: Date.now(),
  stats: { wins: 0, losses: 0, chests: 0, upgrades: 0, skills: 0, bosses: 0 },
  daily: { last: null, streak: 0 }, dq: { date: null, p: {}, c: {} }, ach: {} });
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.owned) return migrate(s); } catch (e) {}
  return defaultState();
}
function migrate(s) {
  const d = defaultState();
  return { ...d, ...s, stats: { ...d.stats, ...(s.stats || {}) }, daily: { ...d.daily, ...(s.daily || {}) }, dq: { ...d.dq, ...(s.dq || {}) }, ach: { ...(s.ach || {}) } };
}
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  Online.cloudSave(S);
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const today = (off = 0) => { const d = new Date(Date.now() + off * 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

function haptic(kind) { try { const w = Online.tg(); if (w && w.HapticFeedback) w.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {} }

function setCoins(delta) {
  S.coins += delta; save();
  if (delta > 0) Sound.play('coin');
  updateBadge();
  const el = $('#coins'); el.querySelector('span').textContent = fa(S.coins);
  if (delta) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function teamPower(team) {
  return team.reduce((sum, id) => { const s = heroStats(id, S.owned[id]); return sum + s.hp / 10 + s.atk / s.spd * 2; }, 0);
}
function coinBonus(team) { return team.reduce((b, id) => b + (COIN_BONUS[id] || 0), 0); }

// ---------- modal ----------
function openModal(html, onBind) {
  const m = $('#modal'); m.querySelector('.modal-box').innerHTML = html; m.hidden = false;
  if (onBind) onBind(m.querySelector('.modal-box'));
}
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) closeModal(); });

// ---------- tabs ----------
function show(tab) {
  S.tab = tab; save();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ({ map: renderMap, heroes: renderHeroes, chest: renderChest, quests: renderQuests, rank: renderRank })[tab]();
  updateBadge();
  window.scrollTo(0, 0);
}
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => show(b.dataset.tab));

// ---------- map ----------
function renderMap() {
  const w = S.world, W = WORLDS[w];
  const lo = w * STAGES_PER_WORLD, hi = lo + STAGES_PER_WORLD - 1;
  if (S.sel < lo || S.sel > hi || S.sel > S.cleared) S.sel = Math.min(S.cleared, hi);
  const nextOpen = w + 1 < WORLDS.length && (w + 1) * STAGES_PER_WORLD <= S.cleared;
  let nodes = '';
  for (let i = 0; i < STAGES_PER_WORLD; i++) {
    const gi = lo + i, boss = i === STAGES_PER_WORLD - 1;
    const st = gi < S.cleared ? 'done' : gi === S.cleared ? 'current' : 'locked';
    nodes += `<button class="stage ${st} ${boss ? 'boss' : ''} ${gi === S.sel ? 'sel' : ''}" data-i="${gi}" ${st === 'locked' ? 'disabled' : ''}>
      ${st === 'locked' ? (boss ? W.boss[0] : '🔒') : boss ? W.boss[0] : fa(i + 1)}${st === 'done' ? '<span class="star">⭐</span>' : ''}</button>`;
  }
  const foes = stageEnemies(S.sel);
  const first = S.sel === S.cleared;
  const reward = Math.round(stageReward(S.sel) * (1 + coinBonus(S.team)) * (first ? 2 : 1));
  const done = S.cleared >= TOTAL_STAGES;
  $('#screen').innerHTML = `
    <div class="world" style="background:${W.bg}">
      <div class="world-head">
        <button class="arrow" data-w="${w - 1}" ${w === 0 ? 'disabled' : ''}>▶</button>
        <div><div class="world-num">دنیای ${fa(w + 1)} از ${fa(WORLDS.length)}</div><div class="world-name">${W.name}</div></div>
        <button class="arrow" data-w="${w + 1}" ${nextOpen ? '' : 'disabled'}>◀</button>
      </div>
      <div class="stages">${nodes}</div>
    </div>
    <div class="panel">
      <div class="row"><div class="h2" style="margin:0">مرحله ${stageLabel(S.sel)} ${S.sel % STAGES_PER_WORLD === 9 ? '· رئیس' : ''}</div>
        <span class="tag gold">🪙 ${fa(reward)}${first ? ' · اولین بار ×۲' : ''}</span></div>
      <div class="foes">${foes.map(f => `<span class="${f.boss ? 'b' : ''}" title="${f.name}">${f.emoji}</span>`).join('')}</div>
      <div class="row"><span class="muted">تیم تو · قدرت ${fa(teamPower(S.team))}</span><button class="tag" id="edit-team">✏️ ویرایش تیم</button></div>
      <div class="mini-team">${[0, 1, 2, 3, 4].map(i => S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '<div class="empty"></div>').join('')}</div>
      <button class="btn wide" id="go" ${S.team.length ? '' : 'disabled'}>⚔️ شروع نبرد</button>
      ${done ? '<p class="center muted">🏆 همه‌ی مراحل را تمام کردی! می‌توانی مراحل را دوباره بازی کنی.</p>' : ''}
    </div>`;
  document.querySelectorAll('.stage').forEach(b => b.onclick = () => { S.sel = +b.dataset.i; save(); renderMap(); });
  document.querySelectorAll('.arrow').forEach(b => b.onclick = () => { S.world = +b.dataset.w; S.sel = -1; save(); renderMap(); });
  $('#edit-team').onclick = () => show('heroes');
  $('#go').onclick = () => startBattle(S.sel);
}

// ---------- heroes ----------
function renderHeroes() {
  const owned = HEROES.filter(h => S.owned[h.id]).length;
  const order = [...HEROES].sort((a, b) => (!!S.owned[b.id] - !!S.owned[a.id]) || ('LERC'.indexOf(a.rarity) - 'LERC'.indexOf(b.rarity)));
  $('#screen').innerHTML = `
    <div class="h2">تیم نبرد <span class="muted">(${fa(S.team.length)}/۵ · قدرت ${fa(teamPower(S.team))})</span></div>
    <div class="team-slots">${[0, 1, 2, 3, 4].map(i => `<button class="slot" data-id="${S.team[i] || ''}">${S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '+'}</button>`).join('')}</div>
    <div class="h2">مجموعه <span class="muted">(${fa(owned)}/${fa(HEROES.length)})</span></div>
    <div class="grid">${order.map(cardHtml).join('')}</div>`;
  document.querySelectorAll('.card, .slot').forEach(c => c.onclick = () => c.dataset.id && heroModal(c.dataset.id));
}
function cardHtml(h) {
  const lv = S.owned[h.id], rc = RARITY[h.rarity].color;
  const canUp = lv && lv < MAX_LEVEL && S.coins >= upgradeCost(h.id, lv);
  return `<button class="card ${lv ? '' : 'locked'}" data-id="${h.id}" style="--rc:${rc}">
    <img src="${img(h.id)}" alt="${h.name}" loading="lazy">
    ${lv ? `<span class="lv">سطح ${fa(lv)}</span>` : '<span class="lock">🔒</span>'}
    <span class="rl">${ROLES[h.role].icon}</span>
    ${canUp ? '<span class="up">⬆️</span>' : ''}
    <div class="info">${S.team.includes(h.id) ? '<span class="in-team">در تیم</span>' : ''}<div class="nm">${h.name}</div><div class="muted" style="font-size:11px">${h.title}</div></div>
  </button>`;
}
function heroModal(id) {
  const h = HERO_BY_ID[id], lv = S.owned[id], R = RARITY[h.rarity];
  const s = heroStats(id, lv || 1), cost = lv ? upgradeCost(id, lv) : 0, inTeam = S.team.includes(id);
  const next = lv && lv < MAX_LEVEL ? heroStats(id, lv + 1) : null;
  openModal(`
    <img class="poster" src="${img(id)}" style="--rc:${R.color}" alt="">
    <div class="row" style="margin-top:12px"><div><div class="big" style="direction:ltr;text-align:right;font-size:26px">${h.name}</div><div class="muted">${h.title}</div></div>
      <div style="text-align:left"><span class="tag" style="color:${R.color}">${R.name}</span><div class="muted" style="margin-top:6px">${ROLES[h.role].icon} ${ROLES[h.role].name}</div></div></div>
    <div class="stats">
      <div>جان<b>${fa(s.hp)}</b>${next ? `<span style="color:var(--green)">+${fa(next.hp - s.hp)}</span>` : ''}</div>
      <div>حمله<b>${fa(s.atk)}</b>${next ? `<span style="color:var(--green)">+${fa(next.atk - s.atk)}</span>` : ''}</div>
      <div>سطح<b>${lv ? fa(lv) : '—'}</b>از ${fa(MAX_LEVEL)}</div>
    </div>
    <div class="skill">⚡ مهارت ویژه: <b>${h.skill}</b><div class="muted" style="color:var(--text);margin-top:4px">${h.desc}</div></div>
    ${lv ? `<div class="btns">
      <button class="btn gold" id="up" ${!next || S.coins < cost ? 'disabled' : ''}>${next ? `⬆️ ارتقا · 🪙 ${fa(cost)}` : 'حداکثر سطح'}</button>
      <button class="btn ${inTeam ? 'ghost' : ''}" id="tm" ${!inTeam && S.team.length >= 5 ? 'disabled' : ''}>${inTeam ? 'خروج از تیم' : S.team.length >= 5 ? 'تیم پر است' : 'افزودن به تیم'}</button>
    </div>` : `<p class="center muted">این قهرمان را از <b>صندوق</b> به دست بیاور 🎁</p><button class="btn wide" id="tochest">رفتن به صندوق</button>`}
  `, box => {
    const up = box.querySelector('#up'), tm = box.querySelector('#tm'), tc = box.querySelector('#tochest');
    if (up) up.onclick = () => { setCoins(-cost); S.owned[id]++; track('upgrades'); save(); haptic('medium'); Sound.play('heal'); heroModal(id); refresh(); };
    if (tm) tm.onclick = () => { S.team = inTeam ? S.team.filter(x => x !== id) : [...S.team, id]; save(); closeModal(); refresh(); };
    if (tc) tc.onclick = () => { closeModal(); show('chest'); };
  });
}
function refresh() { show(S.tab); }

// ---------- chest ----------
const CHESTS = [
  { key: 'basic', name: 'صندوق معمولی', ico: '🎁', cost: 300, c: '#3fa2ff', rates: { C: 55, R: 32, E: 11, L: 2 } },
  { key: 'royal', name: 'صندوق سلطنتی', ico: '👑', cost: 1200, c: '#ffc531', rates: { C: 0, R: 50, E: 38, L: 12 } },
];
function renderChest() {
  $('#screen').innerHTML = `<div class="h2">صندوق قهرمان</div>
    <p class="muted">قهرمان جدید بگیر! اگر تکراری باشد، آن قهرمان یک سطح بالا می‌رود.</p>
    ${CHESTS.map(c => `<div class="panel chest" style="--c:${c.c}"><div class="ico">${c.ico}</div><div style="flex:1">
      <div class="t">${c.name}</div>
      <div class="rates">${Object.entries(c.rates).filter(([, v]) => v).map(([r, v]) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${fa(v)}٪</span>`).join('')}</div>
      <button class="btn ${c.key === 'royal' ? 'gold' : ''} wide" data-k="${c.key}" ${S.coins < c.cost ? 'disabled' : ''}>باز کردن · 🪙 ${fa(c.cost)}</button>
    </div></div>`).join('')}
    ${Online.state.server && Online.state.packs.length ? `<div class="h2">⭐ فروشگاه سکه</div>
      <p class="muted">خرید با Telegram Stars</p>
      <div class="shop">${Online.state.packs.map(p => `<button class="pack" data-pack="${esc(p.id)}"><div class="pi">${p.coins >= 30000 ? '💰' : p.coins >= 10000 ? '🪙🪙' : '🪙'}</div>
        <div class="pc">${fa(p.coins)}</div><div class="ps">⭐ ${fa(p.stars)}</div></button>`).join('')}</div>` : ''}
    <p class="muted center" style="margin-top:18px">💡 سکه را با بردن مرحله‌ها، ماموریت‌ها و جایزه‌ی روزانه جمع کن. Egor و Teddy سکه‌ی بیشتری می‌آورند.</p>`;
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => openChest(CHESTS.find(c => c.key === b.dataset.k)));
  document.querySelectorAll('[data-pack]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await Online.buy(b.dataset.pack);
      if (r.coins) { setCoins(r.coins); giftModal('⭐', 'خرید موفق!', r.coins); }
      else if (r.status === 'paid') giftModal('⏳', 'پرداخت انجام شد', 0, 'سکه‌ها چند لحظه‌ی دیگر به حسابت اضافه می‌شوند.');
    } catch (e) { giftModal('⚠️', 'خطا در خرید', 0, 'اتصال به سرور برقرار نشد. دوباره امتحان کن.'); }
    b.disabled = false;
  });
}
function openChest(c, free) {
  if (!free && S.coins < c.cost) return;
  if (!free) setCoins(-c.cost);
  track('chests');
  let roll = Math.random() * 100, rarity = 'C';
  for (const [r, v] of Object.entries(c.rates)) { if (roll < v) { rarity = r; break; } roll -= v; }
  const pool = HEROES.filter(h => h.rarity === rarity);
  const h = pool[Math.floor(Math.random() * pool.length)], R = RARITY[rarity];
  let msg;
  if (!S.owned[h.id]) {
    S.owned[h.id] = 1; msg = '✨ قهرمان جدید!';
    if (S.team.length < 5) { S.team.push(h.id); msg += ' (به تیم اضافه شد)'; }
  } else if (S.owned[h.id] < MAX_LEVEL) { S.owned[h.id]++; msg = `تکراری · سطح ${fa(S.owned[h.id])} شد ⬆️`; }
  else { setCoins(Math.round(c.cost / 2)); msg = `حداکثر سطح · 🪙 ${fa(c.cost / 2)} برگشت`; }
  save(); haptic('heavy'); Sound.play('chest'); if (rarity === 'L' || rarity === 'E') Sound.play('legend');
  openModal(`<div class="center">
    <div class="tag" style="color:${R.color}">${R.name}</div>
    <div class="reveal" style="--rc:${R.color}"><div class="flip"><img src="${img(h.id)}" alt=""></div></div>
    <div class="big" style="direction:ltr;font-size:26px">${h.name}</div>
    <div class="muted">${h.title} · ${ROLES[h.role].icon} ${ROLES[h.role].name}</div>
    <p style="font-weight:700">${msg}</p>
    <div class="btns"><button class="btn ghost" id="cl">باشه</button><button class="btn ${c.key === 'royal' ? 'gold' : ''}" id="again" ${S.coins < c.cost ? 'disabled' : ''}>دوباره · 🪙 ${fa(c.cost)}</button></div>
  </div>`, box => {
    box.querySelector('#cl').onclick = () => { closeModal(); refresh(); };
    box.querySelector('#again').onclick = () => openChest(c);
  });
  if (S.tab === 'chest') renderChest();
}

// ---------- battle ----------
let BT = null;
const STATUS_ICONS = [['freeze', '❄️'], ['stun', '💫'], ['slow', '🐌'], ['poison', '☠️'], ['vuln', '💔'], ['weak', '🔻'], ['buff', '🔥'], ['dodge', '👻']];

function startBattle(idx) {
  const B = createBattle(S.team, S.owned, idx);
  B.auto = S.auto;
  const W = WORLDS[Math.floor(idx / STAGES_PER_WORLD)];
  const el = $('#battle');
  el.style.background = W.bg;
  el.innerHTML = `
    <div class="b-top">
      <button id="b-exit">✕</button>
      <div class="b-title">مرحله ${stageLabel(idx)}${idx % STAGES_PER_WORLD === 9 ? ' · رئیس 👑' : ''}</div>
      <button id="b-speed">×${fa(S.speed)}</button>
      <button id="b-auto" class="${S.auto ? 'on' : ''}">⚡ خودکار</button>
    </div>
    <div class="b-enemies">${B.enemies.map(e => `<div class="enemy ${e.boss ? 'boss' : ''}" data-uid="${e.uid}">
      <div class="status"></div><div class="e-emoji">${e.emoji}</div><div class="bar hp"><i></i><i class="sh" style="width:0"></i></div><div class="e-name">${e.name}</div></div>`).join('')}</div>
    <div class="b-mid"><div id="b-banner"></div></div>
    <div class="b-heroes">${B.heroes.map(u => `<div class="hcard" data-uid="${u.uid}" style="--rc:${RARITY[HERO_BY_ID[u.id].rarity].color}">
      <span class="ready">⚡</span><img src="${img(u.id)}" alt=""><div class="status"></div>
      <div class="hc-name">${u.name}</div><div class="bar hp h"><i></i><i class="sh" style="width:0"></i></div><div class="bar en"><i></i></div></div>`).join('')}</div>
    <div class="b-hint">وقتی کارت قهرمان می‌درخشد ⚡ روی آن بزن تا مهارت ویژه‌اش فعال شود</div>
    <div id="b-fx"></div>`;
  el.hidden = false;
  const els = new Map();
  el.querySelectorAll('[data-uid]').forEach(n => {
    els.set(+n.dataset.uid, { root: n, hp: n.querySelector('.bar.hp i'), sh: n.querySelector('.sh'), en: n.querySelector('.bar.en i'), st: n.querySelector('.status'), last: {} });
  });
  BT = { B, els, idx, last: performance.now(), raf: 0, ended: false };
  el.querySelectorAll('.hcard').forEach(n => n.onclick = () => {
    const u = B.heroes.find(x => x.uid === +n.dataset.uid);
    if (castSkill(B, u)) { haptic('medium'); flush(); }
  });
  $('#b-exit').onclick = () => endBattle(null);
  $('#b-speed').onclick = e => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; save(); e.target.textContent = '×' + fa(S.speed); };
  $('#b-auto').onclick = e => { S.auto = !S.auto; B.auto = S.auto; save(); e.target.classList.toggle('on', S.auto); };
  render();
  Sound.music('battle');
  BT.raf = requestAnimationFrame(loop);
}

function loop(now) {
  if (!BT) return;
  const { B } = BT;
  let dt = Math.min(0.1, (now - BT.last) / 1000) * S.speed;
  BT.last = now;
  while (dt > 0 && !B.over) { const d = Math.min(0.05, dt); step(B, d); dt -= d; }
  flush();
  if (B.over && !BT.ended) { BT.ended = true; setTimeout(() => endBattle(B.over), 900); }
  BT.raf = requestAnimationFrame(loop);
}

function flush() { processEvents(); render(); }

function render() {
  const { B, els } = BT;
  for (const u of [...B.heroes, ...B.enemies]) {
    const e = els.get(u.uid), L = e.last;
    const hp = Math.round(u.hp / u.maxHp * 1000) / 10;
    if (L.hp !== hp) { e.hp.style.width = hp + '%'; L.hp = hp; }
    const sh = Math.min(100, Math.round(u.shield / u.maxHp * 100));
    if (L.sh !== sh) { e.sh.style.width = sh + '%'; L.sh = sh; }
    if (e.en) { const en = Math.round(u.energy); if (L.en !== en) { e.en.style.width = en + '%'; L.en = en; } }
    const full = u.side === 'hero' && u.alive && u.energy >= 100;
    if (L.full !== full) { e.root.classList.toggle('full', full); L.full = full; }
    if (L.alive !== u.alive) { e.root.classList.toggle('dead', !u.alive); L.alive = u.alive; }
    const frozen = u.alive && (u.fx.freeze || 0) > B.t;
    if (L.frozen !== frozen) { e.root.classList.toggle('frozen', frozen); L.frozen = frozen; }
    let st = u.alive ? STATUS_ICONS.filter(([k]) => (u.fx[k] || 0) > B.t).map(([, i]) => i).join('') : '';
    if (u.alive && u.shield > 0) st += '🛡️';
    if (st.includes('❄️')) st = st.replace('💫', '');
    if (L.st !== st) { e.st.textContent = st; L.st = st; }
  }
}

function anim(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function float(uid, text, cls) {
  const e = BT.els.get(uid); if (!e) return;
  const box = $('#battle').getBoundingClientRect(), r = e.root.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'float ' + (cls || '');
  d.textContent = text;
  d.style.left = (r.left - box.left + r.width / 2 + (Math.random() * 30 - 15)) + 'px';
  d.style.top = (r.top - box.top + r.height * 0.3) + 'px';
  $('#b-fx').appendChild(d);
  setTimeout(() => d.remove(), 900);
}
function flashScreen(color) {
  const d = document.createElement('div'); d.className = 'flash'; d.style.background = color;
  $('#b-fx').appendChild(d); setTimeout(() => d.remove(), 450);
}
const SKILL_COLORS = { pinkbull: '#ff5fa2', notcoin: '#ffc531', volya: '#ff3030', egor: '#3fd0ff', paws: '#ff3b3b', noctis: '#6a3cff',
  gramcat: '#bfe6ff', utya: '#8fe3ff', pengu: '#9ee7ff', memegram: '#7aa0ff', yoda: '#45c4ff', virus: '#7dff3a',
  babyshark: '#3fffd0', yaya: '#ff9a3a', dog: '#ffd27a', teddy: '#ff7ac8' };

function processEvents() {
  const { B, els } = BT;
  const evs = B.events.splice(0);
  const heroSide = new Set(B.heroes.map(u => u.uid));
  for (const ev of evs) {
    const e = els.get(ev.uid);
    switch (ev.type) {
      case 'atk': if (e) anim(e.root, heroSide.has(ev.uid) ? 'lunge-up' : 'lunge-down'); break;
      case 'dmg':
        float(ev.uid, (ev.crit ? '💥' : '') + fa(ev.amount), ev.poison ? 'poison' : ev.crit ? 'crit' : heroSide.has(ev.uid) ? 'hurt' : '');
        if (e && !ev.poison) anim(e.root, 'hit');
        if (!ev.poison) Sound.play(ev.crit ? 'crit' : 'hit');
        break;
      case 'heal': float(ev.uid, '+' + fa(ev.amount), 'heal'); Sound.play('heal'); break;
      case 'miss': float(ev.uid, 'جاخالی!', 'info'); break;
      case 'block': float(ev.uid, '🛡️', 'info'); break;
      case 'shield': float(ev.uid, '🛡️ سپر', 'info'); Sound.play('shield'); break;
      case 'die': float(ev.uid, '💀', 'info'); Sound.play('die'); break;
      case 'skill': {
        const h = HERO_BY_ID[ev.id];
        track('skills'); Sound.play('skill');
        $('#b-banner').innerHTML = `<div class="banner"><img src="${img(ev.id)}" alt=""><div><div class="s">${h.skill}</div><div class="n">${h.name}</div></div></div>`;
        flashScreen(SKILL_COLORS[ev.id]);
        break;
      }
      case 'bossaoe':
        anim($('#battle'), 'shake'); flashScreen('#ff0000'); haptic('heavy'); Sound.play('boss');
        $('#b-banner').innerHTML = `<div class="banner"><div class="s" style="color:#ff6b6b">⚠️ حمله‌ی رئیس!</div></div>`;
        break;
    }
  }
}

function endBattle(result) {
  if (!BT) return;
  cancelAnimationFrame(BT.raf);
  const idx = BT.idx;
  BT = null;
  Sound.music('menu');
  if (!result) { $('#battle').hidden = true; refresh(); return; }
  if (result === 'win') {
    const first = idx === S.cleared;
    track('wins');
    if (idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1) track('bosses');
    Sound.play('win');
    const coins = Math.round(stageReward(idx) * (1 + coinBonus(S.team)) * (first ? 2 : 1));
    if (first) S.cleared = Math.min(TOTAL_STAGES, S.cleared + 1);
    const nextIdx = Math.min(idx + 1, TOTAL_STAGES - 1);
    const hasNext = idx + 1 < TOTAL_STAGES && idx + 1 <= S.cleared;
    S.sel = hasNext ? nextIdx : idx;
    S.world = Math.floor(S.sel / STAGES_PER_WORLD);
    setCoins(coins);
    Online.submitScore(S.cleared, teamPower(S.team));
    haptic('heavy');
    const worldDone = first && idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
    openModal(`<div class="center">
      <div style="font-size:64px">${worldDone ? '🏆' : '🎉'}</div>
      <div class="big">پیروزی!</div>
      <p class="muted">مرحله ${stageLabel(idx)} ${worldDone ? `· دنیای «${WORLDS[Math.floor(idx / STAGES_PER_WORLD)].name}» تمام شد!` : ''}</p>
      <div class="big" style="color:var(--gold)">+🪙 ${fa(coins)}</div>
      ${first ? '<p class="muted">جایزه‌ی اولین برد ×۲</p>' : ''}
      <div class="btns" style="margin-top:14px">
        <button class="btn ghost" id="r-map">نقشه</button>
        <button class="btn ghost" id="r-again">🔁 تکرار</button>
        ${hasNext ? '<button class="btn" id="r-next">مرحله بعد ⬅</button>' : ''}
      </div></div>`, box => bindResult(box, idx, nextIdx));
  } else {
    S.stats.losses++; save(); Sound.play('lose');
    openModal(`<div class="center">
      <div style="font-size:64px">💔</div>
      <div class="big">شکست!</div>
      <p class="muted">قهرمان‌هایت را <b>ارتقا</b> بده، از <b>صندوق</b> قهرمان جدید بگیر، یا مرحله‌های قبلی را تکرار کن تا سکه جمع شود.</p>
      <div class="btns" style="margin-top:14px">
        <button class="btn ghost" id="r-heroes">قهرمان‌ها</button>
        <button class="btn" id="r-again">🔁 تلاش دوباره</button>
      </div></div>`, box => bindResult(box, idx));
  }
  $('#modal').dataset.lock = '1';
}
function bindResult(box, idx, nextIdx) {
  const leave = (fn) => () => { delete $('#modal').dataset.lock; closeModal(); fn(); };
  const q = s => box.querySelector(s);
  if (q('#r-map')) q('#r-map').onclick = leave(() => { $('#battle').hidden = true; show('map'); });
  if (q('#r-heroes')) q('#r-heroes').onclick = leave(() => { $('#battle').hidden = true; show('heroes'); });
  if (q('#r-again')) q('#r-again').onclick = leave(() => startBattle(idx));
  if (q('#r-next')) q('#r-next').onclick = leave(() => startBattle(nextIdx));
}

// ---------- boot ----------
function help() {
  openModal(`<div class="center"><div style="font-size:54px">⚔️</div><div class="big">به TON Legends خوش آمدی!</div></div>
    <p>🃏 تیمی ۵ نفره از قهرمان‌ها بچین.</p>
    <p>⚔️ قهرمان‌ها خودکار می‌جنگند. وقتی کارتی <b style="color:var(--gold)">می‌درخشد ⚡</b> روی آن بزن تا مهارت ویژه‌اش فعال شود.</p>
    <p>🪙 با پیروزی سکه بگیر، قهرمان‌ها را <b>ارتقا</b> بده و از <b>صندوق</b> قهرمان جدید باز کن.</p>
    <p>🗺️ ۵ دنیا و ۵۰ مرحله، و در آخر هر دنیا یک رئیس قدرتمند منتظرت است!</p>
    <button class="btn wide" id="ok">بزن بریم!</button>`, box => box.querySelector('#ok').onclick = () => { S.seenHelp = true; save(); closeModal(); maybeDaily(); });
}
