#!/usr/bin/env python3
"""Generate the PWA / home screen icons into public/icons. Needs Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
INK = (42, 31, 61)
S = 1024


def rocket(d, cx, cy, k):
    def P(pts):
        return [(cx + x * k, cy + y * k) for x, y in pts]
    lw = int(14 * k)
    # flame
    d.polygon(P([(-60, 250), (0, 470), (60, 250)]), fill=(255, 90, 30))
    d.polygon(P([(-38, 250), (0, 400), (38, 250)]), fill=(255, 225, 77))
    # fins
    d.polygon(P([(-110, 60), (-230, 250), (-230, 290), (-110, 250)]), fill=(59, 143, 232), outline=INK, width=lw)
    d.polygon(P([(110, 60), (230, 250), (230, 290), (110, 250)]), fill=(59, 143, 232), outline=INK, width=lw)
    # engine
    d.polygon(P([(-60, 230), (60, 230), (90, 280), (-90, 280)]), fill=(167, 176, 194), outline=INK, width=lw)
    # body
    d.rounded_rectangle([cx - 115 * k, cy - 160 * k, cx + 115 * k, cy + 240 * k], radius=40 * k, fill=(232, 68, 58), outline=INK, width=lw)
    # nose
    d.polygon(P([(-115, -150), (-60, -300), (0, -380), (60, -300), (115, -150)]), fill=(247, 212, 60), outline=INK, width=lw)
    # window
    r = 62 * k
    d.ellipse([cx - r, cy - 40 * k - r, cx + r, cy - 40 * k + r], fill=(167, 176, 194), outline=INK, width=lw)
    r = 42 * k
    d.ellipse([cx - r, cy - 40 * k - r, cx + r, cy - 40 * k + r], fill=(120, 200, 245), outline=INK, width=int(8 * k))


def make(maskable=False):
    big = S * 2
    img = Image.new("RGB", (big, big), (26, 20, 70))
    d = ImageDraw.Draw(img)
    for i in range(big):
        t = i / big
        c = (int(26 + 60 * t), int(20 + 20 * t), int(70 + 60 * t))
        d.line([(0, i), (big, i)], fill=c)
    import random
    rnd = random.Random(4)
    for _ in range(60):
        x, y, r = rnd.randrange(big), rnd.randrange(big), rnd.randrange(4, 12)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255))
    rocket(d, big / 2, big / 2 - (20 if maskable else 40), 2 * (0.78 if maskable else 1.0) * 1.05)
    return img.resize((S, S), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
base, mask = make(False), make(True)
base.resize((512, 512), Image.LANCZOS).save(OUT / "icon-512.png")
base.resize((192, 192), Image.LANCZOS).save(OUT / "icon-192.png")
base.resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
mask.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
print("icons written to", OUT)
