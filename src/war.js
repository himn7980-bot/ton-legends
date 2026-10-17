// Gram Legends — Community War screen, community picker and story/share cards.
// Rules live in economy.js (perks) and server/war.js (weekly points and rewards); this file only shows them.
let WAR = null; // last /api/war/me answer

const factionName = id => (HERO_BY_ID[id] ? HERO_BY_ID[id].name : id);
async function loadWar() {
  if (!Online.state.profile) return null;
  try { WAR = await Online.war('me'); } catch (e) { return null; }
  return WAR;
}
const myRank = () => (WAR && S.faction ? WAR.standings.findIndex(x => x.id === S.faction) + 1 : 0);

// ---------- picker ----------
function factionPicker(opts = {}) {
  const t = T();
  let pick = S.faction || opts.suggest || null;
  const switching = !!S.faction;
  const draw = box => {
    box.innerHTML = `<div class="big center" style="font-size:22px">${t.pickTitle}</div>
      <p class="muted center small">${t.pickNote}</p>
      ${opts.suggest && !switching ? `<p class="center friend-in">🤝 ${t.friendIn(factionName(opts.suggest))}</p>` : ''}
      <div class="fac-grid">${BASE_HEROES.map(h => `<button class="fac ${h.id === pick ? 'on' : ''}" data-fac="${h.id}" style="--rc:${RARITY[h.rarity].color}">
        <img src="${img(h.id)}" alt="">${S.owned[h.id] ? `<i class="fac-own">✓ ${t.ownedShort}</i>` : ''}<span>${h.name}</span>${WAR ? `<small>${n((WAR.standings.find(x => x.id === h.id) || {}).members || 0)} 👤</small>` : ''}</button>`).join('')}</div>
      <div class="perks">${t.perks.map(x => `<div>${x}</div>`).join('')}</div>
      <p class="muted small center">${switching ? t.changeNote(n(ECON.FACTION_SWITCH_DAYS)) : t.pickCost(n(ECON.FACTION_SWITCH_GEMS), n(ECON.FACTION_SWITCH_DAYS))}</p>
      <button class="btn wide gold" id="fac-ok" ${pick && pick !== S.faction ? '' : 'disabled'}>${pick ? (switching ? t.changeFaction(n(ECON.FACTION_SWITCH_GEMS)) : t.joinFaction(factionName(pick))) : t.pickTitle}</button>`;
    box.querySelectorAll('[data-fac]').forEach(b => b.onclick = () => { pick = b.dataset.fac; draw(box); });
    box.querySelector('#fac-ok').onclick = async () => {
      const r = await tryAct({ type: 'faction', id: pick });
      if (!r) return;
      haptic('heavy'); Sound.play('legend');
      closeModal(); loadWar().then(() => { if (!BT) refresh(); });
      refresh();
      if (opts.then) opts.then();
    };
  };
  // ✕ just closes it (the map banner offers the choice again); the first time, the daily reward follows.
  openModal('', draw, { lock: !switching, onBack: () => { closeModal(); if (!switching && opts.then) opts.then(); } });
}

// ---------- war screen ----------
async function renderWar() {
  const t = T();
  if (!S.faction) { $('#screen').innerHTML = `<div class="h2">${t.warTitle}</div><p class="muted">${t.warNote}</p><button class="btn wide gold" id="w-pick">${t.pickTitle}</button>`; $('#w-pick').onclick = () => factionPicker(); return; }
  drawWar();
  if (Online.state.profile) { await loadWar(); if (S.tab === 'war') drawWar(); }
}
let WAR_TAB = 'week';
const CRY_ICON = { gold: '📯', might: '💪', rally: '📣' };
const FRAME = ['', 'bronze', 'silver', 'gold', 'diamond'];
const medal = r => (r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + n(r));
const mini = id => `<img class="mini" src="${img(id)}" alt="">`;
// Frame of your community card earned by the community's all-time points.
const frameOf = id => (WAR && WAR.milestone && id === S.faction && WAR.milestone.tier ? `frame-${FRAME[WAR.milestone.tier]}` : '');

