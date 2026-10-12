// TON Legends — UI layer
const IMAGES = {/*IMAGES*/};
const img = id => IMAGES[id] || `images/${id}.jpg`;
const n = x => Math.round(x).toLocaleString(L().locale);
const pct = x => LANG === 'fa' ? `${n(x)}٪` : `${n(x)}%`;
const $ = s => document.querySelector(s);
const stageLabel = idx => `${n(Math.floor(idx / STAGES_PER_WORLD) + 1)}-${n(idx % STAGES_PER_WORLD + 1)}`;
const isBossStage = idx => idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;

// ---------- state ----------
const SAVE_KEY = 'tonlegends_v1';
// S = economy profile (rules in economy.js; the server owns it when online) + local UI preferences.
const PREFS = () => ({ sel: 0, world: 0, speed: 1, auto: false, tab: 'map', seenHelp: false, lang: null, sfx: true, music: true, stake: 100, updatedAt: 0 });
const defaultState = () => ({ ...ECON.newProfile(Date.now()), ...PREFS() });
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.owned) return migrate(s); } catch (e) {}
  return defaultState();
}
function migrate(s) { return { ...PREFS(), ...ECON.normalize(s, Date.now()) }; }
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  Online.cloudSave(S);
}
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function haptic(kind) { try { const w = Online.tg(); if (w && w.HapticFeedback) w.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {} }

function showCoins(prev) {
  const el = $('#coins'); el.querySelector('span').textContent = n(S.coins);
  if (prev !== undefined && prev !== S.coins) {
    if (S.coins > prev) Sound.play('coin');
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
  updateBadge();
}
const teamPower = team => ECON.teamPower(S, team);

// Every change to coins/heroes/progress is an action. Online the server applies it (same rules, its own
// clock and dice) and returns the updated profile; offline the rules run locally.
async function act(action) {
  await Online.ready;
  const prev = S.coins;
  let result;
  if (Online.state.profile) { const r = await Online.act(action); Object.assign(S, r.profile); result = r.result; }
  else result = ECON.act(S, action, { now: Date.now(), rng: Math.random });
  save(); showCoins(prev);
  return result;
}
const errText = e => T().err[e && e.message] || T().err.network;
async function tryAct(action) { try { return await act(action); } catch (e) { toast(errText(e)); return null; } }
function toast(msg) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}

// ---------- modal ----------
// opts.onBack: what ✕ / Back / the phone's back button does (default: close). opts.lock: ignore taps outside.
let modalBack = null;
function openModal(html, onBind, opts = {}) {
  const m = $('#modal'), box = m.querySelector('.modal-box');
  box.innerHTML = html; box.scrollTop = 0; m.hidden = false;
  if (opts.lock) m.dataset.lock = '1'; else delete m.dataset.lock;
  modalBack = opts.onBack || closeModal;
  if (onBind) onBind(box);
  syncNav();
}
function closeModal() { const m = $('#modal'); m.hidden = true; delete m.dataset.lock; modalBack = null; syncNav(); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.lock) goBack(); });
$('#m-close').addEventListener('click', () => goBack());

// ---------- navigation: one Back for header button, Telegram BackButton and the phone's back key ----------
// Order: close popup → leave battle (with confirm) → Map (home).
let histPushed = false, ignorePop = false;
function canGoBack() { return !$('#modal').hidden || !!BT || S.tab !== 'map'; }
function goBack() {
  if (!$('#modal').hidden) return (modalBack || closeModal)();
  if (BT) return BT.ended ? undefined : confirmLeave();
  if (S.tab !== 'map') show('map');
}
function syncNav() {
  const can = canGoBack(), w = Online.tg();
  const back = $('#back'); if (back) back.hidden = S.tab === 'map';
  if (w) {
    try { if (w.BackButton) can ? w.BackButton.show() : w.BackButton.hide(); } catch (e) {}
    try { BT && !BT.ended ? w.enableClosingConfirmation() : w.disableClosingConfirmation(); } catch (e) {}
    return;
  }
  // Plain browser: map the device/browser back button onto goBack via one history entry.
  if (can && !histPushed) { history.pushState({ tl: 1 }, ''); histPushed = true; }
  else if (!can && histPushed) { histPushed = false; ignorePop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (Online.tg()) return;
  if (ignorePop) { ignorePop = false; return; }
  histPushed = false;
  if (canGoBack()) goBack();
  syncNav();
});

