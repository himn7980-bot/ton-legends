// Gram Legends — Partner Pool. Every Telegram Stars purchase is recorded for the buyer's community (from day one,
// for transparency). Once the admins record an official agreement with a community's project, BUYBACK_PCT% of the
// NET revenue (FUND_NET_PCT% of the Stars, i.e. what is left after store/Telegram fees) from that community's later
// purchases goes into its pool, to be spent on what was agreed with the project (e.g. community rewards or a token
// buyback). Every spend is recorded with its on-chain proof. Purchases made before the agreement don't count.
// Admins (bot): /fund · /fund agree <hero> · /fund pause <hero> · /fund buyback <hero> <amount> <asset> <tx link>
const E = require('../src/engine.js');

module.exports = function createFund({ db, persist, tg, admins, pct = () => +process.env.BUYBACK_PCT || 40, net = () => Math.min(100, Math.max(1, +process.env.FUND_NET_PCT || 70)), wallet = () => process.env.FUND_WALLET || null }) {
  db.fund = db.fund || { stars: 0, byCom: {}, agreed: {}, buybacks: [] };
  const F = db.fund;
  F.base = F.base || {}; // stars recorded for a community before its agreement (not part of its pool)
  // Called for every successful Stars payment.
  function onPayment(u, stars) {
    const f = (u.profile && u.profile.faction) || 'none';
    F.stars += stars;
    F.byCom[f] = (F.byCom[f] || 0) + stars;
    persist();
  }
  const since = id => (F.agreed[id] ? Math.max(0, (F.byCom[id] || 0) - (F.base[id] || 0)) : 0);
  const poolOf = stars => Math.floor(stars * net() / 100 * pct() / 100);
  function view() {
    const p = pct();
    const coms = E.BASE_HEROES.map(h => {
      const stars = F.byCom[h.id] || 0, spent = F.buybacks.filter(b => b.f === h.id), s = since(h.id);
      return { id: h.id, stars, since: s, share: poolOf(s), agreed: !!F.agreed[h.id], at: F.agreed[h.id] || null, buybacks: spent.length };
    }).sort((a, b) => b.agreed - a.agreed || b.stars - a.stars || a.id.localeCompare(b.id));
    return { pct: p, net: net(), total: F.stars, none: F.byCom.none || 0, totalShare: coms.reduce((a, c) => a + c.share, 0), wallet: wallet(), coms,
      buybacks: F.buybacks.slice(-20).reverse() };
  }
  const routes = { 'GET /api/fund': () => ({ fund: view() }), 'POST /api/fund': () => ({ fund: view() }) };

  async function handle(m) {
    const say = text => tg('sendMessage', { chat_id: m.chat.id, text, disable_web_page_preview: true });
    if (!admins().has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins can manage the Partner Pool.`);
    const [cmd, q, amount, asset, link] = m.text.replace(/^\/fund(@\w+)?/, '').trim().split(/\s+/);
    const find = s => E.BASE_HEROES.find(h => h.id === String(s || '').toLowerCase() || h.name.toLowerCase().replace(/\s/g, '') === String(s || '').toLowerCase());
    if (cmd === 'agree' || cmd === 'pause') {
      const h = find(q); if (!h) return say('Unknown hero. Use an id like notcoin, dog, pinkbull…');
      if (cmd === 'agree') { if (!F.agreed[h.id]) { F.agreed[h.id] = Date.now(); F.base[h.id] = F.byCom[h.id] || 0; } }
      else { delete F.agreed[h.id]; delete F.base[h.id]; }
      persist();
      return say(cmd === 'agree' ? `🤝 ${h.name}: agreement recorded — from now on ${pct()}% of the net revenue from its community's purchases goes into its pool.` : `⏸ ${h.name}: agreement paused (its pool stops growing).`);
    }
    if (cmd === 'buyback') {
      const h = find(q), amt = +amount;
      if (!h || !(amt > 0) || !asset || !/^https:\/\//.test(link || '')) return say('Usage: /fund buyback <hero> <amount> <asset> <https://tx-link>');
      if (!F.agreed[h.id]) return say(`⚠️ No agreement recorded with ${h.name} yet (/fund agree ${h.id}).`);
      F.buybacks.push({ f: h.id, amount: amt, asset: asset.toUpperCase().slice(0, 10), link: link.slice(0, 300), at: Date.now() });
      persist();
      return say(`✅ Spend recorded: ${amt} ${asset.toUpperCase()} for ${h.name}.\n${link}`);
    }
    const v = view();
    return say([`🤝 Partner Pool · ${v.pct}% of net revenue (net = ${v.net}% of Stars) · recorded ⭐ ${v.total} · pools ⭐ ${v.totalShare}`, '',
      ...v.coms.filter(c => c.stars || c.agreed).map(c => `${c.agreed ? '🤝' : '⏳'} ${E.HERO_BY_ID[c.id].name}: recorded ⭐ ${c.stars}${c.agreed ? ` · since agreement ⭐ ${c.since} → pool ⭐ ${c.share}` : ''}${c.buybacks ? ` · ${c.buybacks} spends` : ''}`),
      (F.byCom.none ? `— no community: ⭐ ${F.byCom.none}` : ''), '',
      '/fund agree <hero> · /fund pause <hero> · /fund buyback <hero> <amount> <asset> <tx link>'].filter(x => x !== '').join('\n'));
  }
  return { onPayment, view, routes, handle };
};
