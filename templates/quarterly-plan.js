'use strict';
// templates/quarterly-plan.js
// Source: bring-core.js L2519-2603
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'quarterlyPlan',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '季度计划，4列卡片展示Q1-Q4目标和任务',

  schema: {
    quarters: { type: 'array', description: '季度计划 [{ label, focus, items: string[] }]，共4项' },
    title:    { type: 'string', description: '标题' },
    startY:   { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '年度/季度计划展示，按Q1-Q4划分目标和行动项',
    notWhen:       '非季度周期或任务数量极少时',
    scenarios: [
          {
                "trigger": "Q1-Q4季度目标和任务分配",
                "example": "年度计划分解：4列卡片分别展示每季度的核心目标和关键任务"
          },
          {
                "trigger": "年度规划汇报",
                "example": "战略落地四季度节奏：Q1夯实基础、Q2快赢、Q3规模化、Q4固化"
          }
    ],

    typicalHeight: '3.0~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/quarterly-plan.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({
            label: q,
            items: kps.slice(i * Math.ceil(kps.length / 4), (i + 1) * Math.ceil(kps.length / 4)),
          }));
          return { quarters, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { quarters, title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const count = 4;
    const gap = 0.2;
    const cardW = (totalW - gap * (count - 1)) / count;

    let curY = startY;
    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: baseX, y: curY, w: totalW, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, margin: 0
      });
      curY += 0.4;
    }

    const cardH = Math.min(3.2, maxBottom - curY);
    const topBarH = 0.06;
    const labelH = 0.35;
    const focusH = 0.4;
    const itemsY = topBarH + labelH + focusH + 0.05;
    const itemsH = cardH - itemsY - 0.1;

    quarters.slice(0, count).forEach((q, i) => {
      const x = baseX + i * (cardW + gap);
      const color = STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: curY, w: cardW, h: cardH,
        rectRadius: 0.08, fill: { color: C.BG_LIGHT }, shadow: shadow()
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: curY, w: cardW, h: topBarH,
        fill: { color }
      });

      slide.addText(q.label || ("Q" + (i + 1)), {
        x, y: curY + topBarH, w: cardW, h: labelH,
        fontSize: 16, fontFace: FONTS.primary,
        color, bold: true, align: "center", valign: "middle", margin: 0
      });

      const focusFs = calcFitFontSize(q.focus, cardW - 0.2, focusH, 12, { minFontSize: 9 });
      slide.addText(q.focus, {
        x: x + 0.1, y: curY + topBarH + labelH, w: cardW - 0.2, h: focusH,
        fontSize: focusFs, fontFace: FONTS.primary,
        color: C.TEXT, bold: true, align: "center", valign: "middle", margin: 0
      });

      slide.addShape(pres.shapes.LINE, {
        x: x + 0.15, y: curY + topBarH + labelH + focusH,
        w: cardW - 0.3, h: 0,
        line: { color: C.BORDER, width: 0.5 }
      });

      const items = q.items || [];
      const itemTexts = items.map((item, j) => ({
        text: "• " + item,
        options: {
          fontSize: 9, fontFace: FONTS.primary,
          color: C.TEXT, breakLine: j < items.length - 1
        }
      }));
      if (itemTexts.length > 0) {
        slide.addText(itemTexts, {
          x: x + 0.1, y: curY + itemsY, w: cardW - 0.2, h: itemsH,
          lineSpacingMultiple: 1.3, margin: 0
        });
      }
    });

    const bottomY = curY + cardH;
    validateBounds(slide, bottomY);
  },
};
