'use strict';
// templates/timeline.js
// Source: bring-core.js L899-936
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'timeline',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '时间轴布局，横向排列事件节点，带连接线、年份标签和描述',

  schema: {
    events:  { type: 'array', required: true, description: '事件数组，每项含 year、title、desc?', item: { title: { type: 'string', warn: 12, error: 20 }, desc: { type: 'string', warn: 25, error: 40 } } },
    startY:  { type: 'number', required: false },
  },

  usage: {
    when:          '展示历史沿革、发展里程碑、时间顺序事件时',
    notWhen:       '事件超过6个或需要详细内容时',
    scenarios: [
          {
                "trigger": "关键历史节点或里程碑时间线",
                "example": "公司发展史：2015创立→2018融资→2021上市→2024转型"
          },
          {
                "trigger": "项目关键节点展示",
                "example": "不需要精确时间条的节点式时间轴，适合里程碑汇报"
          }
    ],

    typicalHeight: '约 2.4 英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/timeline.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: keyPoints 适配器
  // v3.7.25: 用 adapter-helpers.mapKpsToItems 重构（保留 year 字段注入）
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    const events = mapKpsToItems(keyPoints, {
      max: 6,
      transform: (item, i) => ({ year: `阶段 ${i + 1}`, ...item }),
    });
    return { events };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { events, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.5);
    const count = events.length;
    const totalW = 8.5;
    const startX = (10 - totalW) / 2;
    const segW = totalW / count;
    slide.addShape(pres.shapes.LINE, {
      x: startX, y: startY + 0.6, w: totalW, h: 0,
      line: { color: C.SECONDARY, width: 2 }
    });
    events.forEach((evt, i) => {
      const x = startX + i * segW;
      const color = STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.OVAL, {
        x: x + segW / 2 - 0.15, y: startY + 0.45, w: 0.3, h: 0.3,
        fill: { color }
      });
      slide.addText(evt.year, {
        x, y: startY - 0.1, w: segW, h: 0.4,
        fontSize: 14, fontFace: FONTS.primary,
        color, bold: true, align: "center", margin: 0
      });
      slide.addText(evt.title, {
        x, y: startY + 1.0, w: segW, h: 0.4,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.TEXT, bold: true, align: "center", margin: 0
      });
      if (evt.desc) {
        slide.addText(evt.desc, {
          x: x + 0.1, y: startY + 1.4, w: segW - 0.2, h: 1.0,
          fontSize: 11, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: "center", lineSpacingMultiple: 1.3, margin: 0
        });
      }
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + 2.4;
    validateBounds(slide, startY + 2.4);
  },
};
