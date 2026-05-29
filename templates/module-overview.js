'use strict';
// templates/module-overview.js
// Source: bring-core.js L1262-1334
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'moduleOverview',
  version:     '1.0.0',
  category:    '图文/复合型',
  description: '模块概览：带模块编号、标题、概述和主题卡片的章节封面',

  schema: {
    moduleNumber:   { type: 'number',   description: '模块编号（可选）' },
    moduleTitle:    { type: 'string',   required: true, description: '模块标题' },
    moduleSubtitle: { type: 'string',   description: '副标题（可选）', warn: 12, error: 20 },
    overview:       { type: 'string',   description: '概述文本（可选）', warn: 60, error: 100 },
    topics:         { type: 'array',    description: '主题卡片列表 [{number, title, desc}]（可选）', item: { title: { type: 'string', warn: 12, error: 20 }, desc: { type: 'string', warn: 30, error: 50 } } },
    startY:         { type: 'number',   description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '课程模块封面、章节概览、培训内容导览',
    notWhen:       '数据展示、流程图、对比分析',
    scenarios: [
          {
                "trigger": "章节封面页，介绍本章内容",
                "example": "第03章概览：带模块编号+总述段落+3-4个子主题卡片"
          },
          {
                "trigger": "比sectionSlide更需要内容预览时",
                "example": "章节有3个以上子模块，需要一页预览全部内容"
          }
    ],

    typicalHeight: '2.5~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/module-overview.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.18: moduleNumber 应为数字；overview ≤ 100 字；schema 要求 topics 必填
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    let overview = (kps[0] || title).slice(0, 100);
    const topics = kps.slice(0, 4).map((kp, i) => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { number: String(i + 1).padStart(2, '0'), title: (t || kp).slice(0, 12), desc: (d || '').slice(0, 30) };
    });
    return {
      moduleNumber:   (page && page.moduleNumber != null) ? Number(page.moduleNumber) || 1 : 1,
      moduleTitle:    title,
      moduleSubtitle: (page && page.subtitle) || '',
      overview,
      topics,
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { moduleNumber, moduleTitle, moduleSubtitle, overview, topics, startY: explicitStartY } = data;

    // v4.1.6: 守护框 + 居中
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    // 总高估算：panelH(1.30) + overview(0.25+0.80=1.05) + topics(0.35+1.0=1.35)
    let panelH = 1.30;
    let overviewBlock = overview ? 1.05 : 0;
    let topicsBlock = (topics && topics.length > 0) ? (overview ? 1.35 : 0.35 + 1.0) : 0;
    let totalH = panelH + overviewBlock + topicsBlock;
    // 若超出 available，缩 panelH 与 topicCardH
    const available = maxBottom - top;
    if (totalH > available) {
      const scale = available / totalH;
      panelH = Math.max(0.9, panelH * scale);
      overviewBlock = overview ? Math.max(0.7, overviewBlock * scale) : 0;
      topicsBlock = (topics && topics.length > 0) ? Math.max(0.9, topicsBlock * scale) : 0;
      totalH = panelH + overviewBlock + topicsBlock;
    }
    const startY = top + Math.max(0, (available - totalH) / 2);
    const panelW = 8.5;
    const panelX = (10 - panelW) / 2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: panelX, y: startY, w: panelW, h: panelH,
      rectRadius: 0.1, fill: { color: C.PRIMARY }
    });
    slide.addText(moduleNumber ? "MODULE " + String(moduleNumber).padStart(2, "0") : "", {
      x: panelX, y: startY + 0.15, w: panelW, h: 0.3,
      fontSize: 12, fontFace: FONTS.primary,
      color: C.WHITE, transparency: 25, bold: true, align: "center", margin: 0
    });
    slide.addText(moduleTitle, {
      x: panelX, y: startY + 0.4, w: panelW, h: 0.55,
      fontSize: 26, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
    if (moduleSubtitle) {
      slide.addText(moduleSubtitle, {
        x: panelX, y: startY + 0.95, w: panelW, h: 0.3,
        fontSize: 13, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 20, align: "center", margin: 0
      });
    }
    if (overview) {
      const ovY = startY + panelH + 0.25;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: panelX, y: ovY, w: panelW, h: 0.8, rectRadius: 0.06, fill: { color: C.BG_LIGHT }
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: panelX, y: ovY, w: 0.07, h: 0.8, fill: { color: C.SECONDARY }
      });
      slide.addText(overview, {
        x: panelX + 0.25, y: ovY + 0.05, w: panelW - 0.5, h: 0.7,
        fontSize: 13, fontFace: FONTS.primary,
        color: C.TEXT, lineSpacingMultiple: 1.4, valign: "middle", margin: 0
      });
    }
    if (topics && topics.length > 0) {
      const topicY = startY + panelH + (overview ? 1.3 : 0.35);
      // v4.1.6: 卡片高度自适应 — 不超 maxBottom
      const topicCardH = Math.max(0.7, Math.min(1.0, maxBottom - topicY - 0.05));
      const count = topics.length;
      const cardW = (panelW - (count - 1) * 0.25) / count;
      const topicColors = [C.PRIMARY, C.PRIMARY, C.PRIMARY, C.PRIMARY];
      topics.forEach((t, i) => {
        const x = panelX + i * (cardW + 0.25);
        const color = topicColors[i % topicColors.length];
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x, y: topicY, w: cardW, h: topicCardH, rectRadius: 0.06,
          fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 }
        });
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y: topicY, w: cardW, h: 0.07, fill: { color }
        });
        slide.addText((t.number ? t.number + "  " : "") + t.title, {
          x: x + 0.2, y: topicY + 0.15, w: cardW - 0.4, h: 0.35,
          fontSize: 15, fontFace: FONTS.primary, color, bold: true, margin: 0
        });
        if (t.desc && topicCardH > 0.75) {
          slide.addText(t.desc, {
            x: x + 0.2, y: topicY + 0.55, w: cardW - 0.4, h: Math.max(0.18, topicCardH - 0.60),
            fontSize: 11, fontFace: FONTS.primary, color: C.TEXT_LIGHT, margin: 0
          });
        }
      });
      const finalBottom = Math.min(topicY + 1.0, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'moduleOverview');
    } else if (overview) {
      const finalBottom = Math.min(startY + panelH + 1.05, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'moduleOverview');
    } else {
      const finalBottom = Math.min(startY + panelH, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'moduleOverview');
    }
  },
};
