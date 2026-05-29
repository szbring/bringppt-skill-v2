'use strict';
// templates/gauge.js — 半圆仪表盘（v3.9.0 T-1）
// 用半圆 + 半圆遮罩近似实现，center 大字
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'gauge',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '半圆仪表盘：1-3 个 半圆指针 + 中心大数字，适合"风险/状态/性能"级别展示',

  schema: {
    gauges: {
      type: 'array',
      required: true,
      min: 1,
      max: 3,
      item: {
        label: { type: 'string', warn: 12, error: 20 },
        value: { type: 'number', required: true },
        unit: { type: 'string' },
        zones: { type: 'array' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '风险/状态/性能等级（红橙黄绿四色区域）的可视化',
    notWhen: '简单百分比用 progressRing；多 KPI 用 dataHighlight',
    scenarios: [
      { trigger: 'PUE 能效仪表', example: 'PUE 1.15 (target ≤ 1.2)' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/gauge.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    const gauges = (keyPoints || []).slice(0, 3).map((kp) => {
      const t = String(kp).trim();
      const m = t.match(/^(.+?)[:：]\s*([\d.]+)\s*(\S*)$/);
      if (m) return { label: m[1].trim(), value: parseFloat(m[2]), unit: m[3] || '' };
      return { label: t, value: 50, unit: '' };
    });
    return { gauges };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID } = infra;
    const { normalizeColor } = require('../lib/keypoints-helpers');
    const { gauges = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y + 0.5);

    const n = gauges.length;
    const gaugeW = Math.min(2.5, (GRID.CONTENT_WIDTH - (n - 1) * 0.5) / n);
    const totalW = gaugeW * n + 0.5 * (n - 1);
    const offset = (GRID.CONTENT_WIDTH - totalW) / 2;

    // v4.0.6: 数据型默认 CHART_BLUE 中蓝
    const DATA_STEP = [C.CHART_BLUE || C.PRIMARY, C.SECONDARY, C.BLUE_LIGHT, C.BLUE_PALE, C.INFO_GRAY];
    gauges.forEach((g, i) => {
      const cx = GRID.LEFT + offset + i * (gaugeW + 0.5);
      const cy = startY;
      const pct = Math.min(100, Math.max(0, g.value || 0));
      // v4.1.8 (修 P1-E): zones.color 可能传 "green/orange/red" 关键字 → 映射 hex
      //   优先 g.color，其次根据 zones + value 落在哪个区段取颜色，最后 fallback 主题色
      let zoneColor = null;
      if (Array.isArray(g.zones) && g.zones.length > 0) {
        const z = g.zones.find(zz => {
          const lo = Number(zz.min != null ? zz.min : zz.from);
          const hi = Number(zz.max != null ? zz.max : zz.to);
          if (Number.isFinite(lo) && Number.isFinite(hi)) return pct >= lo && pct <= hi;
          return false;
        });
        if (z && z.color) zoneColor = normalizeColor(z.color, null);
      }
      const rawColor = g.color || zoneColor;
      const fillColor = rawColor
        ? normalizeColor(rawColor, DATA_STEP[i % DATA_STEP.length])
        : DATA_STEP[i % DATA_STEP.length];

      // 简化：用 doughnut chart，但只显示上半段（180° → 看起来像 gauge）
      // pptxgenjs 的 chart 不支持 startAngle，所以用"上半圆"近似：
      //   显示 value:half + remainder:half + bottom-mask:full（白色遮挡下半）
      const half = 50;
      const chartData = [{
        name: g.label,
        labels: ['fill', 'rest', 'bottom-mask'],
        values: [pct / 2, (100 - pct) / 2, 50],   // 上半合计 50，下半遮 50
      }];
      slide.addChart(pres.charts.DOUGHNUT, chartData, {
        x: cx, y: cy, w: gaugeW, h: gaugeW,
        chartColors: [fillColor, C.BG_PANEL, C.WHITE],
        showLegend: false,
        showTitle: false,
        showValue: false,
        holeSize: 60,
      });

      // 中心数值（值偏上 1/3 处）
      slide.addText(String(g.value), {
        x: cx, y: cy + gaugeW * 0.35, w: gaugeW, h: gaugeW * 0.25,
        fontSize: gaugeW > 2 ? 32 : 24, fontFace: FONTS.numeric, bold: true,
        color: fillColor, align: 'center', valign: 'middle', margin: 0,
      });
      // 单位
      if (g.unit) {
        slide.addText(g.unit, {
          x: cx, y: cy + gaugeW * 0.55, w: gaugeW, h: 0.2,
          fontSize: 10, fontFace: FONTS.body, color: C.TEXT_LIGHT,
          align: 'center', margin: 0,
        });
      }
      // label
      slide.addText(g.label, {
        x: cx, y: cy + gaugeW * 0.72, w: gaugeW, h: 0.35,
        fontSize: 12, fontFace: FONTS.title, bold: true,
        color: C.TEXT, align: 'center', margin: 0,
      });
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + gaugeW + 0.4;
    validateBounds(slide, startY + gaugeW + 0.4);
  },
};
