"""Bundle src/ into a single self-contained HTML file (images embedded) at dist/ton-legends.html."""
import base64, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
html = (src / "index.html").read_text(encoding="utf-8")

images = {p.stem: "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode() for p in sorted((src / "images").glob("*.jpg"))}
game = (src / "game.js").read_text(encoding="utf-8").replace("{/*IMAGES*/}", json.dumps(images))

html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + (src / "style.css").read_text(encoding="utf-8") + "</style>")
for name in ["audio.js", "online.js", "fusions-data.js", "engine.js", "scene.js", "i18n.js", "i18n-world.js", "i18n-social.js", "economy.js", "game.js", "meta.js", "clans.js", "war.js", "pass.js", "arena.js", "extras.js"]:
    code = game if name == "game.js" else (src / name).read_text(encoding="utf-8")
    tag = f'<script src="{name}"></script>'
    assert tag in html, tag
    html = html.replace(tag, "<script>\n" + code + "</script>")

out = root / "dist" / "ton-legends.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(out, f"{out.stat().st_size / 1024:.0f} KB")