// ---------- tabs ----------
function show(tab) {
  S.tab = tab; save();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ({ map: renderMap, arena: renderArena, heroes: renderHeroes, chest: renderChest, quests: renderQuests, rank: renderRank })[tab]();
  updateBadge();
  window.scrollTo(0, 0);
  syncNav();
}
document.querySelectorAll('#nav button').forEach(b => b.onclick = () => show(b.dataset.tab));
function refresh() { show(S.tab); }

// ---------- map ----------
function renderMap() {
  const t = T(), w = S.world, W = WORLDS[w];
  const lo = w * STAGES_PER_WORLD, hi = lo + STAGES_PER_WORLD - 1;
  if (S.sel < lo || S.sel > hi || S.sel > S.cleared) S.sel = Math.min(S.cleared, hi);
  const nextOpen = w + 1 < WORLDS.length && (w + 1) * STAGES_PER_WORLD <= S.cleared;
  const rtl = L().dir === 'rtl';
  let nodes = '';
  for (let i = 0; i < STAGES_PER_WORLD; i++) {
    const gi = lo + i, boss = i === STAGES_PER_WORLD - 1;
    const st = gi < S.cleared ? 'done' : gi === S.cleared ? 'current' : 'locked';
    const inner = boss ? `<img src="${img(W.boss)}" alt="">` : st === 'locked' ? '🔒' : n(i + 1);
    nodes += `<button class="stage ${st} ${boss ? 'boss' : ''} ${gi === S.sel ? 'sel' : ''}" data-i="${gi}" ${st === 'locked' ? 'disabled' : ''}>
      ${inner}${st === 'done' ? '<span class="star">⭐</span>' : ''}</button>`;
  }
  const foes = stageEnemies(S.sel);
  const first = S.sel === S.cleared;
  const reward = ECON.stageCoins(S, S.sel, S.team, first);
  $('#screen').innerHTML = `
    <div class="world" style="background:${W.bg}">
      <div class="world-head">
        <button class="arrow" data-w="${w - 1}" ${w === 0 ? 'disabled' : ''}>${rtl ? '▶' : '◀'}</button>
        <div><div class="world-num">${t.worldOf(n(w + 1), n(WORLDS.length))}</div><div class="world-name">${worldName(w)}</div></div>
        <button class="arrow" data-w="${w + 1}" ${nextOpen ? '' : 'disabled'}>${rtl ? '◀' : '▶'}</button>
      </div>
      <div class="stages">${nodes}</div>
    </div>
    <div class="panel">
      <div class="row"><div class="h2" style="margin:0">${t.stage(stageLabel(S.sel))} ${isBossStage(S.sel) ? '· ' + t.boss : ''}</div>
        <span class="tag gold">🪙 ${n(reward)}${first ? t.firstX2 : ''}</span></div>
      <div class="muted" style="margin-top:8px">${t.enemyCards}</div>
      <div class="foes">${foes.map(f => `<div class="foe ${f.boss ? 'b' : ''}"><img src="${img(f.id)}" alt="${esc(f.name)}"></div>`).join('')}</div>
      <div class="row"><span class="muted">${t.yourTeam(n(teamPower(S.team)))}</span><button class="tag" id="edit-team">${t.editTeam}</button></div>
      <div class="mini-team">${[0, 1, 2, 3, 4].map(i => S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '<div class="empty"></div>').join('')}</div>
      <button class="btn wide" id="go" ${S.team.length ? '' : 'disabled'}>${t.fight}</button>
      ${S.cleared >= TOTAL_STAGES ? `<p class="center muted">${t.allDone}</p>` : ''}
    </div>`;
  document.querySelectorAll('.stage').forEach(b => b.onclick = () => { S.sel = +b.dataset.i; save(); renderMap(); });
  document.querySelectorAll('.arrow').forEach(b => b.onclick = () => { S.world = +b.dataset.w; S.sel = -1; save(); renderMap(); });
  $('#edit-team').onclick = () => show('heroes');
  $('#go').onclick = () => startBattle(S.sel);
}

