'use strict';
// templates/hero-closing.js — 戏剧化结尾页（call-to-action / 行动呼吁）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'heroClosing',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '戏剧化结尾页：上下两层呼吁——核心结论横幅 + 下一步行动 + 联系方式',

  schema: {
    headline: { type: 'string', required: true, warn: 30, error: 60 },
    subline:  { type: 'string', warn: 50, error: 100 },
    cta:      { type: 'array', max: 3, item: { type: 'string', warn: 25, error: 40 } },
    contact:  { type: 'string', warn: 30, error: 50 },
  },

  usage: {
    when:    '提案最后一页 / 关键章节结尾，需要客户做明确行动决策',
    notWhen: '常规收尾用 closingQuote',
    typicalHeight: 'full-page',
    scenarios: [
      { trigger: '客户提案要明确下一步', example: '"立即启动 P1 试点：本周内确认 3 家试点门店"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hero-closing.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    return {
      headline: (page && page.title) || kps[0] || '下一步行动',
      subline:  page && page.subline,
      cta:      kps.slice(1, 4),
      contact:  page && page.contact,
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, calcFitFontSize, shadow } = infra;
    const { subline, cta = [], contact } = data;
    // v4.1.6: 守护框
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85 };
    const maxBottom = box.bottom;

    // v3.7.36: 不再渲染自身 headline 横幅——contentSlide 头部已展示 page.title
    if (subline) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.4, y: 1.15, w: 9.2, h: 0.06, fill: { color: C.ACCENT },
      });
      slide.addText(subline, {
        x: 0.5, y: 1.3, w: 9.0, h: 0.7,
        fontSize: 18, fontFace: FONTS.primary, italic: true,
        color: C.TEXT, valign: 'top', lineSpacingMultiple: 1.4, margin: 0,
      });
    }

    // CTA 3 个行动卡 — cardH 自适应 _layoutBottom
    if (cta.length) {
      const n = Math.min(cta.length, 3);
      const gap = 0.3;
      const cardW = (9.0 - gap * (n - 1)) / n;
      const cardY = subline ? 2.2 : 1.4;
      // 钳制 cardH，让 cardY + cardH ≤ maxBottom
      const cardH = Math.max(1.2, Math.min(2.4, maxBottom - cardY - 0.05));
      cta.slice(0, n).forEach((c, i) => {
        const x = 0.5 + i * (cardW + gap);
        const color = STEP_COLORS[i % STEP_COLORS.length];
        // 顶部色带
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y: cardY, w: cardW, h: 0.08, fill: { color },
        });
        // 卡片本体
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x, y: cardY, w: cardW, h: cardH, rectRadius: 0.08,
          fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
        });
        // 大字编号 + 行动
        slide.addText(String(i + 1).padStart(2, '0'), {
          x: x + 0.15, y: cardY + 0.15, w: 0.7, h: 0.5,
          fontSize: 28, fontFace: FONTS.numeric, bold: true,
          color, valign: 'top', margin: 0,
        });
        slide.addText(c, {
          x: x + 0.15, y: cardY + 0.7, w: cardW - 0.3, h: cardH - 0.8,
          fontSize: 13, fontFace: FONTS.primary, bold: true,
          color: C.TEXT, valign: 'top', lineSpacingMultiple: 1.4, margin: 0,
        });
      });
    }

    // v4.1.6: _bottomY 钳制
    {
      const cardY = subline ? 2.2 : 1.4;
      const cardH = Math.max(1.2, Math.min(2.4, maxBottom - cardY - 0.05));
      slide._bottomY = Math.min(cta.length ? cardY + cardH : (subline ? 2.0 : 1.4), maxBottom);
    }
  },
};
