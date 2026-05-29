'use strict';
// templates/chart-scatter.js
// v3.2.5 — 散点图（价值-可行性矩阵、相关性分析）

const path = require('path');
const fs   = require('fs');

const CHART_COLORS_LOCAL = ['1F6FEB', 'F76E3E', '22C55E', '38BDF8', 'EF4444', 'F59E0B', '8B5CF6'];

module.exports = {
  name:        'chartScatter',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '散点图，展示两个连续变量的相关性或对象在二维空间中的精确位置',

  schema: {
    data: {
      type: 'array',
      required: true,
      description: '散点数据：第 1 项必须是 X 轴值列表 { name: "X", values: [..] }，后续每项是一个系列 { name, values: [..] }（与 X 长度一致，按位置配对）',
    },
    title:      { type: 'string', required: false, description: '图表标题' },
    xAxisTitle: { type: 'string', required: false, description: 'X 轴标题（如"可行性"）' },
    yAxisTitle: { type: 'string', required: false, description: 'Y 轴标题（如"价值"）' },
    startY:     { type: 'number', required: false, description: '起始 Y 坐标' },
    chartH:     { type: 'number', default: 3.4,  description: '图表高度' },
  },

  usage: {
    when:          '需要精确反映对象在二维空间中位置，如价值-可行性矩阵、客户细分、相关性分析',
    notWhen:       '只需"四象限粗分类"用 quadrantMatrix；数据是分类型的用 chartBar',
    typicalHeight: '3.4~3.8 英寸',
    scenarios: [
      { trigger: '战略举措的价值-可行性矩阵（精确位置）', example: '10 个 AI 落地项目按"价值"和"可行性"散点分布' },
      { trigger: '客户细分（购买力 vs 活跃度）', example: '将 200 个客户按两维度散点定位，识别 VIP/休眠/潜力客户' },
      { trigger: '与 quadrantMatrix 的区别：散点更精确、可承载更多点', example: '> 6 个点用散点；4 个固定象限用 quadrantMatrix' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/chart-scatter.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    // 关键点形如 "X值,Y值" 或 "X值 Y值"；缺失时用序号
          const points = kps.map((kp, i) => {
            const m = kp.match(/(-?\d+(?:\.\d+)?)\D+(-?\d+(?:\.\d+)?)/);
            return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: i + 1, y: 0 };
          });
          return {
            data: [
              { name: 'X', values: points.map(p => p.x) },
              { name: title || '数据点', values: points.map(p => p.y) },
            ],
            title,
          };
  },



  render(pres, slide, data, infra) {
    const { C, resolveStartY, validateBounds, FONTS } = infra;
    const CHART_COLORS = [C.PRIMARY, C.ACCENT, C.SUCCESS, C.SKY, C.DANGER, C.GOLD, C.SECONDARY]
      .concat(CHART_COLORS_LOCAL);
    const { data: chartData, title, xAxisTitle, yAxisTitle, startY, chartH: userChartH } = data;
    // v4.1.1 (修 B-1): 提前校验，否则 pptxgenjs writeFile 时崩，整份 PPT 零字节
    if (!Array.isArray(chartData) || chartData.length < 2) {
      throw new Error('chartScatter 需要 data 为数组且至少 2 项（X 轴 + 至少 1 个 Y 系列）');
    }
    for (let i = 0; i < chartData.length; i++) {
      const s = chartData[i];
      if (!s || !Array.isArray(s.values)) {
        throw new Error(`chartScatter data[${i}] 缺少 values 数组（系列名 ${s && s.name || '?'}）`);
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
    const colors = chartData.slice(1).map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    slide.addChart(pres.charts.SCATTER, chartData, {
      x: 0.75, y: chartY, w: 8.5, h: chartH,  // chartH 已被守护框钳制
      chartColors: colors,
      lineSize: 0,           // 散点不连线
      lineDataSymbol: 'circle',
      lineDataSymbolSize: 12,
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
      showLegend: chartData.length > 2,  // X 轴本身不算系列
      legendPos: 'b',
      legendFontFace: FONTS.primary,
      legendFontSize: 10,
    });
    const finalBottom = Math.min(chartY + chartH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'chartScatter');
  },
};
