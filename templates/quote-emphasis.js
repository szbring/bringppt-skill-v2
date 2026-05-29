'use strict';
// templates/quote-emphasis.js
// Source: bring-core.js L1563-1613
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'quoteEmphasis',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '引言强调：大引用块 + 强调要点框，支持作者署名和汇总',

  schema: {
    quote:         { type: 'string', required: true, description: '引用文本', warn: 50, error: 80 },
    author:        { type: 'string', description: '作者/来源（可选）' },
    emphasis:      { type: 'string', required: true, description: '强调内容', warn: 40, error: 65 },
    emphasisSub:   { type: 'string', description: '强调补充内容（可选）', warn: 50, error: 80 },
    summary:       { type: 'string', description: '底部汇总文本（可选）' },
    startY:        { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '名人名言引用、重要结论强调、政策宣言类内容',
    notWhen:       '数据展示、流程说明、对比分析',
    scenarios: [
          {
                "trigger": "重要观点引用+补充解释",
                "example": "大块引用框+下方强调要点，适合学术/研究型报告"
          },
          {
                "trigger": "客户证言+关键结论提炼",
                "example": "'薄云咨询帮我们节省了30%的成本'——客户原话+量化结论"
          }
    ],

    typicalHeight: '2.5~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/quote-emphasis.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  // v3.7.18: quote 限 80 字，emphasis 限 65 字（schema 要求）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const { title: emphasisRaw, desc: sub } = kps[0] ? splitTitleDesc(kps[0]) : { title: title, desc: '' };
    const emphasis = (emphasisRaw || '').slice(0, 60);
    let quote = kps.slice(1).join(' ') || title;
    if (quote.length > 80) quote = quote.slice(0, 80);
          return {
            quote,
            emphasis,
            emphasisSub:     (sub || '').slice(0, 60),
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { quote, author, emphasis, emphasisSub, summary, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 0.9);
    const pW = 8.5, pX = (10 - pW) / 2;
    const qH = author ? 1.8 : 1.4;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: pX, y: startY, w: pW, h: qH, rectRadius: 0.12, fill: { color: C.SECONDARY }, shadow: shadow(),
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: pX + 0.25, y: startY + 0.2, w: 0.05, h: qH - 0.4, fill: { color: C.WHITE, transparency: 50 }
    });
    // v3.9.2: 移除左上角大引号装饰（用户反馈不要 " 符号）
    // v3.7.16: 用 calcFitFontSize 真正按宽高自适应（之前 shrinkText 在 LibreOffice 不生效导致仍越界）
    const qBoxW = pW - 1.0, qBoxH = author ? qH - 0.6 : qH - 0.3;
    const qFs = calcFitFontSize(quote, qBoxW, qBoxH, 16, { minFontSize: 11, lineSpacing: 1.5 });
    slide.addText(quote, {
      x: pX + 0.5, y: startY + 0.15, w: qBoxW, h: qBoxH,
      fontSize: qFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, italic: true, lineSpacingMultiple: 1.5, valign: "middle", margin: 0,
    });
    if (author) {
      slide.addText("\u2014\u2014 " + author, {
        x: pX + 0.5, y: startY + qH - 0.5, w: pW - 1.0, h: 0.35,
        fontSize: 13, fontFace: FONTS.primary, color: C.WHITE, transparency: 25, align: "right", margin: 0
      });
    }
    const eY = startY + qH + 0.25, eH = emphasisSub ? 1.0 : 0.7;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: pX, y: eY, w: pW, h: eH, rectRadius: 0.08, fill: { color: C.WARN_BG }
    });
    slide.addShape(pres.shapes.RECTANGLE, { x: pX, y: eY, w: 0.07, h: eH, fill: { color: C.DANGER } });
    const eFs = calcFitFontSize(emphasis, pW - 0.6, 0.35, 14, { minFontSize: 10 });
    slide.addText(emphasis, {
      x: pX + 0.3, y: eY + 0.1, w: pW - 0.6, h: 0.35,
      fontSize: eFs, fontFace: FONTS.primary, color: C.DANGER, bold: true, margin: 0,
    });
    if (emphasisSub) {
      const eSubFs = calcFitFontSize(emphasisSub, pW - 0.6, 0.4, 12, { minFontSize: 9 });
      slide.addText(emphasisSub, {
        x: pX + 0.3, y: eY + 0.5, w: pW - 0.6, h: 0.4,
        fontSize: eSubFs, fontFace: FONTS.primary, color: C.ACCENT, bold: true, align: "center", margin: 0,
      });
    }
    if (summary) {
      const sY = eY + eH + 0.2;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: pX, y: sY, w: pW, h: 0.42, rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      slide.addText(summary, {
        x: pX, y: sY, w: pW, h: 0.42,
        fontSize: 14, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide._bottomY = sY + 0.42;  // v4.0.6
      validateBounds(slide, sY + 0.42);
    } else {
      slide._bottomY = eY + eH;  // v4.0.6
      validateBounds(slide, eY + eH);
    }
  },
};
