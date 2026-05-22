from __future__ import annotations

import base64
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\ho\Documents\New project")
OUTPUT = ROOT / "output"
ASSETS = OUTPUT / "assets"
LOGO_SOURCE = ASSETS / "daxiang_logo_circle.png"

FRONT_PNG = OUTPUT / "水膜001_三只装正方形扁盒_正面平面稿.png"
SPEC_PNG = OUTPUT / "水膜001_三只装正方形扁盒_比例说明稿.png"
STRICT_FRONT_PNG = OUTPUT / "水膜001_严格按品牌规范_正面平面稿.png"
STRICT_RENDER_PNG = OUTPUT / "水膜001_严格按品牌规范_工艺效果图.png"
STRICT_BOARD_PNG = OUTPUT / "水膜001_严格按品牌规范_工艺说明稿.png"
SVG_PATH = OUTPUT / "水膜001_三只装正方形扁盒_正面矢量稿.svg"
PDF_PATH = OUTPUT / "水膜001_三只装正方形扁盒_设计稿.pdf"
LOGO_GOLD = ASSETS / "daxiang_logo_circle_warm_gold.png"

FONT_DIR = Path(r"C:\Windows\Fonts")
FONT_CN = FONT_DIR / "NotoSansSC-VF.ttf"
FONT_CN_BOLD = FONT_DIR / "msyhbd.ttc"
FONT_EN = FONT_DIR / "arial.ttf"
FONT_EN_BOLD = FONT_DIR / "arialbd.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    path: Path,
    max_size: int,
    max_width: int,
    max_height: int,
    min_size: int = 8,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, min_size - 1, -1):
        fnt = font(path, size)
        w, h = text_size(draw, text, fnt)
        if w <= max_width and h <= max_height:
            return fnt
    return font(path, min_size)


def draw_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int] | tuple[int, int, int],
    anchor: str | None = None,
    spacing: int = 4,
) -> None:
    draw.multiline_text(xy, text, font=fnt, fill=fill, anchor=anchor, spacing=spacing)


def wrap_cjk(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> str:
    lines: list[str] = []
    current = ""
    for ch in text:
        test = current + ch
        if text_size(draw, test, fnt)[0] <= max_width or not current:
            current = test
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return "\n".join(lines)


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient_image(size: int) -> Image.Image:
    c1 = (241, 226, 203)
    c2 = (253, 249, 239)
    c3 = (225, 210, 186)
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.55 + y * 0.45) / size
            radial = math.hypot(x / size - 0.55, y / size - 0.42)
            glow = max(0.0, 1.0 - radial * 1.85)
            r = lerp(c1[0], c2[0], t)
            g = lerp(c1[1], c2[1], t)
            b = lerp(c1[2], c2[2], t)
            r = lerp(r, 255, glow * 0.25)
            g = lerp(g, 251, glow * 0.22)
            b = lerp(b, 238, glow * 0.2)
            edge = max(0.0, radial - 0.42) * 0.32
            r = lerp(r, c3[0], edge)
            g = lerp(g, c3[1], edge)
            b = lerp(b, c3[2], edge)
            px[x, y] = (r, g, b, 255)
    return img


def make_gold_logo() -> Image.Image:
    src = Image.open(LOGO_SOURCE).convert("RGBA").resize((900, 900), Image.LANCZOS)
    w, h = src.size
    circle = Image.new("L", (w, h), 0)
    cd = ImageDraw.Draw(circle)
    cd.ellipse((12, 12, w - 12, h - 12), fill=255)

    gray = ImageEnhance.Contrast(src.convert("L")).enhance(1.35)
    dark = gray.point(lambda p: 255 if p < 142 else 0).filter(ImageFilter.GaussianBlur(0.6))
    light = ImageChops.subtract(circle, dark)

    logo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    circle_gold = Image.new("RGBA", (w, h), (190, 151, 76, 255))
    pearl = Image.new("RGBA", (w, h), (255, 251, 238, 255))
    logo.alpha_composite(circle_gold)
    logo = Image.composite(pearl, logo, light)
    logo.putalpha(circle)

    # A quiet diagonal sheen keeps the mark close to the original glossy disc.
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.polygon([(0, 0), (w * 0.75, 0), (0, h * 0.75)], fill=(255, 255, 255, 32))
    sheen.putalpha(ImageChops.multiply(circle, sheen.getchannel("A")))
    logo.alpha_composite(sheen)
    logo.save(LOGO_GOLD)
    return logo


