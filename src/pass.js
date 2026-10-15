// TON Legends — season pass screen: 30 tiers, a free and a premium reward each. XP comes from playing
// (rules in economy.js); premium is bought with Telegram Stars for the current season.
function passBanner() {
  const t = T(), now = Date.now(), ps = ECON.passOf(S, now), tier = ECON.passTier(S, now);
  const ready = passClaimable().length, days = Math.max(0, Math.ceil((ECON.seasonEnds(now) - now) / 864e5));
  return `<button class="panel pass-banner" id="to-pass"><div class="row"><b>🎫 ${t.passTitle} #${n(ps.s + 1)}</b>
    <span class="tag ${ready ? 'gold' : ''}">${ready ? t.passReady(n(ready)) : t.tierN(n(tier), n(ECON.PASS.TIERS))}</span></div>
    <div class="bar xp" style="margin-top:8px"><i style="width:${tier >= ECON.PASS.TIERS ? 100 : (ps.xp % ECON.PASS.XP_PER_TIER) / ECON.PASS.XP_PER_TIER * 100}%"></i></div>
    <div class="muted small" style="margin-top:4px">${t.passEndsIn(n(days))}${ps.prem ? ' · ⭐ ' + t.premium : ''}</div></button>`;
}
function passClaimable() {
  const now = Date.now(), ps = ECON.passOf(S, now), tier = ECON.passTier(S, now), out = [];
  for (let i = 1; i <= tier; i++) {
    if (!ps.cf.includes(i)) out.push([i, 'free']);
    if (ps.prem && !ps.cp.includes(i)) out.push([i, 'prem']);
  }
  return out;
}
const passIcon = r => (r.chest === 'gem' ? '💎🎁' : r.chest ? '👑' : r.gems ? `💎 ${n(r.gems)}` : `🪙 ${n(r.coins)}`);
function renderPass() {
  const t = T(), now = Date.now(), P = ECON.PASS, ps = ECON.passOf(S, now), tier = ECON.passTier(S, now);
  const days = Math.max(0, Math.ceil((ECON.seasonEnds(now) - now) / 864e5)), ready = passClaimable();
  const cell = (i, track) => {
    const r = ECON.passReward(i, track), got = (track === 'prem' ? ps.cp : ps.cf).includes(i), reached = i <= tier, lock = track === 'prem' && !ps.prem;
    const st = got ? 'got' : !reached ? 'far' : lock ? 'lock' : 'ready';
    return `<button class="pcell ${track} ${st}" ${st === 'ready' ? `data-claim="${i}:${track}"` : 'disabled'}>
      <span>${passIcon(r)}</span><small>${got ? '✓' : st === 'lock' ? '🔒⭐' : st === 'ready' ? t.claimShort : ''}</small></button>`;
  };
  $('#screen').innerHTML = `
    <div class="h2">🎫 ${t.passTitle} #${n(ps.s + 1)}</div>
    <div class="panel"><div class="row"><b>${t.tierN(n(tier), n(P.TIERS))}</b><span class="muted small">⏳ ${t.passEndsIn(n(days))}</span></div>
      <div class="bar xp" style="margin:8px 0"><i style="width:${tier >= P.TIERS ? 100 : (ps.xp % P.XP_PER_TIER) / P.XP_PER_TIER * 100}%"></i></div>
      <div class="muted small">${t.passXp(n(ps.xp), n(P.XP_PER_TIER))}</div>
      <p class="muted small" style="margin:8px 0 0">${t.xpHow}</p></div>
    ${ps.prem ? `<div class="panel prem-on">⭐ ${t.premOwned}</div>`
      : `<div class="panel prem-off"><b>⭐ ${t.premium}</b><p class="muted small" style="margin:6px 0 10px">${t.premNote}</p>
        ${Online.state.server ? `<button class="btn wide gold" id="buy-pass">${t.unlockPrem(n(P.PRICE_STARS))}</button>` : ''}</div>`}
    ${ready.length > 1 ? `<button class="btn wide gem" id="claim-all" style="margin-bottom:10px">${t.claimAll(n(ready.length))}</button>` : ''}
    <div class="ptrack-head"><span></span><span>${t.free}</span><span>⭐ ${t.premium}</span></div>
    <div class="ptrack">${Array.from({ length: P.TIERS }, (_, k) => k + 1).map(i => `<div class="prow ${i <= tier ? 'reached' : ''} ${i === tier ? 'cur' : ''}">
      <span class="pt">${n(i)}</span>${cell(i, 'free')}${cell(i, 'prem')}</div>`).join('')}</div>`;
  document.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => { const [i, track] = b.dataset.claim.split(':'); claimPass([[+i, track]]); });
  if ($('#claim-all')) $('#claim-all').onclick = () => claimPass(passClaimable());
  if ($('#buy-pass')) $('#buy-pass').onclick = buyPass;
  const cur = document.querySelector('.prow.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
}
async function claimPass(list) {
  const t = T();
  let coins = 0, gems = 0, chest = null;
  for (const [tier, track] of list) {
    const r = await tryAct({ type: 'pass', tier, track });
    if (!r) break;
    coins += r.coins || 0; gems += r.gems || 0;
    if (r.chestResult) chest = { c: CHESTS.find(x => x.key === r.chest), r: r.chestResult };
  }
  renderPass();
  if (chest) { chestReveal(chest.c, chest.r); if (coins || gems) toast(`${coins ? '+🪙 ' + n(coins) : ''} ${gems ? '+💎 ' + n(gems) : ''}`); }
  else if (coins || gems) { Sound.play('coin'); giftModal('🎫', t.passTitle, coins, '', gems); }
}
async function buyPass() {
  const t = T(), b = $('#buy-pass'); if (b) b.disabled = true;
  try {
    const r = await Online.buy('pass');
    if (r.profile) { Object.assign(S, r.profile); save(); }
    if (r.pass || (S.pass && S.pass.prem)) { Sound.play('legend'); giftModal('⭐', t.passBought, 0, t.passBoughtNote); }
    else if (r.status === 'paid') giftModal('⏳', t.paid, 0, t.paidNote);
  } catch (e) { giftModal('⚠️', t.buyErr, 0, t.buyErrNote); }
  if (S.tab === 'pass') renderPass();
}
