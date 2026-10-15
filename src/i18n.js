// TON Legends — translations (English default, Persian optional)
const I18N = {
  en: {
    dir: 'ltr', locale: 'en-US',
    rarity: { C: 'Common', R: 'Rare', E: 'Epic', L: 'Legendary', M: 'Mythic', X: 'Cosmic' },
    role: { tank: 'Tank', warrior: 'Warrior', assassin: 'Assassin', archer: 'Archer', mage: 'Mage', control: 'Control', healer: 'Healer', support: 'Support' },
    world: { ocean: 'Deep Ocean', cave: 'Crystal Cave', city: 'Neon City', temple: 'Lantern Temple', lab: 'Green Lab' },
    hero: {
      pinkbull:  ['Gold Rush Titan', 'Earthquake', '150% damage to all enemies and stuns them for 1.5s'],
      notcoin:   ['Golden Sentinel', 'Golden Shield', 'Gives every ally a shield worth 25% of their own max HP (shields fade after 6s)'],
      volya:     ['Guardian of the Legends', 'Laser Eyes', '450% damage to the strongest enemy'],
      egor:      ['Crystal Miner', 'Armor Break', '250% damage; target takes 30% more damage for 5s. (+10% coins)'],
      paws:      ['Lunar Paw Striker', 'Fire Paw', 'Three 140% hits on the front enemy'],
      noctis:    ['The Hidden Signal', 'Shadow Strike', '500% damage to the weakest enemy and dodges for 3s'],
      gramcat:   ['Sky Archer', 'Piercing Arrow', '170% damage to all enemies'],
      utya:      ['Frost Wing Scout', 'Ice Rain', '140% damage to all enemies and slows them for 3s'],
      pengu:     ['Polar Tech Ranger', 'Deep Freeze', '90% damage to all enemies and freezes them for 2.5s'],
      memegram:  ['Star Mage', 'Star Burst', '220% damage to all enemies'],
      yoda:      ['Ancient Wisdom Sage', 'Mind Force', '190% damage to all enemies and delays their attacks'],
      virus:     ['Green Alchemist', 'Toxic Brew', 'Poisons all enemies (60%/s for 5s) and weakens their attack by 25%'],
      babyshark: ['Spirit of the Ocean', 'Healing Whirlpool', 'Heals all allies for 250%'],
      yaya:      ['Lantern Keeper', 'Magic Lantern', '+40% team attack for 6s and a small heal'],
      dog:       ['Magic Courier', 'Express Letter', 'Gives all allies 50 energy'],
      teddy:     ['The Soft Boss', 'Golden Hug', 'Heals the weakest ally for 350% and shields them. (+20% coins)'],
    },
    t: {
      map: 'Map', heroes: 'Heroes', chest: 'Chests', quests: 'Quests', rank: 'Ranks',
      worldOf: (a, b) => `World ${a} of ${b}`, stage: s => `Stage ${s}`, boss: 'Boss', bossCrown: 'Boss 👑',
      firstX2: ' · first clear ×2', yourTeam: p => `Your deck · power ${p}`, editTeam: '✏️ Edit deck',
      fight: '⚔️ Fight!', allDone: '🏆 You cleared every stage! You can replay any stage.', enemyCards: 'Enemy cards',
      battleTeam: 'Battle deck', power: 'power', collection: 'Collection', level: l => `Lv ${l}`, inTeam: 'In deck',
      hp: 'HP', atk: 'Attack', lvl: 'Level', of: n => `of ${n}`, special: '⚡ Special skill:',
      upgrade: c => `⬆️ Upgrade · 🪙 ${c}`, maxLevel: 'Max level', leaveTeam: 'Remove from deck', teamFull: 'Deck is full', joinTeam: 'Add to deck',
      getFromChest: 'Get this hero from a <b>chest</b> 🎁', goChest: 'Go to chests',
      chestTitle: 'Hero Chests', chestNote: 'Win new heroes! Duplicates level that hero up.',
      basicChest: 'Basic Chest', royalChest: 'Royal Chest', open: c => `Open · 🪙 ${c}`,
      newHero: '✨ New hero!', addedTeam: ' (added to deck)', dupe: l => `Duplicate · now level ${l} ⬆️`, maxRefund: c => `Max level · 🪙 ${c} refunded`,
      ok: 'OK', again: c => `Again · 🪙 ${c}`,
      shop: '⭐ Coin Shop', shopNote: 'Pay with Telegram Stars', coinTip: '💡 Earn coins by winning stages, quests and daily rewards. Egor and Teddy bring extra coins.',
      bought: 'Purchase complete!', paid: 'Payment received', paidNote: 'Your coins will arrive in a moment.', buyErr: 'Purchase failed', buyErrNote: 'Could not reach the server. Please try again.',
      auto: '⚡ Auto', tapHint: 'When a card glows ⚡ tap it to unleash its special skill',
      dodge: 'Dodge!', shield: '🛡️ Shield', bossAtk: '⚠️ Boss attack!',
      victory: 'Victory!', worldDone: w => `· “${w}” conquered!`, firstBonus: 'First clear bonus ×2',
      toMap: 'Map', replay: '🔁 Replay', next: 'Next stage →', defeat: 'Defeat!',
      defeatTip: '<b>Upgrade</b> your heroes, open <b>chests</b> for new ones, or replay earlier stages to earn coins.', retry: '🔁 Try again',
      welcome: 'Welcome to TON Legends!',
      help1: '🃏 Build a deck of 5 hero cards.',
      help2: '⚔️ Cards fight automatically. When a card <b style="color:var(--gold)">glows ⚡</b>, tap it to use its special skill. Enemy cards use skills too!',
      help3: '🪙 Win coins, <b>upgrade</b> your heroes and open <b>chests</b> to collect new cards.',
      help4: '🗺️ 20 worlds, 200 stages — and a boss card waits at the end of each world!',
      letsGo: "Let's go!",
      dailyTitle: '📅 Daily login reward', dailySub: 'Come back every day!', day: d => `Day ${d}`, chestShort: 'Chest',
      claimToday: "Claim today's reward", comeBack: 'Come back tomorrow ⏳', dayReward: d => `Day ${d} reward`,
      idleTitle: '💤 Idle chest', perHour: n => `${n} coins / hour`, idleNote: h => `Your heroes keep earning coins while you're away (up to ${h} hours).`, claim: c => `Claim 🪙 ${c}`,
      todayQuests: "🎯 Today's quests", achievements: '🏅 Achievements',
      dq: { wins: 'Win 3 battles', skills: 'Use 15 special skills', upgrades: 'Upgrade heroes 2 times', chests: 'Open 1 chest' },
      ach: { win: n => `Win ${n} battles`, world: n => `Conquer world ${n}`, heroes: n => `Collect ${n} heroes`, level: n => `Get a hero to level ${n}`, chest: n => `Open ${n} chests`, skill: n => `Use ${n} special skills` },
      great: 'Awesome!', giftTitle: 'You got a gift!', giftNote: 'From your invites or purchases.',
      player: 'Hero', stageOf: (a, b, p) => `Stage ${a} of ${b} · power ${p}`, wins: 'Wins', bossesBeaten: 'Bosses beaten',
      invite: '🤝 Invite friends', inviteNote: 'For every friend who joins with your link you get 500 coins, and they get 300 coins as a gift.', sendInvite: 'Send invite link',
      inviteText: "Let's play TON Legends together! ⚔️ Get 300 bonus coins with this link:",
      leaderboard: '🏆 Leaderboard', loading: 'Loading…', boardOffline: 'The leaderboard is available when you open the game from the Telegram bot.',
      boardErr: 'Could not load the leaderboard.', boardEmpty: 'Nobody here yet — be the first!', you: 'You', players: n => `${n} players`,
      arena: 'Arena', arenaTitle: '⚔️ PvP Arena',
      arenaNote: 'Duel a real player live. You both put in the same stake — the winner takes the whole pot. A draw returns both stakes.',
      stake: 'Your stake', pot: p => `Pot 🪙 ${p}`, findOpp: '🎯 Find opponent', challenge: '🤝 Challenge a friend',
      haveCode: 'Got an invite code?', codePh: 'CODE', join: 'Join', record: (w, l) => `Arena record: ${w} wins · ${l} losses`,
      arenaOffline: 'The arena works when you open the game from the Telegram bot.', arenaRules: '⚠️ Coins you stake are held until the duel ends. If you leave mid-duel, your cards keep fighting on auto.',
      searching: 'Searching for an opponent…', waitingFriend: 'Waiting for your friend to join…', inviteCode: 'Invite code', sendDuel: '📨 Send invite', cancel: 'Cancel',
      duelText: c => `⚔️ I challenge you to a TON Legends duel for ${c} coins — winner takes all!`,
      challengedBy: h => `${h} challenges you!`, accept: '⚔️ Accept', decline: 'Decline', theirPower: p => `Their deck power: ${p}`,
      arenaWin: 'You won the duel!', arenaLose: 'You lost the duel', arenaDraw: 'Draw — stakes returned', toArena: '⚔️ Arena', ready: 'Get ready!',
      pvpLeaveNote: 'Your cards will keep fighting on auto and the result still counts.', arenaWins: 'Arena wins',
      err: { no_coins: 'Not enough coins', busy: 'You already have a duel in progress', room_gone: 'This duel is no longer available', own_room: "That's your own invite",
        bad_stake: 'Invalid stake', bad_team: 'Put at least one hero in your deck', locked: 'This stage is locked', claimed: 'Already claimed',
        not_ready: 'Not ready yet', cannot_upgrade: 'Cannot upgrade', sold_out: 'This edition is sold out', need_parts: 'Level up the parts first', network: 'Connection problem — please try again', no_profile: 'Still connecting — try again' },
      altarHint: 'Pick 2 or 3 of your heroes — the card they make appears here.', slotOptional: '3rd (optional)', pickHero: 'Pick a hero',
      chkLevel: l => `All heroes level ${l}+`, chkCoins: c => `${c} coins`, chkNew: 'New for your collection', rulesTitle: '📜 Alliance rules', copies: n => `${n} copies worldwide`,
      myFusions: '🤝 My alliance cards', noFusions: 'No alliance cards yet — fill the slots above and form an alliance!',
      labTitle: '🤝 Alliance Lab', openLab: '🤝 Alliance Lab',
      labNote: 'Unite heroes you own into an Alliance card — their communities fight together. Its special skill fires ALL members\' skills at once. Every alliance is a numbered limited edition — when the worldwide supply runs out, nobody can craft it again.',
      duo: '💗 Duo alliances · Mythic', trio: '💎 Trio alliances · Cosmic', needs: l => `Parts at level ${l}+`, fuse: c => `🤝 Form alliance · 🪙 ${c}`,
      left: (a, b) => `${a} / ${b} left`, soldOut: 'Sold out', ownedTag: 'Owned', fused: 'Alliance formed!', serialOf: (s, m) => `Serial #${s} of ${m}`,
      fusionTitle: names => `Alliance of ${names}`, fusionDesc: 'Fires every member\'s skill at once:',
      holo: 'HOLO', holoNew: '🌈 HOLO card! An ultra-rare shimmering variant.', holoCount: (a, b) => `🌈 Holo ${a}/${b}`,
      guide: '📖 Game guide', guideTitle: '📖 How TON Legends works', readGuide: '📖 Read the full guide',
      guideSections: [
        ['⚔️ Battles', 'Your 5 cards fight automatically. Each card fills its blue energy bar by attacking and taking hits; when it glows ⚡, tap it to fire its special skill. Turn on Auto to let cards fire skills by themselves.'],
        ['🛡️ Roles', 'Tanks absorb hits, Warriors and Assassins hit hard, Archers and Mages damage several enemies, Healers and Supports keep their allies alive. A balanced deck beats five attackers.'],
        ['💎 Rarity', 'Common, Rare, Epic and Legendary cards drop from chests. Mythic (duo) and Cosmic (trio) cards can only be crafted in the Alliance Lab. 3% of chest cards come out as shimmering Holo variants — pure bragging rights.'],
        ['🤝 Alliance Lab', 'Unite two or three heroes into an Alliance card — their communities fight together. You pick the leader (shown big on the card). Its skill fires all members\' skills together. Every community on the card earns war points when you win with it. Projects that really partner up can become an Official Alliance (+% power). Each card is a numbered limited edition: 300 copies of each duo and 30 of each trio — worldwide.'],
        ['🥊 Arena', 'Duel real players live. Both put the same coin stake into the pot; the winner takes it all and a draw refunds both. If you leave mid-duel, your cards keep fighting on auto.'],
        ['🪙 Coins & Stars', 'Earn coins from stages (×2 on first clear), daily rewards, quests, achievements and the idle chest. Spend them on upgrades, chests and alliances. Coin packs can also be bought with Telegram Stars; coins cannot be cashed out. Replaying a stage you already cleared pays half of the previous time (50%, 25%, 12.5%…).'],
        ['📅 Every day', 'Claim the 7-day login reward (day 7 = a free Royal Chest), finish the 4 daily quests and collect the idle chest — your heroes earn coins even while you are away.'],
        ['🛡️ Fair play', 'Inside Telegram your coins and cards live on the game server. Every win is re-checked by replaying the battle, so nobody can cheat their way to the top.'],
      ],
      leaveTitle: 'Leave the battle?', leaveNote: "You'll lose this fight's progress.", leave: 'Leave', stay: 'Keep fighting',
      settings: '⚙️ Settings', sfx: '🔊 Sound effects', music: '🎵 Music', language: '🌐 Language', howTo: '❓ How to play', show: 'Show',
      reset: '🗑️ Start over (erase all progress)', erase: 'Erase', sure: 'Sure? Tap again', version: 'TON Legends · v1.4', cloudOn: '· Telegram cloud save on ☁️', close: 'Close',
    },
  },
  fa: {
    dir: 'rtl', locale: 'fa-IR',
    rarity: { C: 'معمولی', R: 'کمیاب', E: 'حماسی', L: 'افسانه‌ای', M: 'اسطوره‌ای', X: 'کیهانی' },
    role: { tank: 'تانک', warrior: 'جنگجو', assassin: 'قاتل', archer: 'کماندار', mage: 'جادوگر', control: 'کنترل', healer: 'درمانگر', support: 'پشتیبان' },
    world: { ocean: 'اقیانوس عمیق', cave: 'غار کریستال', city: 'شهر نئونی', temple: 'معبد فانوس', lab: 'آزمایشگاه سبز' },
    hero: {
      pinkbull:  ['تایتان طلایی', 'زمین‌لرزه', '۱۵۰٪ آسیب به همه دشمنان و گیج کردن آن‌ها به مدت ۱.۵ ثانیه'],
      notcoin:   ['نگهبان طلایی', 'سپر طلایی', 'به همه‌ی هم‌تیمی‌ها سپری برابر ۲۵٪ جان حداکثر خودشان می‌دهد (سپرها بعد از ۶ ثانیه محو می‌شوند)'],
      volya:     ['نگهبان افسانه‌ها', 'پرتو لیزری', '۴۵۰٪ آسیب به قوی‌ترین دشمن'],
      egor:      ['معدنچی کریستال', 'شکستن زره', '۲۵۰٪ آسیب؛ دشمن ۵ ثانیه ۳۰٪ آسیب بیشتر می‌گیرد. (+۱۰٪ سکه)'],
      paws:      ['ضربه‌زن پنجه ماه', 'پنجه آتشین', 'سه ضربه‌ی ۱۴۰٪ به دشمن جلویی'],
      noctis:    ['سایه پنهان', 'ضربه سایه', '۵۰۰٪ آسیب به ضعیف‌ترین دشمن و ۳ ثانیه جاخالی دادن'],
      gramcat:   ['کماندار آسمان', 'تیر نافذ', '۱۷۰٪ آسیب به همه دشمنان'],
      utya:      ['پیشاهنگ بال یخی', 'باران یخ', '۱۴۰٪ آسیب به همه و کند کردن آن‌ها به مدت ۳ ثانیه'],
      pengu:     ['تکاور قطبی', 'انجماد', '۹۰٪ آسیب به همه و منجمد کردن ۲.۵ ثانیه'],
      memegram:  ['جادوگر ستاره', 'انفجار ستاره‌ای', '۲۲۰٪ آسیب به همه دشمنان'],
      yoda:      ['حکیم باستانی', 'نیروی ذهن', '۱۹۰٪ آسیب به همه و عقب انداختن حمله‌ی دشمنان'],
      virus:     ['کیمیاگر سبز', 'معجون سمی', 'سم روی همه (۶۰٪ در ثانیه، ۵ ثانیه) و ۲۵٪ کاهش حمله‌ی دشمنان'],
      babyshark: ['روح اقیانوس', 'گرداب شفا', '۲۵۰٪ درمان برای همه هم‌تیمی‌ها'],
      yaya:      ['نگهبان فانوس', 'فانوس جادویی', '۴۰٪ افزایش حمله‌ی تیم به مدت ۶ ثانیه و کمی درمان'],
      dog:       ['پیک جادویی', 'نامه فوری', '۵۰ انرژی به همه‌ی هم‌تیمی‌ها می‌دهد'],
      teddy:     ['رئیس مهربان', 'بغل طلایی', '۳۵۰٪ درمان برای ضعیف‌ترین هم‌تیمی و سپر. (+۲۰٪ سکه)'],
    },
    t: {
      map: 'نقشه', heroes: 'قهرمان‌ها', chest: 'صندوق', quests: 'ماموریت', rank: 'رتبه‌ها',
      worldOf: (a, b) => `دنیای ${a} از ${b}`, stage: s => `مرحله ${s}`, boss: 'رئیس', bossCrown: 'رئیس 👑',
      firstX2: ' · اولین بار ×۲', yourTeam: p => `دک تو · قدرت ${p}`, editTeam: '✏️ ویرایش دک',
      fight: '⚔️ شروع نبرد', allDone: '🏆 همه‌ی مراحل را تمام کردی! می‌توانی مراحل را دوباره بازی کنی.', enemyCards: 'کارت‌های دشمن',
      battleTeam: 'دک نبرد', power: 'قدرت', collection: 'مجموعه', level: l => `سطح ${l}`, inTeam: 'در دک',
      hp: 'جان', atk: 'حمله', lvl: 'سطح', of: n => `از ${n}`, special: '⚡ مهارت ویژه:',
      upgrade: c => `⬆️ ارتقا · 🪙 ${c}`, maxLevel: 'حداکثر سطح', leaveTeam: 'خروج از دک', teamFull: 'دک پر است', joinTeam: 'افزودن به دک',
      getFromChest: 'این قهرمان را از <b>صندوق</b> به دست بیاور 🎁', goChest: 'رفتن به صندوق',
      chestTitle: 'صندوق قهرمان', chestNote: 'قهرمان جدید بگیر! اگر تکراری باشد، آن قهرمان یک سطح بالا می‌رود.',
      basicChest: 'صندوق معمولی', royalChest: 'صندوق سلطنتی', open: c => `باز کردن · 🪙 ${c}`,
      newHero: '✨ قهرمان جدید!', addedTeam: ' (به دک اضافه شد)', dupe: l => `تکراری · سطح ${l} شد ⬆️`, maxRefund: c => `حداکثر سطح · 🪙 ${c} برگشت`,
      ok: 'باشه', again: c => `دوباره · 🪙 ${c}`,
      shop: '⭐ فروشگاه سکه', shopNote: 'خرید با Telegram Stars', coinTip: '💡 سکه را با بردن مرحله‌ها، ماموریت‌ها و جایزه‌ی روزانه جمع کن. Egor و Teddy سکه‌ی بیشتری می‌آورند.',
      bought: 'خرید موفق!', paid: 'پرداخت انجام شد', paidNote: 'سکه‌ها چند لحظه‌ی دیگر به حسابت اضافه می‌شوند.', buyErr: 'خطا در خرید', buyErrNote: 'اتصال به سرور برقرار نشد. دوباره امتحان کن.',
      auto: '⚡ خودکار', tapHint: 'وقتی کارت قهرمان می‌درخشد ⚡ روی آن بزن تا مهارت ویژه‌اش فعال شود',
      dodge: 'جاخالی!', shield: '🛡️ سپر', bossAtk: '⚠️ حمله‌ی رئیس!',
      victory: 'پیروزی!', worldDone: w => `· دنیای «${w}» تمام شد!`, firstBonus: 'جایزه‌ی اولین برد ×۲',
      toMap: 'نقشه', replay: '🔁 تکرار', next: 'مرحله بعد ⬅', defeat: 'شکست!',
      defeatTip: 'قهرمان‌هایت را <b>ارتقا</b> بده، از <b>صندوق</b> قهرمان جدید بگیر، یا مرحله‌های قبلی را تکرار کن تا سکه جمع شود.', retry: '🔁 تلاش دوباره',
      welcome: 'به TON Legends خوش آمدی!',
      help1: '🃏 یک دک ۵ کارتی از کارت‌های قهرمان بچین.',
      help2: '⚔️ کارت‌ها خودکار می‌جنگند. وقتی کارتی <b style="color:var(--gold)">می‌درخشد ⚡</b> روی آن بزن تا مهارت ویژه‌اش فعال شود. کارت‌های دشمن هم مهارت دارند!',
      help3: '🪙 با پیروزی سکه بگیر، قهرمان‌ها را <b>ارتقا</b> بده و از <b>صندوق</b> کارت جدید باز کن.',
      help4: '🗺️ ۲۰ دنیا و ۲۰۰ مرحله، و در آخر هر دنیا یک کارت رئیس منتظرت است!',
      letsGo: 'بزن بریم!',
      dailyTitle: '📅 جایزه‌ی ورود روزانه', dailySub: 'هر روز سر بزن!', day: d => `روز ${d}`, chestShort: 'صندوق',
      claimToday: 'دریافت جایزه‌ی امروز', comeBack: 'فردا برگرد ⏳', dayReward: d => `جایزه‌ی روز ${d}`,
      idleTitle: '💤 صندوق استراحت', perHour: n => `${n} سکه در ساعت`, idleNote: h => `حتی وقتی بازی بسته است، قهرمان‌هایت سکه جمع می‌کنند (تا ${h} ساعت).`, claim: c => `دریافت 🪙 ${c}`,
      todayQuests: '🎯 ماموریت‌های امروز', achievements: '🏅 دستاوردها',
      dq: { wins: 'در ۳ نبرد پیروز شو', skills: '۱۵ بار مهارت ویژه بزن', upgrades: '۲ بار قهرمان ارتقا بده', chests: '۱ صندوق باز کن' },
      ach: { win: n => `${n} پیروزی در نبرد`, world: n => `تمام کردن دنیای ${n}`, heroes: n => `جمع کردن ${n} قهرمان`, level: n => `رساندن یک قهرمان به سطح ${n}`, chest: n => `باز کردن ${n} صندوق`, skill: n => `${n} بار مهارت ویژه` },
      great: 'عالی!', giftTitle: 'هدیه رسید!', giftNote: 'از دعوت دوستان یا خرید تو.',
      player: 'قهرمان', stageOf: (a, b, p) => `مرحله ${a} از ${b} · قدرت ${p}`, wins: 'پیروزی', bossesBeaten: 'رئیس شکست‌خورده',
      invite: '🤝 دعوت از دوستان', inviteNote: 'برای هر دوستی که با لینک تو وارد بازی شود، ۵۰۰ سکه می‌گیری و دوستت هم ۳۰۰ سکه هدیه می‌گیرد.', sendInvite: 'ارسال لینک دعوت',
      inviteText: 'بیا با هم TON Legends بازی کنیم! ⚔️ با این لینک ۳۰۰ سکه هدیه بگیر:',
      leaderboard: '🏆 جدول برترین‌ها', loading: 'در حال بارگذاری…', boardOffline: 'جدول رتبه‌بندی وقتی فعال می‌شود که بازی را از داخل ربات تلگرام باز کنی.',
      boardErr: 'بارگذاری جدول ممکن نشد.', boardEmpty: 'هنوز کسی در جدول نیست. اولین نفر باش!', you: 'تو', players: n => `${n} بازیکن`,
      arena: 'آرنا', arenaTitle: '⚔️ آرنای دو نفره',
      arenaNote: 'به‌صورت زنده با یک بازیکن واقعی دوئل کن. هر دو مبلغ یکسانی وسط می‌گذارید و برنده همه‌ی سکه‌ها را برمی‌دارد. در حالت مساوی سکه‌ها برمی‌گردد.',
      stake: 'مبلغ شرط', pot: p => `جایزه 🪙 ${p}`, findOpp: '🎯 پیدا کردن حریف', challenge: '🤝 دعوت از دوست',
      haveCode: 'کد دعوت داری؟', codePh: 'کد', join: 'ورود', record: (w, l) => `سابقه‌ی آرنا: ${w} برد · ${l} باخت`,
      arenaOffline: 'آرنا وقتی کار می‌کند که بازی را از داخل ربات تلگرام باز کنی.', arenaRules: '⚠️ سکه‌هایی که شرط می‌بندی تا پایان دوئل نگه داشته می‌شوند. اگر وسط دوئل خارج شوی، کارت‌هایت خودکار می‌جنگند.',
      searching: 'در حال پیدا کردن حریف…', waitingFriend: 'منتظر ورود دوستت…', inviteCode: 'کد دعوت', sendDuel: '📨 ارسال دعوت', cancel: 'لغو',
      duelText: c => `⚔️ تو را به دوئل TON Legends سر ${c} سکه دعوت می‌کنم — برنده همه را می‌برد!`,
      challengedBy: h => `${h} تو را به دوئل دعوت کرده!`, accept: '⚔️ قبول', decline: 'رد کردن', theirPower: p => `قدرت دک حریف: ${p}`,
      arenaWin: 'دوئل را بردی!', arenaLose: 'دوئل را باختی', arenaDraw: 'مساوی — سکه‌ها برگشت', toArena: '⚔️ آرنا', ready: 'آماده باش!',
      pvpLeaveNote: 'کارت‌هایت خودکار به جنگ ادامه می‌دهند و نتیجه حساب می‌شود.', arenaWins: 'برد آرنا',
      err: { no_coins: 'سکه‌ی کافی نداری', busy: 'یک دوئل در جریان داری', room_gone: 'این دوئل دیگر در دسترس نیست', own_room: 'این دعوت خودت است',
        bad_stake: 'مبلغ نامعتبر', bad_team: 'حداقل یک قهرمان در دکت بگذار', locked: 'این مرحله قفل است', claimed: 'قبلاً دریافت شده',
        not_ready: 'هنوز آماده نیست', cannot_upgrade: 'ارتقا ممکن نیست', sold_out: 'این نسخه تمام شده', need_parts: 'اول اجزا را ارتقا بده', network: 'مشکل اتصال — دوباره امتحان کن', no_profile: 'در حال اتصال — دوباره امتحان کن' },
      altarHint: '۲ یا ۳ قهرمان خودت را انتخاب کن — کارتی که می‌سازند اینجا نمایش داده می‌شود.', slotOptional: 'سومی (اختیاری)', pickHero: 'انتخاب قهرمان',
      chkLevel: l => `همه‌ی قهرمان‌ها سطح ${l} یا بالاتر`, chkCoins: c => `${c} سکه`, chkNew: 'برای کلکسیونت جدید است', rulesTitle: '📜 قوانین اتحاد', copies: n => `${n} نسخه در کل دنیا`,
      myFusions: '🤝 کارت‌های اتحاد من', noFusions: 'هنوز کارت اتحاد نداری — خانه‌های بالا را پر کن و اتحاد بساز!',
      labTitle: '🤝 آزمایشگاه اتحاد', openLab: '🤝 آزمایشگاه اتحاد',
      labNote: 'قهرمان‌هایی را که داری در یک کارت اتحاد متحد کن — جامعه‌هایشان با هم می‌جنگند. مهارت ویژه‌ی آن، مهارت همه‌ی اعضایش را با هم اجرا می‌کند. هر کارت اتحاد نسخه‌ی محدود و شماره‌دار است — وقتی تعدادش در کل دنیا تمام شود، دیگر هیچ‌کس نمی‌تواند آن را بسازد.',
      duo: '💗 اتحاد دوتایی · اسطوره‌ای', trio: '💎 اتحاد سه‌تایی · کیهانی', needs: l => `اجزا در سطح ${l} یا بالاتر`, fuse: c => `🤝 تشکیل اتحاد · 🪙 ${c}`,
      left: (a, b) => `${a} از ${b} باقی مانده`, soldOut: 'تمام شد', ownedTag: 'داری', fused: 'اتحاد تشکیل شد!', serialOf: (s, m) => `شماره‌ی ${s} از ${m}`,
      fusionTitle: names => `اتحاد ${names}`, fusionDesc: 'مهارت همه‌ی اعضا را با هم اجرا می‌کند:',
      holo: 'هولو', holoNew: '🌈 کارت هولو! یک نسخه‌ی درخشان و فوق‌العاده کمیاب.', holoCount: (a, b) => `🌈 هولو ${a}/${b}`,
      guide: '📖 راهنمای بازی', guideTitle: '📖 TON Legends چطور کار می‌کند', readGuide: '📖 خواندن راهنمای کامل',
      guideSections: [
        ['⚔️ نبرد', 'پنج کارت تو خودکار می‌جنگند. هر کارت با حمله کردن و ضربه خوردن نوار آبی انرژی‌اش را پر می‌کند؛ وقتی درخشید ⚡ رویش بزن تا مهارت ویژه‌اش اجرا شود. با روشن کردن «خودکار»، کارت‌ها خودشان مهارت می‌زنند.'],
        ['🛡️ نقش‌ها', 'تانک‌ها ضربه‌ها را جذب می‌کنند، جنگجو و قاتل محکم می‌زنند، کماندار و جادوگر به چند دشمن آسیب می‌زنند، درمانگر و پشتیبان بقیه را زنده نگه می‌دارند. دک متعادل از پنج مهاجم قوی‌تر است.'],
        ['💎 کمیابی', 'کارت‌های معمولی، کمیاب، حماسی و افسانه‌ای از صندوق درمی‌آیند. کارت‌های اسطوره‌ای (دوتایی) و کیهانی (سه‌تایی) فقط در آزمایشگاه اتحاد ساخته می‌شوند. ۳٪ کارت‌های صندوق به‌صورت «هولو»ی درخشان درمی‌آیند — فقط برای پز دادن!'],
        ['🤝 آزمایشگاه اتحاد', 'دو یا سه قهرمان را در یک کارت اتحاد متحد کن — جامعه‌هایشان با هم می‌جنگند. رهبر را خودت انتخاب می‌کنی (روی کارت بزرگ‌تر نشان داده می‌شود). مهارت کارت، مهارت همه‌ی اعضا را با هم اجرا می‌کند. وقتی با این کارت ببری، همه‌ی جامعه‌های روی کارت امتیاز جنگ می‌گیرند. پروژه‌هایی که واقعاً با هم همکاری کنند می‌توانند «اتحاد رسمی» شوند (+٪ قدرت). هر کارت نسخه‌ی محدود و شماره‌دار است: از هر دوتایی ۳۰۰ عدد و از هر سه‌تایی ۳۰ عدد — در کل دنیا.'],
        ['🥊 آرنا', 'به‌صورت زنده با بازیکن‌های واقعی دوئل کن. هر دو مبلغ یکسانی وسط می‌گذارید؛ برنده همه را برمی‌دارد و در مساوی سکه‌ها برمی‌گردد. اگر وسط دوئل خارج شوی، کارت‌هایت خودکار می‌جنگند.'],
        ['🪙 سکه و استارز', 'از مرحله‌ها (اولین برد ×۲)، جایزه‌ی روزانه، ماموریت‌ها، دستاوردها و صندوق استراحت سکه بگیر و خرج ارتقا، صندوق و کارت‌های اتحاد کن. بسته‌های سکه را با Telegram Stars هم می‌شود خرید؛ سکه‌ها قابل نقد کردن نیستند. تکرار مرحله‌ای که قبلاً رد کرده‌ای هر بار نصف دفعه‌ی قبل جایزه می‌دهد (۵۰٪، ۲۵٪، ۱۲٫۵٪…).'],
        ['📅 هر روز', 'جایزه‌ی ورود ۷ روزه را بگیر (روز هفتم = صندوق سلطنتی رایگان)، ۴ ماموریت روزانه را تمام کن و صندوق استراحت را جمع کن — قهرمان‌هایت حتی وقتی نیستی سکه جمع می‌کنند.'],
        ['🛡️ بازی منصفانه', 'داخل تلگرام سکه‌ها و کارت‌هایت روی سرور بازی است. هر برد با شبیه‌سازی دوباره‌ی نبرد بررسی می‌شود، پس هیچ‌کس نمی‌تواند با تقلب بالا برود.'],
      ],
      leaveTitle: 'از نبرد خارج می‌شوی؟', leaveNote: 'پیشرفت این نبرد از دست می‌رود.', leave: 'خروج', stay: 'ادامه‌ی نبرد',
      settings: '⚙️ تنظیمات', sfx: '🔊 صداها', music: '🎵 موسیقی', language: '🌐 زبان', howTo: '❓ راهنمای بازی', show: 'نمایش',
      reset: '🗑️ شروع دوباره (پاک شدن همه‌ی پیشرفت)', erase: 'پاک کن', sure: 'مطمئنی؟ دوباره بزن', version: 'TON Legends · نسخه‌ی ۱.۴', cloudOn: '· ذخیره‌ی ابری تلگرام فعال ☁️', close: 'بستن',
    },
  },
};

