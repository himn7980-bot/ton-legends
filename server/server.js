// TON Legends — Telegram bot + game backend. Zero dependencies (Node 18+).
//
// Env vars:
//   BOT_TOKEN     (required) token from @BotFather
//   WEBAPP_URL    public https URL of this server, e.g. https://ton-legends.onrender.com
//                 (optional on Render: RENDER_EXTERNAL_URL is used automatically)
//   PORT          default 3000
//   DATA_FILE     default ./data/db.json
//   TELEGRAM_API  default https://api.telegram.org (overridable for tests)
//   ADMIN_IDS     comma-separated Telegram user ids allowed to upload fusion artwork through the bot (/art)
//   ART_DIR       where uploaded fusion art is stored (default: next to DATA_FILE, i.e. on the persistent disk)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ECON = require('../src/economy.js');
const createArena = require('./pvp.js');
const createClans = require('./clans.js');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = (process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');
// Live diagnostics, exposed at GET /api/status (no secrets).
const diag = { startedAt: new Date().toISOString(), bot: null, webappUrl: WEBAPP_URL || null,
  webappUrlOk: /^https:\/\/[^/\s]+/.test(WEBAPP_URL), setupError: null, lastPollAt: null, lastPollError: null,
  lastUpdateAt: null, updatesHandled: 0, lastHandleError: null, lastSendError: null };
function logErr(key, e) { diag[key] = `${new Date().toISOString()} ${e.message}`; console.error(key, e.message); }
const PORT = +process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const TG = (process.env.TELEGRAM_API || 'https://api.telegram.org') + '/bot' + BOT_TOKEN + '/';
const TG_FILES = (process.env.TELEGRAM_API || 'https://api.telegram.org') + '/file/bot' + BOT_TOKEN + '/';
const STATIC_DIR = path.join(__dirname, '..', 'src');
const ADMIN_IDS = new Set(String(process.env.ADMIN_IDS || '').split(/[\s,]+/).filter(Boolean));
const ART_DIR = process.env.ART_DIR || path.join(path.dirname(DATA_FILE), 'art');
const E = require('../src/engine.js');
const REF_INVITER = 500, REF_NEWCOMER = 300;

// Coin packs sold for Telegram Stars (currency XTR). Server is the source of truth for prices.
// Gem packs sold for Telegram Stars (currency XTR). Coins come from gems via the in-game exchange.
const PACKS = [
  { id: 'gems_s', gems: 50, stars: 25 },
  { id: 'gems_m', gems: 170, stars: 75 },
  { id: 'gems_l', gems: 500, stars: 200 },
];
// Older coin packs: only honoured if a payment for one arrives after the switch.
const OLD_PACKS = [{ id: 'coins_s', coins: 3000, stars: 25 }, { id: 'coins_m', coins: 10000, stars: 75 }, { id: 'coins_l', coins: 30000, stars: 200 }];
const findPack = id => PACKS.find(p => p.id === id) || OLD_PACKS.find(p => p.id === id);

// Bot texts: Persian for Telegram users with a Persian UI, English for everyone else.
const TEXT = {
  en: {
    start: '⚔️ Welcome to TON Legends!\n\nCollect hero cards, build your team and battle boss cards across 5 worlds.\n\nTap the button below to start 👇',
    play: '🎮 Play', open: '🎮 Open game', menu: '🎮 Play',
    paid: c => `✅ Payment successful! ${c.toLocaleString('en-US')} coins were added. Open the game to collect them.`,
    paidGems: g => `✅ Payment successful! ${g} 💎 gems were added to your account.`,
    packTitle: c => `${c.toLocaleString('en-US')} coins`, packDesc: c => `${c.toLocaleString('en-US')} coins for TON Legends`,
    cmd: 'Play TON Legends',
    arena: e => e.result === 'win' ? `🏆 You won the arena duel vs ${e.opp}! +${e.pot.toLocaleString('en-US')} coins.`
      : e.result === 'lose' ? `💔 You lost the arena duel vs ${e.opp} (-${e.stake.toLocaleString('en-US')} coins).` : `🤝 Arena duel vs ${e.opp} was a draw — your stake was returned.`,
  },
  fa: {
    start: '⚔️ به TON Legends خوش آمدی!\n\nکارت‌های قهرمان را جمع کن، تیمت را بچین و در ۵ دنیا با کارت‌های رئیس بجنگ.\n\nبرای شروع روی دکمه‌ی زیر بزن 👇',
    play: '🎮 شروع بازی', open: '🎮 ورود به بازی', menu: '🎮 بازی',
    paid: c => `✅ پرداخت موفق! ${c.toLocaleString('fa-IR')} سکه به حسابت اضافه شد. بازی را باز کن تا دریافت کنی.`,
    paidGems: g => `✅ پرداخت موفق! ${g.toLocaleString('fa-IR')} جم 💎 به حسابت اضافه شد.`,
    packTitle: c => `${c.toLocaleString('fa-IR')} سکه`, packDesc: c => `${c.toLocaleString('fa-IR')} سکه برای بازی TON Legends`,
    cmd: 'شروع بازی TON Legends',
    arena: e => e.result === 'win' ? `🏆 دوئل آرنا را از ${e.opp} بردی! +${e.pot.toLocaleString('fa-IR')} سکه.`
      : e.result === 'lose' ? `💔 دوئل آرنا را به ${e.opp} باختی (-${e.stake.toLocaleString('fa-IR')} سکه).` : `🤝 دوئل آرنا با ${e.opp} مساوی شد و سکه‌هایت برگشت.`,
  },
};
// Short bot texts for the other game languages (fall back to English for anything missing).
const MORE = {
  ru: ['⚔️ Добро пожаловать в TON Legends!\n\nСобирай карты героев, собирай команду, сражайся с боссами в 5 мирах и бросай вызов игрокам на арене.\n\nНажми кнопку ниже 👇', '🎮 Играть', 'Играть в TON Legends', 'монет', 'Оплата прошла! Монеты добавлены', 'Дуэль на арене против', 'победа', 'поражение', 'ничья — ставка возвращена'],
  ar: ['⚔️ مرحبًا بك في TON Legends!\n\nاجمع بطاقات الأبطال، كوّن فريقك، قاتل الزعماء في 5 عوالم وتحدَّ اللاعبين في الساحة.\n\nاضغط الزر بالأسفل 👇', '🎮 العب', 'العب TON Legends', 'عملة', 'تم الدفع! أُضيفت العملات', 'مبارزة الساحة ضد', 'فوز', 'خسارة', 'تعادل — أُعيد الرهان'],
  tr: ['⚔️ TON Legends’a hoş geldin!\n\nKahraman kartları topla, takımını kur, 5 dünyada boss’larla savaş ve arenada oyunculara meydan oku.\n\nAşağıdaki butona dokun 👇', '🎮 Oyna', 'TON Legends oyna', 'coin', 'Ödeme başarılı! Coin’ler eklendi', 'Arena düellosu, rakip:', 'galibiyet', 'yenilgi', 'berabere — bahis iade edildi'],
  es: ['⚔️ ¡Bienvenido a TON Legends!\n\nColecciona cartas de héroes, arma tu equipo, vence a los jefes de 5 mundos y reta a jugadores en la arena.\n\nToca el botón 👇', '🎮 Jugar', 'Jugar a TON Legends', 'monedas', '¡Pago completado! Monedas añadidas', 'Duelo de arena contra', 'victoria', 'derrota', 'empate — apuesta devuelta'],
  pt: ['⚔️ Bem-vindo ao TON Legends!\n\nColecione cartas de heróis, monte seu time, vença chefes em 5 mundos e desafie jogadores na arena.\n\nToque no botão 👇', '🎮 Jogar', 'Jogar TON Legends', 'moedas', 'Pagamento concluído! Moedas adicionadas', 'Duelo na arena contra', 'vitória', 'derrota', 'empate — aposta devolvida'],
  fr: ['⚔️ Bienvenue dans TON Legends !\n\nCollectionne des cartes de héros, forme ton équipe, bats les boss de 5 mondes et défie des joueurs dans l’arène.\n\nTouche le bouton 👇', '🎮 Jouer', 'Jouer à TON Legends', 'pièces', 'Paiement réussi ! Pièces ajoutées', 'Duel d’arène contre', 'victoire', 'défaite', 'égalité — mise rendue'],
  de: ['⚔️ Willkommen bei TON Legends!\n\nSammle Heldenkarten, stell dein Team zusammen, besiege Bosse in 5 Welten und fordere Spieler in der Arena heraus.\n\nTippe auf den Button 👇', '🎮 Spielen', 'TON Legends spielen', 'Münzen', 'Zahlung erfolgreich! Münzen gutgeschrieben', 'Arenaduell gegen', 'Sieg', 'Niederlage', 'Unentschieden — Einsatz zurück'],
  id: ['⚔️ Selamat datang di TON Legends!\n\nKoleksi kartu pahlawan, susun timmu, kalahkan bos di 5 dunia, dan tantang pemain di arena.\n\nKetuk tombol di bawah 👇', '🎮 Main', 'Main TON Legends', 'koin', 'Pembayaran berhasil! Koin ditambahkan', 'Duel arena melawan', 'menang', 'kalah', 'seri — taruhan dikembalikan'],
  uk: ['⚔️ Ласкаво просимо до TON Legends!\n\nЗбирай карти героїв, створюй команду, перемагай босів у 5 світах і кидай виклик гравцям на арені.\n\nНатисни кнопку нижче 👇', '🎮 Грати', 'Грати в TON Legends', 'монет', 'Оплата пройшла! Монети додано', 'Дуель на арені проти', 'перемога', 'поразка', 'нічия — ставку повернено'],
  hi: ['⚔️ TON Legends में स्वागत है!\n\nहीरो कार्ड जमा करो, टीम बनाओ, 5 दुनिया के बॉस हराओ और अखाड़े में खिलाड़ियों को चुनौती दो।\n\nनीचे बटन दबाओ 👇', '🎮 खेलें', 'TON Legends खेलें', 'सिक्के', 'भुगतान सफल! सिक्के जोड़ दिए गए', 'अखाड़ा मुक़ाबला बनाम', 'जीत', 'हार', 'बराबरी — दाँव वापस'],
  zh: ['⚔️ 欢迎来到 TON Legends！\n\n收集英雄卡，组建队伍，挑战5个世界的首领，并在竞技场与玩家对决。\n\n点击下方按钮 👇', '🎮 开始游戏', '开始 TON Legends', '金币', '支付成功！金币已到账', '竞技场对决 vs', '胜利', '失败', '平局——押注已退还'],
  uz: ['⚔️ TON Legends’ga xush kelibsan!\n\nQahramon kartalarini yigʻ, jamoa tuz, 5 dunyoda bosslarni yeng va arenada oʻyinchilarni duelga chaqir.\n\nPastdagi tugmani bos 👇', '🎮 Oʻynash', 'TON Legends oʻynash', 'tanga', 'Toʻlov bajarildi! Tangalar qoʻshildi', 'Arena dueli, raqib:', 'gʻalaba', 'magʻlubiyat', 'durang — tikish qaytarildi'],
};
for (const [code, [start, play, cmd, coins, paid, duel, win, lose, draw]] of Object.entries(MORE)) {
  const fmt = n => n.toLocaleString('en-US');
  TEXT[code] = { ...TEXT.en, start, play, open: play, menu: play, cmd,
    paid: c => `✅ ${paid}: +${fmt(c)} ${coins}.`, paidGems: g => `✅ ${paid}: +${fmt(g)} 💎`, packTitle: c => `${fmt(c)} ${coins}`, packDesc: c => `TON Legends · ${fmt(c)} ${coins}`,
    arena: e => `${e.result === 'win' ? '🏆' : e.result === 'lose' ? '💔' : '🤝'} ${duel} ${e.opp}: ${e.result === 'win' ? `${win} +${fmt(e.pot)} ${coins}` : e.result === 'lose' ? `${lose} -${fmt(e.stake)} ${coins}` : draw}` };
}
const tx = lang => TEXT[String(lang || '').toLowerCase().slice(0, 2)] || TEXT.en;

if (!BOT_TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }

// ---------- storage (single JSON file, atomic writes) ----------
let db = { users: {}, payments: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch (e) {}
// Writes are batched: at most one async write per second, and never two at once (atomic tmp + rename).
let saveTimer = null, saving = false, dirty = false;
function persist() {
  dirty = true;
  if (saveTimer || saving) return;
  saveTimer = setTimeout(flushDb, 1000);
}
async function flushDb() {
  saveTimer = null;
  if (!dirty) return;
  dirty = false; saving = true;
  try {
    await fs.promises.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(db));
    await fs.promises.rename(tmp, DATA_FILE);
  } catch (e) { console.error('save failed', e.message); dirty = true; }
  saving = false;
  if (dirty) persist();
}
// Save before the process exits (e.g. on redeploy).
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  try { const tmp = DATA_FILE + '.tmp'; fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DATA_FILE); } catch (e) {}
  process.exit(0);
});
function userRec(tgUser) {
  const id = String(tgUser.id);
  const u = db.users[id] || (db.users[id] = { id, pending: 0, gift: 0, refBy: null, refs: 0, created: Date.now(), profile: null });
  u.name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 40) || tgUser.username || 'Player';
  u.username = tgUser.username || null;
  u.seen = Date.now();
  if (u.profile) u.profile = ECON.normalize(u.profile, Date.now());
  return u;
}
// Coins from purchases/referrals go straight into the server profile (or wait until it exists);
// `gift` remembers how much to announce to the player next time they open the game.
function credit(u, coins, gems = 0) {
  if (u.profile) { u.profile.coins += coins; u.profile.gems = (u.profile.gems || 0) + gems; }
  else { u.pending += coins; u.pendingGems = (u.pendingGems || 0) + gems; }
  u.gift = (u.gift || 0) + coins; u.giftGems = (u.giftGems || 0) + gems;
}
const rng = () => crypto.randomInt(2 ** 32) / 2 ** 32;
// Limited editions: each fusion card has a worldwide supply; copies are numbered #1…#supply.
if (db.mint) ECON.migrateIds(db.mint);
function mint(id, supply) {
  db.mint = db.mint || {};
  const next = (db.mint[id] || 0) + 1;
  if (next > supply) throw Object.assign(new Error('sold_out'), { code: 400 });
  db.mint[id] = next;
  return next;
}
const profileOut = u => ECON.pickKeys(u.profile);

