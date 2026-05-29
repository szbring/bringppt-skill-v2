'use strict';
// templates/hourglass.js
// Source: bring-core.js L4051-4222
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'hourglass',
  version:     '1.0.0',
  category:    '对比型',
  description: '沙漏/蝴蝶结对比图，左右两侧列表通过中心漏斗形聚合',

  schema: {
    left:        { type: 'object', description: '{ label?, items: [{ title, desc? }] }，最多5项' },
    right:       { type: 'object', description: '{ label?, items: [{ title, desc? }] }，最多5项' },
    centerLabel: { type: 'string', description: '中心标签文字' },
    startY:      { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示问题→解决方案、现状→目标的对比转化',
    notWhen:       '每侧超过5个条目时',
    scenarios: [
          {
                "trigger": "问题聚焦→解决方案发散的沙漏结构",
                "example": "左侧列出5个痛点，中间漏斗汇聚，右侧展开5个解法"
          },
          {
                "trigger": "现状挑战 vs 目标状态的对比",
                "example": "左侧现状问题清单，右侧目标愿景清单，中间是变革"
          },
          {
                "trigger": "比comparison更强调'收敛-发散'结构时",
                "example": "两侧条目通过中心视觉上有聚合感的对比"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hourglass.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers.bisectKps 一行切两半
  fromKeyPoints(keyPoints, page) {
    const { bisectKps } = require('../lib/adapter-helpers');
    const { left, right } = bisectKps(keyPoints, 4);
    return {
      left:        { title: '问题', items: left },
      right:       { title: '方案', items: right },
      centerLabel: '转化',
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { left = {}, right = {}, centerLabel = "", startY: explicitStartY } = data;
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const availH = maxBottom - startY;

  const centerW = 1.0;
  const sideW = (totalW - centerW) / 2 - 0.15;
  const leftX = baseX;
  const rightX = baseX + totalW - sideW;
  const centerX = baseX + sideW + 0.15;

  const leftItems = (left.items || []).slice(0, 5);
  const rightItems = (right.items || []).slice(0, 5);
  const maxItems = Math.max(leftItems.length, rightItems.length, 1);

  // Section labels
  const labelH = 0.35;
  const leftLabel = left.label || "现状";
  const rightLabel = right.label || "目标";

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: leftX, y: startY, w: sideW, h: labelH,
    rectRadius: 0.04, fill: { color: C.DANGER }
  });
  slide.addText(leftLabel, {
    x: leftX, y: startY, w: sideW, h: labelH,
    fontSize: 13, fontFace: FONTS.primary,
    color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
  });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: rightX, y: startY, w: sideW, h: labelH,
    rectRadius: 0.04, fill: { color: C.SUCCESS }
  });
  slide.addText(rightLabel, {
    x: rightX, y: startY, w: sideW, h: labelH,
    fontSize: 13, fontFace: FONTS.primary,
    color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
  });

  // Items area
  const itemsStartY = startY + labelH + 0.1;
  const itemsAvailH = availH - labelH - 0.15;
  const itemGap = 0.08;
  const itemH = Math.min(1.0, (itemsAvailH - itemGap * (maxItems - 1)) / maxItems);

  // Left items (DANGER tint)
  leftItems.forEach((item, i) => {
    const iy = itemsStartY + i * (itemH + itemGap);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: leftX, y: iy, w: sideW, h: itemH,
      rectRadius: 0.06, fill: { color: C.DANGER, transparency: 88 },
      line: { color: C.DANGER, width: 0.5 }
    });
    // Number circle
    slide.addShape(pres.shapes.OVAL, {
      x: leftX + 0.1, y: iy + (itemH - 0.3) / 2, w: 0.3, h: 0.3,
      fill: { color: C.DANGER }
    });
    slide.addText(String(i + 1), {
      x: leftX + 0.1, y: iy + (itemH - 0.3) / 2, w: 0.3, h: 0.3,
      fontSize: 12, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
    // Title + desc
    const titleFs = calcFitFontSize(item.title || "", sideW - 0.6, itemH * 0.5, 12, { minFontSize: 9 });
    slide.addText(item.title || "", {
      x: leftX + 0.5, y: iy, w: sideW - 0.6, h: item.desc ? itemH * 0.5 : itemH,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.TEXT, bold: true, valign: "middle", margin: 0
    });
    if (item.desc) {
      const descFs = calcFitFontSize(item.desc, sideW - 0.6, itemH * 0.45, 10, { minFontSize: 7 });
      slide.addText(item.desc, {
        x: leftX + 0.5, y: iy + itemH * 0.5, w: sideW - 0.6, h: itemH * 0.45,
        fontSize: descFs, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, valign: "top", margin: 0
      });
    }
  });

  // Right items (SUCCESS tint)
  rightItems.forEach((item, i) => {
    const iy = itemsStartY + i * (itemH + itemGap);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rightX, y: iy, w: sideW, h: itemH,
      rectRadius: 0.06, fill: { color: C.SUCCESS, transparency: 88 },
      line: { color: C.SUCCESS, width: 0.5 }
    });
    // Number circle
    slide.addShape(pres.shapes.OVAL, {
      x: rightX + 0.1, y: iy + (itemH - 0.3) / 2, w: 0.3, h: 0.3,
      fill: { color: C.SUCCESS }
    });
    slide.addText(String(i + 1), {
      x: rightX + 0.1, y: iy + (itemH - 0.3) / 2, w: 0.3, h: 0.3,
      fontSize: 12, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
    // Title + desc
    const titleFs = calcFitFontSize(item.title || "", sideW - 0.6, itemH * 0.5, 12, { minFontSize: 9 });
    slide.addText(item.title || "", {
      x: rightX + 0.5, y: iy, w: sideW - 0.6, h: item.desc ? itemH * 0.5 : itemH,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.TEXT, bold: true, valign: "middle", margin: 0
    });
    if (item.desc) {
      const descFs = calcFitFontSize(item.desc, sideW - 0.6, itemH * 0.45, 10, { minFontSize: 7 });
      slide.addText(item.desc, {
        x: rightX + 0.5, y: iy + itemH * 0.5, w: sideW - 0.6, h: itemH * 0.45,
        fontSize: descFs, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, valign: "top", margin: 0
      });
    }
  });

  // Center hourglass/bowtie — two triangles
  // v3.7.14: bowH 严格对齐 items 实际总高（之前 maxItems*(itemH+itemGap) 比实际高 1 个 gap，
  // availH*0.6 上限又可能让漏斗比 items 矮，导致漏斗与列表大小不匹配）
  const itemsActualH = maxItems * itemH + (maxItems - 1) * itemGap;
  const bowH = itemsActualH;
  const bowCenterY = itemsStartY + bowH / 2;
  const triH = bowH / 2 - 0.05;
  const triW = centerW * 0.8;
  const triX = centerX + (centerW - triW) / 2;

  // Top triangle (pointing down) — left side converges to center
  slide.addShape(pres.shapes.ISOSCELES_TRIANGLE, {
    x: triX, y: bowCenterY - triH - 0.02, w: triW, h: triH,
    rotate: 180, fill: { color: C.ACCENT, transparency: 30 },
    line: { color: C.ACCENT, width: 1 }
  });
  // Bottom triangle (pointing up) — center diverges to right
  slide.addShape(pres.shapes.ISOSCELES_TRIANGLE, {
    x: triX, y: bowCenterY + 0.02, w: triW, h: triH,
    fill: { color: C.ACCENT, transparency: 30 },
    line: { color: C.ACCENT, width: 1 }
  });

  // Center label
  if (centerLabel) {
    const clFs = calcFitFontSize(centerLabel, centerW - 0.1, 0.35, 11, { minFontSize: 8 });
    slide.addText(centerLabel, {
      x: centerX, y: bowCenterY - 0.18, w: centerW, h: 0.36,
      fontSize: clFs, fontFace: FONTS.primary,
      color: C.ACCENT, bold: true, align: "center", valign: "middle", margin: 0
    });
  }

  // Arrows from left to center and center to right
  leftItems.forEach((_, i) => {
    const iy = itemsStartY + i * (itemH + itemGap) + itemH / 2;
    slide.addShape(pres.shapes.LINE, {
      x: leftX + sideW, y: iy, w: 0.15, h: 0,
      line: { color: C.DANGER, width: 1.2, endArrowType: "triangle" }
    });
  });
  rightItems.forEach((_, i) => {
    const iy = itemsStartY + i * (itemH + itemGap) + itemH / 2;
    slide.addShape(pres.shapes.LINE, {
      x: centerX + centerW, y: iy, w: 0.15, h: 0,
      line: { color: C.SUCCESS, width: 1.2, endArrowType: "triangle" }
    });
  });

  const bottomY = itemsStartY + maxItems * (itemH + itemGap);
  validateBounds(slide, bottomY);
  },
};
