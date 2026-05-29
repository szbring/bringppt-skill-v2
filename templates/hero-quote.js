'use strict';
// templates/hero-quote.js — 杂志式 hero 引言（满版深色背景 + 大字金句）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'heroQuote',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '杂志式 hero 引言：满版深色背景 + 大字金句 + 巨型引号装饰 + 署名',

  schema: {
    quote:  { type: 'string', required: true, warn: 60, error: 120 },
    author: { type: 'string', warn: 20, error: 35 },
    source: { type: 'string' },
  },

  usage: {
    when:    '提案章节首页或转折点的金句页，需要给客户「停下来思考」的节奏',
    notWhen: '常规引言用 quoteEmphasis / quoteBanner；封底前用 closingQuote',
    typicalHeight: 'full-page',
    scenarios: [
      { trigger: '章节转折金句', example: '"我们不是在解决问题，我们在重塑可能"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hero-quote.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    return {
      quote:  (page && page.quote) || kps[0] || '管理咨询的本质是把复杂留给自己',
      author: (page && page.author) || kps[1] || '',
      source: page && page.source,
    };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, calcFitFontSize } = infra;
    const { quote, author, source } = data;

    // 满版深蓝背景
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 5.63, fill: { color: C.PRIMARY },
    });

    // 巨型左上角引号（金色半透明，装饰）
    slide.addText('“', {
      x: 0.2, y: 0.3, w: 3.0, h: 3.0,
      fontSize: 350, fontFace: FONTS.serifEn, bold: true,
      color: C.ACCENT, transparency: 75,
      valign: 'top', margin: 0,
    });

    // 巨型右下角引号（镜像，金色半透明）
    slide.addText('”', {
      x: 6.8, y: 2.0, w: 3.0, h: 3.0,
      fontSize: 350, fontFace: FONTS.serifEn, bold: true,
      color: C.ACCENT, transparency: 75,
      align: 'right', valign: 'middle', margin: 0,
    });

    // 引言主文（中央大字）
    const quoteFs = calcFitFontSize(quote, 8.0, 2.8, 36, { minFontSize: 22 });
    slide.addText(quote, {
      x: 1.0, y: 1.4, w: 8.0, h: 2.8,
      fontSize: quoteFs, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, italic: true,
      align: 'center', valign: 'middle', lineSpacingMultiple: 1.5, margin: 0,
    });

    // 装饰金线
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.5, y: 4.3, w: 1.0, h: 0.04, fill: { color: C.ACCENT },
    });

    // 署名
    if (author) {
      slide.addText('— ' + author, {
        x: 1.0, y: 4.45, w: 8.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 20,
        align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 出处（底部小字）
    if (source) {
      slide.addText(source, {
        x: 1.0, y: 5.0, w: 8.0, h: 0.3,
        fontSize: 11, fontFace: FONTS.enSmall, italic: true,
        color: C.WHITE, transparency: 50,
        align: 'center', valign: 'middle', margin: 0,
      });
    }
    // v4.1.0: 接力契约 — heroQuote 占满整屏，下游 layout 不应再叠加
    slide._bottomY = slide._contentMaxBottom || 4.85;
  },
};
