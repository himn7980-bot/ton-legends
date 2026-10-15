// Writes docs/fusion-prompts.csv: every fusion card's art prompt and which hero posters to attach as references
// (for generating cards by hand in Runway's web app; the bot's /gen does the same automatically).
// usage: node tools/fusion-prompts.js
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const { promptFor } = require('../server/fusion-dna.js');
const q = s => `"${String(s).replace(/"/g, '""')}"`;
const rows = [['number', 'name', 'type', 'reference_images (tag = file in src/images)', 'prompt']];
for (const f of E.FUSIONS) { const p = promptFor(f); rows.push([f.num, q(f.name), f.parts.length === 3 ? 'trio' : 'duo', q(p.refs.map(id => `@${id} = ${id}.jpg`).join(', ')), q(p.text)]); }
const out = path.join(__dirname, '..', 'docs', 'fusion-prompts.csv');
fs.writeFileSync(out, rows.map(r => r.join(',')).join('\n') + '\n');
console.log(out, rows.length - 1, 'prompts');
