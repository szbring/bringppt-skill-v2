'use strict';
// templates/card-grid.js
// Source: bring-core.js L1738-1820
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'cardGrid',
  version:     '1.0.0',
  category:    '并列型',
  description: '卡片网格：多列卡片布局，支持组标签、描述文字和汇总栏',

  schema: {
    cards:       { type: 'array',  required: true, description: '卡片列表 [{title, desc, bgColor}]', item: { title: { type: 'string', warn: 15, error: 25 }, desc: { type: 'string', warn: 30, error: 50 } } },
    columns:     { type: 'number', description: '列数（默认4）' },
    groupLabels: { type: 'array',  description: '分组标签 [{text, span, color}]（可选）' },
    summary:     { type: 'string', warn: 50, error: 80, description: '底部汇总文本（可选）' },
    startY:      { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '能力矩阵、功能列表、多项并列内容展示',
    notWhen:       '流程说明、时间线、引用类内容',
    scenarios: [
          {
                "trigger": "4-6个并列模块，需要网格布局",
                "example": "六大能力模块、四大战略支柱——卡片式网格，有标题和描述"
          },
          {
                "trigger": "比threeColumn需要更多卡片时（4-8个）",
                "example": "超过3列用cardGrid，指定columns=2或3"
          }
    ],

    typicalHeight: '2.0~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/card-grid.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { cards: mapKpsToItems(keyPoints, { max: 6 }) };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS, GRID } = infra;
    const { cards, columns = 4, groupLabels, summary, startY: explicitStartY } = data;

    // v4.1.8 (修 P2-D): 空数组 → 友好失败卡
    if (!Array.isArray(cards) || cards.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'cardGrid', missingField: 'cards[]', hint: '需要至少 1 个 {title, desc} 卡片', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }

    // v4.1.6: 守护框 + 纵向居中
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    const gap = GRID.GAP_M;
    const totalW = GRID.CONTENT_WIDTH;
    const startX = GRID.LEFT;
    const cardW = (totalW - (columns - 1) * gap) / columns;
    const rowCount = Math.ceil(cards.length / columns);
    const summarySpace = summary ? 0.55 : 0;
    const groupLabelSpace = (groupLabels && groupLabels.length > 0) ? 0.35 : 0;
    const available = maxBottom - top - summarySpace - groupLabelSpace;
    const cardH = Math.min(1.0, (available - (rowCount - 1) * gap) / rowCount);
    // 纵向居中
    const totalContentH = groupLabelSpace + rowCount * cardH + (rowCount - 1) * gap + summarySpace;
    const startY = top + Math.max(0, (maxBottom - top - totalContentH) / 2);
    let contentStartY = startY;

    if (groupLabels && groupLabels.length > 0) {
      let gx = startX;
      groupLabels.forEach((gl) => {
        const gw = gl.span * cardW + (gl.span - 1) * gap;
        const gc = gl.color || C.ACCENT;
        slide.addText(gl.text, {
          x: gx, y: contentStartY, w: gw, h: 0.3,
          fontSize: 12, fontFace: FONTS.primary,
          color: gc, bold: true, align: "center", margin: 0
        });
        gx += gw + gap;
      });
      contentStartY += 0.35;
    }

    cards.forEach((card, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = startX + col * (cardW + gap);
      const y = contentStartY + row * (cardH + gap);
      const bgColor = card.bgColor || C.BG_LIGHT;

      // v3.7.35: 每张卡片顶部加 STEP_COLORS 色带（顶咨级层次感）
      const stripeColor = card.bgColor ? null : STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cardW, h: cardH,
        rectRadius: 0.06, fill: { color: bgColor }, shadow: shadow(),
        line: { color: C.BORDER, width: 0.5 },
      });
      if (stripeColor) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y, w: cardW, h: 0.08, fill: { color: stripeColor },
        });
      }
      // v3.7.39: 标题下移 0.20 后，desc 同步下移；并按 cardW 估算溢出自动缩字号
      const stripeOffset = stripeColor ? 0.20 : 0.08;
      const titleH = card.desc ? cardH * 0.32 : cardH - stripeOffset - 0.08;
      const titleTop = y + stripeOffset;
      // 标题字号：按 cardW 与 title 长度估算，过长自动缩小（14 → 11）
      const titleLen = (card.title || '').length;
      const titleMaxLen = Math.max(6, Math.floor(cardW / 0.18));
      const fsTitle = titleLen > titleMaxLen * 1.5 ? 11
                    : titleLen > titleMaxLen ? 12
                    : 14;
      slide.addText(card.title, {
        x: x + 0.08, y: titleTop, w: cardW - 0.16, h: titleH,
        fontSize: fsTitle, fontFace: FONTS.primary,
        color: card.bgColor ? C.WHITE : C.PRIMARY, bold: true,
        align: "center", valign: card.desc ? "top" : "middle", margin: 0
      });
      if (card.desc) {
        // desc 起点 = 标题底 + 间距；当标题下移时同步下移
        const descTop = titleTop + titleH + 0.04;
        const descH = cardH - (descTop - y) - 0.08;
        // desc 字号：过长自动缩小（10 → 8.5）
        const descLen = (card.desc || '').length;
        const descMaxLen = Math.max(8, Math.floor((cardW * descH) / 0.22));
        const fsDesc = descLen > descMaxLen * 1.5 ? 8.5
                     : descLen > descMaxLen ? 9
                     : 10;
        slide.addText(card.desc, {
          x: x + 0.08, y: descTop, w: cardW - 0.16, h: descH,
          fontSize: fsDesc, fontFace: FONTS.primary,
          color: card.bgColor ? C.WHITE : C.TEXT,
          align: "center", valign: "top", lineSpacingMultiple: 1.25, margin: 0
        });
      }
    });

    if (summary) {
      const sumY = contentStartY + rowCount * (cardH + gap) + 0.1;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: startX, y: sumY, w: totalW, h: 0.42,
        rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      const cgSumFs = calcFitFontSize(summary, totalW, 0.42, 14, { minFontSize: 11 });
      slide.addText(summary, {
        x: startX, y: sumY, w: totalW, h: 0.42,
        fontSize: cgSumFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, autoFit: true
      });
      const finalBottom = Math.min(sumY + 0.42, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'cardGrid');
    } else {
      const finalBottom = Math.min(contentStartY + rowCount * (cardH + gap) - gap, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'cardGrid');
    }
  },
};
