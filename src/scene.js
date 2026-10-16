// TON Legends — living battle backgrounds. A canvas behind the cards draws a deep nebula, stars on three depth
// layers and the world's own particles (ocean bubbles and light rays, cave crystals, neon rain over a skyline,
// temple embers, lab toxic bubbles, a turning galaxy in the arena). Tilting the phone (or moving a finger) shifts
// the layers for depth, and the cards float and lean in 3D. Skills throw a burst of sparks. Stops by itself when
// the battle closes; honours "reduce motion".
const Scene = (() => {
  const CFG = {
    ocean: { neb: ['#1fa2ff', '#00e0c7', '#0b3d91'], star: '#bfefff', kind: 'bubbles', rays: '#bff6ff' },
    cave: { neb: ['#2b6cff', '#7a3cff', '#00c8ff'], star: '#cfe3ff', kind: 'crystals' },
    city: { neb: ['#ff2fd0', '#3a3cff', '#00e5ff'], star: '#ffd6ff', kind: 'rain', skyline: true },
    temple: { neb: ['#ff6a00', '#ff2a4d', '#7a1fff'], star: '#ffd9a8', kind: 'embers' },
    lab: { neb: ['#2bff88', '#00c2ff', '#7aff2b'], star: '#d6ffe6', kind: 'toxic', hex: true },
    galaxy: { neb: ['#8a3cff', '#ff4fd8', '#2b8cff'], star: '#ffffff', kind: 'galaxy' },
  };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  let cv = null, ctx = null, cfg = null, root = null, W = 0, H = 0, raf = 0, last = 0, time = 0, chapter = 0;
  let stars = [], parts = [], glints = [], bursts = [], shoot = null, sky = null, hex = null;
  const tilt = { x: 0, y: 0 }, aim = { x: 0, y: 0 }, sprites = {};

  // Soft glow dots are pre-rendered once per colour and stamped with drawImage (much cheaper than shadowBlur).
  function sprite(color) {
    if (sprites[color]) return sprites[color];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, '#ffffff'); r.addColorStop(0.18, color); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return (sprites[color] = c);
  }
  const glow = (x, y, size, color, a) => { ctx.globalAlpha = a; ctx.drawImage(sprite(color), x - size / 2, y - size / 2, size, size); };

  function makeSkyline() {
    const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H * 0.32);
    const g = c.getContext('2d'), h = c.height;
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? '#0a0620' : '#150d3a';
      for (let x = -10; x < c.width; ) {
        const w = rnd(18, 46), bh = rnd(h * (layer ? 0.25 : 0.4), h * (layer ? 0.7 : 0.95));
        g.fillRect(x, h - bh, w, bh);
        if (layer) for (let wy = h - bh + 6; wy < h - 4; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6)
          if (Math.random() < 0.28) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,90,220,.75)' : 'rgba(80,230,255,.7)'; g.fillRect(wx, wy, 2, 3); g.fillStyle = '#0a0620'; }
        x += w + rnd(0, 6);
      }
    }
    return c;
  }
  function makeHex() {
    const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H);
    const g = c.getContext('2d'), s = 22; g.strokeStyle = 'rgba(80,255,160,.10)'; g.lineWidth = 1;
    for (let y = 0, row = 0; y < H + s; y += s * 0.87, row++) for (let x = (row % 2) * s * 0.75; x < W + s; x += s * 1.5) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g[k ? 'lineTo' : 'moveTo'](x + s / 2 * Math.cos(a), y + s / 2 * Math.sin(a)); } g.closePath(); g.stroke();
    }
    return c;
  }

  function spawn(p, fresh) {
    const k = cfg.kind;
    p.x = rnd(0, W); p.d = rnd(0.3, 1); p.ph = rnd(0, 6.28); p.life = 0;
    if (k === 'bubbles' || k === 'toxic') { p.y = fresh ? rnd(0, H) : H + 10; p.r = rnd(1.5, k === 'toxic' ? 5 : 6) * p.d; p.vy = -rnd(14, 40) * p.d; }
    else if (k === 'crystals') { p.y = fresh ? rnd(0, H) : H + 10; p.r = rnd(2, 5) * p.d; p.vy = -rnd(5, 16); p.rot = rnd(0, 6.28); p.vr = rnd(-1, 1); }
    else if (k === 'rain') { p.y = fresh ? rnd(0, H) : -20; p.len = rnd(8, 22) * p.d; p.vy = rnd(280, 520) * p.d; p.c = Math.random() < 0.5 ? '255,80,220' : '80,220,255'; }
    else if (k === 'embers') { p.y = fresh ? rnd(0, H) : H + 6; p.r = rnd(0.8, 2.6) * p.d; p.vy = -rnd(18, 60) * p.d; p.vx = rnd(-8, 8); }
    else if (k === 'galaxy') { p.rad = Math.pow(Math.random(), 0.7) * Math.min(W, H) * 0.62; p.arm = (Math.random() * 3 | 0) * 2.094; p.ang = p.arm + p.rad * 0.018 + rnd(-0.35, 0.35); p.r = rnd(0.7, 2.4); p.c = Math.random() < 0.4 ? '#ff7be8' : Math.random() < 0.5 ? '#8ab8ff' : '#ffffff'; }
    return p;
  }

  function resize() {
    const r = root.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sky = cfg.skyline ? makeSkyline() : null; hex = cfg.hex ? makeHex() : null;
  }
  function onTilt(e) { if (e.gamma == null) return; aim.x = Math.max(-1, Math.min(1, e.gamma / 30)); aim.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30)); }
  function onMove(e) { if (!W) return; aim.x = (e.clientX / innerWidth - 0.5) * 1.6; aim.y = (e.clientY / innerHeight - 0.5) * 1.6; }

  function start(canvas, key = 'galaxy', ch = 0) {
    stop();
    cv = canvas; root = canvas.parentElement; ctx = cv.getContext('2d'); cfg = CFG[key] || CFG.galaxy; chapter = ch || 0;
    resize();
    const area = W * H / (390 * 760);
    stars = Array.from({ length: Math.round(170 * area) }, () => ({ x: rnd(0, W), y: rnd(0, H), d: [0.25, 0.55, 1][Math.random() * 3 | 0], r: rnd(0.6, 1.9), ph: rnd(0, 6.28), sp: rnd(1, 3) }));
    const count = { bubbles: 46, crystals: 36, rain: 90, embers: 75, toxic: 42, galaxy: 340 }[cfg.kind];
    parts = Array.from({ length: Math.round(count * (cfg.kind === 'galaxy' ? 1 : area) * (1 + chapter * 0.15)) }, () => spawn({}, true));
    glints = Array.from({ length: 7 }, () => ({ x: rnd(0, W), y: rnd(0, H), t: rnd(0, 4), d: rnd(0.4, 1) }));
    bursts = []; shoot = null; time = 0; last = performance.now();
    addEventListener('deviceorientation', onTilt); addEventListener('pointermove', onMove); addEventListener('resize', resize);
    if (reduce) { frame(last); cancelAnimationFrame(raf); raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    removeEventListener('deviceorientation', onTilt); removeEventListener('pointermove', onMove); removeEventListener('resize', resize);
  }

  // Sparks from a point (skill casts): coordinates relative to the battle screen.
  function burst(x, y, color = '#ffd85a', n = 22) {
    if (!cv || reduce) return;
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(60, 220); bursts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: rnd(0.45, 0.9), r: rnd(6, 16), c: color }); }
  }

  function frame(now) {
    if (!cv || !cv.isConnected || (root && root.hidden)) { stop(); return; }
    raf = reduce ? 0 : requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    tilt.x += (aim.x - tilt.x) * Math.min(1, dt * 3); tilt.y += (aim.y - tilt.y) * Math.min(1, dt * 3);
    const px = d => tilt.x * d * 18, py = d => tilt.y * d * 12;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, W, H);

    // Nebula: three big soft clouds drifting slowly (additive).
    ctx.globalCompositeOperation = 'lighter';
    cfg.neb.forEach((c, i) => {
      const cx = W * (0.25 + 0.5 * ((i * 0.37) % 1)) + Math.sin(time * 0.05 + i * 2) * W * 0.12 + px(0.15);
      const cy = H * (0.2 + 0.3 * i) + Math.cos(time * 0.04 + i) * H * 0.06 + py(0.15);
      const r = Math.max(W, H) * (0.45 + 0.08 * i), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.26 + chapter * 0.04; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });
    if (hex) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.2); ctx.drawImage(hex, px(0.2), py(0.2)); }
    if (cfg.rays) for (let i = 0; i < 3; i++) {
      const x = W * (0.2 + i * 0.3) + Math.sin(time * 0.3 + i) * 30 + px(0.3), g = ctx.createLinearGradient(x, 0, x + 60, H * 0.8);
      g.addColorStop(0, 'rgba(190,246,255,.22)'); g.addColorStop(1, 'rgba(190,246,255,0)');
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 0.7 + i * 2); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 140, H * 0.8); ctx.lineTo(x + 20, H * 0.8); ctx.fill();
    }

    // Stars on three depths, twinkling.
    ctx.fillStyle = cfg.star;
    for (const s of stars) {
      ctx.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.sp + s.ph))) * (0.4 + s.d * 0.6);
      const x = (s.x + px(s.d) + W) % W, y = (s.y + py(s.d) + H) % H;
      ctx.fillRect(x, y, s.r * s.d * 2, s.r * s.d * 2);
      if (s.d === 1 && s.r > 1.5) glow(x + 1, y + 1, 9, cfg.star, ctx.globalAlpha * 0.6);
    }

    // The world's own particles.
    const k = cfg.kind;
    if (k === 'galaxy') {
      const cx = W / 2 + px(0.4), cy = H * 0.5 + py(0.4);
      glow(cx, cy, Math.min(W, H) * 0.95, '#9a5cff', 0.45); glow(cx, cy, Math.min(W, H) * 0.35, '#ffb0f0', 0.5); glow(cx, cy, 60, '#ffffff', 0.8);
      for (const p of parts) {
        p.ang += dt * 9 / Math.sqrt(p.rad + 30);
        const x = cx + Math.cos(p.ang) * p.rad, y = cy + Math.sin(p.ang) * p.rad * 0.42;
        ctx.globalAlpha = 0.9; ctx.fillStyle = p.c; ctx.fillRect(x, y, p.r * 1.4, p.r * 1.4); if (p.r > 1.9) glow(x, y, 8, p.c, 0.5);
      }
    } else for (const p of parts) {
      p.life += dt; p.y += p.vy * dt;
      const x = p.x + px(p.d) + (k === 'embers' ? p.vx * p.life : Math.sin(time * 1.5 + p.ph) * (k === 'rain' ? 0 : 6 * p.d)), y = p.y + py(p.d);
      if (k === 'bubbles') {
        ctx.globalAlpha = 0.55 * p.d; ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.28); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - p.r * 0.4, y - p.r * 0.5, p.r * 0.35, p.r * 0.35);
      } else if (k === 'toxic') {
        glow(x, y, p.r * 6, '#3dff8f', 0.55 * p.d);
      } else if (k === 'crystals') {
        p.rot += p.vr * dt; glow(x, y, p.r * 7, '#5fd0ff', 0.35 * p.d);
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.globalAlpha = 0.85 * p.d; ctx.fillStyle = '#bfefff';
        ctx.beginPath(); ctx.moveTo(0, -p.r * 1.6); ctx.lineTo(p.r * 0.7, 0); ctx.lineTo(0, p.r * 1.6); ctx.lineTo(-p.r * 0.7, 0); ctx.fill(); ctx.restore();
      } else if (k === 'rain') {
        ctx.globalAlpha = 0.45 * p.d; ctx.strokeStyle = `rgba(${p.c},1)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.len * 0.25, y - p.len); ctx.stroke();
      } else if (k === 'embers') {
        glow(x, y, p.r * 7, Math.sin(time * 9 + p.ph) > 0 ? '#ffb347' : '#ff6a1f', (0.5 + 0.4 * Math.sin(time * 7 + p.ph)) * p.d);
      }
      if (p.y < -20 || p.y > H + 30) spawn(p, false);
    }
    if (sky) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9; ctx.drawImage(sky, px(0.2) - 10, H - sky.height + py(0.1)); ctx.globalCompositeOperation = 'lighter'; }

    // Glints: little four-point stars that flash here and there.
    ctx.fillStyle = '#ffffff';
    for (const g of glints) {
      g.t += dt; const ph = g.t % 4, a = ph < 0.6 ? Math.sin(ph / 0.6 * Math.PI) : 0;
      if (ph < dt) { g.x = rnd(0, W); g.y = rnd(0, H); }
      if (a <= 0) continue;
      const x = g.x + px(g.d), y = g.y + py(g.d), s = 7 * g.d * a;
      glow(x, y, s * 3, cfg.star, a * 0.8);
      ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.18, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.18, y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * 0.18); ctx.lineTo(x + s, y); ctx.lineTo(x, y - s * 0.18); ctx.fill();
    }
    // Shooting star now and then.
    if (!shoot && Math.random() < dt * 0.15) shoot = { x: rnd(0, W * 0.6), y: rnd(0, H * 0.4), vx: rnd(380, 520), vy: rnd(120, 220), life: 0 };
    if (shoot) {
      shoot.life += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
      const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18); ctx.stroke();
      if (shoot.life > 1.2) shoot = null;
    }
    // Skill sparks.
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life += dt; if (b.life > b.max) { bursts.splice(i, 1); continue; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.94; b.vy *= 0.94;
      glow(b.x, b.y, b.r * (1 - b.life / b.max) + 2, b.c, 1 - b.life / b.max);
    }
    // Vignette: darker edges push the middle forward.
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,8,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // Cards float and lean in 3D (and toward the tilt). Uses the individual translate/rotate properties so the
    // hit / cast animations (which use transform) still play on top.
    if (root) root.querySelectorAll('.hcard').forEach((n, i) => {
      if (n.classList.contains('dead')) { n.style.translate = ''; n.style.rotate = ''; return; }
      const ph = i * 1.7, rx = Math.sin(time * 0.9 + ph) * 5 - tilt.y * 7, ry = Math.cos(time * 0.7 + ph) * 6 + tilt.x * 9;
      const ang = Math.hypot(rx, ry);
      n.style.translate = `0 ${(Math.sin(time * 1.3 + ph) * 3).toFixed(1)}px`;
      n.style.rotate = ang > 0.01 ? `${rx.toFixed(2)} ${ry.toFixed(2)} 0 ${ang.toFixed(2)}deg` : '';
    });
  }
  return { start, stop, burst, CFG };
})();