function drawWar() {
  const t = T(), f = S.faction, h = HERO_BY_ID[f], online = !!Online.state.profile, W = WAR;
  const rank = myRank();
  const tabs = online && W ? `<div class="seg">${['week', 'map', 'ranks'].map(k => `<button class="${WAR_TAB === k ? 'on' : ''}" data-wt="${k}">${t.warTabs[k]}</button>`).join('')}</div>` : '';
  const head = `<div class="panel war-head ${frameOf(f)}" style="--rc:${RARITY[h.rarity].color}">
      <img src="${img(f)}" alt="">
      <div style="flex:1;min-width:0">
        <div class="muted small">${t.yourCommunity}</div>
        <div class="big" style="font-size:22px">${t.army(h.name)}</div>
        ${W ? `<div class="tag gold">${medal(rank)} · ⭐ ${n1(W.standings[rank - 1].score)}${W.standings[rank - 1].worlds ? ` · 🏰 ${n(W.standings[rank - 1].worlds)}` : ''}</div>` : ''}
        <div class="muted small" style="margin-top:6px">${t.factionPerkShort}</div>
      </div></div>`;
  let body = '';
  if (!online || !W) body = online ? `<p class="muted center">${t.loading}</p>` : `<div class="panel center muted">${t.boardOffline}</div>`;
  else if (WAR_TAB === 'week') body = weekTab(t, W);
  else if (WAR_TAB === 'map') body = mapTab(t, W);
  else body = ranksTab(t, W);
  $('#screen').innerHTML = head + tabs + body + `<button class="btn wide ghost" id="w-change" style="margin-top:12px">${t.changeFaction(n(ECON.FACTION_SWITCH_GEMS))}</button>`;
  document.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => { WAR_TAB = b.dataset.wt; drawWar(); });
  bindWar(t);
}

