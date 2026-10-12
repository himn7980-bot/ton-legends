// TON Legends — clan screen: create / search / join, members and weekly points, the weekly clan chest.
// Everything lives on the server; this file only shows it.
let CLAN = null, CLAN_META = { emblems: ['🛡️'], cost: 2000, max: 30 }, clanEmblem = null, clanQuery = '';

function syncProfile(p) { if (!p) return; const prev = S.coins, pg = S.gems; Object.assign(S, p); save(); showCoins(prev, pg); }

async function renderClan() {
  const t = T();
  if (!Online.state.profile) { $('#screen').innerHTML = `<div class="h2">${t.clanTitle}</div><div class="panel center muted">${t.arenaOffline}</div>`; return; }
  $('#screen').innerHTML = `<div class="h2">${t.clanTitle}</div><p class="muted center">${t.loading}</p>`;
  try {
    const r = await Online.clan('me');
    CLAN = r.clan; CLAN_META = { emblems: r.emblems, cost: r.cost, max: r.max };
  } catch (e) { if (S.tab === 'clan') $('#screen').innerHTML = `<div class="h2">${t.clanTitle}</div><div class="panel center muted">${errText(e)}</div>`; return; }
  if (S.tab !== 'clan') return;
  if (CLAN) drawMyClan(); else drawClanFinder();
}

function drawMyClan() {
  const t = T(), c = CLAN, iLead = c.leader === c.me;
  const chest = c.chest
    ? (c.chest.claimed ? `<button class="btn wide ghost" disabled>✓ ${t.err.claimed}</button>`
      : `<button class="btn wide gem" id="cl-claim">${t.claimChest(n(c.chest.gems), n(c.chest.coins))}</button>`)
    : `<p class="muted">${t.chestNone(n(c.tiers[c.tiers.length - 1].min))}</p>`;
  $('#screen').innerHTML = `
    <div class="panel clan-head"><div class="clan-emb">${c.emblem}</div><div style="flex:1;min-width:0">
      <div class="big" style="font-size:22px">${esc(c.name)}</div>
      <div class="muted">${t.members(n(c.members), n(c.max))} · ${t.weekPts(n(c.points))}</div></div></div>
    <div class="panel"><div class="row"><div class="t">${t.clanChest}</div><span class="muted">${t.lastWeek(n(c.lastPoints))}</span></div>
      ${chest}
      <div class="muted small" style="margin-top:10px">${t.chestTiers}</div>
      <div class="tiers">${c.tiers.map(x => `<span class="${c.chest && c.chest.min === x.min ? 'on' : ''}">⭐ ${n(x.min)}+</span><span class="${c.chest && c.chest.min === x.min ? 'on' : ''}">💎 ${n(x.gems)} + 🪙 ${n(x.coins)}</span>`).join('')}</div>
      <p class="muted small" style="margin:10px 0 0">${t.clanPoints}</p></div>
    <button class="btn wide gold" id="cl-invite">${t.inviteClan}</button>
    <div class="h2">${t.members(n(c.members), n(c.max))}</div>
    <div class="panel">${c.list.map(m => `<div class="crow"><span class="cn">${m.id === c.leader ? '👑 ' : ''}${esc(m.name)}${m.id === c.me ? ` <span class="muted">(${t.you})</span>` : ''}</span>
      <span class="cs">${t.stage(n(m.stage))} · ⭐ ${n(m.pts)}</span>
      ${iLead && m.id !== c.me ? `<button class="kick" data-kick="${esc(m.id)}">${t.kick}</button>` : ''}</div>`).join('')}</div>
    <button class="btn wide ghost" id="cl-leave">${t.leaveClan}</button>`;
  const claim = $('#cl-claim');
  if (claim) claim.onclick = async () => {
    claim.disabled = true;
    try { const r = await Online.clan('claim'); syncProfile(r.profile); CLAN = r.clan; Sound.play('chest'); giftModal('🎁', t.clanChest, r.coins, '', r.gems); }
    catch (e) { toast(errText(e)); claim.disabled = false; }
  };
  $('#cl-invite').onclick = () => { if (!Online.shareClan(c.id, t.clanInvite(c.name))) toast(c.id); };
  $('#cl-leave').onclick = () => openModal(`<div class="center"><div style="font-size:54px">${c.emblem}</div><p>${t.leaveSure}</p>
    <div class="btns"><button class="btn ghost" id="lv-no">${t.cancel}</button><button class="btn" id="lv-yes">${t.leaveClan}</button></div></div>`, box => {
    box.querySelector('#lv-no').onclick = closeModal;
    box.querySelector('#lv-yes').onclick = async () => { try { await Online.clan('leave'); } catch (e) { toast(errText(e)); } closeModal(); renderClan(); };
  });
  document.querySelectorAll('[data-kick]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try { CLAN = (await Online.clan('kick', { id: b.dataset.kick })).clan; drawMyClan(); } catch (e) { toast(errText(e)); }
  });
}

