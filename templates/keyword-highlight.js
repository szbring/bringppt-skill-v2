'use strict';
// templates/keyword-highlight.js
// v3.2.6 — 关键词高亮 + 描边（pptxgenjs TextProps.highlight / outline 包装）

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'keywordHighlight',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '段落文字，对关键词应用底色高亮和/或描边，强调重要术语、警示或核心观点',

  schema: {
    text: {
      type: 'array',
      required: true,
      description: '文本片段数组：每项 { content: string, highlight?: hex, outline?: { color, size }, bold?: bool, color?: hex }；普通片段只填 content',
    },
    title:     { type: 'string', required: false, description: '小标题' },
    startY:    { type: 'number', required: false, description: '起始 Y 坐标' },
    fontSize:  { type: 'number', default: 18,  description: '正文字号' },
    align:     { type: 'string', default: 'left', description: 'left | center | right' },
    paragraphHeight: { type: 'number', default: 2.0, description: '段落区域高度' },
  },

  usage: {
    when:          '需要强调段落中的关键词、术语或警示语；让读者一眼看到重点',
    notWhen:       '通篇都需要"重点"——会失去强调效果；超过 30% 文字带高亮时',
    typicalHeight: '2.0~2.8 英寸',
    scenarios: [
      { trigger: '核心结论段落，强调 2-3 个关键词', example: '"在 6 个月内将 AI 落地率从 12% 提升到 65%——这背后的关键是 流程重构 + 知识沉淀。"（"流程重构"+"知识沉淀"高亮）' },
      { trigger: '术语解释段落，加粗 + 高亮专有名词', example: '介绍新概念时，专有名词背景高亮 黄色 / 描边强调' },
      { trigger: '风险警示段落，关键词红色描边', example: '"以下三点 严禁 触碰：..."（"严禁"加红色描边）' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/keyword-highlight.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    // v4.1.0 (P0-3 色板硬编码归零): 通过 require 拿到 C，highlight 用 C.ACCENT 替代裸 'FFFF00'
    const { C } = require('../lib/infra');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    // 整段拼接：前 1 个为正文，后续 keyPoint 作为高亮关键词插在末尾
          const text = [{ content: kps.slice(0, 1).join('') || title }];
          kps.slice(1).forEach(kw => {
            text.push({ content: ' / ' });
            text.push({ content: kw, highlight: C.ACCENT, bold: true });
          });
          return { text, title };
  },



  render(pres, slide, data, infra) {
    const { C, validateBounds, FONTS } = infra;
    const { text = [], title, startY, fontSize = 18, align = 'left' } = data;
    // v4.1.6: 守护框 + paragraphHeight 自适应
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (startY != null) ? startY : box.top;
    const maxBottom = box.bottom;
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.50 : 0;
    // 段落高度：用户传 paragraphHeight 则严格执行（但不超 available），否则用全可用区
    const userParaH = data.paragraphHeight;
    const available = maxBottom - top - titleH;
    const paragraphHeight = userParaH != null
      ? Math.min(userParaH, available)
      : Math.min(2.4, available);
    // 纵向居中：标题 + 段落总高
    const contentH = titleH + paragraphHeight;
    const sy = top + Math.max(0, (maxBottom - top - contentH) / 2);
    let curY = sy;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.75, y: sy, w: 8.5, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + titleH;
    }

    // 把 text 数组转成 pptxgenjs text runs 格式
    const runs = text.map(seg => {
      const opts = {
        fontSize,
        fontFace: FONTS.primary,
        color: seg.color || C.TEXT,
      };
      if (seg.bold)      opts.bold = true;
      if (seg.italic)    opts.italic = true;
      if (seg.underline) opts.underline = { style: 'sng' };
      if (seg.highlight) opts.highlight = seg.highlight;       // 文字背景高亮（hex）
      if (seg.outline)   opts.outline = seg.outline;            // 文字描边 { color, size }
      return { text: seg.content, options: opts };
    });

    slide.addText(runs, {
      x: 0.75, y: curY, w: 8.5, h: paragraphHeight,
      align, valign: 'top',
      lineSpacingMultiple: 1.6,
      margin: 0,
    });

    // v4.1.6: 钳制到 maxBottom
    const finalBottom = Math.min(curY + paragraphHeight, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'keywordHighlight');
  },
};
