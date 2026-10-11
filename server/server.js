// TON Legends — Telegram bot + game backend. Zero dependencies (Node 18+).
//
// Env vars:
//   BOT_TOKEN     (required) token from @BotFather
//   WEBAPP_URL    (required) public https URL where this server is reachable, e.g. https://ton-legends.onrender.com
//   PORT          default 3000
//   DATA_FILE     default ./data/db.json
//   TELEGRAM_API  default https://api.telegram.org (overridable for tests)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = (process.env.WEBAPP_URL || '').replace(/\/$/, '');
const PORT = +process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const TG = (process.env.TELEGRAM_API || 'https://api.telegram.org') + '/bot' + BOT_TOKEN + '/';
const STATIC_DIR = path.join(__dirname, '..', 'src');
const MAX_STAGE = 50;
const REF_INVITER = 500, REF_NEWCOMER = 300;

// Coin packs sold for Telegram Stars (currency XTR). Server is the source of truth for prices.
const PACKS = [
  { id: 'coins_s', coins: 3000, stars: 25 },
  { id: 'coins_m', coins: 10000, stars: 75 },
  { id: 'coins_l', coins: 30000, stars: 200 },
];

// Bot texts: Persian for Telegram users with a Persian UI, English for everyone else.
const TEXT = {
  en: {
    start: '⚔️ Welcome to TON Legends!\n\nCollect hero cards, build your team and battle boss cards across 5 worlds.\n\nTap the button below to start 👇',
    play: '🎮 Play', open: '🎮 Open game', menu: '🎮 Play',
    paid: c => `✅ Payment successful! ${c.toLocaleString('en-US')} coins were added. Open the game to collect them.`,
    packTitle: c => `${c.toLocaleString('en-US')} coins`, packDesc: c => `${c.toLocaleString('en-US')} coins for TON Legends`,
    cmd: 'Play TON Legends',
  },
  fa: {
    start: '⚔️ به TON Legends خوش آمدی!\n\nکارت‌های قهرمان را جمع کن، تیمت را بچین و در ۵ دنیا با کارت‌های رئیس بجنگ.\n\nبرای شروع روی دکمه‌ی زیر بزن 👇',
    play: '🎮 شروع بازی', open: '🎮 ورود به بازی', menu: '🎮 بازی',
    paid: c => `✅ پرداخت موفق! ${c.toLocaleString('fa-IR')} سکه به حسابت اضافه شد. بازی را باز کن تا دریافت کنی.`,
    packTitle: c => `${c.toLocaleString('fa-IR')} سکه`, packDesc: c => `${c.toLocaleString('fa-IR')} سکه برای بازی TON Legends`,
    cmd: 'شروع بازی TON Legends',
  },
};
const tx = lang => (String(lang || '').startsWith('fa') ? TEXT.fa : TEXT.en);

if (!BOT_TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }

// ---------- storage (single JSON file, atomic writes) ----------
let db = { users: {}, payments: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch (e) {}
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DATA_FILE);
  }, 300);
}
function userRec(tgUser) {
  const id = String(tgUser.id);
  const u = db.users[id] || (db.users[id] = { id, stage: 0, power: 0, pending: 0, refBy: null, refs: 0, created: Date.now() });
  u.name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 40) || tgUser.username || 'Player';
  u.username = tgUser.username || null;
  u.seen = Date.now();
  return u;
}

// ---------- Telegram WebApp initData validation ----------
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const SECRET = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
function verifyInitData(initData, maxAgeSec = 86400) {
  if (!initData || typeof initData !== 'string') return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const calc = crypto.createHmac('sha256', SECRET).update(check).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const auth = +params.get('auth_date');
  if (!auth || Date.now() / 1000 - auth > maxAgeSec) return null;
  try { return JSON.parse(params.get('user')); } catch (e) { return null; }
}

// ---------- Telegram Bot API ----------
async function tg(method, body) {
  const r = await fetch(TG + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
}

let BOT_USERNAME = null;
async function handleUpdate(up) {
  if (up.pre_checkout_query) {
    const q = up.pre_checkout_query;
    const [uid, packId] = String(q.invoice_payload).split(':');
    const pack = PACKS.find(p => p.id === packId);
    const ok = !!pack && uid === String(q.from.id) && q.currency === 'XTR' && q.total_amount === pack.stars;
    await tg('answerPreCheckoutQuery', ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: 'Invalid order' });
    return;
  }
  const m = up.message;
  if (!m) return;
  if (m.successful_payment) {
    const p = m.successful_payment;
    const chargeId = p.telegram_payment_charge_id;
    if (db.payments[chargeId]) return; // idempotent
    const [uid, packId] = String(p.invoice_payload).split(':');
    const pack = PACKS.find(x => x.id === packId);
    if (!pack) return;
    const u = userRec(m.from);
    if (String(u.id) !== uid) return;
    u.pending += pack.coins;
    db.payments[chargeId] = { uid, pack: packId, stars: p.total_amount, at: Date.now() };
    persist();
    const L = tx(m.from.language_code);
    await tg('sendMessage', { chat_id: m.chat.id, text: L.paid(pack.coins),
      reply_markup: { inline_keyboard: [[{ text: L.open, web_app: { url: WEBAPP_URL } }]] } });
    return;
  }
  if (typeof m.text === 'string' && m.text.startsWith('/start')) {
    const arg = m.text.split(' ')[1] || '';
    if (arg.startsWith('ref_')) applyReferral(userRec(m.from), arg);
    const url = WEBAPP_URL;
    const L = tx(m.from.language_code);
    await tg('sendMessage', { chat_id: m.chat.id, text: L.start, reply_markup: { inline_keyboard: [[{ text: L.play, web_app: { url } }]] } });
  }
}

