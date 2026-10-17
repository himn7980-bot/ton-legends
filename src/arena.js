// Gram Legends — PvP arena: pick an entry fee, find an opponent or challenge a friend, then fight live.
// The server holds both entries, runs the fight and pays the prize; this file only shows it and sends taps.
const STAKES = [100, 500, 1000, 5000, 10000];
const PVP_STATUS = ['freeze', 'stun', 'slow', 'poison', 'vuln', 'weak', 'buff', 'dodge']; // same bit order as the server
const ARENA_BG = 'radial-gradient(circle at 50% 35%, #3b1d6e 0, #120a2e 55%, #05040f 100%)';
let PV = null; // current duel ticket: { ticket, stake, code, es }

function setServerCoins(coins) { if (typeof coins !== 'number') return; const prev = S.coins; S.coins = coins; save(); showCoins(prev); }

function renderArena() {
  const t = T();
  if (!Online.state.profile) {
    $('#screen').innerHTML = `<div class="h2">${t.arenaTitle}</div><div class="panel center muted">${t.arenaOffline}</div>`;
    return;
  }
  if (!STAKES.includes(S.stake)) S.stake = STAKES[0];
  const lead = S.team[0], aiLeft = ECON.aiLeft(S, Date.now());
  $('#screen').innerHTML = `
    <div class="arena-hero" style="background:${ARENA_BG}">
      <div class="ah-card">${lead ? `<img src="${img(lead)}" alt="">` : ''}</div>
      <div class="ah-vs">VS</div>
      <div class="ah-card mystery">?</div>
    </div>
    <div class="panel"><div class="row"><div class="t">${t.aiTitle}</div><span class="tag ${aiLeft ? 'gold' : ''}">${t.aiLeft(n(aiLeft), n(ECON.AI_DAILY))}</span></div>
      <p class="muted" style="margin:6px 0 0">${t.aiNote}</p>
      ${!isOpen('ai') ? lockNote('ai') : `<div class="ai-levels">${Object.keys(ECON.AI_LEVELS).map(lv => { const r = ECON.aiReward(S, lv);
        return `<button class="btn ${lv === 'hard' ? 'gem' : lv === 'normal' ? 'gold' : ''}" data-ai="${lv}" ${S.team.length ? '' : 'disabled'}>${t.aiLv[lv]}<small>🪙 ${n(r.coins)}${r.gems ? ` +💎${n(r.gems)}` : ''}</small></button>`; }).join('')}</div>`}</div>
    <div class="h2">${t.arenaTitle}</div>
    ${!isOpen('pvp') ? `<div class="panel">${lockNote('pvp')}<p class="muted small" style="margin:6px 0 0">${t.arenaNote}</p></div>` : `<div id="lg-box"></div>
    <p class="muted">${t.arenaNote} <b style="color:var(--gem)">+💎 ${n(2)}</b></p>
    <div class="panel">
      <div class="row"><div class="t">${t.stake}</div><span class="tag gold">${t.pot(n(ECON.pvpPrize(S.stake)))}</span></div>
      <div class="stakes">${STAKES.map(v => `<button class="chip ${v === S.stake ? 'on' : ''}" data-stake="${v}" ${S.coins < v ? 'disabled' : ''}>🪙 ${n(v)}</button>`).join('')}</div>
      ${deckSwitcher()}
      <div class="row"><span class="muted">${t.yourTeam(n(teamPower(S.team)))}</span><button class="tag" id="pv-team">${t.editTeam}</button></div>
      <div class="mini-team">${[0, 1, 2, 3, 4].map(i => S.team[i] ? `<img src="${img(S.team[i])}" alt="">` : '<div class="empty"></div>').join('')}</div>
      <button class="btn wide gold" id="pv-find" ${S.coins < S.stake || !S.team.length ? 'disabled' : ''}>${t.findOpp}</button>
      <button class="btn wide" id="pv-room" style="margin-top:12px" ${S.coins < S.stake || !S.team.length ? 'disabled' : ''}>${t.challenge}</button>
    </div>`}
    <div class="panel"><div class="t">${t.haveCode}</div>
      <div class="code-row"><input id="pv-code" maxlength="6" placeholder="${t.codePh}" autocomplete="off" autocapitalize="characters"><button class="btn" id="pv-join">${t.join}</button></div></div>
    ${isOpen('pvp') ? `<p class="muted center">${t.record(n(S.stats.pvpWins || 0), n(S.stats.pvpLosses || 0))}</p>
    <p class="muted small">${t.arenaRules}</p>` : ''}`;
  if ($('#lg-box')) leaguePanel($('#lg-box'));
  document.querySelectorAll('[data-stake]').forEach(b => b.onclick = () => { S.stake = +b.dataset.stake; save(); renderArena(); });
  if ($('#pv-team')) $('#pv-team').onclick = () => show('heroes');
  document.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => startAi(b.dataset.ai));
  if ($('#pv-find')) { $('#pv-find').onclick = () => arenaOpen('find'); $('#pv-room').onclick = () => arenaOpen('room'); }
  $('#pv-join').onclick = () => { const c = $('#pv-code').value.trim().toUpperCase(); if (c) arenaJoinPrompt(c); };
}