def draw_waves(layer: Image.Image, scale: float) -> None:
    d = ImageDraw.Draw(layer)
    warm = (174, 139, 73, 40)
    pearl = (255, 255, 255, 56)
    for i in range(11):
        y = int((405 + i * 20) * scale)
        pts: list[tuple[int, int]] = []
        for step in range(88):
            x = int((118 + step * 9.4) * scale)
            wave = math.sin(step / 7.0 + i * 0.5) * 11 + math.sin(step / 13.0) * 5
            pts.append((x, int(y + wave * scale)))
        d.line(pts, fill=warm if i % 2 else pearl, width=max(1, int(1.2 * scale)))
    for cx, cy, r, alpha in [
        (692, 445, 10, 52),
        (726, 502, 6, 42),
        (810, 585, 7, 50),
        (205, 506, 5, 35),
        (573, 622, 4, 35),
        (642, 709, 3, 30),
    ]:
        box = (
            int((cx - r) * scale),
            int((cy - r) * scale),
            int((cx + r) * scale),
            int((cy + r) * scale),
        )
        d.ellipse(box, outline=(198, 161, 91, alpha), width=max(1, int(1.4 * scale)))
        inset = int(r * 0.38 * scale)
        d.arc((box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset), 205, 300, fill=(255, 255, 255, alpha), width=max(1, int(scale)))


