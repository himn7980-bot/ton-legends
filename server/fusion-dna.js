// Gram Legends — "DNA" of the 16 heroes (what makes each one recognizable) and the art prompt for every fusion card.
// A fusion takes the body and face of one part, the outfit of another and the props/effects of the third, and the
// original posters are sent along as reference images (@tag) so the model keeps each character's look.
const E = require('../src/engine.js');

const DNA = {
  pinkbull: { who: 'a muscular pink cartoon bull with big golden horns, a cheeky confident grin, flexing', wear: 'maroon-red boxing shorts with gold trim and a gold chain with a round gold medallion', prop: 'flying gold coins and dollar bills', fx: 'a golden money storm', place: 'a neon night city' },
  notcoin: { who: 'a hero whose head is a big shiny gold coin with an angry face and a black triangle emblem', wear: 'heavy black-and-gold armor with triangle emblems and a torn gold cape', prop: 'a glowing golden coin of energy in one hand', fx: 'crackling golden lightning', place: 'a dark city under a blue moon' },
  volya: { who: 'a chibi vinyl-toy superhero with slick black hair, a small black mustache and glowing red star-shaped eyes', wear: 'a blue superhero suit with a round TON-blue chest emblem, red gloves, red boots, gold belt and a flowing red cape', prop: 'clenched heroic fists', fx: 'red laser-eye beams', place: 'a rocky peak above a night city' },
  egor: { who: 'a slim young miner with smooth bright-blue skin, shaggy black hair and a simple happy face', wear: 'a leather vest with straps, dark trousers, worn boots and a small lantern on the belt', prop: 'a glowing ice-blue crystal pickaxe', fx: 'shards of glowing blue crystal', place: 'a crystal mine cave' },
  paws: { who: 'a cute panda with black eye patches', wear: 'a red-and-black hoodie jacket with paw-print emblems, black cargo pants, red sneakers and a glowing triangle pendant', prop: 'a glowing red paw-print energy blast', fx: 'red energy ribbons', place: 'a moonlit neon skyline' },
  noctis: { who: 'a tall mysterious hooded figure whose face is hidden in darkness', wear: 'a flowing dark-indigo cloak with a thin glowing violet halo ring behind the head', prop: 'drifting shadow tendrils', fx: 'purple shadow mist', place: 'gothic spires at night' },
  gramcat: { who: 'a fluffy white cat with deep blue eyes', wear: 'silver shoulder armor and bracers over a navy tunic with a light-blue sash', prop: 'a curved silver bow with a glowing crystal arrow', fx: 'swirling blue petals', place: 'floating sky castles in the clouds' },
  utya: { who: 'a yellow duckling with a big orange beak and big shiny eyes', wear: 'a white hoodie with little cat ears, a white puffer jacket, black pants and white sneakers', prop: 'crystalline ice wings', fx: 'snowflakes and frost wind', place: 'an icy night city' },
  pengu: { who: 'a black-and-white penguin with an orange beak and white ski goggles pushed up on the head', wear: 'a puffy glossy blue jacket over a black tee with a triangle logo, black cargo pants with straps and white sneakers', prop: 'a swirl of frost energy', fx: 'freezing blue mist', place: 'a frozen blue night city' },
  memegram: { who: 'a smooth blue rounded meme character with a big flat head, a deadpan face (straight line mouth, one raised eyebrow) and a white sparkle star on the forehead', wear: 'a dark sleeveless vest with silver trim and a star emblem', prop: 'a floating white sparkle star in an open hand', fx: 'twinkling stars', place: 'a ring of ancient floating stones' },
  yoda: { who: 'a small teal-green alien sage with big dark eyes, long pointed ears, a crest of spikes and glowing marks on the forehead', wear: 'a beige-and-navy robe with glowing blue triangle runes', prop: 'a gnarled wooden staff with a glowing crystal', fx: 'orbiting crystal shards and rocks', place: 'a mystic night sky' },
  virus: { who: 'a round glossy lime-green slime virus with knobby tentacle spikes, big shiny black eyes and a small smile', wear: 'a leather belt with little potion vials', prop: 'a small golden key-shaped wand', fx: 'floating soap bubbles and green toxic glow', place: 'a cozy alchemy lab' },
  babyshark: { who: 'a cheerful yellow baby shark with a white belly, a huge happy smile with little teeth and brown eyes', wear: 'a teal-and-gold harness with a seashell emblem', prop: 'a spinning water spout', fx: 'bubbles and swirling water', place: 'underwater ruins with coral' },
  yaya: { who: 'a fluffy yellow duck with a wide orange beak and a happy face', wear: 'a red Chinese silk jacket with gold knot buttons and cloud patterns and a red cap with a jade button', prop: 'a red paper lantern on a golden staff', fx: 'friendly little fire spirits', place: 'a lantern festival temple' },
  dog: { who: 'a white plush dog with big black oval eyes, long floppy ears and a small cross stitch on the head', wear: 'an orange scarf, a denim courier vest and a leather messenger bag', prop: 'a glowing envelope with a paper-plane emblem', fx: 'flying glowing letters', place: 'a steampunk mail city with airships' },
  teddy: { who: 'a pink teddy bear boss with a confident smirk', wear: 'a black-and-pink varsity bomber jacket with bear patches, black pants and pink sneakers', prop: 'a steaming coffee mug', fx: 'stacks of gold coins', place: 'a cozy startup loft' },
};

