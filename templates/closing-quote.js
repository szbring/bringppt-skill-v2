'use strict';
// templates/closing-quote.js
// v3.7.0 — 收尾金句页（配对 backCoverSlide 形成 "金句 + 致谢" 两页式封底）

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:           'closingQuote',
  version:        '1.0.0',
  category:       '页面模板',
  description:    '收尾金句页（封底前一页）：大字金句 + 小字署名/出处，构成 "金句 + THANK YOU" 两页式专业封底',
  isPageTemplate: true,

  schema: {
    quote:    { type: 'string', required: true,  description: '金句正文（建议 20-60 字）' },
    author:   { type: 'string', required: false, description: '署名/作者（如 "—— 彼得·德鲁克"）' },
    source:   { type: 'string', required: false, description: '出处/补充（如 "《管理实践》, 1954"）' },
    label:    { type: 'string', required: false, description: '左上角小标签（如 "结语"、"核心洞察"、"留给客户一句话"）' },
    labelEn:  { type: 'string', required: false, description: '左上角英文标签（如 "CLOSING THOUGHT"）' },
    style:    { type: 'string', required: false, description: '"darkBlue"（默认深蓝大字）/ "lightCard"（浅灰背景 + 蓝字卡）' },
  },

  usage: {
    when:    '演示结尾的金句页，配合后续 backCoverSlide 形成两页式封底；适用于提案、咨询报告、培训课件',
    notWhen: '内容页或中间引用（用 quoteEmphasis / quoteBanner）；只有一页封底（直接用 backCoverSlide）',
    scenarios: [
      { trigger: 'PPT 收尾留给客户一句话', example: '"AI 不是替代顾问，而是让每位顾问拥有 10 倍杠杆"' },
      { trigger: '汇报结束前的核心洞察', example: '"未来的竞争，不是公司之间，而是生态之间"' },
      { trigger: '名人金句结尾增信', example: '"做正确的事比正确地做事更重要——彼得·德鲁克"' },
    ],
    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/closing-quote.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const { title: quote, desc: author } = splitTitleDesc(kps[0] || '');
    return {
      quote:  (page && page.quote) || quote || (page && page.title) || '',
      author: (page && page.author) || author || '',
      source: (page && page.source) || '',
    };
  },



  render(pres, data, infra) {
    const { C, FONTS } = infra;
    const { quote, author, source, label, labelEn, style = 'darkBlue' } = data;
    if (!quote) return;

    const slide = pres.addSlide();

    // ─── style: lightCard ─ 浅灰底 + 中央蓝色卡片 + 金句白字 ────────
    if (style === 'lightCard') {
      slide.background = { color: C.BG_PANEL };

      // 中央蓝色卡片
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.8, y: 1.2, w: 8.4, h: 3.2,
        fill: { color: C.PRIMARY },
        line: { color: C.PRIMARY, width: 0 },
      });

      // 左上小标签（label + labelEn）
      if (label || labelEn) {
        slide.addText([
          ...(label ? [{ text: label, options: { fontSize: 14, fontFace: FONTS.primary, bold: true, color: C.WHITE } }] : []),
          ...(labelEn ? [{ text: '  ' + labelEn, options: { fontSize: 11, fontFace: FONTS.enSmall, color: C.WHITE, transparency: 25 } }] : []),
        ], { x: 1.1, y: 1.45, w: 7.8, h: 0.4, margin: 0 });
      }

      // 金句大字 — v3.7.15: 去掉包裹的英文双引号
      slide.addText(quote, {
        x: 1.1, y: 1.9, w: 7.8, h: 1.7,
        fontSize: 28, fontFace: FONTS.primary, bold: false, italic: true,
        color: C.WHITE,
        align: 'center', valign: 'middle',
        lineSpacingMultiple: 1.4, margin: 0,
      });

      // 署名 + 出处
      if (author || source) {
        const parts = [];
        if (author) parts.push('—— ' + author);
        if (source) parts.push(source);
        slide.addText(parts.join('   ·   '), {
          x: 1.1, y: 3.75, w: 7.8, h: 0.4,
          fontSize: 13, fontFace: FONTS.primary,
          color: C.WHITE, transparency: 25,
          align: 'right', valign: 'middle', margin: 0,
        });
      }
      return slide;
    }

    // ─── style: darkBlue (默认) ─ 深蓝底 + 居中大字金句 ───────────
    // v3.7.1 修复：去掉 Georgia 字体 + autoFit 组合（LibreOffice 渲染会丢失正文）
    slide.background = { color: C.PRIMARY };

    // 左上小标签
    if (label || labelEn) {
      slide.addText([
        ...(label ? [{ text: label, options: { fontSize: 16, fontFace: FONTS.primary, bold: true, color: C.WHITE } }] : []),
        ...(labelEn ? [{ text: '  ' + labelEn, options: { fontSize: 12, fontFace: FONTS.primary, color: C.WHITE, transparency: 25 } }] : []),
      ], { x: 0.6, y: 0.6, w: 8.8, h: 0.4, margin: 0 });
    }

    // v3.9.1: 用户反馈移除左上角短金线 — 金句页保持极简

    // v3.7.16: 去掉左侧大引号装饰（用户反馈金句页不要 "）

    // 根据金句长度自动选字号（避免 autoFit 在 LibreOffice 渲染异常）
    const quoteLen = (quote || '').length;
    const quoteFontSize =
      quoteLen <= 18 ? 36 :
      quoteLen <= 30 ? 30 :
      quoteLen <= 45 ? 26 :
      quoteLen <= 60 ? 22 : 18;

    // 金句正文 —— 居中大字（不用 autoFit + 不用 Georgia，固定字号确保渲染）
    slide.addText(quote, {
      x: 0.8, y: 1.7, w: 8.4, h: 2.4,
      fontSize: quoteFontSize, fontFace: FONTS.primary, bold: true,
      color: C.WHITE,
      align: 'center', valign: 'middle',
      lineSpacingMultiple: 1.4, margin: 0,
    });

    // 署名 + 出处
    if (author || source) {
      const parts = [];
      if (author) parts.push('—— ' + author);
      if (source) parts.push(source);
      slide.addText(parts.join('   ·   '), {
        x: 0.8, y: 4.25, w: 8.4, h: 0.4,
        fontSize: 15, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 20,
        align: 'right', valign: 'middle', margin: 0,
      });
    }

    // v3.7.38: 移除底部装饰线（用户反馈结束语下不要短线）

    return slide;
  },
};