def front_art(size: int = 3000) -> Image.Image:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    logo = make_gold_logo()
    s = size / 1000
    img = gradient_image(size)
    d = ImageDraw.Draw(img, "RGBA")

    # Pearl paper grain and restrained local-UV water film.
    texture = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(texture)
    for i in range(0, 1000, 18):
        alpha = 9 if i % 36 else 14
        td.line([(0, int(i * s)), (size, int((i + 55) * s))], fill=(255, 255, 255, alpha), width=max(1, int(0.7 * s)))
    draw_waves(texture, s)
    img.alpha_composite(texture)

    # Large background 001, allowed middle area only, with warm transparent film feel.
    f_bg = font(FONT_EN_BOLD, int(255 * s))
    d.text(
        (int(300 * s), int(330 * s)),
        "001",
        font=f_bg,
        fill=(189, 150, 78, 34),
        stroke_width=max(1, int(1.4 * s)),
        stroke_fill=(255, 255, 255, 26),
    )

    # Front face boundary and subtle inner trim.
    d.rounded_rectangle(
        (int(18 * s), int(18 * s), int(982 * s), int(982 * s)),
        radius=int(16 * s),
        outline=(188, 159, 102, 105),
        width=max(2, int(1.8 * s)),
    )
    d.rounded_rectangle(
        (int(42 * s), int(42 * s), int(958 * s), int(958 * s)),
        radius=int(8 * s),
        outline=(255, 255, 255, 70),
        width=max(1, int(1.2 * s)),
    )

    # Locked brand block: top-left.
    brand_color = (160, 126, 61, 255)
    draw_text(d, (int(72 * s), int(74 * s)), "大象", font(FONT_CN_BOLD, int(70 * s)), brand_color)
    draw_text(
        d,
        (int(76 * s), int(178 * s)),
        "EXPLORE\nPLEASURE",
        font(FONT_EN_BOLD, int(26 * s)),
        (132, 102, 49, 255),
        spacing=int(4 * s),
    )

    # Locked logo block: top-right, kept restrained versus the old oversized draft.
    logo_size = int(220 * s)
    logo_resized = logo.resize((logo_size, logo_size), Image.LANCZOS)
    img.alpha_composite(logo_resized, (int(660 * s), int(78 * s)))
    draw_text(d, (int(884 * s), int(82 * s)), "®", font(FONT_EN_BOLD, int(31 * s)), (141, 104, 47, 255))

    # Product-name area: lower-left warm-gold label.
    block_x, block_y = int(72 * s), int(555 * s)
    block_w, block_h = int(514 * s), int(98 * s)
    d.rounded_rectangle(
        (block_x, block_y, block_x + block_w, block_y + block_h),
        radius=int(2 * s),
        fill=(190, 151, 76, 242),
        outline=(149, 111, 49, 190),
        width=max(2, int(1.2 * s)),
    )
    d.rectangle((block_x, block_y, block_x + int(20 * s), block_y + block_h), fill=(229, 202, 137, 255))
    d.ellipse(
        (block_x + int(28 * s), block_y + int(63 * s), block_x + int(52 * s), block_y + int(87 * s)),
        fill=(246, 239, 214, 255),
    )
    f_name = fit_font(d, "水膜001", FONT_CN_BOLD, int(68 * s), int(430 * s), int(76 * s))
    draw_text(d, (block_x + int(66 * s), block_y + int(9 * s)), "水膜001", f_name, (255, 250, 235, 255))

    # Selling-point strip.
    strip_y = int(666 * s)
    d.rounded_rectangle(
        (int(72 * s), strip_y, int(588 * s), strip_y + int(55 * s)),
        radius=int(2 * s),
        fill=(252, 246, 230, 225),
        outline=(178, 139, 68, 185),
        width=max(2, int(1.1 * s)),
    )
    f_strip = fit_font(d, "水性聚氨酯｜水润无味", FONT_CN_BOLD, int(29 * s), int(470 * s), int(38 * s))
    tw, th = text_size(d, "水性聚氨酯｜水润无味", f_strip)
    draw_text(
        d,
        (int(72 * s) + (int(516 * s) - tw) // 2, strip_y + (int(55 * s) - th) // 2 - int(2 * s)),
        "水性聚氨酯｜水润无味",
        f_strip,
        (121, 88, 37, 255),
    )

    # Bottom category information.
    cat_x, cat_y = int(72 * s), int(812 * s)
    d.rounded_rectangle(
        (cat_x, cat_y, cat_x + int(318 * s), cat_y + int(48 * s)),
        radius=int(1.5 * s),
        fill=(255, 253, 246, 185),
        outline=(109, 86, 52, 230),
        width=max(2, int(1.2 * s)),
    )
    f_cat = fit_font(d, "水性聚氨酯避孕套", FONT_CN_BOLD, int(24 * s), int(286 * s), int(30 * s))
    draw_text(d, (cat_x + int(17 * s), cat_y + int(8 * s)), "水性聚氨酯避孕套", f_cat, (57, 48, 38, 255))

    # Locked lower-right count mark: original scale, not a feature graphic.
    icon_color = (111, 84, 43, 255)
    cx, cy, r = int(790 * s), int(845 * s), int(23 * s)
    for dx, dy in [(0, 0), (23, -8), (46, 4)]:
        d.ellipse(
            (cx + int(dx * s), cy + int(dy * s), cx + int(dx * s) + 2 * r, cy + int(dy * s) + 2 * r),
            outline=icon_color,
            width=max(3, int(2 * s)),
        )
    draw_text(d, (int(884 * s), int(844 * s)), "×3", font(FONT_EN_BOLD, int(34 * s)), (50, 42, 32, 255))

    # A few restrained foil highlights on the lower visual field.
    d.line([(int(606 * s), int(744 * s)), (int(840 * s), int(674 * s))], fill=(255, 255, 255, 54), width=max(2, int(2 * s)))
    d.line([(int(609 * s), int(749 * s)), (int(842 * s), int(681 * s))], fill=(187, 148, 78, 31), width=max(1, int(1.1 * s)))

    return img.convert("RGB")


def make_spec(front: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", (1920, 1080), (247, 243, 234))
    d = ImageDraw.Draw(canvas, "RGBA")
    f_title = font(FONT_CN_BOLD, 50)
    f_sub = font(FONT_CN, 24)
    f_note = font(FONT_CN_BOLD, 24)
    f_small = font(FONT_CN, 18)

    draw_text(d, (80, 58), "水膜001 三只装正方形扁盒包装", f_title, (45, 39, 32, 255))
    draw_text(d, (82, 126), "正面版式沿用大象线上1/2/3只装规范；盒型比例 62×20×62mm。", f_sub, (122, 104, 75, 255))

    front_small = front.resize((620, 620), Image.LANCZOS)
    canvas.paste(front_small, (145, 220))
    d.text((337, 870), "正面 62×62mm", font=font(FONT_CN_BOLD, 24), fill=(104, 80, 43, 255), anchor="mm")

    # Flat box ratio sketch: not a cube, side depth is 20/62 of the front.
    fx, fy, fw = 1010, 255, 500
    depth = round(fw * 20 / 62)
    d.rounded_rectangle((fx, fy, fx + fw, fy + fw), radius=7, fill=(248, 239, 222, 255), outline=(173, 139, 78, 220), width=3)
    side = [(fx + fw, fy), (fx + fw + depth, fy + 48), (fx + fw + depth, fy + fw + 48), (fx + fw, fy + fw)]
    top = [(fx, fy), (fx + depth, fy + 48), (fx + fw + depth, fy + 48), (fx + fw, fy)]
    d.polygon(side, fill=(209, 193, 164, 255), outline=(147, 119, 72, 220))
    d.polygon(top, fill=(238, 226, 202, 255), outline=(147, 119, 72, 220))
    d.text((fx + fw // 2, fy + fw + 38), "62mm", font=font(FONT_EN_BOLD, 22), fill=(103, 82, 43, 255), anchor="mm")
    d.text((fx + fw + depth // 2 + 8, fy + fw + 92), "20mm 厚度", font=font(FONT_CN_BOLD, 22), fill=(103, 82, 43, 255), anchor="mm")
    d.line((fx, fy + fw + 12, fx + fw, fy + fw + 12), fill=(103, 82, 43, 255), width=2)
    d.line((fx + fw, fy + fw + 64, fx + fw + depth, fy + fw + 112), fill=(103, 82, 43, 255), width=2)
    d.text((fx + 20, fy + 28), "正方形正面", font=font(FONT_CN_BOLD, 25), fill=(128, 94, 44, 255))
    d.text((fx + fw + 22, fy + 82), "侧厚", font=font(FONT_CN_BOLD, 22), fill=(112, 88, 50, 255))

    notes = [
        ("锁定信息", "左上“大象 / EXPLORE PLEASURE”；右上圆形大象LOGO和®；左下品名/卖点；右下×3。"),
        ("主色策略", "香槟米金、暖金、珠光米白、浅咖金；无蓝白主色、无黑金科技风。"),
        ("工艺建议", "哑膜、珠光纸、浅金烫印、001击凸、局部UV细水纹，整体克制高级。"),
    ]
    nx, ny = 1010, 895
    for i, (label, body) in enumerate(notes):
        y = ny + i * 52
        d.rounded_rectangle((nx, y, nx + 120, y + 38), radius=3, fill=(187, 148, 78, 255))
        d.text((nx + 60, y + 19), label, font=f_note, fill=(255, 250, 236, 255), anchor="mm")
        wrapped = wrap_cjk(d, body, f_small, 680)
        d.multiline_text((nx + 142, y + 2), wrapped, font=f_small, fill=(72, 61, 47, 255), spacing=3)

    return canvas


def rounded_alpha(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def blurred_shadow(size: tuple[int, int], alpha: Image.Image, blur: int, color=(84, 60, 31, 105)) -> Image.Image:
    shadow = Image.new("RGBA", size, (0, 0, 0, 0))
    colored = Image.new("RGBA", alpha.size, color)
    shadow.alpha_composite(colored, (0, 0))
    shadow.putalpha(alpha)
    return shadow.filter(ImageFilter.GaussianBlur(blur))


def add_render_foil(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int) -> None:
    # Highlights are deliberately outside the locked text positions; they simulate foil and UV finish.
    draw.line((x + w * 0.12, y + h * 0.06, x + w * 0.56, y + h * 0.02), fill=(255, 255, 245, 78), width=3)
    draw.line((x + w * 0.63, y + h * 0.81, x + w * 0.86, y + h * 0.74), fill=(255, 255, 255, 95), width=4)
    draw.line((x + w * 0.63, y + h * 0.82, x + w * 0.86, y + h * 0.75), fill=(166, 123, 53, 80), width=1)
    for i in range(5):
        yy = y + int(h * (0.44 + i * 0.035))
        pts = []
        for step in range(36):
            xx = x + int(w * 0.14) + step * int(w * 0.02)
            pts.append((xx, yy + int(math.sin(step / 4.8 + i) * 5)))
        draw.line(pts, fill=(255, 255, 255, 38), width=2)


def make_strict_render(front: Image.Image) -> Image.Image:
    W, H = 1800, 1350
    canvas = Image.new("RGB", (W, H), (241, 234, 220))
    d = ImageDraw.Draw(canvas, "RGBA")

    # Soft studio background, restrained and non-promotional.
    for r, alpha in [(780, 26), (570, 30), (360, 34)]:
        d.ellipse((900 - r, 320 - r // 2, 900 + r, 320 + r // 2), fill=(255, 248, 234, alpha))
    d.rounded_rectangle((156, 1040, 1610, 1180), radius=68, fill=(118, 86, 43, 35))
    d.rounded_rectangle((246, 1065, 1500, 1160), radius=46, fill=(70, 49, 25, 30))

    fx, fy, fw = 315, 220, 850
    fh = fw
    side_visible = 162  # visual perspective of 20/62 side depth, kept shallow.
    side_shift = 54

    # Shallow right side, visibly not a cube.
    side_poly = [
        (fx + fw, fy + 14),
        (fx + fw + side_visible, fy + side_shift),
        (fx + fw + side_visible, fy + fh + side_shift - 16),
        (fx + fw, fy + fh),
    ]
    top_poly = [
        (fx + 15, fy),
        (fx + fw, fy + 14),
        (fx + fw + side_visible, fy + side_shift),
        (fx + side_visible + 12, fy + side_shift - 14),
    ]
    d.polygon(top_poly, fill=(235, 223, 199, 255), outline=(123, 91, 45, 160))
    d.polygon(side_poly, fill=(196, 171, 128, 255), outline=(111, 80, 39, 180))
    for i in range(8):
        yy = fy + side_shift + i * 95
        d.line((fx + fw + 26, yy, fx + fw + side_visible - 12, yy + 14), fill=(255, 255, 245, 30), width=2)
    d.line((fx + fw + side_visible - 5, fy + side_shift + 14, fx + fw + side_visible - 5, fy + fh + side_shift - 40), fill=(75, 55, 29, 80), width=2)

    # Exact front art, untouched text and locked brand positions.
    front_small = front.resize((fw, fh), Image.LANCZOS).convert("RGBA")
    mask = rounded_alpha((fw, fh), 15)
    shadow = blurred_shadow((fw, fh), mask, 22, (78, 53, 25, 82))
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(shadow, (fx + 30, fy + 34))
    front_small.putalpha(mask)
    canvas_rgba.alpha_composite(front_small, (fx, fy))
    canvas = canvas_rgba.convert("RGB")
    d = ImageDraw.Draw(canvas, "RGBA")
    d.rounded_rectangle((fx, fy, fx + fw, fy + fh), radius=15, outline=(139, 101, 48, 170), width=3)
    add_render_foil(d, fx, fy, fw, fh)

    # Process legend lives outside the pack, so it does not alter brand packaging layout.
    legend_x, legend_y = 1240, 310
    d.text((legend_x, legend_y), "工艺层表现", font=font(FONT_CN_BOLD, 42), fill=(54, 45, 33, 255))
    process = [
        ("珠光纸", "细腻纸纹和暖灰珠光底"),
        ("哑膜", "整体低反光高级肤感"),
        ("浅金烫印", "品牌、LOGO、品名色块"),
        ("001击凸", "中部透明暖金水膜感"),
        ("局部UV", "低饱和水波与微气泡"),
    ]
    for i, (label, desc) in enumerate(process):
        y = legend_y + 72 + i * 76
        d.rounded_rectangle((legend_x, y, legend_x + 132, y + 42), radius=4, fill=(184, 143, 70, 255))
        d.text((legend_x + 66, y + 21), label, font=font(FONT_CN_BOLD, 24), fill=(255, 250, 236, 255), anchor="mm")
        d.text((legend_x + 155, y + 7), desc, font=font(FONT_CN, 23), fill=(94, 78, 55, 255))

    d.line((legend_x, legend_y + 490, legend_x + 384, legend_y + 490), fill=(170, 132, 70, 110), width=2)
    d.text((legend_x, legend_y + 525), "盒型比例：62×20×62mm", font=font(FONT_CN_BOLD, 27), fill=(75, 59, 38, 255))
    d.text((legend_x, legend_y + 566), "正面为62×62mm；侧厚按20mm浅盒呈现。", font=font(FONT_CN, 22), fill=(99, 82, 58, 255))
    d.line((fx + fw, fy + fh + 42, fx + fw + side_visible, fy + fh + side_shift + 22), fill=(105, 76, 37, 190), width=2)
    d.text((fx + fw + side_visible // 2 + 22, fy + fh + side_shift + 74), "20mm 侧厚", font=font(FONT_CN_BOLD, 24), fill=(89, 69, 43, 255), anchor="mm")
    return canvas


def make_strict_board(front: Image.Image, render: Image.Image) -> Image.Image:
    W, H = 1920, 1080
    canvas = Image.new("RGB", (W, H), (246, 240, 228))
    d = ImageDraw.Draw(canvas, "RGBA")
    d.text((80, 58), "水膜001 三只装 - 品牌规范严格输出", font=font(FONT_CN_BOLD, 50), fill=(42, 35, 28, 255))
    d.text((82, 126), "以《线上1/2/3只装》正面规范为版式基准，工艺只叠加在允许区域与表面效果层。", font=font(FONT_CN, 24), fill=(118, 98, 70, 255))

    front_thumb = front.resize((520, 520), Image.LANCZOS)
    render_thumb = render.resize((720, 540), Image.LANCZOS)
    canvas.paste(front_thumb, (110, 230))
    canvas.paste(render_thumb, (760, 215))
    d.rounded_rectangle((110, 230, 630, 750), radius=8, outline=(175, 139, 78, 180), width=2)
    d.rounded_rectangle((760, 215, 1480, 755), radius=8, outline=(175, 139, 78, 180), width=2)
    d.text((370, 790), "正面平面稿 62×62mm", font=font(FONT_CN_BOLD, 25), fill=(87, 67, 39, 255), anchor="mm")
    d.text((1120, 790), "工艺效果图：浅盒 62×20×62mm", font=font(FONT_CN_BOLD, 25), fill=(87, 67, 39, 255), anchor="mm")

    checks = [
        ("版式锁定", "左上“大象 / EXPLORE PLEASURE”；右上圆形大象LOGO和®；左下品名/卖点；右下×3。"),
        ("盒型锁定", "正面为正方形，侧厚只按20mm浅盒表现，不做62×62×62立方体。"),
        ("品名锁定", "产品名称为“水膜001”，保留左下品名区域，不移动到中间。"),
        ("色彩锁定", "香槟米金、暖金、珠光米白、浅咖金，不用蓝白主色和黑金科技风。"),
        ("工艺表达", "哑膜、珠光纸、浅金烫印、001击凸、局部UV细水纹、微气泡。"),
    ]
    y0 = 865
    for i, (label, body) in enumerate(checks):
        x = 110 + (i % 2) * 820
        y = y0 + (i // 2) * 66
        d.rounded_rectangle((x, y, x + 132, y + 42), radius=4, fill=(185, 145, 70, 255))
        d.text((x + 66, y + 21), label, font=font(FONT_CN_BOLD, 23), fill=(255, 250, 236, 255), anchor="mm")
        d.multiline_text((x + 154, y + 5), wrap_cjk(d, body, font(FONT_CN, 21), 600), font=font(FONT_CN, 21), fill=(72, 61, 46, 255), spacing=2)
    return canvas


def write_svg() -> None:
    logo_b64 = base64.b64encode(LOGO_GOLD.read_bytes()).decode("ascii")
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1e2cb"/>
      <stop offset="0.55" stop-color="#fdf9ef"/>
      <stop offset="1" stop-color="#e7d6b9"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
  </defs>
  <rect width="1000" height="1000" rx="18" fill="url(#paper)"/>
  <path d="M118 410 C210 383 289 438 378 416 S548 379 654 417 S820 454 904 420" fill="none" stroke="#af8c4f" stroke-opacity=".23" stroke-width="2"/>
  <path d="M116 442 C234 413 307 466 430 441 S623 405 790 454" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="2"/>
  <text x="300" y="552" font-family="Arial" font-weight="700" font-size="255" fill="#bd964e" opacity=".13" stroke="#ffffff" stroke-opacity=".22" stroke-width="1.4">001</text>
  <rect x="18" y="18" width="964" height="964" rx="16" fill="none" stroke="#bc9f66" stroke-opacity=".6" stroke-width="2"/>
  <rect x="42" y="42" width="916" height="916" rx="8" fill="none" stroke="#ffffff" stroke-opacity=".55"/>

  <text x="72" y="137" font-family="Microsoft YaHei, Noto Sans SC, sans-serif" font-weight="700" font-size="70" fill="#a07e3d">大象</text>
  <text x="76" y="204" font-family="Arial" font-weight="700" font-size="26" fill="#846631">EXPLORE</text>
  <text x="76" y="236" font-family="Arial" font-weight="700" font-size="26" fill="#846631">PLEASURE</text>
  <image href="data:image/png;base64,{logo_b64}" x="660" y="78" width="220" height="220"/>
  <text x="884" y="113" font-family="Arial" font-weight="700" font-size="31" fill="#8d682f">®</text>

  <rect x="72" y="555" width="514" height="98" rx="2" fill="#be974c" opacity=".96" stroke="#956f31" stroke-opacity=".75"/>
  <rect x="72" y="555" width="20" height="98" fill="#e5ca89"/>
  <circle cx="112" cy="630" r="12" fill="#f6efd6"/>
  <text x="138" y="626" font-family="Microsoft YaHei, Noto Sans SC, sans-serif" font-weight="700" font-size="68" fill="#fff9eb">水膜001</text>
  <rect x="72" y="666" width="516" height="55" rx="2" fill="#fcf6e6" opacity=".9" stroke="#b28b44" stroke-opacity=".75" stroke-width="2"/>
  <text x="330" y="702" text-anchor="middle" font-family="Microsoft YaHei, Noto Sans SC, sans-serif" font-weight="700" font-size="29" fill="#795825">水性聚氨酯｜水润无味</text>
  <rect x="72" y="812" width="318" height="48" rx="1.5" fill="#fffdf6" opacity=".72" stroke="#6d5634" stroke-width="2"/>
  <text x="89" y="844" font-family="Microsoft YaHei, Noto Sans SC, sans-serif" font-weight="700" font-size="24" fill="#393026">水性聚氨酯避孕套</text>
  <g fill="none" stroke="#6f542b" stroke-width="2.3">
    <circle cx="813" cy="868" r="23"/>
    <circle cx="836" cy="860" r="23"/>
    <circle cx="859" cy="872" r="23"/>
  </g>
  <text x="884" y="877" font-family="Arial" font-weight="700" font-size="34" fill="#322a20">×3</text>
  <circle cx="692" cy="445" r="10" fill="none" stroke="#c6a15b" stroke-opacity=".42" stroke-width="1.4"/>
  <circle cx="726" cy="502" r="6" fill="none" stroke="#c6a15b" stroke-opacity=".34" stroke-width="1.4"/>
  <circle cx="810" cy="585" r="7" fill="none" stroke="#c6a15b" stroke-opacity=".39" stroke-width="1.4"/>
</svg>
'''
    SVG_PATH.write_text(svg, encoding="utf-8")


def save_pdf(front: Image.Image, spec: Image.Image) -> None:
    # Keep the PDF visually faithful by embedding the verified PNG pages.
    from reportlab.lib.pagesizes import landscape
    from reportlab.pdfgen import canvas

    tmp_front = OUTPUT / "_tmp_shuimo_front_for_pdf.png"
    tmp_spec = OUTPUT / "_tmp_shuimo_spec_for_pdf.png"
    front.save(tmp_front)
    spec.save(tmp_spec)
    c = canvas.Canvas(str(PDF_PATH), pagesize=landscape((1920, 1080)))
    c.drawImage(str(tmp_spec), 0, 0, width=1920, height=1080)
    c.showPage()
    c.setPageSize((1000, 1000))
    c.drawImage(str(tmp_front), 0, 0, width=1000, height=1000)
    c.showPage()
    c.save()
    tmp_front.unlink(missing_ok=True)
    tmp_spec.unlink(missing_ok=True)


def main() -> None:
    front = front_art()
    front.save(FRONT_PNG, quality=95)
    front.save(STRICT_FRONT_PNG, quality=95)
    spec = make_spec(front)
    spec.save(SPEC_PNG, quality=95)
    render = make_strict_render(front)
    render.save(STRICT_RENDER_PNG, quality=95)
    board = make_strict_board(front, render)
    board.save(STRICT_BOARD_PNG, quality=95)
    write_svg()
    save_pdf(front, spec)
    for path in [FRONT_PNG, SPEC_PNG, STRICT_FRONT_PNG, STRICT_RENDER_PNG, STRICT_BOARD_PNG, SVG_PATH, PDF_PATH, LOGO_GOLD]:
        print(path)


if __name__ == "__main__":
    main()
