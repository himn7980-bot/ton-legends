// TON Legends — meta game: daily login, missions, achievements, idle chest, leaderboard, settings, boot

// ---------- rules come from economy.js (shared with the server) ----------
const { DAILY_QUESTS, DAILY_REWARDS, AFK_CAP_H } = ECON;
const ACH_ICONS = { win: '⚔️', world: '🗺️', heroes: '🃏', level: '⬆️', chest: '🎁', skill: '⚡' };
const ACHIEVEMENTS = ECON.ACHIEVEMENTS.map(a => ({ ...a, icon: ACH_ICONS[a.id] }));
const now = () => Date.now();
const dqReward = q => ECON.dqReward(S, q);
const dailyCanClaim = () => ECON.dailyCanClaim(S, now());
const afkRate = () => ECON.afkRate(S);
const afkAmount = () => ECON.afkAmount(S, now());
const achTier = a => ECON.achTier(S, a);

let SUGGEST = null; // community suggested by the friend who invited this player
function updateBadge() {
  const b = document.querySelector('#nav [data-tab=quests]');
  if (b) b.classList.toggle('dot', ECON.claimable(S, now()) > 0);
}

function giftModal(icon, title, coins, note, gems) {
  openModal(`<div class="center"><div style="font-size:60px">${icon}</div><div class="big">${title}</div>
    ${coins ? `<div class="big" style="color:var(--gold)">+🪙 ${n(coins)}</div>` : ''}
    ${gems ? `<div class="big" style="color:var(--gem)">+💎 ${n(gems)}</div>` : ''}
    ${note ? `<p class="muted">${note}</p>` : ''}
    <button class="btn wide" id="gm-ok" style="margin-top:10px">${T().great}</button></div>`, box => box.querySelector('#gm-ok').onclick = () => { closeModal(); refresh(); });
}

// ---------- daily login ----------
async function claimDaily() {
  if (!dailyCanClaim()) return;
  const r = await tryAct({ type: 'daily' });
  if (!r) return;
  if (r.chest) { chestReveal(CHESTS.find(c => c.key === 'royal'), r.chest); if (r.gems) toast(`+💎 ${n(r.gems)}`); }
  else giftModal('📅', T().dayReward(n(r.day)), r.coins);
}
function dailyHtml(panel = true) {
  const t = T(), can = dailyCanClaim();
  const nextDay = can ? ECON.dailyNext(S, now()) : S.daily.streak;
  return `<div class="${panel ? 'panel' : ''}"><div class="row"><div class="t">${t.dailyTitle}</div><span class="muted">${t.dailySub}</span></div>
    <div class="days">${DAILY_REWARDS.map((r, i) => {
      const d = i + 1, got = can ? d < nextDay : d <= nextDay, cur = can && d === nextDay;
      return `<div class="day ${got ? 'got' : ''} ${cur ? 'cur' : ''}"><small>${t.day(n(d))}</small><b>${r === 'royal' ? '👑' : '🪙'}</b><small>${r === 'royal' ? `${t.chestShort} +💎${n(ECON.DAY7_GEMS)}` : n(r)}</small></div>`;
    }).join('')}</div>
    <button class="btn wide ${can ? 'gold' : 'ghost'}" id="daily" ${can ? '' : 'disabled'}>${can ? t.claimToday : t.comeBack}</button></div>`;
}
function maybeDaily() { if (dailyCanClaim() && S.seenHelp) setTimeout(() => { if ($('#modal').hidden && !BT) openModal(dailyHtml(false), box => box.querySelector('#daily').onclick = claimDaily); }, 400); }

