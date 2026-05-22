from __future__ import annotations

import json
import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path.cwd()
ASSET_DIR = ROOT / "scratch" / "image2_ppt_assets"
OUT_DIR = ROOT / "output"
DATA_PATH = ASSET_DIR / "deck_data.json"
PREVIEW_PREFIX = "产品部本周工作汇报_Image2预览"
CONTACT_SHEET = OUT_DIR / "产品部本周工作汇报_Image2接触表.png"

W, H = 1920, 1080
COLORS = {
    "navy": "#1E3A5F",
    "blue": "#2F80ED",
    "ink": "#101828",
    "body": "#344054",
    "muted": "#667085",
    "line": "#D9E3F0",
    "soft": "#F7FAFF",
    "green": "#16A34A",
    "amber": "#D97706",
    "red": "#E74C3C",
    "white": "#FFFFFF",
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / ("msyhbd.ttc" if bold else "msyh.ttc"),
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / ("simheib.ttf" if bold else "simhei.ttf"),
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / "arial.ttf",
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def rounded(draw: ImageDraw.ImageDraw, box, fill, outline=None, width=1, radius=18):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wrap_line(draw: ImageDraw.ImageDraw, line: str, fnt, max_width: int) -> list[str]:
    if not line:
        return [""]
    chunks: list[str] = []
    current = ""
    for ch in line:
        test = current + ch
        if draw.textlength(test, font=fnt) <= max_width or not current:
            current = test
        else:
            chunks.append(current)
            current = ch
    if current:
        chunks.append(current)
    return chunks


def draw_text(draw: ImageDraw.ImageDraw, xy, text: str, size=28, color="#344054", bold=False, max_width=None, line_gap=8):
    x, y = xy
    fnt = font(size, bold)
    lines: list[str] = []
    for raw_line in str(text).splitlines():
        if max_width:
            lines.extend(wrap_line(draw, raw_line, fnt, max_width))
        else:
            lines.append(raw_line)
    for line in lines:
        draw.text((x, y), line, fill=color, font=fnt)
        y += size + line_gap
    return y


def base_canvas(bg_path: Path) -> Image.Image:
    bg = Image.open(bg_path).convert("RGB")
    return bg.resize((W, H), Image.Resampling.LANCZOS)


def status_color(status: str) -> str:
    if status == "已完成":
        return COLORS["green"]
    if status == "待启动":
        return COLORS["amber"]
    return COLORS["blue"]


def header(draw: ImageDraw.ImageDraw, page: int, title: str, subtitle: str = ""):
    draw_text(draw, (86, 32), "产品部周汇报", 23, COLORS["white"], True)
    draw_text(draw, (1780, 38), str(page).zfill(2), 22, COLORS["navy"], True)
    draw_text(draw, (86, 112), title, 42, COLORS["navy"], True, 1260)
    if subtitle:
        draw_text(draw, (88, 176), subtitle, 24, COLORS["muted"], False, 1260)


def footer(draw: ImageDraw.ImageDraw, page: int):
    draw_text(draw, (86, 1000), "Image2底图层 + PPT可编辑文字层", 18, "#8AA0B8")
    draw_text(draw, (1760, 1000), f"S{page:02d}", 18, "#8AA0B8", True)


def card(draw: ImageDraw.ImageDraw, box, title, body, accent=COLORS["blue"]):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((x, y, x + 10, y + h), fill=accent)
    draw_text(draw, (x + 34, y + 26), title, 26, COLORS["navy"], True, w - 64)
    draw_text(draw, (x + 34, y + 78), body, 26, COLORS["body"], False, w - 64, 9)


def bullet_lines(lines):
    return "\n".join(f"- {line}" for line in lines)


def paste_evidence(canvas: Image.Image, draw: ImageDraw.ImageDraw, slide: dict):
    key = slide.get("key")
    if key == "s03":
        paths = [ROOT / "scratch" / "image2_ppt_assets" / "001-hyaluronic-vote-stage2-crop.png"]
        boxes = [(1258, 336, 520, 210)]
    elif key == "s04":
        paths = [
            ROOT / "scratch" / "image2_ppt_assets" / "big_date_email_online.png",
            ROOT / "scratch" / "image2_ppt_assets" / "big_date_email_offline.png",
            ROOT / "scratch" / "image2_ppt_assets" / "big_date_email_020.png",
        ]
        boxes = [(1254, 336, 520, 104), (1254, 454, 520, 104), (1254, 572, 520, 104)]
    elif key == "s09":
        paths = [ROOT / "scratch" / "image2_ppt_assets" / "ai_selling_points_sheet.png"]
        boxes = [(1254, 336, 540, 220)]
    elif key == "s12":
        paths = [ROOT / "output" / "assets" / "price_control_detail_crop.png"]
        boxes = [(1258, 336, 520, 230)]
    else:
        return False

    used = False
    for p, (x, y, w, h) in zip(paths, boxes):
        if not p.exists():
            continue
        img = Image.open(p).convert("RGB")
        img.thumbnail((w, h), Image.Resampling.LANCZOS)
        px = x + (w - img.width) // 2
        py = y + (h - img.height) // 2
        rounded(draw, (x, y, x + w, y + h), "#F8FBFF", COLORS["line"], 1, 12)
        canvas.paste(img, (px, py))
        used = True
    if used and key == "s03":
        draw_text(draw, (1258, 554), "投票软件截图：第二次分发 / 18张方案 / 入选、待定、排除三类操作", 18, COLORS["muted"], False, 520)
    if used and key == "s04":
        draw_text(draw, (1254, 690), "邮件截图：线上分销、线下出货、020清货三类方案已同步", 18, COLORS["muted"], False, 520)
    if used and key == "s09":
        draw_text(draw, (1254, 572), "表格截图：产品名称、系列、卖点1-5与提取状态，用于审核AI输出口径", 18, COLORS["muted"], False, 520)
    return used


def paste_image_fit(canvas: Image.Image, draw: ImageDraw.ImageDraw, image_path: str | Path, box, radius=14):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, radius)
    p = Path(image_path)
    if not p.exists():
        draw_text(draw, (x + 20, y + h // 2 - 18), "图片缺失", 22, COLORS["muted"], True, w - 40)
        return
    img = Image.open(p).convert("RGB")
    fitted = ImageOps.contain(img, (max(1, w - 20), max(1, h - 20)), method=Image.Resampling.LANCZOS)
    px = x + 10 + (max(1, w - 20) - fitted.width) // 2
    py = y + 10 + (max(1, h - 20) - fitted.height) // 2
    canvas.paste(fitted, (px, py))


def image_card(canvas: Image.Image, draw: ImageDraw.ImageDraw, item: dict, box, accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((x, y, x + w, y + 8), fill=accent)
    paste_image_fit(canvas, draw, item.get("path", ""), (x + 18, y + 22, w - 36, h - 128), 14)
    draw_text(draw, (x + 22, y + h - 92), item.get("name", ""), 22, COLORS["navy"], True, w - 44)
    draw_text(draw, (x + 22, y + h - 56), item.get("note", ""), 17, COLORS["body"], False, w - 44, 4)


def packaging_tile(canvas: Image.Image, draw: ImageDraw.ImageDraw, item: dict, box, accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 14)
    draw.rectangle((x, y, x + w, y + 7), fill=accent)
    paste_image_fit(canvas, draw, item.get("path", ""), (x + 12, y + 16, w - 24, h - 58), 12)
    draw_text(draw, (x + 14, y + h - 40), item.get("name", ""), 18, COLORS["navy"], True, w - 28)
    draw_text(draw, (x + 14, y + h - 18), item.get("note", ""), 12, COLORS["muted"], False, w - 28, 2)


def render_hyaluronic_packaging(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    cards = [
        (86, 238, 360, 204),
        (466, 238, 360, 204),
        (846, 238, 360, 204),
        (86, 464, 360, 204),
        (466, 464, 360, 204),
        (846, 464, 360, 204),
        (86, 690, 360, 204),
        (466, 690, 360, 204),
        (846, 690, 360, 204),
    ]
    for idx, item in enumerate(slide.get("images", [])[:9]):
        packaging_tile(canvas, draw, item, cards[idx], COLORS["green"] if idx % 3 == 2 else COLORS["blue"])

    rounded(draw, (1246, 238, 1834, 894), "#FFF9EF", "#F2C98C", 1, 18)
    draw_text(draw, (1280, 272), "替换后候选图", 26, COLORS["navy"], True)
    draw_text(draw, (1280, 330), f"本页已替换为用户提供的9张001包装图。共{len(slide.get('images', []))}张，按文件顺序排列。", 25, COLORS["body"], False, 498, 8)
    draw.rectangle((1280, 432, 1788, 433), fill="#F2C98C")
    draw_text(draw, (1280, 470), "评审口径", 23, COLORS["navy"], True)
    draw_text(draw, (1280, 520), bullet_lines(slide.get("highlights", [])), 24, COLORS["body"], False, 500, 8)
    draw_text(draw, (1280, 758), "重点对比：命名识别、金属色调、001浮雕/大字位置、货架远距离可读性。", 24, COLORS["navy"], True, 500, 8)

    rounded(draw, (86, 922, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 934, 140, 964), status_color(slide["status"]), None, 1, 15)
    draw_text(draw, (162, 928), slide["next"], 23, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_cover(slide: dict, bg_path: Path, out_path: Path):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    draw_text(draw, (86, 32), "产品部", 23, COLORS["white"], True)
    draw_text(draw, (164, 270), slide["title"], 72, COLORS["navy"], True)
    draw_text(draw, (170, 382), slide["subtitle"], 30, COLORS["body"])
    draw.rectangle((170, 466, 330, 474), fill=COLORS["blue"])
    draw_text(draw, (170, 515), slide["info"], 26, COLORS["muted"])
    draw_text(draw, (170, 795), "12项事项｜状态清晰｜待确认闭环｜下周动作", 25, COLORS["navy"], True)
    footer(draw, 1)
    canvas.save(out_path)


def render_overview(slide: dict, bg_path: Path, out_path: Path):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, 2, slide["title"], "用一张表先对齐状态、结论和待确认项")
    rounded(draw, (86, 240, 1834, 894), COLORS["white"], COLORS["line"], 1, 18)
    x, y = 110, 264
    widths = [86, 420, 142, 704, 330]
    header_h, row_h = 44, 43
    headers = ["编号", "事项", "状态", "本周结论", "待确认"]
    left = x
    for h, width in zip(headers, widths):
        draw.rectangle((left, y, left + width, y + header_h), fill=COLORS["navy"])
        draw_text(draw, (left + 10, y + 10), h, 19, COLORS["white"], True, width - 20)
        left += width
    for r, row in enumerate(slide["rows"]):
        top = y + header_h + r * row_h
        left = x
        for c, value in enumerate(row):
            fill = "#FFFFFF" if r % 2 == 0 else "#F8FBFF"
            draw.rectangle((left, top, left + widths[c], top + row_h), fill=fill, outline="#E6EDF7")
            if c == 2:
                rounded(draw, (left + 16, top + 8, left + 110, top + 35), status_color(value), None, 1, 14)
                draw_text(draw, (left + 28, top + 11), value, 14, COLORS["white"], True)
            else:
                size = 14 if c in (3, 4) else 16
                color = COLORS["blue"] if c == 0 else COLORS["body"]
                draw_text(draw, (left + 12, top + 8), value, size, color, c == 0, widths[c] - 22, 4)
            left += widths[c]
    draw_text(draw, (112, 920), "说明：封面后直接进入事项，不设置目录页。", 21, COLORS["muted"])
    footer(draw, 2)
    canvas.save(out_path)


def render_item(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)
    body = "\n".join([slide["task"], "", slide["conclusion"], "", bullet_lines(slide["bullets"])])
    card(draw, (86, 248, 1096, 600), "核心推进", body, status_color(slide["status"]))
    rounded(draw, (1220, 248, 1834, 848), COLORS["white"], COLORS["line"], 1, 18)
    rounded(draw, (1220, 248, 1834, 316), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (1254, 268), "证据 / 待确认", 24, COLORS["navy"], True)
    has_images = paste_evidence(canvas, draw, slide)
    if has_images and slide.get("key") == "s03":
        pending_top = 618
    elif has_images and slide.get("key") == "s04":
        pending_top = 724
    elif has_images and slide.get("key") == "s09":
        pending_top = 640
    else:
        pending_top = 594 if has_images else 336
    pending_size = 20 if slide.get("key") == "s04" else (22 if slide.get("key") == "s09" else 24)
    draw_text(draw, (1254, pending_top), "待确认", 23, COLORS["navy"], True)
    draw_text(draw, (1254, pending_top + 44), bullet_lines(slide["pending"]), pending_size, COLORS["body"], False, 520)
    if not has_images:
        draw_text(draw, (1254, 654), "证据截图后续可替换到本区域；当前版本先保留可编辑待确认项。", 21, COLORS["muted"], False, 496)
    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def combination_time_table(draw: ImageDraw.ImageDraw, box, rows: list[list[str]]):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 28, y + 22), "商品组合权收回时间计划", 25, COLORS["navy"], True)
    draw_text(draw, (x + 374, y + 26), "核心：先调研规则，再按平台过渡关闭，12月暂定回归产品部。", 18, COLORS["muted"], False, w - 410)

    table_left = x + 28
    table_top = y + 76
    header_h = 40
    row_hs = [96, 260, 68]
    widths = [132, 154, w - 56 - 132 - 154]
    headers = ["阶段", "时间", "主要内容"]
    left = table_left
    for header_text, width in zip(headers, widths):
        draw.rectangle((left, table_top, left + width, table_top + header_h), fill=COLORS["blue"])
        draw_text(draw, (left + 8, table_top + 10), header_text, 16, COLORS["white"], True, width - 16, 2)
        left += width

    top = table_top + header_h
    for r, row in enumerate(rows):
        left = table_left
        row_h = row_hs[r]
        fill = "#FFF8ED" if r == 1 else ("#FFFFFF" if r % 2 == 0 else "#F8FBFF")
        for c, (value, width) in enumerate(zip(row, widths)):
            draw.rectangle((left, top, left + width, top + row_h), fill=fill, outline="#E6EDF7")
            size = 15 if r == 1 and c == 2 else (17 if c == 2 else 18)
            draw_text(draw, (left + 8, top + 10), value, size, COLORS["navy"] if c == 0 else COLORS["body"], c == 0, width - 16, 3)
            left += width
        top += row_h


def flow_box(draw: ImageDraw.ImageDraw, box, label: str, idx: int, start_end: bool, highlight: bool):
    x, y, w, h = box
    fill = COLORS["navy"] if start_end or highlight else "#F4F2F0"
    outline = None if start_end or highlight else "#E6EDF7"
    text_color = COLORS["white"] if start_end or highlight else COLORS["body"]
    rounded(draw, (x, y, x + w, y + h), fill, outline, 1, 18 if start_end else 2)
    draw_text(draw, (x + 8, y + 10), label, 12 if len(label) > 8 else 15, text_color, True, w - 16, 2)


def combination_flow(draw: ImageDraw.ImageDraw, box, title: str, steps: list[str], highlight_index: int = -1):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    label_x = x + w // 2 - 110
    draw.rectangle((label_x, y + 18, label_x + 220, y + 62), fill=COLORS["white"], outline=COLORS["navy"])
    draw_text(draw, (label_x + 26, y + 30), title, 17, COLORS["red"], True, 168)
    flow_top = y + 86
    gap = 18
    step_w = int((w - 56 - gap * (len(steps) - 1)) / len(steps))
    step_h = 56
    for idx, step in enumerate(steps):
        left = x + 28 + idx * (step_w + gap)
        flow_box(draw, (left, flow_top, step_w, step_h), step, idx, idx == 0 or idx == len(steps) - 1, idx == highlight_index)
        if idx < len(steps) - 1:
            draw_text(draw, (left + step_w + 2, flow_top + 16), "→", 22, COLORS["muted"], True)


def render_combination_permission_plan(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    metric_boxes = [(86, 248, 260, 96), (376, 248, 260, 96), (666, 248, 260, 96), (956, 248, 260, 96)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], metric_boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 2 else COLORS["blue"])

    rounded(draw, (1260, 248, 1834, 344), "#FFF8ED", "#F2C98C", 1, 18)
    draw_text(draw, (1290, 270), "流程进化", 23, COLORS["navy"], True)
    draw_text(draw, (1422, 266), "运营提报，商品管理审核与系统建档，组合权最终回归产品部。", 20, COLORS["body"], True, 360)

    combination_time_table(draw, (86, 382, 820, 492), slide["timeRows"])
    combination_flow(draw, (940, 382, 894, 214), "商品组合现工作流程", slide["currentFlow"], -1)
    combination_flow(draw, (940, 626, 894, 248), "商品组合工作流程调整流程", slide["adjustedFlow"], 3)

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 920, 148, 958), status_color(slide["status"]), None, 1, 19)
    draw_text(draw, (174, 914), slide["next"], 25, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_delay_line_plan(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 736, 454), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 276), "规划文件", 25, COLORS["navy"], True)
    source_text = "\n".join([
        f"文件：{slide['source']['file']}",
        f"范围：{slide['source']['scope']}",
        f"结论：{slide['source']['thesis']}",
    ])
    draw_text(draw, (120, 328), source_text, 18, COLORS["body"], False, 560, 7)

    boxes = [(766, 248, 252, 100), (1038, 248, 252, 100), (1310, 248, 252, 100), (1582, 248, 252, 100)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 2 else COLORS["blue"])

    rounded(draw, (766, 370, 1834, 454), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (800, 398), "产品线逻辑：基础入门银牛 → 全渠道基石金牛 → 高端进阶牛王，同时用小规格补足渠道转化入口。", 22, COLORS["navy"], True, 990)

    pricing_table(
        draw,
        (86, 492, 910, 360),
        "主线产品阶梯",
        ["产品", "零售", "时长", "核心成分", "定位"],
        slide["tierRows"],
        [190, 90, 110, 170, 290],
        COLORS["blue"],
    )
    pricing_table(
        draw,
        (1028, 492, 806, 360),
        "渠道小规格与价格带补位",
        ["类型", "产品/缺口", "价格", "渠道/价值"],
        [
            *[["小规格", row[0], row[1], f"{row[2]}：{row[3]}"] for row in slide["smallRows"]],
            *[["补位", f"{row[0]}：{row[1]}", row[2], row[3]] for row in slide["gapRows"]],
        ],
        [90, 250, 90, 316],
        COLORS["green"],
    )

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_delay_visual_matrix(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    cards = [
        (86, 248, 410, 520),
        (516, 248, 410, 520),
        (946, 248, 410, 520),
        (1376, 248, 458, 520),
    ]
    for idx, item in enumerate(slide.get("images", [])[:4]):
        image_card(canvas, draw, item, cards[idx], COLORS["amber"] if idx >= 2 else COLORS["blue"])

    rounded(draw, (86, 806, 1834, 882), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (124, 830), "配图说明", 24, COLORS["navy"], True)
    draw_text(draw, (300, 824), "视觉从“基础入门”向“高端轻奢”逐级上探，和49/59小规格、199/399/699主线价格带形成同一套产品梯度。", 24, COLORS["body"], False, 1420)

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (124, 916), bullet_lines(slide.get("points", [])), 18, COLORS["body"], False, 1180, 4)
    draw_text(draw, (1310, 918), slide["next"], 19, COLORS["navy"], True, 480, 5)
    footer(draw, page)
    canvas.save(out_path)


