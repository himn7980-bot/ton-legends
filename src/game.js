// Gram Legends — UI layer
const IMAGES = {/*IMAGES*/};
// Card image. Fusion cards use the uploaded artwork (/art/N) when it exists; otherwise a card is drawn on the fly
// from the parent heroes' posters (diagonal slices + frame + name), cached per fusion.
const BASE_IMG = {}, FART = {};
const baseSrc = id => IMAGES[id] || `images/${id}.jpg`;
function img(id, leader) {
  const h = HERO_BY_ID[id];
  if (!h || !h.fusion) return baseSrc(id);
  if (Online.state.art && Online.state.art.has(h.num)) return `art/${h.num}?v=${Online.state.art.get(h.num)}`;
  const lead = leader && h.parts.includes(leader) ? leader : S.owned && S.owned[id] ? ECON.leaderOf(S, id) : h.parts[0], off = officialPct(h), key = `${id}:${lead}:${off}`;
  return FART[key] || (FART[key] = drawFusion(h, lead, off)) || baseSrc(lead);
}
function preloadBaseImages(done) {
  let left = BASE_HEROES.length;
  for (const h of BASE_HEROES) {
    const im = new Image();
    im.onload = im.onerror = () => { if (--left === 0) done(); };
    im.src = baseSrc(h.id); BASE_IMG[h.id] = im;
  }
}
// Official alliances (approved by the admin) between two communities: +pct power for alliance cards with both.
function officialPct(f) {
  const list = (Online.state.alliances || []).filter(a => a.until > Date.now() && f.parts.includes(a.a) && f.parts.includes(a.b));
  return list.length ? Math.max(...list.map(a => a.pct)) : 0;
}
// Alliance card art drawn from the heroes' own posters: the leader big (with a crown) and the allies smaller
// beside it, every one complete and recognizable; name and members at the bottom.
function drawFusion(h, lead = h.parts[0], official = 0) {
  const ims = h.parts.map(p => BASE_IMG[p]);
  if (ims.some(im => !im || !im.complete || !im.naturalWidth)) return null; // not loaded yet: show the leader meanwhile
  const W = 360, H = 540, k = h.parts.length, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), col = k === 2 ? '#ff5ad1' : '#46f0ff', gold = '#ffc531';
  // background: night sky, a glowing moon and the rarity glow
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1240'); bg.addColorStop(0.6, '#140a2e'); bg.addColorStop(1, '#05040f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const moon = g.createRadialGradient(180, 170, 20, 180, 170, 170); moon.addColorStop(0, 'rgba(90,170,255,.55)'); moon.addColorStop(1, 'rgba(90,170,255,0)');
  g.fillStyle = moon; g.fillRect(0, 0, W, 360);
  const rr = (x, y, w, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // a hero's portrait: the poster without its title (top ~78%), cover-fitted into the frame
  const portrait = (id, x, y, w, hh, border, lw) => {
    const im = BASE_IMG[id], sw = im.naturalWidth, sh = im.naturalHeight * 0.78;
    const sc = Math.max(w / sw, hh / sh), dw = sw * sc, dh = sh * sc;
    g.save(); rr(x, y, w, hh, 14); g.clip();
    g.drawImage(im, 0, 0, sw, sh, x + (w - dw) / 2, y + (hh - dh) * 0.2, dw, dh); g.restore();
    g.save(); g.shadowColor = border; g.shadowBlur = 16; g.lineWidth = lw; g.strokeStyle = border; rr(x, y, w, hh, 14); g.stroke(); g.restore();
  };
  const allies = h.parts.filter(p => p !== lead);
  const L = k === 2 ? { lead: [22, 36, 200, 266], allies: [[232, 122, 108, 148]] }
    : { lead: [96, 30, 168, 230], allies: [[8, 128, 104, 142], [248, 128, 104, 142]] };
  allies.forEach((id, i) => portrait(id, ...L.allies[i], RARITY[HERO_BY_ID[id].rarity].color, 3));
  portrait(lead, ...L.lead, official ? gold : col, 5);
  g.textAlign = 'center'; g.font = '34px sans-serif';
  g.fillText('👑', L.lead[0] + L.lead[2] / 2, L.lead[1] + 8);
  // bottom band: tag, name, members (leader first)
  const band = g.createLinearGradient(0, 300, 0, H); band.addColorStop(0, 'rgba(5,4,15,0)'); band.addColorStop(0.25, 'rgba(5,4,15,.92)'); band.addColorStop(1, 'rgba(5,4,15,1)');
  g.fillStyle = band; g.fillRect(0, 300, W, H - 300);
  g.fillStyle = official ? gold : col; g.font = '900 16px Vazirmatn, sans-serif';
  g.fillText(`${official ? `🤝 OFFICIAL +${official}% · ` : ''}${k === 2 ? 'DUO' : 'TRIO'} ALLIANCE · #${h.num}`, W / 2, 352);
  g.fillStyle = '#fff'; g.font = `900 ${h.name.length > 20 ? 24 : 30}px Vazirmatn, sans-serif`;
  g.fillText(h.name, W / 2, 392, W - 24);
  g.fillStyle = '#aab4e0'; g.font = '700 15px Vazirmatn, sans-serif';
  g.fillText([lead, ...allies].map(id => HERO_BY_ID[id].name).join('  ·  '), W / 2, 424, W - 24);
  g.lineWidth = 6; g.strokeStyle = official ? gold : col; g.strokeRect(3, 3, W - 6, H - 6);
  return c.toDataURL('image/jpeg', 0.85);
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
const PREFS = () => ({ tutDone: false, sel: 0, world: 0, speed: 1, auto: false, tab: 'map', seenHelp: false, lang: null, sfx: true, music: true, stake: 100, updatedAt: 0 });
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
// ---------- deck synergies (green = bonus, red = penalty, grey = could be added) ----------
function synFx(x) {
  const t = T(), f = x.fx, pc = v => `${v > 0 ? '+' : '−'}${n(Math.round(Math.abs(v) * 100))}%`;
  return [f.hp ? `${pc(f.hp)} ${t.hp}` : '', f.atk ? `${pc(f.atk)} ${t.atk}` : '', f.energy ? t.synEnergy(n(f.energy)) : ''].filter(Boolean).join(' · ');
}
const synChip = (x, cls) => `<span class="syn ${cls}">${x.ico} ${T().synName[x.id]}<small>${synFx(x)}</small></span>`;
function synergyStrip(team) {
  const on = new Set(deckSynergies(team).ids);
  const act = SYNERGIES.filter(x => on.has(x.id)), miss = SYNERGIES.filter(x => !x.bad && !on.has(x.id));
  return `<button class="syn-strip" id="syn-info">${act.map(x => synChip(x, x.bad ? 'bad' : 'good')).join('')}
    ${miss.map(x => `<span class="syn off">${x.ico} ${T().synNeed[x.id]}</span>`).join('')}<span class="syn-q">?</span></button>`;
}
// Power before → after, green when the deck gets stronger, red when weaker; plus synergies gained / lost.
function deltaHtml(before, after, from, to) {
  const t = T(), a = teamPower(from), b = teamPower(to), d = Math.round(b) - Math.round(a);
  const s0 = new Set(deckSynergies(from).ids), s1 = new Set(deckSynergies(to).ids);
  const gained = SYNERGIES.filter(x => s1.has(x.id) && !s0.has(x.id)), lost = SYNERGIES.filter(x => s0.has(x.id) && !s1.has(x.id));
  return `<div class="pdelta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${t.powerPreview(n(Math.round(a)), n(Math.round(b)))} <b>${d > 0 ? '▲ +' : d < 0 ? '▼ −' : ''}${n(Math.abs(d))}</b>
    ${gained.length || lost.length ? `<div class="pd-syn">${gained.map(x => synChip(x, x.bad ? 'bad' : 'good')).join('')}${lost.map(x => `<span class="syn lost">✕ ${x.ico} ${t.synName[x.id]}</span>`).join('')}</div>` : ''}</div>`;
}
// Best swap for a card not in a full deck (null when no swap makes the deck stronger).
function bestSwap(id) {
  if (S.team.includes(id) || !S.owned[id]) return null;
  const now = teamPower(S.team);
  let best = null;
  for (let i = 0; i < S.team.length; i++) {
    const team = [...S.team]; team[i] = id;
    if (teamError(team)) continue;
    const d = teamPower(team) - now;
    if (d > 0 && (!best || d > best.d)) best = { i, d };
  }
  return best;
}
function synergyModal() {
  const t = T();
  openModal(`<div class="h2">🔗 ${t.synTitle}</div><p class="muted small">${t.synNote}</p>
    ${SYNERGIES.map(x => `<div class="syn-row ${x.bad ? 'bad' : 'good'}"><div class="row"><b>${x.ico} ${t.synName[x.id]}</b><span>${synFx(x)}</span></div><div class="muted small">${t.synNeed[x.id]}</div></div>`).join('')}
    <div class="h2" style="font-size:16px">⚔️ ${t.pairsTitle}</div><p class="muted small">${t.pairsText}</p>`);
}

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
const PARENT_TAB = { clan: 'rank', lab: 'heroes', pass: 'quests' };
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
  ({ map: renderMap, arena: renderArena, lab: renderLab, heroes: renderHeroes, chest: renderChest, quests: renderQuests, rank: renderRank, clan: renderClan, war: renderWar, pass: renderPass })[tab]();
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
  // Extra coins today: market dip, your community's territory and the captain's "gold" cry (the server freezes these per battle).
  const dip = ECON.marketCoinBonus(moods(), S.team), C = ECON.COMMUNITY;
  const terr = WAR && WAR.owners && S.faction && WAR.owners[w] === S.faction ? C.TERRITORY_BONUS : 0, gold = WAR && WAR.cry === 'gold' ? C.CRIES.gold.coins : 0;
  const ev = ECON.eventOf(Date.now()), setCoins = ECON.perksOf(S).coins || 0, weekend = ev === 'coins' ? ECON.EVENT_FX.coins : 0;
  const reward = ECON.stageCoins(S, S.sel, S.team, dip + terr + gold + setCoins + weekend), factor = ECON.replayFactor(S, S.sel);
  $('#screen').innerHTML = `
    <div class="world" style="background:${W.bg}">
      <div class="world-head">
        <button class="arrow" data-w="${w - 1}" ${w === 0 ? 'disabled' : ''}>${rtl ? '▶' : '◀'}</button>
        <div><div class="world-num">${t.worldOf(n(w + 1), n(WORLDS.length))}</div><div class="world-name">${worldName(w)}</div>${WAR && WAR.owners && WAR.owners[w] ? `<div class="world-owner ${WAR.owners[w] === S.faction ? 'mine' : ''}">🏰 <img src="${img(WAR.owners[w])}" alt="">${t.army(factionName(WAR.owners[w]))}</div>` : ''}</div>
        <button class="arrow" data-w="${w + 1}" ${nextOpen ? '' : 'disabled'}>${rtl ? '◀' : '▶'}</button>
      </div>
      <div class="stages">${nodes}</div>
    </div>
    <button class="event-banner" id="to-cal">${EVENT_ICON[ev]} <b>${t.ev[ev]}</b> · ${t.evFx[ev]}</button>
    ${ECON.rookieActive(S) ? rookieBanner() : ''}
    ${warBanner()}
    ${allyBanner()}
    ${tickerHtml()}
    ${nextUnlock() ? `<div class="next-unlock">🔓 ${t.nextUnlock(t.feat[nextUnlock()], n(unlockWorld(nextUnlock())))}</div>` : ''}
    <div class="panel">
      <div class="row"><div class="h2" style="margin:0">${t.stage(stageLabel(S.sel))} ${isBossStage(S.sel) ? '· ' + t.boss : ''}</div>
        <span class="tag gold">🪙 ${n(reward)}${first ? t.firstX2 : ` · 🔁 ${pct(factor * 100)}`}${dip ? ` · 📉 +${pct(dip * 100)}` : ''}${terr ? ` · 🏰 +${pct(terr * 100)}` : ''}${gold ? ` · 📯 +${pct(gold * 100)}` : ''}${weekend ? ` · 🎉 +${pct(weekend * 100)}` : ''}</span></div>
      ${isBossStage(S.sel) ? weakHint(W.weak) : ''}
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
  $('#to-cal').onclick = () => show('quests');
  if ($('#to-rookie')) $('#to-rookie').onclick = () => show('quests');
  if ($('#ticker')) $('#ticker').onclick = marketModal;
  $('#go').onclick = () => startBattle(S.sel);
}

// Boss weak spot: which status doubles its damage taken, and which of your heroes can cause it.
function weakHint(k) {
  const t = T(), by = WEAK_BY[k].map(id => `<span class="${S.owned[id] ? 'own' : ''}">${HERO_BY_ID[id].name}</span>`).join(' / ');
  return `<div class="weak-hint">🎯 ${t.weakTo} <b>${STATUS_ICON[k]} ${t.st[k]}</b> · ${t.weakX2} · ${by}</div>`;
}
// ---------- heroes ----------
let ARRANGE = null; // { sel: slot index | null } while swapping team positions
function renderHeroes() {
  const t = T(), owned = BASE_HEROES.filter(h => S.owned[h.id]).length, holos = BASE_HEROES.filter(h => S.holo[h.id]).length;
  // Collection: all base heroes + the fusion cards you crafted (the rest live in the Fusion Lab).
  const order = HEROES.filter(h => !h.fusion || S.owned[h.id])
    .sort((a, b) => (!!S.owned[b.id] - !!S.owned[a.id]) || ('XMLERC'.indexOf(a.rarity) - 'XMLERC'.indexOf(b.rarity)));
  $('#screen').innerHTML = `
    <div class="h2">${t.battleTeam} <span class="muted">(${n(S.team.length)}/${n(5)} · ${t.power} ${n(teamPower(S.team))})</span></div>
    <div class="row-labels"><span>${t.front}</span><span>${t.back}</span></div>
    <div class="team-slots ${ARRANGE ? 'arranging' : ''}">${[0, 1, 2, 3, 4].map(i => `<button class="slot ${i < 2 ? 'row-front' : 'row-back'} ${ARRANGE && ARRANGE.sel === i ? 'sel' : ''}" data-slot-i="${i}" data-id="${S.team[i] || ''}">${S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '+'}</button>`).join('')}</div>
    <div class="row" style="margin-top:6px"><span class="muted small" style="flex:1">${ARRANGE ? t.arrangeHint : t.formationNote}</span>
      ${S.team.length > 1 ? `<button class="tag ${ARRANGE ? 'gold' : ''}" id="arrange">${ARRANGE ? '✓ ' + t.ok : t.arrange}</button>` : ''}</div>
    ${S.team.length ? synergyStrip(S.team) : ''}
    ${isOpen('duo') ? `<button class="btn wide lab-btn" id="to-lab">${t.openLab}</button>` : `<button class="btn wide ghost" disabled>${t.openLab} · 🔒 ${t.worldN(n(unlockWorld('duo')))}</button>`}
    <p class="muted small center" style="margin:6px 0 0">${t.teamRule}</p>
    <div class="h2">${t.setsTitle}</div>
    <div class="sets">${ECON.SETS.map(st => { const done = ECON.setDone(S, st), fx = Object.keys(st.perk)[0];
      return `<div class="set ${done ? 'done' : ''}"><div class="row"><b>${st.ico} ${t.setName[st.id]}</b><span class="${done ? 'tag gold' : 'muted small'}">${done ? '✓ ' + t.setDone : n(st.heroes.filter(id => (S.owned[id] || 0) >= ECON.SET_LEVEL).length) + '/4'}</span></div>
        <div class="set-heroes">${st.heroes.map(id => `<div class="${(S.owned[id] || 0) >= ECON.SET_LEVEL ? 'ok' : ''}"><img src="${img(id)}" alt=""><small>${S.owned[id] ? t.level(n(S.owned[id])) : '🔒'}</small></div>`).join('')}</div>
        <div class="small ${done ? '' : 'muted'}">${t.setFx[fx]}</div></div>`; }).join('')}</div>
    <p class="muted small">${t.setNote(n(ECON.SET_LEVEL))}</p>
    <div class="h2">${t.collection} <span class="muted">(${n(owned)}/${n(BASE_HEROES.length)}) · ${t.holoCount(n(holos), n(BASE_HEROES.length))}</span></div>
    <div class="grid">${order.map(cardHtml).join('')}</div>`;
  document.querySelectorAll('.card').forEach(c => c.onclick = () => c.dataset.id && heroModal(c.dataset.id));
  // Arrange mode: tap two team slots to swap them (the first two cards form the front row).
  document.querySelectorAll('.slot').forEach(c => c.onclick = async () => {
    const i = +c.dataset.slotI;
    if (!ARRANGE) return c.dataset.id && heroModal(c.dataset.id);
    if (!S.team[i]) return;
    if (ARRANGE.sel === null) { ARRANGE.sel = i; return renderHeroes(); }
    const team = [...S.team], j = ARRANGE.sel; [team[i], team[j]] = [team[j], team[i]];
    ARRANGE.sel = null;
    if (i !== j) { haptic('light'); await tryAct({ type: 'team', team }); }
    renderHeroes();
  });
  if ($('#arrange')) $('#arrange').onclick = () => { ARRANGE = ARRANGE ? null : { sel: null }; renderHeroes(); };
  if ($('#to-lab')) $('#to-lab').onclick = () => show('lab');
  if ($('#syn-info')) $('#syn-info').onclick = synergyModal;
}
const starsHtml = lv => { const k = ECON.starsOf(lv); return k ? `<span class="stars">${'★'.repeat(k)}</span>` : ''; };
const EVENT_ICON = { coins: '🎉', war: '⚔️', ai: '🤖', chest: '🎁', sale: '🏷️', arena: '🥊', none: '📅' };
// Collection hint: how much stronger the deck gets with this card (free slot) or with its best swap (full deck).
function deckHint(id) {
  if (!S.owned[id] || S.team.includes(id) || S.tab !== 'heroes') return '';
  let d;
  if (S.team.length < 5) { const team = [...S.team, id]; if (teamError(team)) return ''; d = teamPower(team) - teamPower(S.team); } else { const b = bestSwap(id); if (!b) return ''; d = b.d; }
  return d >= 1 ? `<span class="dhint">▲ ${n(Math.round(d))}</span>` : '';
}
function cardHtml(h) {
  const t = T(), lv = S.owned[h.id], rc = RARITY[h.rarity].color;
  const canUp = lv && lv < MAX_LEVEL && S.coins >= ECON.upgradePrice(S, h.id, lv);
  const deck = S.team.indexOf(h.id);
  return `<button class="card ${lv ? '' : 'locked'} ${deck >= 0 ? 'in-deck' : ''} ${S.holo[h.id] ? 'holo' : ''} ${frameOf(h.id)} ${ECON.starsOf(lv) === 5 ? 'awakened' : ''}" data-id="${h.id}" style="--rc:${rc}">
    <img src="${img(h.id)}" alt="${h.name}" loading="lazy">
    ${lv ? `<span class="lv">${t.level(n(lv))}</span>` : '<span class="lock">🔒</span>'}${starsHtml(lv)}
    <span class="rl">${ROLES[h.role].icon}</span>
    ${h.id === S.faction ? '<span class="fac-flag">🚩</span>' : ''}${canUp ? '<span class="up">⬆️</span>' : ''}${deckHint(h.id)}${S.serials[h.id] ? `<span class="serial">#${n(S.serials[h.id])}</span>` : ''}
    ${deck >= 0 ? `<span class="deck-mark"><b>✓</b>${t.inTeam} · ${n(deck + 1)}</span>` : ''}
    <div class="info"><div class="nm">${h.name}</div><div class="muted" style="font-size:11px">${heroText(h.id).title}</div></div>
  </button>`;
}
function heroModal(id) {
  const t = T(), h = HERO_BY_ID[id], ht = heroText(id), lv = S.owned[id], R = RARITY[h.rarity];
  // Stats as they fight for you (your community's card and fusions with it are stronger).
  const mine = factionMult(id, S.faction) * marketMult(id, ECON.marketBoosts(moods())) * (h.fusion ? 1 + officialPct(h) / 100 : 1), boosted = l => { const x = heroStats(id, l); return { ...x, hp: Math.round(x.hp * mine), atk: Math.round(x.atk * mine) }; };
  const s = boosted(lv || 1);
  const cost = lv ? ECON.upgradePrice(S, id, lv) : 0, inTeam = S.team.includes(id);
  const fusionCap = !inTeam && !!teamError([...S.team, id]); // a team holds 2 fusion cards (1 trio): say so instead of failing
  const next = lv && lv < MAX_LEVEL ? boosted(lv + 1) : null;
  openModal(`
    <div class="poster-wrap ${S.holo[id] ? 'holo' : ''}" style="--rc:${R.color}"><img class="poster" src="${img(id)}" alt="">
      ${S.holo[id] ? `<span class="holo-tag">${t.holo}</span>` : ''}${S.serials[id] ? `<span class="serial big-serial">#${n(S.serials[id])}/${n(FUSION_RULES[h.parts.length].supply)}</span>` : ''}</div>
    <div class="row" style="margin-top:12px"><div><div class="big latin" style="font-size:26px">${h.name}</div><div class="muted">${ht.title}</div></div>
      <div class="end"><span class="tag" style="color:${R.color}">${L().rarity[h.rarity]}</span><div class="muted" style="margin-top:6px">${ROLES[h.role].icon} ${L().role[h.role]}</div></div></div>
    ${lv ? `<div class="star-line">${ECON.STAR_LEVELS.map(l => `<span class="${lv >= l ? 'on' : ''}">★</span>`).join('')}
      <small>${ECON.starsOf(lv) === 5 ? t.awakened : t.nextStar(n(ECON.STAR_LEVELS[ECON.starsOf(lv)]))}</small></div>` : ''}
    ${moodBadge(id)}
    ${h.fusion ? allianceHtml(h, lv) : ''}
    ${mine > 1 ? `<div class="fac-badge">${id === S.faction ? `${t.yourCommunity} · ${t.factionPerkShort}` : `🚩 ${t.army(factionName(S.faction))} · +${n(Math.round((mine - 1) * 100))}%`}</div>` : ''}
    <div class="stats">
      <div>${t.hp}<b>${n(s.hp)}</b>${next ? `<span style="color:var(--green)">+${n(next.hp - s.hp)}</span>` : ''}</div>
      <div>${t.atk}<b>${n(s.atk)}</b>${next ? `<span style="color:var(--green)">+${n(next.atk - s.atk)}</span>` : ''}</div>
      <div>${t.lvl}<b>${lv ? n(lv) : '—'}</b>${t.of(n(MAX_LEVEL))}</div>
    </div>
    ${lv ? deckPreview(id) : ''}
    <div class="skill">${t.special} <b>${ht.skill}</b><div class="muted" style="color:var(--text);margin-top:4px">${ht.desc}</div></div>
    ${lv ? `<div class="btns">
      <button class="btn gold" id="up" ${!next || S.coins < cost ? 'disabled' : ''}>${next ? t.upgrade(n(cost)) : t.maxLevel}</button>
      <button class="btn ${inTeam ? 'ghost' : ''}" id="tm" ${!inTeam && (S.team.length >= 5 || fusionCap) ? 'disabled' : ''}>${inTeam ? t.leaveTeam : S.team.length >= 5 ? t.teamFull : fusionCap ? t.err.fusion_limit : t.joinTeam}</button>
    </div>` : h.fusion ? `<p class="center muted">${t.fuseHow(n(FUSION_RULES[h.parts.length].cost))}</p><button class="btn wide" id="tolab">${t.openLab}</button>`
      : `<p class="center muted">${t.getFromChest}</p><button class="btn wide" id="tochest">${t.goChest}</button>`}
  `, box => {
    const up = box.querySelector('#up'), tm = box.querySelector('#tm'), tc = box.querySelector('#tochest');
    if (up) up.onclick = async () => { up.disabled = true; if (await tryAct({ type: 'upgrade', id })) { haptic('medium'); Sound.play('heal'); refresh(); heroModal(id); } else up.disabled = false; };
    if (tm) tm.onclick = async () => { const team = inTeam ? S.team.filter(x => x !== id) : [...S.team, id]; if (await tryAct({ type: 'team', team })) { closeModal(); refresh(); } };
    if (tc) tc.onclick = () => { closeModal(); show('chest'); };
    const tl = box.querySelector('#tolab'); if (tl) tl.onclick = () => { closeModal(); show('lab'); };
    box.querySelectorAll('[data-swap]').forEach(b => b.onclick = async () => {
      const team = [...S.team]; team[+b.dataset.swap] = id;
      if (await tryAct({ type: 'team', team })) { haptic('medium'); closeModal(); refresh(); }
    });
    box.querySelectorAll('[data-lead]').forEach(b => b.onclick = async () => {
      if (await tryAct({ type: 'leader', id, hero: b.dataset.lead })) { haptic('light'); refresh(); heroModal(id); }
    });
  });
}
// Official alliances running now (map banner).
function allyBanner() {
  const t = T(), now = Date.now(), list = (Online.state.alliances || []).filter(a => a.until > now);
  return list.map(a => `<div class="ally-banner">🤝 ${t.allyBanner(HERO_BY_ID[a.a].name, HERO_BY_ID[a.b].name, n(a.pct), n(Math.ceil((a.until - now) / 864e5)))}</div>`).join('');
}
// Card screen: what this card does to the deck — remove / add preview, or (deck full) every possible swap.
function deckPreview(id) {
  const t = T();
  if (S.team.includes(id)) return S.team.length > 1 ? deltaHtml(0, 0, S.team, S.team.filter(x => x !== id)) : '';
  if (S.team.length < 5) { const team = [...S.team, id]; return teamError(team) ? '' : deltaHtml(0, 0, S.team, team); }
  const now = teamPower(S.team);
  return `<div class="swap-box"><div class="muted small">${t.swapTitle}</div><div class="swap-row">${S.team.map((x, i) => {
    const team = [...S.team]; team[i] = id; const bad = !!teamError(team), d = bad ? 0 : Math.round(teamPower(team) - now);
    return `<button class="swap ${d > 0 ? 'up' : d < 0 ? 'down' : ''}" data-swap="${i}" ${bad ? 'disabled' : ''}><img src="${img(x)}" alt=""><b>${bad ? '—' : (d > 0 ? '▲ +' : d < 0 ? '▼ −' : '') + n(Math.abs(d))}</b></button>`;
  }).join('')}</div></div>`;
}
// Alliance card: its member communities, the leader (shown big; you can change it) and an official alliance bonus.
function allianceHtml(h, owned) {
  const t = T(), lead = owned ? ECON.leaderOf(S, h.id) : h.parts[0], off = officialPct(h);
  return `<div class="ally-box">
    ${off ? `<div class="ally-official">${t.officialAlly(n(off))}</div>` : ''}
    <div class="muted small">${t.allyMembers}</div>
    <div class="ally-members">${h.parts.map(p => `<button class="ally-m ${p === lead ? 'lead' : ''}" ${owned && p !== lead ? `data-lead="${p}"` : 'disabled'}>
      <img src="${img(p)}" alt=""><span>${p === lead ? '👑 ' : ''}${HERO_BY_ID[p].name}</span></button>`).join('')}</div>
    ${owned ? `<div class="muted small">${t.leaderHint}</div>` : ''}
  </div>`;
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
// One rule, no surprises: any 2 (or, from world 8, 3) of your heroes make a fusion card for a fixed coin price.
// The button always says what is possible right now; it is never an enabled button that then fails.
function fusionState(f) {
  const rule = FUSION_RULES[f.parts.length], mint = Online.state.mint || {}, online = !!Online.state.profile;
  const kind = f.parts.length === 3 ? 'trio' : 'duo', left = rule.supply - (mint[f.id] || 0);
  if (S.owned[f.id]) return { key: 'owned' };
  if (!isOpen(kind)) return { key: 'locked', kind };
  if (f.parts.some(p => !S.owned[p])) return { key: 'missing' };
  if (online && left <= 0) return { key: 'soldout' };
  if (S.coins < rule.cost) return { key: 'coins', need: rule.cost - S.coins };
  return { key: 'ok', left, rule };
}
function renderLab() {
  const t = T(), online = !!Online.state.profile, mint = Online.state.mint || {};
  if (!isOpen('duo')) {
    $('#screen').innerHTML = `<div class="h2">${t.labTitle}</div><div class="panel center"><div style="font-size:54px">🧪</div>
      <p style="font-weight:700">${t.labLocked(n(unlockWorld('duo')))}</p><p class="muted small">${t.labSimple}</p></div>`;
    return;
  }
  labPick = labPick.filter(id => S.owned[id]);
  const trioOpen = isOpen('trio'), f = fusionFor(labPick);
  const mine = FUSIONS.filter(x => S.owned[x.id]);
  const slot = i => {
    const id = labPick[i];
    if (id) return `<button class="altar-slot filled ok" data-slot="${i}"><img src="${img(id)}" alt=""><b>${t.level(n(S.owned[id]))}</b><span class="x">✕</span></button>`;
    if (i === 2 && !trioOpen) return `<div class="altar-slot opt locked"><span class="plus">🔒</span><small>${t.trioLock(n(unlockWorld('trio')))}</small></div>`;
    return `<button class="altar-slot ${i === 2 ? 'opt' : ''}" data-slot="${i}"><span class="plus">+</span><small>${i === 2 ? t.slotOptional : t.pickHero}</small></button>`;
  };
  let result = `<p class="muted center">${t.altarHint}</p>`;
  if (f) {
    const st = fusionState(f), rule = FUSION_RULES[f.parts.length], start = fusionStartLevel(S.owned, f.parts);
    const left = rule.supply - (mint[f.id] || 0);
    const btn = st.key === 'ok' ? `<button class="btn wide gold" id="lab-fuse">${t.fuse(n(rule.cost))}</button>`
      : st.key === 'owned' ? `<button class="btn wide" id="lab-open">${t.ownedOpen}</button>`
      : st.key === 'coins' ? `<button class="btn wide ghost" disabled>${t.needMore(n(st.need))}</button>`
      : st.key === 'soldout' ? `<button class="btn wide ghost" disabled>${t.soldOut}</button>`
      : `<button class="btn wide ghost" disabled>🔒 ${t.lockedUntil(t.feat[st.kind || 'duo'], n(unlockWorld(st.kind || 'duo')))}</button>`;
    result = `<div class="fresult" style="--rc:${RARITY[f.rarity].color}">
      <button class="fr-img" data-hero="${f.id}"><img src="${img(f.id, st.key === 'owned' ? null : labPick[0])}" alt=""><span class="fnum">#${f.num}</span></button>
      <div class="fr-info">
        <div class="tag" style="color:${RARITY[f.rarity].color}">${L().rarity[f.rarity]}</div>
        <div class="fname latin">${f.name}</div>
        <div class="muted small">${heroText(f.id).skill}</div>
        <div class="fr-facts">
          ${st.key === 'owned' ? '' : `<div>⭐ ${t.startsAt(n(start))}</div>`}
          <div>🪙 ${n(rule.cost)}</div>
          ${online ? `<div>🔢 ${t.left(n(Math.max(0, left)), n(rule.supply))}</div>` : ''}
          ${st.key === 'owned' ? '' : `<div>👑 ${t.leaderIs(HERO_BY_ID[labPick[0]].name)}</div>`}
          <div class="muted">✅ ${t.heroesKept}</div>
        </div>
      </div></div>${btn}`;
  }
  // Ready-to-craft suggestions: every combination of your heroes you can make right now (best starting level first).
  const ready = FUSIONS.filter(x => fusionState(x).key === 'ok')
    .map(x => ({ x, lv: fusionStartLevel(S.owned, x.parts) })).sort((a, b) => b.x.parts.length - a.x.parts.length || b.lv - a.lv).slice(0, 12);
  $('#screen').innerHTML = `<div class="h2">${t.labTitle}</div>
    <p class="muted small">${t.labSimple}</p>
    <div class="panel altar">
      <div class="altar-slots">${slot(0)}<span class="altar-op">+</span>${slot(1)}<span class="altar-op">+</span>${slot(2)}</div>
      ${result}
    </div>
    <div class="h2">${t.craftNow}</div>
    ${ready.length ? `<div class="craft-row">${ready.map(({ x, lv }) => `<button class="craft" data-craft="${x.id}" style="--rc:${RARITY[x.rarity].color}">
        <img src="${img(x.id)}" alt=""><span class="cn">${x.name}</span><small>${t.level(n(lv))} · 🪙 ${n(FUSION_RULES[x.parts.length].cost)}</small></button>`).join('')}</div>`
      : `<p class="muted small">${S.coins < FUSION_RULES[2].cost ? t.needMore(n(FUSION_RULES[2].cost - S.coins)) : t.craftNone}</p>`}
    <div class="panel rules"><div class="t">${t.rulesTitle}</div>
      <div class="rule-row"><span>${t.duo}</span><span>🪙 ${n(FUSION_RULES[2].cost)} · ${t.copies(n(FUSION_RULES[2].supply))}</span></div>
      <div class="rule-row"><span>${t.trio}</span><span>🪙 ${n(FUSION_RULES[3].cost)} · ${t.copies(n(FUSION_RULES[3].supply))}${trioOpen ? '' : ` · 🔒 ${t.worldN(n(unlockWorld('trio')))}`}</span></div>
      <p class="muted small" style="margin:8px 0 0">${t.fuseRules}</p>
    </div>
    <div class="h2">${t.myFusions} <span class="muted">(${n(mine.length)}/${n(FUSIONS.length)})</span></div>
    ${mine.length ? `<div class="grid">${mine.map(cardHtml).join('')}</div>` : `<p class="muted center">${t.noFusions}</p>`}`;
  document.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
    const i = +b.dataset.slot;
    if (labPick[i]) { labPick.splice(i, 1); renderLab(); } else heroPicker();
  });
  document.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => heroModal(b.dataset.hero));
  document.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { labPick = [...HERO_BY_ID[b.dataset.craft].parts]; renderLab(); window.scrollTo(0, 0); });
  document.querySelectorAll('.grid .card').forEach(c => c.onclick = () => heroModal(c.dataset.id));
  const open = $('#lab-open'); if (open) open.onclick = () => heroModal(f.id);
  const fb = $('#lab-fuse');
  if (fb) fb.onclick = async () => {
    fb.disabled = true;
    const r = await tryAct({ type: 'fuse', id: f.id, leader: labPick[0] });
    if (!r) { renderLab(); return; }
    if (r.serial) Online.state.mint[r.id] = Math.max(Online.state.mint[r.id] || 0, r.serial);
    labPick = [];
    fusionReveal(r); renderLab();
  };
}
// Choose a hero for the next empty slot: any hero you own (fusion cards can't be fused again).
function heroPicker() {
  const t = T();
  const options = BASE_HEROES.filter(h => S.owned[h.id] && !labPick.includes(h.id)).sort((a, b) => S.owned[b.id] - S.owned[a.id]);
  openModal(`<div class="big center" style="font-size:20px">${t.pickHero}</div>
    <div class="grid pick-grid">${options.map(h => {
      const made = fusionFor([...labPick, h.id]);
      return `<button class="card pick" data-pick="${h.id}" style="--rc:${RARITY[h.rarity].color}">
      <img src="${img(h.id)}" alt=""><span class="lv">${t.level(n(S.owned[h.id]))}</span>${made && S.owned[made.id] ? '<span class="have">✓</span>' : ''}
      <div class="info"><div class="nm">${h.name}</div></div></button>`; }).join('')}</div>`, box => {
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
const STATUS_ICON = Object.fromEntries(STATUS_ICONS);
const isMine = u => u.side === ((BT && BT.mySide) || 'hero');
const allUnits = () => [...BT.B.heroes, ...BT.B.enemies];

// A row with a long (three-word fusion) name gives every name in it room for three lines, so the bars line up.
const tallNames = units => (units.some(u => u.name.length > 18) ? 'tall-names' : '');
function unitCard(u) {
  const mine = isMine(u);
  const rc = !mine ? (u.boss ? '#ff3b3b' : '#e0475a') : RARITY[HERO_BY_ID[u.id].rarity].color;
  return `<div class="hcard ${mine ? 'hero' : 'enemy'} ${u.boss ? 'boss' : ''} ${mine ? frameOf(u.id) : ''}" data-uid="${u.uid}" style="--rc:${rc}">
    ${mine ? '<span class="ready">⚡</span>' : ''}${u.boss ? '<span class="crown">👑</span>' : ''}${u.weak ? `<span class="weak-tag">🎯${STATUS_ICON[u.weak]}</span>` : ''}${u.row === 'front' ? '<span class="row-tag">🛡️</span>' : ''}
    <span class="orbit"><span class="ring"><i></i><i></i><i></i><i></i></span></span><span class="sheen" style="--sd:${(u.uid * 0.77) % 5}s"></span>
    <img src="${img(u.id)}" alt=""><div class="status"></div>
    <div class="hc-name ${u.name.length > 12 ? 'long' : ''}">${u.name}</div><div class="bar hp ${mine ? 'h' : ''}"><i></i><i class="sh" style="width:0"></i></div><div class="bar en"><i></i></div></div>`;
}

// Draws the battle screen for the current BT. mine = my cards (bottom), theirs = opponent cards (top).
function buildBattle({ title, bg, scene, mine, theirs, oppLabel, myLabel, onTap, onAuto, onUlt, showSpeed }) {
  const t = T(), el = $('#battle');
  el.style.background = bg; el.classList.remove('has-emotes');
  el.innerHTML = `<canvas id="b-scene"></canvas>
    <div class="b-top">
      <button id="b-exit">✕</button>
      <div class="b-title">${title}</div>
      ${showSpeed ? `<button id="b-speed">×${n(S.speed)}</button>` : ''}
      <button id="b-auto" class="${S.auto ? 'on' : ''}">${t.auto}</button>
    </div>
    ${oppLabel ? `<div class="b-name opp">${oppLabel}</div>` : ''}
    <div class="b-enemies n${theirs.length} ${tallNames(theirs)}">${theirs.map(unitCard).join('')}</div>
    <div class="b-vs">VS</div>
    <div class="b-mid"><div id="b-banner"></div></div>
    <div class="b-heroes ${tallNames(mine)}">${mine.map(unitCard).join('')}</div>
    ${myLabel ? `<div class="b-name me">${myLabel}</div>` : ''}
    <div class="ult-wrap"><div class="ult-bar"><i id="b-ult-i"></i></div><button id="b-ult" disabled>${t.ult}</button></div>
    <div class="b-hint">${t.tapHint}</div>
    <div id="b-fx"></div>`;
  el.hidden = false;
  Scene.start($('#b-scene'), scene ? scene.key : 'galaxy', scene ? scene.ch : 0);
  BT.els = new Map();
  el.querySelectorAll('[data-uid]').forEach(nd => {
    BT.els.set(+nd.dataset.uid, { root: nd, hp: nd.querySelector('.bar.hp i'), sh: nd.querySelector('.sh'), en: nd.querySelector('.bar.en i'), st: nd.querySelector('.status'), last: {} });
  });
  el.querySelectorAll('.hcard.hero').forEach(nd => nd.onclick = () => {
    const u = mine.find(x => x.uid === +nd.dataset.uid);
    if (BT && !BT.ended && u && u.alive && u.energy >= 100) { haptic('medium'); onTap(u); }
  });
  $('#b-exit').onclick = confirmLeave;
  $('#b-ult').onclick = () => { if (BT && !BT.ended && BT.B.ult && BT.B.ult[BT.mySide] >= 100) { haptic('heavy'); onUlt(); } };
  if (showSpeed) $('#b-speed').onclick = e => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; save(); e.target.textContent = '×' + n(S.speed); };
  $('#b-auto').onclick = e => { S.auto = !S.auto; save(); e.target.classList.toggle('on', S.auto); onAuto(S.auto); };
  render();
  syncNav();
}

async function startBattle(idx) {
  if (BT) return;
  const r = await tryAct({ type: 'stageStart', stage: idx });
  if (!r) return;
  const t = T(), B = createBattle(S.team, S.owned, idx, r.seed, S.faction || null, r.market || null, r.perks || null);
  // Taps are queued and applied at the next fixed tick, and recorded as [tick, code] so the server can replay the fight.
  // The very first battle is guided: it pauses and shows what to tap (a glowing card, then the ultimate).
  const tut = !S.tutDone && S.cleared === 0 && idx === 0;
  if (tut) { S.auto = false; save(); }
  BT = { mode: 'stage', B, idx, mySide: 'hero', inputs: [], queue: S.auto ? [-1] : [], acc: 0, last: performance.now(), raf: 0, ended: false, tut: tut ? { step: 0 } : null };
  buildBattle({
    title: `${t.stage(stageLabel(idx))}${isBossStage(idx) ? ' · ' + t.bossCrown : ''}`, bg: WORLDS[Math.floor(idx / STAGES_PER_WORLD)].bg,
    scene: { key: WORLDS[Math.floor(idx / STAGES_PER_WORLD)].key, ch: WORLDS[Math.floor(idx / STAGES_PER_WORLD)].chapter }, mine: B.heroes, theirs: B.enemies, showSpeed: true,
    onTap: u => { BT.queue.push(u.uid); tutorDone(1); }, onAuto: on => BT.queue.push(on ? -1 : -2), onUlt: () => { BT.queue.push(-3); tutorDone(2); },
  });
  Sound.music('battle');
  if (tut) coach(T().tut1, 3200);
  BT.raf = requestAnimationFrame(loop);
}

// ---------- first-battle coach ----------
function coach(text, ms) {
  const old = document.querySelector('.coach-bubble'); if (old) old.remove();
  if (!text) return;
  const d = document.createElement('div'); d.className = 'coach-bubble'; d.textContent = text;
  $('#battle').appendChild(d);
  if (ms) setTimeout(() => d.remove(), ms);
}
function coachTarget(el) {
  document.querySelectorAll('.coached').forEach(x => x.classList.remove('coached'));
  if (el) el.classList.add('coached');
}
// Called every frame of the guided battle: pause when there is something to learn.
function tutorCheck() {
  const tut = BT && BT.tut; if (!tut || BT.paused) return;
  const B = BT.B;
  if (tut.step === 0) {
    const u = B.heroes.find(x => x.alive && x.energy >= 100);
    if (u) { tut.step = 1; BT.paused = true; coachTarget(BT.els.get(u.uid).root); coach(T().tut2); }
  } else if (tut.step === 1.5 && B.ult.hero >= 100) {
    tut.step = 2; BT.paused = true; coachTarget($('#b-ult')); coach(T().tut4);
  }
}
function tutorDone(step) {
  const tut = BT && BT.tut; if (!tut || tut.step !== step) return;
  BT.paused = false; BT.last = performance.now(); coachTarget(null);
  if (step === 1) { tut.step = 1.5; coach(T().tut3, 3800); } else { tut.step = 3; coach(null); }
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
    if (BT.tut) { tutorCheck(); if (BT.paused) break; }
  }
  flush();
  if (B.over && !BT.ended) { BT.ended = true; syncNav(); setTimeout(finishStage, 900); }
  BT.raf = requestAnimationFrame(loop);
}

function flush() { processEvents(); render(); }

function render() {
  const B = BT.B;
  const ult = B.ult ? Math.round(B.ult[BT.mySide] || 0) : 0;
  if (BT.lastUlt !== ult) {
    BT.lastUlt = ult;
    const bar = $('#b-ult-i'), btn = $('#b-ult');
    if (bar) bar.style.width = ult + '%';
    if (btn) { btn.disabled = ult < 100; btn.classList.toggle('ready', ult >= 100); }
  }
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
        if (e) { anim(e.root, 'casting'); const bx = $('#battle').getBoundingClientRect(), r = e.root.getBoundingClientRect(); Scene.burst(r.left - bx.left + r.width / 2, r.top - bx.top + r.height / 2, enemy ? '#ff4a4a' : SKILL_COLORS[ev.id] || '#ffd85a'); }
        $('#b-banner').innerHTML = `<div class="banner ${enemy ? 'enemy' : ''}"><img src="${img(ev.id)}" alt=""><div><div class="s">${heroText(ev.id).skill}</div><div class="n">${HERO_BY_ID[ev.id].name}</div></div></div>`;
        flashScreen(enemy ? '#ff2a2a' : SKILL_COLORS[ev.id]);
        break;
      }
      case 'combo': float(ev.uid, t.combo[ev.kind], 'combo'); Sound.play('crit'); break;
      case 'weakhit': float(ev.uid, t.weakHit, 'weak'); haptic('medium'); break;
      case 'ult':
        flashScreen(ev.side === BT.mySide ? '#ffd85a' : '#ff3b3b'); anim($('#battle'), 'shake'); haptic('heavy'); Sound.play('legend');
        $('#b-banner').innerHTML = `<div class="banner ${ev.side === BT.mySide ? '' : 'enemy'}"><div class="s">${t.ultBanner}</div></div>`;
        break;
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
  if (BT.tut) { S.tutDone = true; save(); coach(null); }
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
      ${res.unlocked.length ? `<div class="unlocked">${res.unlocked.map(k => `<div class="unl"><div>🔓 ${t.unlockedNew}: <b>${t.feat[k]}</b></div>
        <div class="small muted">${t.featIntro[k]}</div><button class="btn gold" data-go="${k}">${t.showMe}</button></div>`).join('')}</div>` : ''}
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
  // "Show me" on a newly unlocked feature: go straight to it.
  const where = { royal: 'chest', gemChest: 'chest', exchange: 'chest', ai: 'arena', pvp: 'arena', duo: 'lab', trio: 'lab', clan: 'clan' };
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = leave(() => { $('#battle').hidden = true; show(where[b.dataset.go] || 'map'); }));
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