async function arenaOpen(kind) {
  try {
    const r = await Online.pvp(kind, { stake: S.stake });
    setServerCoins(r.coins);
    watchDuel(r.ticket, { stake: S.stake, code: r.code || null });
  } catch (e) { toast(errText(e)); }
}

// AI rival: no stake; the server builds an AI team matched to your power and runs the fight like a duel.
async function startAi(level) {
  try { const r = await Online.pvp('ai', { level }); watchDuel(r.ticket, { stake: 0, ai: level }); }
  catch (e) { toast(errText(e)); }
}

async function arenaJoinPrompt(code) {
  const t = T();
  let info;
  try { info = await Online.pvp('peek', { code }); } catch (e) { return toast(errText(e)); }
  openModal(`<div class="center"><div style="font-size:54px">⚔️</div>
    <div class="big" style="font-size:22px">${t.challengedBy(esc(info.host))}</div>
    <p><span class="tag gold">${t.stake}: 🪙 ${n(info.stake)}</span> <span class="tag gold">${t.pot(n(ECON.pvpPrize(info.stake)))}</span></p>
    <p class="muted">${t.theirPower(n(info.power))} · ${t.yourTeam(n(teamPower(S.team)))}</p>
    <div class="btns"><button class="btn ghost" id="dj-no">${t.decline}</button><button class="btn gold" id="dj-yes" ${S.coins < info.stake ? 'disabled' : ''}>${t.accept}</button></div>
    ${S.coins < info.stake ? `<p class="muted">${t.err.no_coins}</p>` : ''}</div>`, box => {
    box.querySelector('#dj-no').onclick = closeModal;
    box.querySelector('#dj-yes').onclick = async () => {
      try { const r = await Online.pvp('join', { code }); closeModal(); setServerCoins(r.coins); watchDuel(r.ticket, { stake: info.stake }); }
      catch (e) { closeModal(); toast(errText(e)); }
    };
  });
}

// Open the live event stream for a duel ticket (searching → match → ticks → end).
function watchDuel(ticket, info) {
  stopDuelStream();
  PV = { ticket, stake: info.stake, code: info.code || null, ai: info.ai || null, done: false, since: Date.now() };
  PV.es = Online.stream(ticket, {
    waiting: () => { if (!BT) showWaiting(); },
    match: m => { if (BT && BT.mode === 'pvp') return; if (!$('#modal').hidden) closeModal(); startPvp(m); },
    tick: d => onPvpTick(d),
    end: d => onPvpEnd(d),
    emote: d => showEmote(d),
    cancelled: () => { stopDuelStream(); if (!$('#modal').hidden) closeModal(); refresh(); },
  });
  showWaiting();
}
function stopDuelStream() { if (PV && PV.es) PV.es.close(); }

function showWaiting() {
  if (!PV || BT) return;
  const t = T();
  if (PV.ai) return openModal(`<div class="center"><div class="spinner"></div><div class="big" style="font-size:22px">${t.aiVs(t.aiLv[PV.ai])}</div>
    <button class="btn wide ghost" id="ai-x" style="margin-top:14px;visibility:hidden">${t.close}</button></div>`, box => {
      // If the match never starts (server restart, lost connection), let the player out after a few seconds.
      setTimeout(() => { const b = box.querySelector('#ai-x'); if (b) b.style.visibility = 'visible'; }, 6000);
      box.querySelector('#ai-x').onclick = () => { stopDuelStream(); PV = null; closeModal(); refresh(); };
    }, { lock: true, onBack: () => {} });
  openModal(`<div class="center">
    <div class="spinner"></div>
    <div class="big" style="font-size:22px">${PV.code ? t.waitingFriend : t.searching}</div>
    <p><span class="tag gold">${t.stake}: 🪙 ${n(PV.stake)}</span> <span class="tag gold">${t.pot(n(ECON.pvpPrize(PV.stake)))}</span></p>
    ${PV.code || !isOpen('ai') ? '' : `<button class="btn wide gem" id="pv-ai" style="margin:8px 0" hidden>${t.aiInstead}</button>`}
    ${PV.code ? `<div class="muted">${t.inviteCode}</div><div class="duel-code">${PV.code}</div>
      <button class="btn wide gold" id="pv-share">${t.sendDuel}</button>` : ''}
    <button class="btn wide ghost" id="pv-cancel" style="margin-top:10px">${t.cancel}</button></div>`, box => {
    const sh = box.querySelector('#pv-share');
    if (sh) sh.onclick = () => { if (!Online.shareDuel(PV.code, t.duelText(n(PV.stake)))) toast(PV.code); };
    box.querySelector('#pv-cancel').onclick = cancelDuel;
    // Nobody at this stake yet? After 12 s offer the AI rival (the stake is refunded first).
    const ai = box.querySelector('#pv-ai'), mine = PV;
    if (ai) {
      setTimeout(() => { if (PV === mine && !BT && ai.isConnected) ai.hidden = false; }, Math.max(0, 12000 - (Date.now() - PV.since)));
      ai.onclick = async () => { await cancelDuel(); startAi('normal'); };
    }
  }, { onBack: cancelDuel, lock: true });
}
async function cancelDuel() {
  if (!PV) return closeModal();
  try { const r = await Online.pvp('cancel', { ticket: PV.ticket }); setServerCoins(r.coins); } catch (e) { toast(errText(e)); }
  stopDuelStream(); PV = null;
  closeModal(); refresh();
}

