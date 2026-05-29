'use strict';
// templates/achievement.js
// Source: bring-core.js L2755-2835
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'achievement',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '成就/指标展示卡片，1-4个指标，带圆形进度环视觉',

  schema: {
    metrics: { type: 'array', description: '[{ value, label, desc? }]，最多4个' },
    title:   { type: 'string', description: '可选标题' },
    startY:  { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示KPI、成果数据、关键指标',
    notWhen:       '超过4个指标时建议改用table',
    scenarios: [
          {
                "trigger": "展示成绩、里程碑、项目成果",
                "example": "项目完成率92%、客户满意度4.8分——用圆形进度环强调数值"
          },
          {
                "trigger": "季度/年度复盘汇报的亮点数据",
                "example": "年度营收增长35%、新增客户120家——2-4个核心成就并排展示"
          },
          {
                "trigger": "比 dataHighlight 更需要进度感时",
                "example": "有目标值和完成率的指标，如KPI完成度70%→100%"
          }
    ],

    typicalHeight: '约3.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/achievement.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { extractDataHighlight } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const metrics = kps.slice(0, 4).map(kp => {
            const { number: v, label: l } = extractDataHighlight(kp);
            return { label: l, value: v };
          });
          return { metrics };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫 — metrics 缺失时渲染友好占位而非 throw
    const { metrics = [], title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(metrics) || metrics.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'achievement', missingField: 'metrics[]', hint: '需要 2-4 个 {value, label, sublabel?} 对象数组', startY });
    }
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(metrics.length, 4);
  const gap = 0.3;
  const cardW = (totalW - gap * (count - 1)) / count;

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

  const cardH = Math.min(2.8, maxBottom - curY);
  const circleD = Math.min(cardW * 0.65, 1.2);

  metrics.slice(0, count).forEach((m, i) => {
    const x = baseX + i * (cardW + gap);
    const color = STEP_COLORS[i % STEP_COLORS.length];

    // Card background
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: curY, w: cardW, h: cardH,
      rectRadius: 0.1, fill: { color: C.BG_LIGHT }, shadow: shadow()
    });

    // Circle (progress ring visual)
    const cx = x + (cardW - circleD) / 2;
    const cy = curY + 0.25;
    slide.addShape(pres.shapes.OVAL, {
      x: cx, y: cy, w: circleD, h: circleD,
      fill: { color: C.WHITE },
      line: { color, width: 4 }
    });

    // Value inside circle
    const valStr = String(m.value);
    const valFs = calcFitFontSize(valStr, circleD - 0.3, circleD * 0.5, 24, { minFontSize: 14 });
    slide.addText(valStr, {
      x: cx, y: cy + circleD * 0.15, w: circleD, h: circleD * 0.5,
      fontSize: valFs, fontFace: FONTS.primary,
      color, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Label below circle
    const labelY = cy + circleD + 0.15;
    const labelFs = calcFitFontSize(m.label, cardW - 0.3, 0.4, 13, { minFontSize: 9 });
    slide.addText(m.label, {
      x: x + 0.15, y: labelY, w: cardW - 0.3, h: 0.4,
      fontSize: labelFs, fontFace: FONTS.primary,
      color: C.TEXT, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Description
    if (m.desc) {
      const descY = labelY + 0.4;
      const descH = curY + cardH - descY - 0.1;
      if (descH > 0.15) {
        const descFs = calcFitFontSize(m.desc, cardW - 0.3, descH, 11, { minFontSize: 8 });
        slide.addText(m.desc, {
          x: x + 0.15, y: descY, w: cardW - 0.3, h: descH,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: "center", valign: "top", margin: 0, lineSpacingMultiple: 1.2
        });
      }
    }
  });

  const bottomY = curY + cardH;
  validateBounds(slide, bottomY);
  },
};
