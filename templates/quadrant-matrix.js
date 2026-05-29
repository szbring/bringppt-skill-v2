'use strict';
// templates/quadrant-matrix.js
// Source: bring-core.js L1120-1183
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'quadrantMatrix',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '四象限矩阵布局，支持轴标签，适合2x2战略分析框架',

  schema: {
    quadrants:   { type: 'array',  required: true,  description: '4个象限对象，每项含 title、content、color?', item: { title: { type: 'string', warn: 10, error: 18 }, content: { type: 'string', warn: 40, error: 60 } } },
    axisLabels:  { type: 'object', required: false, description: '轴标签 {top?, bottom?, left?, right?}' },
    startY:      { type: 'number', required: false },
  },

  usage: {
    when:          '展示2x2分析框架，如波士顿矩阵、优先级象限、SWOT等',
    notWhen:       '超过4个维度或需要详细文字时',
    scenarios: [
          {
                "trigger": "2×2矩阵，有X轴Y轴说明",
                "example": "利益相关方分析：影响力×支持度四象限"
          },
          {
                "trigger": "比colorMatrix更需要轴标签时",
                "example": "需要标注X/Y轴含义（如影响力、支持度）来帮助读者理解坐标意义"
          }
    ],

    typicalHeight: '约 3.4~3.8 英寸（含轴标签）',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/quadrant-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    // v3.7.17: schema 期望 content (string)，之前误用 items (array)
    const quadrants = [
            { title: '高价值高可行', content: kps[0] || '' },
            { title: '高价值低可行', content: kps[1] || '' },
            { title: '低价值高可行', content: kps[2] || '' },
            { title: '低价值低可行', content: kps[3] || '' },
          ];
          return { quadrants, axisLabels: { x: '可行性', y: '价值' } };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { quadrants, axisLabels, startY: explicitStartY } = data;
    // v4.1.6: 守护框 + 居中 + cellH 自适应
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    const hasLR = axisLabels && (axisLabels.left || axisLabels.right);
    const cellW = hasLR ? 3.8 : 4.0;
    const gap = 0.15;
    const axisTopH = (axisLabels && axisLabels.top) ? 0.35 : 0;
    const axisBottomH = (axisLabels && axisLabels.bottom) ? 0.35 : 0;
    const available = maxBottom - top - axisTopH - axisBottomH;
    // 2 行单元格 + 1 个 gap = 2*cellH + gap ≤ available
    const cellH = Math.max(1.0, Math.min(1.7, (available - gap) / 2));
    const cellsH = 2 * cellH + gap;
    const totalH = axisTopH + cellsH + axisBottomH;
    const startY = top + Math.max(0, (maxBottom - top - totalH) / 2) + axisTopH;
    const startX = (10 - cellW * 2 - gap) / 2;
    if (axisLabels) {
      if (axisLabels.top) {
        slide.addText(axisLabels.top, {
          x: startX, y: startY - 0.35, w: cellW * 2 + gap, h: 0.3,
          fontSize: 12, fontFace: FONTS.primary, color: C.TEXT_LIGHT, align: "center", margin: 0
        });
      }
      if (axisLabels.left) {
        const midY = startY + (cellH * 2 + gap) / 2;
        const vText = axisLabels.left.replace(/\s+/g, '').split('').join('\n');
        slide.addText(vText, {
          x: 0.1, y: midY - 0.6, w: 0.5, h: 1.2,
          fontSize: 11, fontFace: FONTS.primary, color: C.TEXT_LIGHT, align: "center", valign: "middle", lineSpacingMultiple: 0.8, margin: 0
        });
      }
      if (axisLabels.right) {
        const midY = startY + (cellH * 2 + gap) / 2;
        const vText = axisLabels.right.replace(/\s+/g, '').split('').join('\n');
        slide.addText(vText, {
          x: startX + cellW * 2 + gap + 0.05, y: midY - 0.6, w: 0.5, h: 1.2,
          fontSize: 11, fontFace: FONTS.primary, color: C.TEXT_LIGHT, align: "center", valign: "middle", lineSpacingMultiple: 0.8, margin: 0
        });
      }
      if (axisLabels.bottom) {
        slide.addText(axisLabels.bottom, {
          x: startX, y: startY + cellH * 2 + gap + 0.05, w: cellW * 2 + gap, h: 0.3,
          fontSize: 12, fontFace: FONTS.primary, color: C.TEXT_LIGHT, align: "center", margin: 0
        });
      }
    }
    const defaultColors = [C.PRIMARY, C.SECONDARY, C.ACCENT, C.SUCCESS];
    const positions = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }];
    quadrants.forEach((q, i) => {
      const pos = positions[i];
      const x = startX + pos.col * (cellW + gap);
      const y = startY + pos.row * (cellH + gap);
      const color = q.color || defaultColors[i];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cellW, h: cellH,
        rectRadius: 0.08, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow()
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.07, h: cellH, fill: { color }
      });
      slide.addText(q.title, {
        x: x + 0.25, y: y + 0.15, w: cellW - 0.45, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, color, bold: true, margin: 0
      });
      slide.addText(q.content, {
        x: x + 0.25, y: y + 0.6, w: cellW - 0.45, h: cellH - 0.8,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.TEXT, lineSpacingMultiple: 1.35, margin: 0
      });
    });
    const finalBottom = Math.min(startY + cellH * 2 + gap + axisBottomH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'quadrantMatrix');
  },
};