// ---------- rookie journey (first 7 days) ----------
let ROOKIE_SEL = null;
const rookieCur = () => { const c = S.rookie.claimed; return ECON.ROOKIE.findIndex((_, d) => !c.includes(d)); };
function rookieBanner() {
  const t = T(), d = rookieCur(), done = ECON.ROOKIE[d].tasks.filter(([k, n]) => ECON.rookieStat(S, k) >= n).length;
  return `<button class="rookie-banner" id="to-rookie">🌱 <b>${t.rookieTitle}</b> · ${t.rookieDay(n(d + 1))} · ${n(done)}/${n(3)}${d === 6 ? ' · 👑' : ''}</button>`;
}
function rookieHtml() {
  const t = T(), R = ECON.ROOKIE, open = ECON.rookieOpenDays(S, Date.now()), claimed = S.rookie.claimed;
  if (ROOKIE_SEL === null || claimed.includes(ROOKIE_SEL)) ROOKIE_SEL = rookieCur();
  const d = ROOKIE_SEL, day = R[d], done = ECON.rookieDayDone(S, d), isOpen = d < open;
  const strip = R.map((r, i) => { const st = claimed.includes(i) ? 'got' : i >= open ? 'locked' : ECON.rookieDayDone(S, i) ? 'ready' : 'open';
    return `<button class="rday ${st} ${i === d ? 'sel' : ''}" data-rday="${i}"><small>${t.day(n(i + 1))}</small><b>${st === 'got' ? '✓' : st === 'locked' ? '🔒' : r.legend ? '👑' : '🎁'}</b></button>`; }).join('');
  const nextOpen = Date.parse(ECON.day(Date.now())) + 864e5, hrs = Math.max(1, Math.ceil((nextOpen - Date.now()) / 3600e3));
  return `<div class="panel rookie"><div class="row"><div class="t">🌱 ${t.rookieTitle}</div><span class="muted small">${n(claimed.length)}/${n(7)}</span></div>
    <p class="muted small" style="margin:4px 0 8px">${t.rookieNote}</p>
    <div class="rdays">${strip}</div>
    ${day.tasks.map(([k, goal]) => { const v = Math.min(goal, ECON.rookieStat(S, k)); return `<div class="rtask ${v >= goal ? 'ok' : ''}"><span>${v >= goal ? '✅' : '▫️'} ${t.rk[k](n(goal))}</span><small>${n(v)}/${n(goal)}</small></div>`; }).join('')}
    <div class="muted small" style="margin:8px 0">${t.rookieReward}: 🪙 ${n(day.coins)} + 💎 ${n(day.gems)}${day.legend ? ` + 👑 ${t.rookieLegend}` : ''}</div>
    ${!isOpen ? `<button class="btn wide ghost" disabled>🔒 ${t.rookieOpensIn(n(d === open ? hrs : hrs + (d - open) * 24))}</button>`
      : done ? `<button class="btn wide gold" id="rk-claim">${t.claim(n(day.coins))} + 💎 ${n(day.gems)}${day.legend ? ' + 👑' : ''}</button>`
        : `<button class="btn wide ghost" disabled>${t.rookieDoTasks}</button>`}</div>`;
}
function bindRookie() {
  document.querySelectorAll('[data-rday]').forEach(b => b.onclick = () => { ROOKIE_SEL = +b.dataset.rday; renderQuests(); });
  const c = $('#rk-claim');
  if (c) c.onclick = async () => {
    c.disabled = true;
    const d = ROOKIE_SEL, r = await tryAct({ type: 'rookie', day: d });
    if (!r) return renderQuests();
    Sound.play('chest'); haptic('heavy');
    if (r.hero) {
      const h = HERO_BY_ID[r.hero], t = T();
      openModal(`<div class="center"><div class="tag" style="color:${RARITY.L.color}">${L().rarity.L}</div>
        <div class="reveal" style="--rc:${RARITY.L.color}"><div class="flip"><img src="${img(r.hero)}" alt=""></div></div>
        <div class="big latin" style="font-size:26px">${h.name}</div><p style="font-weight:700">${t.rookieLegendGot}</p>
        <div class="big" style="color:var(--gold)">+🪙 ${n(r.coins)} · +💎 ${n(r.gems)}</div>
        <button class="btn wide gold" id="rk-ok" style="margin-top:10px">${t.great}</button></div>`, box => box.querySelector('#rk-ok').onclick = () => { closeModal(); refresh(); });
      Sound.play('legend');
    } else giftModal('🌱', T().rookieDay(n(d + 1)), r.coins, '', r.gems);
    ROOKIE_SEL = null;
  };
}

// ---------- weekly events calendar ----------
function calendarHtml() {
  const t = T(), today = new Date().getUTCDay(), loc = L().locale;
  // Monday-first week; the names come from the browser in the player's language.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const name = d => new Date(Date.UTC(2024, 0, 7 + d)).toLocaleDateString(loc, { weekday: 'short', timeZone: 'UTC' });
  return `<div class="panel"><div class="t">📅 ${t.calTitle}</div><div class="cal">${order.map(d => { const e = ECON.EVENTS[d];
    return `<div class="cday ${d === today ? 'today' : ''}"><small>${name(d)}</small><b>${EVENT_ICON[e]}</b><span>${t.ev[e]}</span></div>`; }).join('')}</div>
    <p class="small" style="margin:8px 0 0">${t.calToday}: <b>${EVENT_ICON[ECON.eventOf(Date.now())]} ${t.ev[ECON.eventOf(Date.now())]}</b> · ${t.evFx[ECON.eventOf(Date.now())]}</p></div>`;
}

