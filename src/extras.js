// Gram Legends — friends (tiered invites), world boss, arena league, partner quests, card frames, featured hero,
// TON wallet + NFT requests. All of these need the server (Telegram); offline they show a short note.
async function apiCall(path, body) {
  const prev = S.coins, prevGems = S.gems;
  const r = await Online.api(path, body);
  if (r && r.profile) { Object.assign(S, r.profile); save(); showCoins(prev, prevGems); }
  return r;
}
const tryApi = async (path, body) => { try { return await apiCall(path, body); } catch (e) { toast(errText(e)); return null; } };
const onlineOnly = title => `<div class="h2">${title}</div><div class="panel center muted">${T().arenaOffline}</div>`;

// ---------- profile: own game name + avatar (any card you own) ----------
let MY_NAME = null;
const avatarImg = (id, frame) => (id && HERO_BY_ID[id] ? `<img class="mini-av ${frame ? 'skin-' + frame : ''}" src="${img(id)}" alt="">` : '');
async function profileModal() {
  const t = T();
  let me = { name: MY_NAME, nameCost: 0 };
  if (Online.state.profile) { try { me = await Online.api('me'); MY_NAME = me.name; } catch (e) {} }
  const cur = ECON.avatarOf(S), cards = HEROES.filter(h => S.owned[h.id]).sort((a, b) => !!b.fusion - !!a.fusion || S.owned[b.id] - S.owned[a.id]);
  openModal(`<div class="h2">👤 ${t.profileTitle}</div>
    ${Online.state.profile ? `<div class="t">${t.nameTitle}</div>
      <div class="code-row"><input id="pf-name" maxlength="16" value="${esc(me.name || '')}" autocomplete="off"><button class="btn" id="pf-save">${me.nameCost ? `💎 ${n(me.nameCost)}` : t.saveName}</button></div>
      <p class="muted small">${t.nameRules}</p>` : ''}
    <div class="t" style="margin-top:10px">${t.avatarTitle}</div><p class="muted small">${t.avatarNote}</p>
    <div class="av-grid">${cards.map(h => `<button class="av-pick ${h.id === cur ? 'on' : ''}" data-av="${h.id}"><img src="${img(h.id)}" alt="">${h.fusion ? '<span>🤝</span>' : ''}</button>`).join('')}</div>`, box => {
    const sv = box.querySelector('#pf-save');
    if (sv) sv.onclick = async () => {
      sv.disabled = true;
      const r = await tryApi('me/name', { name: box.querySelector('#pf-name').value });
      sv.disabled = false;
      if (r) { MY_NAME = r.name; toast('✓ ' + r.name); closeModal(); refresh(); }
    };
    box.querySelectorAll('[data-av]').forEach(b => b.onclick = async () => { if (await tryAct({ type: 'avatar', id: b.dataset.av })) { haptic('light'); closeModal(); refresh(); } });
  });
}

// ---------- the game's channel: join first (welcome reward) ----------
function channelGate() {
  const t = T(), C = Online.state.channel;
  return new Promise(done => openModal(`<div class="center"><div style="font-size:54px">📢</div>
    <div class="big" style="font-size:22px">${t.chanTitle}</div><p class="muted">${t.chanNote}</p>
    <p><span class="tag gold">🪙 ${n(C.coins)}</span> <span class="tag gem">💎 ${n(C.gems)}</span></p>
    <button class="btn wide gold" id="ch-join">📢 ${t.chanJoin}</button>
    <button class="btn wide" id="ch-check" style="margin-top:8px">✅ ${t.chanCheck}</button></div>`, box => {
    box.querySelector('#ch-join').onclick = () => { const w = Online.tg(); if (w && w.openTelegramLink) w.openTelegramLink(C.url); else window.open(C.url, '_blank'); };
    box.querySelector('#ch-check').onclick = async e => {
      e.currentTarget.disabled = true;
      try {
        const r = await apiCall('channel/check');
        if (r.joined) {
          C.joined = true; closeModal(); haptic('heavy'); Sound.play('chest');
          if (r.coins) giftModal('📢', t.chanThanks, r.coins, '', r.gems);
          // New players: the game intro comes right after the welcome reward.
          if (!S.seenHelp) { const iv = setInterval(() => { if ($('#modal').hidden) { clearInterval(iv); help(); } }, 400); }
          done();
        } else toast(t.chanNotYet);
      } catch (err) { toast(errText(err)); }
      const b = box.querySelector('#ch-check'); if (b) b.disabled = false;
    };
  }, { lock: true, onBack: () => {} }));
}

