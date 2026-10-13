// TON Legends — Community War screen, community picker and story/share cards.
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
        <img src="${img(h.id)}" alt=""><span>${h.name}</span>${WAR ? `<small>${n((WAR.standings.find(x => x.id === h.id) || {}).members || 0)} 👤</small>` : ''}</button>`).join('')}</div>
      <div class="perks">${t.perks.map(x => `<div>${x}</div>`).join('')}</div>
      ${switching ? `<p class="muted small center">${t.changeNote(n(ECON.FACTION_SWITCH_DAYS))}</p>` : ''}
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
function drawWar() {
  const t = T(), f = S.faction, h = HERO_BY_ID[f], online = !!Online.state.profile;
  const W = WAR, rank = myRank(), top = W ? Math.max(1, ...W.standings.map(x => x.pts)) : 1;
  const left = W ? Math.max(0, W.endsAt - Date.now()) : 0, d = Math.floor(left / 864e5), hr = Math.floor(left % 864e5 / 3600e3);
  const last = W && W.last;
  const rewardOf = p => (W.rewards[p] || W.rest);
  $('#screen').innerHTML = `
    <div class="panel war-head" style="--rc:${RARITY[h.rarity].color}">
      <img src="${img(f)}" alt="">
      <div style="flex:1;min-width:0">
        <div class="muted small">${t.yourCommunity}</div>
        <div class="big" style="font-size:22px">${t.army(h.name)}</div>
        ${W ? `<div class="tag gold">${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : '#' + n(rank)} · ${t.weekPts(n(W.standings[rank - 1].pts))}</div>` : ''}
        <div class="muted small" style="margin-top:6px">${t.factionPerkShort}</div>
      </div></div>
    ${online && W ? `<div class="panel">
      <div class="row"><div class="t">${t.myPts(n(W.mine.pts))}</div><span class="muted small">⏳ ${t.endsIn(n(d), n(hr))}</span></div>
      <p class="small" style="margin:6px 0 0;color:${W.mine.double ? 'var(--green)' : 'var(--muted)'}">${W.mine.double ? '✅ ' + t.doubleOn : '💡 ' + t.doubleOff}</p>
      <button class="btn wide gold" id="w-rally" style="margin-top:12px">${t.rally}</button></div>` : ''}
    ${last && last.place >= 0 ? `<div class="panel"><div class="t">${t.lastWeekTitle}</div>
      <p style="margin:6px 0">${t.placeOf(n(last.place + 1))} · ${last.top.map((x, i) => `${['🥇', '🥈', '🥉'][i]} ${factionName(x.id)}`).join(' ')}</p>
      ${last.claimed ? `<button class="btn wide ghost" disabled>✓ ${t.err.claimed}</button>`
        : last.eligible ? `<button class="btn wide gem" id="w-claim">${t.warReward(n(last.reward.gems), n(last.reward.coins))}</button>`
          : `<p class="muted small">${t.needPts(n(W.min))}</p>`}</div>` : ''}
    <div class="h2">${t.warTitle}</div>
    <p class="muted small">${t.warNote}</p>
    ${online ? (W ? `<div class="panel board">${W.standings.map((x, i) => `<div class="wrow ${x.id === f ? 'me' : ''}">
        <span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : n(i + 1)}</span><img src="${img(x.id)}" alt="">
        <div class="wb"><div class="wn">${factionName(x.id)} <span class="muted small">👤 ${n(x.members)}</span></div>
          <div class="bar xp"><i style="width:${x.pts / top * 100}%"></i></div></div>
        <span class="wp">${n(x.pts)}</span></div>`).join('')}</div>` : `<p class="muted center">${t.loading}</p>`)
      : `<div class="panel center muted">${t.boardOffline}</div>`}
    ${W ? `<div class="panel"><div class="t">${t.rewardsTitle}</div><div class="tiers">
      ${[0, 1, 2].map(i => `<span>${['🥇', '🥈', '🥉'][i]} #${n(i + 1)}</span><span>💎 ${n(rewardOf(i).gems)} + 🪙 ${n(rewardOf(i).coins)}</span>`).join('')}
      <span>#${n(4)}–${n(16)}</span><span>💎 ${n(W.rest.gems)} + 🪙 ${n(W.rest.coins)}</span></div>
      <p class="muted small" style="margin:8px 0 0">${t.needPts(n(W.min))}</p></div>` : ''}
    <button class="btn wide ghost" id="w-change">${t.changeFaction(n(ECON.FACTION_SWITCH_GEMS))}</button>`;
  const rally = $('#w-rally'); if (rally) rally.onclick = () => shareCard('war');
  const claim = $('#w-claim');
  if (claim) claim.onclick = async () => {
    claim.disabled = true;
    try { const r = await Online.war('claim'); syncProfile(r.profile); Sound.play('chest'); giftModal('🏆', t.warTitle, r.coins, '', r.gems); await loadWar(); }
    catch (e) { toast(errText(e)); claim.disabled = false; }
  };
  $('#w-change').onclick = () => factionPicker();
}

