// Browser end-to-end test: real server + fake Telegram Bot API + two simulated Telegram users.
// Covers: server-owned profile, verified stage wins, Stars purchase, Telegram BackButton, and a live arena duel.
// usage: node tools/e2e.js <screenshot dir>
const http = require('http'), crypto = require('crypto'), path = require('path'), os = require('os'), fs = require('fs');
const assert = require('assert');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const OUT = process.argv[2] || '.';
const TOKEN = '999:E2E';
const queue = [];
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const m = req.url.split('/').pop();
    const out = { getMe: { username: 'TonLegendsBot' }, createInvoiceLink: 'https://t.me/$inv', getUpdates: queue.splice(0) }[m] ?? true;
    setTimeout(() => { res.writeHead(200); res.end(JSON.stringify({ ok: true, result: out })); }, m === 'getUpdates' && !out.length ? 150 : 0);
  });
});
function initData(user, startParam) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  if (startParam) fields.start_param = startParam;
  const p = new URLSearchParams(fields);
  const check = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', crypto.createHmac('sha256', crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(check).digest('hex'));
  return p.toString();
}
const tgScript = (user, startParam) => `
  window.Telegram = { WebApp: { initData: ${JSON.stringify(initData(user, startParam))}, initDataUnsafe: { user: ${JSON.stringify(user)}, start_param: ${JSON.stringify(startParam || '')} },
    ready(){}, expand(){}, setHeaderColor(){}, setBackgroundColor(){}, isVersionAtLeast: () => true, HapticFeedback: { impactOccurred(){} },
    BackButton: { show(){ window.__bb = true; }, hide(){ window.__bb = false; }, onClick(cb){ window.__bbcb = cb; } },
    enableClosingConfirmation(){}, disableClosingConfirmation(){},
    CloudStorage: { setItem(k, v, cb){ cb && cb(null, true); }, getItem(k, cb){ cb(null, ''); } },
    openTelegramLink(u){ window.__shared = u; }, shareToStory(url, o){ window.__story = [url, o]; },
    openInvoice(link, cb){ window.__invoice = link; fetch('/__pay').finally(() => setTimeout(() => cb('paid'), 300)); } } };`;