// ---------- Community Fund: purchases recorded per community for token buybacks (after agreements) ----------
async function renderFund() {
  const t = T();
  if (!Online.state.profile) { $('#screen').innerHTML = onlineOnly(t.fundTitle); return; }
  $('#screen').innerHTML = `<div class="h2">🤝 ${t.fundTitle}</div><p class="muted center">${t.loading}</p>`;
  let r; try { r = await Online.api('fund'); } catch (e) { toast(errText(e)); return; }
  if (S.tab !== 'fund') return;
  const F = r.fund, max = Math.max(1, ...F.coms.map(c => c.stars));
  $('#screen').innerHTML = `<div class="h2">🤝 ${t.fundTitle}</div>
    <div class="panel fund-hero"><p style="margin:0 0 8px">${t.fundNote(n(F.pct))}</p>
      <div class="ref-nums"><div><b>⭐ ${n(F.total)}</b><small>${t.fundTotal}</small></div><div><b>⭐ ${n(F.totalShare)}</b><small>${t.fundShare(n(F.pct))}</small></div><div><b>${n(F.coms.filter(c => c.agreed).length)}/${n(F.coms.length)}</b><small>${t.fundAgreedN}</small></div></div></div>
    <div class="h2">${t.fundComs}</div>
    <div class="panel">${F.coms.map(c => `<div class="fund-row ${c.id === S.faction ? 'me' : ''}">
      <img class="mini-av" src="${img(c.id)}" alt=""><div class="fr-main"><div class="row"><b>${factionName(c.id)}${c.id === S.faction ? ` <span class="muted small">(${t.you})</span>` : ''}</b><span class="tag ${c.agreed ? 'gold' : ''}">${c.agreed ? '🤝 ' + t.fundAgreed : '⏳ ' + t.fundPending}</span></div>
      <div class="fund-bar"><i style="width:${c.stars / max * 100}%"></i></div><div class="muted small">⭐ ${n(c.stars)} ${t.fundTotal}${c.agreed ? ` · ${t.fundShare(n(F.pct))}: ⭐ ${n(c.share)}` : ''}${c.buybacks ? ' · ✅ ' + n(c.buybacks) : ''}</div></div></div>`).join('')}
      ${F.none ? `<div class="muted small" style="padding-top:8px">${t.fundNone}: ⭐ ${n(F.none)}</div>` : ''}</div>
    ${F.buybacks.length ? `<div class="h2">✅ ${t.fundHistory}</div><div class="panel">${F.buybacks.map(b => `<div class="row lb-row"><span>${factionName(b.f)} · ${n(b.amount)} ${esc(b.asset)}</span><a href="${esc(b.link)}" target="_blank" rel="noopener">${t.fundProof} ↗</a></div>`).join('')}</div>` : ''}
    ${F.wallet ? `<p class="muted small">${t.fundWallet}: <code>${esc(F.wallet)}</code></p>` : ''}
    <p class="muted small">${t.fundDisclaimer}</p>`;
}

