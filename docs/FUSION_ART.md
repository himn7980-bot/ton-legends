# Fusion card artwork — how to add the 680 images

## The numbers
Every combination of the 16 heroes is a fusion card with a **permanent number**:

| Range | Type | Count |
|---|---|---|
| **#1 – #120** | Duo (2 heroes) · Mythic | 120 |
| **#121 – #680** | Trio (3 heroes) · Cosmic | 560 |

- **`docs/fusion-catalog.html`** — open it on your phone: every number with the pictures of its heroes, plus search (type `37` or `volya`).
- **`docs/fusion-list.csv`** — the same list as a spreadsheet.

## Uploading (easiest: through your own bot)
1. One-time: in Render → your service → **Environment**, add `ADMIN_IDS` = your Telegram ID
   (send `/art` to the bot once — it replies with your ID). Save → it redeploys.
2. In the bot send **`/art`** → it answers e.g. *"Next: #1 Golden Bull — Parts: Pink Bull + Notcoin"*.
3. **Send the picture.** The bot saves it as that card and tells you the next one. Repeat.

Other ways to say which card a picture is (all optional):
- write the number in the photo's **caption** (`37`), or
- send it as a **file named `37.png`**, or
- send **`/art 37`** first.

More commands: **`/artlist`** (which numbers are still missing) · **`/artdel 37`** (remove #37 to replace it).

The image appears in the game right away. Until a card has art, the game draws a temporary
card from the parent heroes' posters.

## Image format
Portrait **2:3**, ideally **1024 × 1536**, same 3D collectible-poster style as the hero cards,
the card name on the pedestal. Duo = pink/magenta accents, trio = cyan/holographic accents.
Sending as a *photo* is fine (Telegram compresses it a little); send as a *file* for full quality.

## Game rules (players choose the heroes themselves in the Fusion Lab)
| Type | Hero level needed | Cost | Worldwide copies of each card |
|---|---|---|---|
| Duo | all parts 8+ | 4,000 coins | 300 (numbered serials) |
| Trio | all parts 12+ | 15,000 coins | 30 (numbered serials) |