def render_delay_channel_visual(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 1166, 560), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 274), "价格带地图", 24, COLORS["navy"], True)
    if slide.get("images"):
        paste_image_fit(canvas, draw, slide["images"][0].get("path", ""), (120, 322, 1010, 204), 14)

    rounded(draw, (1200, 248, 1834, 560), "#FFF9EF", "#F2C98C", 1, 18)
    draw_text(draw, (1230, 274), "瓶型与视觉延展", 24, COLORS["navy"], True)
    if len(slide.get("images", [])) > 1:
        paste_image_fit(canvas, draw, slide["images"][1].get("path", ""), (1240, 326, 252, 196), 14)
    if len(slide.get("images", [])) > 2:
        paste_image_fit(canvas, draw, slide["images"][2].get("path", ""), (1538, 326, 252, 196), 14)

    pricing_table(
        draw,
        (86, 596, 1748, 272),
        "价格带与渠道承接",
        ["价格", "产品", "主渠道", "定位说明"],
        slide["ladderRows"],
        [150, 260, 260, 982],
        COLORS["green"],
    )

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 920, 148, 958), status_color(slide["status"]), None, 1, 19)
    draw_text(draw, (174, 914), slide["next"], 25, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def competitor_landscape_table(draw: ImageDraw.ImageDraw, box, rows: list[list[str]]):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 28, y + 24), "竞品/现有价格带格局", 25, COLORS["navy"], True)
    draw_text(draw, (x + 356, y + 28), "从价格带看，真正需要补的是亲民入门和100-200元主力承接位。", 19, COLORS["muted"], False, w - 390)

    table_left = x + 28
    table_top = y + 78
    header_h = 42
    row_h = 73
    widths = [188, 330, 128, w - 56 - 188 - 330 - 128]
    headers = ["价格带", "现有产品/竞品占位", "渠道", "格局判断"]
    left = table_left
    for header_text, width in zip(headers, widths):
        draw.rectangle((left, table_top, left + width, table_top + header_h), fill=COLORS["blue"])
        draw_text(draw, (left + 8, table_top + 10), header_text, 16, COLORS["white"], True, width - 16, 2)
        left += width

    for r, row in enumerate(rows):
        top = table_top + header_h + r * row_h
        left = table_left
        is_gap = "缺口" in row[0] or row[1] == "无产品"
        for c, (value, width) in enumerate(zip(row, widths)):
            fill = "#FFF1F1" if is_gap else ("#FFFFFF" if r % 2 == 0 else "#F8FBFF")
            color = COLORS["red"] if is_gap and c != 2 else COLORS["body"]
            draw.rectangle((left, top, left + width, top + row_h), fill=fill, outline="#E6EDF7")
            size = 15 if c == 0 else (14 if c == 3 else 16)
            draw_text(draw, (left + 8, top + 9), value, size, color, c == 0 or is_gap, width - 16, 2)
            left += width


