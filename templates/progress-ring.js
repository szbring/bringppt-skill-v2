'use strict';
// templates/progress-ring.js — 进度环/Donut（v3.9.0 T-1）
// 用 pres.addChart 的 doughnut 形态（占 80% 圆环 + 中心大字 %）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'progressRing',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '环形进度图：N 个 圆环 + 中心大字百分比 + 下方 label，适合 KPI/达成率展示',

  schema: {
    rings: {
      type: 'array',
      required: true,
      min: 1,
      max: 4,
      item: {
        label: { type: 'string', warn: 12, error: 20 },
        value: { type: 'number', required: true },
        sublabel: { type: 'string', warn: 25, error: 40 },
        color: { type: 'string' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '1-4 个 KPI 的达成率/利用率/百分比可视化',
    notWhen: '超过 4 个 KPI 用 dataHighlight；非百分比数据用 chartBar',
    typicalHeight: '2.5-3.5"',
    scenarios: [
      { trigger: '4 大 KPI 完成率', example: '空间 100% · 电力 94% · 冷却 83% · 网络 88%' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/progress-ring.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    const rings = (keyPoints || []).slice(0, 4).map((kp) => {
      const t = String(kp).trim();
      const m = t.match(/^(.+?)[:：]?\s*([\d.]+)\s*%?(?:\s+(.+))?$/);
      if (m) return { label: m[1].trim().replace(/[:：]$/, ''), value: parseFloat(m[2]),
                       sublabel: m[3] ? m[3].trim() : '' };
      return { label: t, value: 50, sublabel: '' };
    });
    return { rings };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID } = infra;
    const { rings = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y + 0.3);

    const n = rings.length;
    const ringSize = Math.min(2.0, (GRID.CONTENT_WIDTH - (n - 1) * 0.4) / n);
    const totalW = ringSize * n + 0.4 * (n - 1);
    const offset = (GRID.CONTENT_WIDTH - totalW) / 2;

    rings.forEach((r, i) => {
      const cx = GRID.LEFT + offset + i * (ringSize + 0.4);
      const cy = startY;
      const color = r.color || STEP_COLORS[i % STEP_COLORS.length];
      const pct = Math.min(100, Math.max(0, r.value || 0));

      // 用 doughnut chart 表达环形进度
      const chartData = [{
        name: r.label,
        labels: [r.label, ''],
        values: [pct, 100 - pct],
      }];
      slide.addChart(pres.charts.DOUGHNUT, chartData, {
        x: cx, y: cy, w: ringSize, h: ringSize,
        chartColors: [color, C.BG_PANEL],
        showLegend: false,
        showTitle: false,
        showValue: false,
        holeSize: 70,
      });

      // 中心大字百分比
      slide.addText(`${pct}%`, {
        x: cx, y: cy + ringSize * 0.32, w: ringSize, h: ringSize * 0.35,
        fontSize: ringSize > 1.6 ? 32 : 24, fontFace: FONTS.numeric, bold: true,
        color: color, align: 'center', valign: 'middle', margin: 0,
      });
      // 下方 label
      slide.addText(r.label, {
        x: cx, y: cy + ringSize + 0.1, w: ringSize, h: 0.35,
        fontSize: 13, fontFace: FONTS.title, bold: true,
        color: C.TEXT, align: 'center', margin: 0,
      });
      if (r.sublabel) {
        slide.addText(r.sublabel, {
          x: cx, y: cy + ringSize + 0.45, w: ringSize, h: 0.3,
          fontSize: 10, fontFace: FONTS.body, color: C.TEXT_LIGHT,
          align: 'center', margin: 0,
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + ringSize + 0.85;
    validateBounds(slide, startY + ringSize + 0.85);
  },
};