// ---------- heroes ----------
function renderHeroes() {
  const t = T(), owned = HEROES.filter(h => S.owned[h.id]).length;
  const order = [...HEROES].sort((a, b) => (!!S.owned[b.id] - !!S.owned[a.id]) || ('LERC'.indexOf(a.rarity) - 'LERC'.indexOf(b.rarity)));
  $('#screen').innerHTML = `
    <div class="h2">${t.battleTeam} <span class="muted">(${n(S.team.length)}/${n(5)} · ${t.power} ${n(teamPower(S.team))})</span></div>
    <div class="team-slots">${[0, 1, 2, 3, 4].map(i => `<button class="slot" data-id="${S.team[i] || ''}">${S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '+'}</button>`).join('')}</div>
    <div class="h2">${t.collection} <span class="muted">(${n(owned)}/${n(HEROES.length)})</span></div>
    <div class="grid">${order.map(cardHtml).join('')}</div>`;
  document.querySelectorAll('.card, .slot').forEach(c => c.onclick = () => c.dataset.id && heroModal(c.dataset.id));
}
function cardHtml(h) {
  const t = T(), lv = S.owned[h.id], rc = RARITY[h.rarity].color;
  const canUp = lv && lv < MAX_LEVEL && S.coins >= upgradeCost(h.id, lv);
  return `<button class="card ${lv ? '' : 'locked'}" data-id="${h.id}" style="--rc:${rc}">
    <img src="${img(h.id)}" alt="${h.name}" loading="lazy">
    ${lv ? `<span class="lv">${t.level(n(lv))}</span>` : '<span class="lock">🔒</span>'}
    <span class="rl">${ROLES[h.role].icon}</span>
    ${canUp ? '<span class="up">⬆️</span>' : ''}
    <div class="info">${S.team.includes(h.id) ? `<span class="in-team">${t.inTeam}</span>` : ''}<div class="nm">${h.name}</div><div class="muted" style="font-size:11px">${heroText(h.id).title}</div></div>
  </button>`;
}
function heroModal(id) {
  const t = T(), h = HERO_BY_ID[id], ht = heroText(id), lv = S.owned[id], R = RARITY[h.rarity];
  const s = heroStats(id, lv || 1), cost = lv ? upgradeCost(id, lv) : 0, inTeam = S.team.includes(id);
  const next = lv && lv < MAX_LEVEL ? heroStats(id, lv + 1) : null;
  openModal(`
    <img class="poster" src="${img(id)}" style="--rc:${R.color}" alt="">
    <div class="row" style="margin-top:12px"><div><div class="big latin" style="font-size:26px">${h.name}</div><div class="muted">${ht.title}</div></div>
      <div class="end"><span class="tag" style="color:${R.color}">${L().rarity[h.rarity]}</span><div class="muted" style="margin-top:6px">${ROLES[h.role].icon} ${L().role[h.role]}</div></div></div>
    <div class="stats">
      <div>${t.hp}<b>${n(s.hp)}</b>${next ? `<span style="color:var(--green)">+${n(next.hp - s.hp)}</span>` : ''}</div>
      <div>${t.atk}<b>${n(s.atk)}</b>${next ? `<span style="color:var(--green)">+${n(next.atk - s.atk)}</span>` : ''}</div>
      <div>${t.lvl}<b>${lv ? n(lv) : '—'}</b>${t.of(n(MAX_LEVEL))}</div>
    </div>
    <div class="skill">${t.special} <b>${ht.skill}</b><div class="muted" style="color:var(--text);margin-top:4px">${ht.desc}</div></div>
    ${lv ? `<div class="btns">
      <button class="btn gold" id="up" ${!next || S.coins < cost ? 'disabled' : ''}>${next ? t.upgrade(n(cost)) : t.maxLevel}</button>
      <button class="btn ${inTeam ? 'ghost' : ''}" id="tm" ${!inTeam && S.team.length >= 5 ? 'disabled' : ''}>${inTeam ? t.leaveTeam : S.team.length >= 5 ? t.teamFull : t.joinTeam}</button>
    </div>` : `<p class="center muted">${t.getFromChest}</p><button class="btn wide" id="tochest">${t.goChest}</button>`}
  `, box => {
    const up = box.querySelector('#up'), tm = box.querySelector('#tm'), tc = box.querySelector('#tochest');
    if (up) up.onclick = async () => { up.disabled = true; if (await tryAct({ type: 'upgrade', id })) { haptic('medium'); Sound.play('heal'); refresh(); heroModal(id); } else up.disabled = false; };
    if (tm) tm.onclick = async () => { const team = inTeam ? S.team.filter(x => x !== id) : [...S.team, id]; if (await tryAct({ type: 'team', team })) { closeModal(); refresh(); } };
    if (tc) tc.onclick = () => { closeModal(); show('chest'); };
  });
}