def competitor_band(draw: ImageDraw.ImageDraw, box, row: list[str], idx: int):
    x, y, w, h = box
    accents = [COLORS["blue"], COLORS["amber"], "#B85C00"]
    fills = [COLORS["soft"], "#FFF8ED", "#FFF3E8"]
    outlines = ["#D7E8FF", "#F2C98C", "#F2C98C"]
    accent = accents[idx]
    rounded(draw, (x, y, x + w, y + h), fills[idx], outlines[idx], 1, 16)
    draw_text(draw, (x + 18, y + 16), row[0], 22, accent, True, 128)
    draw_text(draw, (x + 160, y + 18), f"{row[1]} · {row[2]}", 18, COLORS["body"], True, 170)
    draw_text(draw, (x + 348, y + 18), row[3], 18, COLORS["navy"], True, w - 366)


def suggestion_card(draw: ImageDraw.ImageDraw, box, row: list[str], idx: int):
    x, y, w, h = box
    accent = COLORS["red"] if idx == 0 else COLORS["amber"]
    outline = "#F7CACA" if idx == 0 else "#F2C98C"
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], outline, 1, 18)
    draw.rectangle((x, y, x + 10, y + h), fill=accent)
    draw_text(draw, (x + 26, y + 22), row[0], 27, accent, True, 54)
    draw_text(draw, (x + 88, y + 24), row[1], 20, COLORS["navy"], True, w - 112)
    draw_text(draw, (x + 88, y + 62), row[2], 16, COLORS["body"], False, w - 112, 3)


