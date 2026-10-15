// TON Legends — game analytics for the owner (/stats in the bot, admins only).
// Daily counters are kept for 60 days; retention, the progress funnel and "where players quit" are computed from
// the user records on demand (fine for tens of thousands of players).
const DAY = 864e5;
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

module.exports = function createAnalytics({ db, persist }) {
  db.stats = db.stats || { days: {} };
  const today = () => { const d = day(); return db.stats.days[d] || (db.stats.days[d] = { active: 0, new: 0, battles: 0, wins: 0, stars: 0, payers: 0 }); };
  function prune() { for (const k of Object.keys(db.stats.days)) if (k < day(Date.now() - 60 * DAY)) delete db.stats.days[k]; }

  // Called on every request of a player: counts them once per day.
  function seen(u) {
    const d = day();
    if (u.lastDay === d) return;
    const t = today();
    if (!u.lastDay) t.new++;
    t.active++;
    u.lastDay = d; u.days = (u.days || 0) + 1;
    prune(); persist();
  }
  const battle = win => { const t = today(); t.battles++; if (win) t.wins++; };
  const payment = stars => { const t = today(); t.stars += stars; t.payers++; };

  function report(now = Date.now()) {
    const users = Object.values(db.users), players = users.filter(u => u.profile);
    const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : '—');
    // Rolling retention: of the players who joined at least N days ago, how many came back N+ days after joining.
    const ret = n => {
      const cohort = players.filter(u => u.created && now - u.created >= n * DAY);
      return { pct: pct(cohort.filter(u => (u.seen || 0) - u.created >= n * DAY).length, cohort.length), of: cohort.length };
    };
    const funnelAt = [['1st stage', p => p.cleared >= 1], ['stage 5', p => p.cleared >= 5], ['world 2', p => p.cleared >= 10], ['world 3', p => p.cleared >= 20],
      ['world 5', p => p.cleared >= 40], ['world 10', p => p.cleared >= 90], ['world 20', p => p.cleared >= 190],
      ['community', p => !!p.faction], ['fusion', p => Object.keys(p.owned).some(id => /^f\d+$/.test(id))], ['arena win', p => (p.stats.pvpWins || 0) > 0]];
    const funnel = funnelAt.map(([name, f]) => [name, pct(players.filter(u => f(u.profile)).length, players.length)]);
    // Where players stop: inactive for 3+ days, grouped by the stage they were stuck on (the next uncleared one).
    const gone = players.filter(u => now - (u.seen || 0) > 3 * DAY);
    const quit = {};
    for (const u of gone) { const s = Math.min(200, u.profile.cleared + 1); quit[s] = (quit[s] || 0) + 1; }
    const quitTop = Object.entries(quit).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const last = n => Array.from({ length: n }, (_, i) => db.stats.days[day(now - i * DAY)] || {});
    const sum = (arr, k) => arr.reduce((a, d) => a + (d[k] || 0), 0);
    const week = last(7), t0 = last(1)[0], t1 = last(2)[1];
    const starsAll = Object.values(db.payments || {}).reduce((a, p) => a + (p.stars || 0), 0);
    return { users: users.length, players: players.length, today: t0, yesterday: t1,
      week: { active: Math.round(sum(week, 'active') / 7), new: sum(week, 'new'), battles: sum(week, 'battles'), stars: sum(week, 'stars') },
      d1: ret(1), d7: ret(7), d30: ret(30), funnel, gone: gone.length, quitTop, starsAll };
  }

  function text(r = report()) {
    const n = x => Number(x || 0).toLocaleString('en-US');
    const winRate = d => (d && d.battles ? ` (${Math.round(d.wins / d.battles * 100)}% won)` : '');
    return [
      '📊 TON Legends — stats',
      '',
      `👥 Players: ${n(r.players)} (users ${n(r.users)})`,
      `📅 Today: ${n(r.today.active)} active · ${n(r.today.new)} new · ${n(r.today.battles)} battles${winRate(r.today)} · ⭐ ${n(r.today.stars)}`,
      `📅 Yesterday: ${n(r.yesterday.active)} active · ${n(r.yesterday.new)} new · ${n(r.yesterday.battles)} battles · ⭐ ${n(r.yesterday.stars)}`,
      `🗓 7 days: ~${n(r.week.active)} daily active · ${n(r.week.new)} new · ${n(r.week.battles)} battles · ⭐ ${n(r.week.stars)}`,
      '',
      `🔁 Came back after 1 day: ${r.d1.pct} (of ${n(r.d1.of)}) · 7 days: ${r.d7.pct} (of ${n(r.d7.of)}) · 30 days: ${r.d30.pct} (of ${n(r.d30.of)})`,
      '',
      '🪜 Reached: ' + r.funnel.map(([k, v]) => `${k} ${v}`).join(' · '),
      '',
      `🚪 Inactive 3+ days: ${n(r.gone)}` + (r.quitTop.length ? ` — stuck at: ${r.quitTop.map(([s, c]) => `stage ${s} (${n(c)})`).join(', ')}` : ''),
      `⭐ Stars all time: ${n(r.starsAll)}`,
    ].join('\n');
  }
  return { seen, battle, payment, report, text };
};