// ---------- friends (invites) ----------
async function renderFriends() {
  const t = T();
  if (!Online.state.profile) { $('#screen').innerHTML = onlineOnly(t.friendsTitle); return; }
  $('#screen').innerHTML = `<div class="h2">${t.friendsTitle}</div><p class="muted center">${t.loading}</p>`;
  const r = await tryApi('ref/me'); if (!r || S.tab !== 'friends') return;
  const R = r.ref;
  $('#screen').innerHTML = `<div class="h2">${t.friendsTitle}</div>
    <div class="panel ref-hero"><div class="ref-nums"><div><b>${n(R.invited)}</b><small>${t.refInvited}</small></div><div><b>${n(R.active)}</b><small>${t.refActive}</small></div><div><b>🪙 ${n(R.bank)}</b><small>${t.refBank}</small></div></div>
      <p class="muted small">${t.refRules(n(R.rules.inviter), n(R.rules.newcomer), n(Math.round(R.rules.share * 100)), n(R.rules.cap))}</p>
      <button class="btn wide gold" id="rf-share">${t.sendInvite}</button>
      ${R.link ? `<button class="btn wide ghost" id="rf-copy" style="margin-top:8px">📋 ${t.copyLink}</button>` : ''}
      ${R.bank ? `<button class="btn wide" id="rf-bank" style="margin-top:8px">${t.refClaimBank(n(R.bank))}</button>` : ''}</div>
    <div class="h2">${t.refTiersTitle}</div>
    <div class="ref-tiers">${R.tiers.map(x => `<div class="ref-tier ${x.claimed ? 'claimed' : x.done ? 'ready' : ''}">
      <div><b>${t.refTierN(n(x.n))}</b><small>💎 ${n(x.gems)}${x.frame ? ` + ${ECON.COSMETICS[x.frame].ico} ${t.frameName[x.frame]}` : ''}</small></div>
      ${x.claimed ? '<span class="tag">✓</span>' : `<button class="btn ${x.done ? 'gold' : 'ghost'}" data-tier="${x.n}" ${x.done ? '' : 'disabled'}>${x.done ? t.claimNow : `${n(Math.min(R.active, x.n))}/${n(x.n)}`}</button>`}</div>`).join('')}</div>
    <div class="h2">${t.refFriends} <span class="muted">(${n(R.invited)})</span></div>
    ${R.friends.length ? `<div class="panel">${R.friends.map(f => `<div class="row lb-row"><span>${f.active ? '✅' : '⏳'} ${esc(f.name)}</span><span class="muted">${t.stage(n(f.stage))}</span></div>`).join('')}</div>`
      : `<p class="muted center">${t.refNone}</p>`}`;
  $('#rf-share').onclick = () => Online.share(t.inviteText);
  if ($('#rf-copy')) $('#rf-copy').onclick = () => { try { navigator.clipboard.writeText(R.link); toast('✓ ' + t.copied); } catch (e) { toast(R.link); } };
  if ($('#rf-bank')) $('#rf-bank').onclick = async () => { if (await tryApi('ref/claim', { bank: true })) { Sound.play('coin'); renderFriends(); } };
  document.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
    const x = await tryApi('ref/claim', { tier: +b.dataset.tier });
    if (x) { Sound.play('legend'); toast(`+💎 ${n(x.gems)}${x.frame ? ' · ' + ECON.COSMETICS[x.frame].ico + ' ' + t.frameName[x.frame] : ''}`); renderFriends(); }
  });
}