def render_delay_competitor_landscape(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    competitor_landscape_table(draw, (86, 248, 1078, 626), slide["landscapeRows"])

    rounded(draw, (1192, 248, 1834, 874), "#FFF9EF", "#F2C98C", 1, 18)
    draw_text(draw, (1226, 276), "金牛系列延申", 25, COLORS["navy"], True)
    draw_text(draw, (1460, 280), "覆盖全渠道的爆款组合", 20, COLORS["amber"], True)
    for idx, row in enumerate(slide.get("competitorRows", [])):
        competitor_band(draw, (1226, 332 + idx * 82, 574, 62), row, idx)

    draw_text(draw, (1226, 604), "优化建议", 25, COLORS["navy"], True)
    for idx, row in enumerate(slide.get("suggestionRows", [])):
        suggestion_card(draw, (1226, 652 + idx * 104, 574, 86), row, idx)

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 920, 148, 958), status_color(slide["status"]), None, 1, 19)
    draw_text(draw, (174, 914), slide["next"], 25, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def channel_plan_card(draw: ImageDraw.ImageDraw, box, plan: dict, accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((x, y, x + w, y + 9), fill=accent)
    draw_text(draw, (x + 28, y + 26), plan["name"], 25, COLORS["navy"], True, w - 56)
    draw_text(draw, (x + 28, y + 78), "处理方案", 18, accent, True, 112)
    draw_text(draw, (x + 144, y + 75), plan["goal"], 19, COLORS["body"], False, w - 172, 5)
    draw_text(draw, (x + 28, y + 148), "执行规则", 18, accent, True, 112)
    draw_text(draw, (x + 144, y + 144), plan["policy"], 18, COLORS["body"], False, w - 172, 5)


def data_table(draw: ImageDraw.ImageDraw, box, title: str, headers: list[str], rows: list[list[str]], widths: list[int], accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 24, y + 18), title, 23, COLORS["navy"], True, w - 48)
    table_left = x + 24
    table_top = y + 66
    header_h = 40
    row_h = int((h - 92 - header_h) / len(rows))
    left = table_left
    for header_text, width in zip(headers, widths):
        draw.rectangle((left, table_top, left + width, table_top + header_h), fill=accent)
        draw_text(draw, (left + 8, table_top + 10), header_text, 16, COLORS["white"], True, width - 16, 2)
        left += width
    for r, row in enumerate(rows):
        top = table_top + header_h + r * row_h
        left = table_left
        is_total = r == len(rows) - 1
        for c, (value, width) in enumerate(zip(row, widths)):
            fill = "#EAF3FF" if is_total else ("#FFFFFF" if r % 2 == 0 else "#F8FBFF")
            draw.rectangle((left, top, left + width, top + row_h), fill=fill, outline="#E6EDF7")
            size = 14 if c == 1 else 16
            draw_text(draw, (left + 8, top + 9), value, size, COLORS["body"], is_total or c == 0, width - 16, 2)
            left += width


def metric_box(draw: ImageDraw.ImageDraw, box, label: str, value: str, accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 20, y + 18), value, 35, accent, True, w - 40)
    draw_text(draw, (x + 20, y + 64), label, 18, COLORS["muted"], True, w - 40)


