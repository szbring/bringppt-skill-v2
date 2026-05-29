'use strict';
// templates/wave-progression.js
// Source: bring-core.js L3794-3859
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'waveProgression',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '波浪递进图，3-5个步骤从左下到右上波浪形排列',

  schema: {
    waves:  { type: 'array', description: '[{ title, desc? }]，3-5个' },
    startY: { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示递进发展、阶段升级过程',
    notWhen:       '步骤超过5个时',
    scenarios: [
          {
                "trigger": "3-5个阶段的递进成长过程",
                "example": "从初级→中级→高级→专家的能力成长路径，波浪形上升感"
          },
          {
                "trigger": "比staircase更流畅柔和的递进",
                "example": "转型阶段的曲线发展，不是硬台阶式跳跃"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/wave-progression.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers.mapKpsToItems 重构
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { waves: mapKpsToItems(keyPoints, { max: 5 }) };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { waves = [], startY: explicitStartY } = data;
  // v4.1.6: 守护框
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(waves.length, 5);
  // wave 自身高度 = 可用区全部（已是矩形，没法再缩），但居中：实际就让 startY=top
  const startY = top;
  const availH = maxBottom - startY;

  // Each wave is a wide rounded rectangle, ascending left-to-right
  const waveW = totalW / count + 0.3; // slightly overlapping
  const stepX = (totalW - waveW) / Math.max(count - 1, 1);
  const waveH = availH * 0.45;
  const risePerStep = (availH - waveH - 0.3) / Math.max(count - 1, 1);

  // Color gradient from dark to light
  const waveColors = [C.PRIMARY, C.SECONDARY, C.BLUE_LIGHT, C.ACCENT, C.SUCCESS];

  waves.slice(0, count).forEach((wave, i) => {
    const x = baseX + i * stepX;
    const y = startY + availH - waveH - i * risePerStep;
    const color = waveColors[i % waveColors.length];

    // Wave body (rounded rectangle to simulate arc)
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: waveW, h: waveH,
      rectRadius: 0.2, fill: { color },
      shadow: shadow()
    });

    // Number
    slide.addText(String(i + 1), {
      x: x + 0.15, y: y + 0.1, w: 0.4, h: 0.4,
      fontSize: 22, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Use visible width (not covered by next wave) for text placement
    const textW = (i < count - 1) ? Math.max(stepX - 0.2, 1.0) : waveW - 0.7;

    // Title
    const titleFs = calcFitFontSize(wave.title, textW - 0.35, 0.35, 14, { minFontSize: 9 });
    slide.addText(wave.title, {
      x: x + 0.55, y: y + 0.1, w: textW - 0.35, h: 0.35,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, valign: "middle", margin: 0
    });

    // Description
    if (wave.desc) {
      const descH = waveH - 0.55;
      const descFs = calcFitFontSize(wave.desc, textW, descH, 11, { minFontSize: 8 });
      slide.addText(wave.desc, {
        x: x + 0.2, y: y + 0.5, w: textW, h: descH,
        fontSize: descFs, fontFace: FONTS.primary,
        color: C.WHITE, valign: "top", lineSpacingMultiple: 1.2, margin: 0
      });
    }
  });

  slide._bottomY = maxBottom;
  validateBounds(slide, maxBottom);
  },
};
