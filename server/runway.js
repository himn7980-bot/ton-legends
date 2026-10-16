// Gram Legends — fusion art generated with Runway (Gen-4 Image, text + up to 3 reference images).
// The original posters of the parts go along as @tagged references so the fusion keeps their look.
//   RUNWAYML_API_SECRET  API key from dev.runwayml.com (the API has its own credits, separate from the web app)
//   RUNWAY_MODEL         default gen4_image (gen4_image_turbo is faster/cheaper)
//   RUNWAY_RATIO         default 1080:1440 (portrait card)
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const { promptFor } = require('./fusion-dna.js');

const API = (process.env.RUNWAY_API || 'https://api.dev.runwayml.com').replace(/\/$/, '');
const VERSION = '2024-11-06';
const IMAGES = path.join(__dirname, '..', 'src', 'images');
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = function createRunway({ saveArt, hasArt, log = () => {}, pollMs = 4000, timeoutMs = 240e3 }) {
  const key = () => process.env.RUNWAYML_API_SECRET || '';
  const model = () => process.env.RUNWAY_MODEL || 'gen4_image';
  const ratio = () => process.env.RUNWAY_RATIO || '1080:1440';
  const refUri = id => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(IMAGES, id + '.jpg')).toString('base64');

  async function call(method, url, body) {
    const r = await fetch(API + url, { method, headers: { Authorization: `Bearer ${key()}`, 'X-Runway-Version': VERSION, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (!r.ok) throw new Error(`Runway ${r.status}: ${(j && (j.error || j.message)) || text.slice(0, 200)}`);
    return j;
  }

  // One fusion card: start the task, wait for it, download the image and save it as the card's art.
  async function generate(num) {
    const f = E.FUSIONS.find(x => x.num === num);
    if (!f) throw new Error(`#${num} is not a fusion card`);
    if (!key()) throw new Error('RUNWAYML_API_SECRET is not set');
    const p = promptFor(f);
    const task = await call('POST', '/v1/text_to_image', { model: model(), ratio: ratio(), promptText: p.text, referenceImages: p.refs.map(id => ({ uri: refUri(id), tag: id })) });
    const t0 = Date.now();
    for (;;) {
      await sleep(pollMs);
      const s = await call('GET', `/v1/tasks/${task.id}`);
      if (s.status === 'SUCCEEDED') {
        const url = (s.output || [])[0];
        if (!url) throw new Error('Runway returned no image');
        const img = await fetch(url);
        if (!img.ok) throw new Error('image download failed ' + img.status);
        const buf = Buffer.from(await img.arrayBuffer());
        const type = img.headers.get('content-type') || '';
        await saveArt(num, buf, /png/.test(type) ? '.png' : /webp/.test(type) ? '.webp' : '.jpg');
        return { num, name: f.name };
      }
      if (s.status === 'FAILED' || s.status === 'CANCELLED') throw new Error(`Runway task ${s.status}: ${s.failure || s.failureCode || ''}`);
      if (Date.now() - t0 > timeoutMs) throw new Error('Runway task timed out');
    }
  }

  // A queue that works through many cards one at a time (keeps within rate limits; stops on demand).
  const job = { running: false, list: [], done: 0, failed: [], stop: false };
  async function runQueue(nums, { force = false, onProgress = () => {} } = {}) {
    if (job.running) throw new Error('a generation job is already running (/gen status, /gen stop)');
    Object.assign(job, { running: true, list: nums.filter(n => force || !hasArt(n)), done: 0, failed: [], stop: false });
    const total = job.list.length;
    try {
      for (const num of job.list) {
        if (job.stop) break;
        try { await generate(num); job.done++; } catch (e) {
          job.failed.push(num); log(`#${num}: ${e.message}`);
          if (/401|403|credit|insufficient|not set/i.test(e.message)) { await onProgress({ error: e.message, done: job.done, total }); break; }
        }
        if ((job.done + job.failed.length) % 5 === 0) await onProgress({ done: job.done, failed: job.failed.length, total });
      }
    } finally { job.running = false; }
    return { done: job.done, failed: job.failed, total, stopped: job.stop };
  }
  return { generate, runQueue, job, enabled: () => !!key() };
};

// Card numbers from a /gen argument: "81", "1-22", "named", "bosses", "all".
module.exports.parseTargets = function parseTargets(arg) {
  const a = String(arg || '').trim().toLowerCase();
  const all = E.FUSIONS.map(f => f.num);
  if (a === 'all') return all;
  if (a === 'named') return require('../src/fusions-data.js').FUSION_DATA.filter(x => x[2]).map(x => x[0]);
  if (a === 'bosses') return [...new Set(E.WORLDS.flatMap(w => [w.boss, ...w.foes]).filter(id => /^f\d+$/.test(id)).map(id => +id.slice(1)))];
  const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(a);
  if (!m) return [];
  const lo = +m[1], hi = m[2] ? +m[2] : lo;
  return all.filter(n => n >= Math.min(lo, hi) && n <= Math.max(lo, hi));
};
