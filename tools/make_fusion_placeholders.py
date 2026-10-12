"""Generate temporary fusion card art from the parent cards (slanted slices + frame + title).
Real artwork goes in src/images/<fusion id>.jpg and simply replaces these files.
usage: python3 tools/make_fusion_placeholders.py [--force]"""
import json, pathlib, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

root = pathlib.Path(__file__).resolve().parent.parent
img_dir = root / "src" / "images"
fusions = json.loads(subprocess.check_output(["node", "-e", "const E=require('./src/engine.js');console.log(JSON.stringify(E.FUSIONS))"], cwd=root))
names = json.loads(subprocess.check_output(["node", "-e", "const E=require('./src/engine.js');console.log(JSON.stringify(Object.fromEntries(E.BASE_HEROES.map(h=>[h.id,h.name]))))"], cwd=root))
W, H = 420, 630
font_path = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
big, small = ImageFont.truetype(font_path, 40), ImageFont.truetype(font_path, 20)

def cover(path):
    im = Image.open(path).convert("RGB")
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    top = round((im.height - H) * 0.15)
    return im.crop(((im.width - W) // 2, top, (im.width - W) // 2 + W, top + H))

for f in fusions:
    out = img_dir / f"{f['id']}.jpg"
    if out.exists() and "--force" not in sys.argv:
        continue
    parts = [cover(img_dir / f"{p}.jpg") for p in f["parts"]]
    k = len(parts)
    canvas = Image.new("RGB", (W, H))
    for i, im in enumerate(parts):
        # slanted vertical slices
        mask = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(mask)
        x0, x1, slant = W * i / k, W * (i + 1) / k, 60
        d.polygon([(x0 + slant if i else 0, 0), (x1 + slant if i < k - 1 else W, 0), (x1 - slant if i < k - 1 else W, H), (x0 - slant if i else 0, H)], fill=255)
        canvas.paste(im, (0, 0), mask.filter(ImageFilter.GaussianBlur(3)))
    color = (255, 90, 209) if k == 2 else (70, 240, 255)
    glow = Image.new("RGB", (W, H), color)
    canvas = Image.blend(canvas, glow, 0.12)
    d = ImageDraw.Draw(canvas)
    for w in range(6):  # frame
        d.rounded_rectangle([w, w, W - 1 - w, H - 1 - w], radius=26, outline=tuple(min(255, c + w * 10) for c in color))
    shade = Image.new("L", (W, 170), 0)
    ImageDraw.Draw(shade).rectangle([0, 0, W, 170], fill=200)
    band = Image.new("RGB", (W, 170), (8, 6, 20))
    canvas.paste(band, (0, H - 170), shade.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(canvas)
    tag = "DUO FUSION" if k == 2 else "TRIO FUSION"
    d.text((W / 2, H - 120), tag, font=small, fill=color, anchor="mm")
    d.text((W / 2, H - 78), f["name"], font=big, fill=(255, 255, 255), anchor="mm", stroke_width=3, stroke_fill=(0, 0, 0))
    d.text((W / 2, H - 38), "  ×  ".join(names[p] for p in f["parts"]), font=small, fill=(220, 220, 240), anchor="mm")
    canvas.save(out, quality=82, optimize=True)
    print("made", out.name)
