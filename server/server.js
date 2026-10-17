// Gram Legends — Telegram bot + game backend. Zero dependencies (Node 18+).
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
const createWar = require('./war.js');
const createNotifier = require('./notify.js');
const createMarket = require('./market.js');
const createAnalytics = require('./analytics.js');
const createRunway = require('./runway.js');
const createBackup = require('./backup.js');
const createReferral = require('./referral.js');
const createRaid = require('./raid.js');
const createLeague = require('./league.js');
const createPartners = require('./partners.js');
const createWallet = require('./wallet.js');
const createFund = require('./fund.js');
const createSupport = require('./support.js');
const BOT_TEXT = require('./bot-text.js');

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

// Gem packs sold for Telegram Stars (currency XTR). Server is the source of truth for prices.
// Coins come from gems via the in-game exchange. Bigger packs give more gems per Star.
const PACKS = [
  { id: 'gems_s', gems: 50, stars: 25 },
  { id: 'gems_m', gems: 170, stars: 75 },
  { id: 'gems_l', gems: 500, stars: 200 },
  { id: 'gems_xl', gems: 1400, stars: 500 },
  { id: 'gems_xxl', gems: 3000, stars: 1000 },
  { id: 'gems_max', gems: 8000, stars: 2500 },
];
// One-time starter pack and the monthly Gram Club subscription (renewed by Telegram every 30 days).
const STARTER_PACK = { id: 'starter', stars: ECON.STARTER.stars, gems: ECON.STARTER.gems, coins: ECON.STARTER.coins, starter: true };
const CLUB_PACK = { id: 'club', stars: ECON.CLUB.stars, club: true };
// Older coin packs: only honoured if a payment for one arrives after the switch.
const OLD_PACKS = [{ id: 'coins_s', coins: 3000, stars: 25 }, { id: 'coins_m', coins: 10000, stars: 75 }, { id: 'coins_l', coins: 30000, stars: 200 }];
// The premium season pass is sold separately from the gem packs.
const NAME_GEMS = 20;
// Rewarded ads: the Adsgram block id (shown to the game) and the secret in the reward callback URL.
const ADS_BLOCK = process.env.ADSGRAM_BLOCK_ID || '', ADS_SECRET = process.env.ADS_SECRET || '';
// The game's own channel (e.g. @gramlegends): new players join it first and get a welcome reward once.
// The bot must be an admin of the channel to check membership; if it can't check, nobody is blocked.
// Default: the official channel. GAME_CHANNEL=off turns the requirement off; another @name replaces it.
const GAME_CHANNEL = (() => { const v = (process.env.GAME_CHANNEL || '@gramlegends_game').trim(); return !v || v === 'off' ? null : v; })(), CHANNEL_COINS = 500, CHANNEL_GEMS = 20;
// Is the bot an admin of the channel? Re-checked every 5 minutes (and when a player opens the game) until it is,
// so making the bot an admin later turns the join step on without a redeploy.
let BOT_ID = null;
async function checkChannel() {
  if (!GAME_CHANNEL) return false;
  diag.channel = GAME_CHANNEL; diag.channelAt = Date.now();
  if (!BOT_ID) { const me = await tg('getMe').catch(() => null); BOT_ID = me && me.id; }
  const mem = BOT_ID ? await tg('getChatMember', { chat_id: GAME_CHANNEL, user_id: BOT_ID }).catch(e => ({ error: e.message })) : { error: 'getMe failed' };
  diag.channelOk = !!(mem && ['administrator', 'creator'].includes(mem.status));
  diag.channelState = diag.channelOk ? 'ok' : (mem && (mem.error || mem.status)) || 'unknown';
  if (!diag.channelOk) logErr('channelError', new Error(`bot is not an admin of ${GAME_CHANNEL}: ${diag.channelState}`));
  return diag.channelOk;
}
const channelTimer = setInterval(() => { if (GAME_CHANNEL && diag.channelOk !== true) checkChannel().catch(() => {}); }, 5 * 60e3);
if (channelTimer.unref) channelTimer.unref();
const channelUrl = () => (GAME_CHANNEL ? (/^@/.test(GAME_CHANNEL) ? `https://t.me/${GAME_CHANNEL.slice(1)}` : GAME_CHANNEL) : null);
const channelInfo = u => (GAME_CHANNEL && /^@\w{4,}$/.test(GAME_CHANNEL) && diag.channelOk === true ? { url: channelUrl(), joined: !!u.chanJoined, coins: CHANNEL_COINS, gems: CHANNEL_GEMS } : null);
const PASS_PACK = { id: 'pass', stars: ECON.PASS.PRICE_STARS, pass: true };
// Card frames sold for Telegram Stars (cosmetic only).
const COS_PACKS = Object.entries(ECON.COSMETICS).filter(([, c]) => c.stars).map(([k, c]) => ({ id: 'cos_' + k, stars: c.stars, cos: k }));
const findPack = id => PACKS.find(p => p.id === id) || OLD_PACKS.find(p => p.id === id) || COS_PACKS.find(p => p.id === id) || ({ pass: PASS_PACK, starter: STARTER_PACK, club: CLUB_PACK })[id] || null;

