// TON Legends — UI layer
const IMAGES = {/*IMAGES*/};
// Card image. Fusion cards use the uploaded artwork (/art/N) when it exists; otherwise a card is drawn on the fly
// from the parent heroes' posters (diagonal slices + frame + name), cached per fusion.
const BASE_IMG = {}, FART = {};
const baseSrc = id => IMAGES[id] || `images/${id}.jpg`;
function img(id) {
  const h = HERO_BY_ID[id];
  if (!h || !h.fusion) return baseSrc(id);
  if (Online.state.art && Online.state.art.has(h.num)) return `art/${h.num}?v=${Online.state.art.get(h.num)}`;
  return FART[id] || (FART[id] = drawFusion(h)) || baseSrc(h.parts[0]);
}
function preloadBaseImages(done) {
  let left = BASE_HEROES.length;
  for (const h of BASE_HEROES) {
    const im = new Image();
    im.onload = im.onerror = () => { if (--left === 0) done(); };
    im.src = baseSrc(h.id); BASE_IMG[h.id] = im;
  }
}
function drawFusion(h) {
  const ims = h.parts.map(p => BASE_IMG[p]);
  if (ims.some(im => !im || !im.complete || !im.naturalWidth)) return null; // not loaded yet: show first part meanwhile
  const W = 360, H = 540, k = ims.length, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  ims.forEach((im, i) => {
    const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, hh = im.naturalHeight * sc;
    const x0 = W * i / k, x1 = W * (i + 1) / k, sl = 50;
    g.save(); g.beginPath();
    g.moveTo(i ? x0 + sl : 0, 0); g.lineTo(i < k - 1 ? x1 + sl : W, 0); g.lineTo(i < k - 1 ? x1 - sl : W, H); g.lineTo(i ? x0 - sl : 0, H); g.closePath(); g.clip();
    g.drawImage(im, (W - w) / 2, -(hh - H) * 0.15, w, hh); g.restore();
  });
  const col = k === 2 ? '#ff5ad1' : '#46f0ff';
  const grad = g.createLinearGradient(0, H - 170, 0, H); grad.addColorStop(0, 'rgba(8,6,20,0)'); grad.addColorStop(0.45, 'rgba(8,6,20,.85)'); grad.addColorStop(1, 'rgba(8,6,20,.95)');
  g.fillStyle = grad; g.fillRect(0, H - 170, W, 170);
  g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.textAlign = 'center'; g.fillStyle = col; g.font = '900 17px Vazirmatn, sans-serif';
  g.fillText(`${k === 2 ? 'DUO' : 'TRIO'} FUSION · #${h.num}`, W / 2, H - 88);
  g.fillStyle = '#fff'; g.font = `900 ${h.name.length > 22 ? 22 : 30}px Vazirmatn, sans-serif`;
  g.fillText(h.name, W / 2, H - 50, W - 24);
  return c.toDataURL('image/jpeg', 0.82);
}
const n = x => Math.round(x).toLocaleString(L().locale);
const pct = x => LANG === 'fa' ? `${n(x)}٪` : `${n(x)}%`;
const $ = s => document.querySelector(s);
const stageLabel = idx => `${n(Math.floor(idx / STAGES_PER_WORLD) + 1)}-${n(idx % STAGES_PER_WORLD + 1)}`;
const isBossStage = idx => idx % STAGES_PER_WORLD === STAGES_PER_WORLD - 1;
// Feature unlocks (rules in economy.js): which world opens a feature, and a "🔒 Opens in world N" note.
const isOpen = k => ECON.unlocked(S, k);
const unlockWorld = k => ECON.UNLOCKS[k] / STAGES_PER_WORLD + 1;
const lockNote = k => `<div class="lock-note">🔒 ${T().lockedUntil(T().feat[k], n(unlockWorld(k)))}</div>`;
const nextUnlock = () => Object.keys(ECON.UNLOCKS).filter(k => !isOpen(k)).sort((a, b) => ECON.UNLOCKS[a] - ECON.UNLOCKS[b])[0];

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