(async () => {
  await new Promise(r => fake.listen(0, r));
  // fake CoinGecko: NOT +12.3% (moon), DOGS −4.1% (bear)
  const cg = http.createServer((req, res) => { res.writeHead(200); res.end(JSON.stringify({ notcoin: { usd: 0.004, usd_24h_change: 12.3 }, 'dogs-2': { usd: 0.0005, usd_24h_change: -4.1 } })); });
  await new Promise(r => cg.listen(0, r)); process.env.MARKET_API = `http://127.0.0.1:${cg.address().port}`;
  process.env.TL_EVENT = 'none';
  Object.assign(process.env, { LB_CACHE_MS: '0', SAVE_MS: '1000', GAME_CHANNEL: 'off', REF_MIN_AGE_MS: '1', RAID_MIN_MS: '0', PICK_MS: '1500', BOT_TOKEN: TOKEN, WEBAPP_URL: 'https://x', DATA_FILE: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tle-')), 'db.json'), TELEGRAM_API: `http://127.0.0.1:${fake.address().port}` });
  const srv = require('../server/server.js');
  srv.server.listen(0); await new Promise(r => srv.server.once('listening', r));
  await srv.setupBot(); srv.pollLoop(); await srv.market.refresh();
  const base = `http://127.0.0.1:${srv.server.address().port}`;

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const errs = [];
  async function player(user, startParam) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${user.first_name}: ${e.message}`));
    await p.route(/fonts\.g/, r => r.abort());
    await p.route(/telegram-web-app\.js/, r => r.fulfill({ contentType: 'application/javascript', body: tgScript(user, startParam) }));
    await p.route('**/__pay', r => { queue.push({ update_id: Date.now(), message: { chat: { id: user.id }, from: user, successful_payment: { telegram_payment_charge_id: 'c' + Date.now(), total_amount: 25, invoice_payload: `${user.id}:gems_s` } } }); r.fulfill({ body: 'ok' }); });
    await p.goto(base + '/'); await p.waitForFunction(() => Online.state.profile === true, null, { timeout: 15000 });
    await p.waitForTimeout(300);
    return p;
  }
  const ECON = require('../src/economy.js');
  const serverProfile = uid => srv.db.users[String(uid)].profile;
  // help → daily reward (the community picker comes after the first win)
  const dismiss = async p => { for (let i = 0; i < 6; i++) { await p.waitForTimeout(500); if (await p.$('#modal:not([hidden])')) await p.click('#m-close'); } };

  // ---- player 1: profile, verified stage wins, purchase ----
  const sara = { id: 777, first_name: 'Sara' };
  const p1 = await player(sara);
  await dismiss(p1);
  // Notcoin is "to the moon" today: the client must build the battle with the same +10% the server replays with
  srv.db.users['777'].profile.owned.notcoin = 1; srv.db.users['777'].profile.team = ['notcoin', 'pinkbull', 'egor', 'gramcat', 'babyshark'];
  await p1.evaluate(async () => { Object.assign(S, await Online.loadProfile(null)); save(); refresh(); });
  assert.ok(await p1.$('#ticker'), 'market ticker on the map'); assert.match(await p1.textContent('#ticker'), /NOT.*12/);
  await p1.screenshot({ path: OUT + '/m1-ticker.png' });
  await p1.click('#ticker'); await p1.waitForSelector('#mk-ok'); await p1.screenshot({ path: OUT + '/m2-market.png' }); await p1.click('#mk-ok');
  await p1.evaluate(() => { S.auto = true; S.speed = 3; S.tutDone = true; save(); });
  for (let i = 0; i < 2; i++) {
    await p1.click('#go'); await p1.waitForSelector('#r-map', { timeout: 60000 }); await p1.click('#r-map'); await p1.waitForTimeout(300);
    if (i === 0) { assert.ok(await p1.$('#fac-ok'), 'community picker after the first win'); await p1.click('#m-close'); await p1.waitForTimeout(300); } // chosen later from the war screen
  }
  assert.equal(serverProfile(777).cleared, 2, 'server verified both stage wins (with the market boost)');
  assert.deepEqual(await p1.evaluate(() => BT === null), true);
  assert.equal(await p1.evaluate(() => S.coins), serverProfile(777).coins, 'client shows server coins');
  console.log('✓ stage wins verified by the server replay; coins', serverProfile(777).coins);
  // Sara reaches world 5: chests, exchange, PvP, AI rival and clans unlock
  await p1.click('[data-tab=chest]'); await p1.waitForTimeout(150);
  assert.ok(await p1.$('.lock-note'), 'locked features show where they open');
  await p1.screenshot({ path: OUT + '/u0-locked.png', fullPage: true });
  serverProfile(777).cleared = 40;
  await p1.evaluate(async () => { Object.assign(S, await Online.loadProfile(null)); save(); refresh(); });
  const before = serverProfile(777).gems;
  await p1.click('[data-tab=chest]'); await p1.click('[data-pack=gems_s]'); await p1.waitForSelector('#gm-ok', { timeout: 15000 });
  await p1.screenshot({ path: OUT + '/g1-bought.png' }); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).gems, before + 50); assert.equal(await p1.evaluate(() => S.gems), before + 50);
  assert.equal(await p1.textContent('#gems span'), String(before + 50));
  console.log('✓ Stars purchase credited on the server (+50 gems)');
  // gems → coins exchange and time warp
  const c0 = serverProfile(777).coins, g0 = serverProfile(777).gems, rate = ECON.gemRate(serverProfile(777));
  await p1.screenshot({ path: OUT + '/g2-shop.png', fullPage: true });
  await p1.click('[data-ex="10"]'); await p1.waitForSelector('#gm-ok'); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).coins, c0 + 10 * rate); assert.equal(serverProfile(777).gems, g0 - 10);
  serverProfile(777).gems += 200; // e.g. from achievements; arrives with the next server reply
  await p1.click('#warp'); await p1.waitForSelector('#gm-ok'); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).gems, g0 + 200 - 10 - ECON.WARP_COST);
  await p1.click('[data-k=gem]'); await p1.waitForSelector('#cl'); await p1.screenshot({ path: OUT + '/g3-gemchest.png' }); await p1.click('#cl');
  assert.equal(serverProfile(777).gems, g0 + 200 - 10 - ECON.WARP_COST - ECON.CHESTS.gem.cost, 'gem chest paid in gems');
  assert.equal(await p1.textContent('#gems span'), String(serverProfile(777).gems));
  console.log('✓ exchange (1 💎 = 🪙', rate + '), time warp');
  // Cheating attempt: editing coins locally changes nothing on the server.
  await p1.evaluate(() => { S.coins = 999999; save(); });
  await p1.click('[data-tab=heroes]'); await p1.click('.card[data-id=egor]'); await p1.click('#up'); await p1.waitForTimeout(400);
  assert.ok(await p1.evaluate(() => S.coins) < 999999, 'server overwrote the edited balance');
  await p1.click('#m-close');
  console.log('✓ locally edited coins are ignored (server balance wins)');

  // ---- arena: Sara hosts a 500 duel, Omid opens the invite link ----
  await p1.click('[data-tab=arena]'); await p1.waitForTimeout(200);
  await p1.click('[data-stake="500"]');
  await p1.screenshot({ path: OUT + '/a1-arena.png', fullPage: true });
  const s0 = serverProfile(777).coins;
  await p1.click('#pv-room'); await p1.waitForSelector('.duel-code');
  const code = await p1.textContent('.duel-code');
  assert.equal(serverProfile(777).coins, s0 - 500, 'entry held');
  await p1.click('#pv-share');
  assert.ok((await p1.evaluate(() => window.__shared)).includes(encodeURIComponent(`startapp=duel_${code}`)), 'invite link shared');
  await p1.screenshot({ path: OUT + '/a2-waiting.png' });

  const omid = { id: 888, first_name: 'Omid' };
  srv.db.users['888'] = { id: '888', pending: 0, gift: 0, refs: 0, created: Date.now(), profile: { ...ECON.newProfile(Date.now()), coins: 2500 } };
  const p2 = await player(omid, 'duel_' + code); // opened from the invite link
  await p2.waitForSelector('#dj-yes'); await p2.waitForTimeout(200);
  await p2.screenshot({ path: OUT + '/a3-invite.png' });
  const o0 = serverProfile(888).coins;
  await p2.click('#dj-yes');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p2.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p1.waitForTimeout(1500);
  await p1.screenshot({ path: OUT + '/a4-countdown.png' });
  await p1.waitForTimeout(4500);
  await p1.screenshot({ path: OUT + '/a5-duel-sara.png' });
  await p2.screenshot({ path: OUT + '/a5-duel-omid.png' });
  // tap any glowing card on both sides while it lasts
  for (let i = 0; i < 40; i++) {
    for (const p of [p1, p2]) { const c = await p.$('.hcard.hero.full'); if (c) await c.click().catch(() => {}); }
    if (await p1.$('#pr-arena') && await p2.$('#pr-arena')) break;
    await p1.waitForTimeout(500);
  }
  await p1.waitForSelector('#pr-arena', { timeout: 150000 }); await p2.waitForSelector('#pr-arena', { timeout: 150000 });
  await p1.screenshot({ path: OUT + '/a6-result-sara.png' });
  await p2.screenshot({ path: OUT + '/a6-result-omid.png' });
  const s1 = serverProfile(777).coins, o1 = serverProfile(888).coins;
  const draw = s1 === s0 && o1 === o0;
  assert.equal(s1 + o1, s0 + o0 - (draw ? 0 : 1000 - ECON.pvpPrize(500)), 'winner gets the prize (entries minus the house share)');
  assert.equal(await p1.evaluate(() => S.coins), s1); assert.equal(await p2.evaluate(() => S.coins), o1);
  console.log(`✓ duel finished: Sara ${s1 - s0 >= 0 ? '+' : ''}${s1 - s0}, Omid ${o1 - o0 >= 0 ? '+' : ''}${o1 - o0} (prize = entries − 10%, both screens match the server)`);
  await p1.click('#pr-arena'); await p2.click('#pr-map');
  assert.equal(Object.keys(srv.db.escrow).length, 0);

  // ---- AI rival from the arena screen ----
  await p1.click('[data-tab=arena]'); await p1.waitForTimeout(200);
  await p1.screenshot({ path: OUT + '/ai1-arena.png', fullPage: true });
  const k0 = serverProfile(777).coins;
  await p1.click('[data-ai=easy]');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 10000 });
  await p1.waitForTimeout(3500);
  await p1.click('[data-emo="1"]'); await p1.waitForSelector('.emote.me', { timeout: 5000 });
  await p1.screenshot({ path: OUT + '/ai2-fight.png' });
  console.log('✓ duel emote shown');
  await p1.waitForSelector('#pr-again', { timeout: 150000 });
  await p1.screenshot({ path: OUT + '/ai3-result.png' });
  const won = serverProfile(777).stats.aiWins || 0;
  console.log(`✓ AI duel: ${won ? 'won, +' + (serverProfile(777).coins - k0) + ' coins' : 'lost, no coins lost'} (${serverProfile(777).coins >= k0})`);
  assert.ok(serverProfile(777).coins >= k0, 'AI duel never costs coins');
  await p1.click('#pr-arena');

  // ---- clans: Sara creates one, Lina joins from the invite link ----
  serverProfile(777).coins += 2500;
  await p1.click('[data-tab=rank]'); await p1.click('#to-clan'); await p1.waitForSelector('#cl-create');
  await p1.fill('#cl-name', 'Night Owls'); await p1.click('[data-emb="🦅"]'); await p1.click('#cl-create');
  await p1.waitForSelector('#cl-invite'); await p1.click('#cl-invite');
  const clanId = Object.keys(srv.db.clans)[0];
  assert.ok((await p1.evaluate(() => window.__shared)).includes(encodeURIComponent(`startapp=clan_${clanId}`)), 'clan link shared');
  const lina = { id: 999, first_name: 'Lina' };
  const p3 = await player(lina, 'clan_' + clanId);
  await p3.waitForSelector('#cj-yes'); await p3.screenshot({ path: OUT + '/c1-invite.png' }); await p3.click('#cj-yes');
  await p3.waitForSelector('#cl-leave'); await p3.waitForTimeout(200);
  assert.equal(srv.db.clans[clanId].members.length, 2);
  await p3.screenshot({ path: OUT + '/c2-clan.png', fullPage: true });
  await p3.evaluate(() => window.__bbcb()); await p3.waitForTimeout(150);
  assert.equal(await p3.evaluate(() => S.tab), 'rank', 'back from the clan goes to Ranks');
  await p1.click('#m-close').catch(() => {}); await p1.click('[data-tab=rank]'); await p1.click('#to-clan'); await p1.waitForSelector('.crow');
  await p1.screenshot({ path: OUT + '/c3-leader.png', fullPage: true });
  console.log('✓ clan created, invite link opened, member joined');

  // ---- community war: Sara joins Notcoin from the map banner, rallies with a story ----
  await dismiss(p1);
  await p1.click('[data-tab=map]'); await p1.click('#to-war'); await p1.waitForSelector('#w-pick'); await p1.click('#w-pick');
  await p1.click('[data-fac=notcoin]'); await p1.click('#fac-ok');
  await p1.waitForSelector('#w-rally', { timeout: 10000 });
  assert.equal(serverProfile(777).faction, 'notcoin');
  await p1.click('[data-wt=ranks]'); await p1.waitForSelector('.wrow.me');
  await p1.screenshot({ path: OUT + '/w5-war.png', fullPage: true });
  await p1.click('[data-wt=week]'); await p1.waitForSelector('#w-rally');
  const gw = serverProfile(777).gems;
  await p1.click('#w-rally'); await p1.waitForFunction(() => window.__story, null, { timeout: 10000 });
  const story = await p1.evaluate(() => window.__story);
  assert.match(story[0], /\/share\/777\.jpg\?v=/); assert.match(story[1].widget_link.url, /startapp=ref_777/);
  const img = await fetch(story[0].replace(/^https?:\/\/[^/]+/, base)); assert.equal(img.status, 200); assert.ok((await img.arrayBuffer()).byteLength > 20000, 'share card image drawn');
  await p1.waitForTimeout(500); assert.equal(serverProfile(777).gems, gw + 3, 'daily share reward');
  fs.writeFileSync(OUT + '/w6-story.jpg', Buffer.from(await (await fetch(story[0].replace(/^https?:\/\/[^/]+/, base))).arrayBuffer()));
  console.log('✓ community joined, war standings, story share card uploaded (+3 gems)');

  // ---- territories, captain, daily goal, prediction ----
  for (let i = 0; i < 5; i++) srv.war.onWin('777', 'stage', { stage: 3 }); // Notcoin holds world 1
  for (let i = 0; i < 30; i++) srv.war.onWin('777', 'ai');                  // daily goal reached
  srv.db.war.captains.notcoin = { uid: '777', name: 'Sara', pts: 50 };       // Sara is this week's captain
  await p1.evaluate(async () => { await loadWar(); WAR_TAB = 'week'; show('war'); }); await p1.waitForSelector('[data-cry]');
  await p1.click('[data-cry=might]'); await p1.waitForTimeout(400);
  assert.equal(srv.db.war.cries.notcoin, 'might');
  const gGoal = serverProfile(777).gems;
  await p1.click('#w-goal'); await p1.waitForSelector('#gm-ok'); await p1.click('#gm-ok');
  assert.equal(serverProfile(777).gems, gGoal + 5, 'daily goal reward');
  if (await p1.$('[data-pred]')) { await p1.click('[data-pred=notcoin]'); await p1.click('#pd-yes'); await p1.waitForTimeout(300); assert.equal(srv.db.users['777'].pred.f, 'notcoin'); }
  await p1.screenshot({ path: OUT + '/w7-week.png', fullPage: true });
  await p1.click('[data-wt=map]'); await p1.waitForSelector('.terr.mine');
  await p1.screenshot({ path: OUT + '/w8-territories.png', fullPage: true });
  await p1.click('[data-tw="0"]'); await p1.waitForSelector('.world-owner.mine');
  assert.match(await p1.textContent('.tag.gold'), /🏰/, 'territory bonus shown on the stage reward');
  await p1.screenshot({ path: OUT + '/w9-map-owner.png' });
  console.log('✓ captain picked a battle cry, daily goal claimed, territory held and shown on the map');

  // ---- friends, world boss, league, partner quests, featured + frames, wallet ----
  await p1.evaluate(() => show('friends')); await p1.waitForSelector('.ref-tiers');
  await p1.screenshot({ path: OUT + '/x1-friends.png', fullPage: true });
  serverProfile(777).cleared = Math.max(serverProfile(777).cleared, 12);
  await p1.evaluate(async () => { await syncServerProfile(); S.auto = true; S.speed = 3; save(); show('raid'); }); await p1.waitForSelector('#rd-go');
  await p1.screenshot({ path: OUT + '/x2-raid.png', fullPage: true });
  await p1.click('#rd-go'); await p1.waitForSelector('.raid-hud'); await p1.waitForTimeout(2500);
  await p1.screenshot({ path: OUT + '/x3-raid-fight.png' });
  await p1.waitForSelector('#rd-ok', { timeout: 40000 });
  await p1.screenshot({ path: OUT + '/x4-raid-result.png' });
  assert.ok(srv.db.raid.total['777'] > 0, 'boss damage recorded'); await p1.click('#rd-ok');
  console.log('✓ world boss fight verified by the server:', srv.db.raid.total['777'], 'damage');
  await p1.evaluate(() => show('arena')); await p1.waitForSelector('.league-panel');
  await p1.click('.league-panel'); await p1.waitForSelector('.ref-tiers'); await p1.screenshot({ path: OUT + '/x5-league.png' }); await p1.click('#m-close');
  srv.db.partners.push({ id: 9, title: 'Join the DOGS channel', url: 'https://t.me/dogs_community', chat: null, gems: 15, coins: 0, until: Date.now() + 864e5, at: Date.now() });
  await p1.evaluate(() => show('quests')); await p1.waitForSelector('.pq');
  await p1.screenshot({ path: OUT + '/x6-partner.png' });
  serverProfile(777).gems += 300;
  await p1.evaluate(async () => { await syncServerProfile(); show('chest'); }); await p1.waitForSelector('.featured');
  await p1.click('[data-frame=neon]'); await p1.waitForTimeout(500);
  assert.equal(serverProfile(777).cos.on, 'neon', 'frame bought with gems');
  await p1.evaluate(() => document.querySelector('.frames-shop').scrollIntoView()); await p1.screenshot({ path: OUT + '/x7-frames.png' });
  await p1.evaluate(() => { show('heroes'); }); await p1.waitForSelector('.card.skin-neon');
  await p1.evaluate(() => walletModal()); await p1.waitForSelector('#w-on');
  await p1.screenshot({ path: OUT + '/x8-wallet.png' }); await p1.click('#m-close');
  console.log('✓ friends, league panel, partner quest, featured hero, card frame, wallet screen');
  await p1.evaluate(() => show('rank')); await p1.waitForSelector('#to-profile'); await p1.click('#to-profile'); await p1.waitForSelector('#pf-name');
  await p1.fill('#pf-name', 'SaraLegend'); await p1.click('#pf-save'); await p1.waitForTimeout(500);
  assert.equal(srv.db.users['777'].nick, 'SaraLegend');
  await p1.click('#to-profile'); await p1.waitForSelector('[data-av]'); await p1.click('[data-av]'); await p1.waitForTimeout(400);
  assert.ok(serverProfile(777).avatar, 'avatar chosen'); await p1.waitForSelector('.avatar.has-img img');
  await p1.screenshot({ path: OUT + '/x9-profile.png' });
  // channel gate (rendered with a fake channel)
  await p1.evaluate(() => { Online.state.channel = { url: 'https://t.me/gl', joined: false, coins: 500, gems: 20 }; channelGate(); }); await p1.waitForSelector('#ch-check');
  await p1.screenshot({ path: OUT + '/x10-channel.png' }); await p1.evaluate(() => closeModal());
  console.log('✓ game name + card avatar, channel join screen');
  await p1.evaluate(() => show('fund')); await p1.waitForSelector('.fund-row');
  await p1.screenshot({ path: OUT + '/x11-fund.png', fullPage: true });
  console.log('✓ community fund page');

  // ---- skill modes: daily challenge, tower, draft and ghost duels ----
  await p1.evaluate(async () => { closeModal(); await syncServerProfile(); S.auto = true; S.speed = 3; save(); show('arena'); });
  await p1.waitForSelector('#to-chal'); await p1.click('#to-chal'); await p1.waitForSelector('#ch-go');
  await p1.screenshot({ path: OUT + '/y1-challenge.png', fullPage: true });
  await p1.click('#ch-go'); await p1.waitForSelector('#md-ok', { timeout: 90000 });
  await p1.screenshot({ path: OUT + '/y2-challenge-result.png' });
  assert.ok(srv.db.challenge.scores[ECON.day(Date.now())]['777'], 'challenge score on the server'); await p1.click('#md-ok');
  console.log('✓ daily challenge played and ranked');
  serverProfile(777).cleared = Math.max(serverProfile(777).cleared, 25);
  await p1.evaluate(async () => { await syncServerProfile(); show('tower'); }); await p1.waitForSelector('#tw-go');
  await p1.click('#tw-go'); await p1.waitForSelector('#md-ok', { timeout: 90000 });
  await p1.screenshot({ path: OUT + '/y3-tower-result.png' });
  assert.ok(srv.db.users['777'].tower.best >= 1 || srv.db.users['777'].tower.run === null, 'tower floor verified'); await p1.click('#md-ok');
  console.log('✓ tower floor fought and verified');
  // draft duel between two players: picks from one pool, then a live duel
  for (const [p, id] of [[p1, 777], [p2, 888]]) { serverProfile(id).coins = Math.max(serverProfile(id).coins, 1000); serverProfile(id).cleared = Math.max(serverProfile(id).cleared, 25); await p.evaluate(async () => { closeModal(); await syncServerProfile(); S.stake = 100; save(); show('arena'); }); }
  await p1.click('#pv-draft'); await p1.waitForTimeout(300); await p2.click('#pv-draft');
  await p1.waitForSelector('.draft-pool'); await p2.waitForSelector('.draft-pool');
  await p1.screenshot({ path: OUT + '/y4-draft.png' });
  const firstPicker = (await p1.$('.draft-turn.me')) ? p1 : p2;
  await firstPicker.click('[data-dpick]:not([disabled])');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 30000 }); // the rest is auto-picked by the timer
  assert.equal(await p1.evaluate(() => BT.B.heroes.length), 4, 'draft decks of 4');
  await p1.waitForSelector('#pr-arena', { timeout: 150000 }); await p2.waitForSelector('#pr-arena, #pr-map', { timeout: 150000 });
  await p1.click('#pr-arena'); await p2.click('#pr-map').catch(() => p2.click('#pr-arena'));
  console.log('✓ draft duel: picks, then a live duel');
  // ghost duel: a real player's saved deck
  await p1.waitForSelector('[data-ai=ghost]'); await p1.click('[data-ai=ghost]');
  await p1.waitForSelector('#battle:not([hidden]) .hcard', { timeout: 15000 });
  assert.match(await p1.textContent('.b-name.opp'), /👻|🤖/);
  await p1.waitForSelector('#pr-arena, #pr-map, #pr-ai', { timeout: 150000 }).catch(() => {});
  await p1.evaluate(() => { closeModal(); if (BT) leaveBattle(); show('map'); });
  console.log('✓ ghost duel');

  // ---- Telegram BackButton still drives navigation ----
  await p2.click('[data-tab=heroes]'); await p2.waitForTimeout(150);
  await p2.evaluate(() => window.__bbcb()); await p2.waitForTimeout(150);
  assert.equal(await p2.evaluate(() => S.tab), 'map');
  console.log('✓ Telegram BackButton');

  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); srv.stop(); fake.close(); cg.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