// Languages: English is the base; other languages (i18n-world.js) only need to translate what they can —
// anything missing falls back to English.
const LANGS = [['en', 'English'], ['fa', 'فارسی'], ['ru', 'Русский'], ['ar', 'العربية'], ['tr', 'Türkçe'], ['es', 'Español'], ['pt', 'Português'],
  ['fr', 'Français'], ['de', 'Deutsch'], ['id', 'Bahasa Indonesia'], ['uk', 'Українська'], ['hi', 'हिन्दी'], ['zh', '中文'], ['uz', 'Oʻzbekcha']];
function mergeLang(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? mergeLang(base[k], v) : v;
  }
  return out;
}
const RESOLVED = {};
function langPack(code) { return RESOLVED[code] || (RESOLVED[code] = code === 'en' ? I18N.en : mergeLang(I18N.en, I18N[code])); }
function detectLang(code) {
  const c = String(code || (typeof navigator !== 'undefined' && navigator.language) || 'en').toLowerCase().slice(0, 2);
  return I18N[c] ? c : 'en';
}

let LANG = 'en';
const L = () => langPack(LANG);
const T = () => langPack(LANG).t;
const heroText = id => {
  const h = HERO_BY_ID[id];
  if (h && h.fusion) {
    const t = T(), parts = h.parts.map(p => heroText(p));
    return { title: t.fusionTitle(h.parts.map(p => HERO_BY_ID[p].name).join(' × ')), skill: parts.map(p => p.skill).join(' + '),
      desc: `${t.fusionDesc} ${parts.map(p => p.skill).join(' · ')}` };
  }
  const [title, skill, desc] = L().hero[id];
  return { title, skill, desc };
};
const worldName = w => L().world[WORLDS[w].key] + ['', ' II', ' III', ' IV'][WORLDS[w].chapter || 0];
function setLang(lang) {
  LANG = I18N[lang] ? lang : 'en';
  document.documentElement.lang = LANG;
  document.documentElement.dir = L().dir || 'ltr';
  document.querySelectorAll('#nav [data-tab]').forEach(b => { b.lastChild.textContent = T()[b.dataset.tab]; });
}
