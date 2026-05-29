'use strict';
// templates/swot-grid.js
// Source: bring-core.js L3386-3476
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'swotGrid',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: 'SWOT/四象限分析矩阵，2x2格局',

  schema: {
    quadrants: {
      type: 'array',
      description: '四个象限（恰好4个）',
      item: {
        label: { type: 'string' },
        title: { type: 'string', required: true },
        items: { type: 'array', required: true, item: { type: 'string' } },
        color: { type: 'string' }
      }
    },
    summary: { type: 'string', description: '底部摘要栏（可选）', default: '' },
    startY: { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          'SWOT分析、四象限优先级矩阵、2x2框架分析',
    notWhen:       '超过4个象限，或需要3列以上的矩阵',
    scenarios: [
          {
                "trigger": "SWOT分析：优势/劣势/机会/威胁",
                "example": "企业战略SWOT，四象限各列3-5个要点"
          },
          {
                "trigger": "2×2战略分析框架",
                "example": "不只是SWOT，任何2×2框架都可以用（如机会×可行性矩阵）"
          }
    ],

    typicalHeight: '3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/swot-grid.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const quadrants = [
            { tag: 'S', title: '优势', items: kps.slice(0, Math.ceil(kps.length / 4)) },
            { tag: 'W', title: '劣势', items: kps.slice(Math.ceil(kps.length / 4), Math.ceil(kps.length / 2)) },
            { tag: 'O', title: '机会', items: kps.slice(Math.ceil(kps.length / 2), Math.ceil(kps.length * 3 / 4)) },
            { tag: 'T', title: '威胁', items: kps.slice(Math.ceil(kps.length * 3 / 4)) },
          ];
          return { quadrants, summary: `${title}综合评估` };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫 — 这是导致 health-test p26 空白的根因
    const { quadrants = [], summary = "", startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(quadrants) || quadrants.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, {
        template: 'swotGrid',
        missingField: 'quadrants[]（不是 strengths/weaknesses/opportunities/threats）',
        hint: '需要 4 个 {tag, title, items[]} 象限对象。SWOT 是其中一种用法，但模板字段是通用 quadrants。',
        startY,
      });
    }
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const gap = 0.12;
    const summarySpace = summary ? 0.55 : 0;
    const availH = maxBottom - startY - summarySpace;
    const cellW = (totalW - gap) / 2;
    const cellH = (availH - gap) / 2;
    const headerH = 0.38;

    const quadColors = [C.PRIMARY, C.ACCENT, C.SUCCESS, C.DANGER];
    const positions = [
      { col: 0, row: 0 }, { col: 1, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }
    ];

    quadrants.slice(0, 4).forEach((q, i) => {
      const pos = positions[i];
      const x = baseX + pos.col * (cellW + gap);
      const y = startY + pos.row * (cellH + gap);
      const color = q.color || quadColors[i];

      // Card background
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cellW, h: cellH,
        rectRadius: 0.08, fill: { color: C.WHITE },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow()
      });

      // Colored header bar
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cellW, h: headerH,
        rectRadius: 0.08, fill: { color }
      });
      // Square off bottom corners of header by overlay
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: y + headerH - 0.08, w: cellW, h: 0.08,
        fill: { color }
      });

      // Label badge (e.g., "S") and title
      const labelText = q.label || "";
      const titleText = q.title || "";
      const headerText = labelText ? labelText + "  " + titleText : titleText;
      slide.addText(headerText, {
        x: x + 0.15, y, w: cellW - 0.3, h: headerH,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, valign: "middle", margin: 0
      });

      // Content items
      if (q.items && q.items.length > 0) {
        const contentH = cellH - headerH - 0.15;
        const itemText = q.items.map(it => "•  " + it).join("\n");
        const itemFs = calcFitFontSize(itemText, cellW - 0.4, contentH, 12, { minFontSize: 8 });
        slide.addText(itemText, {
          x: x + 0.2, y: y + headerH + 0.08, w: cellW - 0.4, h: contentH,
          fontSize: itemFs, fontFace: FONTS.primary,
          color: C.TEXT, lineSpacingMultiple: 1.4, valign: "top", margin: 0
        });
      }
    });

    // Optional summary bar
    if (summary) {
      const sumY = startY + cellH * 2 + gap + 0.1;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: baseX, y: sumY, w: totalW, h: 0.42,
        rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      const sumFs = calcFitFontSize(summary, totalW - 0.4, 0.42, 14, { minFontSize: 10 });
      slide.addText(summary, {
        x: baseX + 0.2, y: sumY, w: totalW - 0.4, h: 0.42,
        fontSize: sumFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide._bottomY = sumY + 0.42;  // v4.0.6
      validateBounds(slide, sumY + 0.42);
    } else {
      slide._bottomY = startY + cellH * 2 + gap;  // v4.0.6
      validateBounds(slide, startY + cellH * 2 + gap);
    }
  },
};
