// Gram Legends — tower story: Captain Plane and the free network against the Silo Empire (parody villains, every
// 10th floor). Keys: storyX texts in t, and t.villain[id] = { name, minion, skill, intro, win } for each villain.
const I18N_STORY = {
  en: {
    storyTitle: 'Tower story', storyCaptain: 'Captain Plane', storyChapter: (k, all) => `Chapter ${k} / ${all}`,
    storyPrologue: 'The Silo Empire wants every message and every coin locked inside its walls. Captain Plane, founder of the free network, sends you up the Tower of Freedom: break one silo every 10 floors.',
    storyNext: (f, name) => `Floor ${f}: ${name}`, storyBeaten: 'Defeated', storyFight: '⚔️ Fight', storyWin: 'Silo broken!', storyRound: r => `Round ${r} — the villains are back, stronger`,
    villain: {
      spam: { name: 'Spam Lord', minion: 'Spam Bot', skill: 'Spam Flood', intro: 'Floor 10 is buried under a million unread messages. The Spam Lord floods every chat — mute him for good!', win: "Inboxes are clean again. Captain Plane: 'Good start. The Empire noticed you.'" },
      gas: { name: 'Gas Fee Troll', minion: 'Toll Bot', skill: 'Toll Gate', intro: 'A troll guards the bridge and charges a fee for every step. On the free network, sending should cost almost nothing.', win: 'The toll gate is down — transfers fly free again.' },
      rug: { name: 'Rug-Pull Rat', minion: 'Scam Token', skill: 'Rug Pull', intro: 'The Rug-Pull Rat sells shiny tokens and runs off with the money. Its poison spreads fast — finish it before it vanishes!', win: 'The rat is caught and its scam tokens are dust. Always check before you buy!' },
      pump: { name: 'Pump & Dump', minion: 'Shill Bot', skill: 'To the Moon', intro: "Shill bots scream 'to the moon!' while Pump & Dump inflates prices. Everyone hits hard here and breaks easily.", win: 'The bubble popped. Real value wins.' },
      bitcorn: { name: 'Bitcorn King', minion: 'Mining Rig', skill: 'Proof of Work', intro: 'The oldest giant of the Empire: the Bitcorn King, slow and armoured, burning mountains of power to move a single block.', win: "The old king kneels: 'Fast and light… maybe the future is yours.'" },
      hydra: { name: 'Gas Hydra', minion: 'Fee Wraith', skill: 'Many Heads', intro: "Cut one head and two fees grow back. The Hydra's toxic gas fills the floor — strike fast!", win: 'All heads down. The network breathes again.' },
      bubble: { name: 'Green Bubble Warden', minion: 'Read Receipt', skill: 'Walled Garden', intro: 'The Warden locks every chat inside green walls. In its garden your ultimate is blocked — win with skills alone!', win: 'The walls crack. Messages flow freely between networks.' },
      eye: { name: 'Tracker Eye', minion: 'Ad Cookie', skill: 'Track Everything', intro: 'The Tracker Eye watches every tap and sells it. Its cookies are fast — strike first and keep your secrets!', win: 'The Eye is blind. Privacy is back.' },
      meta: { name: 'Metaverse Overlord', minion: 'Avatar Clone', skill: 'Virtual Reality', intro: 'The Overlord promises a perfect virtual world — owned by him. His clones hit hard but break easily.', win: 'The goggles shatter. The real world was better anyway.' },
      silo: { name: 'Silo Emperor', minion: 'Lock Guard', skill: 'Total Control', intro: "The top of the tower. Every wall, every lock, every tracker belongs to the Silo Emperor. No ultimate here. Captain Plane: 'This is it. Free the network!'", win: "The Empire falls! Captain Plane: 'The network is free — but empires rebuild. Keep climbing, legend.'" },
    },
  },
  fa: {
    storyTitle: 'داستان برج', storyCaptain: 'کاپیتان پرواز', storyChapter: (k, all) => `فصل ${k} از ${all}`,
    storyPrologue: 'امپراتوری سیلو می‌خواهد هر پیام و هر سکه را پشت دیوارهایش زندانی کند. کاپیتان پرواز، بنیان‌گذار شبکه‌ی آزاد، تو را به برج آزادی می‌فرستد: هر ۱۰ طبقه یک سیلو را بشکن.',
    storyNext: (f, name) => `طبقه‌ی ${f}: ${name}`, storyBeaten: 'شکست خورد', storyFight: '⚔️ مبارزه', storyWin: 'سیلو شکست!', storyRound: r => `دور ${r} — شرورها قوی‌تر برگشته‌اند`,
    villain: {
      spam: { name: 'ارباب اسپم', minion: 'ربات اسپم', skill: 'سیل اسپم', intro: 'طبقه‌ی ۱۰ زیر یک میلیون پیام نخوانده دفن شده. ارباب اسپم همه‌ی چت‌ها را پر کرده — برای همیشه ساکتش کن!', win: "صندوق‌ها دوباره تمیز شدند. کاپیتان پرواز: «شروع خوبی بود. امپراتوری متوجهت شد.»" },
      gas: { name: 'غول کارمزد', minion: 'ربات عوارضی', skill: 'دروازه‌ی عوارض', intro: 'غولی روی پل نشسته و برای هر قدم کارمزد می‌گیرد. در شبکه‌ی آزاد، فرستادن باید تقریباً رایگان باشد.', win: 'دروازه‌ی عوارض فرو ریخت — تراکنش‌ها دوباره آزاد پرواز می‌کنند.' },
      rug: { name: 'موش راگ‌پول', minion: 'توکن کلاهبردار', skill: 'فرار با پول', intro: 'موش راگ‌پول توکن‌های براق می‌فروشد و با پول فرار می‌کند. زهرش سریع پخش می‌شود — قبل از فرارش کارش را تمام کن!', win: 'موش گیر افتاد و توکن‌هایش خاک شدند. همیشه قبل از خرید بررسی کن!' },
      pump: { name: 'پامپ و دامپ', minion: 'ربات تبلیغاتی', skill: 'تا ماه!', intro: 'ربات‌های تبلیغاتی فریاد می‌زنند «تا ماه!» و پامپ و دامپ قیمت‌ها را باد می‌کند. اینجا همه محکم می‌زنند و زود می‌شکنند.', win: 'حباب ترکید. ارزش واقعی برنده شد.' },
      bitcorn: { name: 'پادشاه بیت‌ذرت', minion: 'دستگاه ماینر', skill: 'اثبات کار', intro: 'پیرترین غول امپراتوری: پادشاه بیت‌ذرت، کند و زره‌پوش، که کوهی از انرژی می‌سوزاند تا فقط یک بلاک جابه‌جا کند.', win: "پادشاه پیر زانو می‌زند: «سریع و سبک… شاید آینده مال شما باشد.»" },
      hydra: { name: 'هیدرای گس', minion: 'شبح کارمزد', skill: 'سرهای بی‌شمار', intro: 'یک سر را بزنی، دو کارمزد جایش درمی‌آید. گاز سمی هیدرا طبقه را پر کرده — سریع بزن!', win: 'همه‌ی سرها افتادند. شبکه دوباره نفس می‌کشد.' },
      bubble: { name: 'نگهبان حباب سبز', minion: 'تیک آبی', skill: 'باغ دیواردار', intro: 'نگهبان هر چت را پشت دیوارهای سبز زندانی می‌کند. در باغ او فوق‌حمله‌ات قفل است — فقط با مهارت‌ها ببر!', win: 'دیوارها ترک برداشتند. پیام‌ها آزادانه بین شبکه‌ها جاری‌اند.' },
      eye: { name: 'چشم ردیاب', minion: 'کوکی تبلیغاتی', skill: 'ردیابی همه‌چیز', intro: 'چشم ردیاب هر لمس تو را می‌بیند و می‌فروشد. کوکی‌هایش سریع‌اند — اول تو بزن و رازهایت را نگه دار!', win: 'چشم کور شد. حریم خصوصی برگشت.' },
      meta: { name: 'ارباب متاورس', minion: 'کلون آواتار', skill: 'واقعیت مجازی', intro: 'ارباب یک دنیای مجازی بی‌نقص وعده می‌دهد — که مال خودش است. کلون‌هایش محکم می‌زنند ولی زود می‌شکنند.', win: 'عینک‌ها خرد شدند. دنیای واقعی به‌هرحال بهتر بود.' },
      silo: { name: 'امپراتور سیلو', minion: 'نگهبان قفل', skill: 'کنترل کامل', intro: "بالای برج. هر دیوار، هر قفل و هر ردیاب مال امپراتور سیلو است. اینجا فوق‌حمله نداری. کاپیتان پرواز: «همین است. شبکه را آزاد کن!»", win: "امپراتوری سقوط کرد! کاپیتان پرواز: «شبکه آزاد است — ولی امپراتوری‌ها دوباره ساخته می‌شوند. به بالا رفتن ادامه بده، قهرمان.»" },
    },
  },
};
for (const [code, t] of Object.entries(I18N_STORY)) if (I18N[code]) I18N[code].t = mergeLang(I18N[code].t || {}, t);