// ---------- world boss ----------
let RAID = null;
async function renderRaid() {
  const t = T();
  if (!Online.state.profile) { $('#screen').innerHTML = onlineOnly(t.raidTitle); return; }
  if (!isOpen('raid')) { $('#screen').innerHTML = `<div class="h2">${t.raidTitle}</div><div class="panel center"><div style="font-size:54px">👹</div>${lockNote('raid')}</div>`; return; }
  if (!RAID) $('#screen').innerHTML = `<div class="h2">${t.raidTitle}</div><p class="muted center">${t.loading}</p>`;
  const r = await tryApi('raid/me'); if (!r || S.tab !== 'raid') return;
  RAID = r.raid;
  const R = RAID, h = HERO_BY_ID[R.boss], pctLeft = R.hp / R.max * 100;
  $('#screen').innerHTML = `<div class="h2">${t.raidTitle}</div>
    <div class="raid-hero">
      <img src="${img(R.boss)}" alt=""><div class="rh-info"><div class="tag">${t.raidLevel(n(R.level))}</div><div class="big latin">${h.name}</div>
</div>
      <div class="raid-hp"><i style="width:${pctLeft}%"></i><span>❤️ ${n(R.hp)} / ${n(R.max)}</span></div>
    </div>
    ${weakHint(R.weak)}
    <p class="muted small">${t.raidNote(n(R.time))}</p>
    ${deckSwitcher()}
    <button class="btn wide gold" id="rd-go" ${S.team.length ? '' : 'disabled'}>${R.tries > 0 ? t.raidFight(n(R.tries)) : t.raidBuy(n(R.extraGems))}</button>
    <div class="panel"><div class="ref-nums"><div><b>${n(R.mine.boss)}</b><small>${t.raidMineBoss}</small></div><div><b>${n(R.mine.week)}</b><small>${t.raidMineWeek}</small></div><div><b>${R.mine.rank ? '#' + n(R.mine.rank) : '—'}</b><small>${t.raidRank}</small></div></div>
      <p class="muted small" style="margin:8px 0 0">${t.raidRewards(n(R.rewards.kill), n(R.rewards.top), n(R.rewards.last))}</p></div>
    ${R.coms.length ? `<div class="h2">${t.raidComs}</div><div class="panel">${R.coms.slice(0, 8).map((c, i) => `<div class="row lb-row"><span>${i + 1}. <img class="mini-av" src="${img(c.id)}" alt=""> ${factionName(c.id)}</span><b>${n(c.dmg)}</b></div>`).join('')}</div>` : ''}
    ${R.top.length ? `<div class="h2">${t.raidTop}</div><div class="panel">${R.top.map((p, i) => `<div class="row lb-row ${p.me ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${avatarImg(p.av)}${esc(p.name)}</span><b>${n(p.dmg)}</b></div>`).join('')}</div>` : ''}
    ${R.kills.length ? `<div class="h2">${t.raidKills}</div><div class="panel">${R.kills.map(k => `<div class="row lb-row"><span>💀 ${HERO_BY_ID[k.boss].name} · ${t.raidLevel(n(k.level))}</span><span class="muted">⚔️ ${esc(k.name)} · 👥 ${n(k.players)}</span></div>`).join('')}</div>` : ''}`;
  $('#rd-go').onclick = e => { e.currentTarget.disabled = true; startRaid(R.tries <= 0).finally(() => { const b = $('#rd-go'); if (b) b.disabled = false; }); };
}
let RAID_STARTING = false;
async function startRaid(buy) {
  if (BT || RAID_STARTING) return;
  RAID_STARTING = true;
  try { await startRaidNow(buy); } finally { RAID_STARTING = false; }
}
async function startRaidNow(buy) {
  const t = T(), r = await tryApi('raid/start', { buy: !!buy });
  if (!r) return;
  const B = createRaid(S.team, S.owned, r.seed, r.raid, S.faction || null, r.market || null, r.perks || null);
  BT = { mode: 'raid', B, mySide: 'hero', inputs: [], queue: S.auto ? [-1] : [], acc: 0, last: performance.now(), raf: 0, ended: false, raid: r.raid };
  buildBattle({ title: `👹 ${t.raidTitle} · ${t.raidLevel(n(r.raid.level))}`, bg: 'radial-gradient(circle at 50% 30%,#5a0d1e 0,#1a0612 55%,#05020a 100%)', scene: { key: 'temple', ch: 3 },
    mine: B.heroes, theirs: B.enemies, showSpeed: true,
    onTap: u => BT.queue.push(u.uid), onAuto: on => BT.queue.push(on ? -1 : -2), onUlt: () => BT.queue.push(-3) });
  const hud = document.createElement('div'); hud.className = 'raid-hud';
  hud.innerHTML = `<div>⏱ <b id="rh-t">${n(RAID_TIME)}</b></div><div>💥 <b id="rh-d">0</b></div>`;
  $('#battle').insertBefore(hud, $('#battle .b-enemies'));
  Sound.music('battle');
  BT.raf = requestAnimationFrame(raidLoop);
}
function raidLoop(now) {
  if (!BT || BT.mode !== 'raid') return;
  const { B } = BT;
  if (BT.paused) { BT.last = now; BT.raf = requestAnimationFrame(raidLoop); return; }
  BT.acc += Math.min(0.25, (now - BT.last) / 1000) * S.speed; BT.last = now;
  while (BT.acc >= TICK && !B.over) {
    for (const code of BT.queue.splice(0)) { BT.inputs.push([B.tick, code]); applyInput(B, code); }
    step(B); BT.acc -= TICK;
  }
  flush();
  // The boss's bar shows the shared HP left (minus what this fight has done so far).
  const boss = B.enemies[0], e = BT.els.get(boss.uid), left = Math.max(0, BT.raid.hp - B.raid.dmg) / BT.raid.max * 100;
  if (e) e.hp.style.width = left + '%';
  const td = $('#rh-t'), dd = $('#rh-d');
  if (td) td.textContent = n(Math.max(0, RAID_TIME - B.t)); if (dd) dd.textContent = n(B.raid.dmg);
  if (B.over && !BT.ended) { BT.ended = true; syncNav(); setTimeout(finishRaid, 700); }
  BT.raf = requestAnimationFrame(raidLoop);
}
async function finishRaid() {
  if (!BT || BT.mode !== 'raid') return;
  const t = T(), inputs = BT.inputs;
  let r = null; try { r = await apiCall('raid/end', { inputs }); } catch (e) { toast(errText(e)); }
  cancelAnimationFrame(BT.raf); BT = null; $('#battle').hidden = true; Sound.music('menu');
  if (r) { RAID = r.raid; Sound.play(r.killed ? 'legend' : 'coin'); }
  show('raid');
  if (r) openModal(`<div class="center"><div style="font-size:54px">${r.killed ? '💀' : '💥'}</div>
    <div class="big" style="font-size:24px">${r.killed ? t.raidKilled(HERO_BY_ID[r.killed.boss].name) : t.raidDone}</div>
    <p style="font-size:20px;margin:10px 0">💥 <b>${n(r.dmg)}</b></p><p class="muted">🪙 +${n(r.coins)}${r.killed ? ' · ' + t.raidKillNote : ''}</p>
    <button class="btn wide" id="rd-ok">${t.ok}</button></div>`, box => { box.querySelector('#rd-ok').onclick = closeModal; });
}