// Bot texts: Persian for Telegram users with a Persian UI, English for everyone else.
const TEXT = {
  en: {
    start: '⚔️ Welcome to Gram Legends!\n\nCollect hero cards, build your team and battle boss cards across 20 worlds.\n\nTap the button below to start 👇',
    play: '🎮 Play', open: '🎮 Open game', menu: '🎮 Play', channel: 'Gram Legends channel',
    paid: c => `✅ Payment successful! ${c.toLocaleString('en-US')} coins were added. Open the game to collect them.`,
    paidGems: g => `✅ Payment successful! ${g} 💎 gems were added to your account.`,
    paidPass: '✅ Payment successful! Your premium Season Pass is unlocked — open the game to claim the rewards.',
    paidFrame: '✅ Payment successful! Your new card frame is unlocked — open the game to see it.',
    packTitle: c => `${c.toLocaleString('en-US')} coins`, packDesc: c => `${c.toLocaleString('en-US')} coins for Gram Legends`,
    cmd: 'Play Gram Legends',
    arena: e => e.result === 'win' ? `🏆 You won the arena duel vs ${e.opp}! +${e.pot.toLocaleString('en-US')} coins.`
      : e.result === 'lose' ? `💔 You lost the arena duel vs ${e.opp} (-${e.stake.toLocaleString('en-US')} coins).` : `🤝 Arena duel vs ${e.opp} was a draw — your stake was returned.`,
  },
  fa: {
    start: '⚔️ به Gram Legends خوش آمدی!\n\nکارت‌های قهرمان را جمع کن، تیمت را بچین و در ۲۰ دنیا با کارت‌های رئیس بجنگ.\n\nبرای شروع روی دکمه‌ی زیر بزن 👇',
    play: '🎮 شروع بازی', open: '🎮 ورود به بازی', menu: '🎮 بازی',
    paid: c => `✅ پرداخت موفق! ${c.toLocaleString('fa-IR')} سکه به حسابت اضافه شد. بازی را باز کن تا دریافت کنی.`,
    paidGems: g => `✅ پرداخت موفق! ${g.toLocaleString('fa-IR')} جم 💎 به حسابت اضافه شد.`,
    paidPass: '✅ پرداخت موفق! پاس فصل ویژه‌ت فعال شد — وارد بازی شو و جایزه‌هات رو بگیر.',
    paidFrame: '✅ پرداخت موفق! قاب جدید کارت‌هات باز شد — وارد بازی شو و ببینش.',
    packTitle: c => `${c.toLocaleString('fa-IR')} سکه`, packDesc: c => `${c.toLocaleString('fa-IR')} سکه برای بازی Gram Legends`,
    cmd: 'شروع بازی Gram Legends',
    arena: e => e.result === 'win' ? `🏆 دوئل آرنا را از ${e.opp} بردی! +${e.pot.toLocaleString('fa-IR')} سکه.`
      : e.result === 'lose' ? `💔 دوئل آرنا را به ${e.opp} باختی (-${e.stake.toLocaleString('fa-IR')} سکه).` : `🤝 دوئل آرنا با ${e.opp} مساوی شد و سکه‌هایت برگشت.`,
  },
};
// Short bot texts for the other game languages (fall back to English for anything missing).
const MORE = {
  ru: ['⚔️ Добро пожаловать в Gram Legends!\n\nСобирай карты героев, собирай команду, сражайся с боссами в 20 мирах и бросай вызов игрокам на арене.\n\nНажми кнопку ниже 👇', '🎮 Играть', 'Играть в Gram Legends', 'монет', 'Оплата прошла! Монеты добавлены', 'Дуэль на арене против', 'победа', 'поражение', 'ничья — ставка возвращена'],
  ar: ['⚔️ مرحبًا بك في Gram Legends!\n\nاجمع بطاقات الأبطال، كوّن فريقك، قاتل الزعماء في 20 عوالم وتحدَّ اللاعبين في الساحة.\n\nاضغط الزر بالأسفل 👇', '🎮 العب', 'العب Gram Legends', 'عملة', 'تم الدفع! أُضيفت العملات', 'مبارزة الساحة ضد', 'فوز', 'خسارة', 'تعادل — أُعيد الرهان'],
  tr: ['⚔️ Gram Legends’a hoş geldin!\n\nKahraman kartları topla, takımını kur, 20 dünyada boss’larla savaş ve arenada oyunculara meydan oku.\n\nAşağıdaki butona dokun 👇', '🎮 Oyna', 'Gram Legends oyna', 'coin', 'Ödeme başarılı! Coin’ler eklendi', 'Arena düellosu, rakip:', 'galibiyet', 'yenilgi', 'berabere — bahis iade edildi'],
  es: ['⚔️ ¡Bienvenido a Gram Legends!\n\nColecciona cartas de héroes, arma tu equipo, vence a los jefes de 20 mundos y reta a jugadores en la arena.\n\nToca el botón 👇', '🎮 Jugar', 'Jugar a Gram Legends', 'monedas', '¡Pago completado! Monedas añadidas', 'Duelo de arena contra', 'victoria', 'derrota', 'empate — apuesta devuelta'],
  pt: ['⚔️ Bem-vindo ao Gram Legends!\n\nColecione cartas de heróis, monte seu time, vença chefes em 20 mundos e desafie jogadores na arena.\n\nToque no botão 👇', '🎮 Jogar', 'Jogar Gram Legends', 'moedas', 'Pagamento concluído! Moedas adicionadas', 'Duelo na arena contra', 'vitória', 'derrota', 'empate — aposta devolvida'],
  fr: ['⚔️ Bienvenue dans Gram Legends !\n\nCollectionne des cartes de héros, forme ton équipe, bats les boss de 20 mondes et défie des joueurs dans l’arène.\n\nTouche le bouton 👇', '🎮 Jouer', 'Jouer à Gram Legends', 'pièces', 'Paiement réussi ! Pièces ajoutées', 'Duel d’arène contre', 'victoire', 'défaite', 'égalité — mise rendue'],
  de: ['⚔️ Willkommen bei Gram Legends!\n\nSammle Heldenkarten, stell dein Team zusammen, besiege Bosse in 20 Welten und fordere Spieler in der Arena heraus.\n\nTippe auf den Button 👇', '🎮 Spielen', 'Gram Legends spielen', 'Münzen', 'Zahlung erfolgreich! Münzen gutgeschrieben', 'Arenaduell gegen', 'Sieg', 'Niederlage', 'Unentschieden — Einsatz zurück'],
  id: ['⚔️ Selamat datang di Gram Legends!\n\nKoleksi kartu pahlawan, susun timmu, kalahkan bos di 20 dunia, dan tantang pemain di arena.\n\nKetuk tombol di bawah 👇', '🎮 Main', 'Main Gram Legends', 'koin', 'Pembayaran berhasil! Koin ditambahkan', 'Duel arena melawan', 'menang', 'kalah', 'seri — taruhan dikembalikan'],
  uk: ['⚔️ Ласкаво просимо до Gram Legends!\n\nЗбирай карти героїв, створюй команду, перемагай босів у 20 світах і кидай виклик гравцям на арені.\n\nНатисни кнопку нижче 👇', '🎮 Грати', 'Грати в Gram Legends', 'монет', 'Оплата пройшла! Монети додано', 'Дуель на арені проти', 'перемога', 'поразка', 'нічия — ставку повернено'],
  hi: ['⚔️ Gram Legends में स्वागत है!\n\nहीरो कार्ड जमा करो, टीम बनाओ, 20 दुनिया के बॉस हराओ और अखाड़े में खिलाड़ियों को चुनौती दो।\n\nनीचे बटन दबाओ 👇', '🎮 खेलें', 'Gram Legends खेलें', 'सिक्के', 'भुगतान सफल! सिक्के जोड़ दिए गए', 'अखाड़ा मुक़ाबला बनाम', 'जीत', 'हार', 'बराबरी — दाँव वापस'],
  zh: ['⚔️ 欢迎来到 Gram Legends！\n\n收集英雄卡，组建队伍，挑战20个世界的首领，并在竞技场与玩家对决。\n\n点击下方按钮 👇', '🎮 开始游戏', '开始 Gram Legends', '金币', '支付成功！金币已到账', '竞技场对决 vs', '胜利', '失败', '平局——押注已退还'],
  uz: ['⚔️ Gram Legends’ga xush kelibsan!\n\nQahramon kartalarini yigʻ, jamoa tuz, 20 dunyoda bosslarni yeng va arenada oʻyinchilarni duelga chaqir.\n\nPastdagi tugmani bos 👇', '🎮 Oʻynash', 'Gram Legends oʻynash', 'tanga', 'Toʻlov bajarildi! Tangalar qoʻshildi', 'Arena dueli, raqib:', 'gʻalaba', 'magʻlubiyat', 'durang — tikish qaytarildi'],
};
for (const [code, [start, play, cmd, coins, paid, duel, win, lose, draw]] of Object.entries(MORE)) {
  const fmt = n => n.toLocaleString('en-US');
  TEXT[code] = { ...TEXT.en, start, play, open: play, menu: play, cmd,
    paid: c => `✅ ${paid}: +${fmt(c)} ${coins}.`, paidGems: g => `✅ ${paid}: +${fmt(g)} 💎`, packTitle: c => `${fmt(c)} ${coins}`, packDesc: c => `Gram Legends · ${fmt(c)} ${coins}`,
    arena: e => `${e.result === 'win' ? '🏆' : e.result === 'lose' ? '💔' : '🤝'} ${duel} ${e.opp}: ${e.result === 'win' ? `${win} +${fmt(e.pot)} ${coins}` : e.result === 'lose' ? `${lose} -${fmt(e.stake)} ${coins}` : draw}` };
}
const tx = lang => TEXT[String(lang || '').toLowerCase().slice(0, 2)] || TEXT.en;

