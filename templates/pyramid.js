'use strict';
// templates/pyramid.js
// Source: bring-core.js L1184-1218
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'pyramid',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '金字塔层级结构，从顶到底宽度递增，适合展示层次关系或优先级',

  schema: {
    levels: { type: 'array',  required: true,  description: '层级数组，从顶到底，每项含 title、desc?', item: { title: { type: 'string', warn: 12, error: 20 }, desc: { type: 'string', warn: 30, error: 50 } } },
    startY: { type: 'number', required: false },
  },

  usage: {
    when:          '展示层次结构、优先级金字塔、组织架构等有上下级关系的内容',
    notWhen:       '层级超过6层或各层内容差异很大时',
    scenarios: [
          {
                "trigger": "需求层次、价值层级、优先级金字塔",
                "example": "马斯洛需求层次、产品价值金字塔（基础→核心→差异化）"
          },
          {
                "trigger": "重要性从底到顶递增的层级结构",
                "example": "战略执行金字塔：操作→流程→能力→战略"
          },
          {
                "trigger": "比layeredList更强调层级视觉感时",
                "example": "底宽顶窄的层次关系，强调越往上越少越重要"
          }
    ],

    typicalHeight: '约 3.6 英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/pyramid.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers.mapKpsToItems 重构（reverse 让顶部最重要）
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { levels: mapKpsToItems(keyPoints, { max: 5 }).reverse() };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { levels, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const count = levels.length;
    const gap = 0.12;
    const totalH = Math.min(3.6, maxBottom - startY - Math.max(0, count - 2) * gap);
    const layerH = totalH / count;
    const maxW = 8.5, minW = 4.0;
    const startXCenter = 5.0;
    levels.forEach((level, i) => {
      const color = STEP_COLORS[i % STEP_COLORS.length];
      const ratio = i / (count - 1 || 1);
      const w = minW + (maxW - minW) * ratio;
      const x = startXCenter - w / 2;
      const y = startY + i * (layerH + gap);
      const h = layerH - gap;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h, rectRadius: 0.06, fill: { color }
      });
      slide.addText(level.title, {
        x: x + 0.3, y, w: 1.5, h,
        fontSize: 15, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, valign: "middle", margin: 0
      });
      if (level.desc) {
        slide.addText(level.desc, {
          x: x + 1.8, y, w: w - 2.1, h,
          fontSize: 12, fontFace: FONTS.primary,
          color: C.WHITE, transparency: 15, valign: "middle", margin: 0
        });
      }
    });
    // 最后一层不应再加 gap（之前把多算的 gap 误报为溢出）
    validateBounds(slide, startY + count * layerH + (count - 1) * gap, 'pyramid');
  },
};
