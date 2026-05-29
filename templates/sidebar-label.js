'use strict';
// templates/sidebar-label.js
// 左侧大字标签 + 右侧卡片内容（来自ISC汇报方案 B07 模板）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'sidebarLabel',
  version:     '1.0.0',
  category:    '图文/复合型',
  description: '左侧大字竖排标签（如"执行摘要"）+ 右侧2-4个内容卡片，适合摘要页和分层说明页',

  schema: {
    label:    { type: 'string', required: true,  description: '左侧大字标签（2-6字）' },
    cards:    { type: 'array',  required: true,  description: '[{ title, content, color? }]，2-4张' },
    summary:  { type: 'string', required: false, description: '底部总结条文字' },
    startY:   { type: 'number', required: false, description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '执行摘要页、分层内容、三阶段建议，左侧需要大字标签强调主题时',
    notWhen:       '卡片超过4张时；内容无主题标签时',
    scenarios: [
          {
                "trigger": "执行摘要页，左侧需要大字标注主题",
                "example": "左侧'执行摘要'大字，右侧3张'立即做/重点投入/避免陷阱'卡片"
          },
          {
                "trigger": "分层说明，每层有独立卡片",
                "example": "左侧'核心建议'，右侧按01/02/03排列的行动建议卡片"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/sidebar-label.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKps（render 读 item.content 不是 item.desc）
  fromKeyPoints(keyPoints, page) {
    const { mapKps } = require('../lib/adapter-helpers');
    const cards = mapKps(keyPoints, (kp, i, parts) => ({
      title:   parts.title || kp,
      content: parts.desc || parts.title || kp,
    }), { max: 4 });
    return { cards, label: (page && page.title) || '要点' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            resolveStartY, validateBounds,
            calcFitFontSize, FONTS } = infra;
    const { label, cards = [], summary, startY: explicitStartY } = data;

    const startY  = resolveStartY(slide, explicitStartY, 0.9);
    const maxBot  = slide._contentMaxBottom || 4.85;
    const availH  = (summary ? maxBot - 0.65 : maxBot) - startY;

    // ── 左侧大字标签 ──────────────────────────────────────────
    const labelX = 0.3;
    const labelW = 1.1;
    const labelH = availH;

    // 标签背景（深蓝）
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: labelX, y: startY, w: labelW, h: labelH,
      rectRadius: 0.08,
      fill: { color: C.PRIMARY },
    });

    // v3.9.2: 限制 label 长度避免竖排超框 — 中文截 6 字、英文截 4 字
    const isMostlyAscii = (label || '').match(/[a-zA-Z]/g);
    const maxChars = isMostlyAscii && isMostlyAscii.length > (label || '').length * 0.5 ? 4 : 6;
    const trimmedLabel = (label || '要点').slice(0, maxChars);
    const labelChars = trimmedLabel.split('').join('\n');
    // 字号根据字数自适应：≤4 字 18pt，5 字 16pt，6 字 14pt
    const labelFs = trimmedLabel.length <= 4 ? 18 : trimmedLabel.length === 5 ? 16 : 14;
    slide.addText(labelChars, {
      x: labelX + 0.15, y: startY + 0.3, w: labelW - 0.3, h: labelH - 0.6,
      fontSize: labelFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true,
      align: 'center', valign: 'middle',
      lineSpacingMultiple: 1.0, margin: 0,
    });

    // ── 右侧卡片 ─────────────────────────────────────────────
    const count    = Math.min(cards.length, 4);
    const cardsX   = labelX + labelW + 0.2;
    const cardsW   = 10 - cardsX - 0.3;
    const gap      = 0.18;
    const cardW    = (cardsW - gap * (count - 1)) / count;
    const cardH    = availH;
    const topBarH  = 0.38;

    cards.slice(0, count).forEach((card, i) => {
      const x = cardsX + i * (cardW + gap);
      const accentColor = card.color || STEP_COLORS[i % STEP_COLORS.length];

      // 卡片底板
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: startY, w: cardW, h: cardH,
        rectRadius: 0.07,
        fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 },
        shadow: shadow(),
      });

      // 顶部彩色条
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cardW, h: topBarH,
        fill: { color: accentColor },
      });

      // 标题
      slide.addText(card.title || '', {
        x: x + 0.12, y: startY + 0.04, w: cardW - 0.24, h: topBarH - 0.08,
        fontSize: 13, fontFace: FONTS.primary,
        color: C.WHITE, bold: true,
        align: 'center', valign: 'middle', margin: 0,
      });

      // 正文（支持 \n 换行）
      if (card.content) {
        const contentH = cardH - topBarH - 0.15;
        const lines = card.content.split('\n');
        const fz = Math.min(12, calcFitFontSize
          ? calcFitFontSize(card.content, cardW - 0.3, contentH, { fontSize: 12 })
          : 11);
        slide.addText(
          lines.map((t, li) => ({
            text: t,
            options: { breakLine: li < lines.length - 1 },
          })),
          {
            x: x + 0.15, y: startY + topBarH + 0.1,
            w: cardW - 0.3, h: contentH,
            fontSize: fz, fontFace: FONTS.primary,
            color: C.TEXT, valign: 'top', margin: 0,
            paraSpaceBefore: 2,
          }
        );
      }
    });

    // ── 底部总结条 ───────────────────────────────────────────
    const bottomY = startY + availH;
    if (summary) {
      const sumH = 0.52;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.3, y: bottomY + 0.1, w: 9.4, h: sumH,
        fill: { color: C.PRIMARY },
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.3, y: bottomY + 0.1, w: 0.06, h: sumH,
        fill: { color: C.ACCENT },
      });
      slide.addText(summary, {
        x: 0.55, y: bottomY + 0.1, w: 9.1, h: sumH,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.WHITE, bold: true,
        valign: 'middle', margin: 0,
      });
      slide._bottomY = bottomY + 0.1 + sumH;  // v4.0.6
      validateBounds(slide, bottomY + 0.1 + sumH, 'sidebarLabel');
    } else {
      slide._bottomY = bottomY;  // v4.0.6
      validateBounds(slide, bottomY, 'sidebarLabel');
    }
  },
};
