'use strict';
// templates/process-flow.js
// Source: bring-core.js L1067-1119
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'processFlow',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '流程卡片横向排列，带编号、图标、标题、描述和箭头连接',

  schema: {
    steps:  { type: 'array', required: true, description: '步骤数组，每项含 title、desc?、iconData?', item: { title: { type: 'string', warn: 10, error: 18 }, desc: { type: 'string', warn: 30, error: 50 } } },
    startY: { type: 'number', required: false },
  },

  usage: {
    when:          '展示线性流程、操作步骤、工作流程时，3~6个步骤最佳',
    notWhen:       '步骤超过6个或步骤间有分支时',
    scenarios: [
          {
                "trigger": "3-6个有顺序的执行步骤",
                "example": "变革推进五步：点火→联盟→激活→扩散→固化"
          },
          {
                "trigger": "工作流程、标准流程说明",
                "example": "数字化预警四步流：采集→识别→预警→响应"
          },
          {
                "trigger": "与causalChain的区别：步骤平行执行，无因果分类标签",
                "example": "processFlow用于执行步骤，causalChain用于因果诊断"
          }
    ],

    typicalHeight: '约 2.2 英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/process-flow.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { steps: mapKpsToItems(keyPoints, { max: 6 }) };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { steps, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.8);
    // v3.7.14: count > 5 时自动收缩 boxW 防止横向超出 10" 页宽
    const count = Math.min(steps.length, 6);
    const arrowW = count > 5 ? 0.3 : 0.4;
    const availW = 9.4;  // 留 0.3 边距 ×2
    const boxW = Math.min(1.6, (availW - (count - 1) * arrowW) / count);
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const boxH = Math.min(2.2, maxBottom - startY);
    const totalW = count * boxW + (count - 1) * arrowW;
    const startX = (10 - totalW) / 2;
    steps.forEach((step, i) => {
      const x = startX + i * (boxW + arrowW);
      const color = STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: startY, w: boxW, h: boxH,
        rectRadius: 0.1, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow()
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: boxW, h: 0.07, fill: { color }
      });
      slide.addShape(pres.shapes.OVAL, {
        x: x + boxW / 2 - 0.22, y: startY + 0.2, w: 0.44, h: 0.44,
        fill: { color }
      });
      slide.addText(String(i + 1), {
        x: x + boxW / 2 - 0.22, y: startY + 0.2, w: 0.44, h: 0.44,
        fontSize: 16, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      if (step.iconData) {
        slide.addImage({ data: step.iconData, x: x + boxW / 2 - 0.2, y: startY + 0.75, w: 0.4, h: 0.4 });
      }
      slide.addText(step.title, {
        x: x + 0.1, y: startY + (step.iconData ? 1.2 : 0.8), w: boxW - 0.2, h: 0.4,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, align: "center", margin: 0
      });
      if (step.desc) {
        slide.addText(step.desc, {
          x: x + 0.1, y: startY + (step.iconData ? 1.6 : 1.2), w: boxW - 0.2, h: boxH - (step.iconData ? 1.8 : 1.4),
          fontSize: 11, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: "center", lineSpacingMultiple: 1.3, margin: 0
        });
      }
      if (i < count - 1) {
        const arrowX = x + boxW + 0.05;
        const arrowY = startY + boxH / 2 - 0.12;
        slide.addShape(pres.shapes.RIGHT_ARROW, {
          x: arrowX, y: arrowY, w: arrowW - 0.1, h: 0.24,
          fill: { color: C.SECONDARY }
        });
      }
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + boxH;
    validateBounds(slide, startY + boxH);
  },
};