// Shared look of every card (matches the existing posters).
const STYLE = 'Collectible card art: stylized 3D vinyl-toy render, full body on a dark rock pedestal, rim light, big glowing blue moon behind, ' +
  'magic particles, vibrant colors, sharp details, centered portrait.';
const RULES = 'Exactly ONE character. No text, letters, logos or frame.';
const AURA = { 2: 'a soft magenta fusion aura', 3: 'a cyan cosmic aura with tiny stars' };

// Which part gives the body, the outfit and the props rotates with the card number, so every hero leads some fusions.
function roles(f) {
  const k = f.parts.length, r = f.num % k;
  return f.parts.slice(r).concat(f.parts.slice(0, r));
}
function promptFor(f) {
  const [a, b, c] = roles(f), A = DNA[a], B = DNA[b], C = c ? DNA[c] : null;
  const intro = (C ? `A single new hero born from fusing @${a}, @${b} and @${c}.` : `A single new hero born from fusing @${a} and @${b}.`) + ' ' + RULES;
  const body = `Body and face of @${a}: ${A.who}.`;
  const outfit = `Wearing the outfit of @${b}: ${B.wear}.`;
  const prop = C ? `Holding @${c}'s signature item: ${C.prop}; surrounded by ${C.fx} and ${A.fx}.` : `Holding @${b}'s signature item: ${B.prop}; surrounded by ${A.fx} and ${B.fx}.`;
  const bg = `Background: ${A.place} blended with ${(C || B).place}, with ${AURA[f.parts.length]}.`;
  const keep = `Keep every signature detail of ${C ? 'all three' : 'both'} characters clearly recognizable.`;
  // Runway allows 1000 characters: drop the background line first if a long trio does not fit.
  let text = [intro, body, outfit, prop, bg, keep, STYLE].join(' ');
  if (text.length > 1000) text = [intro, body, outfit, prop, keep, STYLE].join(' ');
  if (text.length > 1000) text = text.slice(0, 1000);
  return { text, refs: f.parts };
}
module.exports = { DNA, STYLE, promptFor, roles };
// CLI: node server/fusion-dna.js 81 → print the prompt of fusion #81
if (require.main === module) {
  const f = E.FUSIONS.find(x => x.num === +process.argv[2]) || E.FUSIONS[0];
  const p = promptFor(f);
  console.log(`#${f.num} ${f.name} (${p.text.length} chars, refs: ${p.refs.join(', ')})\n\n${p.text}`);
}