// ---------- chest ----------
const CHESTS = [
  { key: 'basic', ico: '🎁', c: '#3fa2ff', ...ECON.CHESTS.basic },
  { key: 'royal', ico: '👑', c: '#ffc531', ...ECON.CHESTS.royal },
];
const chestName = c => T()[c.key + 'Chest'];
function renderChest() {
  const t = T();
  $('#screen').innerHTML = `<div class="h2">${t.chestTitle}</div>
    <p class="muted">${t.chestNote}</p>
    ${CHESTS.map(c => `<div class="panel chest" style="--c:${c.c}"><div class="ico">${c.ico}</div><div style="flex:1">
      <div class="t">${chestName(c)}</div>
      <div class="rates">${Object.entries(c.rates).filter(([, v]) => v).map(([r, v]) => `<span style="color:${RARITY[r].color}">${L().rarity[r]} ${pct(v)}</span>`).join('')}</div>
      <button class="btn ${c.key === 'royal' ? 'gold' : ''} wide" data-k="${c.key}" ${S.coins < c.cost ? 'disabled' : ''}>${t.open(n(c.cost))}</button>
    </div></div>`).join('')}
    ${Online.state.server && Online.state.packs.length ? `<div class="h2">${t.shop}</div>
      <p class="muted">${t.shopNote}</p>
      <div class="shop">${Online.state.packs.map(p => `<button class="pack" data-pack="${esc(p.id)}"><div class="pi">${p.coins >= 30000 ? '💰' : p.coins >= 10000 ? '🪙🪙' : '🪙'}</div>
        <div class="pc">${n(p.coins)}</div><div class="ps">⭐ ${n(p.stars)}</div></button>`).join('')}</div>` : ''}
    <p class="muted center" style="margin-top:18px">${t.coinTip}</p>`;
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => openChest(CHESTS.find(c => c.key === b.dataset.k)));
  document.querySelectorAll('[data-pack]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await Online.buy(b.dataset.pack);
      if (r.profile) { const prev = S.coins; Object.assign(S, r.profile); save(); showCoins(prev); }
      if (r.coins) giftModal('⭐', t.bought, r.coins);
      else if (r.status === 'paid') giftModal('⏳', t.paid, 0, t.paidNote);
    } catch (e) { giftModal('⚠️', t.buyErr, 0, t.buyErrNote); }
    b.disabled = false;
  });
}
async function openChest(c) {
  if (S.coins < c.cost) return;
  const r = await tryAct({ type: 'chest', key: c.key });
  if (r) chestReveal(c, r);
}
function chestReveal(c, r) {
  const t = T(), h = HERO_BY_ID[r.id], rarity = r.rarity, R = RARITY[rarity];
  const msg = r.outcome === 'new' ? t.newHero + (r.added ? t.addedTeam : '') : r.outcome === 'dupe' ? t.dupe(n(r.level)) : t.maxRefund(n(r.refund));
  haptic('heavy'); Sound.play('chest'); if (rarity === 'L' || rarity === 'E') Sound.play('legend');
  openModal(`<div class="center">
    <div class="tag" style="color:${R.color}">${L().rarity[rarity]}</div>
    <div class="reveal" style="--rc:${R.color}"><div class="flip"><img src="${img(h.id)}" alt=""></div></div>
    <div class="big latin" style="font-size:26px">${h.name}</div>
    <div class="muted">${heroText(h.id).title} · ${ROLES[h.role].icon} ${L().role[h.role]}</div>
    <p style="font-weight:700">${msg}</p>
    <div class="btns"><button class="btn ghost" id="cl">${t.ok}</button><button class="btn ${c.key === 'royal' ? 'gold' : ''}" id="again" ${S.coins < c.cost ? 'disabled' : ''}>${t.again(n(c.cost))}</button></div>
  </div>`, box => {
    box.querySelector('#cl').onclick = () => { closeModal(); refresh(); };
    box.querySelector('#again').onclick = () => openChest(c);
  });
  if (S.tab === 'chest') renderChest();
}

