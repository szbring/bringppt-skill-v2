'use strict';
// templates/snake-flow.js
// Source: bring-core.js L3477-3577
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'snakeFlow',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '蛇形/折线流程，6-10步按Z字形排列',

  schema: {
    steps: {
      type: 'array',
      description: '步骤列表（6-10个）',
      item: { title: { type: 'string', required: true }, desc: { type: 'string' } }
    },
    startY: { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '展示6-10个步骤的流程，内容较多需要折行显示',
    notWhen:       '步骤少于4个（用processFlow更合适），或不需要编号顺序',
    scenarios: [
          {
                "trigger": "6-10个步骤的复杂流程",
                "example": "供应链全流程10步：需求→计划→采购→入库→生产→质检→出库→配送→签收→结算"
          },
          {
                "trigger": "processFlow放不下时的替代",
                "example": "步骤超过6个时用snakeFlow折行排列，比横向挤压更清晰"
          }
    ],

    typicalHeight: '3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/snake-flow.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 lib/adapter-helpers 重构（10 行 → 4 行）
  //          render 端按 count 选 perRow（≤6→3，7-8→4，9-10→5），
  //          fromKeyPoints 优先选能整除的数量保持整齐：10→10, 9→8, 8→8, 7→6, 6→6
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    const parsed = mapKpsToItems(keyPoints, { max: 10 });
    const n = parsed.length;
    const target = n >= 10 ? 10 : n >= 8 ? 8 : n >= 6 ? 6 : n >= 4 ? 4 : n >= 3 ? 3 : n;
    return { steps: parsed.slice(0, target) };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { steps = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const count = Math.min(steps.length, 10);
    // v3.7.22: 支持 7-10 步——9-10 步用 perRow=5；7-8 步用 perRow=4；≤6 用 3
    const perRow = count <= 6 ? 3 : count <= 8 ? 4 : 5;
    const rows = Math.ceil(count / perRow);

    const availH = maxBottom - startY;
    const rowGap = 0.35;
    const cardH = Math.min(1.6, (availH - rowGap * (rows - 1)) / rows);
    // v3.7.15: cardGap 加大到 0.4" 用于放行内连接箭头
    const cardGap = 0.4;
    const cardW = (totalW - cardGap * (perRow - 1)) / perRow;

    for (let r = 0; r < rows; r++) {
      const rowY = startY + r * (cardH + rowGap);
      const rowStart = r * perRow;
      const rowEnd = Math.min(rowStart + perRow, count);
      const isReversed = r % 2 === 1;

      for (let c = rowStart; c < rowEnd; c++) {
        const step = steps[c];
        const colIdx = c - rowStart;
        const visualCol = isReversed ? (perRow - 1 - colIdx) : colIdx;
        const x = baseX + visualCol * (cardW + cardGap);
        const color = STEP_COLORS[c % STEP_COLORS.length];

        // v3.7.15: 在卡片之前先画"行内连接箭头"（不是最后一个卡片才画）
        if (colIdx < rowEnd - rowStart - 1) {
          const arrowX = isReversed ? x - cardGap + 0.04 : x + cardW + 0.02;
          slide.addShape(isReversed ? pres.shapes.LEFT_ARROW : pres.shapes.RIGHT_ARROW, {
            x: arrowX, y: rowY + cardH / 2 - 0.1, w: cardGap - 0.06, h: 0.2,
            fill: { color: C.SECONDARY }, line: { color: C.SECONDARY, width: 0 }
          });
        }

        // Card background
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x, y: rowY, w: cardW, h: cardH,
          rectRadius: 0.08, fill: { color: C.BG_LIGHT },
          line: { color: C.BORDER, width: 0.5 }, shadow: shadow()
        });

        // Top color bar
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y: rowY, w: cardW, h: 0.06, fill: { color }
        });

        // Number circle
        const circleR = 0.18;
        slide.addShape(pres.shapes.OVAL, {
          x: x + 0.12, y: rowY + 0.14, w: circleR * 2, h: circleR * 2,
          fill: { color }
        });
        slide.addText(String(c + 1), {
          x: x + 0.12, y: rowY + 0.14, w: circleR * 2, h: circleR * 2,
          fontSize: 12, fontFace: FONTS.primary,
          color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
        });

        // Title
        const titleFs = calcFitFontSize(step.title, cardW - 0.7, 0.32, 12, { minFontSize: 9 });
        slide.addText(step.title, {
          x: x + 0.52, y: rowY + 0.12, w: cardW - 0.62, h: 0.32,
          fontSize: titleFs, fontFace: FONTS.primary,
          color: C.TEXT, bold: true, valign: "middle", margin: 0
        });

        // Description
        if (step.desc) {
          const descH = cardH - 0.52;
          const descFs = calcFitFontSize(step.desc, cardW - 0.3, descH, 10, { minFontSize: 7 });
          slide.addText(step.desc, {
            x: x + 0.15, y: rowY + 0.48, w: cardW - 0.3, h: descH,
            fontSize: descFs, fontFace: FONTS.primary,
            color: C.TEXT_LIGHT, valign: "top", lineSpacingMultiple: 1.2, margin: 0
          });
        }
      }

      // Turnaround arrow between rows
      if (r < rows - 1) {
        const arrowY = rowY + cardH + 0.05;
        const arrowH = rowGap - 0.1;
        if (isReversed) {
          // Arrow pointing left (R→L row just ended, next row goes L→R)
          slide.addShape(pres.shapes.DOWN_ARROW, {
            x: baseX + 0.1, y: arrowY, w: 0.3, h: arrowH,
            fill: { color: C.SECONDARY }
          });
        } else {
          // Arrow pointing right (L→R row just ended, next row goes R→L)
          slide.addShape(pres.shapes.DOWN_ARROW, {
            x: baseX + totalW - 0.4, y: arrowY, w: 0.3, h: arrowH,
            fill: { color: C.SECONDARY }
          });
        }
      }
    }

    validateBounds(slide, startY + rows * cardH + (rows - 1) * rowGap);
  },
};
