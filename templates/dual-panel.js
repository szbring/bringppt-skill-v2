'use strict';
// templates/dual-panel.js
// Source: bring-core.js L1478-1562
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'dualPanel',
  version:     '1.0.0',
  category:    '图文/复合型',
  description: '双面板：左侧对比转换项目 + 右侧编号卡片，支持汇总栏',

  schema: {
    leftTitle:   { type: 'string', required: true, description: '左侧面板标题' },
    leftItems:   { type: 'array',  required: true, description: '左侧对比项 [{from, to}]', item: { from: { type: 'string', warn: 25, error: 40 }, to: { type: 'string', warn: 25, error: 40 } } },
    rightTitle:  { type: 'string', required: true, description: '右侧面板标题' },
    rightItems:  { type: 'array',  required: true, description: '右侧卡片项 [{number, title, desc}]', item: { title: { type: 'string', warn: 25, error: 40 }, desc: { type: 'string', warn: 25, error: 40 } } },
    summary:     { type: 'string', description: '底部汇总文本（可选）', warn: 50, error: 80 },
    startY:      { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '转变对比 + 执行步骤并排展示、改革前后行动方案',
    notWhen:       '单一内容展示、时间线、图片画廊',
    scenarios: [
          {
                "trigger": "左侧旧→新对比条目，右侧具体行动步骤",
                "example": "左：从功能型到集成型供应链的转变（6项变化），右：具体实施步骤"
          },
          {
                "trigger": "变革前后+执行方案同一页呈现",
                "example": "比beforeAfter更适合：需要在对比后紧接行动清单的场合"
          }
    ],

    typicalHeight: '3.0~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/dual-panel.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.17: schema 期望 leftItems[].{from,to} + rightItems[].{number,title,desc}
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const mid = Math.ceil(kps.length / 2);
    const leftItems = kps.slice(0, mid).map(kp => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { from: t || kp, to: d || t };
    });
    const rightItems = kps.slice(mid).map((kp, i) => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { number: String(i + 1).padStart(2, '0'), title: t || kp, desc: d || '' };
    });
    return {
      leftTitle:  (page && page.leftTitle)  || '核心要点',
      leftItems,
      rightTitle: (page && page.rightTitle) || '延伸说明',
      rightItems,
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    const { leftTitle, leftItems = [], rightTitle, rightItems = [], summary, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.2);
    if ((!Array.isArray(leftItems) || leftItems.length === 0) && (!Array.isArray(rightItems) || rightItems.length === 0)) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'dualPanel', missingField: 'leftItems[] 与 rightItems[]', hint: '需要左右两列要点字符串数组', startY });
    }
    const maxBottom = slide._contentMaxBottom || 4.85;
    const pW = 4.0, gap = 0.5;
    const lX = (10 - pW * 2 - gap) / 2, rX = lX + pW + gap;
    const titleH = 0.55;
    const summarySpace = summary ? 0.62 : 0;
    const availH = maxBottom - startY - titleH - summarySpace;
    const leftSpacing = Math.min(0.75, availH / leftItems.length);
    const rightSpacing = Math.min(0.95, availH / rightItems.length);
    const rightCardH = rightSpacing - 0.1;

    slide.addText(leftTitle, {
      x: lX, y: startY, w: pW, h: 0.4,
      fontSize: 16, fontFace: FONTS.primary, color: C.TEXT, bold: true, align: "center", margin: 0
    });
    const bW = 1.5, bH = Math.min(0.5, leftSpacing - 0.15);
    leftItems.forEach((item, i) => {
      const y = startY + titleH + i * leftSpacing;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX + 0.1, y, w: bW, h: bH, rectRadius: 0.08, fill: { color: C.PRIMARY }
      });
      slide.addText(item.from, {
        x: lX + 0.1, y, w: bW, h: bH,
        fontSize: 11, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, shrinkText: true
      });
      const mid = lX + pW / 2;
      slide.addShape(pres.shapes.RIGHT_ARROW, {
        x: mid - 0.28, y: y + bH / 2 - 0.08, w: 0.26, h: 0.16, fill: { color: C.SECONDARY }
      });
      slide.addShape(pres.shapes.RIGHT_ARROW, {
        x: mid + 0.02, y: y + bH / 2 - 0.08, w: 0.26, h: 0.16, fill: { color: C.ACCENT }, rotate: 180
      });
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX + pW - bW - 0.1, y, w: bW, h: bH, rectRadius: 0.08, fill: { color: C.ACCENT }
      });
      slide.addText(item.to, {
        x: lX + pW - bW - 0.1, y, w: bW, h: bH,
        fontSize: 11, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, shrinkText: true
      });
    });
    slide.addText(rightTitle, {
      x: rX, y: startY, w: pW, h: 0.4,
      fontSize: 16, fontFace: FONTS.primary, color: C.TEXT, bold: true, align: "center", margin: 0
    });
    const iColors = [C.PRIMARY, C.SECONDARY, C.ACCENT];
    rightItems.forEach((item, i) => {
      const y = startY + titleH + i * rightSpacing;
      const c = iColors[i % iColors.length];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: rX, y, w: pW, h: rightCardH, rectRadius: 0.06, fill: { color: C.BG_LIGHT }
      });
      slide.addShape(pres.shapes.OVAL, { x: rX + 0.15, y: y + 0.15, w: 0.45, h: 0.45, fill: { color: c } });
      slide.addText(String(item.number).padStart(2, "0"), {
        x: rX + 0.15, y: y + 0.15, w: 0.45, h: 0.45,
        fontSize: 13, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide.addText(item.title, {
        x: rX + 0.75, y: y + 0.08, w: pW - 0.95, h: 0.35,
        fontSize: 15, fontFace: FONTS.primary, color: C.TEXT, bold: true, margin: 0
      });
      if (item.desc) {
        slide.addText(item.desc, {
          x: rX + 0.75, y: y + 0.42, w: pW - 0.95, h: rightCardH - 0.5,
          fontSize: 11, fontFace: FONTS.primary, color: C.TEXT_LIGHT, lineSpacingMultiple: 1.2, margin: 0
        });
      }
    });
    if (summary) {
      const contentH = Math.max(leftItems.length * leftSpacing, rightItems.length * rightSpacing);
      const sumY = Math.min(startY + titleH + contentH + 0.2, maxBottom - 0.42);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX, y: sumY, w: pW * 2 + gap, h: 0.42, rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      slide.addText(summary, {
        x: lX, y: sumY, w: pW * 2 + gap, h: 0.42,
        fontSize: 11, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, shrinkText: true
      });
      slide._bottomY = sumY + 0.42;  // v4.0.6
      validateBounds(slide, sumY + 0.42);
    } else {
      const contentH = Math.max(leftItems.length * leftSpacing, rightItems.length * rightSpacing);
      slide._bottomY = startY + titleH + contentH;  // v4.0.6
      validateBounds(slide, startY + titleH + contentH);
    }
  },
};
