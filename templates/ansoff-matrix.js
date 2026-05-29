'use strict';

// templates/ansoff-matrix.js
// Ansoff growth matrix: product x market, 4 quadrants
const path = require('path');
const fs = require('fs');

const QUADRANTS = [
  { key: 'penetration', name: '市场渗透', en: 'Market Penetration', risk: '低', desc: '现有产品 × 现有市场：份额提升' },
  { key: 'productDev', name: '产品开发', en: 'Product Development', risk: '中', desc: '新产品 × 现有市场：面向存量客户推出新方案' },
  { key: 'marketDev', name: '市场开发', en: 'Market Development', risk: '中', desc: '现有产品 × 新市场：拓展地区/客群' },
  { key: 'diversify', name: '多元化', en: 'Diversification', risk: '高', desc: '新产品 × 新市场：跨界扩张' },
];

function estimateLines(text, charsPerLine) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (!len) return 1;
  return Math.max(1, Math.ceil(len / Math.max(8, charsPerLine)));
}

function estimateCellHeight(def, list) {
  const headerH = 0.62;
  const riskH = 0.34;
  const descLines = estimateLines(def.desc, 22);
  const bulletLines = (list || []).slice(0, 4).reduce((sum, s) => sum + estimateLines(s, 18), 0);
  const descH = Math.min(0.62, Math.max(0.30, descLines * 0.16));
  const bulletsH = Math.min(1.00, Math.max(0.32, bulletLines * 0.14));
  const contentH = headerH + riskH + 0.08 + descH + 0.08 + bulletsH;
  return Math.max(1.10, contentH + 0.18);
}