function weekTab(t, W) {
  const C = ECON.COMMUNITY, left = Math.max(0, W.endsAt - Date.now()), d = Math.floor(left / 864e5), hr = Math.floor(left % 864e5 / 3600e3);
  const last = W.last, g = W.goal, dv = W.derby, ms = W.milestone;
  const cry = W.cry ? `<div class="cry-now">${CRY_ICON[W.cry]} <b>${t.cry[W.cry]}</b> · ${t.cryFx[W.cry]}</div>` : '';
  return `
    ${last && last.claimable ? `<div class="panel glow"><div class="t">${t.lastWeekTitle}</div>
      <p style="margin:6px 0">${last.place >= 0 ? t.placeOf(n(last.place + 1)) : ''} ${last.derbyWon ? `· ⚔️ ${t.derbyWon}` : ''} ${last.predictOk ? `· 🔮 ${t.predictRight}` : ''}</p>
      <button class="btn wide gem" id="w-claim">${t.warReward(n(last.reward.gems), n(last.reward.coins))}</button></div>` : ''}
    <div class="panel"><div class="row"><div class="t">${t.myPts(n(W.mine.pts))}</div><span class="muted small">⏳ ${t.endsIn(n(d), n(hr))}</span></div>
      <p class="small" style="margin:6px 0 0;color:${W.mine.double ? 'var(--green)' : 'var(--muted)'}">${W.mine.double ? '✅ ' + t.doubleOn : '💡 ' + t.doubleOff}</p>
      <button class="btn wide gold" id="w-rally" style="margin-top:12px">${t.rally}</button></div>
    <div class="panel"><div class="row"><div class="t">👑 ${t.captainTitle}</div>${W.captain ? `<span class="tag gold">${esc(W.captain.name)}</span>` : ''}</div>
      ${W.captain ? cry : `<p class="muted small" style="margin:6px 0 0">${t.noCaptain}</p>`}
      ${W.captain && W.captain.me ? `<p class="small" style="margin:8px 0 6px">${t.pickCry}</p><div class="cries">${Object.keys(C.CRIES).map(k => `<button class="btn ${W.cry === k && W.cryChosen ? 'gold' : 'ghost'}" data-cry="${k}">${CRY_ICON[k]} ${t.cry[k]}<small>${t.cryFx[k]}</small></button>`).join('')}</div>` : ''}</div>
    ${g ? `<div class="panel"><div class="row"><div class="t">🎯 ${t.goalTitle}</div><span class="muted small">${n(Math.min(g.progress, g.target))} / ${n(g.target)}</span></div>
      <div class="bar xp" style="margin:8px 0"><i style="width:${Math.min(100, g.progress / g.target * 100)}%"></i></div>
      ${g.claimed ? `<button class="btn wide ghost" disabled>✓ ${t.err.claimed}</button>`
        : g.progress >= g.target && g.helped ? `<button class="btn wide gem" id="w-goal">${t.goalClaim(n(C.GOAL.gems), n(C.GOAL.coins))}</button>`
          : `<p class="muted small" style="margin:0">${t.goalNote(n(C.GOAL.gems), n(C.GOAL.coins))}</p>`}</div>` : ''}
    ${dv ? `<div class="panel derby"><div class="t">⚔️ ${t.derbyTitle}</div>
      <div class="derby-row"><div class="dside">${mini(S.faction)}<b>${factionName(S.faction)}</b><span>⭐ ${n1(dv.me)}</span></div><div class="dvs">VS</div>
        <div class="dside">${mini(dv.rival)}<b>${factionName(dv.rival)}</b><span>⭐ ${n1(dv.them)}</span></div></div>
      <div class="dbar"><i style="width:${dv.me + dv.them ? dv.me / (dv.me + dv.them) * 100 : 50}%"></i></div>
      <p class="muted small" style="margin:8px 0">${t.derbyNote(factionName(dv.rival), n(C.DERBY_MULT), n(C.DERBY_WIN_GEMS))}</p>
      <button class="btn wide" id="w-taunt">${t.taunt}</button></div>` : ''}
    ${W.predict.open || W.predict.pick ? `<div class="panel"><div class="t">🔮 ${t.predictTitle}</div>
      ${W.predict.pick ? `<p style="margin:8px 0 0">${t.yourPick} ${mini(W.predict.pick)} <b>${factionName(W.predict.pick)}</b></p>`
        : `<p class="muted small" style="margin:6px 0">${t.predictNote(n(C.PREDICT_GEMS))}</p><div class="pick-row">${W.standings.map(x => `<button data-pred="${x.id}" title="${factionName(x.id)}">${mini(x.id)}</button>`).join('')}</div>`}</div>` : ''}
    ${ms ? `<div class="panel"><div class="row"><div class="t">🏅 ${t.milestoneTitle}</div><span class="muted small">${n(ms.total)}${ms.next ? ' / ' + n(ms.next) : ''}</span></div>
      ${ms.next ? `<div class="bar xp" style="margin:8px 0"><i style="width:${ms.total / ms.next * 100}%"></i></div>` : ''}
      <div class="frames">${ECON.COMMUNITY.MILESTONES.map((m, i) => `<div class="fr ${i < ms.tier ? 'got' : ''}"><span class="fdot frame-${FRAME[i + 1]}"></span>${t.frames[i]}<small>${n(m)}</small></div>`).join('')}</div>
      <p class="muted small" style="margin:8px 0 0">${t.milestoneNote}</p>
      <p class="small" style="margin:6px 0 0">💪 ${t.mascotPower(n(Math.round(ms.tier * ECON.MASCOT_PER_TIER * 100)), n(Math.round(ECON.MASCOT_PER_TIER * 100)))}</p></div>` : ''}
    ${last && !last.claimable && last.place >= 0 ? `<div class="panel"><div class="t">${t.lastWeekTitle}</div>
      <p style="margin:6px 0">${t.placeOf(n(last.place + 1))} · ${last.top.map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${factionName(x.id)}`).join(' ')}</p>
      ${last.claimed ? `<p class="muted small">✓ ${t.err.claimed}</p>` : `<p class="muted small">${t.needPts(n(W.min))}</p>`}</div>` : ''}`;
}

function mapTab(t, W) {
  return `<p class="muted small">${t.terrNote(pct(ECON.COMMUNITY.TERRITORY_BONUS * 100))}</p>
    <div class="terr-grid">${WORLDS.map((wd, i) => { const o = W.owners[i], c = W.terr[i] || [], open = i * STAGES_PER_WORLD <= S.cleared;
      return `<button class="terr ${o === S.faction ? 'mine' : o ? 'held' : ''}" data-tw="${i}" ${open ? '' : 'disabled'}>
        <small>${n(i + 1)}</small>${o ? `<img src="${img(o)}" alt="">` : `<span class="none">${open ? '🏳️' : '🔒'}</span>`}
        <span class="tn">${c[0] ? `${n(c[0].pts)}${c[1] ? ' · ' + n(c[1].pts) : ''}` : '—'}</span></button>`; }).join('')}</div>`;
}

// Scores with one decimal (points per active member).
const n1 = x => (Math.round(x * 10) / 10).toLocaleString(L().locale, { maximumFractionDigits: 1 });
function ranksTab(t, W) {
  const top = Math.max(1, ...W.standings.map(x => x.score)), rewardOf = p => (W.rewards[p] || W.rest), f = S.faction;
  return `<p class="muted small">${t.warNote}</p><p class="muted small">${t.warScoreNote(n(W.min), n(W.floor))}</p>
    <div class="panel board">${W.standings.map((x, i) => `<div class="wrow ${x.id === f ? 'me' : ''}">
        <span class="rk">${medal(i + 1)}</span><img src="${img(x.id)}" alt="">
        <div class="wb"><div class="wn">${factionName(x.id)} <span class="muted small">👤 ${n(x.active)}/${n(x.members)} · 🎯 ${n(x.pts)}${x.worlds ? ` · 🏰 ${n(x.worlds)}` : ''}</span></div>
          <div class="bar xp"><i style="width:${x.score / top * 100}%"></i></div></div>
        <span class="wp">⭐ ${n1(x.score)}</span></div>`).join('')}</div>
    <div class="panel"><div class="t">${t.rewardsTitle}</div><div class="tiers">
      ${[0, 1, 2].map(i => `<span>${['🥇', '🥈', '🥉'][i]} #${n(i + 1)}</span><span>💎 ${n(rewardOf(i).gems)} + 🪙 ${n(rewardOf(i).coins)}</span>`).join('')}
      <span>#${n(4)}–${n(16)}</span><span>💎 ${n(W.rest.gems)} + 🪙 ${n(W.rest.coins)}</span>
      <span>⚔️ ${t.derbyTitle}</span><span>+💎 ${n(ECON.COMMUNITY.DERBY_WIN_GEMS)}</span>
      <span>🔮 ${t.predictTitle}</span><span>+💎 ${n(ECON.COMMUNITY.PREDICT_GEMS)}</span></div>
      <p class="muted small" style="margin:8px 0 0">${t.needPts(n(W.min))}</p></div>`;
}

function bindWar(t) {
  const on = (sel, fn) => { const el = $(sel); if (el) el.onclick = fn; };
  on('#w-rally', () => shareCard('war'));
  on('#w-taunt', () => shareCard('derby'));
  on('#w-change', () => factionPicker());
  on('#w-claim', async e => {
    e.target.disabled = true;
    try { const r = await Online.war('claim'); syncProfile(r.profile); Sound.play('chest'); giftModal('🏆', t.warTitle, r.coins, '', r.gems); await loadWar(); }
    catch (err) { toast(errText(err)); e.target.disabled = false; }
  });
  on('#w-goal', async e => {
    e.target.disabled = true;
    try { const r = await Online.war('goal'); syncProfile(r.profile); WAR = r.war; Sound.play('coin'); giftModal('🎯', t.goalTitle, r.coins, '', r.gems); }
    catch (err) { toast(errText(err)); e.target.disabled = false; }
  });
  document.querySelectorAll('[data-cry]').forEach(b => b.onclick = async () => {
    try { WAR = (await Online.war('cry', { key: b.dataset.cry })).war; haptic('medium'); drawWar(); } catch (err) { toast(errText(err)); }
  });
  document.querySelectorAll('[data-pred]').forEach(b => b.onclick = () => {
    const id = b.dataset.pred;
    openModal(`<div class="center">${mini(id).replace('class="mini"', 'class="mini big"')}<div class="big" style="font-size:20px">${t.predictConfirm(factionName(id))}</div>
      <div class="btns"><button class="btn ghost" id="pd-no">${t.cancel}</button><button class="btn gold" id="pd-yes">🔮 ${t.predictTitle}</button></div></div>`, box => {
      box.querySelector('#pd-no').onclick = closeModal;
      box.querySelector('#pd-yes').onclick = async () => {
        try { WAR = (await Online.war('predict', { f: id })).war; closeModal(); drawWar(); } catch (err) { closeModal(); toast(errText(err)); }
      };
    });
  });
  document.querySelectorAll('[data-tw]').forEach(b => b.onclick = () => { S.world = +b.dataset.tw; S.sel = -1; save(); show('map'); });
}

// Small banner on the map: your community and its place this week.
function warBanner() {
  const t = T();
  if (!isOpen('war')) return '';
  if (!S.faction) return `<button class="chip gold" id="to-war">🚩 ${t.pickTitle}</button>`;
  const r = myRank();
  return `<button class="chip war-chip" id="to-war"><img src="${img(S.faction)}" alt="">⚔️ ${t.warChip}${r ? ` ${r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + n(r)}` : ''}</button>`;
}

// ---------- share cards (Telegram story with the invite link, or a plain link share) ----------
function loadImage(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function drawShareCard(kind, id) {
  const t = T(), W = 720, H = 1280, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), h = HERO_BY_ID[id], col = RARITY[h.rarity].color;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120a2e'); bg.addColorStop(0.55, '#1d2b6b'); bg.addColorStop(1, '#05040f');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const im = await loadImage(img(id));
  const cw = 480, ch = 720, x = (W - cw) / 2, y = 250;
  g.save(); g.shadowColor = col; g.shadowBlur = 60; g.fillStyle = col; g.fillRect(x - 8, y - 8, cw + 16, ch + 16); g.restore();
  if (im) { const sc = Math.max(cw / im.naturalWidth, ch / im.naturalHeight); g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip(); g.drawImage(im, x + (cw - im.naturalWidth * sc) / 2, y - (im.naturalHeight * sc - ch) * 0.15, im.naturalWidth * sc, im.naturalHeight * sc); g.restore(); }
  g.textAlign = 'center'; g.direction = L().dir || 'ltr';
  g.fillStyle = '#fff'; g.font = '900 64px Vazirmatn, sans-serif'; g.fillText('Gram Legends', W / 2, 130);
  g.fillStyle = '#3fa2ff'; g.font = '700 30px Vazirmatn, sans-serif'; g.fillText('⚔️ Telegram card battles', W / 2, 180);
  const title = kind === 'war' || kind === 'derby' ? t.army(h.name) : h.name;
  g.fillStyle = col; g.font = `900 ${title.length > 22 ? 40 : 54}px Vazirmatn, sans-serif`; g.fillText(title, W / 2, 1050, W - 40);
  g.fillStyle = '#ffc531'; g.font = '700 36px Vazirmatn, sans-serif';
  g.fillText(kind === 'war' ? t.storyJoin : kind === 'derby' && WAR && WAR.derby ? t.storyDerby(factionName(WAR.derby.rival)) : t.storyFusion, W / 2, 1120, W - 40);
  if ((kind === 'war' || kind === 'derby') && WAR) { const r = myRank(); g.fillStyle = '#eef2ff'; g.font = '700 32px Vazirmatn, sans-serif'; g.fillText(`#${r} · ⭐ ${n1(WAR.standings[r - 1].score)}`, W / 2, 1180); }
  return c.toDataURL('image/jpeg', 0.82);
}
async function shareCard(kind, id = S.faction) {
  const t = T();
  const text = kind === 'war' ? t.rallyText(factionName(id)) : kind === 'derby' && WAR && WAR.derby ? t.tauntText(factionName(id), factionName(WAR.derby.rival)) : t.fusionStory(factionName(id));
  let shared = false;
  try {
    const w = Online.tg(), link = Online.inviteLink();
    if (w && w.shareToStory && w.isVersionAtLeast && w.isVersionAtLeast('7.8') && link) {
      const up = await Online.uploadShare(await drawShareCard(kind, id));
      w.shareToStory(`${location.origin}/${up.path}`, { text: `${text} ${link}`.slice(0, 200), widget_link: { url: link, name: 'Gram Legends' } });
      shared = true;
    } else shared = Online.share(text);
  } catch (e) { shared = Online.share(text); }
  if (!shared) return toast(t.boardOffline);
  const r = await tryAct({ type: 'share' });
  if (r && r.gems) toast(t.shared(n(r.gems)));
}

