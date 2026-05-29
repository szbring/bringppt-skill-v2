'use strict';
// templates/multi-project-cards.js
// Source: bring-core.js L3941-4050
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'multiProjectCards',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '多项目状态卡片，3-5个项目并排展示，含进度条',

  schema: {
    projects: { type: 'array', description: '[{ name, status?, items?: [], progress?: number }]，3-5个' },
    startY:   { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示多个并行项目的状态和进度',
    notWhen:       '项目超过5个时',
    scenarios: [
          {
                "trigger": "3-5个并行项目的状态总览",
                "example": "Q2在跑的5个项目：各自进度条+状态标签+负责人"
          },
          {
                "trigger": "项目集管理、Portfolio汇报",
                "example": "给PMO或高管看的项目群全景图，一页看清所有在途项目"
          }
    ],

    typicalHeight: '约3.8英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/multi-project-cards.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const projects = kps.slice(0, 4).map((kp, i) => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            return { name: t, progress: 0, status: '进行中', desc: d || '' };
          });
          return { projects };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { projects = [], startY: explicitStartY } = data;
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(Math.max(projects.length, 1), 5);
  const gap = 0.12;
  const cardW = (totalW - (count - 1) * gap) / count;
  const availH = maxBottom - startY;
  const cardH = availH;
  const headerH = 0.06;
  const nameH = 0.4;
  const progressH = 0.55;
  const itemsH = cardH - headerH - nameH - progressH - 0.15;

  projects.slice(0, count).forEach((proj, i) => {
    const color = STEP_COLORS[i % STEP_COLORS.length];
    const x = baseX + i * (cardW + gap);
    const y = startY;

    // Card background
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: cardW, h: cardH,
      rectRadius: 0.08, fill: { color: C.WHITE },
      line: { color: C.BORDER, width: 0.5 }, shadow: shadow()
    });

    // Colored top bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: headerH,
      fill: { color }
    });

    // Project name
    const nameFs = calcFitFontSize(proj.name || "", cardW - 0.2, nameH, 14, { minFontSize: 9 });
    slide.addText(proj.name || "", {
      x: x + 0.1, y: y + headerH, w: cardW - 0.2, h: nameH,
      fontSize: nameFs, fontFace: FONTS.primary,
      color: C.TEXT, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Status badge
    const statusText = proj.status || "";
    if (statusText) {
      const badgeW = Math.min(cardW - 0.3, 1.0);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: x + (cardW - badgeW) / 2, y: y + headerH + nameH - 0.05, w: badgeW, h: 0.22,
        rectRadius: 0.04, fill: { color, transparency: 80 }
      });
      slide.addText(statusText, {
        x: x + (cardW - badgeW) / 2, y: y + headerH + nameH - 0.05, w: badgeW, h: 0.22,
        fontSize: 9, fontFace: FONTS.primary,
        color, bold: true, align: "center", valign: "middle", margin: 0
      });
    }

    // Items list
    const itemsY = y + headerH + nameH + 0.2;
    if (proj.items && proj.items.length > 0) {
      const itemText = proj.items.map(it => "•  " + it).join("\n");
      const itemFs = calcFitFontSize(itemText, cardW - 0.3, itemsH, 11, { minFontSize: 7 });
      slide.addText(itemText, {
        x: x + 0.15, y: itemsY, w: cardW - 0.3, h: itemsH,
        fontSize: itemFs, fontFace: FONTS.primary,
        color: C.TEXT, lineSpacingMultiple: 1.3, valign: "top", margin: 0
      });
    }

    // Progress % at bottom
    const progress = typeof proj.progress === "number" ? proj.progress : 0;
    const progY = y + cardH - progressH;
    slide.addText(progress + "%", {
      x: x + 0.1, y: progY, w: cardW - 0.2, h: progressH - 0.25,
      fontSize: Math.min(28, Math.max(18, Math.floor(cardW * 14))), fontFace: FONTS.primary,
      color, bold: true, align: "center", valign: "bottom", margin: 0
    });

    // Progress bar (proportional) — thicker for visibility
    const barY = y + cardH - 0.28;
    const barW = cardW - 0.3;
    const barX = x + 0.15;
    const barH = 0.18;
    // Track background
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: barX, y: barY, w: barW, h: barH,
      rectRadius: 0.09, fill: { color: C.BORDER }
    });
    // Fill (proportional to progress %)
    if (progress > 0) {
      const fillW = Math.max(barH, barW * (progress / 100));
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: barX, y: barY, w: fillW, h: barH,
        rectRadius: 0.09, fill: { color }
      });
      // Percentage label on bar
      slide.addText(progress + "%", {
        x: barX, y: barY, w: barW, h: barH,
        fontSize: 8, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
    }
  });

  validateBounds(slide, startY + cardH);
  },
};