function showCoins(prev, prevGems) {
  const el = $('#coins'); el.querySelector('span').textContent = n(S.coins);
  const g = $('#gems'); g.querySelector('span').textContent = n(S.gems || 0);
  if (prevGems !== undefined && prevGems !== S.gems) { g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); }
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
  const prev = S.coins, prevGems = S.gems;
  let result;
  if (Online.state.profile) { const r = await Online.act(action); Object.assign(S, r.profile); result = r.result; }
  else result = ECON.act(S, action, { now: Date.now(), rng: Math.random });
  save(); showCoins(prev, prevGems);
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
  if (S.tab !== 'map') show(PARENT_TAB[S.tab] || 'map');
}
const PARENT_TAB = { clan: 'rank', lab: 'heroes' };
function syncNav() {
  const can = canGoBack(), w = Online.tg();
  const back = $('#back'); if (back) back.hidden = S.tab === 'map';
  if (w) {
    try { if (w.BackButton) can ? w.BackButton.show() : w.BackButton.hide(); } catch (e) {}
    try { BT && !BT.ended ? w.enableClosingConfirmation() : w.disableClosingConfirmation(); } catch (e) {}
    return;
  }
  // Plain browser: map the device/browser back button onto goBack via one history entry.
  // Undo the entry only once this tick is over: a popup closed and another opened right away keeps it.
  if (can && !histPushed) { history.pushState({ tl: 1 }, ''); histPushed = true; }
  else if (!can && histPushed) setTimeout(() => { if (!canGoBack() && histPushed) { histPushed = false; ignorePop = true; history.back(); } }, 0);
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
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === (PARENT_TAB[tab] || tab)));
  ({ map: renderMap, arena: renderArena, lab: renderLab, heroes: renderHeroes, chest: renderChest, quests: renderQuests, rank: renderRank, clan: renderClan, war: renderWar })[tab]();
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
  const dip = ECON.marketCoinBonus(moods(), S.team), reward = ECON.stageCoins(S, S.sel, S.team, dip), factor = ECON.replayFactor(S, S.sel);
  $('#screen').innerHTML = `
    <div class="world" style="background:${W.bg}">
      <div class="world-head">
        <button class="arrow" data-w="${w - 1}" ${w === 0 ? 'disabled' : ''}>${rtl ? '▶' : '◀'}</button>
        <div><div class="world-num">${t.worldOf(n(w + 1), n(WORLDS.length))}</div><div class="world-name">${worldName(w)}</div></div>
        <button class="arrow" data-w="${w + 1}" ${nextOpen ? '' : 'disabled'}>${rtl ? '◀' : '▶'}</button>
      </div>
      <div class="stages">${nodes}</div>
    </div>
    ${warBanner()}
    ${tickerHtml()}
    ${nextUnlock() ? `<div class="next-unlock">🔓 ${t.nextUnlock(t.feat[nextUnlock()], n(unlockWorld(nextUnlock())))}</div>` : ''}
    <div class="panel">
      <div class="row"><div class="h2" style="margin:0">${t.stage(stageLabel(S.sel))} ${isBossStage(S.sel) ? '· ' + t.boss : ''}</div>
        <span class="tag gold">🪙 ${n(reward)}${first ? t.firstX2 : ` · 🔁 ${pct(factor * 100)}`}${dip ? ` · 📉 +${pct(dip * 100)}` : ''}</span></div>
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
  $('#to-war').onclick = () => show('war');
  if ($('#ticker')) $('#ticker').onclick = marketModal;
  $('#go').onclick = () => startBattle(S.sel);
}

// ---------- heroes ----------
function renderHeroes() {
  const t = T(), owned = BASE_HEROES.filter(h => S.owned[h.id]).length, holos = BASE_HEROES.filter(h => S.holo[h.id]).length;
  // Collection: all base heroes + the fusion cards you crafted (the rest live in the Fusion Lab).
  const order = HEROES.filter(h => !h.fusion || S.owned[h.id])
    .sort((a, b) => (!!S.owned[b.id] - !!S.owned[a.id]) || ('XMLERC'.indexOf(a.rarity) - 'XMLERC'.indexOf(b.rarity)));
  $('#screen').innerHTML = `
    <div class="h2">${t.battleTeam} <span class="muted">(${n(S.team.length)}/${n(5)} · ${t.power} ${n(teamPower(S.team))})</span></div>
    <div class="team-slots">${[0, 1, 2, 3, 4].map(i => `<button class="slot" data-id="${S.team[i] || ''}">${S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '+'}</button>`).join('')}</div>
    ${isOpen('duo') ? `<button class="btn wide lab-btn" id="to-lab">${t.openLab}</button>` : `<button class="btn wide ghost" disabled>${t.openLab} · 🔒 ${t.worldN(n(unlockWorld('duo')))}</button>`}
    <p class="muted small center" style="margin:6px 0 0">${t.teamRule}</p>
    <div class="h2">${t.collection} <span class="muted">(${n(owned)}/${n(BASE_HEROES.length)}) · ${t.holoCount(n(holos), n(BASE_HEROES.length))}</span></div>
    <div class="grid">${order.map(cardHtml).join('')}</div>`;
  document.querySelectorAll('.card, .slot').forEach(c => c.onclick = () => c.dataset.id && heroModal(c.dataset.id));
  if ($('#to-lab')) $('#to-lab').onclick = () => show('lab');
}
function cardHtml(h) {
  const t = T(), lv = S.owned[h.id], rc = RARITY[h.rarity].color;
  const canUp = lv && lv < MAX_LEVEL && S.coins >= ECON.upgradePrice(S, h.id, lv);
  return `<button class="card ${lv ? '' : 'locked'} ${S.holo[h.id] ? 'holo' : ''}" data-id="${h.id}" style="--rc:${rc}">
    <img src="${img(h.id)}" alt="${h.name}" loading="lazy">
    ${lv ? `<span class="lv">${t.level(n(lv))}</span>` : '<span class="lock">🔒</span>'}
    <span class="rl">${ROLES[h.role].icon}</span>
    ${h.id === S.faction ? '<span class="fac-flag">🚩</span>' : ''}${canUp ? '<span class="up">⬆️</span>' : ''}${S.serials[h.id] ? `<span class="serial">#${n(S.serials[h.id])}</span>` : ''}
    <div class="info">${S.team.includes(h.id) ? `<span class="in-team">${t.inTeam}</span>` : ''}<div class="nm">${h.name}</div><div class="muted" style="font-size:11px">${heroText(h.id).title}</div></div>
  </button>`;
}
function heroModal(id) {
  const t = T(), h = HERO_BY_ID[id], ht = heroText(id), lv = S.owned[id], R = RARITY[h.rarity];
  // Stats as they fight for you (your community's card and fusions with it are stronger).
  const mine = factionMult(id, S.faction) * marketMult(id, ECON.marketBoosts(moods())), boosted = l => { const x = heroStats(id, l); return { ...x, hp: Math.round(x.hp * mine), atk: Math.round(x.atk * mine) }; };
  const s = boosted(lv || 1);
  const cost = lv ? ECON.upgradePrice(S, id, lv) : 0, inTeam = S.team.includes(id);
  const next = lv && lv < MAX_LEVEL ? boosted(lv + 1) : null;
  openModal(`
    <div class="poster-wrap ${S.holo[id] ? 'holo' : ''}" style="--rc:${R.color}"><img class="poster" src="${img(id)}" alt="">
      ${S.holo[id] ? `<span class="holo-tag">${t.holo}</span>` : ''}${S.serials[id] ? `<span class="serial big-serial">#${n(S.serials[id])}/${n(FUSION_RULES[h.parts.length].supply)}</span>` : ''}</div>
    <div class="row" style="margin-top:12px"><div><div class="big latin" style="font-size:26px">${h.name}</div><div class="muted">${ht.title}</div></div>
      <div class="end"><span class="tag" style="color:${R.color}">${L().rarity[h.rarity]}</span><div class="muted" style="margin-top:6px">${ROLES[h.role].icon} ${L().role[h.role]}</div></div></div>
    ${moodBadge(id)}
    ${mine > 1 ? `<div class="fac-badge">${id === S.faction ? `${t.yourCommunity} · ${t.factionPerkShort}` : `🚩 ${t.army(factionName(S.faction))} · +${n(Math.round((mine - 1) * 100))}%`}</div>` : ''}
    <div class="stats">
      <div>${t.hp}<b>${n(s.hp)}</b>${next ? `<span style="color:var(--green)">+${n(next.hp - s.hp)}</span>` : ''}</div>
      <div>${t.atk}<b>${n(s.atk)}</b>${next ? `<span style="color:var(--green)">+${n(next.atk - s.atk)}</span>` : ''}</div>
      <div>${t.lvl}<b>${lv ? n(lv) : '—'}</b>${t.of(n(MAX_LEVEL))}</div>
    </div>
    <div class="skill">${t.special} <b>${ht.skill}</b><div class="muted" style="color:var(--text);margin-top:4px">${ht.desc}</div></div>
    ${lv ? `<div class="btns">
      <button class="btn gold" id="up" ${!next || S.coins < cost ? 'disabled' : ''}>${next ? t.upgrade(n(cost)) : t.maxLevel}</button>
      <button class="btn ${inTeam ? 'ghost' : ''}" id="tm" ${!inTeam && S.team.length >= 5 ? 'disabled' : ''}>${inTeam ? t.leaveTeam : S.team.length >= 5 ? t.teamFull : t.joinTeam}</button>
    </div>` : h.fusion ? `<p class="center muted">${t.needs(n(FUSION_RULES[h.parts.length].minLevel))}</p><button class="btn wide" id="tolab">${t.openLab}</button>`
      : `<p class="center muted">${t.getFromChest}</p><button class="btn wide" id="tochest">${t.goChest}</button>`}
  `, box => {
    const up = box.querySelector('#up'), tm = box.querySelector('#tm'), tc = box.querySelector('#tochest');
    if (up) up.onclick = async () => { up.disabled = true; if (await tryAct({ type: 'upgrade', id })) { haptic('medium'); Sound.play('heal'); refresh(); heroModal(id); } else up.disabled = false; };
    if (tm) tm.onclick = async () => { const team = inTeam ? S.team.filter(x => x !== id) : [...S.team, id]; if (await tryAct({ type: 'team', team })) { closeModal(); refresh(); } };
    if (tc) tc.onclick = () => { closeModal(); show('chest'); };
    const tl = box.querySelector('#tolab'); if (tl) tl.onclick = () => { closeModal(); show('lab'); };
  });
}

// ---------- chest ----------
const CHESTS = [
  { key: 'basic', ico: '🎁', c: '#3fa2ff', ...ECON.CHESTS.basic },
  { key: 'royal', ico: '👑', c: '#ffc531', ...ECON.CHESTS.royal },
  { key: 'gem', ico: '💎', c: '#c77dff', ...ECON.CHESTS.gem },
];
const chestLock = c => ({ royal: 'royal', gem: 'gemChest' })[c.key];
const chestCan = c => (c.currency === 'gems' ? S.gems || 0 : S.coins) >= c.cost;
const chestBtn = (c, again) => c.currency === 'gems' ? T()[again ? 'againGems' : 'openGems'](n(c.cost)) : T()[again ? 'again' : 'open'](n(c.cost));
const chestName = c => T()[c.key + 'Chest'];
function renderChest() {
  const t = T(), rate = ECON.gemRate(S), warp = ECON.afkRate(S) * ECON.WARP_HOURS;
  $('#screen').innerHTML = `<div class="h2">${t.chestTitle}</div>
    <p class="muted">${t.chestNote}</p>
    ${CHESTS.map(c => `<div class="panel chest" style="--c:${c.c}"><div class="ico">${c.ico}</div><div style="flex:1">
      <div class="t">${chestName(c)}</div>
      <div class="rates">${Object.entries(c.rates).filter(([, v]) => v).map(([r, v]) => `<span style="color:${RARITY[r].color}">${L().rarity[r]} ${pct(v)}</span>`).join('')}</div>
      ${chestLock(c) && !isOpen(chestLock(c)) ? lockNote(chestLock(c)) : `<button class="btn ${c.key === 'royal' ? 'gold' : c.key === 'gem' ? 'gem' : ''} wide" data-k="${c.key}" ${chestCan(c) ? '' : 'disabled'}>${chestBtn(c)}</button>`}
    </div></div>`).join('')}
    ${!isOpen('exchange') ? `<div class="panel"><div class="t">${t.exTitle} · ${t.warpTitle}</div>${lockNote('exchange')}</div>` : `<div class="panel"><div class="t">${t.exTitle}</div><p class="muted">${t.exNote(n(rate))}</p>
      <div class="stakes exch">${[10, 50, 200].map(g => `<button class="chip" data-ex="${g}" ${(S.gems || 0) < g ? 'disabled' : ''}>💎 ${n(g)} → 🪙 ${n(g * rate)}</button>`).join('')}</div>
      <div class="t" style="margin-top:12px">${t.warpTitle}</div><p class="muted">${t.warpNote(n(ECON.WARP_HOURS), n(warp))}</p>
      <button class="btn wide gem" id="warp" ${(S.gems || 0) < ECON.WARP_COST ? 'disabled' : ''}>${t.warpBtn(n(ECON.WARP_COST))}</button></div>`}
    ${Online.state.server && Online.state.packs.length ? `<div class="h2">${t.shop}</div>
      <p class="muted">${t.shopNote}</p>
      <div class="shop">${Online.state.packs.map(p => `<button class="pack" data-pack="${esc(p.id)}"><div class="pi">${p.gems >= 500 ? '💎💎💎' : p.gems >= 150 ? '💎💎' : '💎'}</div>
        <div class="pc">${n(p.gems)}</div><div class="ps">⭐ ${n(p.stars)}</div></button>`).join('')}</div>` : ''}
    <p class="muted" style="margin-top:18px">${t.gemTip}</p>
    <p class="muted">${t.coinTip}</p>`;
  document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => openChest(CHESTS.find(c => c.key === b.dataset.k)));
  document.querySelectorAll('[data-pack]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const r = await Online.buy(b.dataset.pack);
      if (r.profile) { const prev = S.coins, pg = S.gems; Object.assign(S, r.profile); save(); showCoins(prev, pg); }
      if (r.coins || r.gems) giftModal('⭐', t.bought, r.coins, '', r.gems);
      else if (r.status === 'paid') giftModal('⏳', t.paid, 0, t.paidNote);
    } catch (e) { giftModal('⚠️', t.buyErr, 0, t.buyErrNote); }
    b.disabled = false;
  });
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    const r = await tryAct({ type: 'exchange', gems: +b.dataset.ex });
    if (r) { Sound.play('coin'); giftModal('💱', t.exchanged, r.coins); } else renderChest();
  });
  if ($('#warp')) $('#warp').onclick = async () => {
    $('#warp').disabled = true;
    const r = await tryAct({ type: 'warp' });
    if (r) { Sound.play('coin'); giftModal('⏩', t.warpTitle, r.coins); } else renderChest();
  };
}
async function openChest(c) {
  if (!chestCan(c)) return;
  const r = await tryAct({ type: 'chest', key: c.key });
  if (r) chestReveal(c, r);
}
function chestReveal(c, r) {
  const t = T(), h = HERO_BY_ID[r.id], rarity = r.rarity, R = RARITY[rarity];
  const msg = r.outcome === 'new' ? t.newHero + (r.added ? t.addedTeam : '') : r.outcome === 'dupe' ? t.dupe(n(r.level)) : t.maxRefund(n(r.refund));
  haptic('heavy'); Sound.play('chest'); if (rarity === 'L' || rarity === 'E') Sound.play('legend');
  openModal(`<div class="center">
    <div class="tag" style="color:${R.color}">${L().rarity[rarity]}</div>
    <div class="reveal" style="--rc:${R.color}"><div class="flip ${r.holo ? 'holo' : ''}"><img src="${img(h.id)}" alt=""></div></div>
    ${r.holo ? `<p class="holo-msg">${t.holoNew}</p>` : ''}
    <div class="big latin" style="font-size:26px">${h.name}</div>
    <div class="muted">${heroText(h.id).title} · ${ROLES[h.role].icon} ${L().role[h.role]}</div>
    <p style="font-weight:700">${msg}</p>
    <div class="btns"><button class="btn ghost" id="cl">${t.ok}</button><button class="btn ${c.key === 'royal' ? 'gold' : c.key === 'gem' ? 'gem' : ''}" id="again" ${chestCan(c) ? '' : 'disabled'}>${chestBtn(c, true)}</button></div>
  </div>`, box => {
    box.querySelector('#cl').onclick = () => { closeModal(); refresh(); };
    box.querySelector('#again').onclick = () => openChest(c);
  });
  if (S.tab === 'chest') renderChest();
}

// ---------- fusion lab ----------
// The player builds a fusion: pick 2 or 3 of your own heroes, see which card that combination makes and whether the
// rules allow it (part levels, coins, worldwide copies left), then fuse. Your crafted fusions are listed below.
let labPick = [];
const fusionFor = parts => {
  if (parts.length < 2) return null;
  const key = [...parts].sort().join('+');
  return FUSIONS.find(f => [...f.parts].sort().join('+') === key) || null;
};
function renderLab() {
  const t = T(), mint = Online.state.mint || {}, online = !!Online.state.profile;
  labPick = labPick.filter(id => S.owned[id]);
  const f = fusionFor(labPick), rule = FUSION_RULES[Math.max(2, labPick.length)];
  const mine = FUSIONS.filter(x => S.owned[x.id]);
  const slot = i => {
    const id = labPick[i];
    if (id) {
      const lv = S.owned[id], ok = lv >= rule.minLevel;
      return `<button class="altar-slot filled ${ok ? 'ok' : 'low'}" data-slot="${i}"><img src="${img(id)}" alt=""><b>${t.level(n(lv))}</b><span class="x">✕</span></button>`;
    }
    return `<button class="altar-slot ${i === 2 ? 'opt' : ''}" data-slot="${i}"><span class="plus">+</span><small>${i === 2 ? t.slotOptional : t.pickHero}</small></button>`;
  };
  let result = `<p class="muted center">${t.altarHint}</p>`;
  if (f) {
    const owned = !!S.owned[f.id], left = rule.supply - (mint[f.id] || 0), soldOut = online && left <= 0;
    const lvOk = f.parts.every(p => (S.owned[p] || 0) >= rule.minLevel), coinOk = S.coins >= rule.cost;
    const kind = f.parts.length === 3 ? 'trio' : 'duo', open = isOpen(kind), duoOk = !rule.needDuo || ECON_DUOS(f.parts).length > 0;
    const can = open && !owned && !soldOut && lvOk && coinOk && duoOk;
    const chk = (ok, text) => `<div class="chk ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${text}</div>`;
    result = `<div class="fresult" style="--rc:${RARITY[f.rarity].color}">
      <button class="fr-img" data-hero="${f.id}"><img src="${img(f.id)}" alt=""><span class="fnum">#${f.num}</span></button>
      <div class="fr-info">
        <div class="tag" style="color:${RARITY[f.rarity].color}">${L().rarity[f.rarity]}</div>
        <div class="fname latin">${f.name}</div>
        <div class="muted small">${heroText(f.id).skill}</div>
        ${open ? '' : chk(false, t.lockedUntil(t.feat[kind], n(unlockWorld(kind))))}
        ${chk(lvOk, t.chkLevel(n(rule.minLevel)))}
        ${rule.needDuo ? chk(duoOk, t.chkDuo) : ''}
        ${chk(coinOk, t.chkCoins(n(rule.cost)))}
        ${online ? chk(!soldOut, soldOut ? t.soldOut : t.left(n(left), n(rule.supply))) : ''}
        ${chk(!owned, owned ? t.ownedTag : t.chkNew)}
        <div class="chk warn">⚠️ ${t.chkBurn(n(rule.burn), n(rule.minLevel - rule.burn), n(rule.minLevel))}</div>
      </div></div>
      <button class="btn wide ${can ? 'gold' : 'ghost'}" id="lab-fuse" ${can ? '' : 'disabled'}>${t.fuse(n(rule.cost))}</button>`;
  }
  $('#screen').innerHTML = `<div class="h2">${t.labTitle}</div><p class="muted">${t.labNote}</p>
    <div class="panel altar">
      <div class="altar-slots">${slot(0)}<span class="altar-op">+</span>${slot(1)}<span class="altar-op">+</span>${slot(2)}</div>
      ${result}
    </div>
    <div class="panel rules"><div class="t">${t.rulesTitle}</div>
      <div class="rule-row"><span>${t.duo}</span><span>${t.chkLevel(n(FUSION_RULES[2].minLevel))} · 🪙 ${n(FUSION_RULES[2].cost)} · ${t.copies(n(FUSION_RULES[2].supply))}${isOpen('duo') ? '' : ` · 🔒 ${t.worldN(n(unlockWorld('duo')))}`}</span></div>
      <div class="rule-row"><span>${t.trio}</span><span>${t.chkLevel(n(FUSION_RULES[3].minLevel))} · 🪙 ${n(FUSION_RULES[3].cost)} · ${t.copies(n(FUSION_RULES[3].supply))}${isOpen('trio') ? '' : ` · 🔒 ${t.worldN(n(unlockWorld('trio')))}`}</span></div>
      <p class="muted small" style="margin:8px 0 0">${t.fuseRules}</p>
    </div>
    <div class="h2">${t.myFusions} <span class="muted">(${n(mine.length)}/${n(FUSIONS.length)})</span></div>
    ${mine.length ? `<div class="grid">${mine.map(cardHtml).join('')}</div>` : `<p class="muted center">${t.noFusions}</p>`}`;
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
    const i = +b.dataset.slot;
    if (labPick[i]) { labPick.splice(i, 1); renderLab(); } else heroPicker();
  });
  document.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => heroModal(b.dataset.hero));
  document.querySelectorAll('.grid .card').forEach(c => c.onclick = () => heroModal(c.dataset.id));
  const fb = $('#lab-fuse');
  if (fb) fb.onclick = async () => {
    fb.disabled = true;
    const r = await tryAct({ type: 'fuse', id: f.id });
    if (!r) { renderLab(); return; }
    if (r.serial) Online.state.mint[r.id] = Math.max(Online.state.mint[r.id] || 0, r.serial);
    labPick = [];
    fusionReveal(r); renderLab();
  };
}
const ECON_DUOS = parts => FUSIONS.filter(f => f.parts.length === 2 && S.owned[f.id] && f.parts.every(p => parts.includes(p)));
// Choose a hero for the next empty slot (only heroes you own; fusion cards can't be fused again).
function heroPicker() {
  const t = T(), need = FUSION_RULES[Math.max(2, labPick.length + 1)].minLevel;
  const options = BASE_HEROES.filter(h => S.owned[h.id] && !labPick.includes(h.id))
    .sort((a, b) => S.owned[b.id] - S.owned[a.id]);
  openModal(`<div class="big center" style="font-size:20px">${t.pickHero}</div>
    <p class="muted center small">${t.chkLevel(n(need))}</p>
    <div class="grid pick-grid">${options.map(h => `<button class="card pick ${S.owned[h.id] >= need ? '' : 'low'}" data-pick="${h.id}" style="--rc:${RARITY[h.rarity].color}">
      <img src="${img(h.id)}" alt=""><span class="lv">${t.level(n(S.owned[h.id]))}</span>
      <div class="info"><div class="nm">${h.name}</div></div></button>`).join('')}</div>`, box => {
    box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { labPick.push(b.dataset.pick); closeModal(); renderLab(); });
  });
}
function fusionReveal(r) {
  const t = T(), f = HERO_BY_ID[r.id], R = RARITY[f.rarity];
  haptic('heavy'); Sound.play('chest'); Sound.play('legend');
  openModal(`<div class="center">
    <div class="tag" style="color:${R.color}">${L().rarity[f.rarity]}</div>
    <div class="reveal" style="--rc:${R.color}"><div class="flip"><img src="${img(f.id)}" alt=""></div></div>
    <div class="big latin" style="font-size:26px">${f.name}</div>
    <div class="muted">${heroText(f.id).title}</div>
    <p style="font-weight:900">${t.fused}${r.serial ? ` <span class="serial inline">${t.serialOf(n(r.serial), n(r.supply))}</span>` : ''}</p>
    <button class="btn wide gold" id="fr-ok">${t.ok}</button>
    ${Online.tg() ? `<button class="btn wide gem" id="fr-share" style="margin-top:10px">${t.shareFusion}</button>` : ''}</div>`, box => {
    box.querySelector('#fr-ok').onclick = () => { closeModal(); };
    const sh = box.querySelector('#fr-share'); if (sh) sh.onclick = () => shareCard('fusion', f.id);
  });
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
  const t = T(), B = createBattle(S.team, S.owned, idx, r.seed, S.faction || null, r.market || null);
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
      case 'enrage':
        flashScreen('#ff6a00'); haptic('heavy'); Sound.play('boss');
        $('#b-banner').innerHTML = `<div class="banner enemy"><div class="s">${t.enrage}</div></div>`;
        break;
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
  const { idx, inputs } = BT, timeout = !!(BT.B && BT.B.timeout);
  cancelAnimationFrame(BT.raf);
  BT = null;
  Sound.music('menu');
  const before = Object.keys(ECON.UNLOCKS).filter(isOpen);
  let res;
  try { res = await act({ type: 'stageEnd', inputs }); } catch (e) { toast(errText(e)); res = { result: 'lose', stage: idx }; }
  res.timeout = timeout;
  res.unlocked = Object.keys(ECON.UNLOCKS).filter(k => isOpen(k) && !before.includes(k));
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
      ${res.timeout ? `<p class="muted">⏱️ ${t.timeUp}</p>` : ''}
      ${res.unlocked.length ? `<div class="unlocked">${res.unlocked.map(k => `<div>🔓 ${t.unlockedNew}: <b>${t.feat[k]}</b></div>`).join('')}</div>` : ''}
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
      ${res.timeout ? `<p class="muted">⏱️ ${t.timeUp}</p>` : ''}
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
    <button class="btn wide" id="ok">${t.letsGo}</button>
    <button class="btn wide ghost" id="hg" style="margin-top:10px">${t.readGuide}</button>`, box => {
    box.querySelector('#ok').onclick = done;
    box.querySelector('#hg').onclick = () => { S.seenHelp = true; save(); guideModal(); };
  }, { onBack: done });
  // First time: choose a community, then the daily reward.
  // (the picker replaces this window instead of closing and reopening one, which keeps browser history in step)
  function done() {
    const first = !S.seenHelp; S.seenHelp = true; save();
    if (first && !S.faction) return factionPicker({ suggest: SUGGEST, then: maybeDaily });
    closeModal(); if (first) maybeDaily();
  }
}