if (!BOT_TOKEN) { console.error('BOT_TOKEN is required'); process.exit(1); }
// Never let one bad request or timer take the whole game down.
process.on('unhandledRejection', e => console.error('unhandledRejection', e && e.message));
process.on('uncaughtException', e => console.error('uncaughtException', e && e.stack));

// ---------- storage (single JSON file, atomic writes) ----------
let db = { users: {}, payments: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; }
catch (e) { if (e.code !== 'ENOENT') { console.error('DB LOAD FAILED — refusing to start with an empty database', e.message); process.exit(1); } }
// Maps looked up with ids from requests have no prototype, so "__proto__" / "constructor" are just missing keys.
const bare = o => Object.assign(Object.create(null), o || {});
db.users = bare(db.users); db.payments = bare(db.payments); if (db.clans) db.clans = bare(db.clans);
// Writes are batched: at most one async write per second, and never two at once (atomic tmp + rename).
let saveTimer = null, saving = false, dirty = false;
function persist() {
  dirty = true;
  if (saveTimer || saving) return;
  saveTimer = setTimeout(flushDb, +process.env.SAVE_MS || 3000);
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
  // Bot reminders are opt-in: new players are asked in the game (u.notifyAsked) before any reminder is sent.
  const u = db.users[id] || (db.users[id] = { id, pending: 0, gift: 0, refBy: null, refs: 0, created: Date.now(), profile: null, mute: true });
  u.tgName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').slice(0, 40) || tgUser.username || 'Player';
  u.name = u.nick || u.tgName; // the player's own game name if they picked one
  u.username = tgUser.username || null;
  u.seen = Date.now();
  if (tgUser.language_code) u.tgLang = String(tgUser.language_code).slice(0, 2);
  u.blocked = false;
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
function writeArt(num, buf, ext) {
  fs.mkdirSync(ART_DIR, { recursive: true });
  for (const e of ART_EXT) { try { fs.unlinkSync(path.join(ART_DIR, num + e)); } catch (err) {} }
  fs.writeFileSync(path.join(ART_DIR, num + ext), buf);
  scanArt();
}
async function saveArt(num, fileId, ext) {
  const f = await tg('getFile', { file_id: fileId });
  const r = await fetch(`${TG_FILES}${f.file_path}`);
  if (!r.ok) throw new Error('download failed ' + r.status);
  writeArt(num, Buffer.from(await r.arrayBuffer()), ext);
}
// ---------- official alliances (/ally, admins only) ----------
// Two real projects announce a partnership → the admin approves it here; every alliance card holding both
// communities gets +pct% power for `days` days, and both communities hear about it from the bot.
db.alliances = db.alliances || [];
const activeAllies = (now = Date.now()) => db.alliances.filter(x => x.until > now);
const findHero = q => { const k = String(q || '').toLowerCase().replace(/[\s_-]/g, ''); return E.BASE_HEROES.find(h => h.id === k || h.name.toLowerCase().replace(/[\s_-]/g, '') === k); };
const pairOf = (x, a, b) => (x.a === a && x.b === b) || (x.a === b && x.b === a);
// Market moods plus official alliances, as the boost map battles use (keys: hero or alliance card ids).
function battleMarket() {
  const m = ECON.marketBoosts(market.moods());
  for (const [k, v] of Object.entries(ECON.allianceBoosts(activeAllies()))) m[k] = +((m[k] || 1) * v).toFixed(4);
  return m;
}
async function handleAlly(m) {
  const say = text => tg('sendMessage', { chat_id: m.chat.id, text });
  if (!ADMIN_IDS.has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins (ADMIN_IDS) can manage alliances.`);
  const args = m.text.replace(/^\/ally(@\w+)?/, '').trim().split(/\s+/).filter(Boolean);
  const now = Date.now(), name = id => E.HERO_BY_ID[id].name;
  const list = () => (activeAllies(now).map(x => `🤝 ${name(x.a)} × ${name(x.b)} · +${x.pct}% · ${Math.ceil((x.until - now) / 864e5)}d left`).join('\n') || 'No official alliances yet.');
  if (!args.length || args[0] === 'list') return say(list() + '\n\n/ally <hero> <hero> [percent=10] [days=30] · /ally remove <hero> <hero>');
  const remove = args[0] === 'remove', [qa, qb, qp, qd] = remove ? args.slice(1) : args;
  const a = findHero(qa), b = findHero(qb);
  if (!a || !b || a === b) return say(`Unknown heroes. Use ids or names: ${E.BASE_HEROES.map(h => h.id).join(', ')}`);
  if (remove) {
    const before = db.alliances.length;
    db.alliances = db.alliances.filter(x => !pairOf(x, a.id, b.id)); persist();
    return say(before === db.alliances.length ? 'No such alliance.' : `❌ ${a.name} × ${b.name} removed.`);
  }
  const pct = Math.max(1, Math.min(30, Math.round(+qp || ECON.ALLY_DEFAULT.pct))), days = Math.max(1, Math.min(365, Math.round(+qd || ECON.ALLY_DEFAULT.days)));
  db.alliances = db.alliances.filter(x => !pairOf(x, a.id, b.id) && x.until > now);
  db.alliances.push({ a: a.id, b: b.id, pct, until: now + days * 864e5, at: now }); persist();
  let told = 0;
  for (const u of Object.values(db.users)) if (u.profile && (u.profile.faction === a.id || u.profile.faction === b.id)) { notifier.enqueue(u.id, L => L.ally(a.name, b.name, pct, days)); told++; }
  return say(`✅ Official alliance: ${a.name} × ${b.name} · +${pct}% for ${days} days. ${told} members will be told.`);
}

// ---------- fusion art generated with Runway (/gen, admins only) ----------
const runway = createRunway({ saveArt: async (num, buf, ext) => writeArt(num, buf, ext), hasArt: n => !!artIndex[n], log: m => console.error('runway', m),
  pollMs: +process.env.RUNWAY_POLL_MS || 4000 });
async function handleGen(m) {
  const say = text => tg('sendMessage', { chat_id: m.chat.id, text });
  if (!ADMIN_IDS.has(String(m.from.id))) return say(`Your Telegram ID is ${m.from.id}. Only admins (ADMIN_IDS) can generate art.`);
  const arg = m.text.replace(/^\/gen(@\w+)?/, '').trim(), force = /\bforce\b/.test(arg), what = arg.replace(/\bforce\b/, '').trim();
  const J = runway.job;
  if (what === 'status') return say(J.running ? `🎨 Generating: ${J.done + J.failed.length}/${J.list.length} (failed ${J.failed.length})` : `🎨 Idle. Art: ${Object.keys(artIndex).length}/${E.FUSIONS.length}.`);
  if (what === 'stop') { J.stop = true; return say('⏹ Stopping after the current card.'); }
  if (!runway.enabled()) return say('⚠️ Runway is not connected. In Render → Environment add RUNWAYML_API_SECRET (your key from dev.runwayml.com) and redeploy.');
  const nums = createRunway.parseTargets(what);
  if (!nums.length) return say('🎨 /gen <number> · /gen 1-50 · /gen named · /gen bosses · /gen all  (add "force" to redo cards that already have art) · /gen status · /gen stop');
  if (nums.length === 1) {
    const f = E.FUSIONS.find(x => x.num === nums[0]);
    await say(`🎨 Generating #${f.num} ${f.name}…`);
    try {
      await runway.generate(f.num);
      const url = `${WEBAPP_URL}/art/${f.num}?v=${artIndex[f.num].v}`;
      await tg('sendPhoto', { chat_id: m.chat.id, photo: url, caption: `✅ #${f.num} ${f.name} — now in the game. /gen ${f.num} force to try again.` }).catch(() => say(`✅ #${f.num} ${f.name} saved.`));
    } catch (e) { await say(`❌ #${f.num}: ${e.message}`); }
    return;
  }
  const todo = force ? nums.length : nums.filter(n => !artIndex[n]).length;
  await say(`🎨 Generating ${todo} cards one by one (${nums.length - todo} already have art). I'll report every 5.`);
  runway.runQueue(nums, { force, onProgress: p => say(p.error ? `❌ Stopped: ${p.error}` : `🎨 ${p.done}/${p.total} done${p.failed ? ` · ${p.failed} failed` : ''}`) })
    .then(r => say(`✅ Finished: ${r.done}/${r.total} generated${r.failed.length ? ` · failed: ${r.failed.join(', ')}` : ''}${r.stopped ? ' (stopped)' : ''}.`))
    .catch(e => say(`❌ ${e.message}`));
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
  try { const user = JSON.parse(params.get('user')); if (user && typeof user === 'object') user._start = params.get('start_param') || ''; return user; } catch (e) { return null; }
}

// ---------- Telegram Bot API ----------
async function tg(method, body, retried) {
  const r = await fetch(TG + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(method === 'getUpdates' ? 40e3 : 15e3) });
  const j = await r.json();
  if (!j.ok && j.error_code === 429 && !retried) { await new Promise(res => setTimeout(res, Math.min(30, (j.parameters && j.parameters.retry_after) || 1) * 1000)); return tg(method, body, true); }
  if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
}

