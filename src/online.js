// TON Legends — Telegram + backend integration (cloud save, leaderboard, Stars shop, referrals).
// Everything here degrades gracefully: outside Telegram or without the server, the game runs fully offline.
const Online = (() => {
  const API = (window.TL_CONFIG && window.TL_CONFIG.api) || '';
  const state = { server: false, bot: null, packs: [] };

  function tg() { const w = window.Telegram && Telegram.WebApp; return w && w.initData ? w : null; }
  function initData() { const w = tg(); return w ? w.initData : ''; }
  function user() { const w = tg(); return w && w.initDataUnsafe ? w.initDataUnsafe.user : null; }
  function startParam() { const w = tg(); return (w && w.initDataUnsafe && w.initDataUnsafe.start_param) || ''; }

  async function call(path, body) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(API + '/api/' + path, body === undefined ? { signal: ctl.signal } :
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: initData(), lang: typeof LANG !== 'undefined' ? LANG : 'en', ...body }), signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  // ---- cloud save (Telegram CloudStorage, no server needed) ----
  function cloud() { const w = tg(); return w && w.CloudStorage && w.isVersionAtLeast && w.isVersionAtLeast('6.9') ? w.CloudStorage : null; }
  function cloudLoad() {
    return new Promise(res => {
      const c = cloud(); if (!c) return res(null);
      try { c.getItem('save', (err, v) => { try { res(!err && v ? JSON.parse(v) : null); } catch (e) { res(null); } }); } catch (e) { res(null); }
    });
  }
  let cloudTimer = null;
  function cloudSave(data) {
    const c = cloud(); if (!c) return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => { try { c.setItem('save', JSON.stringify(data)); } catch (e) {} }, 1500);
  }

  async function connect() {
    if (!tg()) return state;
    try {
      const h = await call('health');
      state.server = !!h.ok; state.bot = h.bot || null; state.packs = h.packs || [];
    } catch (e) { state.server = false; }
    return state;
  }
  async function hello() { if (!state.server) return null; try { return await call('hello', { startParam: startParam() }); } catch (e) { return null; } }

  let scoreTimer = null;
  function submitScore(stage, power) {
    if (!state.server) return;
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(() => call('score', { stage, power: Math.round(power) }).catch(() => {}), 1000);
  }
  async function leaderboard() { if (!state.server) return null; try { return await call('leaderboard', {}); } catch (e) { return null; } }
  async function claim() { if (!state.server) return 0; try { return (await call('claim', {})).coins || 0; } catch (e) { return 0; } }

  // Telegram Stars purchase: server creates the invoice, Telegram handles payment, server credits on success.
  async function buy(packId) {
    const w = tg(); if (!w || !state.server) throw new Error('offline');
    const { link } = await call('invoice', { pack: packId });
    const status = await new Promise(res => w.openInvoice(link, res));
    if (status !== 'paid') return { status, coins: 0 };
    let coins = 0;
    for (let i = 0; i < 5 && !coins; i++) { await new Promise(r => setTimeout(r, 1200)); coins = await claim(); }
    return { status, coins };
  }

  function inviteLink() {
    const u = user();
    return state.bot && u ? `https://t.me/${state.bot}?startapp=ref_${u.id}` : null;
  }
  function share(text) {
    const link = inviteLink(), w = tg();
    if (!link || !w) return false;
    w.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    return true;
  }

  return { state, tg, user, connect, hello, cloudLoad, cloudSave, submitScore, leaderboard, claim, buy, inviteLink, share };
})();
