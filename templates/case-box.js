'use strict';
// templates/case-box.js
// Source: bring-core.js L729-750
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'caseBox',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '案例框，左侧强调色竖条，含标题和内容，适合展示案例或补充说明',

  schema: {
    title:   { type: 'string', required: true,  description: '案例标题', warn: 15, error: 25 },
    content: { type: 'string', required: true,  description: '案例内容', warn: 100, error: 150 },
    startX:  { type: 'number', required: false, description: '左起点，默认 0.75' },
    startY:  { type: 'number', required: false },
    w:       { type: 'number', required: false, description: '宽度，默认 8.5' },
    h:       { type: 'number', required: false, description: '高度，默认 1.2' },
  },

  usage: {
    when:          '需要展示典型案例、补充说明或注意事项时',
    notWhen:       '作为主要内容区域使用时，适合作为辅助说明框',
    scenarios: [
          {
                "trigger": "侧边强调框，案例补充说明",
                "example": "正文右侧或下方的辅助案例框，左边有强调竖条"
          },
          {
                "trigger": "注意：不适合作为全页主内容",
                "example": "caseBox高度默认1.2英寸，全页用会大量留白，改用iconList"
          }
    ],

    typicalHeight: '约 1.2~2.0 英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/case-box.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.18: content ≤ 150 字（schema），startY 必填
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    let content = kps.join('；');
    if (content.length > 140) content = content.slice(0, 140);
    return {
      title:   (page && page.caseTitle) || (page && page.title) || '案例',
      content,
      startY:  (page && page.startY) || 1.0,
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { title, content, startX = 0.75, startY, w = 8.5 } = data;

    // v4.1.7 (修 P1-3): 守护框 + 居中（caseBox 默认 startY=3.5 写死 → 后方 1.5" 空白）
    const box = (infra.getLayoutBox) ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._layoutBottom || 4.85 };
    // v4.1.8 (修 P1-D): 当 caseBox 占整页主区且未显式指定 h 时，自动撑高吃掉空白
    //   规则：未给 h → 使用 available × 0.85（最低 1.2"）。这样：
    //   - 单 layout 整页用：直接铺满
    //   - 与 banner 同页 (_bottomY 已设)：按 banner 之下剩余区铺满
    const available = box.bottom - box.top;
    const defaultH = Math.max(1.2, available * 0.85);
    const h = (data.h != null) ? data.h : defaultH;
    const effectiveStartY = (startY != null || slide._bottomY)
      ? resolveStartY(slide, startY, box.top)
      : box.top + Math.max(0, (available - h) / 2);
    slide.addShape(pres.shapes.RECTANGLE, {
      x: startX, y: effectiveStartY, w, h, fill: { color: C.CASE_BG }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: startX, y: effectiveStartY, w: 0.07, h, fill: { color: C.ACCENT }
    });
    slide.addText(title, {
      x: startX + 0.2, y: effectiveStartY + 0.1, w: w - 0.4, h: 0.35,
      fontSize: 15, fontFace: FONTS.primary,
      color: C.ACCENT, bold: true, margin: 0
    });
    const caseContentFs = calcFitFontSize(content, w - 0.4, h - 0.55, 12, { minFontSize: 9, lineSpacing: 1.35 });
    slide.addText(content, {
      x: startX + 0.2, y: effectiveStartY + 0.45, w: w - 0.4, h: h - 0.55,
      fontSize: caseContentFs, fontFace: FONTS.primary,
      color: C.TEXT, lineSpacingMultiple: 1.35, margin: 0, autoFit: true
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = effectiveStartY + h;
    validateBounds(slide, effectiveStartY + h);
  },
};
