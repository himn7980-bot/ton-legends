// Gram Legends — battle entrance and kill effects (DOM + Web Animations, nothing here touches the fight itself).
//   Entrance: 3 · 2 · 1 · Fight! — enemy cards land during "3", yours during "2"; each role lands its own way
//     (tanks slam down, warriors spin in, assassins blink in, archers flip, mages warp, supports rise in light).
//   Kill: the card that lands the blow decides how its target is destroyed — fire heroes burn it to smoke, ice heroes
//     shatter it, Noctis slices it in two, PAWS tears it apart, Notcoin crushes it, mages turn it to dust.
//   Effects level (Settings): 0 = none, 1 = lighter (fewer pieces), 2 = full.
const BFX = (() => {
  const ENTRY = { tank: 'slam', warrior: 'spin', assassin: 'blink', archer: 'flip', mage: 'warp', control: 'warp', support: 'rise', healer: 'rise' };
  const KILL = { volya: 'burn', yaya: 'burn', pinkbull: 'burn', teddy: 'burn', pengu: 'shatter', utya: 'shatter', egor: 'shatter', gramcat: 'shatter',
    noctis: 'slash', paws: 'tear', notcoin: 'crush', dog: 'crush', memegram: 'dust', yoda: 'dust', virus: 'dust', babyshark: 'dust' };
  const STEP = 650;
  const level = () => (S.fx ?? 2);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const box = () => $('#battle').getBoundingClientRect();

  // ---------- entrance ----------
  function entryFrames(kind, dir, boss) {
    const y = dir * 260;
    switch (boss ? 'boss' : kind) {
      case 'boss': return [{ transform: 'scale(3) translateY(-30px)', opacity: 0, filter: 'brightness(3)' }, { offset: 0.75, transform: 'scale(.9)', opacity: 1, filter: 'brightness(1.4)' }, { transform: 'none', filter: 'none' }];
      case 'slam': return [{ transform: 'scale(2.4)', opacity: 0 }, { offset: 0.7, transform: 'scale(.9)', opacity: 1 }, { transform: 'none' }];
      case 'spin': return [{ transform: `translateY(${y}px) rotateY(720deg) scale(.4)`, opacity: 0 }, { offset: 0.8, transform: 'rotateY(-15deg) scale(1.05)', opacity: 1 }, { transform: 'none' }];
      case 'blink': return [{ opacity: 0, filter: 'blur(14px) brightness(3)', transform: 'scale(1.3)' }, { offset: 0.45, opacity: 0.9, filter: 'blur(4px)' }, { offset: 0.6, opacity: 0.15 }, { offset: 0.75, opacity: 1, filter: 'blur(0)' }, { transform: 'none', filter: 'none', opacity: 1 }];
      case 'flip': return [{ transform: `translateY(${y * 0.8}px) rotateX(${dir * 200}deg) scale(.6)`, opacity: 0 }, { offset: 0.8, transform: `rotateX(${-dir * 12}deg)`, opacity: 1 }, { transform: 'none' }];
      case 'warp': return [{ transform: 'scale(0) rotate(-540deg)', opacity: 0, filter: 'hue-rotate(180deg) brightness(2)' }, { offset: 0.7, transform: 'scale(1.18) rotate(10deg)', opacity: 1 }, { transform: 'none', filter: 'none' }];
      default: return [{ transform: `translateY(${dir * 70}px) scale(.8)`, opacity: 0, filter: 'brightness(3) saturate(0)' }, { offset: 0.7, transform: 'translateY(-6px) scale(1.03)', opacity: 1 }, { transform: 'none', filter: 'none' }];
    }
  }
  function enter(units, mineSet, at) {
    const el = $('#battle'), list = units.filter(u => BT.els.get(u.uid));
    list.forEach((u, i) => {
      const e = BT.els.get(u.uid), mine = mineSet.has(u.uid), h = HERO_BY_ID[u.id];
      const kind = ENTRY[(h && h.role) || u.role] || 'rise', delay = at + i * 110, dur = u.boss ? 700 : kind === 'blink' ? 520 : 600;
      e.root.animate(entryFrames(kind, mine ? 1 : -1, u.boss), { duration: dur, delay, easing: kind === 'slam' || u.boss ? 'cubic-bezier(.55,0,.8,.3)' : 'cubic-bezier(.2,.8,.3,1.1)', fill: 'backwards' });
      // heavy landings shake the field and kick up sparks
      if (kind === 'slam' || u.boss) setTimeout(() => {
        if (!BT || !e.root.isConnected) return;
        anim(el, 'shake'); haptic(u.boss ? 'heavy' : 'light'); spark(e.root, mine ? '#ffd85a' : '#ff5a5a', u.boss ? 3 : 1);
      }, delay + dur * 0.7);
    });
  }
  function spark(node, color, n = 1) {
    const b = box(), r = node.getBoundingClientRect();
    for (let i = 0; i < n; i++) Scene.burst(r.left - b.left + r.width / 2, r.top - b.top + r.height * (0.4 + 0.3 * i), color);
  }
  // Plays the entrance. done() runs when the fight should start (right away when effects are off).
  // count=false: no 3-2-1 (cards still fly in); ms: total length of the count (default 3 steps).
  function intro({ mine, theirs, count = true, ms = STEP * 3 }, done = () => {}) {
    const el = $('#battle');
    if (!level() || !BT) { done(); return; }
    const mineSet = new Set(mine.map(u => u.uid)), steps = count ? Math.max(1, Math.min(3, Math.round(ms / STEP))) : 0, st = steps ? ms / steps : STEP, mineBT = BT;
    enter(theirs, mineSet, 0);
    enter(mine, mineSet, steps >= 2 ? st : 250);
    if (!steps) { setTimeout(() => { if (BT === mineBT) done(); }, 900); return; }
    const d = document.createElement('div'); d.className = 'cd3';
    el.querySelector('#b-fx').appendChild(d);
    const show = (txt, cls) => { d.innerHTML = `<div class="cd3-n ${cls || ''}">${txt}</div>`; };
    for (let i = 0; i < steps; i++) setTimeout(() => { if (BT !== mineBT) return; show(n(steps - i)); Sound.play('count'); haptic('light'); }, i * st);
    setTimeout(() => {
      if (BT !== mineBT) { d.remove(); return; }
      show(T().fight, 'go'); Sound.play('go'); haptic('medium'); flashScreen('#ffd85a');
      done();
      setTimeout(() => d.remove(), 600);
    }, steps * st);
  }

  // ---------- kills ----------
  // The hero a killer stands for: an alliance card uses its leader (yours) or its first part.
  function killKind(by, victimMine) {
    const h = by && HERO_BY_ID[by];
    if (!h) return victimMine ? 'tear' : 'burn';
    const base = h.fusion ? (S.owned && S.owned[by] ? ECON.leaderOf(S, by) : h.parts[0]) : by;
    return KILL[base] || 'burn';
  }
  // Pieces cut from the card picture: background drawn the way the <img> is (cover, focus 50% 20%).
  function layer(e) {
    const im = e.root.querySelector('img'), b = box(), r = im.getBoundingClientRect();
    const W = r.width, H = r.height, nw = im.naturalWidth || W, nh = im.naturalHeight || H, s = Math.max(W / nw, H / nh);
    const dw = nw * s, dh = nh * s, ox = (W - dw) * 0.5, oy = (H - dh) * 0.2;
    const wrap = document.createElement('div'); wrap.className = 'kfx';
    wrap.style.cssText = `left:${r.left - b.left}px;top:${r.top - b.top}px;width:${W}px;height:${H}px`;
    wrap.style.setProperty('--im', `url("${im.src}")`);
    $('#b-fx').appendChild(wrap);
    const piece = (x, y, w, h, extra = '') => {
      const p = document.createElement('i');
      p.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;background-size:${dw}px ${dh}px;background-position:${ox - x}px ${oy - y}px;${extra}`;
      wrap.appendChild(p); return p;
    };
    return { wrap, W, H, piece };
  }
  const grid = (L, cols, rows, fn) => { const w = L.W / cols, h = L.H / rows; for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) fn(L.piece(cx * w, cy * h, w + 0.5, h + 0.5), cx, cy, cols, rows); };
  const FX = {
    // fire: the picture chars and burns away from the bottom while smoke rises
    burn(L, lite) {
      const p = L.piece(0, 0, L.W, L.H);
      p.animate([{ clipPath: 'inset(0 0 0 0)', filter: 'none' }, { offset: 0.25, filter: 'sepia(1) saturate(3) brightness(1.3)' }, { clipPath: 'inset(0 0 100% 0)', filter: 'sepia(1) saturate(2) brightness(.35) contrast(1.4)' }], { duration: 1100, easing: 'ease-in', fill: 'forwards' });
      const edge = document.createElement('b'); edge.className = 'kfx-ember'; L.wrap.appendChild(edge);
      edge.animate([{ bottom: '-8px', opacity: 1 }, { bottom: `${L.H - 8}px`, opacity: 0.7 }], { duration: 1100, easing: 'ease-in', fill: 'forwards' });
      for (let i = 0; i < (lite ? 3 : 7); i++) {
        const s = document.createElement('b'); s.className = 'kfx-smoke'; s.style.left = `${rnd(5, 85)}%`; L.wrap.appendChild(s);
        s.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { offset: 0.2, opacity: 0.75 }, { transform: `translate(${rnd(-20, 20)}px, ${-L.H * rnd(0.8, 1.4)}px) scale(${rnd(2, 3.2)})`, opacity: 0 }],
          { duration: rnd(1100, 1600), delay: i * 120, easing: 'ease-out', fill: 'both' });
      }
    },
    // ice: a white-blue flash, then the card cracks into shards that burst out and fall
    shatter(L, lite) {
      const c = lite ? 3 : 4, r = lite ? 4 : 5;
      grid(L, c, r, (p, x, y) => {
        p.style.filter = 'saturate(.35) brightness(1.35)'; p.style.boxShadow = 'inset 0 0 6px rgba(200,240,255,.9)';
        const dx = (x - (c - 1) / 2) * rnd(22, 40), dy = (y - (r - 1) / 2) * rnd(16, 30);
        p.animate([{ transform: 'none' }, { offset: 0.15, transform: `translate(${dx * 0.15}px, ${dy * 0.15}px)` }, { offset: 0.45, transform: `translate(${dx}px, ${dy}px) rotate(${rnd(-90, 90)}deg)`, opacity: 1 },
          { transform: `translate(${dx * 1.3}px, ${dy + 160}px) rotate(${rnd(-240, 240)}deg) scale(.6)`, opacity: 0 }], { duration: 1000, delay: 120, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' });
      });
      const f = document.createElement('b'); f.className = 'kfx-flash'; f.style.background = '#cdf3ff'; L.wrap.appendChild(f);
      f.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
    },
    // Noctis: one white slash, the two halves slide apart along the cut and drop
    slash(L) {
      const a = L.piece(0, 0, L.W, L.H, 'clip-path:polygon(0 0,100% 0,100% 38%,0 68%)'), b = L.piece(0, 0, L.W, L.H, 'clip-path:polygon(0 68%,100% 38%,100% 100%,0 100%)');
      const cut = document.createElement('b'); cut.className = 'kfx-cut'; L.wrap.appendChild(cut);
      cut.animate([{ transform: 'rotate(-17deg) scaleX(0)', opacity: 1 }, { offset: 0.35, transform: 'rotate(-17deg) scaleX(1.3)', opacity: 1 }, { transform: 'rotate(-17deg) scaleX(1.3)', opacity: 0 }], { duration: 420, fill: 'forwards' });
      a.animate([{ transform: 'none' }, { offset: 0.3, transform: 'translate(-10px, -6px) rotate(-4deg)' }, { transform: 'translate(-34px, 120px) rotate(-28deg)', opacity: 0 }], { duration: 1100, delay: 180, easing: 'ease-in', fill: 'forwards' });
      b.animate([{ transform: 'none' }, { offset: 0.3, transform: 'translate(10px, 8px) rotate(4deg)' }, { transform: 'translate(34px, 150px) rotate(30deg)', opacity: 0 }], { duration: 1100, delay: 180, easing: 'ease-in', fill: 'forwards' });
    },
    // PAWS: the card is torn down the middle along a ragged line, the halves twist away
    tear(L) {
      const pts = []; for (let i = 0; i <= 10; i++) pts.push([50 + (i % 2 ? 7 : -7) * rnd(0.5, 1.2), i * 10]);
      const left = 'polygon(0 0,' + pts.map(([x, y]) => `${x}% ${y}%`).join(',') + ',0 100%)';
      const right = 'polygon(100% 0,' + pts.map(([x, y]) => `${x}% ${y}%`).join(',') + ',100% 100%)';
      const a = L.piece(0, 0, L.W, L.H, `clip-path:${left};transform-origin:0 100%`), b = L.piece(0, 0, L.W, L.H, `clip-path:${right};transform-origin:100% 100%`);
      a.animate([{ transform: 'none' }, { offset: 0.25, transform: 'rotate(-7deg)' }, { transform: 'translate(-30px, 110px) rotate(-40deg)', opacity: 0 }], { duration: 1100, easing: 'ease-in', fill: 'forwards' });
      b.animate([{ transform: 'none' }, { offset: 0.25, transform: 'rotate(7deg)' }, { transform: 'translate(30px, 120px) rotate(42deg)', opacity: 0 }], { duration: 1100, easing: 'ease-in', fill: 'forwards' });
    },
    // Notcoin: the card is squashed flat, then breaks into blocks that drop and bounce
    crush(L, lite) {
      const c = lite ? 2 : 3, r = lite ? 3 : 4;
      grid(L, c, r, (p, x, y) => {
        const dx = (x - (c - 1) / 2) * rnd(10, 26);
        p.animate([{ transform: 'none' }, { offset: 0.2, transform: `translateY(${(r - y) * 6}px) scaleY(.7)` }, { offset: 0.65, transform: `translate(${dx}px, ${L.H * 0.55}px) rotate(${rnd(-50, 50)}deg)`, opacity: 1 },
          { offset: 0.8, transform: `translate(${dx * 1.2}px, ${L.H * 0.45}px) rotate(${rnd(-70, 70)}deg)` }, { transform: `translate(${dx * 1.4}px, ${L.H * 0.6}px) rotate(${rnd(-90, 90)}deg)`, opacity: 0 }],
          { duration: 1100, easing: 'ease-in', fill: 'forwards' });
      });
    },
    // mages: the picture crumbles into dust that drifts away, one side first
    dust(L, lite) {
      const c = lite ? 5 : 8, r = lite ? 6 : 10;
      grid(L, c, r, (p, x, y) => {
        p.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${rnd(30, 110)}px, ${rnd(-110, -20)}px) rotate(${rnd(-120, 120)}deg) scale(.2)`, opacity: 0 }],
          { duration: rnd(700, 1100), delay: (x / c) * 500 + rnd(0, 250), easing: 'ease-in', fill: 'forwards' });
      });
    },
  };
  const KILL_COLORS = { burn: '#ff7a1a', shatter: '#bdf0ff', slash: '#ffffff', tear: '#ff3b3b', crush: '#ffc531', dust: '#c9a6ff' };
  function kill(uid, by, victimMine) {
    const e = BT && BT.els.get(uid), lv = level();
    if (!e || !lv || e.root.classList.contains('gone')) return;
    const kind = killKind(by, victimMine), L = layer(e);
    e.root.classList.add('gone', 'k-' + kind);
    FX[kind](L, lv < 2);
    spark(e.root, KILL_COLORS[kind], lv < 2 ? 1 : 2);
    if (kind === 'crush' || kind === 'shatter') anim($('#battle'), 'shake');
    setTimeout(() => L.wrap.remove(), 1800);
  }
  return { intro, kill, killKind, ENTRY, KILL };
})();