def pricing_table(draw: ImageDraw.ImageDraw, box, title: str, headers: list[str], rows: list[list[str]], widths: list[int], accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 24, y + 18), title, 23, COLORS["navy"], True, w - 48)
    table_left = x + 24
    table_top = y + 66
    header_h = 40
    row_h = int((h - 92 - header_h) / len(rows))
    left = table_left
    for header_text, width in zip(headers, widths):
        draw.rectangle((left, table_top, left + width, table_top + header_h), fill=accent)
        draw_text(draw, (left + 8, table_top + 10), header_text, 16, COLORS["white"], True, width - 16, 2)
        left += width
    for r, row in enumerate(rows):
        top = table_top + header_h + r * row_h
        left = table_left
        for c, (value, width) in enumerate(zip(row, widths)):
            fill = "#FFFFFF" if r % 2 == 0 else "#F8FBFF"
            draw.rectangle((left, top, left + width, top + row_h), fill=fill, outline="#E6EDF7")
            size = 15 if c == 0 else 16
            draw_text(draw, (left + 8, top + 10), value, size, COLORS["body"], c in (0, 1), width - 16, 2)
            left += width


def render_appliance_pricing(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 726, 460), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 276), "方案文件", 25, COLORS["navy"], True)
    source_text = "\n".join([
        f"文件：{slide['source']['file']}",
        f"范围：{slide['source']['scope']}",
        f"字段：{slide['source']['fields']}",
    ])
    draw_text(draw, (120, 328), source_text, 19, COLORS["body"], False, 560, 7)

    boxes = [(766, 248, 252, 100), (1038, 248, 252, 100), (1310, 248, 252, 100), (1582, 248, 252, 100)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 2 else COLORS["blue"])

    rounded(draw, (766, 370, 1834, 460), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (800, 400), "处理目标：以文件为准，先确认最低到手价与清库下架口径，再进入执行排期。", 24, COLORS["navy"], True, 1000)

    pricing_table(
        draw,
        (86, 500, 1180, 352),
        "核心调价SKU（含竞品价）",
        ["产品", "定位", "现价", "竞品", "建议最低", "动作"],
        slide["pricingRows"],
        [420, 90, 110, 110, 150, 240],
        COLORS["blue"],
    )

    rounded(draw, (1298, 500, 1834, 852), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((1298, 500, 1834, 509), fill=COLORS["amber"])
    draw_text(draw, (1326, 528), "清库下架SKU", 24, COLORS["navy"], True)
    draw_text(draw, (1326, 584), bullet_lines(slide["clearanceRows"]), 22, COLORS["body"], False, 460, 8)
    draw_text(draw, (1326, 802), "表内调整时间标注为“清库下架”。", 18, COLORS["muted"], False, 420)

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def marketing_category_card(draw: ImageDraw.ImageDraw, box, row: list[str], accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((x, y, x + w, y + 8), fill=accent)
    draw_text(draw, (x + 22, y + 24), row[0], 23, COLORS["navy"], True, w - 44)
    draw_text(draw, (x + 22, y + 72), row[1], 19, COLORS["body"], False, w - 44, 6)


def render_marketing_policy(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 736, 446), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 276), "制度文件", 25, COLORS["navy"], True)
    source_text = "\n".join([
        f"文件：{slide['source']['file']}",
        f"目的：{slide['source']['purpose']}",
        f"原则：{slide['source']['principle']}",
    ])
    draw_text(draw, (120, 328), source_text, 18, COLORS["body"], False, 560, 7)

    category_boxes = [(780, 248, 330, 198), (1142, 248, 330, 198), (1504, 248, 330, 198)]
    accents = [COLORS["blue"], COLORS["green"], COLORS["amber"]]
    for row, box, accent in zip(slide["categoryRows"], category_boxes, accents):
        marketing_category_card(draw, box, row, accent)

    pricing_table(
        draw,
        (86, 482, 1030, 370),
        "成本、费用及销售业绩归属",
        ["项目", "归属", "口径说明"],
        slide["ownershipRows"],
        [180, 140, 650],
        COLORS["blue"],
    )

    rounded(draw, (1150, 482, 1834, 852), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((1150, 482, 1834, 491), fill=COLORS["green"])
    draw_text(draw, (1182, 510), "执行闭环", 24, COLORS["navy"], True)
    draw_text(draw, (1182, 562), bullet_lines(slide["controls"]), 20, COLORS["body"], False, 604, 7)
    draw_text(draw, (1182, 800), "立项表字段：基础信息、目标/分类、价格/成本、预算/复盘/审批。", 18, COLORS["muted"], False, 600)

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def question_panel(draw: ImageDraw.ImageDraw, box, title: str, themes: list[str], questions: list[str], accent: str):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((x, y, x + w, y + 9), fill=accent)
    draw_text(draw, (x + 30, y + 28), title, 25, COLORS["navy"], True, w - 60)
    draw_text(draw, (x + 30, y + 76), f"模块：{' / '.join(themes)}", 18, COLORS["muted"], False, w - 60)
    draw_text(draw, (x + 30, y + 126), bullet_lines(questions), 21, COLORS["body"], False, w - 60, 7)


def render_dealer_questions(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 736, 454), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 276), "问题文件", 25, COLORS["navy"], True)
    source_text = "\n".join([
        f"文件：{slide['source']['file']}",
        f"用法：{slide['source']['usage']}",
    ])
    draw_text(draw, (120, 328), source_text, 18, COLORS["body"], False, 560, 7)

    boxes = [(766, 248, 252, 100), (1038, 248, 252, 100), (1310, 248, 252, 100), (1582, 248, 252, 100)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 3 else COLORS["blue"])

    rounded(draw, (766, 370, 1834, 454), "#FFF8ED", "#F5D6A8", 1, 18)
    draw_text(draw, (800, 398), f"边界：{slide['source']['boundary']}", 22, COLORS["navy"], True, 990)

    question_panel(draw, (86, 492, 850, 360), "产品经理提问", slide["productThemes"], slide["productQuestions"], COLORS["blue"])
    question_panel(draw, (984, 492, 850, 360), "商品经理提问", slide["merchantThemes"], slide["merchantQuestions"], COLORS["green"])

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def folder_line(draw: ImageDraw.ImageDraw, xy, text: str, level: int, color: str = COLORS["body"]):
    x, y = xy
    icon_x = x + level * 22
    label = text.strip()
    if label:
        rounded(draw, (icon_x, y + 6, icon_x + 20, y + 21), "#F5C044" if level == 0 else "#FFE3A3", "#E5B53A", 1, 4)
    draw_text(draw, (icon_x + 30, y), label, 20, color, level == 0, 470 - level * 22, 2)


