'use strict';
// templates/kpi-dashboard.js
// Source: bring-core.js L2193-2271
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'kpiDashboard',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: 'KPI仪表盘，展示2-4个关键指标卡片',

  schema: {
    kpis:  {
      type: 'array',
      required: true,
      max: 4,  // v4.1.1: 明确容量上限——超出会触发 WARN，仅渲染前 4 个
      description: 'KPI列表 [{ label, value, unit?, trend?(up/down/flat), trendLabel?, delta?(如 "+3.2pp"), color? }]，最多4项；delta 字段会以绿/红箭头着色',
      item: {
        label: { type: 'string', required: true },
        value: { type: 'any',    required: true },
        unit:  { type: 'string' },
        trend: { type: 'string', description: 'up | down | flat' },
        trendLabel: { type: 'string' },
        delta: { type: 'string', description: '相对变化，如 "+3.2pp"/"-1.5%"' },
        color: { type: 'string' },
      },
    },
    title: { type: 'string', description: '标题' },
    startY: { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '展示核心业务指标，如销售额、增长率',
    notWhen:       '指标超过4个或需要详细图表分析时',
    scenarios: [
          {
                "trigger": "月度/季度运营数据总览",
                "example": "GMV、DAU、转化率、毛利率4个核心指标卡片式展示"
          },
          {
                "trigger": "业务健康度快速一览",
                "example": "比dataHighlight更适合：有目标值、实际值、环比变化三要素时"
          },
          {
                "trigger": "给高管看的数据摘要页",
                "example": "不需要图表，只看关键数字，配色区分好坏状态"
          }
    ],

    typicalHeight: '2.0~2.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/kpi-dashboard.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { extractDataHighlight } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const kpis = kps.slice(0, 6).map(kp => {
            const { number: v, label: l } = extractDataHighlight(kp);
            return { label: l, value: v, unit: '' };
          });
          return { kpis, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.1.1 (修 C-2 + M-4): schema 守卫 + 容量警告
    let kpis = data.kpis;
    if (!Array.isArray(kpis) || !kpis.length) {
      if (Array.isArray(data.metrics)) kpis = data.metrics;
      else if (Array.isArray(data.items)) kpis = data.items;
      else if (Array.isArray(data.cards)) kpis = data.cards;
    }
    if (!Array.isArray(kpis) || !kpis.length) {
      throw new Error('kpiDashboard 缺少必填字段 kpis（应为 [{ label, value, unit?, trend?, delta? }, ...]，最多 4 项）');
    }
    // M-4: 超容量 WARN（max=4）
    if (kpis.length > 4) {
      console.warn(`[kpiDashboard] WARN: 输入 ${kpis.length} 个 KPI，超过 layout 容量 4，只渲染前 4 个`);
    }
    const { title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const count = Math.min(kpis.length, 4);
    const gap = 0.25;
    const cardW = (totalW - gap * (count - 1)) / count;
    const cardH = Math.min(2.2, maxBottom - startY - (title ? 0.45 : 0));

    let curY = startY;
    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: baseX, y: curY, w: totalW, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, margin: 0
      });
      curY += 0.45;
    }

    kpis.slice(0, count).forEach((kpi, i) => {
      const x = baseX + i * (cardW + gap);
      const accentColor = kpi.color || STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: curY, w: cardW, h: cardH,
        rectRadius: 0.08, fill: { color: C.BG_LIGHT }, shadow: shadow(),
        line: { color: C.BORDER, width: 0.5 },
      });
      // v3.7.35: 顶部色带加厚 + 左侧细竖条增加二维装饰
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: curY, w: cardW, h: 0.08,
        fill: { color: accentColor }
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: curY, w: 0.08, h: cardH,
        fill: { color: accentColor, transparency: 60 }
      });

      const valueStr = String(kpi.value);
      const valueFs = calcFitFontSize(valueStr, cardW - 0.4, 0.6, 32, { minFontSize: 20 });
      slide.addText(valueStr, {
        x: x + 0.2, y: curY + 0.25, w: cardW - 0.4, h: 0.6,
        fontSize: valueFs, fontFace: FONTS.numeric,
        color: accentColor, bold: true, align: "center", valign: "middle", margin: 0
      });

      if (kpi.unit) {
        slide.addText(kpi.unit, {
          x: x + 0.2, y: curY + 0.85, w: cardW - 0.4, h: 0.3,
          fontSize: 13, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: "center", valign: "top", margin: 0
        });
      }

      const labelY = kpi.unit ? curY + 1.15 : curY + 0.9;
      const labelFs = calcFitFontSize(kpi.label, cardW - 0.4, 0.35, 13, { minFontSize: 9 });
      slide.addText(kpi.label, {
        x: x + 0.2, y: labelY, w: cardW - 0.4, h: 0.35,
        fontSize: labelFs, fontFace: FONTS.primary,
        color: C.TEXT, align: "center", valign: "top", margin: 0
      });

      // v4.1.1 (\u4FEE M-4): trend + delta \u540C\u65F6\u652F\u6301\uFF1Bdelta \u542B "+/-" \u65F6\u81EA\u52A8\u7740\u8272
      let trendY = labelY + 0.4;
      let arrow = "", trendColor = C.TEXT_LIGHT, trendText = "";
      if (kpi.trend) {
        if (kpi.trend === "up") { arrow = "\u25B2"; trendColor = C.SUCCESS; }
        else if (kpi.trend === "down") { arrow = "\u25BC"; trendColor = C.DANGER; }
        else { arrow = "\u25BA"; trendColor = C.TEXT_LIGHT; }
        trendText = kpi.trendLabel ? arrow + " " + kpi.trendLabel : arrow;
      }
      // delta \u5B57\u6BB5\uFF08\u5982 "+3.2pp" \u6216 "-1.5%"\uFF09\uFF1A\u81EA\u52A8\u7740\u8272 + \u81EA\u52A8\u7BAD\u5934
      if (kpi.delta != null && String(kpi.delta).length) {
        const dStr = String(kpi.delta).trim();
        const sign = dStr[0] === '-' ? 'down' : (dStr[0] === '+' ? 'up' : 'flat');
        if (sign === 'down') { arrow = "\u25BC"; trendColor = C.DANGER; }
        else if (sign === 'up') { arrow = "\u25B2"; trendColor = C.SUCCESS; }
        else { arrow = ""; trendColor = C.TEXT_LIGHT; }
        trendText = (arrow ? arrow + ' ' : '') + dStr;
      }
      if (trendText) {
        slide.addText(trendText, {
          x: x + 0.2, y: trendY, w: cardW - 0.4, h: 0.3,
          fontSize: 12, fontFace: FONTS.primary,
          color: trendColor, bold: true, align: "center", valign: "middle", margin: 0
        });
      }
    });

    const bottomY = curY + cardH;
    validateBounds(slide, bottomY);
  },
};
