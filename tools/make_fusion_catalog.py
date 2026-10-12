"""Build docs/fusion-catalog.html (all 680 fusion cards with their numbers and parent thumbnails) and docs/fusion-list.csv."""
import base64, io, json, pathlib, subprocess
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads(subprocess.check_output(["node", "-e",
  "const E=require('./src/engine.js');console.log(JSON.stringify({f:E.FUSIONS.map(f=>({n:f.num,p:f.parts,name:f.name})),h:Object.fromEntries(E.BASE_HEROES.map(h=>[h.id,h.name]))}))"], cwd=root))
thumbs = {}
for hid in data["h"]:
    im = Image.open(root / "src" / "images" / f"{hid}.jpg").convert("RGB")
    w = 96; im = im.resize((w, round(im.height * w / im.width)))
    im = im.crop((0, 0, w, round(w * 1.25)))
    b = io.BytesIO(); im.save(b, "JPEG", quality=70)
    thumbs[hid] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

css_thumbs = "\n".join(f".t-{k}{{background-image:url({v})}}" for k, v in thumbs.items())
def item(f):
    names = " + ".join(data["h"][p] for p in f["p"])
    title = f["name"] if "×" not in f["name"] else ""
    return (f'<div class="it" data-s="{f["n"]} {names.lower()} {title.lower()}"><div class="num">{f["n"]}</div>'
            f'<div class="th">{"".join(f"<i class=t-{p}></i>" for p in f["p"])}</div>'
            f'<div class="nm">{names}{f"<small>{title}</small>" if title else ""}</div></div>')
duos = "".join(item(f) for f in data["f"] if len(f["p"]) == 2)
trios = "".join(item(f) for f in data["f"] if len(f["p"]) == 3)
html = f"""<!doctype html><html lang="fa"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fusion Catalog</title><style>
:root{{--bg:#0a0f24;--panel:#141b3a;--line:#2a3570;--text:#eef2ff;--muted:#9aa6d6;--gold:#ffc531}}
body{{margin:0;background:var(--bg);color:var(--text);font-family:Tahoma,system-ui,sans-serif}}
header{{position:sticky;top:0;background:rgba(10,15,36,.96);padding:12px 16px;border-bottom:1px solid var(--line);z-index:2}}
h1{{margin:0 0 8px;font-size:20px}} input{{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-size:16px}}
main{{padding:0 16px 40px}} .how{{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:14px 0;line-height:1.9;direction:rtl}}
.how b{{color:var(--gold)}} h2{{font-size:17px;margin:20px 0 8px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}}
.it{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}}
.num{{font-size:22px;font-weight:900;color:var(--gold);direction:ltr}} .th{{display:flex;gap:3px}}
.th i{{display:block;width:38px;height:48px;border-radius:8px;background-size:cover;background-position:center top}}
.nm{{font-size:12px;line-height:1.4}} .nm small{{display:block;color:#ff8ad9;font-weight:700}}
{css_thumbs}
</style></head><body>
<header><h1>🧪 TON Legends — Fusion Catalog (1–680)</h1><input id="q" placeholder="Search: number or hero name (e.g. 37, volya, pink bull)"></header>
<main>
<div class="how"><b>راهنمای ساده:</b> هر کارت ترکیبی یک <b>شماره</b> دارد (۱ تا ۶۸۰). برای هر شماره، قهرمان‌هایی که باید در تصویر ترکیب شوند کنارش هستند.<br>
<b>آپلود در ربات خودت:</b> در ربات بنویس <b>/art</b> ← ربات می‌گوید کارت بعدی کدام است (مثلاً «#37 Pink Bull × Volya») ← فقط تصویر را بفرست. ربات ذخیره می‌کند و شماره‌ی بعدی را می‌گوید.<br>
برای انتخاب شماره‌ی دلخواه: عدد را در <b>کپشن</b> عکس بنویس (مثلاً 37) یا اسم فایل را <b>37.png</b> بگذار، یا بنویس <b>/art 37</b>.<br>
دستورهای دیگر: <b>/artlist</b> (شماره‌های باقی‌مانده) · <b>/artdel 37</b> (حذف تصویر ۳۷).<br>
اندازه‌ی تصویر: عمودی ۲:۳ مثل پوسترهای فعلی (حداقل ۱۰۲۴×۱۵۳۶)، اسم کارت روی سکو.</div>
<h2>💗 Duo fusions (Mythic) — #1–#120</h2><div class="grid">{duos}</div>
<h2>💎 Trio fusions (Cosmic) — #121–#680</h2><div class="grid">{trios}</div>
</main>
<script>
const q=document.getElementById('q'),items=[...document.querySelectorAll('.it')];
q.oninput=()=>{{const v=q.value.trim().toLowerCase();items.forEach(i=>{{i.style.display=!v||(/^\\d+$/.test(v)?i.dataset.s.split(' ')[0]===v:i.dataset.s.includes(v))?'':'none'}})}};
</script></body></html>"""
(root / "docs").mkdir(exist_ok=True)
(root / "docs" / "fusion-catalog.html").write_text(html, encoding="utf-8")
with open(root / "docs" / "fusion-list.csv", "w", encoding="utf-8") as fh:
    fh.write("number,type,hero_1,hero_2,hero_3,card_name\n")
    for f in data["f"]:
        ps = [data["h"][p] for p in f["p"]] + [""] * (3 - len(f["p"]))
        fh.write(f'{f["n"]},{"duo" if len(f["p"]) == 2 else "trio"},{",".join(ps)},"{f["name"]}"\n')
print("catalog", (root / "docs" / "fusion-catalog.html").stat().st_size // 1024, "KB")
