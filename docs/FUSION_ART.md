# Fusion card artwork — brief

## How many images are possible?
With 16 heroes (order doesn't matter):

| Combination | Formula | Count |
|---|---|---|
| Pairs (duo) | C(16,2) | **120** |
| Triples (trio) | C(16,3) | **560** |
| Pairs + triples | | **680** |
| (Quads, for reference) | C(16,4) | 1,820 |

680 images is not practical — and it would also kill rarity (if everything exists, nothing is special).
The game ships with a **curated set of 22**: 16 duos + 6 trios. Every hero appears in exactly 2 duos, so
nobody's favourite is left out. More can be added later as "seasons" (just add an entry in `src/engine.js`).

| Tier | Rarity | Cards | Worldwide supply each | Craft cost | Parts needed at level |
|---|---|---|---|---|---|
| Duo | Mythic 💗 | 16 | 300 numbered copies | 4,000 coins | 8+ |
| Trio | Cosmic 💎 | 6 | 30 numbered copies | 15,000 coins | 12+ |

## Format (same as your current posters)
- Portrait **2:3**, at least **1024 × 1536** (JPG or PNG is fine — I'll convert).
- Same 3D-chibi collectible poster style, character(s) on a **stone pedestal** with the **card name** carved/glowing on it.
- Duo frame accent **pink/magenta**, trio frame accent **cyan/holographic**.
- Send them with the file name below (or just tell me which one is which).

## The 22 cards

### Duo fusions (Mythic)
| # | File name | Name | Parts | Art direction |
|---|---|---|---|---|
| 1 | `f_golden_bull` | Golden Bull | Pink Bull × Notcoin | Pink Bull in Notcoin's black-gold armour, glowing Notcoin triangle medallion, gold lightning, neon city |
| 2 | `f_sky_hunters` | Sky Hunters | Gramcat × Utya | White cat archer riding/beside duck with ice-crystal wings, both drawing glowing bows over floating sky castle |
| 3 | `f_frost_twins` | Frost Twins | Pengu × Utya | Penguin and duck back-to-back in matching blue puffer jackets, ice wings, snowstorm, blue moon |
| 4 | `f_arctic_tide` | Arctic Tide | Baby Shark × Pengu | Baby Shark wearing Pengu's goggles, half water half ice swirl, underwater-meets-arctic |
| 5 | `f_crystal_star` | Crystal Star | Egor × Memegram | Blue miner with crystal pickaxe, Memegram's star sparkles orbiting, crystal cave + cosmic portal |
| 6 | `f_shadow_paw` | Shadow Paw | Noctis Veyl × PAWS | Panda in a dark hooded cloak, red glowing paw, purple halo, shadow city |
| 7 | `f_toxic_sage` | Toxic Sage | Virus × Yoda | Green little sage with a staff, potion bottles on belt, green bubbles and blue runes |
| 8 | `f_lantern_hug` | Lantern Hug | Teddy × Yaya | Pink bear in a red Chinese silk jacket hugging duck holding a red lantern, gold coins, temple at night |
| 9 | `f_courier_cat` | Courier Cat | telegram.dog × Gramcat | White dog-cat courier with satchel and bow, paper-plane arrows, airship sunset |
| 10 | `f_legend_sentinel` | Legend Sentinel | Volya × Notcoin | Superhero in gold-black armour cape, red laser eyes, Notcoin shield emblem |
| 11 | `f_bull_market` | Bull Market Boss | Pink Bull × Teddy | Muscular pink bull in Teddy's varsity jacket at a desk, rising green charts, coins |
| 12 | `f_cosmic_sage` | Cosmic Sage | Memegram × Yoda | Blue star-headed mage in sage robes, floating crystals, galaxy portal |
| 13 | `f_plague_shadow` | Plague Shadow | Noctis Veyl × Virus | Hooded shadow figure with glowing green virus orbs, toxic mist, dark spires |
| 14 | `f_lantern_reef` | Lantern Reef | Baby Shark × Yaya | Baby Shark carrying a glowing red lantern underwater, lantern-fish, coral temple |
| 15 | `f_crystal_claw` | Crystal Claw | Egor × PAWS | Panda in a miner's vest with crystal claws, blue crystal shards, red hoodie |
| 16 | `f_sky_courier` | Sky Courier | Volya × telegram.dog | Caped hero flying with the white dog-courier, golden letters/paper planes trailing |

### Trio fusions (Cosmic)
| # | File name | Name | Parts | Art direction |
|---|---|---|---|---|
| 17 | `f_ton_treasury` | TON Treasury | Notcoin × Pink Bull × Teddy | The three as a vault crew on a mountain of TON coins, golden vault door, epic lighting |
| 18 | `f_frozen_ocean` | Frozen Ocean | Baby Shark × Pengu × Utya | Shark, penguin and duck on an iceberg in a frozen sea, aurora sky |
| 19 | `f_night_plague` | Night Plague | Noctis Veyl × PAWS × Virus | Dark trio under a purple moon, red paw energy + green toxic glow |
| 20 | `f_crystal_cosmos` | Crystal Cosmos | Egor × Memegram × Yoda | Miner, star-mage and sage around a giant floating crystal, galaxy background |
| 21 | `f_legend_express` | Legend Express | Volya × telegram.dog × Gramcat | Hero, dog-courier and cat-archer on a flying airship delivering glowing letters |
| 22 | `f_lantern_festival` | Lantern Festival | Yaya × Teddy × Baby Shark | Lantern festival night, sky full of red lanterns, the three celebrating with fireworks |

Until your art arrives, the game uses auto-generated placeholder cards built from the parent posters
(`tools/make_fusion_placeholders.py`). Dropping a real image in `src/images/<file name>.jpg` replaces it.