function startPvp(m) {
  const t = T();
  const units = m.units.map(u => ({ ...u, hp: u.maxHp, shield: 0, energy: 20, alive: true, fx: {}, boss: false }));
  const mine = units.filter(u => u.side === m.side), theirs = units.filter(u => u.side !== m.side);
  BT = { mode: 'pvp', mySide: m.side, ticket: PV.ticket, es: PV.es, ended: false, raf: 0,
    B: { t: 0, events: [], over: null, ult: { hero: 0, enemy: 0 }, heroes: units.filter(u => u.side === 'hero'), enemies: units.filter(u => u.side === 'enemy') } };
  const input = code => Online.pvp('input', { ticket: BT.ticket, code }).catch(() => {});
  buildBattle({
    title: m.ai ? t.aiVs(t.aiLv[m.ai]) : `⚔️ ${t.pot(n(m.pot))}`, bg: ARENA_BG, scene: { key: 'galaxy', ch: m.ai ? 0 : 2 }, mine, theirs,
    oppLabel: `🆚 ${avatarImg(m.opp.av)}${esc(m.opp.name)} · ${t.power} ${n(m.opp.power)}`, myLabel: `🛡️ ${avatarImg(m.you.av)}${esc(m.you.name)} · ${t.power} ${n(m.you.power)}`,
    onTap: u => input(u.uid), onAuto: on => input(on ? -1 : -2), onUlt: () => input(-3),
  });
  if (S.auto) input(-1);
  // Emote bar: five quick reactions + your community mascot.
  const bar = document.createElement('div'); bar.className = 'emote-bar';
  bar.innerHTML = EMOTES.map((e, i) => `<button data-emo="${i}">${i === EMOTES.length - 1 ? (S.faction ? `<img src="${img(S.faction)}" alt="">` : '🚩') : e}</button>`).join('');
  $('#battle').appendChild(bar); $('#battle').classList.add('has-emotes');
  bar.querySelectorAll('[data-emo]').forEach(b => b.onclick = () => { if (BT && !BT.ended) { haptic('light'); Online.pvp('emote', { ticket: BT.ticket, e: +b.dataset.emo }).catch(() => {}); } });
  Sound.music('battle');
  countdown(m.startIn);
}

const EMOTES = ['😂', '🔥', '😱', '👏', '🤝', '🚩'];
function showEmote(d) {
  if (!BT || BT.mode !== 'pvp') return;
  const fx = $('#b-fx'); if (!fx) return;
  const el = document.createElement('div'), mine = d.side === BT.mySide;
  el.className = `emote ${mine ? 'me' : 'opp'}`;
  el.innerHTML = d.e === EMOTES.length - 1 ? (d.f ? `<img src="${img(d.f)}" alt="">` : '🚩') : (EMOTES[d.e] || '');
  fx.appendChild(el);
  if (!mine) { haptic('light'); Sound.play('click'); }
  setTimeout(() => el.remove(), 2200);
}

function countdown(ms) {
  if (ms <= 300) return;
  const t = T(), d = document.createElement('div');
  d.className = 'countdown';
  $('#b-fx').appendChild(d);
  const end = performance.now() + ms;
  const tickFn = () => {
    const left = end - performance.now();
    if (left <= 0 || !BT) { d.remove(); return; }
    d.innerHTML = `<div class="cd-n">${n(Math.ceil(left / 1000))}</div><div class="cd-t">${t.ready}</div>`;
    requestAnimationFrame(tickFn);
  };
  tickFn();
}

