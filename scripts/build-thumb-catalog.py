#!/usr/bin/env python3
"""build-thumb-catalog.py — 模板缩略图选册

读 /tmp/thumbs/p-NNN.jpg 与 /tmp/page_map.json，
组合成 contact-sheet PDF（每页 5 列 × 5 行 = 25 缩略图）。
每张缩略图下方标注「模板名 · 类型」+ 页码（用户告诉我页码即可挑选）。
"""
import json
import os
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("需要 PIL: pip install Pillow --break-system-packages")

THUMBS = Path("/tmp/thumbs")
MAP = json.loads(Path("/tmp/page_map.json").read_text(encoding="utf-8"))

# 排序：A 类先，按 category 再按 page
A_TYPES = {"cover","toc","section","closingQuote","backCover","heroCover","heroSection"}
def sort_key(m):
    return (0 if m["name"] in A_TYPES else 1, m["category"], m["name"], m["page"])
MAP_SORTED = sorted(MAP, key=sort_key)

# 画布参数：A3 横向 ~ 1684×1190 px @ 100dpi
PAGE_W = 1920
PAGE_H = 1200
COLS = 6
ROWS = 4
PER_PAGE = COLS * ROWS
MARGIN = 30
GAP = 14
LABEL_H = 50  # 缩略图下方标签高度

thumb_w = (PAGE_W - 2 * MARGIN - GAP * (COLS - 1)) // COLS
thumb_h = (PAGE_H - 2 * MARGIN - GAP * (ROWS - 1)) // ROWS - LABEL_H
# 调整 thumb_h 保持 16:9
thumb_h = int(thumb_w * 9 / 16)

# 字体 — 系统默认
try:
    font_main = ImageFont.truetype("/System/Library/Fonts/Supplemental/Songti.ttc", 18)
    font_sub  = ImageFont.truetype("/System/Library/Fonts/Supplemental/Songti.ttc", 14)
except:
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 18)
        font_sub  = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 14)
    except:
        font_main = ImageFont.load_default()
        font_sub  = ImageFont.load_default()

pages = []
n_sheets = (len(MAP_SORTED) + PER_PAGE - 1) // PER_PAGE
for sheet_idx in range(n_sheets):
    canvas = Image.new("RGB", (PAGE_W, PAGE_H), (245, 245, 245))
    draw = ImageDraw.Draw(canvas)
    # 顶部标题
    draw.text((MARGIN, 5), f"BRINGPPT 模板选册 {sheet_idx + 1}/{n_sheets} · 标记保留页码",
              fill=(0, 53, 145), font=font_main)
    batch = MAP_SORTED[sheet_idx * PER_PAGE : (sheet_idx + 1) * PER_PAGE]
    for idx, m in enumerate(batch):
        col = idx % COLS
        row = idx // COLS
        x = MARGIN + col * (thumb_w + GAP)
        y = MARGIN + 30 + row * (thumb_h + LABEL_H + GAP)
        # 缩略图
        thumb_path = THUMBS / f"p-{m['page']:03d}.jpg"
        if thumb_path.exists():
            thumb = Image.open(thumb_path).resize((thumb_w, thumb_h), Image.LANCZOS)
            canvas.paste(thumb, (x, y))
            # 边框
            draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(180, 180, 180), width=1)
        # 标签
        category = m["category"][:8]
        is_a = m["name"] in A_TYPES
        cat_color = (212, 162, 77) if is_a else (83, 133, 197)
        draw.text((x, y + thumb_h + 5), f"#{m['page']} {category}", fill=cat_color, font=font_sub)
        draw.text((x, y + thumb_h + 25), m["name"], fill=(40, 40, 40), font=font_main)
    pages.append(canvas)

# 保存为 PDF（多页）
out_path = "/tmp/BRINGPPT-模板选册.pdf"
pages[0].save(out_path, save_all=True, append_images=pages[1:], format="PDF", resolution=100)
print(f"✅ 写出 {out_path} ({n_sheets} 页 / {len(MAP_SORTED)} 模板)")
print(f"   每页 {COLS}×{ROWS}={PER_PAGE} 缩略图")
print(f"   A 类（橙色标签）{sum(1 for m in MAP if m['name'] in A_TYPES)} 个")
print(f"   B 类（蓝色标签）{sum(1 for m in MAP if m['name'] not in A_TYPES)} 个")