module.exports = {
  name: 'ansoffMatrix',
  version: '1.0.0',
  category: '咨询框架',
  description: 'Ansoff 增长矩阵（产品 × 市场 4 象限）：增长战略的经典框架',

  schema: {
    initiatives: {
      type: 'object',
      required: false,
      description: '4 象限的增长举措对象 { penetration: [..], productDev: [..], marketDev: [..], diversify: [..] }',
    },
    title: { type: 'string', required: false, description: '小标题' },
    startY: { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when: '增长战略制定：判断走哪条增长路径；评估每条路径的具体举措',
    notWhen: '业务组合分析（用 bcgMatrix）；竞争策略（用 porterFiveForces）',
    typicalHeight: '3.8~4.2 英寸',
    scenarios: [
      { trigger: '增长战略 4 选项对比', example: '判断公司主推哪种增长路径' },
      { trigger: '产品-市场扩张计划', example: '1x4 象限分别列出具体举措' },
      { trigger: '新业务进入路径决策', example: '评估“市场渗透 vs 多元化”的风险收益' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/ansoff-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const t = arr => arr.map(s => splitTitleDesc(s).title || s);
    const n = Math.ceil(kps.length / 4) || 1;
    return {
      initiatives: {
        penetration: t(kps.slice(0, n)),
        productDev: t(kps.slice(n, 2 * n)),
        marketDev: t(kps.slice(2 * n, 3 * n)),
        diversify: t(kps.slice(3 * n)),
      },
      title: (page && page.title) || '',
    };
  },

  render(pres, slide, data, infra) {
    const { C, validateBounds, FONTS, getLayoutBox, calcFitFontSize } = infra;
    const { initiatives = {}, title, startY } = data;

    const box = getLayoutBox
      ? getLayoutBox(slide)
      : { top: 1.20, bottom: slide._contentMaxBottom || 4.85 };
    const top = (startY != null) ? startY : box.top;
    const bottom = Math.min(box.bottom, slide._contentMaxBottom || box.bottom) - 0.12;

    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.45 : 0;
    const axisTopH = 0.30;
    const axisBottomH = 0.30;
    const gapTop = 0.10;
    const gapBottom = 0.10;

    const mx = 1.6;
    const mw = 7.8;
    const cellW = mw / 2;

    const listA = initiatives.penetration || [];
    const listB = initiatives.productDev || [];
    const listC = initiatives.marketDev || [];
    const listD = initiatives.diversify || [];

    const topRowNaturalH = Math.max(
      estimateCellHeight(QUADRANTS[0], listA),
      estimateCellHeight(QUADRANTS[1], listB)
    );
    const bottomRowNaturalH = Math.max(
      estimateCellHeight(QUADRANTS[2], listC),
      estimateCellHeight(QUADRANTS[3], listD)
    );

    const matrixNaturalH = topRowNaturalH + bottomRowNaturalH;
    const reserveH = titleH + axisTopH + axisBottomH + gapTop + gapBottom + 0.18;
    const availableH = Math.max(2.0, bottom - top - reserveH);
    const scale = Math.min(1, availableH / Math.max(matrixNaturalH, 0.01));
    const row1H = topRowNaturalH * scale;
    const row2H = bottomRowNaturalH * scale;

    let curY = top;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: curY, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY += titleH;
    }

    const matrixTopY = curY + gapTop + 0.05;
    const row1Y = matrixTopY;
    const row2Y = matrixTopY + row1H;

    const cells = [
      { def: QUADRANTS[0], list: listA, x: mx, y: row1Y, h: row1H, bg: C.BLUE_PALE, tc: C.PRIMARY },
      { def: QUADRANTS[1], list: listB, x: mx + cellW, y: row1Y, h: row1H, bg: C.BLUE_LIGHT, tc: C.PRIMARY },
      { def: QUADRANTS[2], list: listC, x: mx, y: row2Y, h: row2H, bg: C.SECONDARY, tc: C.WHITE },
      { def: QUADRANTS[3], list: listD, x: mx + cellW, y: row2Y, h: row2H, bg: C.PRIMARY, tc: C.WHITE },
    ];

    cells.forEach((c) => {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: c.y, w: cellW, h: c.h,
        fill: { color: c.bg },
        line: { color: C.WHITE, width: 1 },
      });

      slide.addText([
        { text: c.def.name + '\n', options: { fontSize: 16, bold: true } },
        { text: c.def.en, options: { fontSize: 10, transparency: 25 } },
      ], {
        x: c.x + 0.15, y: c.y + 0.15, w: cellW - 0.3, h: 0.55,
        fontFace: FONTS.primary,
        color: c.tc, valign: 'top', margin: 0,
      });

      const riskW = 0.8;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: c.x + cellW - riskW - 0.1, y: c.y + 0.15, w: riskW, h: 0.3,
        rectRadius: 0.12,
        fill: { color: c.tc, transparency: 60 },
        line: { color: c.tc, width: 0 },
      });
      slide.addText('风险 ' + c.def.risk, {
        x: c.x + cellW - riskW - 0.1, y: c.y + 0.15, w: riskW, h: 0.3,
        fontSize: 9, fontFace: FONTS.primary, bold: true,
        color: c.tc, align: 'center', valign: 'middle', margin: 0,
      });

      const descY = c.y + 0.90;
      const descH = Math.min(0.56, Math.max(0.30, c.h * 0.18));
      const descFs = calcFitFontSize(c.def.desc, cellW - 0.3, descH, 9, { minFontSize: 7 });
      slide.addText(c.def.desc, {
        x: c.x + 0.15, y: descY, w: cellW - 0.3, h: descH,
        fontSize: descFs, fontFace: FONTS.primary,
        color: c.tc, transparency: 20, italic: true, valign: 'top', margin: 0,
      });

      if (c.list.length > 0) {
        const bulletText = c.list.slice(0, 4).map(s => '• ' + s).join('\n');
        const bulletsY = descY + descH + 0.10;
        const bulletsH = Math.max(0.28, c.y + c.h - bulletsY - 0.16);
        const bulletsFs = calcFitFontSize(bulletText, cellW - 0.36, bulletsH, 10, { minFontSize: 7.5 });
        slide.addText(bulletText, {
          x: c.x + 0.18, y: bulletsY, w: cellW - 0.36, h: bulletsH,
          fontSize: bulletsFs, fontFace: FONTS.primary,
          color: c.tc, lineSpacingMultiple: 1.28, valign: 'top', margin: 0,
        });
      }
    });

    slide.addText('现有产品', {
      x: mx, y: row1Y - axisTopH, w: cellW, h: 0.3,
      fontSize: 10, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText('新产品', {
      x: mx + cellW, y: row1Y - axisTopH, w: cellW, h: 0.3,
      fontSize: 10, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('产品  Product →', {
      x: mx, y: matrixTopY + row1H + row2H + 0.04, w: mw, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
    });

    slide.addText('现有\n市场', {
      x: 0.3, y: row1Y, w: 1.2, h: row1H,
      fontSize: 10, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'right', valign: 'middle',
      lineSpacingMultiple: 1.2, margin: 0,
    });
    slide.addText('新\n市场', {
      x: 0.3, y: row2Y, w: 1.2, h: row2H,
      fontSize: 10, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'right', valign: 'middle',
      lineSpacingMultiple: 1.2, margin: 0,
    });

    const finalBottom = Math.min(bottom, matrixTopY + row1H + row2H + axisBottomH + gapBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'ansoffMatrix');
  },
};
