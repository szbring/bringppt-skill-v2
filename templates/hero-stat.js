'use strict';
// templates/hero-stat.js — 杂志式大数字 hero（一页一个核心数据点）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'heroStat',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '杂志式 hero 大数字：占满整页的超大字号 + 上下文解释 + 来源',

  schema: {
    statValue:  { type: 'string', required: true, description: '核心数字（如 95%）', warn: 8, error: 12 },
    statLabel:  { type: 'string', required: true, description: '数字标签', warn: 20, error: 35 },
    context:    { type: 'string', description: '上下文（一句话解释）', warn: 50, error: 80 },
    comparison: { type: 'string', description: '对照值（如 "vs 行业 75%"）' },
    sourceRef:  { type: 'string', description: '数据来源' },
  },

  usage: {
    when:    '需要一页一个数字震撼客户：客户管理层第一眼必看的核心 KPI',
    notWhen: '多个并列数字（用 dataHighlight）；常规 KPI 仪表（kpiDashboard）',
    typicalHeight: 'full-page',
    scenarios: [
      { trigger: '提案核心承诺', example: '"95%: 12 个月需求自动化覆盖率"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hero-stat.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const first = kps[0] ? splitTitleDesc(kps[0]) : { title: '95%', desc: '核心指标' };
    return {
      statValue:  first.title || '95%',
      statLabel:  first.desc || '关键指标',
      context:    kps[1] || '',
      comparison: page && page.comparison,
      sourceRef:  page && page.sourceRef,
    };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, calcFitFontSize } = infra;
    // v4.1.1 (修 C-2): schema 守卫——兼容 stat/value/number 等常见误写，缺 statValue 显式抛错
    let statValue = data.statValue;
    if (statValue == null || statValue === '') {
      statValue = data.value != null ? data.value : (data.number != null ? data.number : data.stat);
    }
    if (statValue == null || statValue === '') {
      throw new Error('heroStat 缺少必填字段 statValue（应为字符串，如 "95%"）');
    }
    statValue = String(statValue);
    const { statLabel = data.label || '关键指标', context, comparison, sourceRef } = data;

    // v3.7.38: 所有文字居中分布（用户反馈文字应该居中分布）
    // 顶部 "KEY FINDING" 小标签 — 居中
    slide.addText('KEY FINDING', {
      x: 0.5, y: 1.0, w: 9.0, h: 0.35,
      fontSize: 12, fontFace: FONTS.enSmall, bold: true,
      color: C.ACCENT, charSpacing: 5, align: 'center', margin: 0,
    });
    // 居中金色短线
    slide.addShape(pres.shapes.RECTANGLE, {
      x: (10 - 1.5) / 2, y: 1.4, w: 1.5, h: 0.04, fill: { color: C.ACCENT },
    });

    // 超大字数字（占据中心）— 居中
    const valueFs = calcFitFontSize(statValue, 8.5, 2.5, 200, { minFontSize: 80 });
    slide.addText(statValue, {
      x: 0.5, y: 1.7, w: 9.0, h: 2.5,
      fontSize: valueFs, fontFace: FONTS.numeric, bold: true,
      color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
    });

    // 标签（数字下方）— 居中
    slide.addText(statLabel, {
      x: 0.5, y: 4.2, w: 9.0, h: 0.5,
      fontSize: 22, fontFace: FONTS.primary, bold: true,
      color: C.TEXT, align: 'center', valign: 'middle', margin: 0,
    });

    // 上下文一句话 — 居中
    if (context) {
      slide.addText(context, {
        x: 0.5, y: 4.75, w: 9.0, h: 0.5,
        fontSize: 14, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_LIGHT, align: 'center', valign: 'middle', lineSpacingMultiple: 1.4, margin: 0,
      });
    }

    // 对照值（右上角，保留靠右用作"vs 对照"专门视觉位）
    if (comparison) {
      slide.addText(comparison, {
        x: 6.0, y: 0.9, w: 3.5, h: 0.5,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, align: 'right', valign: 'middle', margin: 0,
      });
    }

    // 来源（底部）— 居中
    if (sourceRef) {
      slide.addText('Source: ' + sourceRef, {
        x: 0.5, y: 5.25, w: 9.0, h: 0.25,
        fontSize: 9, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_MUTED, align: 'center', margin: 0,
      });
    }
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步（heroStat 占满主区，到 context 行下方）
    slide._bottomY = context ? 5.25 : 4.7;
  },
};