// ---------- fusion artwork (uploaded by the admin through the bot) ----------
// Files live in ART_DIR as <number>.<ext>; the game asks /api/health which numbers exist and loads /art/<number>.
const ART_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ART_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let artIndex = {};
function scanArt() {
  artIndex = {};
  try {
    for (const f of fs.readdirSync(ART_DIR)) {
      const m = /^(\d+)(\.\w+)$/.exec(f);
      if (m && ART_EXT.includes(m[2].toLowerCase())) artIndex[m[1]] = { file: f, v: Math.floor(fs.statSync(path.join(ART_DIR, f)).mtimeMs / 1000) };
    }
  } catch (e) {}
}
scanArt();
const artVersions = () => Object.fromEntries(Object.entries(artIndex).map(([k, x]) => [k, x.v]));
const fusionByNum = num => E.FUSIONS.find(f => f.num === num);
const fusionLabel = f => `#${f.num} ${f.name}${f.name.includes('×') ? '' : ` (${f.parts.map(p => E.HERO_BY_ID[p].name).join(' × ')})`}`;
function nextMissingArt(after = 0) {
  for (let i = 1; i <= E.FUSIONS.length; i++) { const num = ((after + i - 1) % E.FUSIONS.length) + 1; if (!artIndex[num]) return num; }
  return null;
}
async function saveArt(num, fileId, ext) {
  const f = await tg('getFile', { file_id: fileId });
  const r = await fetch(`${TG_FILES}${f.file_path}`);
  if (!r.ok) throw new Error('download failed ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.mkdirSync(ART_DIR, { recursive: true });
  for (const e of ART_EXT) { try { fs.unlinkSync(path.join(ART_DIR, num + e)); } catch (err) {} }
  fs.writeFileSync(path.join(ART_DIR, num + ext), buf);
  scanArt();
}
async function handleArt(m) {
  const say = text => tg('sendMessage', { chat_id: m.chat.id, text });
  const u = userRec(m.from), total = E.FUSIONS.length;
  if (!ADMIN_IDS.has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}.\nTo upload fusion art, add it to ADMIN_IDS in Render (Environment) and redeploy.`);
  const text = (m.text || m.caption || '').trim();
  const cmd = /^\/art(?:@\w+)?(?:\s+(\d+))?$/.exec(m.text ? text : '');
  const doneCount = () => Object.keys(artIndex).length;
  const promptNext = num => {
    u.artNext = num; persist();
    if (!num) return say(`🎉 All ${total} fusion images are uploaded!`);
    const f = fusionByNum(num);
    return say(`🎨 Fusion art: ${doneCount()}/${total} uploaded.\nNext: ${fusionLabel(f)}\nParts: ${f.parts.map(p => E.HERO_BY_ID[p].name).join(' + ')}\n\nSend the picture now (photo or file). To pick another card, write its number in the caption, name the file e.g. ${num}.png, or send /art <number>.`);
  };
  if (cmd) return promptNext(cmd[1] ? Math.min(total, Math.max(1, +cmd[1])) : nextMissingArt(0));
  if (/^\/artdel\s+\d+$/.test(text)) {
    const num = +text.split(/\s+/)[1];
    for (const e of ART_EXT) { try { fs.unlinkSync(path.join(ART_DIR, num + e)); } catch (err) {} }
    scanArt(); return say(`🗑️ #${num} removed (${doneCount()}/${total}).`);
  }
  if (text === '/artlist') {
    const missing = E.FUSIONS.filter(f => !artIndex[f.num]).map(f => f.num);
    const ranges = []; for (const x of missing) { const last = ranges[ranges.length - 1]; if (last && last[1] === x - 1) last[1] = x; else ranges.push([x, x]); }
    return say(`🎨 ${doneCount()}/${total} uploaded.\nMissing: ${ranges.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(', ').slice(0, 3500) || 'none'}`);
  }
  // A picture: photo (largest size) or an image file.
  let fileId = null, ext = '.jpg', name = '';
  if (m.photo && m.photo.length) fileId = m.photo[m.photo.length - 1].file_id;
  else if (m.document && /^image\//.test(m.document.mime_type || '')) {
    fileId = m.document.file_id; name = m.document.file_name || '';
    const e = path.extname(name).toLowerCase(); ext = ART_EXT.includes(e) ? (e === '.jpeg' ? '.jpg' : e) : '.jpg';
  }
  if (!fileId) return false;
  // Which card? caption number → file name number → the card the bot asked for.
  const num = +(/^\s*#?(\d+)/.exec(m.caption || '') || /^(\d+)/.exec(name) || [])[1] || u.artNext || nextMissingArt(0);
  const f = fusionByNum(num);
  if (!f) return say(`❌ ${num} is not a fusion number (1–${total}).`);
  await saveArt(num, fileId, ext);
  await say(`✅ Saved ${fusionLabel(f)} (${doneCount()}/${total}).`);
  return promptNext(nextMissingArt(num));
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
    const pack = findPack(packId);
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
    const pack = findPack(packId);
    if (!pack) return;
    const u = userRec(m.from);
    if (String(u.id) !== uid) return;
    credit(u, pack.coins || 0, pack.gems || 0);
    db.payments[chargeId] = { uid, pack: packId, stars: p.total_amount, at: Date.now() };
    persist();
    const L = tx(m.from.language_code);
    await tg('sendMessage', { chat_id: m.chat.id, text: pack.gems ? L.paidGems(pack.gems) : L.paid(pack.coins),
      reply_markup: { inline_keyboard: [[{ text: L.open, web_app: { url: WEBAPP_URL } }]] } });
    return;
  }
  if ((typeof m.text === 'string' && /^\/art/.test(m.text)) || ((m.photo || m.document) && ADMIN_IDS.has(String(m.from.id)))) {
    await handleArt(m);
    return;
  }
  if (typeof m.text === 'string' && m.text.startsWith('/start')) {
    const arg = m.text.split(' ')[1] || '';
    if (arg.startsWith('ref_')) applyReferral(userRec(m.from), arg);
    const url = WEBAPP_URL;
    const L = tx(m.from.language_code);
    try {
      await tg('sendMessage', { chat_id: m.chat.id, text: L.start, reply_markup: { inline_keyboard: [[{ text: L.play, web_app: { url } }]] } });
    } catch (e) {
      // Usually a missing/invalid WEBAPP_URL (Telegram requires https). Reply anyway so the bot never looks dead.
      logErr('lastSendError', e);
      await tg('sendMessage', { chat_id: m.chat.id, text: `${L.start}\n\n⚠️ Game link is not configured (WEBAPP_URL). ${url || ''}`.trim() });
    }
  }
}