// ---------- missions tab ----------
function renderQuests() {
  const t = T();
  ECON.ensureDQ(S, now());
  const afk = afkAmount(), afkH = Math.min(AFK_CAP_H, (Date.now() - S.afkSince) / 3600e3);
  $('#screen').innerHTML = `
    ${passBanner()}
    ${ECON.rookieActive(S) ? rookieHtml() : ''}
    ${calendarHtml()}
    ${dailyHtml()}
    <div class="panel"><div class="row"><div class="t">${t.idleTitle}</div><span class="muted">${t.perHour(n(afkRate()))}</span></div>
      <p class="muted">${t.idleNote(n(AFK_CAP_H))}</p>
      <div class="bar xp"><i style="width:${afkH / AFK_CAP_H * 100}%"></i></div>
      <button class="btn wide" id="afk" style="margin-top:10px" ${afk > 0 ? '' : 'disabled'}>${t.claim(n(afk))}</button></div>
    <div class="h2">${t.todayQuests}</div>
    ${DAILY_QUESTS.map(q => questRow('dq-' + q.id, '🎯', t.dq[q.id], Math.min(q.goal, S.dq.p[q.id] || 0), q.goal, dqReward(q), !!S.dq.c[q.id])).join('')}
    <div class="h2">${t.achievements}</div>
    ${ACHIEVEMENTS.map(a => {
      const tier = achTier(a), done = tier >= a.tiers.length, goal = a.tiers[Math.min(tier, a.tiers.length - 1)];
      return questRow('ach-' + a.id, a.icon, t.ach[a.id](n(goal)) + (a.tiers.length > 1 ? ` <span class="muted">(${n(Math.min(tier + 1, a.tiers.length))}/${n(a.tiers.length)})</span>` : ''),
        Math.min(goal, a.stat(S)), goal, a.r[Math.min(tier, a.r.length - 1)], done, ECON.achGems(Math.min(tier, a.r.length - 1)));
    }).join('')}`;
  $('#daily').onclick = claimDaily;
  bindRookie();
  $('#to-pass').onclick = () => show('pass');
  $('#afk').onclick = async () => { if (await tryAct({ type: 'afk' })) renderQuests(); };
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = async () => {
    const [kind, id] = b.dataset.q.split('-');
    b.disabled = true;
    const r = await tryAct({ type: kind === 'dq' ? 'quest' : 'ach', id });
    if (r && r.gems) toast(`+🪙 ${n(r.coins)} · +💎 ${n(r.gems)}`);
    renderQuests();
  });
}
function questRow(key, icon, title, prog, goal, reward, claimed, gems) {
  const ready = !claimed && prog >= goal;
  return `<div class="quest ${claimed ? 'claimed' : ''}"><div class="qi">${icon}</div><div class="qb">
    <div class="qt">${title}</div><div class="bar xp"><i style="width:${prog / goal * 100}%"></i></div>
    <div class="muted" style="font-size:11px">${n(prog)} / ${n(goal)}</div></div>
    <button class="btn ${ready ? 'gold' : 'ghost'} qbtn" data-q="${key}" ${ready ? '' : 'disabled'}>${claimed ? '✓' : `🪙 ${n(reward)}${gems ? `<br>💎 ${n(gems)}` : ''}`}</button></div>`;
}

