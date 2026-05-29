'use strict';
// templates/fishbone.js
// Source: bring-core.js L2272-2367
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'fishbone',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '鱼骨图/因果分析图，展示问题根因',

  schema: {
    problem: { type: 'string', description: '核心问题' },
    causes:  { type: 'array', description: '原因分类 [{ category, items: string[] }]，3-6个分类' },
    startY:  { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '根因分析、问题诊断，找出导致问题的多维度原因',
    notWhen:       '原因少于3个或需要量化展示时',
    scenarios: [
          {
                "trigger": "5M1E根因分析（人机料法环管）",
                "example": "为什么交货延误？鱼骨图展示6个维度的根因"
          },
          {
                "trigger": "质量问题、故障原因分析",
                "example": "产品不良率高的原因：设备/原料/工艺/人员多角度分析"
          },
          {
                "trigger": "比causalChain更需要多维度发散时",
                "example": "causalChain是纵向因果链，fishbone是多维度放射状分析"
          }
    ],

    typicalHeight: '3.0~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/fishbone.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const causes = kps.slice(0, 6).map(kp => ({
            category: splitTitleDesc(kp).title,
            items:    splitTitleDesc(kp).desc ? [splitTitleDesc(kp).desc] : [],
          }));
          return { problem: title, causes };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    const { problem, causes = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(causes) || causes.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'fishbone', missingField: 'causes[]', hint: '需要 3-6 个 {category, items[]} 分类对象', startY });
    }
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const availH = maxBottom - startY;

    // Inset content area to avoid touching title/footer
    const insetTop = 0.15, insetBottom = 0.2;
    const innerTop = startY + insetTop;
    const innerH = availH - insetTop - insetBottom;

    const probW = 1.8, probH = 0.7;
    const probX = baseX + totalW - probW;
    const spineY = innerTop + innerH / 2;
    const probY = spineY - probH / 2;

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: probX, y: probY, w: probW, h: probH,
      rectRadius: 0.1, fill: { color: C.DANGER }, shadow: shadow()
    });
    const probFs = calcFitFontSize(problem, probW - 0.3, probH - 0.1, 14, { minFontSize: 9 });
    slide.addText(problem, {
      x: probX, y: probY, w: probW, h: probH,
      fontSize: probFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    const spineStartX = baseX + 0.3;
    const spineEndX = probX - 0.05; // Small gap before problem box
    slide.addShape(pres.shapes.LINE, {
      x: spineStartX, y: spineY, w: spineEndX - spineStartX, h: 0,
      line: { color: C.PRIMARY, width: 3 }
    });

    // Arrow head — v3.7.15: 改为细小箭头，宽度与脊线相近
    slide.addShape(pres.shapes.RIGHT_ARROW, {
      x: spineEndX - 0.12, y: spineY - 0.05, w: 0.14, h: 0.10,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 }
    });

    const count = Math.min(causes.length, 6);
    const branchZoneW = spineEndX - spineStartX - 0.3;
    const spacing = branchZoneW / count;

    causes.slice(0, count).forEach((cause, i) => {
      const color = STEP_COLORS[i % STEP_COLORS.length];
      const anchorX = spineStartX + 0.3 + i * spacing + spacing / 2;
      const isAbove = i % 2 === 0;
      const branchLen = innerH * 0.28;
      const endY = isAbove ? spineY - branchLen : spineY + branchLen;

      // v3.7.14: h 永远用正值（pptxgenjs 不支持 LINE 负 h），方向用 flipV 控制；
      // 上方分支：y = endY（起点在上），底端在 spineY → 需要 flipV 让线段反过来
      slide.addShape(pres.shapes.LINE, {
        x: anchorX, y: isAbove ? endY : spineY,
        w: spacing * 0.3, h: branchLen,
        line: { color, width: 2 }, flipV: isAbove
      });

      const catW = spacing * 0.9;
      const catH = 0.3;
      const catX = anchorX - catW * 0.1;
      const catY = isAbove ? endY - catH - 0.05 : endY + 0.05;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: catX, y: catY, w: catW, h: catH,
        rectRadius: 0.06, fill: { color }
      });
      const catFs = calcFitFontSize(cause.category, catW - 0.1, catH, 11, { minFontSize: 8 });
      slide.addText(cause.category, {
        x: catX, y: catY, w: catW, h: catH,
        fontSize: catFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });

      const items = cause.items || [];
      const itemH = 0.2;
      const maxItems = Math.min(items.length, 3);
      items.slice(0, maxItems).forEach((item, j) => {
        const itemY = isAbove
          ? catY - (j + 1) * (itemH + 0.03)
          : catY + catH + j * (itemH + 0.03) + 0.03;
        const itemFs = calcFitFontSize(item, catW - 0.1, itemH, 9, { minFontSize: 7 });
        slide.addText("• " + item, {
          x: catX, y: itemY, w: catW, h: itemH,
          fontSize: itemFs, fontFace: FONTS.primary,
          color: C.TEXT, valign: "middle", margin: 0
        });
      });
    });

    const bottomY = maxBottom;
    validateBounds(slide, bottomY);
  },
};
