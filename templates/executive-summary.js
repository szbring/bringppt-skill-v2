'use strict';
// templates/executive-summary.js — 一页纸执行摘要（顶咨级密度）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'executiveSummary',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '一页纸高密度摘要：核心结论 + 3-5 findings + KPI 仪表 + 下一步',

  schema: {
    headline:  { type: 'string', required: true, description: '一句话总结', warn: 50, error: 80 },
    findings:  { type: 'array', min: 2, max: 5,
      item: { title: { type: 'string', required: true, warn: 15, error: 25 },
              desc:  { type: 'string', warn: 30, error: 60 },
              priority: { type: 'string', description: 'high/medium/low' } } },
    kpis:      { type: 'array', max: 4,
      item: { label: { type: 'string', warn: 12, error: 20 },
              value: { type: 'string', warn: 10, error: 15 } } },
    nextSteps: { type: 'array', max: 4, item: { type: 'string', warn: 25, error: 40 } },
  },

  usage: {
    when:    '客户高管第一眼翻的页；项目阶段结论 / 提案首页',
    notWhen: '深度分析需要专门版式；纯数据展示用 kpiDashboard',
    maxItems: 5,
    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/executive-summary.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.31: 不再自动按"是否含数字"拆 findings/KPI——
  //          这种启发式把带数字的事实陈述错当 KPI 标签。
  //          findings 全部从 keyPoints 来，KPIs 仅当 page.kpis 显式提供时渲染。
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return {
      headline:  (page && page.title) || ((keyPoints && keyPoints[0]) || '执行摘要'),
      findings:  mapKpsToItems(keyPoints, { max: 5 }),
      kpis:      (page && page.kpis) || [],
      nextSteps: (page && page.nextSteps) || [],
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, shadow, calcFitFontSize, resolveStartY } = infra;
    const { findings = [], kpis = [], nextSteps = [] } = data;
    // v4.0.4: 空值守卫 — 三个数组全空时渲染友好占位
    if ((!findings || !findings.length) && (!kpis || !kpis.length) && (!nextSteps || !nextSteps.length)) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      const sy = resolveStartY ? resolveStartY(slide, undefined, 1.0) : 1.0;
      return renderEmptyState(slide, infra, {
        template:     'executiveSummary',
        missingField: 'findings[] / kpis[] / nextSteps[]',
        hint:         '需要 2-5 个 {title, desc, priority?} 发现项；不是 points[]/callout',
        startY:       sy,
      });
    }

    // v3.7.31: 不再渲染独立的 headline 横幅——contentSlide 头部已展示 page.title
    // 左 60% findings 区，顶部直接从 1.15 开始
    const findingsX = 0.4, findingsY = 1.15, findingsW = 5.5;
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩 itemH
    const maxBottom = slide._contentMaxBottom || 4.85;
    const availFindingsH = Math.max(1.0, maxBottom - findingsY - 0.15);
    slide.addText('核心发现 KEY FINDINGS', {
      x: findingsX, y: findingsY, w: findingsW, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.TEXT_LIGHT, charSpacing: 2, margin: 0,
    });
    const fn = Math.min(findings.length, 5);
    const itemH = Math.min(0.65, (availFindingsH - 0.3) / fn);
    findings.slice(0, fn).forEach((f, i) => {
      const y = findingsY + 0.35 + i * (itemH + 0.05);
      const color = STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.OVAL, {
        x: findingsX, y: y + 0.1, w: 0.25, h: 0.25, fill: { color },
      });
      slide.addText(String(i + 1), {
        x: findingsX, y: y + 0.1, w: 0.25, h: 0.25,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
      slide.addText(f.title, {
        x: findingsX + 0.35, y, w: findingsW - 0.35, h: 0.3,
        fontSize: 13, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: 'top', margin: 0,
      });
      if (f.desc) {
        slide.addText(f.desc, {
          x: findingsX + 0.35, y: y + 0.3, w: findingsW - 0.35, h: itemH - 0.3,
          fontSize: 10, fontFace: FONTS.primary, color: C.TEXT,
          valign: 'top', lineSpacingMultiple: 1.3, margin: 0,
        });
      }
    });

    // 右 40% KPI + 下一步
    const rightX = 6.2, rightW = 3.4;
    if (kpis.length) {
      slide.addText('关键指标 KPI', {
        x: rightX, y: findingsY, w: rightW, h: 0.3,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: C.TEXT_LIGHT, charSpacing: 2, margin: 0,
      });
      const kn = Math.min(kpis.length, 4);
      const kw = (rightW - 0.15) / 2;
      const kh = 0.8;
      kpis.slice(0, kn).forEach((k, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = rightX + col * (kw + 0.15);
        const y = findingsY + 0.35 + row * (kh + 0.1);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x, y, w: kw, h: kh, rectRadius: 0.06, fill: { color: C.BG_LIGHT },
          line: { color: C.BORDER, width: 0.5 },
        });
        slide.addText(k.value, {
          x, y: y + 0.05, w: kw, h: 0.4,
          fontSize: 22, fontFace: FONTS.numeric, bold: true,
          color: C.ACCENT, align: 'center', valign: 'middle', margin: 0,
        });
        slide.addText(k.label, {
          x, y: y + 0.45, w: kw, h: 0.3,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
        });
      });
    }

    if (nextSteps.length) {
      const nsY = findingsY + 2.4;
      slide.addText('下一步 NEXT STEPS', {
        x: rightX, y: nsY, w: rightW, h: 0.3,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: C.TEXT_LIGHT, charSpacing: 2, margin: 0,
      });
      nextSteps.slice(0, 4).forEach((s, i) => {
        slide.addText(`→ ${s}`, {
          x: rightX, y: nsY + 0.32 + i * 0.28, w: rightW, h: 0.25,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT, valign: 'middle', margin: 0,
        });
      });
    }
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = findingsY + 3.6;
  },
};
