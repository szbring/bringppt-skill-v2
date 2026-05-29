'use strict';
// templates/problem-solution.js
// Source: bring-core.js L2671-2754
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'problemSolution',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '问题-解决方案左右分栏对比',

  schema: {
    problems:   { type: 'array', description: '问题列表 string[]' },
    solutions:  { type: 'array', description: '解决方案列表 string[]' },
    leftTitle:  { type: 'string', description: '左侧标题（默认"问题"）' },
    rightTitle: { type: 'string', description: '右侧标题（默认"解决方案"）' },
    startY:     { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '展示问题与对应解决方案，突出改进前后对比',
    notWhen:       '问题与方案没有对应关系或只需单列展示时',
    scenarios: [
          {
                "trigger": "问题-解决方案的左右并列",
                "example": "左侧列出3个核心问题，右侧对应3个解决方案"
          },
          {
                "trigger": "比comparison更聚焦在问题→方案关系时",
                "example": "有明确对应关系的问题和解法，不只是两方对比"
          }
    ],

    typicalHeight: '2.5~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/problem-solution.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const mid = Math.ceil(kps.length / 2);
          return {
            problems:  kps.slice(0, mid).map(kp => splitTitleDesc(kp).title),
            solutions: kps.slice(mid).map(kp => splitTitleDesc(kp).title),
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    const { problems = [], solutions = [], leftTitle, rightTitle, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if ((!Array.isArray(problems) || problems.length === 0) && (!Array.isArray(solutions) || solutions.length === 0)) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'problemSolution', missingField: 'problems[] 和 solutions[]', hint: '需要左右两列字符串数组（problems[] 与 solutions[]）', startY });
    }
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const colW = 4.0, gap = 0.5;
    const lX = baseX, rX = baseX + colW + gap;
    const availH = Math.min(3.5, maxBottom - startY - 0.15); // Reserve bottom margin
    const headerH = 0.4;
    const bodyH = availH - headerH;

    // Left column header (Problem)
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lX, y: startY, w: colW, h: headerH,
      rectRadius: 0.06, fill: { color: C.DANGER }
    });
    slide.addText(leftTitle || "问题", {
      x: lX, y: startY, w: colW, h: headerH,
      fontSize: 14, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Right column header (Solution)
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rX, y: startY, w: colW, h: headerH,
      rectRadius: 0.06, fill: { color: C.SUCCESS }
    });
    slide.addText(rightTitle || "解决方案", {
      x: rX, y: startY, w: colW, h: headerH,
      fontSize: 14, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Left body
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: lX, y: startY + headerH, w: colW, h: bodyH,
      rectRadius: 0.06, fill: { color: C.WARN_BG },
      line: { color: C.DANGER, width: 0.5 }
    });

    // Right body
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rX, y: startY + headerH, w: colW, h: bodyH,
      rectRadius: 0.06, fill: { color: C.BG_LIGHT },
      line: { color: C.SUCCESS, width: 0.5 }
    });

    // Problem items
    const itemH = bodyH / Math.max(problems.length, 1);
    problems.forEach((p, i) => {
      const y = startY + headerH + i * itemH + 0.05;
      const fs = calcFitFontSize(p, colW - 0.5, itemH - 0.1, 12, { minFontSize: 9 });
      slide.addText("✕  " + p, {
        x: lX + 0.15, y, w: colW - 0.3, h: itemH - 0.1,
        fontSize: fs, fontFace: FONTS.primary,
        color: C.DANGER, valign: "middle", margin: 0, lineSpacingMultiple: 1.2
      });
    });

    // Solution items
    const sItemH = bodyH / Math.max(solutions.length, 1);
    solutions.forEach((s, i) => {
      const y = startY + headerH + i * sItemH + 0.05;
      const fs = calcFitFontSize(s, colW - 0.5, sItemH - 0.1, 12, { minFontSize: 9 });
      slide.addText("✓  " + s, {
        x: rX + 0.15, y, w: colW - 0.3, h: sItemH - 0.1,
        fontSize: fs, fontFace: FONTS.primary,
        color: C.SUCCESS, valign: "middle", margin: 0, lineSpacingMultiple: 1.2
      });
    });

    // Center arrow
    slide.addShape(pres.shapes.CHEVRON, {
      x: lX + colW + (gap - 0.3) / 2, y: startY + availH / 2 - 0.15,
      w: 0.3, h: 0.3, fill: { color: C.SECONDARY }
    });

    const bottomY = startY + availH;
    validateBounds(slide, bottomY);
  },
};
