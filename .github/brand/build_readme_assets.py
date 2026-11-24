"""Build the shared Frank README assets. Run from the repo root: python3 .github/brand/build_readme_assets.py .github/brand cytocausal (needs the sibling frank/ repos)."""
import re, sys, pathlib
F = pathlib.Path("/Users/songhaifan/Developer/frank")
out = pathlib.Path(sys.argv[1]); (out / "series").mkdir(parents=True, exist_ok=True)

def inner(path):
    s = path.read_text()
    vb = re.search(r'viewBox="([^"]+)"', s).group(1)
    body = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", s, flags=re.S)
    body = re.sub(r"<title>.*?</title>", "", body, flags=re.S)
    return vb, body

def tile(name, title, bg, src, pad, ink_stroke):
    vb, body = inner(src)
    box = 256 - 2 * pad
    edge = {True: "#1f1e1b", "light": "#f4efe6"}.get(ink_stroke)
    stroke = f' stroke="{edge}" stroke-opacity="{0.14 if ink_stroke is True else 0.28}" stroke-width="4"' if edge else ""
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img"><title>{title}</title>'
           f'<rect x="2" y="2" width="252" height="252" rx="56" fill="{bg}"{stroke}/>'
           f'<svg x="{pad}" y="{pad}" width="{box}" height="{box}" viewBox="{vb}" preserveAspectRatio="xMidYMid meet">{body}</svg></svg>\n')
    (out / "series" / f"{name}.svg").write_text(svg)

def strip_bg(path, tmpname):
    # use a tile's foreground only (drop its own background rect)
    s = re.sub(r"<rect[^>]*/>", "", path.read_text(), count=1)
    p = out / tmpname; p.write_text(s); return p

vd = F / "visdelta/website/components/logo.tsx"
g = re.search(r"(<g transform.*?</g>)", vd.read_text(), re.S).group(1)
vdsvg = out / "_vd.svg"; vdsvg.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 44 232 167">{g}</svg>')

syz = out / "_syz.svg"; syz.write_text((F / "syuze/public/brand/syuze-mark.svg").read_text())
tile("syuze", "syuze 叙仄", "#f4f1ea", syz, 70, True)
tile("news-metro", "News Metro", "#ffffff", F / "news-metro/src/app/icon.svg", 60, True)
tile("ttng", "ttng", "#ffffff", F / "narrative-graph/apps/web/public/brand/ttng-icon.svg", 30, True)
tile("visdelta", "VisDelta", "#ffffff", vdsvg, 52, True)
tile("cytocausal", "cytocausal", "#FBC92B", strip_bg(F / "cytocausal/apps/docs/public/favicon.svg", "_cc.svg"), 0, False)
tile("aethel", "Aethel", "#141414", strip_bg(F / "aethel/explorer_app/public/favicon.svg", "_ae.svg"), 0, "light")
for p in out.glob("_*.svg"): p.unlink()

sig = (F / "news-metro/public/frank-signature.svg").read_text()
(out / "frank-signature-light.svg").write_text(sig)
(out / "frank-signature-dark.svg").write_text(sig.replace("#171916", "#f4efe6"))

# cytocausal lockup: mark (100.8) + 24 gap + wordmark (386.35 x 84), vertically centred
if len(sys.argv) > 2 and sys.argv[2] == "cytocausal":
    b = F / "cytocausal/apps/docs/public/brand"
    mvb, mark = inner(b / "mark.svg")
    for theme, wm in (("light", "wordmark.svg"), ("dark", "wordmark-dark.svg")):
        wvb, word = inner(b / wm)
        w = 100.8 + 24 + 386.35
        (out / f"lockup-{theme}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} 100.8" role="img"><title>cytocausal</title>'
            f'<svg width="100.8" height="100.8" viewBox="{mvb}">{mark}</svg>'
            f'<svg x="124.8" y="8.4" width="386.35" height="84" viewBox="{wvb}">{word}</svg></svg>\n')
print(sorted(str(p.relative_to(out)) for p in out.rglob("*.svg")))