def thumbnail_strip(draw: ImageDraw.ImageDraw, box):
    x, y, w, h = box
    rounded(draw, (x, y, x + w, y + h), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (x + 24, y + 18), "图包缩略示意", 23, COLORS["navy"], True)
    for i in range(8):
        tx = x + 28 + i * 72
        ty = y + 70
        rounded(draw, (tx, ty, tx + 58, ty + 76), "#C7F36A" if i % 3 == 0 else "#B8E85C", "#9CCD3E", 1, 8)
        rounded(draw, (tx + 8, ty + 10, tx + 50, ty + 32), "#213B20", None, 1, 4)
        draw_text(draw, (tx + 20, ty + 42), "图", 16, COLORS["navy"], True)
    draw_text(draw, (x + 24, y + 164), "示例：Nothing系列、玻尿酸、幻久系列等按日期与波次归档。", 18, COLORS["muted"], False, w - 48)


def render_ad_review_plan(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    metric_boxes = [(86, 248, 260, 96), (376, 248, 260, 96), (666, 248, 260, 96), (956, 248, 260, 96)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], metric_boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 3 else COLORS["blue"])

    rounded(draw, (1260, 248, 1834, 488), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((1260, 248, 1834, 257), fill=COLORS["amber"])
    draw_text(draw, (1290, 276), "日期文件夹结构", 24, COLORS["navy"], True)
    for i, line in enumerate(slide["folderTree"]):
        level = 1 if line.startswith("  ") else 0
        folder_line(draw, (1290, 326 + i * 26), line, level, COLORS["muted"] if i >= 4 else COLORS["body"])

    rounded(draw, (86, 374, 1216, 488), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 402), "配合方式", 24, COLORS["navy"], True)
    process = "   ".join(f"{i + 1}. {v}" for i, v in enumerate(slide["process"]))
    draw_text(draw, (276, 402), process, 20, COLORS["body"], False, 890, 6)

    pricing_table(
        draw,
        (86, 524, 1130, 328),
        "广审排期表（截图字段整理）",
        ["提交日期", "波次", "图包数", "风险数", "预计最晚", "补改参考"],
        slide["scheduleRows"],
        [160, 90, 120, 120, 180, 180],
        COLORS["blue"],
    )
    thumbnail_strip(draw, (1260, 524, 574, 328))

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def internal_flow_step(draw: ImageDraw.ImageDraw, box, label: str, idx: int, is_last: bool):
    x, y, w, h = box
    is_blue = idx % 2 == 0
    fill = COLORS["soft"] if is_blue else "#FFF8ED"
    outline = "#D7E8FF" if is_blue else "#F2C98C"
    accent = COLORS["blue"] if is_blue else COLORS["amber"]
    rounded(draw, (x, y, x + w, y + h), fill, outline, 1, 18)
    draw_text(draw, (x + 18, y + 18), str(idx + 1).zfill(2), 22, accent, True, 44)
    draw_text(draw, (x + 70, y + 19), label, 21, COLORS["navy"], True, w - 82)
    if not is_last:
        draw_text(draw, (x + w + 12, y + 17), "→", 26, COLORS["muted"], True)


