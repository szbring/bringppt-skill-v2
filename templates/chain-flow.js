'use strict';
// templates/chain-flow.js
// Source: bring-core.js L3860-3940
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'chainFlow',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '链式流程图，3-6个椭圆形节点互相衔接形成链条',

  schema: {
    links:  { type: 'array', description: '[{ title, desc? }]，3-6个' },
    startY: { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示环环相扣的流程、供应链、价值链',
    notWhen:       '节点超过6个时',
    scenarios: [
          {
                "trigger": "环环相扣的价值链、供应链",
                "example": "采购→生产→仓储→分销→零售——椭圆形节点互相衔接"
          },
          {
                "trigger": "比processFlow更强调链条连续性时",
                "example": "步骤之间有明显的传递关系，不只是顺序执行"
          }
    ],

    typicalHeight: '约3.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/chain-flow.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { links: mapKpsToItems(keyPoints, { max: 6 }) };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { links = [], startY: explicitStartY } = data;
  // v4.1.6: 守护框 + 居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const count = Math.min(links.length, 6);
  const availH = maxBottom - top;

  // Calculate oval dimensions with overlap
  const overlap = 0.3;
  const ovalW = (totalW + overlap * (count - 1)) / count;
  // 期望高度：oval 1.5 + desc 1.0，但不超 availH
  const desiredH = 2.40;
  const useH = Math.min(desiredH, availH);
  const ovalH = Math.min(1.55, useH * 0.55);
  const descH = Math.max(0.2, useH - ovalH - 0.15);
  const stepX = ovalW - overlap;
  // 纵向居中
  const startY = top + Math.max(0, (availH - useH) / 2);
  const ovalY = startY;
  const descY = ovalY + ovalH + 0.12;

  links.slice(0, count).forEach((link, i) => {
    const color = STEP_COLORS[i % STEP_COLORS.length];
    const x = baseX + i * stepX;

    // Oval shape (chain link)
    slide.addShape(pres.shapes.OVAL, {
      x, y: ovalY, w: ovalW, h: ovalH,
      fill: { color, transparency: 10 },
      line: { color, width: 2 }, shadow: shadow()
    });

    // Number badge (small circle top-center)
    const badgeSize = 0.32;
    slide.addShape(pres.shapes.OVAL, {
      x: x + ovalW / 2 - badgeSize / 2, y: ovalY + 0.08, w: badgeSize, h: badgeSize,
      fill: { color: C.WHITE }
    });
    slide.addText(String(i + 1), {
      x: x + ovalW / 2 - badgeSize / 2, y: ovalY + 0.08, w: badgeSize, h: badgeSize,
      fontSize: 14, fontFace: FONTS.primary,
      color, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Title inside oval (centered)
    const titleAreaH = ovalH - 0.55;
    const titleFs = calcFitFontSize(link.title, ovalW - 0.4, titleAreaH, 14, { minFontSize: 9 });
    slide.addText(link.title, {
      x: x + 0.2, y: ovalY + 0.42, w: ovalW - 0.4, h: titleAreaH,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Flow arrow between ovals (except last)
    if (i < count - 1) {
      const arrowX = x + ovalW - overlap / 2;
      const arrowY = ovalY + ovalH / 2;
      slide.addShape(pres.shapes.ISOSCELES_TRIANGLE, {
        x: arrowX - 0.1, y: arrowY - 0.12, w: 0.2, h: 0.24,
        rotate: 90, fill: { color: C.WHITE }
      });
    }

    // Description below oval
    if (link.desc && descH > 0.2) {
      const descFs = calcFitFontSize(link.desc, ovalW - 0.3, descH, 10, { minFontSize: 7 });
      slide.addText(link.desc, {
        x: x + 0.15, y: descY, w: ovalW - 0.3, h: descH,
        fontSize: descFs, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, align: "center", valign: "top", lineSpacingMultiple: 1.2, margin: 0
      });
    }
  });

  const finalBottom = Math.min(descY + descH, maxBottom);
  slide._bottomY = finalBottom;
  validateBounds(slide, finalBottom, 'chainFlow');
  },
};