// ---------- battle (shared by stage battles and arena duels) ----------
// BT.mode: 'stage' (simulated here, verified by the server afterwards) or 'pvp' (simulated by the server, streamed here).
let BT = null;
const STATUS_ICONS = [['freeze', '❄️'], ['stun', '💫'], ['slow', '🐌'], ['poison', '☠️'], ['vuln', '💔'], ['weak', '🔻'], ['buff', '🔥'], ['dodge', '👻']];
const isMine = u => u.side === ((BT && BT.mySide) || 'hero');
const allUnits = () => [...BT.B.heroes, ...BT.B.enemies];

function unitCard(u) {
  const mine = isMine(u);
  const rc = !mine ? (u.boss ? '#ff3b3b' : '#e0475a') : RARITY[HERO_BY_ID[u.id].rarity].color;
  return `<div class="hcard ${mine ? 'hero' : 'enemy'} ${u.boss ? 'boss' : ''}" data-uid="${u.uid}" style="--rc:${rc}">
    ${mine ? '<span class="ready">⚡</span>' : ''}${u.boss ? '<span class="crown">👑</span>' : ''}
    <img src="${img(u.id)}" alt=""><div class="status"></div>
    <div class="hc-name">${u.name}</div><div class="bar hp ${mine ? 'h' : ''}"><i></i><i class="sh" style="width:0"></i></div><div class="bar en"><i></i></div></div>`;
}