// Upload a file (multipart) — used for database backups.
async function tgFile(method, field, chatId, name, buf, extra = {}) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  for (const [k, v] of Object.entries(extra)) form.append(k, String(v));
  form.append(field, new Blob([buf]), name);
  const r = await fetch(TG + method, { method: 'POST', body: form });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
}
const backup = createBackup({ db, dataFile: DATA_FILE, admins: () => ADMIN_IDS, logErr: (k, e) => logErr(k, e),
  sendDocument: (chat, name, buf, caption) => tgFile('sendDocument', 'document', chat, name, buf, { caption }) });

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
    if (pack.pass) { if (u.profile) ECON.passOf(u.profile, Date.now()).prem = true; else u.pendingPass = ECON.seasonOf(Date.now()); u.passGift = true; }
    else if (pack.club) {
      // Telegram reports when the paid month ends; renewals arrive as new payments and extend it.
      const until = p.subscription_expiration_date ? p.subscription_expiration_date * 1000 : Date.now() + ECON.CLUB.days * 864e5;
      if (u.profile) u.profile.club = { ...(u.profile.club || {}), until: Math.max(until, (u.profile.club && u.profile.club.until) || 0) };
    }
    else if (pack.starter) { credit(u, pack.coins, pack.gems); if (u.profile) u.profile.starter = true; }
    else if (pack.cos) { if (u.profile) ECON.giveCosmetic(u.profile, pack.cos); else (u.pendingCos = u.pendingCos || []).push(pack.cos); }
    else credit(u, pack.coins || 0, pack.gems || 0);
    db.payments[chargeId] = { uid, pack: packId, stars: p.total_amount, coins: pack.coins || 0, gems: pack.gems || 0, f: (u.profile && u.profile.faction) || 'none', at: Date.now() };
    analytics.payment(p.total_amount); fund.onPayment(u, p.total_amount);
    persist(); await flushDb();
    const L = tx(m.from.language_code);
    await tg('sendMessage', { chat_id: m.chat.id, text: pack.club ? '✅ Gram Club active — collect your daily gems in Quests.' : pack.starter ? L.paidGems(pack.gems) : pack.cos ? L.paidFrame : pack.pass ? ((BOT_TEXT[String(m.from.language_code || '').slice(0, 2)] || {}).paidPass || L.paidPass) : pack.gems ? L.paidGems(pack.gems) : L.paid(pack.coins),
      reply_markup: { inline_keyboard: [[{ text: L.open, web_app: { url: WEBAPP_URL } }]] } });
    return;
  }
  if (typeof m.text === 'string' && /^\/gen\b/.test(m.text)) return handleGen(m);
  if (typeof m.text === 'string' && /^\/ally\b/.test(m.text)) return handleAlly(m);
  if (typeof m.text === 'string' && /^\/quest\b/.test(m.text)) return partners.handle(m);
  if (typeof m.text === 'string' && /^\/channel\b/.test(m.text)) {
    if (!ADMIN_IDS.has(String(m.from.id))) return tg('sendMessage', { chat_id: m.chat.id, text: `Your Telegram ID is ${m.from.id}. Only admins can check the channel.` });
    const ok = await checkChannel();
    return tg('sendMessage', { chat_id: m.chat.id, text: !GAME_CHANNEL ? 'No game channel set (GAME_CHANNEL=off).' : ok ? `✅ ${GAME_CHANNEL}: the bot is an admin. New players are asked to join and get 🪙 ${CHANNEL_COINS} + 💎 ${CHANNEL_GEMS}.` : `⚠️ ${GAME_CHANNEL}: the bot is NOT an admin (${diag.channelState}). Add @${BOT_USERNAME} as an administrator of the channel, then send /channel again.` });
  }
  if (typeof m.text === 'string' && /^\/nft\b/.test(m.text)) return wallet.handle(m);
  if (typeof m.text === 'string' && /^\/fund\b/.test(m.text)) return fund.handle(m);
  if (typeof m.text === 'string' && /^\/(paysupport|refund|terms|privacy)\b/.test(m.text)) return support.handle(m);
  if (typeof m.text === 'string' && /^\/backup\b/.test(m.text)) {
    if (!ADMIN_IDS.has(String(m.from.id))) return tg('sendMessage', { chat_id: m.chat.id, text: `Your Telegram ID is ${m.from.id}. Only admins (ADMIN_IDS) can get backups.` });
    if (m.chat.type && m.chat.type !== 'private') return tg('sendMessage', { chat_id: m.chat.id, text: 'Backups are only sent in a private chat with the bot.' });
    await flushDb();
    return backup.run([m.chat.id]).catch(e => tg('sendMessage', { chat_id: m.chat.id, text: '⚠️ Backup failed: ' + e.message }));
  }
  if (typeof m.text === 'string' && /^\/stats\b/.test(m.text)) {
    if (ADMIN_IDS.has(String(m.from.id))) await tg('sendMessage', { chat_id: m.chat.id, text: analytics.text() });
    else await tg('sendMessage', { chat_id: m.chat.id, text: `Your Telegram ID is ${m.from.id}. Only admins (ADMIN_IDS) can see /stats.` });
    return;
  }
  if ((typeof m.text === 'string' && /^\/art/.test(m.text)) || ((m.photo || m.document) && ADMIN_IDS.has(String(m.from.id)))) {
    await handleArt(m);
    return;
  }
  if (typeof m.text === 'string' && m.text.startsWith('/start')) {
    const arg = m.text.split(' ')[1] || '';
    if (arg.startsWith('ref_')) applyReferral(userRec(m.from), arg);
    attribute(userRec(m.from), arg);
    const url = WEBAPP_URL;
    const L = tx(m.from.language_code);
    try {
      await tg('sendMessage', { chat_id: m.chat.id, text: L.start, reply_markup: { inline_keyboard: [[{ text: L.play, web_app: { url } }], ...(channelUrl() ? [[{ text: '📢 ' + (L.channel || 'Channel'), url: channelUrl() }]] : [])] } });
    } catch (e) {
      // Usually a missing/invalid WEBAPP_URL (Telegram requires https). Reply anyway so the bot never looks dead.
      logErr('lastSendError', e);
      await tg('sendMessage', { chat_id: m.chat.id, text: `${L.start}\n\n⚠️ Game link is not configured (WEBAPP_URL). ${url || ''}`.trim() });
    }
  }
}

