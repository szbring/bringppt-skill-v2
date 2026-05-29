'use strict';
// templates/quote-banner.js
// Source: bring-core.js L703-728
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'quoteBanner',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '引用横幅，圆角矩形背景，支持引用文字和署名',

  schema: {
    quote:   { type: 'string', required: true,  description: '引用文字', warn: 50, error: 80 },
    author:  { type: 'string', required: false, description: '作者/署名' },
    startY:  { type: 'number', required: false },
    h:       { type: 'number', required: false, description: '横幅高度，默认根据是否有作者自动计算' },
    bgColor: { type: 'string', required: false, description: '背景色，默认 C.SECONDARY' },
  },

  usage: {
    when:          '需要突出展示一段重要引用、核心观点或名言时',
    notWhen:       '内容是列表或数据时',
    scenarios: [
          {
                "trigger": "一句话引用，配作者/来源",
                "example": "'没有感知的管理是伪管理' — Peter Drucker"
          },
          {
                "trigger": "页面中间插入金句，节奏停顿",
                "example": "正文讲完后插入一条相关名言，增加说服力"
          }
    ],

    typicalHeight: '约 0.8~1.4 英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/quote-banner.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    return { quote: kps[0] || title, author: page.author || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { quote, author, startY, h: explicitH, bgColor = C.SECONDARY } = data;

    // v4.1.6: 不超过 _layoutBottom — bannerH 自适应可用空间
    const maxBottomGuard = (typeof slide._layoutBottom === 'number') ? slide._layoutBottom : 4.85;
    let effectiveStartY = resolveStartY(slide, startY, 0.9);
    const bannerW = 8.5;
    let bannerH = explicitH || (author ? 1.4 : 0.8);
    // 钳制 bannerH，让 effectiveStartY + bannerH ≤ maxBottomGuard
    if (effectiveStartY + bannerH > maxBottomGuard) {
      // 优先收缩 bannerH（最小 0.6），再向上抬 startY
      bannerH = Math.max(0.6, maxBottomGuard - effectiveStartY);
      if (effectiveStartY + bannerH > maxBottomGuard) {
        effectiveStartY = Math.max(0.9, maxBottomGuard - bannerH);
      }
    }
    const startX = (10 - bannerW) / 2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: startX, y: effectiveStartY, w: bannerW, h: bannerH,
      rectRadius: 0.1, fill: { color: bgColor }
    });
    const quoteH = author ? bannerH - 0.5 : bannerH - 0.2;
    const quoteFs = calcFitFontSize(quote, bannerW - 0.8, quoteH, 18, { minFontSize: 12 });
    slide.addText(quote, {
      x: startX + 0.4, y: effectiveStartY + 0.1, w: bannerW - 0.8, h: quoteH,
      fontSize: quoteFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, italic: true,
      valign: "middle", lineSpacingMultiple: 1.4, margin: 0, autoFit: true
    });
    if (author) {
      slide.addText("\u2014\u2014 " + author, {
        x: startX + 0.4, y: effectiveStartY + bannerH - 0.45, w: bannerW - 0.8, h: 0.35,
        fontSize: 13, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 25, align: "right", margin: 0
      });
    }
    const finalBottom = Math.min(effectiveStartY + bannerH, maxBottomGuard);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'quoteBanner');
  },
};