// ---------- arena league (panel inside the Arena screen) ----------
const LEAGUE_ICO = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', legend: '🏆' };
async function leaguePanel(el) {
  if (!el || !Online.state.profile) return;
  const t = T();
  let r; try { r = await Online.api('league/me'); } catch (e) { return; }
  const L = r.league; if (!el.isConnected) return;
  el.innerHTML = `<div class="panel league-panel" id="lg-open"><div class="row"><div class="t">${LEAGUE_ICO[L.tier]} ${t.leagueTier[L.tier]} · ${n(L.r)}</div><span class="tag">${t.leagueSeason(n(L.season + 1))}</span></div>
    ${L.next ? `<div class="bar xp" style="margin:8px 0"><i style="width:${Math.max(4, Math.min(100, (L.r - (L.tiers.find(x => x.id === L.tier).min)) / (L.next.at - L.tiers.find(x => x.id === L.tier).min) * 100))}%"></i></div><div class="muted small">${t.leagueNext(LEAGUE_ICO[L.next.id] + ' ' + t.leagueTier[L.next.id], n(L.next.at))}</div>` : ''}
    ${L.prev ? `<button class="btn wide gold" id="lg-claim" style="margin-top:8px">${t.leagueClaim(LEAGUE_ICO[L.prev.best] + ' ' + t.leagueTier[L.prev.best], n(L.prev.gems))}</button>` : `<div class="muted small" style="margin-top:6px">${t.leagueNote}</div>`}</div>`;
  if ($('#lg-claim')) $('#lg-claim').onclick = async e => { e.stopPropagation(); const x = await tryApi('league/claim'); if (x) { Sound.play('legend'); toast(`+💎 ${n(x.gems)}`); leaguePanel(el); } };
  $('#lg-open').onclick = () => openModal(`<div class="h2">${LEAGUE_ICO[L.tier]} ${t.leagueTitle}</div>
    <div class="ref-nums"><div><b>${n(L.r)}</b><small>${t.leagueRating}</small></div><div><b>${L.rank ? '#' + n(L.rank) : '—'}</b><small>${t.raidRank}</small></div><div><b>${n(L.w)}/${n(L.l)}</b><small>${t.leagueWL}</small></div></div>
    <div class="ref-tiers" style="margin-top:10px">${L.tiers.map(x => `<div class="ref-tier ${x.id === L.tier ? 'ready' : ''}"><div><b>${LEAGUE_ICO[x.id]} ${t.leagueTier[x.id]}</b><small>${n(x.min)}+ · 💎 ${n(x.gems)}${x.frame ? ' + ' + ECON.COSMETICS[x.frame].ico : ''}</small></div></div>`).join('')}</div>
    <p class="muted small">${t.leagueRules}</p>
    ${L.top.length ? `<div class="h2" style="font-size:16px">${t.leagueTop}</div>${L.top.map((p, i) => `<div class="row lb-row ${p.me ? 'me' : ''}"><span>${i + 1}. ${LEAGUE_ICO[p.tier]} ${avatarImg(p.av)}${esc(p.name)}</span><b>${n(p.r)}</b></div>`).join('')}` : ''}`);
}

