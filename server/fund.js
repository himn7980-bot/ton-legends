// Gram Legends — Community Fund. Every Telegram Stars purchase is recorded for the buyer's community; BUYBACK_PCT of
// it is set aside for that community's token (buy & burn). Buybacks are not automatic: a community's share is only
// spent after an agreement with that project ("agreed"), and every buyback is recorded with its on-chain proof.
// Admins (bot): /fund · /fund agree <hero> · /fund pause <hero> · /fund buyback <hero> <amount> <asset> <tx link>
const E = require('../src/engine.js');

module.exports = function createFund({ db, persist, tg, admins, pct = () => +process.env.BUYBACK_PCT || 40, wallet = () => process.env.FUND_WALLET || null }) {
  db.fund = db.fund || { stars: 0, byCom: {}, agreed: {}, buybacks: [] };
  const F = db.fund;
  // Called for every successful Stars payment.
  function onPayment(u, stars) {
    const f = (u.profile && u.profile.faction) || 'none';
    F.stars += stars;
    F.byCom[f] = (F.byCom[f] || 0) + stars;
    persist();
  }
  function view() {
    const p = pct();
    const coms = E.BASE_HEROES.map(h => {
      const stars = F.byCom[h.id] || 0, spent = F.buybacks.filter(b => b.f === h.id);
      return { id: h.id, stars, share: Math.floor(stars * p / 100), agreed: !!F.agreed[h.id], buybacks: spent.length };
    }).sort((a, b) => b.stars - a.stars || a.id.localeCompare(b.id));
    return { pct: p, total: F.stars, none: F.byCom.none || 0, totalShare: Math.floor(F.stars * p / 100), wallet: wallet(), coms,
      buybacks: F.buybacks.slice(-20).reverse() };
  }
  const routes = { 'GET /api/fund': () => ({ fund: view() }), 'POST /api/fund': () => ({ fund: view() }) };

  async function handle(m) {
    const say = text => tg('sendMessage', { chat_id: m.chat.id, text, disable_web_page_preview: true });
    if (!admins().has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins can manage the Community Fund.`);
    const [cmd, q, amount, asset, link] = m.text.replace(/^\/fund(@\w+)?/, '').trim().split(/\s+/);
    const find = s => E.BASE_HEROES.find(h => h.id === String(s || '').toLowerCase() || h.name.toLowerCase().replace(/\s/g, '') === String(s || '').toLowerCase());
    if (cmd === 'agree' || cmd === 'pause') {
      const h = find(q); if (!h) return say('Unknown hero. Use an id like notcoin, dog, pinkbull…');
      if (cmd === 'agree') F.agreed[h.id] = Date.now(); else delete F.agreed[h.id];
      persist();
      return say(cmd === 'agree' ? `🤝 ${h.name}: agreement recorded — its share can now be used for buybacks.` : `⏸ ${h.name}: buybacks paused.`);
    }
    if (cmd === 'buyback') {
      const h = find(q), amt = +amount;
      if (!h || !(amt > 0) || !asset || !/^https:\/\//.test(link || '')) return say('Usage: /fund buyback <hero> <amount> <asset> <https://tx-link>');
      if (!F.agreed[h.id]) return say(`⚠️ No agreement recorded with ${h.name} yet (/fund agree ${h.id}).`);
      F.buybacks.push({ f: h.id, amount: amt, asset: asset.toUpperCase().slice(0, 10), link: link.slice(0, 300), at: Date.now() });
      persist();
      return say(`🔥 Buyback recorded: ${amt} ${asset.toUpperCase()} for ${h.name}.\n${link}`);
    }
    const v = view();
    return say([`💰 Community Fund · ${v.pct}% of purchases · total ⭐ ${v.total} (fund ⭐ ${v.totalShare})`, '',
      ...v.coms.filter(c => c.stars).map(c => `${c.agreed ? '🤝' : '⏳'} ${E.HERO_BY_ID[c.id].name}: ⭐ ${c.stars} → fund ⭐ ${c.share}${c.buybacks ? ` · ${c.buybacks} buybacks` : ''}`),
      (F.byCom.none ? `— no community: ⭐ ${F.byCom.none}` : ''), '',
      '/fund agree <hero> · /fund pause <hero> · /fund buyback <hero> <amount> <asset> <tx link>'].filter(x => x !== '').join('\n'));
  }
  return { onPayment, view, routes, handle };
};
