// Gram Legends — payment support, refunds, terms and privacy (Telegram requires /paysupport and /terms for bots that sell).
//   /paysupport          — any player: how to get help, their recent purchases; the admins are told
//   /refund <charge id>  — admins: refund a Stars payment (refundStarPayment) and take the purchase back
//   /terms · /privacy    — any player: the rules, with a link to the full page (GET /terms, GET /privacy)

const TERMS = [
  ['1. The game', 'Gram Legends is a free-to-play card game inside Telegram. It is a fan-made game and is not affiliated with, endorsed by or sponsored by the projects, communities or characters it shows.'],
  ['2. Virtual items', 'Coins, gems, cards, frames and passes are virtual items for use in the game only. They have no monetary value, cannot be cashed out, sold or transferred outside the game, and give no rights to any token, share, payout or revenue.'],
  ['3. Purchases', 'Purchases are made with Telegram Stars and delivered right away. Because they are digital items used at once, purchases are final, except where the law requires otherwise or an item was not delivered. For any problem with a payment, send /paysupport to the bot.'],
  ['4. Partner Pool', 'Part of the net revenue from purchases may be set aside for activities agreed with partner projects (for example community rewards or token buybacks). This is not an investment and not a promise about any token or its price; players receive nothing from it beyond the game.'],
  ['5. Fair play', 'Cheating, automation, exploiting bugs, using several accounts to gain rewards, or abusing other players can lead to the loss of items or of the account. Results of battles are checked by the server.'],
  ['6. Changes', 'The game is provided "as is". Balance, rewards and features can change, and the service can be interrupted or ended. These terms may be updated; continuing to play means accepting the current version.'],
];
const PRIVACY = [
  ['What we store', 'Your Telegram user id, first name, username and language (sent by Telegram when you open the game), the game name you choose, your game progress, purchases (Telegram payment ids and amounts) and, if you link one, a TON wallet address.'],
  ['Why', 'To run the game: save your progress, show rankings, deliver purchases, prevent cheating, and send the reminders you can turn off in Settings.'],
  ['Sharing', 'We do not sell your data. Your game name, avatar card and results are shown to other players in rankings. Payments are processed by Telegram.'],
  ['Keeping and deleting', 'Data is kept while the game runs; a daily backup is sent privately to the game admins in Telegram. To have your data deleted, send /paysupport and ask for deletion.'],
];
const page = (title, sections) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gram Legends — ${title}</title><style>body{font:16px/1.55 system-ui,sans-serif;background:#0a0f24;color:#eef2ff;max-width:720px;margin:0 auto;padding:20px 16px}h1{font-size:24px}h2{font-size:17px;margin-top:22px;color:#ffc531}p{color:#c8d0f0}</style></head>
<body><h1>⚔️ Gram Legends — ${title}</h1>${sections.map(([h, p]) => `<h2>${h}</h2><p>${p}</p>`).join('')}<p style="margin-top:28px;font-size:13px">Questions: send /paysupport to the game bot.</p></body></html>`;

module.exports = function createSupport({ db, persist, tg, admins, webapp = () => '' }) {
  const say = (chat, text, extra = {}) => tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true, ...extra });
  const base = () => { try { return webapp() ? new URL(webapp()).origin : ''; } catch (e) { return ''; } };
  const recent = uid => Object.entries(db.payments || {}).filter(([, p]) => p.uid === String(uid)).sort((a, b) => b[1].at - a[1].at).slice(0, 5);

  // Take a refunded purchase back (never below zero) and mark it.
  function reverse(chargeId) {
    const pay = db.payments[chargeId], u = pay && db.users[pay.uid], p = u && u.profile;
    if (!pay || pay.refunded) return null;
    const pack = pay.pack || '';
    if (p) {
      if (pay.gems) p.gems = Math.max(0, (p.gems || 0) - pay.gems);
      if (pay.coins) p.coins = Math.max(0, p.coins - pay.coins);
      if (pack.startsWith('cos_') && p.cos) { const id = pack.slice(4); p.cos.own = p.cos.own.filter(x => x !== id); if (p.cos.on === id) p.cos.on = null; }
      if (pack === 'pass' && p.pass) p.pass.prem = false;
    }
    pay.refunded = Date.now();
    if (db.fund) { const f = pay.f || 'none'; db.fund.stars = Math.max(0, db.fund.stars - pay.stars); db.fund.byCom[f] = Math.max(0, (db.fund.byCom[f] || 0) - pay.stars); }
    persist();
    return pay;
  }

  async function handle(m) {
    const text = m.text || '', cmd = (/^\/(\w+)/.exec(text) || [])[1];
    if (cmd === 'terms') return say(m.chat.id, ['📜 Gram Legends — Terms', '', ...TERMS.map(([h, p]) => `${h}\n${p}`), '', base() ? `Full page: ${base()}/terms` : ''].join('\n\n').trim());
    if (cmd === 'privacy') return say(m.chat.id, ['🔒 Gram Legends — Privacy', '', ...PRIVACY.map(([h, p]) => `${h}: ${p}`), '', base() ? `Full page: ${base()}/privacy` : ''].join('\n\n').trim());
    if (cmd === 'paysupport') {
      const list = recent(m.from.id);
      await say(m.chat.id, ['🛟 Payment support', '',
        'Something wrong with a purchase (not delivered, charged twice, wrong item)? Reply here with what happened — an admin will check it. Refunds are made in Telegram Stars to the same account.',
        list.length ? '\nYour recent purchases:\n' + list.map(([id, p]) => `• ${new Date(p.at).toISOString().slice(0, 10)} · ${p.pack} · ⭐ ${p.stars}${p.refunded ? ' · refunded' : ''}\n  id: ${id}`).join('\n') : '\nNo purchases found on this account.',
        '\nTerms: /terms · Privacy: /privacy'].join('\n'));
      const who = `${m.from.first_name || ''}${m.from.username ? ' @' + m.from.username : ''} (id ${m.from.id})`;
      for (const a of admins()) await say(a, `🛟 /paysupport from ${who}. ${list.length ? `Last purchase: ${list[0][0]} (⭐ ${list[0][1].stars}, ${list[0][1].pack}). Refund with /refund <id>.` : 'No purchases.'}`).catch(() => {});
      return;
    }
    if (cmd === 'refund') {
      if (!admins().has(String(m.from.id))) return say(m.chat.id, `Your Telegram ID is ${m.from.id}. Only admins can refund. Players: send /paysupport.`);
      const id = text.split(/\s+/)[1] || '';
      const pay = db.payments[id];
      if (!pay) return say(m.chat.id, 'Usage: /refund <telegram_payment_charge_id> (shown by /paysupport).');
      if (pay.refunded) return say(m.chat.id, 'Already refunded.');
      try { await tg('refundStarPayment', { user_id: +pay.uid, telegram_payment_charge_id: id }); }
      catch (e) { return say(m.chat.id, `⚠️ Telegram refused the refund: ${e.message}`); }
      reverse(id);
      await say(+pay.uid, `↩️ Your purchase (⭐ ${pay.stars}) was refunded to your Telegram Stars.`).catch(() => {});
      return say(m.chat.id, `✅ Refunded ⭐ ${pay.stars} to ${pay.uid}; the purchase was taken back.`);
    }
  }
  const pages = { 'GET /terms': page('Terms of Service', TERMS), 'GET /privacy': page('Privacy Policy', PRIVACY) };
  return { handle, reverse, pages, COMMANDS: ['paysupport', 'refund', 'terms', 'privacy'] };
};
