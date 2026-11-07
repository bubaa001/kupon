"""Generate Kupon PWA icons and the social preview image with Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "public" / "icons"
ICONS.mkdir(parents=True, exist_ok=True)


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def rounded_gradient(size: int) -> Image.Image:
    """Emerald diagonal gradient inside a rounded square."""
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    px = grad.load()
    for y in range(size):
        for x in range(size):
            t = (x / size) * 0.45 + (y / size) * 0.55
            r = int(16 + (5 - 16) * t)
            g = int(185 + (110 - 185) * t)
            b = int(129 + (80 - 129) * t)
            px[x, y] = (r, g, b, 255)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.24), fill=255)
    base.paste(grad, (0, 0), mask)
    return base


def draw_mark(size: int, full_bleed: bool = False) -> Image.Image:
    # Full bleed for maskable icon; smaller mark with padding for normal icons.
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if full_bleed:
        bg = Image.new("RGBA", (size, size), (16, 185, 129, 255))
    else:
        bg = rounded_gradient(size)
    canvas.alpha_composite(bg)

    d = ImageDraw.Draw(canvas)
    s = size * (0.62 if full_bleed else 0.68)
    ox = (size - s) / 2
    oy = (size - s) / 2

    # Wallet body
    wallet = [ox, oy + s * 0.18, ox + s, oy + s * 0.82]
    d.rounded_rectangle(wallet, radius=int(s * 0.14), fill=(255, 255, 255, 255))

    # Wallet flap / pocket
    pocket = [ox + s * 0.56, oy + s * 0.43, ox + s, oy + s * 0.64]
    d.rounded_rectangle(pocket, radius=int(s * 0.08), fill=(6, 78, 59, 255))

    # Clasp dot
    r = s * 0.035
    cx, cy = ox + s * 0.75, oy + s * 0.535
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(110, 231, 183, 255))

    # Receipt peeking above the wallet
    rec = [ox + s * 0.24, oy + s * 0.02, ox + s * 0.69, oy + s * 0.26]
    d.rounded_rectangle(rec, radius=int(s * 0.05), fill=(15, 23, 42, 255))
    for i in range(3):
        y = rec[1] + s * 0.05 + i * s * 0.045
        d.line([rec[0] + s * 0.06, y, rec[2] - s * 0.06, y], fill=(167, 243, 208, 255), width=max(2, int(size * 0.007)))

    # Accent dot in the lower corner
    dot = size * 0.05
    d.ellipse(
        [size - dot * 2.1, size - dot * 2.1, size - dot * 0.9, size - dot * 0.9],
        fill=(15, 23, 42, 255),
    )
    return canvas


def save_icon(name: str, size: int, full_bleed: bool = False):
    draw_mark(size, full_bleed).save(ICONS / name, format="PNG", optimize=True)


save_icon("icon-192.png", 192)
save_icon("icon-512.png", 512)
save_icon("icon-maskable-512.png", 512, full_bleed=True)
save_icon("apple-touch-icon.png", 180)
save_icon("favicon-32.png", 32)

# Social preview uses real cafeteria photography, not a fictional wallet interface.
W, H = 1200, 630
og = Image.new("RGB", (W, H), (248, 250, 252))
photo = Image.open(ROOT / "public" / "food" / "photos" / "pilau-nyama.jpg").convert("RGB")
og.paste(ImageOps.fit(photo, (480, H)), (720, 0))
d = ImageDraw.Draw(og)
d.rectangle([0, 0, 720, H], fill=(248, 250, 252))

mark = draw_mark(74)
og.paste(mark, (72, 58), mark)

d = ImageDraw.Draw(og)
d.text((164, 72), "Kupon", font=font(42), fill=(15, 23, 42))
d.text((72, 210), "Every meal,", font=font(62), fill=(15, 23, 42))
d.text((72, 282), "properly recorded.", font=font(58), fill=(5, 150, 105))
d.text(
    (76, 390),
    "Direct mobile-money checkout.\nVerified meal coupons.\nClear cafeteria sales records.",
    font=font(24, False),
    fill=(71, 85, 105),
    spacing=14,
)

og.save(ROOT / "public" / "og-kupon.jpg", format="JPEG", quality=88, optimize=True, progressive=True)
print("Generated icons and og-kupon.jpg")