// Draws the battle screen for the current BT. mine = my cards (bottom), theirs = opponent cards (top).
function buildBattle({ title, bg, mine, theirs, oppLabel, myLabel, onTap, onAuto, showSpeed }) {
  const t = T(), el = $('#battle');
  el.style.background = bg;
  el.innerHTML = `
    <div class="b-top">
      <button id="b-exit">✕</button>
      <div class="b-title">${title}</div>
      ${showSpeed ? `<button id="b-speed">×${n(S.speed)}</button>` : ''}
      <button id="b-auto" class="${S.auto ? 'on' : ''}">${t.auto}</button>
    </div>
    ${oppLabel ? `<div class="b-name opp">${oppLabel}</div>` : ''}
    <div class="b-enemies n${theirs.length}">${theirs.map(unitCard).join('')}</div>
    <div class="b-vs">VS</div>
    <div class="b-mid"><div id="b-banner"></div></div>
    <div class="b-heroes">${mine.map(unitCard).join('')}</div>
    ${myLabel ? `<div class="b-name me">${myLabel}</div>` : ''}
    <div class="b-hint">${t.tapHint}</div>
    <div id="b-fx"></div>`;
  el.hidden = false;
  BT.els = new Map();
  el.querySelectorAll('[data-uid]').forEach(nd => {
    BT.els.set(+nd.dataset.uid, { root: nd, hp: nd.querySelector('.bar.hp i'), sh: nd.querySelector('.sh'), en: nd.querySelector('.bar.en i'), st: nd.querySelector('.status'), last: {} });
  });
  el.querySelectorAll('.hcard.hero').forEach(nd => nd.onclick = () => {
    const u = mine.find(x => x.uid === +nd.dataset.uid);
    if (BT && !BT.ended && u && u.alive && u.energy >= 100) { haptic('medium'); onTap(u); }
  });
  $('#b-exit').onclick = confirmLeave;
  if (showSpeed) $('#b-speed').onclick = e => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; save(); e.target.textContent = '×' + n(S.speed); };
  $('#b-auto').onclick = e => { S.auto = !S.auto; save(); e.target.classList.toggle('on', S.auto); onAuto(S.auto); };
  render();
  syncNav();
}

async function startBattle(idx) {
  if (BT) return;
  const r = await tryAct({ type: 'stageStart', stage: idx });
  if (!r) return;
  const t = T(), B = createBattle(S.team, S.owned, idx, r.seed);
  // Taps are queued and applied at the next fixed tick, and recorded as [tick, code] so the server can replay the fight.
  BT = { mode: 'stage', B, idx, mySide: 'hero', inputs: [], queue: S.auto ? [-1] : [], acc: 0, last: performance.now(), raf: 0, ended: false };
  buildBattle({
    title: `${t.stage(stageLabel(idx))}${isBossStage(idx) ? ' · ' + t.bossCrown : ''}`, bg: WORLDS[Math.floor(idx / STAGES_PER_WORLD)].bg,
    mine: B.heroes, theirs: B.enemies, showSpeed: true,
    onTap: u => BT.queue.push(u.uid), onAuto: on => BT.queue.push(on ? -1 : -2),
  });
  Sound.music('battle');
  BT.raf = requestAnimationFrame(loop);
}

function confirmLeave() {
  if (!BT || BT.ended) return;
  const t = T(), pvp = BT.mode === 'pvp';
  BT.paused = true;
  const resume = () => { closeModal(); if (BT) { BT.paused = false; BT.last = performance.now(); } };
  openModal(`<div class="center"><div style="font-size:52px">🏳️</div><div class="big" style="font-size:24px">${t.leaveTitle}</div>
    <p class="muted">${pvp ? t.pvpLeaveNote : t.leaveNote}</p>
    <div class="btns"><button class="btn ghost" id="lv-yes">${t.leave}</button><button class="btn" id="lv-no">${t.stay}</button></div></div>`, box => {
    box.querySelector('#lv-yes').onclick = () => { closeModal(); leaveBattle(); };
    box.querySelector('#lv-no').onclick = resume;
  }, { onBack: resume });
}

function leaveBattle() {
  if (!BT) return;
  cancelAnimationFrame(BT.raf);
  if (BT.es) BT.es.close();
  BT = null;
  Sound.music('menu');
  $('#battle').hidden = true;
  refresh();
}

