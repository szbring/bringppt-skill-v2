'use strict';
// templates/impact-question.js
// Source: bring-core.js L1614-1644
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'impactQuestion',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '冲击提问：大字问题 + 答案框，支持高亮答案',

  schema: {
    question:        { type: 'string', required: true, description: '问题文本', warn: 30, error: 50 },
    answer:          { type: 'string', required: true, description: '回答文本', warn: 60, error: 100 },
    answerHighlight: { type: 'string', description: '高亮补充答案（可选）' },
    startY:          { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '引发思考、问题导入、关键洞察揭示',
    notWhen:       '数据展示、流程说明、多项并列内容',
    scenarios: [
          {
                "trigger": "用反问句引发思考、开启讨论",
                "example": "'如果供应链明天断了，你还有几天的库存？'——先问题后答案"
          },
          {
                "trigger": "演讲者想停顿让观众思考时",
                "example": "大字问题配小字答案，节奏感强，适合现场演讲"
          },
          {
                "trigger": "比engagementQuestion更需要整页强调时",
                "example": "独立一页强调一个颠覆性问题，不是放在内容页底部"
          }
    ],

    typicalHeight: '2.5~3.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/impact-question.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    return { question: kps[0] || title, answer: kps.slice(1).join('，') || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { question, answer, answerHighlight, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.2);
    const qFs = calcFitFontSize(question, 8.0, 1.2, 32, { minFontSize: 22, lineSpacing: 1.3 });
    slide.addText(question, {
      x: 1.0, y: startY, w: 8.0, h: 1.2,
      fontSize: qFs, fontFace: FONTS.primary,
      color: C.ACCENT, bold: true, align: "center", valign: "middle", margin: 0, autoFit: true
    });
    const aY = startY + 1.8, aH = answerHighlight ? 1.4 : 1.0;
    const aW = 7.0, aX = (10 - aW) / 2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: aX, y: aY, w: aW, h: aH, rectRadius: 0.08, fill: { color: C.BG_LIGHT }
    });
    slide.addShape(pres.shapes.RECTANGLE, { x: aX, y: aY, w: 0.07, h: aH, fill: { color: C.ACCENT } });
    slide.addText(answer, {
      x: aX + 0.3, y: aY + 0.1, w: aW - 0.6, h: answerHighlight ? 0.6 : aH - 0.2,
      fontSize: 15, fontFace: FONTS.primary, color: C.TEXT, lineSpacingMultiple: 1.4, valign: "middle", margin: 0
    });
    if (answerHighlight) {
      slide.addText(answerHighlight, {
        x: aX + 0.3, y: aY + 0.75, w: aW - 0.6, h: 0.5,
        fontSize: 17, fontFace: FONTS.primary, color: C.ACCENT, bold: true, margin: 0
      });
    }
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = aY + aH;
    validateBounds(slide, aY + aH);
  },
};