// ---------- market mood ----------
const moods = () => (Online.state.market && Online.state.market.moods) || {};
const MOOD_ICON = { moon: '🚀', bull: '🟢', calm: '😴', bear: '🔴', crash: '💥' };
const fmtChange = c => `${c > 0 ? '+' : c < 0 ? '−' : ''}${pct(Math.abs(c) >= 10 ? Math.round(Math.abs(c)) : Math.round(Math.abs(c) * 10) / 10)}`;
// Ticker under the war banner: the heroes with the biggest moves today (with a token first).
function tickerHtml() {
  const m = moods(), ids = Object.keys(m);
  if (!ids.length) return '';
  ids.sort((a, b) => (m[b].src === 'token') - (m[a].src === 'token') || Math.abs(m[b].change) - Math.abs(m[a].change));
  return `<button class="ticker" id="ticker"><span class="tk-title">📈</span><div class="tk-row">${ids.slice(0, 8).map(id => {
    const md = ECON.moodOf(m[id].change);
    return `<span class="tk ${md.key}"><img src="${img(id)}" alt="">${m[id].sym || factionName(id)} <b>${MOOD_ICON[md.key]} ${fmtChange(m[id].change)}</b></span>`;
  }).join('')}</div></button>`;
}
function moodBadge(id) {
  const t = T(), m = moods(), h = HERO_BY_ID[id];
  const ids = h && h.fusion ? h.parts : [id];
  const hits = ids.map(x => ({ x, md: ECON.moodOf(m[x] && m[x].change) })).filter(o => o.md.key !== 'calm' && m[o.x]);
  if (!hits.length) return '';
  return hits.map(({ x, md }) => `<div class="mood-badge ${md.key}">${MOOD_ICON[md.key]} ${t.mood[md.key]}${ids.length > 1 ? ` (${factionName(x)})` : ''} · ${fmtChange(m[x].change)}${t.moodFx[md.key] ? ' · ' + t.moodFx[md.key] : ''}</div>`).join('');
}
async function marketModal() {
  const t = T(), m = moods(), at = Online.state.market && Online.state.market.at;
  const ids = BASE_HEROES.map(h => h.id).sort((a, b) => ((m[b] || {}).change || 0) - ((m[a] || {}).change || 0));
  openModal(`<div class="big center" style="font-size:22px">${t.marketTitle}</div>
    <p class="muted small center">${t.marketNote}</p>
    <div class="mood-legend">${ECON.MOODS.map(md => `<div class="mood-badge ${md.key}">${MOOD_ICON[md.key]} ${t.mood[md.key]}${t.moodFx[md.key] ? ' · ' + t.moodFx[md.key] : ''}</div>`).join('')}</div>
    <div class="panel board" style="margin-top:10px">${ids.map(id => { const x = m[id] || { change: 0, src: 'activity' }, md = ECON.moodOf(x.change);
      return `<div class="wrow"><img src="${img(id)}" alt=""><div class="wb"><div class="wn">${factionName(id)}${x.sym ? ` <span class="muted small">$${x.sym}</span>` : ''}</div>
        <div class="muted small">${x.src === 'token' ? t.srcToken(x.sym) : t.srcActivity}</div></div>
        <span class="wp mood-${md.key}">${MOOD_ICON[md.key]} ${fmtChange(x.change)}</span></div>`; }).join('')}</div>
    ${at ? `<p class="muted small center">${t.marketUpdated(n(Math.max(0, Math.round((Date.now() - at) / 60e3))))}</p>` : ''}
    <button class="btn wide" id="mk-ok">${t.close}</button>`, box => box.querySelector('#mk-ok').onclick = closeModal);
}
