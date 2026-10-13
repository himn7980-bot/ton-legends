// TON Legends — bot reminders. A sweep every 10 minutes queues at most one message of each kind per player;
// the queue sends ~15 messages per second (well under Telegram's limit). Players can turn reminders off in
// Settings, and anyone who blocked the bot is skipped until they open the game again.
const ECON = require('../src/economy.js');
const BOT_TEXT = require('./bot-text.js');

const ACTIVE_DAYS = 14; // only remind players who played in the last two weeks
const STREAK_HOUR = 16; // UTC hour after which a "keep your streak" reminder may go out

module.exports = function createNotifier({ db, persist, tg, webappUrl, logErr = () => {} }) {
  const queue = [];
  const textFor = u => BOT_TEXT[u.lang] || BOT_TEXT[String(u.tgLang || '').slice(0, 2)] || BOT_TEXT.en;
  function enqueue(uid, make) { queue.push({ uid: String(uid), make }); }

  const pump = setInterval(async () => {
    const job = queue.shift();
    if (!job) return;
    const u = db.users[job.uid];
    if (!u || u.mute || u.blocked) return;
    const L = textFor(u), text = job.make(L);
    if (!text) return;
    try {
      await tg('sendMessage', { chat_id: Number(job.uid), text, reply_markup: webappUrl() ? { inline_keyboard: [[{ text: L.open, web_app: { url: webappUrl() } }]] } : undefined });
    } catch (e) {
      if (/403|blocked|deactivated|chat not found/i.test(e.message)) { u.blocked = true; persist(); } else logErr('lastSendError', e);
    }
  }, 66);

  function sweep(now = Date.now()) {
    const today = ECON.day(now), yesterday = ECON.day(now, -1), hour = new Date(now).getUTCHours();
    for (const u of Object.values(db.users)) {
      const p = u.profile;
      if (!p || u.mute || u.blocked || now - (u.seen || 0) > ACTIVE_DAYS * 864e5) continue;
      // Idle chest full.
      if (now - (p.afkSince || now) >= ECON.AFK_CAP_H * 3600e3 && u.nAfk !== p.afkSince && (u.seen || 0) < p.afkSince + ECON.AFK_CAP_H * 3600e3) {
        u.nAfk = p.afkSince;
        const coins = ECON.afkAmount(p, now);
        enqueue(u.id, L => L.afk(coins));
      }
      // Login streak about to break.
      if (p.daily && p.daily.last === yesterday && p.daily.streak >= 2 && hour >= STREAK_HOUR && u.nDaily !== today) {
        u.nDaily = today;
        const next = p.daily.streak % 7 + 1;
        enqueue(u.id, L => L.streak(next));
      }
    }
    persist();
  }
  const timer = setInterval(() => { try { sweep(); } catch (e) { logErr('lastHandleError', e); } }, 10 * 60e3);

  // Week over: tell everyone who took part how their community did.
  function weekEnded(last) {
    for (const u of Object.values(db.users)) {
      const p = u.profile;
      if (!p || !p.faction || !u.war || u.war.week !== last.week || u.war.pts <= 0) continue;
      const place = last.rank.indexOf(p.faction) + 1, name = (require('../src/engine.js').HERO_BY_ID[p.faction] || {}).name || p.faction;
      enqueue(u.id, L => L.warEnd(place, name));
    }
  }
  return { enqueue, sweep, weekEnded, queue, stop: () => { clearInterval(pump); clearInterval(timer); } };
};
