'use strict';
// templates/staircase.js
// Source: bring-core.js L2836-2921
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'staircase',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '阶梯递进图，3-6个步骤从左下到右上递进排列',

  schema: {
    steps:  { type: 'array', description: '[{ label, desc? }]，3-6个步骤' },
    title:  { type: 'string', description: '可选标题' },
    startY: { type: 'number', description: '起始Y坐标（英寸）' },
    h:      { type: 'number', description: '可选：指定总高度' },
  },

  usage: {
    when:          '展示成长、进阶、递进过程',
    notWhen:       '步骤超过6个时',
    scenarios: [
          {
                "trigger": "3-5个阶梯式递进的阶段或层次",
                "example": "能力成熟度阶梯：初级→规范→优化→智能→领先"
          },
          {
                "trigger": "从左下到右上的递进成长感",
                "example": "比processFlow更强调层层上升的视觉感"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/staircase.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const steps = kps.slice(0, 5).map(kp => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            return { label: t, desc: d || '' };
          });
          return { steps, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { steps, title, startY: explicitStartY, h: explicitH } = data;
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(steps.length, 6);

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

  const availH = explicitH || (maxBottom - curY);
  const availW = totalW;
  const stepW = availW / count;
  const stepH = availH / count;

  steps.slice(0, count).forEach((step, i) => {
    const color = STEP_COLORS[i % STEP_COLORS.length];
    // Each step is positioned progressively higher (bottom-left to top-right)
    const x = baseX + i * stepW;
    const y = curY + availH - (i + 1) * stepH;
    const h = (i + 1) * stepH;

    // Step block
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: stepW - 0.05, h,
      rectRadius: 0.06, fill: { color }
    });

    if (h >= 1.2) {
      // Tall step: number + label + desc stacked
      slide.addText(String(i + 1), {
        x, y, w: stepW - 0.05, h: 0.35,
        fontSize: 18, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      const labelFs = calcFitFontSize(step.label, stepW - 0.25, 0.35, 11, { minFontSize: 8 });
      slide.addText(step.label, {
        x: x + 0.05, y: y + 0.35, w: stepW - 0.15, h: 0.35,
        fontSize: labelFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      if (step.desc) {
        const descFs = calcFitFontSize(step.desc, stepW - 0.25, h - 0.8, 9, { minFontSize: 7 });
        slide.addText(step.desc, {
          x: x + 0.05, y: y + 0.75, w: stepW - 0.15, h: h - 0.85,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.WHITE, align: "center", valign: "top", margin: 0, lineSpacingMultiple: 1.2
        });
      }
    } else {
      // Short step: combine number + label + desc in compact layout
      const combined = step.desc ? step.label + "\n" + step.desc : step.label;
      slide.addText(String(i + 1), {
        x, y, w: stepW - 0.05, h: Math.min(0.3, h * 0.35),
        fontSize: 16, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      const textH = h - Math.min(0.3, h * 0.35) - 0.05;
      const textFs = calcFitFontSize(combined, stepW - 0.25, textH, 10, { minFontSize: 7 });
      slide.addText(combined, {
        x: x + 0.05, y: y + Math.min(0.3, h * 0.35), w: stepW - 0.15, h: textH,
        fontSize: textFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, lineSpacingMultiple: 1.2
      });
    }
  });

  const bottomY = curY + availH;
  validateBounds(slide, bottomY);
  },
};
