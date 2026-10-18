// Gram Legends — Book of Legends texts (the in-game comic). bookTitles: the five chapter names.
const I18N_BOOK = {
  en: {
    bookTitle: 'Book of Legends', bookShort: 'The comic of the Silo War — a new chapter opens as you play.',
    bookChapter: k => `Chapter ${k}`, bookTitles: ['The Grey Fog', 'The Hidden Signal', 'Neon City Shakes', 'The Last Lantern', 'The Tower of Freedom'],
    bookLock: s => `Clear stage ${s}`, bookNew: 'New', bookDone: 'Read', bookNext: 'Next chapter ▸', bookBack: 'Back to the book',
    bookPrize: g => `Chapter complete! +${g} 💎`, bookUnlocked: 'New comic chapter unlocked!', bookRead: 'Read it',
  },
  fa: {
    bookTitle: 'کتاب افسانه‌ها', bookShort: 'کمیک جنگ سیلو — با پیشرفت در بازی، فصل تازه باز می‌شود.',
    bookChapter: k => `فصل ${k}`, bookTitles: ['مهِ خاکستری', 'سیگنال پنهان', 'شهر نئون می‌لرزد', 'آخرین فانوس', 'برج آزادی'],
    bookLock: s => `مرحله‌ی ${s} را رد کن`, bookNew: 'تازه', bookDone: 'خوانده شد', bookNext: 'فصل بعد ◂', bookBack: 'بازگشت به کتاب',
    bookPrize: g => `فصل تمام شد! 💎 ${g}+`, bookUnlocked: 'فصل تازه‌ی کمیک باز شد!', bookRead: 'بخوانش',
  },
  ru: {
    bookTitle: 'Книга легенд', bookShort: 'Комикс о Войне за Силос — новая глава открывается по ходу игры.',
    bookChapter: k => `Глава ${k}`, bookTitles: ['Серый туман', 'Скрытый сигнал', 'Неон-Сити дрожит', 'Последний фонарь', 'Башня свободы'],
    bookLock: s => `Пройди этап ${s}`, bookNew: 'Новое', bookDone: 'Прочитано', bookNext: 'Следующая глава ▸', bookBack: 'Назад к книге',
    bookPrize: g => `Глава пройдена! +${g} 💎`, bookUnlocked: 'Открыта новая глава комикса!', bookRead: 'Читать',
  },
  ar: {
    bookTitle: 'كتاب الأساطير', bookShort: 'قصة مصوّرة عن حرب الصومعة — يُفتح فصل جديد كلما تقدّمت في اللعب.',
    bookChapter: k => `الفصل ${k}`, bookTitles: ['الضباب الرمادي', 'الإشارة الخفية', 'مدينة النيون تهتز', 'الفانوس الأخير', 'برج الحرية'],
    bookLock: s => `اجتز المرحلة ${s}`, bookNew: 'جديد', bookDone: 'مقروء', bookNext: 'الفصل التالي ◂', bookBack: 'العودة إلى الكتاب',
    bookPrize: g => `اكتمل الفصل! 💎 ${g}+`, bookUnlocked: 'فُتح فصل جديد من القصة المصوّرة!', bookRead: 'اقرأه',
  },
  tr: {
    bookTitle: 'Efsaneler Kitabı', bookShort: 'Silo Savaşı çizgi romanı — oynadıkça yeni bir bölüm açılır.',
    bookChapter: k => `Bölüm ${k}`, bookTitles: ['Gri Sis', 'Gizli Sinyal', 'Neon Şehir Sarsılıyor', 'Son Fener', 'Özgürlük Kulesi'],
    bookLock: s => `Aşamayı geç: ${s}`, bookNew: 'Yeni', bookDone: 'Okundu', bookNext: 'Sonraki bölüm ▸', bookBack: 'Kitaba dön',
    bookPrize: g => `Bölüm tamam! +${g} 💎`, bookUnlocked: 'Yeni çizgi roman bölümü açıldı!', bookRead: 'Oku',
  },
  es: {
    bookTitle: 'Libro de Leyendas', bookShort: 'El cómic de la Guerra del Silo: se abre un nuevo capítulo a medida que juegas.',
    bookChapter: k => `Capítulo ${k}`, bookTitles: ['La Niebla Gris', 'La Señal Oculta', 'Ciudad Neón Tiembla', 'El Último Farol', 'La Torre de la Libertad'],
    bookLock: s => `Supera la fase ${s}`, bookNew: 'Nuevo', bookDone: 'Leído', bookNext: 'Siguiente capítulo ▸', bookBack: 'Volver al libro',
    bookPrize: g => `¡Capítulo completado! +${g} 💎`, bookUnlocked: '¡Nuevo capítulo del cómic desbloqueado!', bookRead: 'Leer',
  },
  pt: {
    bookTitle: 'Livro das Lendas', bookShort: 'A HQ da Guerra do Silo — um novo capítulo se abre conforme você joga.',
    bookChapter: k => `Capítulo ${k}`, bookTitles: ['A Névoa Cinzenta', 'O Sinal Oculto', 'Cidade Neon Treme', 'A Última Lanterna', 'A Torre da Liberdade'],
    bookLock: s => `Conclua a fase ${s}`, bookNew: 'Novo', bookDone: 'Lido', bookNext: 'Próximo capítulo ▸', bookBack: 'Voltar ao livro',
    bookPrize: g => `Capítulo concluído! +${g} 💎`, bookUnlocked: 'Novo capítulo da HQ desbloqueado!', bookRead: 'Ler',
  },
  fr: {
    bookTitle: 'Livre des Légendes', bookShort: "La BD de la Guerre du Silo — un nouveau chapitre s'ouvre au fil du jeu.",
    bookChapter: k => `Chapitre ${k}`, bookTitles: ['Le Brouillard Gris', 'Le Signal Caché', 'Néon City Tremble', 'La Dernière Lanterne', 'La Tour de la Liberté'],
    bookLock: s => `Termine l'étape ${s}`, bookNew: 'Nouveau', bookDone: 'Lu', bookNext: 'Chapitre suivant ▸', bookBack: 'Retour au livre',
    bookPrize: g => `Chapitre terminé ! +${g} 💎`, bookUnlocked: 'Nouveau chapitre de BD débloqué !', bookRead: 'Lire',
  },
  de: {
    bookTitle: 'Buch der Legenden', bookShort: 'Der Comic zum Silo-Krieg — beim Spielen öffnet sich ein neues Kapitel.',
    bookChapter: k => `Kapitel ${k}`, bookTitles: ['Der Graue Nebel', 'Das Verborgene Signal', 'Neon City Bebt', 'Die Letzte Laterne', 'Der Turm der Freiheit'],
    bookLock: s => `Schaffe Stufe ${s}`, bookNew: 'Neu', bookDone: 'Gelesen', bookNext: 'Nächstes Kapitel ▸', bookBack: 'Zurück zum Buch',
    bookPrize: g => `Kapitel geschafft! +${g} 💎`, bookUnlocked: 'Neues Comic-Kapitel freigeschaltet!', bookRead: 'Lesen',
  },
  id: {
    bookTitle: 'Kitab Legenda', bookShort: 'Komik Perang Silo — bab baru terbuka seiring kamu bermain.',
    bookChapter: k => `Bab ${k}`, bookTitles: ['Kabut Kelabu', 'Sinyal Tersembunyi', 'Kota Neon Berguncang', 'Lentera Terakhir', 'Menara Kebebasan'],
    bookLock: s => `Selesaikan tahap ${s}`, bookNew: 'Baru', bookDone: 'Dibaca', bookNext: 'Bab berikutnya ▸', bookBack: 'Kembali ke buku',
    bookPrize: g => `Bab selesai! +${g} 💎`, bookUnlocked: 'Bab komik baru terbuka!', bookRead: 'Baca',
  },
  uk: {
    bookTitle: 'Книга легенд', bookShort: 'Комікс про Війну за Силос — новий розділ відкривається під час гри.',
    bookChapter: k => `Розділ ${k}`, bookTitles: ['Сірий туман', 'Прихований сигнал', 'Неон-Сіті тремтить', 'Останній ліхтар', 'Вежа свободи'],
    bookLock: s => `Пройди етап ${s}`, bookNew: 'Нове', bookDone: 'Прочитано', bookNext: 'Наступний розділ ▸', bookBack: 'Назад до книги',
    bookPrize: g => `Розділ пройдено! +${g} 💎`, bookUnlocked: 'Відкрито новий розділ комікса!', bookRead: 'Читати',
  },
  hi: {
    bookTitle: 'किंवदंतियों की किताब', bookShort: 'साइलो युद्ध की कॉमिक — खेलते-खेलते नया अध्याय खुलता है।',
    bookChapter: k => `अध्याय ${k}`, bookTitles: ['धूसर धुंध', 'छिपा संकेत', 'नियॉन सिटी कांप उठी', 'आखिरी लालटेन', 'आज़ादी की मीनार'],
    bookLock: s => `स्टेज ${s} पार करें`, bookNew: 'नया', bookDone: 'पढ़ लिया', bookNext: 'अगला अध्याय ▸', bookBack: 'किताब पर वापस',
    bookPrize: g => `अध्याय पूरा! +${g} 💎`, bookUnlocked: 'कॉमिक का नया अध्याय खुला!', bookRead: 'पढ़ें',
  },
  zh: {
    bookTitle: '传奇之书', bookShort: '筒仓之战漫画——随着游戏推进，新章节陆续开启。',
    bookChapter: k => `第${k}章`, bookTitles: ['灰雾弥漫', '隐秘信号', '霓虹城震荡', '最后的灯笼', '自由之塔'],
    bookLock: s => `通关第${s}关`, bookNew: '新', bookDone: '已读', bookNext: '下一章 ▸', bookBack: '返回书本',
    bookPrize: g => `本章完成！+${g} 💎`, bookUnlocked: '漫画新章节已解锁！', bookRead: '阅读',
  },
  uz: {
    bookTitle: 'Afsonalar kitobi', bookShort: 'Silos urushi komiksi — oʻynagan sari yangi bob ochiladi.',
    bookChapter: k => `${k}-bob`, bookTitles: ['Kulrang tuman', 'Yashirin signal', 'Neon shahar larzada', 'Soʻnggi fonus', 'Ozodlik minorasi'],
    bookLock: s => `${s}-bosqichni oʻting`, bookNew: 'Yangi', bookDone: 'Oʻqildi', bookNext: 'Keyingi bob ▸', bookBack: 'Kitobga qaytish',
    bookPrize: g => `Bob tugadi! +${g} 💎`, bookUnlocked: 'Komiksning yangi bobi ochildi!', bookRead: 'Oʻqish',
  },
};
for (const [code, t] of Object.entries(I18N_BOOK)) if (I18N[code]) I18N[code].t = mergeLang(I18N[code].t || {}, t);