// Invites: tiers, the friend-coins bank and the Friends screen live in referral.js.
const referral = createReferral({ db, persist, credit, profileOut, inviteLink: u => (BOT_USERNAME ? `https://t.me/${BOT_USERNAME}?startapp=ref_${u.id}` : null) });
// Where a new player came from (for /stats): an invite (ref_…), a duel/clan link, a campaign link (src_<name>), or organic.
function attribute(u, param) {
  if (u.src || Date.now() - u.created > 10 * 60e3) return;
  const s = String(param || '');
  const m = /^src_([a-z0-9_]{1,24})$/i.exec(s);
  u.src = m ? m[1].toLowerCase() : s.startsWith('ref_') ? 'ref' : /^(duel|room|clan)_/.test(s) ? s.split('_')[0] : 'organic';
  persist();
}
function applyReferral(u, startParam) {
  if (!startParam || !startParam.startsWith('ref_') || u.refBy) return false;
  const inviterId = startParam.slice(4);
  if (!/^\d{1,15}$/.test(inviterId)) return false;
  const inviter = db.users[inviterId];
  if (!inviter || inviterId === u.id) return false;
  if (u.created < Date.now() - 10 * 60e3 && u.profile && u.profile.cleared > 0) return false; // only fresh players count
  // The newcomer's gift is immediate; the inviter is paid once the newcomer reaches world 2 (referral.check).
  u.refBy = inviterId; credit(u, referral.NEWCOMER_COINS);
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
        handleUpdate(up).catch(e => logErr('lastHandleError', e));
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
function readBody(req, limit = 1e5) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}
const GZ = new Map();
function serveStatic(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(STATIC_DIR, p));
  if (!file.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file), etag = `"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.jpg' || ext === '.png' ? 'public, max-age=86400' : 'no-cache', ETag: etag, Vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    // Text files are gzipped once and kept in memory (the game's JS/CSS is ~1 MB, ~250 KB gzipped).
    const gz = /\.(html|js|css|json|svg)$/.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const cached = gz && GZ.get(file);
    if (cached && cached.etag === etag) { res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); return res.end(cached.buf); }
    fs.readFile(file, (err2, buf) => {
      if (err2) { res.writeHead(404); return res.end('Not found'); }
      if (gz) { const z = require('zlib').gzipSync(buf, { level: 9 }); GZ.set(file, { etag, buf: z }); res.writeHead(200, { ...head, 'Content-Encoding': 'gzip' }); return res.end(z); }
      res.writeHead(200, head); res.end(buf);
    });
  });
}

// The ranking is rebuilt at most every LB_CACHE_MS (sorting every player on each Ranks visit is too slow at scale).
let lbAll = null, lbIdx = null, lbAt = 0;
const safePower = p => { try { return ECON.teamPower(p); } catch (e) { return 0; } };
function leaderboard(meId) {
  if (!lbAll || Date.now() - lbAt >= (process.env.LB_CACHE_MS !== undefined ? +process.env.LB_CACHE_MS : 30e3)) {
    lbAll = Object.values(db.users).filter(u => u.profile && u.profile.cleared > 0)
      .map(u => ({ id: u.id, name: u.name, av: ECON.avatarOf(u.profile), fr: u.profile.cos && u.profile.cos.on, stage: u.profile.cleared, pvp: u.profile.stats.pvpWins || 0, power: safePower(u.profile), seen: u.seen }))
      .sort((a, b) => b.stage - a.stage || b.pvp - a.pvp || b.power - a.power || a.seen - b.seen);
    lbIdx = new Map(lbAll.map((u, i) => [u.id, i])); lbAt = Date.now();
  }
  const all = lbAll;
  const top = all.slice(0, 50).map((u, i) => ({ rank: i + 1, name: u.name, av: u.av, fr: u.fr || null, stage: u.stage, pvp: u.pvp }));
  const idx = lbIdx.has(meId) ? lbIdx.get(meId) : -1;
  return { top, total: all.length, me: idx >= 0 ? { rank: idx + 1, stage: all[idx].stage } : null };
}

const analytics = createAnalytics({ db, persist });
const clans = createClans({ db, persist, profileOut: u => (u.profile ? ECON.pickKeys(u.profile) : null) });
const notifier = createNotifier({ db, persist, tg, webappUrl: () => WEBAPP_URL, logErr });
const SHARE_DIR = process.env.SHARE_DIR || path.join(require('os').tmpdir(), 'gl-share');
const war = createWar({ db, persist, weekKey: clans.weekKey, shareDir: SHARE_DIR, profileOut: u => (u.profile ? ECON.pickKeys(u.profile) : null), onWeekEnd: (last, captains) => notifier.weekEnded(last, captains) });
const market = createMarket({ db, persist, api: (process.env.MARKET_API || 'https://api.coingecko.com/api/v3').replace(/\/$/, ''), logErr });
// One point system: a win's community-war points also count for the player's clan (players without a community
// give their clan the base points). They feed the community activity behind the market mood too.
// kind: 'stageFirst' | 'stage' | 'ai' | 'pvp' | 'raid'; info: { stage, vs }
const CLAN_POINTS = { stageFirst: 2, ai: 1, pvp: 5, raid: 3 };
const onWin = (uid, kind, info = {}) => {
  const got = war.onWin(uid, kind, info);
  if (got || CLAN_POINTS[kind]) clans.addPoints(uid, got || CLAN_POINTS[kind]);
  const u = db.users[uid]; if (u && u.profile) market.addActivity(u.profile.faction, Math.max(1, got));
};
// World boss: fights use the same frozen boosts as stages (market moods, official alliances, set perks, mascot tier).
const raid = createRaid({ db, persist, weekKey: clans.weekKey, credit, profileOut, onDamage: uid => onWin(uid, 'raid', {}),
  ctxFor: u => {
    const p = u.profile, all = battleMarket(), t = war.tierFor(p.faction);
    const market = Object.fromEntries(Object.entries(all).filter(([id]) => p.team.some(x => x === id || (E.HERO_BY_ID[x].fusion && E.HERO_BY_ID[x].parts.includes(id)))));
    return { market, perks: { ...ECON.perksOf(p), ...(t ? { mascot: t * ECON.MASCOT_PER_TIER } : {}) } };
  } });
const league = createLeague({ db, persist, profileOut });
const fund = createFund({ db, persist, tg, admins: () => ADMIN_IDS });
const support = createSupport({ db, persist, tg, admins: () => ADMIN_IDS, webapp: () => WEBAPP_URL });
const wallet = createWallet({ db, persist, tg, admins: () => ADMIN_IDS, E });
const partners = createPartners({ db, persist, tg, credit, profileOut, admins: () => ADMIN_IDS });
const arena = createArena({ db, persist, league, onPoints: (uid, pts, info = {}) => onWin(uid, info.kind || (pts >= 5 ? 'pvp' : 'ai'), info), market: battleMarket, perksExtra: p => { const t = war.tierFor(p.faction); return t ? { mascot: t * ECON.MASCOT_PER_TIER } : {}; }, notify: (uid, end) => {
  const u = db.users[uid];
  const L = tx(u && u.lang);
  if (end.result === 'cancelled') return;
  tg('sendMessage', { chat_id: Number(uid), text: L.arena(end) }).catch(e => logErr('lastSendError', e));
} });

const routes = {
  'GET /api/health': () => ({ ok: true, bot: BOT_USERNAME, packs: PACKS, starter: STARTER_PACK, club: CLUB_PACK, ads: ADS_BLOCK && ADS_SECRET ? { block: ADS_BLOCK, daily: ECON.ADS.daily, hours: ECON.ADS.hours } : null, mint: db.mint || {}, art: artVersions(), market: { at: db.market.at, moods: market.moods() }, alliances: activeAllies().map(({ a, b, pct, until }) => ({ a, b, pct, until })) }),
  'GET /api/status': () => ({ ...diag, bot: BOT_USERNAME, users: Object.keys(db.users).length, node: process.version,
    market: { tokens: market.tokens, prices: db.market.prices, updated: db.market.at ? new Date(db.market.at).toISOString() : null } }),
  'POST /api/hello': (body, u) => {
    applyReferral(u, body.startParam);
    attribute(u, body.startParam);
    // A friend's invite suggests their community to the newcomer.
    const inviter = u.refBy && db.users[u.refBy];
    return { ok: true, suggest: inviter && inviter.profile ? inviter.profile.faction || null : null };
  },
  'POST /api/notify': (body, u) => { u.mute = !body.on; u.notifyAsked = true; return { on: !u.mute }; },
  // Game name: 3–16 letters/digits (any language), unique; the first change is free, later ones cost NAME_GEMS.
  'POST /api/me/name': (body, u) => {
    const fail = c => { throw Object.assign(new Error(c), { code: 400 }); };
    if (!u.profile) fail('no_profile');
    const name = String(body.name || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!/^[\p{L}\p{N}_ .-]{3,16}$/u.test(name) || /^(admin|gram ?legends|support|moderator)$/i.test(name)) fail('bad_nick');
    db.nicks = db.nicks || Object.create(null);
    const key = name.toLowerCase(), owner = db.nicks[key];
    if (owner && owner !== u.id) fail('name_taken');
    const cost = u.nick ? NAME_GEMS : 0;
    if ((u.profile.gems || 0) < cost) fail('no_gems');
    if (u.nick && db.nicks[u.nick.toLowerCase()] === u.id) delete db.nicks[u.nick.toLowerCase()];
    u.profile.gems -= cost; u.nick = name; u.name = name; db.nicks[key] = u.id;
    return { name, profile: profileOut(u) };
  },
  'POST /api/channel/check': async (body, u) => {
    if (!channelInfo(u) || u.chanJoined) return { joined: true };
    const m = await tg('getChatMember', { chat_id: GAME_CHANNEL, user_id: Number(u.id) }).catch(e => ({ error: e.message }));
    if (m && m.error) { logErr('channelError', new Error(m.error)); return { joined: true, unverified: true }; } // can't check → don't block anyone
    if (!m || !['member', 'administrator', 'creator', 'restricted'].includes(m.status)) return { joined: false };
    if (u.chanJoined) return { joined: true };
    u.chanJoined = Date.now();
    if (u.profile) { u.profile.coins += CHANNEL_COINS; u.profile.gems = (u.profile.gems || 0) + CHANNEL_GEMS; }
    return { joined: true, coins: CHANNEL_COINS, gems: CHANNEL_GEMS, profile: u.profile ? profileOut(u) : null };
  },
  'POST /api/me': (body, u) => ({ name: u.name, nick: u.nick || null, tgName: u.tgName, nameCost: u.nick ? NAME_GEMS : 0 }),
  // The server keeps each Telegram player's coins and heroes. First visit imports the offline save (clamped).
  'POST /api/profile': async (body, u) => {
    if (GAME_CHANNEL && diag.channelOk !== true && Date.now() - (diag.channelAt || 0) > 60e3) await checkChannel().catch(() => {});
    if (!u.profile) { u.profile = ECON.importLocal(body.local, Date.now()); u.profile.coins += u.pending; u.profile.gems += u.pendingGems || 0; u.pending = 0; u.pendingGems = 0; }
    if (u.pendingCos) { for (const c of u.pendingCos) ECON.giveCosmetic(u.profile, c); delete u.pendingCos; }
    if (u.pendingPass !== undefined) { if (u.pendingPass === ECON.seasonOf(Date.now())) ECON.passOf(u.profile, Date.now()).prem = true; delete u.pendingPass; }
    return { profile: profileOut(u), notify: !u.mute, askNotify: !!u.mute && !u.notifyAsked, channel: channelInfo(u) };
  },
  'POST /api/act': (body, u) => {
    if (!u.profile) throw Object.assign(new Error('no_profile'), { code: 400 });
    const result = ECON.act(u.profile, body.action, { now: Date.now(), rng, mint, market: market.moods(), community: { ...war.community(u.profile), allies: activeAllies() } });
    referral.check(u);
    if (body.action && body.action.type === 'stageEnd' && result && result.result === 'win') referral.onCoins(u, result.coins);
    if (body.action && body.action.type === 'stageEnd' && result) analytics.battle(result.result === 'win');
    if (body.action && body.action.type === 'stageEnd' && result && result.result === 'win') onWin(u.id, result.first ? 'stageFirst' : 'stage', { stage: result.stage });
    return { profile: profileOut(u), result };
  },
  'POST /api/score': () => ({ ok: true }), // kept for older clients; leaderboard now uses server profiles
  'POST /api/leaderboard': (body, u) => leaderboard(u.id),
  'POST /api/claim': (body, u) => { const coins = u.gift || 0, gems = u.giftGems || 0, pass = !!u.passGift; u.gift = 0; u.giftGems = 0; u.passGift = false; return { ok: true, coins, gems, pass, profile: u.profile ? profileOut(u) : null }; },
  ...arena.routes,
  ...clans.routes,
  ...war.routes,
  ...referral.routes,
  ...raid.routes,
  ...league.routes,
  ...partners.routes,
  ...wallet.routes,
  ...fund.routes,
  'POST /api/invoice': async (body, u) => {
    const pack = ({ pass: PASS_PACK, starter: STARTER_PACK, club: CLUB_PACK })[body.pack] || PACKS.find(p => p.id === body.pack) || COS_PACKS.find(p => p.id === body.pack);
    if (!pack) throw Object.assign(new Error('unknown pack'), { code: 400 });
    if ((pack.starter || pack.club) && !u.profile) throw Object.assign(new Error('no_profile'), { code: 400 });
    if (pack.starter && u.profile.starter) throw Object.assign(new Error('claimed'), { code: 400 });
    if (pack.club && ECON.clubActive(u.profile, Date.now())) throw Object.assign(new Error('claimed'), { code: 400 });
    if (pack.pass && u.profile && ECON.passOf(u.profile, Date.now()).prem) throw Object.assign(new Error('claimed'), { code: 400 });
    if (pack.cos && u.profile && u.profile.cos && u.profile.cos.own.includes(pack.cos)) throw Object.assign(new Error('claimed'), { code: 400 });
    const title = pack.pass ? `Season Pass #${ECON.seasonOf(Date.now()) + 1}` : pack.club ? 'Gram Club · 30 days' : pack.starter ? `Starter pack: ${pack.gems} 💎 + ${pack.coins} 🪙`
      : pack.cos ? `${ECON.COSMETICS[pack.cos].ico} Card frame` : `${pack.gems} 💎`;
    const link = await tg('createInvoiceLink', {
      title: `Gram Legends · ${title}`, description: pack.club ? `Gram Legends · ${ECON.CLUB.gems} 💎 every day and a ${ECON.CLUB.afkH}h idle chest, renewed monthly (cancel any time in Telegram).` : `Gram Legends · ${title}`,
      payload: `${u.id}:${pack.id}`, currency: 'XTR', prices: [{ label: title, amount: pack.stars }],
      ...(pack.club ? { subscription_period: ECON.CLUB.days * 86400 } : {}),
    });
    return { link };
  },
};

