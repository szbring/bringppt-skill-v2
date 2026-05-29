'use strict';
// templates/action-title-slide.js — 顶咨结论标题页（金字塔原理 · 标题即结论）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'actionTitleSlide',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '顶咨标准结论标题页：35-40pt 加粗结论 + 副结论 + 3 个紧凑论据',

  schema: {
    actionTitle: { type: 'string', required: true, description: '主结论句（30-60 字）', warn: 50, error: 80 },
    subConclusion: { type: 'string', description: '副结论（15-30 字）', warn: 30, error: 50 },
    supports: {
      type: 'array', min: 2, max: 4,
      item: { title: { type: 'string', required: true, warn: 15, error: 25 },
              desc:  { type: 'string', warn: 30, error: 50 } },
    },
    sourceRef: { type: 'string', description: '底部来源说明' },
  },

  usage: {
    when:    '需要让标题本身就传达完整结论（金字塔原理），客户翻一页就知道核心观点',
    notWhen: '内容偏过程描述不是结论；KPI 多需要图表',
    maxItems: 4,
    typicalHeight: 'full-page',
    scenarios: [
      { trigger: 'Executive summary 单页', example: '"建议聚焦头部 3 区域 18 月 EBITDA 提升 4.2pp"' },
      { trigger: '每个章节首页结论页', example: '"DFX 校验前置使返工率从 30% 降到 8%"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/action-title-slide.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    const kps = keyPoints || [];
    return {
      actionTitle:   (page && page.title) || (kps[0] || '核心结论'),
      subConclusion: page && page.subtitle,
      supports:      mapKpsToItems(keyPoints, { max: 4 }),
      sourceRef:     page && page.sourceRef,
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, shadow, calcFitFontSize, resolveStartY, validateBounds } = infra;
    const { actionTitle, subConclusion, supports = [], sourceRef } = data;

    // v3.7.31: contentSlide 已渲染 page.title，这里 actionTitle 默认与 page.title 相同时跳过避免重复
    // 仅当显式有 subConclusion（短副结论）时把它作为强调横幅渲染
    let bodyStartY = 1.3;
    if (subConclusion) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.4, y: 1.15, w: 9.2, h: 0.06, fill: { color: C.PRIMARY },
      });
      slide.addText(subConclusion, {
        x: 0.5, y: 1.3, w: 9.0, h: 0.6,
        fontSize: 18, fontFace: FONTS.primary, italic: true,
        color: C.TEXT, valign: 'middle', margin: 0,
      });
      bodyStartY = 2.0;
    }

    // 3-4 个论据卡片横排
    const n = Math.min(supports.length, 4);
    if (n > 0) {
      const gap = 0.25;
      const cardW = (9.0 - gap * (n - 1)) / n;
      const cardH = Math.min(3.0, (slide._contentMaxBottom || 4.85) - bodyStartY);
      supports.slice(0, n).forEach((s, i) => {
        const x = 0.5 + i * (cardW + gap);
        const color = STEP_COLORS[i % STEP_COLORS.length];
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x, y: bodyStartY, w: cardW, h: cardH, rectRadius: 0.08,
          fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
        });
        // v3.7.35: 顶部色带加厚到 0.12 + 加角标数字
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y: bodyStartY, w: cardW, h: 0.12, fill: { color },
        });
        // 卡片右上角大字编号水印（顶咨签名）
        slide.addText(String(i + 1).padStart(2, '0'), {
          x: x + cardW - 0.7, y: bodyStartY + 0.15, w: 0.6, h: 0.55,
          fontSize: 40, fontFace: FONTS.numeric, bold: true,
          color, transparency: 70, align: 'right', valign: 'top', margin: 0,
        });
        slide.addText(s.title, {
          x: x + 0.2, y: bodyStartY + 0.25, w: cardW - 0.4, h: 0.5,
          fontSize: 17, fontFace: FONTS.primary, bold: true,
          color: C.PRIMARY, valign: 'middle', margin: 0,
        });
        if (s.desc) {
          slide.addText(s.desc, {
            x: x + 0.2, y: bodyStartY + 0.78, w: cardW - 0.4, h: cardH - 0.95,
            fontSize: 11, fontFace: FONTS.primary, color: C.TEXT,
            valign: 'top', lineSpacingMultiple: 1.4, margin: 0,
          });
        }
      });
    }

    // 底部脚注（顶咨标志性元素）
    if (sourceRef) {
      slide.addText(`Source: ${sourceRef}`, {
        x: 0.5, y: 5.15, w: 9.0, h: 0.25,
        fontSize: 9, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_MUTED, valign: 'middle', margin: 0,
      });
    }
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    if (n > 0) {
      slide._bottomY = bodyStartY + Math.min(3.0, (slide._contentMaxBottom || 4.85) - bodyStartY);
    }
  },
};