const REF_MIN_STAGES = 5;
function payReferral(u) {
  if (!u.refBy || u.refPaid || !u.profile || u.profile.cleared < REF_MIN_STAGES) return;
  const inviter = db.users[u.refBy];
  u.refPaid = true;
  if (inviter) credit(inviter, REF_INVITER);
}
function applyReferral(u, startParam) {
  if (!startParam || !startParam.startsWith('ref_') || u.refBy) return false;
  const inviterId = startParam.slice(4);
  const inviter = db.users[inviterId];
  if (!inviter || inviterId === u.id) return false;
  if (u.created < Date.now() - 10 * 60e3 && u.profile && u.profile.cleared > 0) return false; // only fresh players count
  // The newcomer's gift is immediate; the inviter is paid once the newcomer has really played (see payReferral).
  u.refBy = inviterId; credit(u, REF_NEWCOMER);
  inviter.refs++;
  persist();
  return true;
}

let polling = true;
async function pollLoop() {
  let offset = 0;
  while (polling) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'pre_checkout_query'] });
      diag.lastPollAt = new Date().toISOString(); diag.lastPollError = null;
      for (const up of ups) {
        offset = up.update_id + 1;
        diag.lastUpdateAt = new Date().toISOString(); diag.updatesHandled++;
        try { await handleUpdate(up); } catch (e) { logErr('lastHandleError', e); }
      }
    } catch (e) {
      logErr('lastPollError', e);
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
  const all = Object.values(db.users).filter(u => u.profile && u.profile.cleared > 0)
    .map(u => ({ id: u.id, name: u.name, stage: u.profile.cleared, pvp: u.profile.stats.pvpWins || 0, power: ECON.teamPower(u.profile), seen: u.seen }))
    .sort((a, b) => b.stage - a.stage || b.pvp - a.pvp || b.power - a.power || a.seen - b.seen);
  const top = all.slice(0, 50).map((u, i) => ({ rank: i + 1, name: u.name, stage: u.stage, pvp: u.pvp }));
  const idx = all.findIndex(u => u.id === meId);
  return { top, total: all.length, me: idx >= 0 ? { rank: idx + 1, stage: all[idx].stage } : null };
}