const server = http.createServer((req, res) => handleRequest(req, res).catch(e => { logErr('requestError', e); try { if (!res.headersSent) send(res, 500, { error: 'server' }); else res.end(); } catch (e2) {} }));
server.keepAliveTimeout = 65000; server.headersTimeout = 66000;
async function handleRequest(req, res) {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); return res.end(); }
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const key = `${req.method} ${url.pathname}`;
  if (key === 'GET /api/pvp/stream') return arena.stream(req, res, url.searchParams.get('ticket'));
  // Rewarded ad watched (server-to-server callback from Adsgram: …/api/ads/reward?userid=[userId]&secret=ADS_SECRET).
  if (key === 'GET /api/ads/reward') {
    const uid = String(url.searchParams.get('userid') || ''), u = /^\d{1,15}$/.test(uid) && db.users[uid];
    if (!ADS_SECRET || url.searchParams.get('secret') !== ADS_SECRET) return send(res, 403, { error: 'forbidden' });
    if (!u || !u.profile) return send(res, 404, { error: 'no_user' });
    const now = Date.now(), p = u.profile;
    if (ECON.adsLeft(p, now) <= 0) return send(res, 200, { ok: false, error: 'limit' });
    p.ads = p.ads && p.ads.day === ECON.day(now) ? { day: p.ads.day, n: p.ads.n + 1 } : { day: ECON.day(now), n: 1 };
    const coins = ECON.afkRate(p) * ECON.ADS.hours; p.coins += coins;
    analytics.count('ads');
    persist();
    return send(res, 200, { ok: true, coins });
  }
  if (support.pages[key]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }); return res.end(support.pages[key]); }
  // TON Connect manifest (the wallet shows this name and icon when linking).
  if (key === 'GET /tonconnect-manifest.json') {
    const origin = (WEBAPP_URL && new URL(WEBAPP_URL).origin) || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const self = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    return send(res, 200, { url: origin, name: 'Gram Legends', iconUrl: `${self}/images/icon-192.png` });
  }
  const shareM = req.method === 'GET' && /^\/share\/(\d+)\.jpg$/.exec(url.pathname);
  if (shareM) {
    const f = path.join(SHARE_DIR, `${shareM[1]}.jpg`);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
    return fs.createReadStream(f).pipe(res);
  }
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
    const body = await readBody(req, key === 'POST /api/share' ? 1e6 : 1e5);
    const tgUser = verifyInitData(body.initData);
    if (!tgUser || !tgUser.id) return send(res, 401, { error: 'invalid initData' });
    const u = userRec(tgUser);
    analytics.seen(u);
    if (BOT_TEXT[body.lang]) u.lang = body.lang;
    if (key === 'POST /api/hello') body.startParam = tgUser._start || null;
    const out = await handler(body, u);
    persist();
    send(res, 200, out);
  } catch (e) {
    send(res, Number.isInteger(e.code) ? e.code : 500, { error: Number.isInteger(e.code) ? e.message : 'server' });
  }
}