function loop(now) {
  if (!BT || BT.mode !== 'stage') return;
  const { B } = BT;
  if (BT.paused) { BT.last = now; BT.raf = requestAnimationFrame(loop); return; }
  BT.acc += Math.min(0.25, (now - BT.last) / 1000) * S.speed;
  BT.last = now;
  while (BT.acc >= TICK && !B.over) {
    for (const code of BT.queue.splice(0)) { BT.inputs.push([B.tick, code]); applyInput(B, code); }
    step(B);
    BT.acc -= TICK;
  }
  flush();
  if (B.over && !BT.ended) { BT.ended = true; syncNav(); setTimeout(finishStage, 900); }
  BT.raf = requestAnimationFrame(loop);
}

function flush() { processEvents(); render(); }

function render() {
  const B = BT.B;
  for (const u of allUnits()) {
    const e = BT.els.get(u.uid); if (!e) continue;
    const Lst = e.last;
    const hp = Math.round(u.hp / u.maxHp * 1000) / 10;
    if (Lst.hp !== hp) { e.hp.style.width = hp + '%'; Lst.hp = hp; }
    const sh = Math.min(100, Math.round(u.shield / u.maxHp * 100));
    if (Lst.sh !== sh) { e.sh.style.width = sh + '%'; Lst.sh = sh; }
    const en = Math.round(u.energy); if (Lst.en !== en) { e.en.style.width = en + '%'; Lst.en = en; }
    const full = isMine(u) && u.alive && u.energy >= 100;
    if (Lst.full !== full) { e.root.classList.toggle('full', full); Lst.full = full; }
    if (Lst.alive !== u.alive) { e.root.classList.toggle('dead', !u.alive); Lst.alive = u.alive; }
    const frozen = u.alive && (u.fx.freeze || 0) > B.t;
    if (Lst.frozen !== frozen) { e.root.classList.toggle('frozen', frozen); Lst.frozen = frozen; }
    let st = u.alive ? STATUS_ICONS.filter(([k]) => (u.fx[k] || 0) > B.t).map(([, i]) => i).join('') : '';
    if (u.alive && u.shield > 0) st += '🛡️';
    if (st.includes('❄️')) st = st.replace('💫', '');
    if (Lst.st !== st) { e.st.textContent = st; Lst.st = st; }
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
  const t = T(), B = BT.B;
  const evs = B.events.splice(0);
  const mineUid = new Set(allUnits().filter(isMine).map(u => u.uid));
  for (const ev of evs) {
    const e = BT.els.get(ev.uid);
    switch (ev.type) {
      case 'atk': if (e) anim(e.root, mineUid.has(ev.uid) ? 'lunge-up' : 'lunge-down'); break;
      case 'dmg':
        float(ev.uid, (ev.crit ? '💥' : '') + n(ev.amount), ev.poison ? 'poison' : ev.crit ? 'crit' : mineUid.has(ev.uid) ? 'hurt' : '');
        if (e && !ev.poison) anim(e.root, 'hit');
        if (!ev.poison) Sound.play(ev.crit ? 'crit' : 'hit');
        break;
      case 'heal': float(ev.uid, '+' + n(ev.amount), 'heal'); Sound.play('heal'); break;
      case 'miss': float(ev.uid, t.dodge, 'info'); break;
      case 'block': float(ev.uid, '🛡️', 'info'); break;
      case 'shield': float(ev.uid, t.shield, 'info'); Sound.play('shield'); break;
      case 'die': float(ev.uid, '💀', 'info'); Sound.play('die'); break;
      case 'skill': {
        const enemy = !mineUid.has(ev.uid);
        Sound.play('skill');
        if (e) anim(e.root, 'casting');
        $('#b-banner').innerHTML = `<div class="banner ${enemy ? 'enemy' : ''}"><img src="${img(ev.id)}" alt=""><div><div class="s">${heroText(ev.id).skill}</div><div class="n">${HERO_BY_ID[ev.id].name}</div></div></div>`;
        flashScreen(enemy ? '#ff2a2a' : SKILL_COLORS[ev.id]);
        break;
      }
      case 'bossaoe':
        anim($('#battle'), 'shake'); flashScreen('#ff0000'); haptic('heavy'); Sound.play('boss');
        $('#b-banner').innerHTML = `<div class="banner enemy"><div class="s">${t.bossAtk}</div></div>`;
        break;
    }
  }
}

// The stage is over on screen; the server (or local rules offline) replays it and decides the reward.
async function finishStage() {
  if (!BT || BT.mode !== 'stage') return;
  const { idx, inputs } = BT;
  cancelAnimationFrame(BT.raf);
  BT = null;
  Sound.music('menu');
  let res;
  try { res = await act({ type: 'stageEnd', inputs }); } catch (e) { toast(errText(e)); res = { result: 'lose', stage: idx }; }
  showStageResult(idx, res);
}

function showStageResult(idx, res) {
  const t = T();
  const resultBack = () => { const b = $('#modal').querySelector('#r-map, #r-heroes'); if (b) b.click(); };
  if (res.result === 'win') {
    Sound.play('win'); haptic('heavy');
    const nextIdx = Math.min(idx + 1, TOTAL_STAGES - 1);
    const hasNext = idx + 1 < TOTAL_STAGES && idx + 1 <= S.cleared;
    S.sel = hasNext ? nextIdx : idx;
    S.world = Math.floor(S.sel / STAGES_PER_WORLD);
    save();
    const worldDone = res.first && isBossStage(idx);
    openModal(`<div class="center">
      <div style="font-size:64px">${worldDone ? '🏆' : '🎉'}</div>
      <div class="big">${t.victory}</div>
      <p class="muted">${t.stage(stageLabel(idx))} ${worldDone ? t.worldDone(worldName(Math.floor(idx / STAGES_PER_WORLD))) : ''}</p>
      <div class="big" style="color:var(--gold)">+🪙 ${n(res.coins)}</div>
      ${res.first ? `<p class="muted">${t.firstBonus}</p>` : ''}
      <div class="btns" style="margin-top:14px">
        <button class="btn ghost" id="r-map">${t.toMap}</button>
        <button class="btn ghost" id="r-again">${t.replay}</button>
        ${hasNext ? `<button class="btn" id="r-next">${t.next}</button>` : ''}
      </div></div>`, box => bindResult(box, idx, nextIdx), { lock: true, onBack: resultBack });
  } else {
    Sound.play('lose');
    openModal(`<div class="center">
      <div style="font-size:64px">💔</div>
      <div class="big">${t.defeat}</div>
      <p class="muted">${t.defeatTip}</p>
      <div class="btns" style="margin-top:14px">
        <button class="btn ghost" id="r-heroes">${t.heroes}</button>
        <button class="btn" id="r-again">${t.retry}</button>
      </div></div>`, box => bindResult(box, idx), { lock: true, onBack: resultBack });
  }
}
function bindResult(box, idx, nextIdx) {
  const leave = (fn) => () => { closeModal(); fn(); syncNav(); };
  const q = s => box.querySelector(s);
  if (q('#r-map')) q('#r-map').onclick = leave(() => { $('#battle').hidden = true; show('map'); });
  if (q('#r-heroes')) q('#r-heroes').onclick = leave(() => { $('#battle').hidden = true; show('heroes'); });
  if (q('#r-again')) q('#r-again').onclick = leave(() => startBattle(idx));
  if (q('#r-next')) q('#r-next').onclick = leave(() => startBattle(nextIdx));
}

// ---------- help ----------
function help() {
  const t = T();
  openModal(`<div class="center"><div style="font-size:54px">⚔️</div><div class="big">${t.welcome}</div></div>
    <p>${t.help1}</p><p>${t.help2}</p><p>${t.help3}</p><p>${t.help4}</p>
    <button class="btn wide" id="ok">${t.letsGo}</button>`, box => box.querySelector('#ok').onclick = done, { onBack: done });
  function done() { const first = !S.seenHelp; S.seenHelp = true; save(); closeModal(); if (first) maybeDaily(); }
}