// ---------- partner quests (section inside Quests) ----------
async function partnerQuests(el) {
  if (!el || !Online.state.profile) return;
  const t = T();
  let r; try { r = await Online.api('partners/list'); } catch (e) { return; }
  if (!el.isConnected || !r.quests.length) return;
  el.innerHTML = `<div class="h2">🤝 ${t.partnersTitle}</div>${r.quests.map(q => `<div class="panel pq ${q.done ? 'done' : ''}">
    <div class="row"><div><div class="t">${esc(q.title)}</div><div class="muted small">💎 ${n(q.gems)}${q.coins ? ` · 🪙 ${n(q.coins)}` : ''}</div></div>
    ${q.done ? '<span class="tag">✓</span>' : `<div class="pq-btns"><button class="btn ghost" data-pq-open="${q.id}">${t.pqOpen}</button><button class="btn gold" data-pq-claim="${q.id}">${t.claimNow}</button></div>`}</div></div>`).join('')}`;
  el.querySelectorAll('[data-pq-open]').forEach(b => b.onclick = () => {
    const q = r.quests.find(x => x.id === +b.dataset.pqOpen);
    Online.api('partners/open', { id: q.id }).catch(() => {});
    const w = Online.tg();
    if (w && /^https:\/\/t\.me\//.test(q.url) && w.openTelegramLink) w.openTelegramLink(q.url); else if (w && w.openLink) w.openLink(q.url); else window.open(q.url, '_blank');
  });
  el.querySelectorAll('[data-pq-claim]').forEach(b => b.onclick = async () => {
    const x = await tryApi('partners/claim', { id: +b.dataset.pqClaim });
    if (x) { Sound.play('coin'); toast(`+💎 ${n(x.gems)}`); partnerQuests(el); }
  });
}

// ---------- featured hero + card frames (inside Chests) ----------
function featuredHtml() {
  const t = T(), id = ECON.featuredOf(Date.now()), h = HERO_BY_ID[id];
  return `<div class="panel featured" style="--rc:${RARITY[h.rarity].color}"><img src="${img(id)}" alt=""><div><div class="tag gold">⭐ ${t.featuredTitle}</div>
    <div class="big latin">${h.name}</div><div class="muted small">${t.featuredNote(n(Math.round(ECON.FEATURED_CHANCE.basic * 100)), n(Math.round(ECON.FEATURED_CHANCE.gem * 100)))}</div></div></div>`;
}
function framesHtml() {
  const t = T(), cos = S.cos || { own: [], on: null };
  return `<div class="h2">🖼 ${t.framesTitle}</div><p class="muted small">${t.framesNote}</p>
    <div class="frames-shop">${Object.entries(ECON.COSMETICS).map(([id, c]) => {
      const own = cos.own.includes(id), on = cos.on === id;
      const price = own ? (on ? `✓ ${t.frameOn}` : t.frameUse) : c.gems ? `💎 ${n(c.gems)}` : c.stars ? `⭐ ${n(c.stars)}` : c.earn === 'ref' ? t.frameEarnRef : t.frameEarnLeague;
      return `<button class="frame-item skin-${id} ${on ? 'on' : ''}" data-frame="${id}" ${!own && c.earn ? 'disabled' : ''}><div class="fi-card"><img src="${img(S.team[0] || 'volya')}" alt=""></div>
        <b>${c.ico} ${t.frameName[id]}</b><small>${price}</small></button>`; }).join('')}</div>
    ${cos.on ? `<button class="btn ghost wide" id="fr-off" style="margin-top:8px">${t.frameOff}</button>` : ''}`;
}
function bindFrames() {
  document.querySelectorAll('[data-frame]').forEach(b => b.onclick = async () => {
    const id = b.dataset.frame, c = ECON.COSMETICS[id], own = (S.cos || { own: [] }).own.includes(id);
    if (!own && c.stars) {
      if (!Online.state.profile) return toast(T().arenaOffline);
      if (b.disabled) return; b.disabled = true;
      try {
        const { link } = await Online.api('invoice', { pack: 'cos_' + id });
        const st = await new Promise(res => Online.tg().openInvoice(link, res));
        // The server unlocks the frame when Telegram confirms the payment: reload until it shows up.
        for (let i = 0; st === 'paid' && i < 8 && !(S.cos && S.cos.own.includes(id)); i++) { await new Promise(r => setTimeout(r, 1000)); await syncServerProfile(); }
        if (S.cos && S.cos.own.includes(id)) toast('✅ ' + T().frameName[id]);
      } catch (e) { toast(errText(e)); }
      b.disabled = false; refresh();
      return;
    }
    if (await tryAct({ type: 'cosmetic', id })) { haptic('light'); refresh(); }
  });
  if ($('#fr-off')) $('#fr-off').onclick = async () => { if (await tryAct({ type: 'cosmetic', id: null })) refresh(); };
}
async function syncServerProfile() { try { const r = await Online.loadProfile(null); Object.assign(S, r); save(); showCoins(); } catch (e) {} }
const skinClass = () => (S.cos && S.cos.on ? 'skin-' + S.cos.on : '');

// ---------- TON wallet + NFT requests ----------
let TC_UI = null;
function loadTonConnect() {
  if (window.TON_CONNECT_UI) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/@tonconnect/ui@2.0.9/dist/tonconnect-ui.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function walletModal() {
  const t = T();
  if (!Online.state.profile) return toast(t.arenaOffline);
  let r; try { r = await Online.api('wallet', {}); } catch (e) { return toast(errText(e)); }
  const short = a => (a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a);
  openModal(`<div class="h2">💠 ${t.walletTitle}</div><p class="muted small">${t.walletNote}</p>
    ${r.wallet ? `<div class="panel row"><span>✅ <code>${esc(short(r.wallet))}</code></span><button class="tag" id="w-off">${t.walletOff}</button></div>` : `<button class="btn wide gem" id="w-on">${t.walletConnect}</button>`}
    ${r.nft.length ? `<div class="h2" style="font-size:16px">🖼 ${t.nftTitle}</div>${r.nft.map(x => `<div class="row lb-row"><span>${HERO_BY_ID[x.id].name} #${n(x.serial)}</span><span class="tag">${t.nftStatus[x.status]}</span></div>`).join('')}` : ''}
    <p class="muted small">${t.nftNote}</p>`, box => {
    const on = box.querySelector('#w-on'), off = box.querySelector('#w-off');
    if (off) off.onclick = async () => { try { await Online.api('wallet', { address: null }); } catch (e) { return toast(errText(e)); } if (TC_UI) TC_UI.disconnect().catch(() => {}); walletModal(); };
    if (on) on.onclick = async () => {
      try {
        await loadTonConnect();
        if (!TC_UI) {
          TC_UI = new TON_CONNECT_UI.TonConnectUI({ manifestUrl: (TL_CONFIG.api || location.origin) + '/tonconnect-manifest.json' });
          TC_UI.onStatusChange(async w => { if (w && w.account) { try { await Online.api('wallet', { address: w.account.address }); toast('✅ ' + t.walletLinked); walletModal(); } catch (e) { toast(errText(e)); } } });
        }
        await TC_UI.openModal();
      } catch (e) { toast(t.err.network); }
    };
  });
}
async function requestNft(id) {
  const t = T();
  try { await Online.api('nft/request', { id }); toast('✅ ' + t.nftRequested); closeModal(); }
  catch (e) { if (e.message === 'no_wallet') walletModal(); else toast(errText(e)); }
}

// ---------- rewarded ads (Adsgram) ----------
// The ad network calls the server when an ad was watched to the end; the server pays (ECON.ADS) and the game reloads.
let ADS_SDK = null;
const loadAds = () => ADS_SDK || (ADS_SDK = new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = 'https://sad.adsgram.ai/js/sad.min.js';
  s.onload = () => (window.Adsgram ? res(window.Adsgram) : rej(new Error('ads'))); s.onerror = () => { ADS_SDK = null; rej(new Error('ads')); };
  document.head.appendChild(s);
}));
function adsHtml() {
  const A = Online.state.ads;
  if (!A || !Online.state.profile || !Online.tg()) return '';
  const left = ECON.adsLeft(S, Date.now());
  return `<div class="panel"><div class="row"><div class="t">📺 ${T().adsTitle}</div><span class="muted small">${n(left)}/${n(A.daily)}</span></div>
    <button class="btn wide" id="ad-watch" ${left ? '' : 'disabled'}>${left ? T().adsBtn(n(ECON.afkRate(S) * A.hours)) : T().comeBack}</button></div>`;
}
function bindAds() {
  const b = $('#ad-watch'); if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    const before = S.coins;
    try {
      const Ads = await loadAds();
      await Ads.init({ blockId: String(Online.state.ads.block) }).show();
      for (let i = 0; i < 6 && S.coins === before; i++) { await new Promise(r => setTimeout(r, 1000)); await syncServerProfile(); }
      if (S.coins > before) { Sound.play('coin'); toast(`📺 +🪙 ${n(S.coins - before)}`); }
    } catch (e) { toast(T().adsNone); }
    if (S.tab === 'chest') renderChest();
  };
}
