// Gram Legends — Book of Legends: the comic, inside the game. Chapter k opens after ECON.COMIC_UNLOCK[k-1] cleared
// stages; reading it to the end the first time pays ECON.COMIC_GEMS (server-checked 'comic' action). Pages come from
// comic-data.js (fa pages for Persian, English for everyone else), drawn 720 px wide and zoomed to the screen.
const COMIC_CHAPTERS = ECON.COMIC_UNLOCK.length;
const comicLang = () => (LANG === 'fa' ? 'fa' : 'en');
const comicRead = () => S.comic || [];
const comicOpenCh = ch => ECON.comicOpen(S, ch);
// Chapters open but not read yet (the badge on the map).
const comicUnread = () => Array.from({ length: COMIC_CHAPTERS }, (_, i) => i + 1).filter(ch => comicOpenCh(ch) && !comicRead().includes(ch));
// The chapter a win at `cleared` stages just opened, if any.
const comicJustOpened = cleared => { const i = ECON.COMIC_UNLOCK.indexOf(cleared); return i >= 0 ? i + 1 : 0; };

let comicStyled = false;
function comicStyles() {
  if (comicStyled) return;
  comicStyled = true;
  const st = document.createElement('style'); st.id = 'comic-css'; st.textContent = COMIC.css; document.head.appendChild(st);
  // Comic lettering fonts (the pages fall back to system fonts when offline)
  const ln = document.createElement('link'); ln.rel = 'stylesheet';
  ln.href = 'https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@400;700;900&family=Bangers&family=Comic+Neue:wght@700&display=swap';
  document.head.appendChild(ln);
}
const comicPage = (lang, i) => `<div class="comic cm-${lang}${i}">${COMIC.pages[lang][i].replace(/\{\{img:([\w-]+)\}\}/g, (m, id) => (id.startsWith('ui-') ? UI_ART(id.slice(3)) : img(id)))}</div>`;

// The book: cover plus five chapters, each open, new or locked (with the stage that opens it).
function openBook() {
  const t = T(), read = comicRead();
  comicStyles();
  openModal(`<div class="book">
    <div class="center"><div class="big" style="font-size:26px">📖 ${t.bookTitle}</div><p class="muted">${t.bookShort}</p></div>
    <div class="book-list">${Array.from({ length: COMIC_CHAPTERS }, (_, i) => {
      const ch = i + 1, open = comicOpenCh(ch), done = read.includes(ch);
      return `<button class="book-ch ${open ? '' : 'locked'} ${open && !done ? 'new' : ''}" data-ch="${ch}" ${open ? '' : 'disabled'}>
        <span class="bc-n">${n(ch)}</span><span class="bc-t"><b>${t.bookTitles[i]}</b><small>${open ? (done ? `✓ ${t.bookDone}` : `${t.bookNew} · +${n(ECON.COMIC_GEMS)} 💎`) : `🔒 ${t.bookLock(stageLabel(ECON.COMIC_UNLOCK[i] - 1))}`}</small></span></button>`;
    }).join('')}</div>
    <button class="btn wide ghost" id="bk-close">${t.ok}</button></div>`, box => {
    box.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => readChapter(+b.dataset.ch));
    box.querySelector('#bk-close').onclick = () => { closeModal(); refresh(); };
  });
}

// One chapter, full screen. Chapter 1 starts with the cover; chapter 5 ends with the post-credits scene.
// Reaching the end pays the first-read gems.
function readChapter(ch) {
  const t = T(), lang = comicLang();
  comicStyles();
  const pages = [...(ch === 1 ? [0] : []), ch, ...(ch === COMIC_CHAPTERS ? [COMIC_CHAPTERS + 1] : [])];
  const next = ch < COMIC_CHAPTERS && comicOpenCh(ch + 1) ? ch + 1 : 0;
  openModal(`<div class="reader">
    <div class="rd-top"><button class="rd-x" id="rd-back" aria-label="${t.ok}">✕</button><b>📖 ${t.bookChapter(n(ch))} · ${t.bookTitles[ch - 1]}</b></div>
    <div class="rd-pages">${pages.map(i => comicPage(lang, i)).join('')}</div>
    <div class="rd-end" id="rd-end">
      <div id="rd-reward"></div>
      <div class="btns">${next ? `<button class="btn gold" id="rd-next">${t.bookNext}</button>` : ''}<button class="btn ghost" id="rd-close">${t.bookBack}</button></div>
    </div></div>`, box => {
    $('#modal').classList.add('reading');
    // Draw the 720 px pages at the screen's width.
    const fit = () => box.querySelectorAll('.comic').forEach(c => { c.style.zoom = Math.min(1, (box.clientWidth - 0) / 720); });
    fit(); window.addEventListener('resize', fit, { once: true });
    box.querySelector('#rd-back').onclick = () => openBook();
    box.querySelector('#rd-close').onclick = () => openBook();
    const nx = box.querySelector('#rd-next'); if (nx) nx.onclick = () => readChapter(next);
    // First read to the end: claim the gems.
    if (!comicRead().includes(ch) && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(async es => {
        if (!es.some(e => e.isIntersecting)) return;
        io.disconnect();
        const prevGems = S.gems;
        const r = await tryAct({ type: 'comic', ch });
        if (r) { showCoins(S.coins, prevGems); const el = box.querySelector('#rd-reward'); if (el) el.innerHTML = `<div class="rd-prize">${t.bookPrize(n(r.gems))}</div>`; Sound.play('coin'); haptic('medium'); }
      });
      io.observe(box.querySelector('#rd-end'));
    }
  }, { onBack: () => openBook() });
}
