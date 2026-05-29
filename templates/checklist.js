'use strict';
// templates/checklist.js
// Source: bring-core.js L3727-3793
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'checklist',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '任务清单，支持1-2列布局，每项含完成状态、标题和描述',

  schema: {
    items:   { type: 'array', description: '[{ title, desc?, done? }]，最多16个' },
    columns: { type: 'number', description: '列数：1或2，默认1' },
    startY:  { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示任务进度、待办清单、检查项',
    notWhen:       '需要复杂甘特图时',
    scenarios: [
          {
                "trigger": "任务清单、核查项、行动清单",
                "example": "变革进度追踪：8个检查点，标注完成/未完成状态"
          },
          {
                "trigger": "行动建议列表，需要勾选感",
                "example": "本周必做清单，强调可执行性和可追踪性"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/checklist.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers.mapKpsToItems 重构（transform 注入 done:false）
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return {
      items: mapKpsToItems(keyPoints, {
        max: 12,
        transform: item => ({ ...item, done: false }),
      }),
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { items = [], columns = 1, startY: explicitStartY } = data;
  // v4.1.8 (修 P2-D): 空数组 → 友好失败卡，不再渲染空白页
  if (!Array.isArray(items) || items.length === 0) {
    const { renderEmptyState } = require('../lib/render-empty-state');
    return renderEmptyState(slide, infra, { template: 'checklist', missingField: 'items[]', hint: '需要至少 1 个 {title, desc?, done?} 检查项', startY: resolveStartY(slide, explicitStartY, 1.0) });
  }
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(items.length, columns === 2 ? 16 : 10);
  const cols = Math.min(columns, 2);
  const colW = cols === 2 ? (totalW - 0.2) / 2 : totalW;
  const itemsPerCol = Math.ceil(count / cols);

  const availH = maxBottom - startY;
  const rowGap = 0.12;
  const rowH = Math.min(0.75, (availH - rowGap * (itemsPerCol - 1)) / itemsPerCol);
  const checkW = 0.35;

  for (let i = 0; i < count; i++) {
    const item = items[i];
    const col = cols === 2 ? Math.floor(i / itemsPerCol) : 0;
    const row = cols === 2 ? i % itemsPerCol : i;
    const x = baseX + col * (colW + 0.2);
    const y = startY + row * (rowH + rowGap);

    // Alternating background
    const bgColor = row % 2 === 0 ? C.BG_LIGHT : C.WHITE;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: colW, h: rowH,
      rectRadius: 0.04, fill: { color: bgColor }
    });

    // Check icon
    const checkColor = item.done ? C.SUCCESS : C.TEXT_LIGHT;
    const checkChar = item.done ? "\u2713" : "\u25CB";
    slide.addText(checkChar, {
      x: x + 0.08, y, w: checkW, h: rowH,
      fontSize: 16, fontFace: FONTS.primary,
      color: checkColor, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Title
    const titleW = item.desc ? (colW - checkW - 0.15) * 0.4 : (colW - checkW - 0.15);
    const titleFs = calcFitFontSize(item.title, titleW, rowH, 12, { minFontSize: 9 });
    slide.addText(item.title, {
      x: x + checkW + 0.08, y, w: titleW, h: rowH,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: item.done ? C.TEXT : C.TEXT, bold: true, valign: "middle", margin: 0
    });

    // Description
    if (item.desc) {
      const descW = (colW - checkW - 0.15) * 0.6;
      const descFs = calcFitFontSize(item.desc, descW, rowH, 10, { minFontSize: 8 });
      slide.addText(item.desc, {
        x: x + checkW + 0.08 + titleW + 0.05, y, w: descW, h: rowH,
        fontSize: descFs, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, valign: "middle", margin: 0
      });
    }
  }

  const usedRows = cols === 2 ? itemsPerCol : count;
  validateBounds(slide, startY + usedRows * (rowH + rowGap) - rowGap);
  },
};