def render_internal_price_audit(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    metric_boxes = [(86, 248, 260, 96), (376, 248, 260, 96), (666, 248, 260, 96), (956, 248, 260, 96)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], metric_boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 2 else COLORS["blue"])

    rounded(draw, (1260, 248, 1834, 344), "#FFF8ED", "#F2C98C", 1, 18)
    draw_text(draw, (1290, 270), slide.get("summaryTitle", "内部口径"), 23, COLORS["navy"], True)
    draw_text(draw, (1418, 264), slide.get("summaryBody", "先巡查稽查，再内部定责、整改、复查关闭。"), 19, COLORS["body"], True, 360, 4)

    pricing_table(
        draw,
        (86, 382, 850, 360),
        slide.get("auditTitle", "巡查稽查机制"),
        slide.get("auditHeaders", ["模块", "内部执行口径"]),
        slide["auditRows"],
        slide.get("auditWidths", [150, 640]),
        COLORS["blue"],
    )
    pricing_table(
        draw,
        (984, 382, 850, 360),
        slide.get("handlingTitle", "内部处理方案"),
        slide.get("handlingHeaders", ["分级", "触发情形", "内部处理动作"]),
        slide["handlingRows"],
        slide.get("handlingWidths", [120, 210, 472]),
        COLORS["amber"],
    )

    rounded(draw, (86, 770, 1834, 876), COLORS["white"], COLORS["line"], 1, 18)
    draw_text(draw, (120, 802), slide.get("flowTitle", "内部处理流程"), 24, COLORS["navy"], True)
    for idx, step in enumerate(slide["flowSteps"]):
        internal_flow_step(draw, (316 + idx * 238, 794, 194, 58), step, idx, idx == len(slide["flowSteps"]) - 1)

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 920, 148, 958), status_color(slide["status"]), None, 1, 19)
    draw_text(draw, (174, 914), slide["next"], 25, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_wdt_distribution(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    metric_boxes = [(86, 248, 270, 96), (388, 248, 270, 96), (690, 248, 270, 96), (992, 248, 270, 96)]
    for idx, (metric, box) in enumerate(zip(slide["metrics"], metric_boxes)):
        metric_box(draw, box, metric[0], metric[1], COLORS["amber"] if idx == 3 else COLORS["blue"])

    rounded(draw, (1298, 248, 1834, 458), "#FFF8ED", "#F5D6A8", 1, 18)
    draw_text(draw, (1328, 276), "初步判断", 25, COLORS["navy"], True)
    draw_text(draw, (1328, 326), "不建议仅从分销系统单点推进；应合并评估旺店通旗舰版升级、UDI能力建设与分销系统接口，降低重复开发和数据口径重构风险。", 21, COLORS["body"], False, 458, 6)

    pricing_table(
        draw,
        (86, 380, 590, 286),
        "UDI节点与影响",
        ["节点", "说明"],
        slide["udiRows"],
        [124, 406],
        COLORS["blue"],
    )
    pricing_table(
        draw,
        (710, 380, 582, 286),
        "当前系统问题",
        ["事项", "反馈"],
        slide["systemRows"],
        [154, 368],
        COLORS["green"],
    )
    pricing_table(
        draw,
        (1298, 486, 536, 180),
        "推进路径对比",
        ["路径", "判断"],
        slide["judgmentRows"],
        [170, 306],
        COLORS["amber"],
    )

    rounded(draw, (86, 700, 1834, 852), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((86, 700, 1834, 709), fill=COLORS["blue"])
    draw_text(draw, (120, 728), "行动项", 25, COLORS["navy"], True)
    action_text = "\n".join(f"{i + 1}. {v}" for i, v in enumerate(slide["actionItems"]))
    draw_text(draw, (260, 724), action_text, 22, COLORS["body"], False, 1450, 7)

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_channel_plan(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    cards = [(86, 244, 564, 276), (678, 244, 564, 276), (1270, 244, 564, 276)]
    accents = [COLORS["blue"], COLORS["green"], COLORS["amber"]]
    for plan, box, accent in zip(slide["plans"], cards, accents):
        channel_plan_card(draw, box, plan, accent)

    data_table(
        draw,
        (86, 552, 900, 300),
        "5月10%出货额目标（按财务成本核算）",
        ["产品分类", "负责人", "财务成本货值", "5月目标"],
        slide["targets"],
        [128, 360, 188, 176],
        COLORS["blue"],
    )
    data_table(
        draw,
        (1022, 552, 812, 300),
        "020清货SKU与买赠方案",
        ["产品", "库存", "方案", "总成本"],
        slide["skuTargets"],
        [300, 104, 126, 214],
        COLORS["green"],
    )

    rounded(draw, (86, 878, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 906, 152, 948), status_color(slide["status"]), None, 1, 21)
    draw_text(draw, (174, 898), slide["next"], 27, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_notice_letter_followup(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    rounded(draw, (1504, 124, 1642, 168), status_color(slide["status"]), None, 1, 22)
    draw_text(draw, (1522, 131), slide["status"], 22, COLORS["white"], True)

    rounded(draw, (86, 248, 634, 874), COLORS["white"], COLORS["line"], 1, 18)
    draw.rectangle((86, 248, 634, 257), fill=COLORS["blue"])
    draw_text(draw, (120, 292), "平台告知函", 30, COLORS["navy"], True)
    draw_text(draw, (120, 344), "已发法务审核", 24, COLORS["blue"], True)
    draw_text(
        draw,
        (120, 414),
        "文件：告知函.docx\n展示方式：截图展示\n说明：本页不展开正文细节，仅作为事项后续凭证。",
        23,
        COLORS["body"],
        False,
        460,
        8,
    )
    rounded(draw, (120, 612, 580, 702), "#FFF8ED", "#F2C98C", 1, 18)
    draw_text(draw, (150, 636), "待法务反馈后，再确认是否发函、补证或调整处理口径。", 22, COLORS["navy"], True, 400)

    rounded(draw, (690, 218, 1410, 924), COLORS["white"], COLORS["line"], 1, 18)
    paste_image_fit(canvas, draw, slide["noticeImage"]["path"], (716, 242, 668, 654), 14)
    rounded(draw, (1448, 300, 1834, 496), COLORS["soft"], "#D7E8FF", 1, 18)
    draw_text(draw, (1480, 330), "截图展示", 25, COLORS["navy"], True)
    draw_text(draw, (1480, 382), "平台告知函已形成，并已发法务审核。", 23, COLORS["body"], False, 300, 8)

    rounded(draw, (86, 904, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    rounded(draw, (110, 920, 148, 958), status_color(slide["status"]), None, 1, 19)
    draw_text(draw, (174, 914), slide["next"], 25, COLORS["navy"], True, 1510)
    footer(draw, page)
    canvas.save(out_path)


def render_final(slide: dict, bg_path: Path, out_path: Path, page: int):
    canvas = base_canvas(bg_path)
    draw = ImageDraw.Draw(canvas)
    header(draw, page, slide["title"], slide["subtitle"])
    card(draw, (86, 252, 800, 560), "本周结论", bullet_lines(slide["conclusions"]), COLORS["blue"])
    next_week = "\n".join(f"{i + 1}. {v}" for i, v in enumerate(slide["nextWeek"]))
    card(draw, (940, 252, 894, 560), "下周优先级", next_week, COLORS["green"])
    rounded(draw, (86, 850, 1834, 974), COLORS["soft"], COLORS["line"], 1, 18)
    draw_text(draw, (124, 878), "提交产品委员会", 25, COLORS["navy"], True)
    draw_text(draw, (404, 874), slide["committee"], 27, COLORS["body"])
    footer(draw, page)
    canvas.save(out_path)


def make_contact_sheet(previews: list[Path]):
    thumbs = []
    for p in previews:
        img = Image.open(p).convert("RGB")
        img.thumbnail((384, 216), Image.Resampling.LANCZOS)
        thumbs.append((p, img.copy()))
    cols = 4
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * 424, rows * 266), "#F3F6FA")
    draw = ImageDraw.Draw(sheet)
    for idx, (p, img) in enumerate(thumbs):
        col, row = idx % cols, idx // cols
        x, y = col * 424 + 20, row * 266 + 20
        sheet.paste(img, (x, y))
        draw_text(draw, (x, y + 222), f"S{idx + 1:02d}  {p.name}", 15, COLORS["muted"], False, 380)
    sheet.save(CONTACT_SHEET)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    bg_path = Path(data["bgPath"])
    previews: list[Path] = []
    for idx, slide in enumerate(data["slides"], start=1):
        out_path = OUT_DIR / f"{PREVIEW_PREFIX}{idx:02d}.png"
        if slide["kind"] == "cover":
            render_cover(slide, bg_path, out_path)
        elif slide["kind"] == "overview":
            render_overview(slide, bg_path, out_path)
        elif slide["kind"] == "item":
            if slide.get("layout") == "wdtDistribution":
                render_wdt_distribution(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "noticeLetterFollowup":
                render_notice_letter_followup(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "hyaluronicPackaging":
                render_hyaluronic_packaging(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "delayVisualMatrix":
                render_delay_visual_matrix(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "delayChannelVisual":
                render_delay_channel_visual(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "delayCompetitorLandscape":
                render_delay_competitor_landscape(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "delayLinePlan":
                render_delay_line_plan(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "adReviewPlan":
                render_ad_review_plan(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "internalPriceAudit":
                render_internal_price_audit(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "combinationPermissionPlan":
                render_combination_permission_plan(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "dealerQuestions":
                render_dealer_questions(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "marketingPolicy":
                render_marketing_policy(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "appliancePricing":
                render_appliance_pricing(slide, bg_path, out_path, idx)
            elif slide.get("layout") == "channelPlan":
                render_channel_plan(slide, bg_path, out_path, idx)
            else:
                render_item(slide, bg_path, out_path, idx)
        elif slide["kind"] == "final":
            render_final(slide, bg_path, out_path, idx)
        previews.append(out_path)
    make_contact_sheet(previews)
    print(f"PREVIEWS: {len(previews)}")
    print(f"CONTACT_SHEET: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