// ---------- leaderboard / profile tab ----------
function renderRank() {
  const t = T(), u = Online.user();
  $('#screen').innerHTML = `
    <div class="panel profile"><div class="avatar">${u && u.first_name ? esc(u.first_name[0]) : '🦸'}</div><div style="flex:1">
      <div class="t">${u ? esc(u.first_name + (u.last_name ? ' ' + u.last_name : '')) : t.player}</div>
      <div class="muted">${t.stageOf(n(S.cleared), n(TOTAL_STAGES), n(teamPower(S.team)))}</div></div></div>
    <div class="stats">
      <div>${t.wins}<b>${n(S.stats.wins)}</b></div><div>${t.arenaWins}<b>${n(S.stats.pvpWins || 0)}</b></div><div>${t.bossesBeaten}<b>${n(S.stats.bosses)}</b></div>
    </div>
    <div class="panel row clan-entry" id="to-war2"><div class="t">${t.warTitle}</div><button class="btn">${t.openClan} →</button></div>
    ${Online.state.profile ? `<div class="panel row clan-entry" id="to-clan"><div class="t">${t.clanTitle}</div><button class="btn">${t.openClan} →</button></div>` : ''}
    ${Online.inviteLink() ? `<div class="panel"><div class="t">${t.invite}</div>
      <p class="muted">${t.inviteNote}</p>
      <button class="btn wide" id="invite">${t.sendInvite}</button></div>` : ''}
    <div class="h2">${t.leaderboard}</div>
    <div id="board">${Online.state.server ? `<p class="muted center">${t.loading}</p>` : `<div class="panel center muted">${t.boardOffline}</div>`}</div>`;
  if ($('#invite')) $('#invite').onclick = () => Online.share(t.inviteText);
  if ($('#to-clan')) $('#to-clan').onclick = () => show('clan');
  $('#to-war2').onclick = () => show('war');
  if (Online.state.server) Online.leaderboard().then(d => {
    const el = $('#board'); if (!el || S.tab !== 'rank') return;
    if (!d || !d.top) { el.innerHTML = `<div class="panel center muted">${t.boardErr}</div>`; return; }
    el.innerHTML = `<div class="panel board">${d.top.map(r => `<div class="brow ${d.me && r.rank === d.me.rank ? 'me' : ''}">
        <span class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : n(r.rank)}</span><span class="bn">${esc(r.name)}</span>
        <span class="bs">${t.stage(n(r.stage))}${r.pvp ? ` · ⚔️${n(r.pvp)}` : ''}</span></div>`).join('') || `<p class="muted center">${t.boardEmpty}</p>`}
      ${d.me && d.me.rank > d.top.length ? `<div class="brow me"><span class="rk">${n(d.me.rank)}</span><span class="bn">${t.you}</span><span class="bs">${t.stage(n(d.me.stage))}</span></div>` : ''}
      <p class="muted center" style="margin:8px 0 0">${t.players(n(d.total || 0))}</p></div>`;
  });
}

// ---------- settings ----------
function applyLang(lang) {
  setLang(lang);
  showCoins();
  refresh();
}
function settingsModal() {
  const t = T();
  openModal(`<div class="big center" style="font-size:24px">${t.settings}</div>
    <div class="setting"><span>${t.language}</span><button class="tag lang-cur" id="s-lang">${LANGS.find(l => l[0] === LANG)[1]} ▾</button></div>
    <div class="setting"><span>${t.guide}</span><button class="tag" id="s-guide">${t.show}</button></div>
    <div class="setting"><span>${t.sfx}</span><button class="toggle ${S.sfx ? 'on' : ''}" id="t-sfx"></button></div>
    <div class="setting"><span>${t.music}</span><button class="toggle ${S.music ? 'on' : ''}" id="t-music"></button></div>
    <div class="setting"><span>${t.howTo}</span><button class="tag" id="s-help">${t.show}</button></div>
    ${Online.state.profile ? `<div class="setting"><span>${t.notifications}</span><button class="toggle ${Online.state.notify ? 'on' : ''}" id="t-notify"></button></div>` : ''}
    ${Online.state.profile ? '' : `<div class="setting"><span>${t.reset}</span><button class="tag" id="s-reset" style="color:var(--red)">${t.erase}</button></div>`}
    <p class="muted center">${t.version} ${Online.tg() ? t.cloudOn : ''}</p>
    <button class="btn wide" id="s-ok">${t.close}</button>`, box => {
    const q = s => box.querySelector(s);
    q('#s-lang').onclick = langModal;
    q('#s-guide').onclick = guideModal;
    q('#t-sfx').onclick = e => { S.sfx = !S.sfx; save(); Sound.set({ sfx: S.sfx }); e.target.classList.toggle('on', S.sfx); };
    q('#t-music').onclick = e => { S.music = !S.music; save(); Sound.set({ music: S.music }); e.target.classList.toggle('on', S.music); };
    q('#s-help').onclick = help;
    if (q('#t-notify')) q('#t-notify').onclick = async e => {
      const on = !Online.state.notify; e.target.classList.toggle('on', on);
      try { Online.state.notify = (await Online.setNotify(on)).on; } catch (err) { e.target.classList.toggle('on', !on); toast(errText(err)); }
    };
    if (q('#s-reset')) q('#s-reset').onclick = e => {
      if (e.target.dataset.sure) { const keep = { sfx: S.sfx, music: S.music, lang: S.lang }; S = { ...defaultState(), ...keep, seenHelp: true }; save(); showCoins(); closeModal(); show('map'); }
      else { e.target.dataset.sure = 1; e.target.textContent = t.sure; }
    };
    q('#s-ok').onclick = closeModal;
  });
}