async function setupBot() {
  try {
    const me = await tg('getMe');
    BOT_USERNAME = me.username;
    console.log('bot @' + BOT_USERNAME);
    await tg('deleteWebhook', {});
    // The bot's display name follows the game's name (BOT_NAME); only changed when different (the call is rate-limited).
    const wantName = process.env.BOT_NAME || 'Gram Legends';
    const cur = await tg('getMyName', {}).catch(() => null);
    if (!cur || cur.name !== wantName) await tg('setMyName', { name: wantName }).catch(e => logErr('setupError', e));
    // The channel check needs the bot to be an admin of the game channel: report it (status page + admins).
    BOT_ID = me.id;
    if (GAME_CHANNEL && !(await checkChannel())) {
      for (const a of ADMIN_IDS) tg('sendMessage', { chat_id: Number(a), text: `⚠️ Add @${me.username} to ${GAME_CHANNEL} as an admin (no special rights needed). Until then players are not asked to join and get no welcome gift. Send /channel to re-check.` }).catch(() => {});
    }
    if (WEBAPP_URL) await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: TEXT.en.menu, web_app: { url: WEBAPP_URL } } });
    // Telegram expects bots that sell to answer /paysupport and /terms.
    const legal = [{ command: 'paysupport', description: 'Help with a purchase' }, { command: 'terms', description: 'Terms of service' }, { command: 'privacy', description: 'Privacy policy' }];
    await tg('setMyCommands', { commands: [{ command: 'start', description: TEXT.en.cmd }, ...legal] });
    for (const code of Object.keys(TEXT).filter(c => c !== 'en')) await tg('setMyCommands', { commands: [{ command: 'start', description: TEXT[code].cmd }, ...legal], language_code: code });
  } catch (e) { logErr('setupError', e); }
}
async function start() {
  server.listen(PORT, () => console.log(`Gram Legends server on :${PORT}`));
  await setupBot();
  pollLoop();
  market.refresh();
}

if (require.main === module) start();
module.exports = { analytics, fund, market, notifier, war, flushDb, server, verifyInitData, handleUpdate, pollLoop, setupBot, db, PACKS, stop: () => { polling = false; clearInterval(channelTimer); backup.stop(); arena.stop(); notifier.stop(); market.stop(); server.close(); } };