const clans = createClans({ db, persist, profileOut: u => (u.profile ? ECON.pickKeys(u.profile) : null) });
const arena = createArena({ db, persist, onPoints: clans.addPoints, notify: (uid, end) => {
  const u = db.users[uid];
  const L = tx(u && u.lang);
  if (end.result === 'cancelled') return;
  tg('sendMessage', { chat_id: Number(uid), text: L.arena(end) }).catch(e => logErr('lastSendError', e));
} });

const routes = {
  'GET /api/health': () => ({ ok: true, bot: BOT_USERNAME, packs: PACKS, mint: db.mint || {}, art: artVersions() }),
  'GET /api/status': () => ({ ...diag, bot: BOT_USERNAME, users: Object.keys(db.users).length, node: process.version }),
  'POST /api/hello': (body, u) => { applyReferral(u, body.startParam); return { ok: true }; },
  // The server keeps each Telegram player's coins and heroes. First visit imports the offline save (clamped).
  'POST /api/profile': (body, u) => {
    if (!u.profile) { u.profile = ECON.importLocal(body.local, Date.now()); u.profile.coins += u.pending; u.profile.gems += u.pendingGems || 0; u.pending = 0; u.pendingGems = 0; }
    return { profile: profileOut(u) };
  },
  'POST /api/act': (body, u) => {
    if (!u.profile) throw Object.assign(new Error('no_profile'), { code: 400 });
    const result = ECON.act(u.profile, body.action, { now: Date.now(), rng, mint });
    payReferral(u);
    if (body.action && body.action.type === 'stageEnd' && result && result.result === 'win' && result.first) clans.addPoints(u.id, 2);
    return { profile: profileOut(u), result };
  },
  'POST /api/score': () => ({ ok: true }), // kept for older clients; leaderboard now uses server profiles
  'POST /api/leaderboard': (body, u) => leaderboard(u.id),
  'POST /api/claim': (body, u) => { const coins = u.gift || 0, gems = u.giftGems || 0; u.gift = 0; u.giftGems = 0; return { ok: true, coins, gems, profile: u.profile ? profileOut(u) : null }; },
  ...arena.routes,
  ...clans.routes,
  'POST /api/invoice': async (body, u) => {
    const pack = PACKS.find(p => p.id === body.pack);
    if (!pack) throw Object.assign(new Error('unknown pack'), { code: 400 });
    const title = `${pack.gems} 💎`;
    const link = await tg('createInvoiceLink', {
      title: `TON Legends · ${title}`, description: `TON Legends · ${title}`,
      payload: `${u.id}:${pack.id}`, currency: 'XTR', prices: [{ label: title, amount: pack.stars }],
    });
    return { link };
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const key = `${req.method} ${url.pathname}`;
  if (key === 'GET /api/pvp/stream') return arena.stream(req, res, url.searchParams.get('ticket'));
  const artM = req.method === 'GET' && /^\/art\/(\d+)$/.exec(url.pathname);
  if (artM) {
    const a = artIndex[artM[1]];
    if (!a) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': ART_MIME[path.extname(a.file).toLowerCase()], 'Cache-Control': 'public, max-age=604800' });
    return fs.createReadStream(path.join(ART_DIR, a.file)).pipe(res);
  }
  const handler = routes[key];
  if (!handler) return url.pathname.startsWith('/api/') ? send(res, 404, { error: 'not found' }) : serveStatic(req, res);
  try {
    if (req.method === 'GET') return send(res, 200, await handler());
    const body = await readBody(req);
    const tgUser = verifyInitData(body.initData);
    if (!tgUser || !tgUser.id) return send(res, 401, { error: 'invalid initData' });
    const u = userRec(tgUser);
    if (body.lang === 'fa' || body.lang === 'en') u.lang = body.lang;
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
    for (const code of Object.keys(TEXT).filter(c => c !== 'en')) await tg('setMyCommands', { commands: [{ command: 'start', description: TEXT[code].cmd }], language_code: code });
  } catch (e) { logErr('setupError', e); }
}
async function start() {
  server.listen(PORT, () => console.log(`TON Legends server on :${PORT}`));
  await setupBot();
  pollLoop();
}

if (require.main === module) start();
module.exports = { flushDb, server, verifyInitData, handleUpdate, pollLoop, setupBot, db, PACKS, stop: () => { polling = false; arena.stop(); server.close(); } };
