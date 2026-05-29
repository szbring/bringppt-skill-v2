'use strict';
// templates/chart-radar.js
// v3.2.5 — 雷达图（多维度能力评估）

const path = require('path');
const fs   = require('fs');

const CHART_COLORS_LOCAL = ['1F6FEB', 'F76E3E', '22C55E', '38BDF8', 'EF4444', 'F59E0B', '8B5CF6'];

module.exports = {
  name:        'chartRadar',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '雷达图，展示同一对象的多维度评分或多对象的同维度对比',

  schema: {
    data:       { type: 'array',  required: true,  description: '[{ name, labels: [维度1, 维度2, ...], values: [...] }]；多系列时 labels 必须一致' },
    title:      { type: 'string', required: false, description: '图表标题' },
    radarStyle: { type: 'string', default: 'standard', description: 'standard | filled | marker；filled = 填充式（推荐做"能力轮廓"）' },
    startY:     { type: 'number', required: false, description: '起始 Y 坐标' },
    chartH:     { type: 'number', default: 3.4,  description: '图表高度（雷达图建议 ≥ 3.2"）' },
  },

  usage: {
    when:          '多维度能力评估、品牌打分、SWOT 量化、产品功能对比',
    notWhen:       '维度数 <3（无法形成雷达形状）；维度数 >8（图形过密看不清）',
    typicalHeight: '3.4~3.8 英寸',
    scenarios: [
      { trigger: '咨询能力评估 / 品牌打分', example: '从战略、运营、品牌、技术、组织、人才 6 维度评估客户能力' },
      { trigger: '产品对标', example: '我司 vs 竞品 A vs 竞品 B 在 5 维度的对比' },
      { trigger: '员工能力盘点', example: '高潜人才在领导力/专业度/创新/沟通/执行 5 维度评分' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/chart-radar.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    // 雷达需 ≥3 维度，否则降级 — 但 buildLayoutData 不做降级，由三层稳定性处理
          const labels = kps.map((kp, i) => splitTitleDesc(kp).title || `维度${i + 1}`);
          const values = kps.map(kp => {
            const m = kp.match(/(\d+(?:\.\d+)?)/);
            return m ? parseFloat(m[1]) : 0;
          });
          return { data: [{ name: title || '评分', labels, values }], title, radarStyle: 'filled' };
  },



  render(pres, slide, data, infra) {
    const { C, resolveStartY, validateBounds, FONTS } = infra;
    const CHART_COLORS = [C.PRIMARY, C.ACCENT, C.SUCCESS, C.SKY, C.DANGER, C.GOLD, C.SECONDARY]
      .concat(CHART_COLORS_LOCAL);
    let { data: chartData, title, radarStyle = 'standard', startY, chartH: userChartH } = data;
    // v4.1.8 (修 P16): filled 模式多 series 时,数值大的会盖住数值小的
    // 策略:1) 按 sum(values) 从大到小排序,数值大的先画,数值小的后画(在上层);
    //      2) 加 chartColorsOpacity=50,即便仍有重叠也能透出底层
    let chartOpacity = null;
    if (radarStyle === 'filled' && Array.isArray(chartData) && chartData.length > 1) {
      const sum = (s) => Array.isArray(s.values) ? s.values.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
      chartData = chartData.slice().sort((a, b) => sum(b) - sum(a)); // 大的在前,先画
      chartOpacity = 50;
    }
    // v4.1.6: 守护框 + 自适应高度
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
    const colors = chartData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    const chartOpts = {
      x: 1.5, y: chartY, w: 7.0, h: chartH,  // 雷达图正方形效果更好，居中显示
      chartColors: colors,
      radarStyle: radarStyle,  // 'standard' | 'filled' | 'marker'
      showTitle: false,
      catAxisLabelFontFace: FONTS.primary,
      catAxisLabelFontSize: 10,
      catAxisLabelColor: C.TEXT,
      valAxisLabelFontFace: FONTS.primary,
      valAxisLabelFontSize: 9,
      showLegend: chartData.length > 1,
      // v4.1.8 (修 P1-A): 图例从底部 'b' 改右侧 'r'，避免与 KEY INSIGHT 装饰带叠加
      legendPos: 'r',
      legendFontFace: FONTS.primary,
      legendFontSize: 10,
    };
    if (chartOpacity != null) chartOpts.chartColorsOpacity = chartOpacity;
    slide.addChart(pres.charts.RADAR, chartData, chartOpts);
    const finalBottom = Math.min(chartY + chartH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'chartRadar');
  },
};
