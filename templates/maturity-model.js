'use strict';
// templates/maturity-model.js — 能力成熟度模型（5 维度 × 3 档评分）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'maturityModel',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '5-8 个能力维度 × 3 档成熟度（当前 / 行业 / 目标）水平条形对比',

  schema: {
    dimensions: { type: 'array', min: 3, max: 8, required: true,
      item: { name: { type: 'string', required: true, warn: 12, error: 20 },
              current: { type: 'number', description: '当前评分 1-5' },
              industry: { type: 'number', description: '行业先进 1-5' },
              target: { type: 'number', description: '目标 1-5' } } },
  },

  usage: {
    when:    '尽职调查能力评估 / 数字化成熟度诊断',
    notWhen: '单一评分用 chartRadar；非分档对比',
    maxItems: 8,
    typicalHeight: '3.5"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/maturity-model.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const dimensions = kps.slice(0, 8).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      // desc 形如 "当前 2 行业 4 目标 5" 或 "2,4,5"
      const nums = (desc || '').match(/(\d+(?:\.\d+)?)/g) || [];
      return {
        name:     title || kp,
        current:  parseFloat(nums[0]) || (1 + i % 3),
        industry: parseFloat(nums[1]) || 3.5,
        target:   parseFloat(nums[2]) || 4.5,
      };
    });
    return { dimensions };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, resolveStartY } = infra;
    const { dimensions = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.3);
    const n  = Math.min(dimensions.length, 8);
    const rowH = Math.min(0.45, (3.5 - 0.3) / n);
    const baseX = 0.5;
    const labelW = 2.0;
    const barX   = baseX + labelW + 0.2;
    const barW   = 6.0;

    // 顶部刻度（1-5）
    for (let i = 0; i <= 5; i++) {
      const tx = barX + (i / 5) * barW;
      slide.addShape(pres.shapes.LINE, {
        x: tx, y: sy, w: 0, h: n * rowH + 0.1,
        line: { color: C.BORDER, width: 0.5, dashType: 'dash' },
      });
      slide.addText(String(i), {
        x: tx - 0.1, y: sy - 0.3, w: 0.2, h: 0.25,
        fontSize: 9, fontFace: FONTS.numeric,
        color: C.TEXT_LIGHT, align: 'center', margin: 0,
      });
    }

    dimensions.slice(0, n).forEach((d, i) => {
      const y = sy + i * rowH;
      // 维度名
      slide.addText(d.name, {
        x: baseX, y: y + 0.05, w: labelW, h: rowH - 0.1,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: C.TEXT, align: 'right', valign: 'middle', margin: 0,
      });
      // 当前 bar（深色）
      const curW = Math.min(1, (d.current || 0) / 5) * barW;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: barX, y: y + 0.1, w: curW, h: rowH * 0.35,
        fill: { color: C.DANGER },
      });
      slide.addText(String(d.current || 0), {
        x: barX + curW - 0.3, y: y + 0.05, w: 0.3, h: rowH * 0.4,
        fontSize: 10, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
      // 行业 marker（圆点）
      const indX = barX + (d.industry / 5) * barW;
      slide.addShape(pres.shapes.OVAL, {
        x: indX - 0.08, y: y + rowH / 2 - 0.08, w: 0.16, h: 0.16,
        fill: { color: C.WARNING }, line: { color: C.WHITE, width: 1 },
      });
      // 目标 marker（菱形）
      const tgtX = barX + (d.target / 5) * barW;
      slide.addShape(pres.shapes.DIAMOND, {
        x: tgtX - 0.1, y: y + rowH / 2 - 0.1, w: 0.2, h: 0.2,
        fill: { color: C.SUCCESS }, line: { color: C.WHITE, width: 1 },
      });
    });

    // 底部图例
    const lgY = sy + n * rowH + 0.3;
    [
      { label: '当前', color: C.DANGER, shape: 'rect' },
      { label: '行业先进', color: C.WARNING, shape: 'oval' },
      { label: '目标', color: C.SUCCESS, shape: 'diamond' },
    ].forEach((lg, i) => {
      const x = baseX + i * 1.8;
      if (lg.shape === 'rect') {
        slide.addShape(pres.shapes.RECTANGLE, { x, y: lgY + 0.05, w: 0.25, h: 0.15, fill: { color: lg.color } });
      } else if (lg.shape === 'oval') {
        slide.addShape(pres.shapes.OVAL, { x: x + 0.05, y: lgY + 0.05, w: 0.15, h: 0.15, fill: { color: lg.color } });
      } else {
        slide.addShape(pres.shapes.DIAMOND, { x: x + 0.05, y: lgY + 0.03, w: 0.18, h: 0.18, fill: { color: lg.color } });
      }
      slide.addText(lg.label, {
        x: x + 0.35, y: lgY, w: 1.2, h: 0.25,
        fontSize: 10, fontFace: FONTS.primary,
        color: C.TEXT, valign: 'middle', margin: 0,
      });
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = lgY + 0.3;
  },
};