function langModal() {
  openModal(`<div class="big center" style="font-size:22px">${T().language}</div>
    <div class="lang-grid">${LANGS.map(([code, name]) => `<button class="lang ${code === LANG ? 'on' : ''}" data-lang="${code}">${name}</button>`).join('')}</div>`, box => {
    box.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { S.lang = b.dataset.lang; save(); applyLang(S.lang); settingsModal(); });
  }, { onBack: settingsModal });
}
function guideModal() {
  const t = T();
  openModal(`<div class="big center" style="font-size:22px">${t.guideTitle}</div>
    ${[...t.guideSections.map((sec, i) => (t.guideFix && t.guideFix[i]) || sec), ...(t.guideExtra || [])].map(([h, p]) => `<div class="guide-sec"><div class="t">${h}</div><p class="muted">${p}</p></div>`).join('')}
    <div class="guide-sec"><div class="t">🔗 ${t.synTitle}</div><p class="muted">${t.synNote}</p>
      ${SYNERGIES.map(x => `<div class="syn-row ${x.bad ? 'bad' : 'good'}"><div class="row"><b>${x.ico} ${t.synName[x.id]}</b><span>${synFx(x)}</span></div><div class="muted small">${t.synNeed[x.id]}</div></div>`).join('')}</div>
    <div class="guide-sec"><div class="t">⚔️ ${t.pairsTitle}</div><p class="muted">${t.pairsText}</p></div>
    <button class="btn wide" id="g-ok">${t.close}</button>`, box => box.querySelector('#g-ok').onclick = closeModal);
}

// ---------- boot ----------
document.addEventListener('pointerdown', e => {
  Sound.init();
  if (e.target.closest('button') && !e.target.closest('.hcard')) Sound.play('click');
}, { capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateBadge(); });
$('#settings').onclick = settingsModal;
$('#gems').onclick = () => { if (!BT) show('chest'); };
$('#back').onclick = goBack;

window.initTelegram = async () => {
  const w = Online.tg();
  if (!w) return Online.markReady();
  try { w.ready(); w.expand(); w.setHeaderColor('#0a0f24'); w.setBackgroundColor('#0a0f24'); if (w.disableVerticalSwipes) w.disableVerticalSwipes(); } catch (e) {}
  try { w.BackButton.onClick(goBack); } catch (e) {}
  // First launch: speak the player's Telegram language until they pick one.
  const u = Online.user();
  if (!S.lang && u && u.language_code && detectLang(u.language_code) !== LANG) { setLang(detectLang(u.language_code)); showCoins(); refresh(); }
  syncNav();
  await Online.connect();
  if (Online.state.server) {
    // Online: the server's profile is the truth (first visit imports this device's save once).
    try {
      const hi = await Online.hello();
      SUGGEST = (hi && hi.suggest) || null;
      const prev = S.coins;
      Object.assign(S, await Online.loadProfile(ECON.pickKeys(S)));
      const c = await Online.claim();
      if (c.profile) Object.assign(S, c.profile);
      save(); showCoins(prev);
      if (c.coins > 0 || c.gems > 0) giftModal('🎁', T().giftTitle, c.coins, T().giftNote, c.gems);
    } catch (e) {}
  } else {
    // No server: fall back to the Telegram cloud copy of the offline save.
    const cloud = await Online.cloudLoad();
    if (cloud && cloud.owned && (cloud.updatedAt || 0) > (S.updatedAt || 0)) {
      S = migrate(cloud); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
      if (S.lang) setLang(S.lang);
      showCoins();
    }
  }
  Online.markReady();
  if (!BT) refresh();
  if (Online.state.profile) {
    loadWar().then(() => { if (!BT && S.tab === 'map') refresh(); });
    // Returning players who never chose a community get the picker once the server profile is in.
    if (S.seenHelp && !S.faction && $('#modal').hidden && !BT) factionPicker({ suggest: SUGGEST, then: maybeDaily });
    arenaBoot();
  }
};

// Called at the end of arena.js, once every screen's code is loaded.
function boot() {
  setLang(S.lang || detectLang());
  preloadBaseImages(() => { if (!BT && S.tab !== 'map') refresh(); });
  Sound.set({ sfx: S.sfx, music: S.music });
  Sound.music('menu');
  showCoins();
  show(S.tab || 'map');
  if (!S.seenHelp) help();
  else if (!S.faction && !Online.tg()) factionPicker({ then: maybeDaily });
  else maybeDaily();
  setInterval(updateBadge, 60e3);
}
