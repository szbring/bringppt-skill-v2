'use strict';
// templates/three-column.js
// Source: bring-core.js L584-649
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'threeColumn',
  version:     '1.0.0',
  category:    '并列型',
  description: '三列卡片并列布局，支持编号圆圈、标题、描述及底部总结栏',

  schema: {
    cards:    { type: 'array', required: true, min: 3, max: 3, description: '3个卡片对象，每个含 title、desc、number?、color?', item: { title: { type: 'string', warn: 10, error: 18 }, desc: { type: 'string', warn: 25, error: 40 } } },
    summary:  { type: 'string|object', required: false, warn: 50, error: 80, description: '底部总结文字或 {text, bgColor}' },
    startY:   { type: 'number', required: false },
    maxCardH: { type: 'number', required: false },
  },

  usage: {
    when:          '需要并排展示3个独立要点、步骤或优势，需要编号圆圈区分',
    notWhen:       '超过3列或内容差异很大时',
    scenarios: [
          {
                "trigger": "三个并列概念/维度/阶段",
                "example": "成功变革三要素：领导力/愿景/能力——三列等宽展示"
          },
          {
                "trigger": "三阶段或三个选择的展示",
                "example": "快赢/中期/长期三个层次的解决方案"
          }
    ],

    typicalHeight: '约 2.8~3.5 英寸（含summary）',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/three-column.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: 模板自带 keyPoints 适配器（取代 storyboard-converter 的 god switch）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const cards = kps.slice(0, 3).map((kp, i) => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { title: t, desc: d || t, number: String(i + 1) };
    });
    const summary = kps.slice(3).join('；') || `三大${title}核心要点`;
    return { cards, summary };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { cards, summary, startY: explicitStartY, maxCardH } = data;
    // v4.1.8 (修 P2-D): 空数组 → 友好失败卡
    if (!Array.isArray(cards) || cards.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'threeColumn', missingField: 'cards[]', hint: '需要 3 个 {title, desc} 卡片', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }
    // v4.1.6: 守护框 + 纵向居中
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    // summary 段：高约 0.65 + 间距 0.25
    const sumBlock = summary ? 0.90 : 0;
    const available = maxBottom - top;
    const autoH = Math.min(2.6, available - sumBlock);
    const cardH = maxCardH ? Math.min(maxCardH, autoH) : autoH;
    // 纵向居中
    const contentH = cardH + sumBlock;
    const startY = top + Math.max(0, (available - contentH) / 2);
    // v3.8.1 (Tier-1 #3): 12 列 grid — 3 卡均分 9.0" content 区
    const gap = infra.GRID.GAP_L;  // 0.25
    const cardW = (infra.GRID.CONTENT_WIDTH - gap * 2) / 3;  // ~2.83
    const startX = infra.GRID.LEFT;  // 0.5
    // Three independent text zones with explicit gaps (no nesting/overlap)
    const circleTopPad = 0.15;  // gap from card top to circle
    const circleH = 0.5;
    const gapCircleTitle = 0.12; // gap between circle bottom and title top
    const titleH = 0.35;         // tight height for single-line title
    const gapTitleDesc = 0.1;    // gap between title bottom and desc top
    const titleY = circleTopPad + circleH + gapCircleTitle; // relative to card top
    const descY = titleY + titleH + gapTitleDesc;
    const descH = cardH - descY - 0.12; // 0.12 bottom margin

    cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cardW, h: cardH,
        fill: { color: C.BG_LIGHT }, shadow: shadow()
      });
      const circleColor = card.color || C.SECONDARY;
      slide.addShape(pres.shapes.OVAL, {
        x: x + cardW / 2 - 0.25, y: startY + circleTopPad, w: circleH, h: circleH,
        fill: { color: circleColor }
      });
      slide.addText(String(card.number != null ? card.number : i + 1), {
        x: x + cardW / 2 - 0.25, y: startY + circleTopPad, w: circleH, h: circleH,
        fontSize: 16, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide.addText(card.title, {
        x: x + 0.2, y: startY + titleY, w: cardW - 0.4, h: titleH,
        fontSize: 16, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide.addText(card.desc, {
        x: x + 0.2, y: startY + descY, w: cardW - 0.4, h: descH,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.TEXT, lineSpacingMultiple: 1.4, valign: "top", margin: 0
      });
    });
    if (summary) {
      const sumColor = summary.bgColor || C.SECONDARY;
      const sumText = typeof summary === "string" ? summary : summary.text;
      const sumW3 = cardW * 3 + gap * 2;
      const fontSizeBase = sumText.length <= 30 ? 14 : (sumText.length <= 60 ? 12 : 11);
      const charsPerLine = Math.floor(sumW3 * 72 / fontSizeBase / 1.05);
      const linesNeeded = Math.ceil(sumText.length / Math.max(20, charsPerLine));
      const sumH = Math.min(0.95, Math.max(0.45, linesNeeded * (fontSizeBase / 72) * 1.5 + 0.1));
      const displayText = sumText.length > 120 ? sumText.slice(0, 117) + '…' : sumText;
      // v4.0.6: summary 紧跟卡片下方 0.25" 间距，不再强制贴底
      //   避免与下游 insightBanner 抢占"贴底"位置导致重叠
      const sumY = startY + cardH + 0.25;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: startX, y: sumY, w: sumW3, h: sumH,
        fill: { color: sumColor }
      });
      slide.addText(displayText, {
        x: startX + 0.15, y: sumY, w: sumW3 - 0.3, h: sumH,
        fontSize: fontSizeBase, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle",
        lineSpacingMultiple: 1.25, margin: 0,
      });
      // v4.1.6: 钳制到 maxBottom
      const finalBottom = Math.min(sumY + sumH, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'threeColumn');
    } else {
      const finalBottom = Math.min(startY + cardH, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'threeColumn');
    }
  },
};
