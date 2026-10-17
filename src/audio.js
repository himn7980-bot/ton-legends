// Gram Legends — synthesized sound effects and music (WebAudio, no audio files)
const Sound = (() => {
  let ctx = null, master = null, sfxGain = null, musicGain = null, musicTimer = null, musicMode = null, step = 0;
  const opts = { sfx: true, music: true };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = opts.sfx ? 0.5 : 0; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = opts.music ? 0.13 : 0; musicGain.connect(master);
    if (musicMode) startMusic(musicMode);
  }

  function tone(freq, dur, { type = 'sine', vol = 1, slide = 0, delay = 0, out = sfxGain } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.5, delay = 0, freq = 1200 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
  }

  let lastHit = 0;
  const SFX = {
    click() { tone(660, 0.06, { type: 'triangle', vol: 0.4 }); },
    hit() { const n = performance.now(); if (n - lastHit < 45) return; lastHit = n; noise(0.08, { vol: 0.35, freq: 900 }); tone(180, 0.08, { type: 'square', vol: 0.12, slide: 0.5 }); },
    crit() { noise(0.15, { vol: 0.6, freq: 2500 }); tone(320, 0.18, { type: 'sawtooth', vol: 0.25, slide: 0.4 }); },
    heal() { [784, 988, 1175].forEach((f, i) => tone(f, 0.25, { vol: 0.25, delay: i * 0.06 })); },
    shield() { tone(440, 0.3, { type: 'triangle', vol: 0.3, slide: 1.5 }); },
    skill() { tone(220, 0.45, { type: 'sawtooth', vol: 0.25, slide: 4 }); noise(0.4, { vol: 0.3, freq: 3000, delay: 0.15 }); },
    count() { tone(880, 0.12, { type: 'square', vol: 0.18 }); tone(440, 0.2, { type: 'triangle', vol: 0.2 }); },
    go() { tone(523, 0.12, { type: 'square', vol: 0.2 }); tone(784, 0.14, { type: 'square', vol: 0.2, delay: 0.08 }); tone(1047, 0.35, { type: 'sawtooth', vol: 0.2, delay: 0.16 }); noise(0.3, { vol: 0.3, freq: 2500, delay: 0.16 }); },
    die() { tone(300, 0.35, { type: 'square', vol: 0.15, slide: 0.25 }); },
    boss() { tone(80, 0.7, { type: 'sawtooth', vol: 0.4, slide: 0.6 }); noise(0.6, { vol: 0.5, freq: 400 }); },
    coin() { tone(988, 0.08, { type: 'square', vol: 0.15 }); tone(1319, 0.2, { type: 'square', vol: 0.15, delay: 0.08 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.18, { type: 'triangle', vol: 0.35, delay: i * 0.13 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.3, delay: i * 0.22 })); },
    chest() { noise(0.3, { vol: 0.4, freq: 1500 }); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { vol: 0.25, delay: 0.3 + i * 0.07 })); },
    legend() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.3, delay: 1 + i * 0.1 })); },
  };

  // Simple procedural music: pentatonic arpeggio over a bass line.
  const SCALES = { menu: [262, 294, 330, 392, 440, 523, 587, 659], battle: [220, 262, 294, 330, 392, 440, 523, 587] };
  const BASS = { menu: [131, 131, 110, 98], battle: [110, 110, 98, 87] };
  function startMusic(mode) {
    musicMode = mode;
    if (!ctx) return;
    clearInterval(musicTimer);
    const tempo = mode === 'battle' ? 170 : 260;
    step = 0;
    musicTimer = setInterval(() => {
      if (!opts.music || document.hidden) return;
      const sc = SCALES[mode], bar = Math.floor(step / 8) % 4;
      if (step % 8 === 0) tone(BASS[mode][bar], tempo / 1000 * 7, { type: 'triangle', vol: 0.6, out: musicGain });
      const pat = mode === 'battle' ? [0, 2, 4, 2, 5, 4, 2, 3] : [0, 4, 2, 5, 3, 6, 4, 7];
      const n = sc[(pat[step % 8] + bar) % sc.length];
      tone(n * 2, tempo / 1000 * 1.6, { type: mode === 'battle' ? 'square' : 'sine', vol: mode === 'battle' ? 0.18 : 0.35, out: musicGain });
      step++;
    }, tempo);
  }

  return {
    init,
    play(name) { if (ctx && opts.sfx && SFX[name]) try { SFX[name](); } catch (e) {} },
    music: startMusic,
    set(o) {
      Object.assign(opts, o);
      if (ctx) { sfxGain.gain.value = opts.sfx ? 0.5 : 0; musicGain.gain.value = opts.music ? 0.13 : 0; }
    },
  };
})();
