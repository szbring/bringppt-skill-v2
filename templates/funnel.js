'use strict';
// templates/funnel.js
// Source: bring-core.js L2368-2440
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'funnel',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '漏斗图，展示各阶段转化流程',

  schema: {
    stages: { type: 'array', description: '阶段列表 [{ label, value?, desc? }]，3-5个阶段' },
    title:  { type: 'string', description: '标题' },
    startY: { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '展示销售漏斗、用户转化率等逐层递减的流程',
    notWhen:       '阶段数超过5个或不存在递减关系时',
    scenarios: [
          {
                "trigger": "销售漏斗、转化率分析",
                "example": "线索1000→意向300→商机100→成交30，展示各阶段转化"
          },
          {
                "trigger": "用户行为路径的层层筛选",
                "example": "注册→激活→留存→付费→推荐——用户成长漏斗"
          },
          {
                "trigger": "流程中的层层审批、过滤",
                "example": "500份简历→100面试→30录用→10入职——招聘漏斗"
          }
    ],

    typicalHeight: '3.0~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/funnel.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const stages = kps.slice(0, 5).map((kp, i) => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            return { label: t, value: 100 - i * 15, desc: d || '' };
          });
          return { stages, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { stages, title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const baseX = (10 - 8.5) / 2;
    const count = Math.min(stages.length, 5);

    let curY = startY;
    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: baseX, y: curY, w: 8.5, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, margin: 0
      });
      curY += 0.4;
    }

    const availH = maxBottom - curY;
    const gap = 0.08;
    const stageH = Math.min(0.7, (availH - gap * (count - 1)) / count);
    const maxTrapW = 5.0;
    const minTrapW = 2.0;
    const centerX = 5.0;
    const rightInfoX = centerX + maxTrapW / 2 + 0.3;
    const rightInfoW = baseX + 8.5 - rightInfoX;

    stages.slice(0, count).forEach((stage, i) => {
      const y = curY + i * (stageH + gap);
      const color = STEP_COLORS[i % STEP_COLORS.length];

      const ratio = count > 1 ? i / (count - 1) : 0;
      const trapW = maxTrapW - (maxTrapW - minTrapW) * ratio;
      const trapX = centerX - trapW / 2;

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: trapX, y, w: trapW, h: stageH,
        rectRadius: 0.06, fill: { color }
      });

      const labelFs = calcFitFontSize(stage.label, trapW - 0.4, stageH, 14, { minFontSize: 9 });
      slide.addText(stage.label, {
        x: trapX, y, w: trapW, h: stageH,
        fontSize: labelFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });

      if (stage.value != null) {
        slide.addText(String(stage.value), {
          x: rightInfoX, y, w: rightInfoW, h: stageH * 0.55,
          fontSize: 16, fontFace: FONTS.primary,
          color, bold: true, valign: "bottom", margin: 0
        });
      }

      if (stage.desc) {
        const descY = stage.value != null ? y + stageH * 0.5 : y;
        const descH = stage.value != null ? stageH * 0.5 : stageH;
        const descFs = calcFitFontSize(stage.desc, rightInfoW, descH, 11, { minFontSize: 8 });
        slide.addText(stage.desc, {
          x: rightInfoX, y: descY, w: rightInfoW, h: descH,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, valign: "top", margin: 0
        });
      }
    });

    const bottomY = curY + count * stageH + (count - 1) * gap;
    validateBounds(slide, bottomY);
  },
};
