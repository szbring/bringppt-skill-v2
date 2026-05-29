'use strict';
// templates/color-matrix.js
// Source: bring-core.js L1416-1477
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'colorMatrix',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '彩色矩阵：2x2象限分析，支持轴标签、中心标签和脚注',

  schema: {
    quadrants:   { type: 'array',   required: true, description: '象限列表（最多4项）[{title, content, color}]', item: { title: { type: 'string', warn: 10, error: 18 }, content: { type: 'string', warn: 40, error: 60 } } },
    axisLabels:  { type: 'object',  description: '轴标签 {left: "高/低", bottom: "弱/强"}（可选）' },
    centerLabel: { type: 'string',  description: '中心标签文本（可选）' },
    footnote:    { type: 'string',  description: '脚注文本（可选）' },
    startY:      { type: 'number',  description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '波士顿矩阵、SWOT分析、优先级四象限、竞争力评估',
    notWhen:       '流程说明、时间线、列表展示',
    scenarios: [
          {
                "trigger": "彩色2×2象限，比swotGrid更强视觉",
                "example": "高优先级/低优先级 × 高影响/低影响，用色块区分"
          },
          {
                "trigger": "BCG矩阵、优先级矩阵等管理框架",
                "example": "明星/问题/现金牛/瘦狗四象限，颜色区分各类别"
          }
    ],

    typicalHeight: '3.5~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/color-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { quadrants: mapKpsToItems(keyPoints, { max: 4 }) };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    const { quadrants = [], axisLabels, centerLabel, footnote, startY: explicitStartY } = data;
    const _startY0 = resolveStartY(slide, explicitStartY, 0.85);
    if (!Array.isArray(quadrants) || quadrants.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'colorMatrix', missingField: 'quadrants[]', hint: '需要 4 个 {label, items[]} 象限对象', startY: _startY0 });
    }

    // v4.1.6: 守护框 + 居中 + cellH 自适应
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    const cellW = 3.6;
    const gap = 0.12;
    const footnoteH = footnote ? 0.55 : 0;
    const axisBottomH = (axisLabels && axisLabels.bottom) ? 0.40 : 0;
    const available = maxBottom - top - footnoteH - axisBottomH;
    const cellH = Math.max(0.9, Math.min(1.45, (available - gap) / 2));
    const cellsH = 2 * cellH + gap;
    const totalH = cellsH + axisBottomH + footnoteH;
    const startY = top + Math.max(0, (maxBottom - top - totalH) / 2);
    const startX = (10 - cellW * 2 - gap) / 2;
    const defColors = [C.SECONDARY, C.SUCCESS, C.TEXT_LIGHT, C.DANGER];
    if (axisLabels) {
      if (axisLabels.left) {
        axisLabels.left.split("/").forEach((l, i) => {
          slide.addText(l.trim(), {
            x: startX - 0.7, y: startY + i * (cellH + gap) + cellH / 2 - 0.2, w: 0.6, h: 0.4,
            fontSize: 12, fontFace: FONTS.primary, color: C.PRIMARY, bold: true, align: "right", valign: "middle", margin: 0
          });
        });
      }
      if (axisLabels.bottom) {
        axisLabels.bottom.split("/").forEach((l, i) => {
          slide.addText(l.trim(), {
            x: startX + i * (cellW + gap) + cellW / 2 - 0.5, y: startY + cellH * 2 + gap + 0.08, w: 1.0, h: 0.3,
            fontSize: 12, fontFace: FONTS.primary, color: C.ACCENT, bold: true, align: "center", margin: 0
          });
        });
      }
    }
    quadrants.forEach((q, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = startX + col * (cellW + gap), y = startY + row * (cellH + gap);
      const color = q.color || defColors[i];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cellW, h: cellH, rectRadius: 0.1, fill: { color }
      });
      slide.addText(q.title, {
        x: x + 0.3, y: y + 0.2, w: cellW - 0.6, h: 0.5,
        fontSize: 22, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      if (q.content) {
        slide.addText(q.content, {
          x: x + 0.3, y: y + 0.75, w: cellW - 0.6, h: cellH - 1.0,
          fontSize: 13, fontFace: FONTS.primary, color: C.WHITE, bold: true, lineSpacingMultiple: 1.3, margin: 0
        });
      }
    });
    if (centerLabel) {
      const cx = startX + cellW + gap / 2, cy = startY + cellH + gap / 2;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cx - 0.9, y: cy - 0.3, w: 1.8, h: 0.6, rectRadius: 0.08, fill: { color: C.WHITE }, shadow: shadow()
      });
      slide.addText(centerLabel, {
        x: cx - 0.9, y: cy - 0.3, w: 1.8, h: 0.6,
        fontSize: 12, fontFace: FONTS.primary, color: C.TEXT, bold: true, align: "center", valign: "middle", lineSpacingMultiple: 1.2, margin: 0
      });
    }
    if (footnote) {
      slide.addText(footnote, {
        x: startX, y: startY + cellH * 2 + gap + axisBottomH + 0.05, w: cellW * 2 + gap, h: 0.35,
        fontSize: 12, fontFace: FONTS.primary, color: C.TEXT_LIGHT, italic: true, align: "center", margin: 0
      });
      const finalBottom = Math.min(startY + cellH * 2 + gap + axisBottomH + 0.40, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'colorMatrix');
    } else {
      const finalBottom = Math.min(startY + cellH * 2 + gap + axisBottomH, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'colorMatrix');
    }
  },
};