function onPvpTick(d) {
  if (!BT || BT.mode !== 'pvp') return;
  const B = BT.B;
  B.t = d.t;
  if (d.ult) B.ult = { hero: d.ult[0], enemy: d.ult[1] };
  const byUid = new Map(allUnits().map(u => [u.uid, u]));
  for (const [uid, hp, sh, en, bits] of d.u) {
    const u = byUid.get(uid); if (!u) continue;
    u.hp = hp; u.shield = sh; u.energy = en; u.alive = hp > 0;
    PVP_STATUS.forEach((k, i) => { u.fx[k] = bits & (1 << i) ? d.t + 1 : 0; });
  }
  B.events.push(...d.ev);
  flush();
}

async function onPvpEnd(d) {
  stopDuelStream();
  if (PV) PV.done = true;
  setServerCoins(d.coins);
  try { const pg = S.gems; Object.assign(S, await Online.loadProfile(null)); save(); showCoins(undefined, pg); } catch (e) {}
  const show = () => showPvpResult(d);
  if (BT && BT.mode === 'pvp') { BT.ended = true; syncNav(); setTimeout(show, 900); } else show();
}

function showPvpResult(d) {
  const t = T();
  if (BT && BT.mode === 'pvp') { BT = null; }
  PV = null;
  Sound.music('menu');
  Sound.play(d.result === 'win' ? 'win' : d.result === 'lose' ? 'lose' : 'coin');
  if (d.result === 'win') haptic('heavy');
  const icon = d.result === 'win' ? '🏆' : d.result === 'lose' ? '💔' : '🤝';
  let title = d.result === 'win' ? t.arenaWin : d.result === 'lose' ? t.arenaLose : t.arenaDraw;
  let amount = d.result === 'win' ? `<div class="big" style="color:var(--gold)">+🪙 ${n(d.pot)}</div>${d.gemsWon ? `<div class="big" style="color:var(--gem)">+💎 ${n(d.gemsWon)}</div>` : ''}`
    : d.result === 'lose' ? `<div class="big" style="color:var(--red)">−🪙 ${n(d.stake)}</div>` : '';
  if (d.ai) {
    const rw = d.reward || {};
    title = d.result === 'win' ? t.aiWin : d.result === 'lose' ? t.aiLose : t.arenaDraw.split('—')[0];
    amount = d.result === 'win' ? (rw.coins ? `<div class="big" style="color:var(--gold)">+🪙 ${n(rw.coins)}</div>${rw.gems ? `<div class="big" style="color:var(--gem)">+💎 ${n(rw.gems)}</div>` : ''}<p class="muted">${t.aiLeft(n(d.aiLeft), n(ECON.AI_DAILY))}</p>`
      : `<p class="muted">${t.aiNoReward}</p>`) : `<p class="muted">${t.aiLoseNote}</p>`;
  }
  const leave = tab => () => { closeModal(); $('#battle').hidden = true; show(tab); };
  openModal(`<div class="center"><div style="font-size:64px">${icon}</div><div class="big">${title}</div>
    <p class="muted">🆚 ${esc(d.ai ? t.aiVs(t.aiLv[d.ai]) : d.opp || '')}</p>${amount}
    <div class="btns" style="margin-top:14px"><button class="btn ghost" id="pr-map">${t.toMap}</button><button class="btn gold" id="pr-arena">${t.toArena}</button></div>
    ${d.ai ? `<button class="btn wide gem" id="pr-again" style="margin-top:10px">${t.aiAgain}</button>` : ''}</div>`, box => {
    box.querySelector('#pr-map').onclick = leave('map');
    box.querySelector('#pr-arena').onclick = leave('arena');
    const ag = box.querySelector('#pr-again');
    if (ag) ag.onclick = () => { leave('arena')(); startAi(d.ai); };
  }, { lock: true, onBack: leave('arena') });
}

// After the profile syncs: open a duel invite link, or reconnect to a duel that is still running.
let duelLinkUsed = false;
async function arenaBoot() {
  const sp = Online.startParam();
  if (!duelLinkUsed && sp.startsWith('duel_')) { duelLinkUsed = true; show('arena'); return arenaJoinPrompt(sp.slice(5)); }
  if (!duelLinkUsed && sp.startsWith('clan_')) { duelLinkUsed = true; show('clan'); return clanJoinPrompt(sp.slice(5)); }
  try {
    const r = await Online.pvp('state');
    if (r.ticket && !PV) { show('arena'); watchDuel(r.ticket, { stake: r.stake, code: r.code }); }
  } catch (e) {}
}

boot();
