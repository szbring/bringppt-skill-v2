'use strict';
// templates/progress-bar.js — 水平进度条群（v3.9.0 T-1）
// 适合"利用率 / 完成度 / 进度"类数据展示
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'progressBar',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '水平进度条：N 行 label + 进度条 + 数值，适合利用率/完成度/达成率',

  schema: {
    bars: {
      type: 'array',
      required: true,
      min: 2,
      max: 8,
      item: {
        label: { type: 'string', warn: 15, error: 25 },
        value: { type: 'number', required: true },
        max: { type: 'number' },
        unit: { type: 'string' },
        color: { type: 'string' },
        note: { type: 'string', warn: 20, error: 35 }
      }
    },
    startY: { type: 'number' },
    barHeight: { type: 'number' },
  },

  usage: {
    when: '展示多个并列的"利用率/达成率/进度"型数据',
    notWhen: '单一大数字用 dataHighlight；多维度散点用 chartScatter',
    typicalHeight: '2.5-3.5"',
    scenarios: [
      { trigger: '空间/电力/冷却利用率', example: 'Space 72/84U · Power 82/88kW · Cool 66/80kW' },
      { trigger: 'OKR 达成率展示', example: 'O1 85% · O2 60% · O3 95%' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/progress-bar.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    // 解析 "label: value/max unit" 格式，例：
    //   "Space 72/84 U"  → label=Space, value=72, max=84, unit=U
    //   "完成率: 85%"     → label=完成率, value=85, max=100, unit=%
    const bars = (keyPoints || []).slice(0, 8).map((kp) => {
      const text = String(kp).trim();
      // "label: 72/84 U" or "label: 85%"
      let m = text.match(/^(.+?)[:：]\s*([\d.]+)\s*\/\s*([\d.]+)\s*(\S*)$/);
      if (m) return { label: m[1].trim(), value: parseFloat(m[2]), max: parseFloat(m[3]), unit: m[4] || '' };
      m = text.match(/^(.+?)[:：]?\s*([\d.]+)\s*%/);
      if (m) return { label: m[1].trim().replace(/[:：]$/, ''), value: parseFloat(m[2]), max: 100, unit: '%' };
      m = text.match(/^(.+?)[:：]\s*([\d.]+)\s*(\S*)$/);
      if (m) return { label: m[1].trim(), value: parseFloat(m[2]), max: 100, unit: m[3] || '' };
      return { label: text, value: 50, max: 100, unit: '%' };
    });
    return { bars };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID } = infra;
    const { bars = [], startY: explicitStartY, barHeight } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y);
    const labelW = 2.2;
    const valueW = 1.2;
    const barX = GRID.LEFT + labelW + 0.1;
    const barWfull = GRID.CONTENT_WIDTH - labelW - valueW - 0.2;
    const barH = barHeight || 0.32;
    const gap = 0.18;
    const trackColor = C.BG_PANEL;

    // v4.0.6: 数据型模板默认用 CHART_BLUE 而非 PRIMARY 深 navy
    const DATA_STEP = [C.CHART_BLUE || C.PRIMARY, C.SECONDARY, C.BLUE_LIGHT, C.BLUE_PALE, C.INFO_GRAY];
    bars.forEach((b, i) => {
      const y = startY + i * (barH + gap);
      const pct = Math.min(1, Math.max(0, (b.value || 0) / (b.max || 100)));
      const fillColor = b.color || DATA_STEP[i % DATA_STEP.length];

      // label 左侧
      slide.addText(b.label, {
        x: GRID.LEFT, y, w: labelW, h: barH,
        fontSize: 12, fontFace: FONTS.body, color: C.TEXT, valign: 'middle', margin: 0,
      });
      // track 底
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: barX, y: y + barH * 0.3, w: barWfull, h: barH * 0.4,
        rectRadius: 0.02, fill: { color: trackColor }, line: { color: trackColor, width: 0 },
      });
      // fill 进度
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: barX, y: y + barH * 0.3, w: Math.max(0.05, barWfull * pct), h: barH * 0.4,
        rectRadius: 0.02, fill: { color: fillColor }, line: { color: fillColor, width: 0 },
      });
      // 右侧数值
      const valTxt = `${b.value}${b.max && b.max !== 100 ? '/' + b.max : ''} ${b.unit || ''}`.trim();
      slide.addText(valTxt, {
        x: GRID.LEFT + GRID.CONTENT_WIDTH - valueW, y, w: valueW, h: barH,
        fontSize: 13, fontFace: FONTS.numeric, bold: true, color: C.PRIMARY,
        align: 'right', valign: 'middle', margin: 0,
      });
      // 子注释
      if (b.note) {
        slide.addText(b.note, {
          x: barX, y: y + barH * 0.7, w: barWfull, h: barH * 0.35,
          fontSize: 9, fontFace: FONTS.body, italic: true, color: C.TEXT_LIGHT,
          valign: 'top', margin: 0,
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + bars.length * (barH + gap);
    validateBounds(slide, startY + bars.length * (barH + gap));
  },
};