function applyReferral(u, startParam) {
  if (!startParam || !startParam.startsWith('ref_') || u.refBy) return false;
  const inviterId = startParam.slice(4);
  const inviter = db.users[inviterId];
  if (!inviter || inviterId === u.id) return false;
  if (u.created < Date.now() - 10 * 60e3 && u.stage > 0) return false; // only fresh players count
  u.refBy = inviterId; u.pending += REF_NEWCOMER;
  inviter.refs++; inviter.pending += REF_INVITER;
  persist();
  return true;
}

let polling = true;
async function pollLoop() {
  let offset = 0;
  while (polling) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] });
      for (const up of ups) {
        offset = up.update_id + 1;
        try { await handleUpdate(up); } catch (e) { console.error('update error', e.message); }
      }
    } catch (e) {
      console.error('poll error', e.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e5) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(STATIC_DIR, p));
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.jpg' ? 'public, max-age=86400' : 'no-cache' });
    res.end(buf);
  });
}

function leaderboard(meId) {
  const all = Object.values(db.users).filter(u => u.stage > 0).sort((a, b) => b.stage - a.stage || b.power - a.power || a.seen - b.seen);
  const top = all.slice(0, 50).map((u, i) => ({ rank: i + 1, name: u.name, stage: u.stage }));
  const idx = all.findIndex(u => u.id === meId);
  return { top, total: all.length, me: idx >= 0 ? { rank: idx + 1, stage: all[idx].stage } : null };
}

const routes = {
  'GET /api/health': () => ({ ok: true, bot: BOT_USERNAME, packs: PACKS }),
  'POST /api/hello': (body, u) => { applyReferral(u, body.startParam); return { ok: true, pending: u.pending }; },
  'POST /api/score': (body, u) => {
    const stage = Math.max(0, Math.min(MAX_STAGE, Math.floor(+body.stage || 0)));
    const power = Math.max(0, Math.min(1e7, Math.floor(+body.power || 0)));
    if (stage >= u.stage) { u.stage = stage; u.power = Math.max(u.power, power); }
    return { ok: true };
  },
  'POST /api/leaderboard': (body, u) => leaderboard(u.id),
  'POST /api/claim': (body, u) => { const coins = u.pending; u.pending = 0; return { ok: true, coins }; },
  'POST /api/invoice': async (body, u) => {
    const pack = PACKS.find(p => p.id === body.pack);
    if (!pack) throw Object.assign(new Error('unknown pack'), { code: 400 });
    const L = tx(body.lang);
    const link = await tg('createInvoiceLink', {
      title: `TON Legends · ${L.packTitle(pack.coins)}`, description: L.packDesc(pack.coins),
      payload: `${u.id}:${pack.id}`, currency: 'XTR', prices: [{ label: L.packTitle(pack.coins), amount: pack.stars }],
    });
    return { link };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];
  if (!handler) return url.pathname.startsWith('/api/') ? send(res, 404, { error: 'not found' }) : serveStatic(req, res);
  try {
    if (req.method === 'GET') return send(res, 200, await handler());
    const body = await readBody(req);
    const tgUser = verifyInitData(body.initData);
    if (!tgUser || !tgUser.id) return send(res, 401, { error: 'invalid initData' });
    const u = userRec(tgUser);
    const out = await handler(body, u);
    persist();
    send(res, 200, out);
  } catch (e) {
    send(res, e.code || 500, { error: e.message });
  }
});

async function setupBot() {
  try {
    const me = await tg('getMe');
    BOT_USERNAME = me.username;
    console.log('bot @' + BOT_USERNAME);
    await tg('deleteWebhook', {});
    if (WEBAPP_URL) await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: TEXT.en.menu, web_app: { url: WEBAPP_URL } } });
    await tg('setMyCommands', { commands: [{ command: 'start', description: TEXT.en.cmd }] });
    await tg('setMyCommands', { commands: [{ command: 'start', description: TEXT.fa.cmd }], language_code: 'fa' });
  } catch (e) { console.error('bot setup failed:', e.message); }
}
async function start() {
  server.listen(PORT, () => console.log(`TON Legends server on :${PORT}`));
  await setupBot();
  pollLoop();
}

if (require.main === module) start();
module.exports = { server, verifyInitData, handleUpdate, pollLoop, setupBot, db, PACKS, stop: () => { polling = false; server.close(); } };