// Small banner on the map: your community and its place this week.
function warBanner() {
  const t = T();
  if (!S.faction) return `<button class="war-banner" id="to-war">🚩 ${t.pickTitle} →</button>`;
  const r = myRank();
  return `<button class="war-banner" id="to-war"><img src="${img(S.faction)}" alt=""><span>${t.army(factionName(S.faction))}${r ? ` · ${r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + n(r)}` : ''}</span><b>${t.warOpen}</b></button>`;
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
  g.fillStyle = '#fff'; g.font = '900 64px Vazirmatn, sans-serif'; g.fillText('TON Legends', W / 2, 130);
  g.fillStyle = '#3fa2ff'; g.font = '700 30px Vazirmatn, sans-serif'; g.fillText('⚔️ Telegram card battles', W / 2, 180);
  const title = kind === 'war' ? t.army(h.name) : h.name;
  g.fillStyle = col; g.font = `900 ${title.length > 22 ? 40 : 54}px Vazirmatn, sans-serif`; g.fillText(title, W / 2, 1050, W - 40);
  g.fillStyle = '#ffc531'; g.font = '700 36px Vazirmatn, sans-serif';
  g.fillText(kind === 'war' ? t.storyJoin : t.storyFusion, W / 2, 1120, W - 40);
  if (kind === 'war' && WAR) { const r = myRank(); g.fillStyle = '#eef2ff'; g.font = '700 32px Vazirmatn, sans-serif'; g.fillText(`#${r} · ${t.weekPts(n(WAR.standings[r - 1].pts))}`, W / 2, 1180); }
  return c.toDataURL('image/jpeg', 0.82);
}
async function shareCard(kind, id = S.faction) {
  const t = T();
  const text = kind === 'war' ? t.rallyText(factionName(id)) : t.fusionStory(factionName(id));
  let shared = false;
  try {
    const w = Online.tg(), link = Online.inviteLink();
    if (w && w.shareToStory && w.isVersionAtLeast && w.isVersionAtLeast('7.8') && link) {
      const up = await Online.uploadShare(await drawShareCard(kind, id));
      w.shareToStory(`${location.origin}/${up.path}`, { text: `${text} ${link}`.slice(0, 200), widget_link: { url: link, name: 'TON Legends' } });
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
  return hits.map(({ x, md }) => `<div class="mood-badge ${md.key}">${MOOD_ICON[md.key]} ${t.mood[md.key]}${ids.length > 1 ? ` (${factionName(x)})` : ''} · ${fmtChange(m[x].change)} · ${t.moodFx[md.key]}</div>`).join('');
}
async function marketModal() {
  const t = T(), m = moods(), at = Online.state.market && Online.state.market.at;
  const ids = BASE_HEROES.map(h => h.id).sort((a, b) => ((m[b] || {}).change || 0) - ((m[a] || {}).change || 0));
  openModal(`<div class="big center" style="font-size:22px">${t.marketTitle}</div>
    <p class="muted small center">${t.marketNote}</p>
    <div class="mood-legend">${ECON.MOODS.map(md => `<div class="mood-badge ${md.key}">${MOOD_ICON[md.key]} ${t.mood[md.key]} · ${t.moodFx[md.key]}</div>`).join('')}</div>
    <div class="panel board" style="margin-top:10px">${ids.map(id => { const x = m[id] || { change: 0, src: 'activity' }, md = ECON.moodOf(x.change);
      return `<div class="wrow"><img src="${img(id)}" alt=""><div class="wb"><div class="wn">${factionName(id)}${x.sym ? ` <span class="muted small">$${x.sym}</span>` : ''}</div>
        <div class="muted small">${x.src === 'token' ? t.srcToken(x.sym) : t.srcActivity}</div></div>
        <span class="wp mood-${md.key}">${MOOD_ICON[md.key]} ${fmtChange(x.change)}</span></div>`; }).join('')}</div>
    ${at ? `<p class="muted small center">${t.marketUpdated(n(Math.max(0, Math.round((Date.now() - at) / 60e3))))}</p>` : ''}
    <button class="btn wide" id="mk-ok">${t.close}</button>`, box => box.querySelector('#mk-ok').onclick = closeModal);
}
