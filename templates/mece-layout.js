'use strict';
// templates/mece-layout.js — MECE 横版（左主标题 + 右 3-4 个 MECE 子项）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'meceLayout',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '麦肯锡式 MECE 横版：左侧主标题 + 右侧 3-4 个互斥穷尽子项 + 每项带数据点',

  schema: {
    mainTitle: { type: 'string', required: true, warn: 15, error: 25 },
    mainSubtitle: { type: 'string', warn: 40, error: 60 },
    items: { type: 'array', min: 3, max: 6, required: true,
      item: { title: { type: 'string', required: true, warn: 12, error: 20 },
              desc:  { type: 'string', warn: 30, error: 50 },
              metric: { type: 'string', warn: 12, error: 20 } } },
  },

  usage: {
    when:    '主结论 + MECE 拆解 3-6 个互斥维度，每个维度可量化',
    notWhen: '维度超过 6 个；或维度之间非互斥',
    maxItems: 6,
    typicalHeight: '3.5"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/mece-layout.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const items = kps.slice(0, 6).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      const m = (desc || kp).match(/(\d+(?:\.\d+)?\s*%?)/);
      return { title: title || kp, desc: desc || '', metric: m ? m[1] : '' };
    });
    return {
      mainTitle:    (page && page.title) || '核心拆解',
      mainSubtitle: (page && page.subtitle),
      items,
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, shadow, resolveStartY, calcFitFontSize } = infra;
    const { mainTitle, mainSubtitle, items = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.3);

    // v3.9.1: 总高度从 3.7 → 3.5，使 bottom y=1.3+3.5=4.8 不再覆盖 logo (y=4.95)
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalH = Math.min(3.5, maxBottom - sy);

    // 左侧 35% — 主标题
    const leftW = 3.2;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: sy, w: leftW, h: totalH,
      fill: { color: C.PRIMARY },
    });
    slide.addText(mainTitle, {
      x: 0.7, y: sy + 0.3, w: leftW - 0.4, h: 1.5,
      fontSize: 22, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, valign: 'top', margin: 0, lineSpacingMultiple: 1.3,
    });
    if (mainSubtitle) {
      slide.addText(mainSubtitle, {
        x: 0.7, y: sy + 1.9, w: leftW - 0.4, h: 1.8,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.BLUE_PALE, valign: 'top', lineSpacingMultiple: 1.5, margin: 0,
      });
    }

    // v3.7.39: 支持 3-6 项（之前 max 4），根据条目数动态调整字号与间距
    // 右侧 65% — MECE 子项
    const rightX = 0.5 + leftW + 0.3, rightW = 5.7;
    const n = Math.min(items.length, 6);
    const rowGap = n >= 6 ? 0.06 : (n >= 5 ? 0.08 : 0.10);
    const itemH = (totalH - rowGap * (n - 1)) / n;

    // 动态字号档：3-4 项疏排 / 5 项中字 / 6 项紧凑
    const fsTitle  = n >= 6 ? 12 : (n >= 5 ? 13 : 14);
    const fsDesc   = n >= 6 ? 9  : (n >= 5 ? 9.5 : 10);
    const fsNum    = n >= 6 ? 22 : (n >= 5 ? 24 : 28);
    const fsMetric = n >= 6 ? 18 : (n >= 5 ? 20 : 24);
    // 当 box 较矮时 desc 与 title 上下贴近、避免溢出
    const compact  = itemH <= 0.65;

    items.slice(0, n).forEach((it, i) => {
      const y = sy + i * (itemH + rowGap);
      const color = STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: rightX, y, w: rightW, h: itemH, rectRadius: 0.06,
        fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: rightX, y, w: 0.08, h: itemH, fill: { color },
      });
      // 左侧编号
      slide.addText(String(i + 1), {
        x: rightX + 0.2, y: y + 0.05, w: 0.4, h: itemH - 0.1,
        fontSize: fsNum, fontFace: FONTS.numeric, bold: true,
        color, valign: 'middle', margin: 0,
      });
      // 标题
      const titleH = compact ? itemH * 0.5 : 0.32;
      slide.addText(it.title, {
        x: rightX + 0.7, y: y + 0.08, w: rightW - 2.0, h: titleH,
        fontSize: fsTitle, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: 'top', margin: 0,
      });
      if (it.desc) {
        const descY = y + (compact ? itemH * 0.55 : 0.42);
        const descH = itemH - (compact ? itemH * 0.55 + 0.05 : 0.50);
        slide.addText(it.desc, {
          x: rightX + 0.7, y: descY, w: rightW - 2.0, h: descH,
          fontSize: fsDesc, fontFace: FONTS.primary, color: C.TEXT,
          valign: 'top', lineSpacingMultiple: 1.25, margin: 0,
        });
      }
      // 右侧 metric 大数字
      // v4.1.7 (修 P2-4): 数字+单位 "4500w" 在窄 1.1" box 内被 LibreOffice wrap，
      //   "W" 掉到第 2 行。calcFitFontSize 缩字号到刚好单行，wrap:false 强制不换行。
      if (it.metric) {
        const metricStr = String(it.metric);
        const fitFs = (typeof calcFitFontSize === 'function')
          ? calcFitFontSize(metricStr, 1.05, itemH - 0.1, fsMetric, { minFontSize: 10, lineSpacing: 1.0 })
          : fsMetric;
        slide.addText(metricStr, {
          x: rightX + rightW - 1.2, y: y + 0.05, w: 1.1, h: itemH - 0.1,
          fontSize: fitFs, fontFace: FONTS.numeric, bold: true,
          color: C.ACCENT, align: 'right', valign: 'middle', margin: 0,
          wrap: false,
        });
      }
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = sy + totalH;
  },
};
