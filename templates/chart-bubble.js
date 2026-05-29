'use strict';
// templates/chart-bubble.js
// v3.2.5 — 气泡图（三维数据：X / Y / 气泡大小）

const path = require('path');
const fs   = require('fs');

const CHART_COLORS_LOCAL = ['1F6FEB', 'F76E3E', '22C55E', '38BDF8', 'EF4444', 'F59E0B', '8B5CF6'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function softenBubbleSizes(sizes) {
  const nums = sizes.map((n) => Number(n) || 0);
  if (nums.length === 0) return nums;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return nums;
  if (max <= 0) return nums;

  // 当原始 sizes 差距偏小的时候，轻度拉开视觉层次；
  // 保留排序，不改语义，只增强“大小维度”的可读性。
  if (max - min < 18 || max / Math.max(min, 1) < 1.7) {
    if (max === min) {
      const top = Math.min(92, 52 + nums.length * 6);
      const bottom = Math.max(34, top - Math.min(30, (nums.length - 1) * 5));
      return nums.map((_, i) => Math.round(bottom + ((nums.length - 1 - i) / Math.max(1, nums.length - 1)) * (top - bottom)));
    }
    return nums.map((v) => {
      const t = (v - min) / (max - min);
      const eased = Math.pow(clamp(t, 0, 1), 1.18);
      return Math.round(34 + eased * 56);
    });
  }

  // 对于本身就有差异的数据，只做轻微平滑，避免过度夸张。
  return nums.map((v) => Math.round(v * 1.04));
}

function buildBubbleSeries(chartData, CHART_COLORS) {
  const xSeries = chartData[0];
  const ySeries = chartData.slice(1);
  if (ySeries.length !== 1) {
    return {
      data: chartData,
      colors: ySeries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      showLegend: ySeries.length > 1,
    };
  }

  const series = ySeries[0];
  const values = Array.isArray(series.values) ? series.values : [];
  const sizes = softenBubbleSizes(Array.isArray(series.sizes) ? series.sizes : []);
  const pointCount = Math.max(values.length, Array.isArray(xSeries.values) ? xSeries.values.length : 0);
  const points = values.map((value, idx) => {
    const pointValues = Array.from({ length: pointCount }, () => null);
    const pointSizes = Array.from({ length: pointCount }, () => null);
    pointValues[idx] = value;
    pointSizes[idx] = sizes[idx] != null ? sizes[idx] : sizes[0] || 40;
    return {
      name: `${series.name || '点'} ${idx + 1}`,
      values: pointValues,
      sizes: pointSizes,
    };
  });

  // 单系列时拆成“点级系列”，便于给每个气泡独立着色。
  const ranked = points
    .map((p, i) => ({ ...p, idx: i, size: p.sizes[0] }))
    .sort((a, b) => (b.size || 0) - (a.size || 0));
  const colorByIdx = new Array(points.length);
  ranked.forEach((p, rank) => {
    const paletteIndex = rank % CHART_COLORS.length;
    colorByIdx[p.idx] = CHART_COLORS[paletteIndex];
  });

  return {
    data: [xSeries, ...points],
    colors: colorByIdx.length ? colorByIdx : [CHART_COLORS[0]],
    showLegend: false,
  };
}

module.exports = {
  name:        'chartBubble',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '气泡图，在散点基础上增加"大小"维度，可同时呈现三个数值',

  schema: {
    data: {
      type: 'array',
      required: true,
      description: '气泡数据：第 1 项 { name: "X-Axis", values: [..] }；后续每个系列 { name: "<系列名>", values: [Y 值...], sizes: [气泡大小...] }；sizes 与 values 长度一致',
    },
    title:      { type: 'string', required: false, description: '图表标题' },
    xAxisTitle: { type: 'string', required: false, description: 'X 轴标题' },
    yAxisTitle: { type: 'string', required: false, description: 'Y 轴标题' },
    startY:     { type: 'number', required: false, description: '起始 Y 坐标' },
    chartH:     { type: 'number', default: 3.4,  description: '图表高度' },
  },

  usage: {
    when:          '三维数据可视化：两个连续变量 + 一个表示量级/重要性的"大小"维度',
    notWhen:       '维度数 = 2 用 chartScatter；维度数 ≥ 4 改用 analysisMatrix 或拆图',
    typicalHeight: '3.4~3.8 英寸',
    scenarios: [
      { trigger: '战略选择评估：价值 × 难度 × 投资额', example: '10 个 AI 项目按价值-难度散点，气泡大小代表投资金额' },
      { trigger: '市场分析：增长率 × 利润率 × 营收规模', example: '若干业务线在两维度散点，气泡大小代表营收量' },
      { trigger: '客户分级：购买力 × 活跃度 × 累计 GMV', example: 'VIP 识别中加入累计金额作为气泡大小' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/chart-bubble.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    // 关键点形如 "X值,Y值,大小"
          const points = kps.map((kp, i) => {
            const nums = (kp.match(/-?\d+(?:\.\d+)?/g) || []).map(parseFloat);
            return {
              x:    nums[0] !== undefined ? nums[0] : i + 1,
              y:    nums[1] !== undefined ? nums[1] : 0,
              size: nums[2] !== undefined ? nums[2] : 100,
            };
          });
          return {
            data: [
              { name: 'X', values: points.map(p => p.x) },
              {
                name:   title || '数据点',
                values: points.map(p => p.y),
                sizes:  points.map(p => p.size),
              },
            ],
            title,
          };
  },



  render(pres, slide, data, infra) {
    const { C, resolveStartY, validateBounds, FONTS } = infra;
    const CHART_COLORS = [C.PRIMARY, C.ACCENT, C.SUCCESS, C.SKY, C.DANGER, C.GOLD, C.SECONDARY]
      .concat(CHART_COLORS_LOCAL);
    const { data: chartData, title, xAxisTitle, yAxisTitle, startY, chartH: userChartH } = data;
    // v4.1.1 (修 B-1): 提前校验 chartData 形状，否则 pptxgenjs 在 writeFile 时崩，整份 PPT 零字节
    if (!Array.isArray(chartData) || chartData.length < 2) {
      throw new Error('chartBubble 需要 data 为数组且至少 2 项（X 轴 + 至少 1 个 Y 系列）');
    }
    for (let i = 0; i < chartData.length; i++) {
      const s = chartData[i];
      if (!s || !Array.isArray(s.values)) {
        throw new Error(`chartBubble data[${i}] 缺少 values 数组（系列名 ${s && s.name || '?'}）`);
      }
      if (i > 0 && !Array.isArray(s.sizes)) {
        throw new Error(`chartBubble data[${i}] (Y 系列) 缺少 sizes 数组 — BUBBLE 必须有第三维大小`);
      }
    }
    // v4.1.6: 守护框
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (startY != null) ? startY : box.top;
    const maxBottom = box.bottom;
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.40 : 0;
    const available = maxBottom - top - titleH;
    const chartH = Math.max(1.0, Math.min(userChartH || 3.4, available));
    // v4.1.7 (修 P1-1): chart 自带 ~25% 内边距，居中时用 chartH * 0.80 补偿
    const visualChartH = chartH * 0.80;
    const sy = top + Math.max(0, (maxBottom - top - titleH - visualChartH) / 2);
    let chartY = sy;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.75, y: sy, w: 8.5, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle'
      });
      chartY = sy + titleH;
    }
    // 系列数 = data.length - 1（第 1 个是 X 轴；后续每个是带 sizes 的 Y 系列）
    const seriesCount = chartData.length - 1;
    const bubble = buildBubbleSeries(chartData, CHART_COLORS);
    const colors = bubble.colors.length ? bubble.colors : Array.from({ length: seriesCount }, (_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    slide.addChart(pres.charts.BUBBLE, bubble.data, {
      x: 0.75, y: chartY, w: 8.5, h: chartH,
      chartColors: colors,
      showTitle: false,
      showCatAxisTitle: !!xAxisTitle,
      catAxisTitle: xAxisTitle || '',
      catAxisTitleFontFace: FONTS.primary,
      catAxisTitleFontSize: 11,
      showValAxisTitle: !!yAxisTitle,
      valAxisTitle: yAxisTitle || '',
      valAxisTitleFontFace: FONTS.primary,
      valAxisTitleFontSize: 11,
      catAxisLabelFontFace: FONTS.primary,
      catAxisLabelFontSize: 9,
      valAxisLabelFontFace: FONTS.primary,
      valAxisLabelFontSize: 9,
      valGridLine: { color: C.BORDER, size: 0.5 },
      catGridLine: { color: C.BORDER, size: 0.5 },
      showLegend: bubble.showLegend && bubble.data.length > 2,
      legendPos: 'b',
      legendFontFace: FONTS.primary,
      legendFontSize: 10,
    });
    const finalBottom = Math.min(chartY + chartH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'chartBubble');
  },
};
