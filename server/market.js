// TON Legends — market mood. Every 30 minutes the server reads the 24h price change of the heroes that have a
// token (CoinGecko, free API, no key) and, for the others, compares their community's war points of yesterday
// with the day before. The result ({ id: { change, src, sym } }) drives the moods in economy.js.
//   MARKET_TOKENS="notcoin=notcoin:NOT,dog=dogs-2:DOGS"   hero=coingecko-id:SYMBOL (add more without code changes)
const ECON = require('../src/economy.js');
const E = require('../src/engine.js');

const DEFAULT_TOKENS = 'notcoin=notcoin:NOT,dog=dogs-2:DOGS';
const REFRESH_MS = 30 * 60e3, STALE_MS = 6 * 3600e3;
const ACTIVITY_MIN = 20; // below this many points a day, a community's swing is just noise → calm

function parseTokens(spec) {
  const out = {};
  for (const part of String(spec || '').split(',')) {
    const m = /^\s*([a-z]+)\s*=\s*([a-z0-9-]+)(?::([A-Za-z0-9]+))?\s*$/.exec(part);
    if (m && E.HERO_BY_ID[m[1]] && !E.HERO_BY_ID[m[1]].fusion) out[m[1]] = { cg: m[2], sym: (m[3] || m[2]).toUpperCase() };
  }
  return out;
}

module.exports = function createMarket({ db, persist, api, tokens = process.env.MARKET_TOKENS || DEFAULT_TOKENS, logErr = () => {} }) {
  db.market = db.market || { at: 0, prices: {}, activity: {} };
  const TOKENS = parseTokens(tokens);
  let moods = {};

  // Community activity per UTC day (only the last few days are kept).
  function addActivity(faction, pts) {
    if (!faction || !(pts > 0)) return;
    const d = ECON.day(Date.now());
    const a = db.market.activity[d] || (db.market.activity[d] = {});
    a[faction] = (a[faction] || 0) + pts;
    for (const k of Object.keys(db.market.activity)) if (k < ECON.day(Date.now(), -3)) delete db.market.activity[k];
  }

  function compute(now = Date.now()) {
    const y = db.market.activity[ECON.day(now, -1)] || {}, d2 = db.market.activity[ECON.day(now, -2)] || {};
    const out = {};
    for (const h of E.BASE_HEROES) {
      const pr = db.market.prices[h.id];
      if (TOKENS[h.id] && pr && now - pr.at < STALE_MS) { out[h.id] = { change: +pr.change.toFixed(2), src: 'token', sym: TOKENS[h.id].sym }; continue; }
      const a = y[h.id] || 0, b = d2[h.id] || 0;
      const change = Math.max(a, b) < ACTIVITY_MIN ? 0 : Math.max(-50, Math.min(50, (a - b) / Math.max(b, ACTIVITY_MIN) * 100));
      out[h.id] = { change: +change.toFixed(2), src: 'activity' };
    }
    moods = out;
    return out;
  }

  async function refresh() {
    const ids = Object.values(TOKENS).map(t => t.cg);
    if (ids.length && api) {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 10e3);
      try {
        const r = await fetch(`${api}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd&include_24hr_change=true`, { signal: ctl.signal, headers: { accept: 'application/json' } });
        if (!r.ok) throw new Error(`market: HTTP ${r.status}`);
        const j = await r.json();
        for (const [hero, t] of Object.entries(TOKENS)) {
          const q = j[t.cg];
          if (q && typeof q.usd_24h_change === 'number') db.market.prices[hero] = { change: q.usd_24h_change, usd: q.usd, at: Date.now() };
        }
        db.market.at = Date.now();
        persist();
      } catch (e) { logErr('lastMarketError', e); } finally { clearTimeout(to); }
    }
    return compute();
  }
  compute();
  const timer = setInterval(refresh, REFRESH_MS);
  // Moods also roll over at midnight UTC (activity is per day) without waiting for the next refresh.
  const dayTimer = setInterval(() => compute(), 5 * 60e3);
  return { moods: () => moods, refresh, compute, addActivity, tokens: TOKENS, stop: () => { clearInterval(timer); clearInterval(dayTimer); } };
};
module.exports.parseTokens = parseTokens;
