// Gram Legends — partner quests: projects pay to be shown here ("join our channel", "open our bot") and players earn
// gems/coins once per quest. Channels and groups are verified with getChatMember (the game bot must be an admin
// there); links that cannot be checked (bots, websites) pay after the player has opened them for a few seconds.
// Admins manage them in the bot:
//   /quest add @channel 20 7 Join the Notcoin channel   → 20 gems, 7 days, verified membership
//   /quest add https://t.me/somebot 15 3 Play Some Bot  → 15 gems, 3 days, open-to-claim
//   /quest list · /quest remove <id>
const OPEN_WAIT_MS = 8000;

module.exports = function createPartners({ db, persist, tg, credit, profileOut, admins }) {
  db.partners = db.partners || [];
  const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code: status }); };
  const live = (now = Date.now()) => db.partners.filter(q => q.until > now);
  const view = u => live().map(q => ({ id: q.id, title: q.title, url: q.url, gems: q.gems, coins: q.coins || 0, verify: !!q.chat, until: q.until,
    done: !!(u.pq && u.pq[q.id] && u.pq[q.id].done) }));

  const routes = {
    'POST /api/partners/list': (body, u) => ({ quests: view(u) }),
    'POST /api/partners/open': (body, u) => {
      const q = live().find(x => x.id === body.id); if (!q) fail('not_found');
      u.pq = u.pq || {}; u.pq[q.id] = u.pq[q.id] || {}; if (!u.pq[q.id].opened) u.pq[q.id].opened = Date.now();
      q.opens = (q.opens || 0) + 1; persist();
      return { ok: true };
    },
    'POST /api/partners/claim': async (body, u) => {
      if (!u.profile) fail('no_profile');
      const q = live().find(x => x.id === body.id); if (!q) fail('not_found');
      u.pq = u.pq || {}; const st = u.pq[q.id] = u.pq[q.id] || {};
      if (st.done || st.checking) fail('claimed');
      if (q.chat) {
        st.checking = true; // set before the await, so parallel claims can't all pass
        let m = null;
        try { m = await tg('getChatMember', { chat_id: q.chat, user_id: Number(u.id) }).catch(() => null); } finally { delete st.checking; }
        if (st.done) fail('claimed');
        if (!m || !['member', 'administrator', 'creator', 'restricted'].includes(m.status)) fail('not_member');
      } else if (!st.opened || Date.now() - st.opened < OPEN_WAIT_MS) fail('not_ready');
      st.done = Date.now();
      u.profile.gems = (u.profile.gems || 0) + q.gems; u.profile.coins += q.coins || 0;
      q.claims = (q.claims || 0) + 1; u.profile.stats.partners = (u.profile.stats.partners || 0) + 1;
      persist();
      return { gems: q.gems, coins: q.coins || 0, quests: view(u), profile: profileOut(u) };
    },
  };

  async function handle(m) {
    const say = text => tg('sendMessage', { chat_id: m.chat.id, text, disable_web_page_preview: true });
    if (!admins().has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins (ADMIN_IDS) can manage partner quests.`);
    const [cmd, ...rest] = m.text.replace(/^\/quest(@\w+)?/, '').trim().split(/\s+/).filter(Boolean);
    const now = Date.now();
    if (!cmd || cmd === 'list') {
      const all = db.partners.filter(q => q.until > now - 7 * 864e5);
      return say((all.map(q => `#${q.id} ${q.until > now ? '🟢' : '⚪️'} ${q.title} · ${q.gems}💎 · ${q.chat ? 'verified ' + q.chat : 'open-to-claim'} · opens ${q.opens || 0} · claims ${q.claims || 0} · ${Math.max(0, Math.ceil((q.until - now) / 864e5))}d left`).join('\n') || 'No partner quests.')
        + '\n\n/quest add @channel <gems> <days> <title> · /quest add https://t.me/bot <gems> <days> <title> · /quest remove <id>');
    }
    if (cmd === 'remove') { const id = +rest[0]; const n = db.partners.length; db.partners = db.partners.filter(q => q.id !== id); persist(); return say(n === db.partners.length ? 'No such quest.' : `❌ Quest #${id} removed.`); }
    if (cmd === 'add') {
      const [target, g, d, ...words] = rest, gems = Math.max(1, Math.min(200, +g || 0)), days = Math.max(1, Math.min(90, +d || 0)), title = words.join(' ').slice(0, 80);
      if (!target || !+g || !+d || !title) return say('Usage: /quest add @channel <gems> <days> <title>');
      let chat = null, url = target;
      if (/^@\w{4,}$/.test(target)) { chat = target; url = `https://t.me/${target.slice(1)}`; }
      else if (/^https:\/\/t\.me\/(\w{4,})$/.test(target) && !/bot$/i.test(target)) { chat = '@' + target.split('/').pop(); }
      else if (!/^https:\/\//.test(target)) return say('Target must be @channel or an https:// link.');
      if (chat) {
        const me = await tg('getMe').catch(() => null);
        const mem = me && await tg('getChatMember', { chat_id: chat, user_id: me.id }).catch(() => null);
        if (!mem || !['administrator', 'creator'].includes(mem.status)) return say(`⚠️ To verify members, add the game bot to ${chat} as an admin first (no rights needed), then try again.`);
      }
      const id = (db.partners.reduce((a, q) => Math.max(a, q.id), 0) || 0) + 1;
      db.partners.push({ id, title, url, chat, gems, coins: 0, until: now + days * 864e5, at: now, opens: 0, claims: 0 });
      persist();
      return say(`✅ Quest #${id} added: ${title} · ${gems}💎 · ${days} days · ${chat ? 'verified membership in ' + chat : 'open-to-claim'}`);
    }
    return say('/quest list · /quest add … · /quest remove <id>');
  }
  return { routes, handle, view };
};
