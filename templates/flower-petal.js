'use strict';
// templates/flower-petal.js
// Source: bring-core.js L4223-4326
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'flowerPetal',
  version:     '1.0.0',
  category:    '并列型',
  description: '花瓣/四叶草图，4个半透明圆形交叉，中心有核心标签',

  schema: {
    center: { type: 'string', description: '中心标签文字' },
    petals: { type: 'array', description: '[{ title, desc?, color? }]，恰好4个' },
    startY: { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示4个相互关联的核心要素',
    notWhen:       '要素不是4个时',
    scenarios: [
          {
                "trigger": "4个并列要素围绕一个核心",
                "example": "以客户为中心的4个服务维度：速度/质量/价格/体验"
          },
          {
                "trigger": "比radialHub更需要交叉感、整体感时",
                "example": "4个要素既独立又相互支撑，半透明交叉视觉强调整体性"
          }
    ],

    typicalHeight: '约3.8英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/flower-petal.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return {
      petals: mapKpsToItems(keyPoints, { max: 6 }),
      center: (page && page.title) || '',
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { center = "", petals = [], startY: explicitStartY } = data;
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const availH = maxBottom - startY;

  const petalColors = [C.PRIMARY, C.ACCENT, C.SUCCESS, C.DANGER];
  const count = Math.min(petals.length, 4);
  if (count < 1) return;

  // Circle layout: 2x2 grid with overlap at center
  const diagramSize = Math.min(totalW * 0.55, availH * 0.95);
  const circleR = diagramSize / 2.8;
  const overlap = circleR * 0.5;
  const diagramCenterX = baseX + totalW * 0.35;
  const diagramCenterY = startY + availH / 2;

  // 2x2 positions: TL, TR, BL, BR
  const positions = [
    { x: diagramCenterX - overlap, y: diagramCenterY - overlap },  // top-left
    { x: diagramCenterX + overlap, y: diagramCenterY - overlap },  // top-right
    { x: diagramCenterX - overlap, y: diagramCenterY + overlap },  // bottom-left
    { x: diagramCenterX + overlap, y: diagramCenterY + overlap }   // bottom-right
  ];

  // Draw circles (semi-transparent)
  petals.slice(0, 4).forEach((petal, i) => {
    const pos = positions[i];
    const color = petal.color || petalColors[i];
    slide.addShape(pres.shapes.OVAL, {
      x: pos.x - circleR, y: pos.y - circleR, w: circleR * 2, h: circleR * 2,
      fill: { color, transparency: 25 },
      line: { color, width: 2 }
    });

    // Title inside each circle (offset away from center) — white text for contrast
    const offX = i % 2 === 0 ? -circleR * 0.4 : circleR * 0.4;
    const offY = i < 2 ? -circleR * 0.4 : circleR * 0.4;
    const titleFs = calcFitFontSize(petal.title || "", circleR * 1.0, 0.4, 14, { minFontSize: 9 });
    slide.addText(petal.title || "", {
      x: pos.x + offX - circleR * 0.5, y: pos.y + offY - 0.2, w: circleR * 1.0, h: 0.4,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
  });

  // Center label at intersection
  if (center) {
    const centerSize = overlap * 1.6;
    slide.addShape(pres.shapes.OVAL, {
      x: diagramCenterX - centerSize / 2, y: diagramCenterY - centerSize / 2,
      w: centerSize, h: centerSize,
      fill: { color: C.WHITE, transparency: 15 },
      line: { color: C.PRIMARY, width: 1.5 }
    });
    const centerFs = calcFitFontSize(center, centerSize - 0.15, centerSize - 0.15, 14, { minFontSize: 9 });
    slide.addText(center, {
      x: diagramCenterX - centerSize / 2, y: diagramCenterY - centerSize / 2,
      w: centerSize, h: centerSize,
      fontSize: centerFs, fontFace: FONTS.primary,
      color: C.PRIMARY, bold: true, align: "center", valign: "middle", margin: 0
    });
  }

  // Descriptions on the right side of diagram
  const descX = baseX + totalW * 0.65;
  const descW = totalW * 0.33;
  const descBlockH = availH / count;

  petals.slice(0, count).forEach((petal, i) => {
    if (!petal.desc) return;
    const color = petal.color || petalColors[i];
    const dy = startY + i * descBlockH;

    // Color indicator dot
    slide.addShape(pres.shapes.OVAL, {
      x: descX, y: dy + descBlockH / 2 - 0.08, w: 0.16, h: 0.16,
      fill: { color }
    });

    // Title
    slide.addText(petal.title || "", {
      x: descX + 0.22, y: dy + 0.05, w: descW - 0.25, h: descBlockH * 0.4,
      fontSize: 11, fontFace: FONTS.primary,
      color, bold: true, valign: "bottom", margin: 0
    });

    // Desc
    const descFs = calcFitFontSize(petal.desc, descW - 0.25, descBlockH * 0.5, 10, { minFontSize: 7 });
    slide.addText(petal.desc, {
      x: descX + 0.22, y: dy + descBlockH * 0.4 + 0.05, w: descW - 0.25, h: descBlockH * 0.5,
      fontSize: descFs, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, lineSpacingMultiple: 1.2, valign: "top", margin: 0
    });
  });

  validateBounds(slide, maxBottom);
  },
};