function drawClanFinder() {
  const t = T();
  if (!CLAN_META.emblems.includes(clanEmblem)) clanEmblem = CLAN_META.emblems[0];
  $('#screen').innerHTML = `
    <div class="h2">${t.clanTitle}</div>
    <p class="muted">${t.clanNote}</p>
    <p class="muted small">${t.clanPoints}</p>
    <div class="panel"><div class="t">${t.topClans}</div>
      <div class="code-row"><input class="clan-in" id="cl-q" maxlength="20" placeholder="${t.searchPh}" value="${esc(clanQuery)}" autocomplete="off"><button class="btn" id="cl-go">🔍</button></div>
      <div id="cl-list"><p class="muted center">${t.loading}</p></div></div>
    <div class="panel"><div class="t">${t.createTitle}</div>
      <input class="clan-in" id="cl-name" maxlength="20" placeholder="${t.clanName}" autocomplete="off" style="margin-top:10px">
      <div class="emblems">${CLAN_META.emblems.map(e => `<button data-emb="${e}" class="${e === clanEmblem ? 'on' : ''}">${e}</button>`).join('')}</div>
      <button class="btn wide gold" id="cl-create" ${S.coins < CLAN_META.cost ? 'disabled' : ''}>${t.createBtn(n(CLAN_META.cost))}</button>
      ${S.coins < CLAN_META.cost ? `<p class="muted small">${t.err.no_coins}</p>` : ''}</div>`;
  document.querySelectorAll('[data-emb]').forEach(b => b.onclick = () => {
    clanEmblem = b.dataset.emb;
    document.querySelectorAll('[data-emb]').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#cl-create').onclick = async () => {
    const btn = $('#cl-create'); btn.disabled = true;
    try { const r = await Online.clan('create', { name: $('#cl-name').value, emblem: clanEmblem }); syncProfile(r.profile); CLAN = r.clan; haptic('heavy'); drawMyClan(); }
    catch (e) { toast(errText(e)); btn.disabled = false; }
  };
  const search = () => { clanQuery = $('#cl-q').value.trim(); loadClanList(); };
  $('#cl-go').onclick = search;
  $('#cl-q').onkeydown = e => { if (e.key === 'Enter') search(); };
  loadClanList();
}

async function loadClanList() {
  const t = T();
  let r;
  try { r = await Online.clan('list', { q: clanQuery }); } catch (e) { r = null; }
  const el = $('#cl-list'); if (!el || S.tab !== 'clan') return;
  if (!r) { el.innerHTML = `<p class="muted center">${t.err.network}</p>`; return; }
  el.innerHTML = r.clans.length ? r.clans.map((c, i) => `<div class="crow"><span class="ce">${c.emblem}</span>
      <span class="cn">${i < 3 && !clanQuery ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}${esc(c.name)}<div class="cs">${t.members(n(c.members), n(CLAN_META.max))} · ${t.weekPts(n(c.points))}</div></span>
      <button class="btn" data-join="${esc(c.id)}" ${c.members >= CLAN_META.max ? 'disabled' : ''}>${t.join}</button></div>`).join('')
    : `<p class="muted center">${t.noClans}</p>`;
  el.querySelectorAll('[data-join]').forEach(b => b.onclick = () => joinClan(b.dataset.join, b));
}

async function joinClan(id, btn) {
  if (btn) btn.disabled = true;
  try { CLAN = (await Online.clan('join', { id })).clan; closeModal(); haptic('medium'); if (S.tab === 'clan') drawMyClan(); else show('clan'); }
  catch (e) { toast(errText(e)); if (btn) btn.disabled = false; }
}

// Opened from an invite link (startapp=clan_ID).
async function clanJoinPrompt(id) {
  const t = T();
  let info;
  try { info = (await Online.clan('peek', { id })).clan; } catch (e) { return toast(errText(e)); }
  openModal(`<div class="center"><div style="font-size:60px">${info.emblem}</div>
    <div class="big" style="font-size:22px">${t.joinClanQ(esc(info.name))}</div>
    <p class="muted">${t.members(n(info.members), n(CLAN_META.max))} · ${t.weekPts(n(info.points))}</p>
    <div class="btns"><button class="btn ghost" id="cj-no">${t.decline}</button><button class="btn gold" id="cj-yes">${t.join}</button></div></div>`, box => {
    box.querySelector('#cj-no').onclick = closeModal;
    box.querySelector('#cj-yes').onclick = () => joinClan(id, box.querySelector('#cj-yes'));
  });
}
