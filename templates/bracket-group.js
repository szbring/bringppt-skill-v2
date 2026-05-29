'use strict';

const path = require('path');
const fs = require('fs');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateTextUnits(text) {
  const s = String(text || '');
  let units = 0;
  for (const ch of s) {
    if (/\s/.test(ch)) {
      units += 0.18;
      continue;
    }
    const code = ch.codePointAt(0);
    if (code <= 0x7f) {
      units += /[A-Za-z0-9]/.test(ch) ? 0.55 : 0.35;
    } else {
      units += 1.0;
    }
  }
  return units;
}

function estimateRows(text, unitsPerLine) {
  return Math.max(1, Math.ceil(estimateTextUnits(text) / unitsPerLine));
}

module.exports = {
  name: 'bracketGroup',
  version: '1.0.0',
  category: '矩阵/架构类',
  description: '左侧多个并列项通过大括号汇聚到右侧一个总结概念；用于展示多个细项 -> 一个结论的逻辑关系。',

  schema: {
    items: {
      type: 'array',
      required: true,
      description: '左侧的并列项数组（2-6项）；可用 [string] 或 [{ title, desc? }]',
    },
    summary: { type: 'string', required: true, description: '右侧汇总词或结论（建议 <= 12 字）' },
    summaryDesc: { type: 'string', required: false, description: '右侧汇总的二级说明（可选）' },
    title: { type: 'string', required: false, description: '小标题' },
    direction: {
      type: 'string',
      default: 'rightSummary',
      description: 'rightSummary（默认，左项 -> 右汇总）| leftSummary（右项 -> 左汇总）',
    },
    startY: { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when: '多个并列项归纳为一个核心结论；或一个核心分解为多个支柱',
    notWhen: '需要时间顺序、流程步骤、因果链展示时',
    typicalHeight: '2.0~3.0 英尺',
    scenarios: [
      { trigger: '多个症状归纳为一个问题', example: '"客户流失 / 团队倦怠 / NPS 下降 / 增长停滞" -> "缺乏战略聚焦"' },
      { trigger: '多个解决方案归纳为一个策略', example: '"流程重构 / 系统改造 / 团队培训 / 激励调整" -> "数字化转型"' },
      { trigger: '一个核心拆分为多个支柱', example: '"AI 落地" -> "智能调研 / 知识引擎 / 可视化交付"（leftSummary 方向）' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/bracket-group.json');
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return { errorPatterns: [], corrections: [] };
    }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    if (kps.length < 2) return { items: kps, summary: title || '汇总' };

    const items = kps.slice(0, -1).map((kp) => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return d ? { title: t, desc: d } : t;
    });
    const summary = splitTitleDesc(kps[kps.length - 1]).title;
    return { items, summary, title };
  },

  render(pres, slide, data, infra) {
    const {
      C,
      shadow,
      resolveStartY,
      validateBounds,
      FONTS,
      calcFitFontSize,
    } = infra;
    const {
      items = [],
      summary,
      summaryDesc,
      title,
      direction = 'rightSummary',
      startY,
    } = data;

    const count = items.length;
    if (count === 0 || !summary) return;

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.75, y: sy, w: 8.5, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.5;
    }

    const itemsW = 3.5;
    const braceW = 0.7;
    const summW = 3.0;
    const totalW = itemsW + braceW + summW + 0.5;
    const left0 = (10 - totalW) / 2;
    const itemX = direction === 'leftSummary' ? left0 + summW + 0.5 + braceW : left0;
    const braceX = direction === 'leftSummary' ? left0 + summW + 0.25 : left0 + itemsW + 0.25;
    const summX = direction === 'leftSummary' ? left0 : left0 + itemsW + 0.5 + braceW;

    const maxBottom = slide._contentMaxBottom || 4.85;
    const availableH = Math.max(1.45, maxBottom - curY - 0.3);
    const itemGap = 0.08;
    const textTopPad = 0.04;
    const textBottomPad = 0.04;

    let itemHeights = items.map((it) => {
      const txt = typeof it === 'string' ? it : (it && it.title) || '';
      const dsc = typeof it === 'object' && it ? it.desc : '';
      const titleRows = estimateRows(txt, 12.5);
      const descRows = dsc ? estimateRows(dsc, 15.5) : 0;
      const base = 0.16 + titleRows * 0.10 + (dsc ? 0.04 + descRows * 0.08 : 0);
      return clamp(base, dsc ? 0.40 : 0.30, dsc ? 0.56 : 0.38);
    });

    let itemsBlockH = itemHeights.reduce((a, b) => a + b, 0) + itemGap * Math.max(0, count - 1);
    if (itemsBlockH > availableH) {
      const scale = availableH / itemsBlockH;
      const scaledGap = Math.max(0.05, itemGap * scale);
      itemHeights = itemHeights.map((h) => clamp(h * scale, 0.30, 0.70));
      itemsBlockH = itemHeights.reduce((a, b) => a + b, 0) + scaledGap * Math.max(0, count - 1);
    }

    const summaryCardBaseH = summaryDesc ? 1.00 : 0.86;
    const summaryCardH = Math.min(summaryCardBaseH, Math.max(0.50, itemsBlockH - 0.12));
    const summaryY = curY + 0.1 + Math.max(0, (itemsBlockH - summaryCardH) / 2);

    let offsetY = 0;
    items.forEach((it, i) => {
      const boxH = itemHeights[i];
      const y = curY + 0.1 + offsetY;
      const txt = typeof it === 'string' ? it : (it && it.title) || '';
      const dsc = typeof it === 'object' && it ? it.desc : '';

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: itemX, y, w: itemsW, h: boxH,
        rectRadius: 0.06, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 },
      });

      const innerW = itemsW - 0.2;
      const innerH = Math.max(0.1, boxH - textTopPad - textBottomPad);
      if (dsc) {
        const titleRows = estimateRows(txt, 12.5);
        const titleH = clamp(0.16 + titleRows * 0.10, 0.20, innerH * 0.62);
        const descH = Math.max(0.10, innerH - titleH - 0.02);
        slide.addText(txt, {
          x: itemX + 0.1, y: y + textTopPad, w: innerW, h: titleH,
          fontSize: calcFitFontSize(txt, innerW, titleH, 12, { minFontSize: 9 }),
          fontFace: FONTS.primary, bold: true,
          color: C.PRIMARY, align: 'left', valign: 'bottom', margin: 0,
          shrinkText: true,
        });
        slide.addText(dsc, {
          x: itemX + 0.1, y: y + textTopPad + titleH + 0.01, w: innerW, h: descH,
          fontSize: calcFitFontSize(dsc, innerW, descH, 9, { minFontSize: 7 }),
          fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: 'left', valign: 'top', margin: 0,
          shrinkText: true,
        });
      } else {
        slide.addText(txt, {
          x: itemX + 0.1, y: y + textTopPad, w: innerW, h: innerH,
          fontSize: calcFitFontSize(txt, innerW, innerH, 12, { minFontSize: 9 }),
          fontFace: FONTS.primary, bold: true,
          color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
          shrinkText: true,
        });
      }

      offsetY += boxH + itemGap;
    });

    const braceShape = direction === 'leftSummary' ? pres.shapes.LEFT_BRACE : pres.shapes.RIGHT_BRACE;
    slide.addShape(braceShape, {
      x: braceX, y: curY + 0.1, w: braceW, h: itemsBlockH,
      fill: { color: C.WHITE },
      line: { color: C.SECONDARY, width: 2.5 },
    });

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: summX, y: summaryY,
      w: summW, h: summaryCardH,
      rectRadius: 0.1,
      fill: { color: C.PRIMARY },
      shadow: shadow(),
    });

    const summaryTitleH = summaryDesc ? Math.min(0.58, summaryCardH * 0.60) : summaryCardH;
    const summaryTitleFs = calcFitFontSize(summary, summW - 0.2, summaryTitleH, summaryDesc ? 18 : 20, { minFontSize: 14 });
    slide.addText(summary, {
      x: summX + 0.1, y: summaryY + 0.04,
      w: summW - 0.2, h: summaryTitleH,
      fontSize: summaryTitleFs, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: summaryDesc ? 'bottom' : 'middle', margin: 0,
      shrinkText: true,
    });
    if (summaryDesc) {
      const descY = summaryY + summaryTitleH + 0.01;
      const descH = Math.max(0.14, summaryCardH - summaryTitleH - 0.05);
      slide.addText(summaryDesc, {
        x: summX + 0.15, y: descY,
        w: summW - 0.3, h: descH,
        fontSize: calcFitFontSize(summaryDesc, summW - 0.3, descH, 10, { minFontSize: 7 }),
        fontFace: FONTS.primary,
        color: C.WHITE, transparency: 20,
        align: 'center', valign: 'top', margin: 0,
        shrinkText: true,
      });
    }

    slide._bottomY = curY + itemsBlockH + 0.3;
    validateBounds(slide, slide._bottomY);
  },
};
