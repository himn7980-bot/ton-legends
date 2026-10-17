// Feature test (offline build): Fusion Lab, holo cards, guide, language picker incl. RTL.
// usage: node tools/feature-test.js <dist html> <screenshot dir>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const assert = require('assert');
(async () => {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ru-RU' });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/telegram\.org|fonts\.g/, r => r.abort());
  await p.goto('file://' + file); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => LANG), 'ru', 'auto-detected phone language');
  console.log('✓ language auto-detected from the device (ru)');
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(600); if (await p.$('#modal:not([hidden])')) await p.click('#m-close'); } // help → daily reward
  assert.equal(await p.evaluate(() => S.faction), null, 'no community picker before the first battle');
  await p.evaluate(() => { PICK_ASKED = true; }); // (the picker after the first win is tested below)
  // fusion: pick any heroes you own and pay coins — no level rules, heroes are kept
  await p.evaluate(() => { Object.assign(S.owned, { notcoin: 12, pinkbull: 4, egor: 3, memegram: 5, yoda: 1 }); S.coins = 50000; S.holo.pinkbull = true; save(); showCoins(); });
  await p.click('[data-tab=heroes]'); await p.waitForTimeout(200);
  assert.equal(await p.$('#to-lab'), null, 'Fusion Lab locked before world 4');
  await p.screenshot({ path: out + '/l0-lab-locked.png' });
  await p.evaluate(() => { S.cleared = 70; save(); refresh(); }); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l1-heroes-ru.png' });
  await p.click('#to-lab'); await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/l2-lab-empty.png', fullPage: true });
  assert.ok((await p.$$('[data-craft]')).length > 0, 'ready-to-craft suggestions');
  const pick = async ids => { for (const id of ids) { await p.click('.altar-slot:not(.filled)'); await p.click(`[data-pick=${id}]`); await p.waitForTimeout(150); } };
  // low-level heroes fuse just fine now
  await pick(['gramcat', 'babyshark']);
  assert.match(await p.textContent('.fresult'), /#81/);
  assert.equal(await p.$eval('#lab-fuse', b => b.disabled), false, 'any pair can fuse');
  await p.screenshot({ path: out + '/l2b-lab-pair.png' });
  await p.click('.altar-slot.filled'); await p.click('.altar-slot.filled');
  // the player's own pick: Pink Bull + Notcoin → #1 Golden Bull at level (4 + 12) / 2 = 8
  await pick(['pinkbull', 'notcoin']);
  assert.match(await p.textContent('.fresult'), /Golden Bull/);
  await p.screenshot({ path: out + '/l2c-lab-ready.png' });
  await p.click('#lab-fuse'); await p.waitForSelector('#fr-ok');
  await p.screenshot({ path: out + '/l3-fused.png' });
  await p.click('#fr-ok');
  assert.equal(await p.evaluate(() => S.owned.f1), 8); assert.deepEqual(await p.evaluate(() => [S.owned.pinkbull, S.owned.notcoin]), [4, 12], 'heroes kept');
  // picking the same pair again shows "owned" instead of failing
  await pick(['pinkbull', 'notcoin']); assert.ok(await p.$('#lab-open'), 'owned card opens instead of an error');
  await p.click('.altar-slot.filled'); await p.click('.altar-slot.filled');
  // trio straight away (no duo needed), filled by tapping the hero picker
  await pick(['egor', 'memegram', 'yoda']);
  await p.click('#lab-fuse'); await p.waitForSelector('#fr-ok'); await p.click('#fr-ok');
  await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l3b-lab-mine.png', fullPage: true });
  assert.equal(await p.evaluate(() => S.owned.f440), 3, 'trio starts at (3 + 5 + 1) / 3');
  assert.equal(await p.evaluate(() => S.coins), 50000 - 5000 - 20000);
  // a third fusion: craft it from a suggestion chip
  await p.click('[data-craft]'); await p.waitForSelector('#lab-fuse'); await p.click('#lab-fuse'); await p.waitForSelector('#fr-ok'); await p.click('#fr-ok');
  console.log('✓ fusion: any heroes, coins only, heroes kept, average level, suggestions, no error states');
  assert.equal(await p.evaluate(async () => { try { await act({ type: 'team', team: ['f1', 'f440', S.team.find(id => !id.startsWith('f')), Object.keys(S.owned).find(id => id.startsWith('f') && id !== 'f1' && id !== 'f440')] }); return 'ok'; } catch (e) { return e.message; } }), 'fusion_limit');
  // fusion in team and fights
  await p.evaluate(async () => { await act({ type: 'team', team: ['f1', 'f440', 'babyshark'] }); S.auto = true; S.speed = 3; S.sel = 0; S.world = 0; save(); });
  await p.click('[data-tab=map]'); await p.click('#go'); await p.waitForTimeout(2500);
  await p.screenshot({ path: out + '/l4-fusion-battle.png' });
  await p.waitForSelector('#r-map', { timeout: 60000 }); await p.click('#r-map');
  console.log('✓ fusion cards battle (both parts’ skills)');
  await p.click('[data-tab=heroes]'); await p.click('.card[data-id=f1]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l5-fusion-detail.png' });
  // alliance card: the first hero picked in the lab leads; tap another member to change the leader
  const lead0 = await p.evaluate(() => ECON.leaderOf(S, 'f1'));
  await p.click('.ally-m[data-lead]'); await p.waitForTimeout(250);
  const lead1 = await p.evaluate(() => ECON.leaderOf(S, 'f1'));
  assert.equal(lead0, 'pinkbull', 'first pick leads'); assert.notEqual(lead0, lead1, 'leader changed'); assert.ok(await p.$('.ally-m.lead'));
  await p.screenshot({ path: out + '/l5b-alliance-leader.png' });
  console.log('✓ alliance card: leader', lead0, '→', lead1);
  await p.click('#m-close'); await p.waitForTimeout(200);
  assert.ok(await p.$('.syn-strip'), 'deck synergies shown');
  await p.click('#syn-info'); await p.waitForSelector('.syn-row'); await p.screenshot({ path: out + '/l5c-synergies.png' });
  const synOk = await p.evaluate(() => { const a = deckSynergies(['notcoin', 'volya', 'noctis', 'babyshark', 'yaya']).ids, b = deckSynergies(['gramcat', 'utya', 'memegram']).ids; return a.includes('wall') && a.includes('balance') && b.includes('exposed'); });
  assert.ok(synOk, 'synergies: wall/balance on, exposed back row flagged');
  await p.click('#m-close'); await p.waitForTimeout(200);
  await p.click('.card[data-id=f1]'); await p.waitForTimeout(200);
  console.log('✓ deck synergies + power preview');
  await p.evaluate(() => { closeModal(); show('heroes'); }); await p.waitForSelector('.deck-switch');
  const t1 = await p.evaluate(() => S.team.join());
  await p.click('[data-deck="1"]'); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => S.deck), 1); assert.equal(await p.evaluate(() => S.team.join()), t1, 'new deck starts as a copy');
  await p.evaluate(async () => { await act({ type: 'team', team: [S.team[0]] }); refresh(); });
  await p.click('[data-deck="0"]'); await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => S.team.join()), t1, 'deck 1 untouched');
  await p.screenshot({ path: out + '/l5d-decks.png' });
  console.log('✓ five saved decks, one-tap switch');
  await p.evaluate(() => { closeModal(); show('heroes'); }); await p.waitForSelector('#dk-clear');
  await p.click('#dk-clear'); await p.waitForTimeout(250); assert.equal(await p.evaluate(() => S.team.length), 0, 'deck cleared');
  await p.click('.grid .card .qd'); await p.waitForTimeout(250); assert.equal(await p.evaluate(() => S.team.length), 1, '+ adds a card');
  assert.ok(await p.$('.grid .card.in-deck .qd.in'), 'card in deck dimmed with − button');
  await p.click('#dk-rand'); await p.waitForTimeout(250); assert.ok(await p.evaluate(() => S.team.length >= 3 && !teamError(S.team)), 'random deck is valid');
  await p.click('#dk-best'); await p.waitForTimeout(400);
  const best = await p.evaluate(() => ({ len: S.team.length, ok: !teamError(S.team), front: S.team.slice(0, 2).map(id => HERO_BY_ID[id].role) }));
  assert.ok(best.len === 5 && best.ok, JSON.stringify(best));
  await p.screenshot({ path: out + '/l5e-quickdeck.png' });
  console.log('✓ deck tools: clear, random, best; ＋/− quick add', best.front.join('/'));
  await p.click('.card[data-id=f1]'); await p.waitForTimeout(200);
  await p.click('#m-close');
  await p.click('.card[data-id=pinkbull]'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l6-holo.png' }); await p.click('#m-close');
  // ---------- review fixes ----------
  // community picker after the first win: owned cards marked, switch cost stated
  await p.evaluate(() => { S.faction = null; PICK_ASKED = false; closeModal(); showStageResult(0, { result: 'win', coins: 10, first: false, unlocked: [] }); });
  await p.click('#r-map'); await p.waitForSelector('#fac-ok');
  assert.ok(await p.$('.fac-own'), 'owned community cards marked'); assert.match(await p.textContent('.modal-box'), /💎 100/);
  await p.screenshot({ path: out + '/r1-picker.png' });
  await p.click('#m-close'); await p.waitForTimeout(200);
  console.log('✓ community picker after the first win (owned marked, switch cost shown)');
  // hero card: upgrade/deck actions at the top, removing shows its power cost on the button
  await p.evaluate(() => { closeModal(); show('heroes'); }); await p.click(`.card[data-id=${await p.evaluate(() => S.team[0])}]`); await p.waitForSelector('.hero-actions');
  assert.ok(await p.evaluate(() => { const a = document.querySelector('.hero-actions'), st = document.querySelector('.modal-box .stats'); return a.compareDocumentPosition(st) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'actions above the stats');
  assert.ok(await p.$('#tm .lose'), 'remove button shows the power it costs'); assert.equal(await p.$('.modal-box .pdelta'), null, 'no red preview under the stats');
  await p.screenshot({ path: out + '/r2-hero-actions.png' }); await p.click('#m-close');
  // shards: a high-level duplicate becomes shards that pay for the next upgrade
  const sh = await p.evaluate(() => { const id = S.team[0]; S.shards[id] = 100; save(); return { coins: ECON.upgradeCoins(S, id, S.owned[id]), price: ECON.upgradePrice(S, id, S.owned[id]) }; });
  assert.equal(sh.coins, sh.price - 100, 'shards lower the coin cost');
  // defeat: ways to get coins
  await p.evaluate(() => { S.dq.p.wins = 99; S.afkSince = Date.now() - 5 * 3600e3; save(); showStageResult(5, { result: 'lose', stage: 5, unlocked: [] }); });
  await p.waitForSelector('.get-coins'); assert.ok((await p.$$('.gc-row')).length >= 2, 'several ways to get coins');
  await p.screenshot({ path: out + '/r3-defeat-coins.png' });
  await p.click('#gc-afk'); await p.waitForTimeout(300); assert.match(await p.textContent('#gc-afk'), /✓/);
  await p.click('#r-heroes'); await p.waitForTimeout(200);
  console.log('✓ hero actions on top, shards, defeat → get coins');
  // quests: claim all + badge count; achievements folded
  await p.evaluate(() => { S.dq.p = { wins: 99, skills: 99, upgrades: 99, chests: 99 }; S.dq.c = {}; S.afkSince = Date.now() - 5 * 3600e3; save(); show('quests'); });
  assert.match(await p.getAttribute('#nav [data-tab=quests]', 'data-n'), /^\d|9\+/);
  await p.waitForSelector('#claim-all'); const c0 = await p.evaluate(() => S.coins);
  assert.ok(await p.$('#ach-more'), 'achievements folded behind "show all"');
  await p.click('#claim-all'); await p.waitForSelector('#gm-ok'); assert.ok(await p.evaluate(c => S.coins > c, c0), 'claim all paid');
  await p.screenshot({ path: out + '/r4-claim-all.png' }); await p.click('#gm-ok');
  console.log('✓ quests: claim all, badge count, folded achievements');
  // map: Fight stays reachable; one goal banner; features open step by step
  await p.evaluate(() => { S.cleared = 3; S.world = 0; S.sel = 3; save(); show('map'); });
  assert.ok(await p.$('.fight-bar #go')); assert.ok((await p.$$('.goal-banner, .next-unlock, .rookie-banner')).length <= 1, 'one goal banner');
  assert.equal(await p.$('.deck-switch'), null, 'saved decks open in world 3'); assert.equal(await p.$('#to-raid'), null, 'world boss locked');
  await p.screenshot({ path: out + '/r5-map-early.png' });
  await p.evaluate(() => show('quests')); assert.equal(await p.$('#to-pass'), null, 'season pass opens after 5 stages'); assert.ok(await p.$('.lock-note'), 'achievements locked note');
  await p.evaluate(() => { S.cleared = 70; save(); show('map'); });
  console.log('✓ map: sticky Fight, single goal banner, step-by-step unlocks');
  // Persian: the "·" separator is shown as "•" (Persian zero looks like a dot)
  await p.click('#settings'); await p.click('#s-lang'); await p.click('[data-lang=fa]'); await p.waitForTimeout(150); await p.click('#m-close');
  await p.evaluate(() => show('chest')); await p.waitForTimeout(100);
  assert.ok(!(await p.textContent('#screen')).includes('·'), 'no "·" in Persian');
  await p.screenshot({ path: out + '/r6-fa-chest.png', fullPage: true });
  console.log('✓ Persian separator');
  // languages
  for (const code of ['ar', 'zh', 'hi', 'en']) {
    await p.click('#settings'); await p.click('#s-lang'); await p.click(`[data-lang=${code}]`); await p.waitForTimeout(150);
    await p.click('#m-close'); await p.click('[data-tab=map]'); await p.waitForTimeout(150);
    const dir = await p.evaluate(() => document.documentElement.dir);
    assert.equal(dir, code === 'ar' ? 'rtl' : 'ltr');
    await p.screenshot({ path: `${out}/l7-map-${code}.png` });
  }
  console.log('✓ language switch ar (RTL) / zh / hi / en');
  await p.click('#settings'); await p.click('#s-guide'); await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/l8-guide.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await b.close(); process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
