'use strict';
// templates/scqa-narrative.js
// v3.7.0 — SCQA 叙事框架（Situation–Complication–Question–Answer）
// 公开方法论：芭芭拉·明托《金字塔原理》中的开场叙事结构

const path = require('path');
const fs   = require('fs');

const SCQA_DEFS = [
  { key: 'S', name: '情境', en: 'Situation',    color: 'BLUE_PALE',   desc: '读者熟悉的、不容置疑的事实背景' },
  { key: 'C', name: '冲突', en: 'Complication', color: 'BLUE_LIGHT',  desc: '打破现状的变化、矛盾或挑战' },
  { key: 'Q', name: '疑问', en: 'Question',     color: 'SECONDARY',   desc: '由冲突引发的核心问题' },
  { key: 'A', name: '回答', en: 'Answer',       color: 'PRIMARY',     desc: '本次汇报的核心论点（金字塔之尖）' },
];

module.exports = {
  name:        'scqaNarrative',
  version:     '1.0.0',
  category:    '咨询框架',
  description: 'SCQA 开场叙事框架（情境-冲突-疑问-回答）：金字塔原理的标准开篇结构',

  schema: {
    situation:    { type: 'string', required: true,  description: '情境（读者熟悉的背景，建议 30-80 字）' },
    complication: { type: 'string', required: true,  description: '冲突（打破现状的变化或挑战，30-80 字）' },
    question:     { type: 'string', required: true,  description: '疑问（核心问题，20-50 字）' },
    answer:       { type: 'string', required: true,  description: '回答（核心论点，30-80 字）' },
    title:        { type: 'string', required: false, description: '小标题' },
    startY:       { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:    '咨询提案/报告的开场页；将复杂背景浓缩为"读者-为什么应该听-我们说什么"四步引入',
    notWhen: '内容已展开后的中段（用 stepList / iconList）；纯数据展示（用 dataHighlight）',
    typicalHeight: '4.0~4.5 英寸',
    scenarios: [
      { trigger: '战略提案开篇引入', example: 'S：行业进入存量市场 → C：传统增长失效 → Q：新增长来自哪里 → A：AI 工作流再造交付能力' },
      { trigger: '咨询报告执行摘要', example: 'S：业务规模 / C：风险 / Q：核心问题 / A：3 步走方案' },
      { trigger: '内部汇报背景说明', example: 'S：季度目标 / C：偏离度 / Q：根本原因 / A：纠偏措施' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/scqa-narrative.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    return {
      situation:    kps[0] ? (splitTitleDesc(kps[0]).desc || kps[0]) : '',
      complication: kps[1] ? (splitTitleDesc(kps[1]).desc || kps[1]) : '',
      question:     kps[2] ? (splitTitleDesc(kps[2]).desc || kps[2]) : '我们应该如何应对？',
      answer:       kps[3] ? (splitTitleDesc(kps[3]).desc || kps[3]) : '',
      title:        (page && page.title) || '',
    };
  },



  render(pres, slide, data, infra) {
    const { C, resolveStartY, validateBounds, FONTS } = infra;
    const { situation, complication, question, answer, title, startY } = data;
    if (!situation || !complication || !question || !answer) return;

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.45;
    }

    // 4 段堆叠，从浅到深表达"递进"
    const items = [
      { ...SCQA_DEFS[0], text: situation },
      { ...SCQA_DEFS[1], text: complication },
      { ...SCQA_DEFS[2], text: question },
      { ...SCQA_DEFS[3], text: answer },
    ];

    // v3.7.13: rowH 上限 0.85 → 0.78，4 行总高从 3.6 → 3.32 修复 overflow 0.25"
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩 rowH
    const maxBottom = slide._contentMaxBottom || 4.85;
    const availH = Math.max(0.8, maxBottom - curY - 0.2);
    const rowH = Math.min(0.78, availH / items.length - 0.05);
    items.forEach((it, i) => {
      const y = curY + i * (rowH + 0.05);
      const bg = C[it.color] || it.color;

      // 标签块（左侧字母 + 中文）
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.5, y, w: 1.4, h: rowH,
        fill: { color: bg }, line: { color: bg, width: 0 },
      });
      slide.addText(it.key, {
        x: 0.5, y, w: 0.5, h: rowH,
        fontSize: 28, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText([
        { text: it.name + '\n', options: { fontSize: 14, bold: true } },
        { text: it.en, options: { fontSize: 9, bold: false, color: C.WHITE, transparency: 25 } },
      ], {
        x: 1.0, y, w: 0.9, h: rowH,
        fontFace: FONTS.primary,
        color: C.WHITE, align: 'left', valign: 'middle', margin: 0,
      });

      // 内容块
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 1.95, y, w: 7.55, h: rowH,
        fill: { color: C.BG_LIGHT }, line: { color: C.BG_PANEL, width: 0.5 },
      });
      slide.addText(it.text, {
        x: 2.1, y, w: 7.3, h: rowH,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.TEXT, valign: 'middle',
        lineSpacingMultiple: 1.3, margin: 0,
      });
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + items.length * (rowH + 0.05);
    validateBounds(slide, curY + items.length * (rowH + 0.05), 'scqaNarrative');
  },
};
