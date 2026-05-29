'use strict';
// templates/chart-bar.js
// Source: bring-core.js L1821-1859
const path = require('path');
const fs   = require('fs');

const CHART_COLORS_LOCAL = ['1F6FEB','F76E3E','22C55E','38BDF8','EF4444','F59E0B','8B5CF6'];

module.exports = {
  name:        'chartBar',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '柱形图/条形图，支持水平、堆叠模式',

  schema: {
    data:       { type: 'array', description: '图表数据系列' },
    title:      { type: 'string', description: '图表标题' },
    horizontal: { type: 'boolean', default: false, description: '是否水平方向' },
    stacked:    { type: 'boolean', default: false, description: '是否堆叠' },
    showValue:  { type: 'boolean', default: false, description: '是否显示数值' },
    startY:     { type: 'number', description: '起始Y坐标' },
    chartH:     { type: 'number', default: 3.2, description: '图表高度' },
  },

  usage: {
    when:          '展示分类数据对比，如销售额、数量对比',
    notWhen:       '数据类别极多（>10）或需要展示趋势时',
    typicalHeight: '3.2~3.6英寸',
    scenarios: [
      { trigger: "各类别数据量的横向比较", example: "五家竞争对手的市场份额对比——柱状图最直观" },
      { trigger: "同一指标在不同时间段的对比", example: "Q1-Q4营收对比，或今年vs去年同期" },
      { trigger: "与chartLine的区别：比较离散类别，而非趋势", example: "比较多个项目/部门/产品时用chartBar，看时间走势用chartLine" },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/chart-bar.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const labels = kps.map((kp, i) => splitTitleDesc(kp).title || `项目${i + 1}`);
    const values = kps.map(kp => {
      const m = String(kp).match(/(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : 0;
    });
    return { data: [{ name: title, labels, values }], title };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const CHART_COLORS = CHART_COLORS_LOCAL.map(c => {
      // v4.0.6 (顶咨色系对齐)：图表第 1 色用 CHART_BLUE #1F4E79 而非 PRIMARY 深 navy
      //   navy 用于品牌/标题，图表柱用稍亮的中蓝避免与白底过强对比
      if (c === '1F6FEB') return C.CHART_BLUE || C.PRIMARY || c;
      if (c === 'F76E3E') return C.ACCENT || c;
      if (c === '22C55E') return C.SUCCESS || c;
      if (c === '38BDF8') return C.SKY || c;
      if (c === 'EF4444') return C.DANGER || c;
      if (c === 'F59E0B') return C.GOLD || c;
      if (c === '8B5CF6') return C.SECONDARY || c;
      return c;
    });
    const { data: chartData, title, horizontal = false, stacked = false, showValue = false, startY, chartH: userChartH } = data;
    // v4.1.6: 守护框 + 居中 + chartH 不超 available
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (startY != null) ? startY : box.top;
    const maxBottom = box.bottom;
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.40 : 0;
    // v4.1.8 (修 P1-B): 给 X 轴标签强制保留 0.45" buffer，否则 "2021/2022/..." 会压到 KEY INSIGHT 装饰带
    const X_AXIS_BUFFER = 0.45;
    const available = maxBottom - top - titleH - X_AXIS_BUFFER;
    const chartH = Math.max(1.0, Math.min(userChartH || 3.2, available));
    // 纵向居中
    // v4.1.7 (修 P1-1): chart 自带 ~25% 内边距，centerYInBox 用 chartH * 0.80 补偿，
    //   避免顶部留白过多（视觉中心比几何中心低）。
    const visualChartH = chartH * 0.80;
    const totalH = titleH + visualChartH;
    const sy = top + Math.max(0, (maxBottom - top - totalH) / 2);
    let chartY = sy;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.75, y: sy, w: 8.5, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: "left", valign: "middle"
      });
      chartY = sy + titleH;
    }
    const colors = chartData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    slide.addChart(pres.charts.BAR, chartData, {
      x: 0.75, y: chartY, w: 8.5, h: chartH,
      barDir: horizontal ? "bar" : "col",
      barGrouping: stacked ? "stacked" : "clustered",
      chartColors: colors,
      showTitle: false,
      showValue: !!showValue,
      dataBorder: { pt: 0.5, color: C.WHITE },
      catAxisLabelFontFace: FONTS.primary,
      catAxisLabelFontSize: 10,
      valAxisLabelFontFace: FONTS.primary,
      valAxisLabelFontSize: 9,
      catAxisOrientation: "minMax",
      valAxisOrientation: "minMax",
      valGridLine: { color: C.BORDER, size: 0.5 },
      catGridLine: { style: "none" },
      showLegend: chartData.length > 1,
      legendPos: "b",
      legendFontFace: FONTS.primary,
      legendFontSize: 10,
    });
    const finalBottom = Math.min(chartY + chartH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'chartBar');
  },
};
