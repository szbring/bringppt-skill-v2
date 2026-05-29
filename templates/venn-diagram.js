'use strict';
// templates/venn-diagram.js
// Source: bring-core.js L3151-3264
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'vennDiagram',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '韦恩图，2或3个交叉圆，展示共同与差异部分',

  schema: {
    circles: {
      type: 'array',
      description: '圆圈列表（2或3个）',
      item: {
        title: { type: 'string', required: true },
        items: { type: 'array', item: { type: 'string' } },
        color: { type: 'string' }
      }
    },
    intersection: { type: 'string', description: '交叉区域标签', default: '' },
    startY: { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '展示2-3个集合的共同点与差异，如产品对比、受众重叠',
    notWhen:       '超过3个集合，或需要精确数量关系',
    scenarios: [
          {
                "trigger": "两个概念的共同点与差异",
                "example": "效率 vs 效果的维恩图，中间是两者都关注的部分"
          },
          {
                "trigger": "产品差异化定位，找独特交叉点",
                "example": "客户需求 ∩ 技术能力 ∩ 竞争空白 = 差异化机会"
          },
          {
                "trigger": "受众重叠分析、用户画像交叉",
                "example": "两个用户群体的特征重叠，指导产品/营销设计"
          }
    ],

    typicalHeight: '3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/venn-diagram.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const mid = Math.ceil(kps.length / 2);
          return {
            circles: [
              { title: (page && page.leftTitle)  || '维度一', items: kps.slice(0, mid) },
              { title: (page && page.rightTitle) || '维度二', items: kps.slice(mid) },
            ],
            // schema 期望 intersection 是 string；之前误传 object 导致 pptxgenjs 渲染时报 forEach is not a function
            intersection: '共同点',
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.1.1 (修 C-2): schema 守卫——兼容 circles / sets / groups 三种命名，缺 circles 显式抛错
    let circles = data.circles;
    if (!Array.isArray(circles) || !circles.length) {
      if (Array.isArray(data.sets)) circles = data.sets;
      else if (Array.isArray(data.groups)) circles = data.groups;
    }
    if (!Array.isArray(circles) || circles.length < 2) {
      throw new Error('vennDiagram 缺少必填字段 circles（应为 2-3 个 [{ title, items?: [] }, ...]）');
    }
    const { intersection = "", startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const count = Math.min(circles.length, 3);
    if (count < 2) return;

    const availH = maxBottom - startY;
    const centerX = 5.0;
    const centerY = startY + availH / 2;
    const circleColors = [C.PRIMARY, C.ACCENT, C.SUCCESS];

    if (count === 2) {
      // Two overlapping circles
      const circleR = Math.min(1.5, availH / 2 - 0.1);
      const overlap = circleR * 0.55; // overlap amount
      const positions = [
        { x: centerX - circleR + overlap / 2, y: centerY },
        { x: centerX + circleR - overlap / 2, y: centerY }
      ];

      circles.slice(0, 2).forEach((circ, i) => {
        const pos = positions[i];
        const color = circ.color || circleColors[i];
        // Semi-transparent circle
        slide.addShape(pres.shapes.OVAL, {
          x: pos.x - circleR, y: pos.y - circleR, w: circleR * 2, h: circleR * 2,
          fill: { color, transparency: 60 },
          line: { color, width: 1.5 }
        });
        // Title at outer edge
        const titleX = i === 0 ? pos.x - circleR * 0.9 : pos.x + circleR * 0.1;
        slide.addText(circ.title, {
          x: titleX, y: pos.y - 0.5, w: circleR * 0.9, h: 0.4,
          fontSize: 14, fontFace: FONTS.primary,
          color, bold: true, align: "center", valign: "middle", margin: 0
        });
        // Items listed below title
        if (circ.items && circ.items.length > 0) {
          const itemText = circ.items.map(it => "• " + it).join("\n");
          const itemFs = calcFitFontSize(itemText, circleR * 0.85, circleR * 0.9, 10, { minFontSize: 7 });
          slide.addText(itemText, {
            x: titleX, y: pos.y - 0.05, w: circleR * 0.9, h: circleR * 0.9,
            fontSize: itemFs, fontFace: FONTS.primary,
            color: C.TEXT, lineSpacingMultiple: 1.3, margin: 0
          });
        }
      });

      // Intersection label
      if (intersection) {
        const intFs = calcFitFontSize(intersection, overlap * 1.2, 0.6, 12, { minFontSize: 8 });
        slide.addText(intersection, {
          x: centerX - overlap * 0.6, y: centerY - 0.3, w: overlap * 1.2, h: 0.6,
          fontSize: intFs, fontFace: FONTS.primary,
          color: C.DANGER, bold: true, align: "center", valign: "middle", margin: 0
        });
      }
    } else {
      // Three circles in triangle arrangement
      const circleR = Math.min(1.2, availH / 2 - 0.15);
      const spread = circleR * 0.7;
      const positions = [
        { x: centerX, y: centerY - spread },          // top
        { x: centerX - spread * 0.9, y: centerY + spread * 0.55 }, // bottom-left
        { x: centerX + spread * 0.9, y: centerY + spread * 0.55 }  // bottom-right
      ];

      // Normalized direction vectors pointing away from the venn center for each circle.
      // Text box is 0.7R × 0.7R centered at 0.38R in that direction.
      // Worst-case corner distance ≈ 0.87R — always inside the circle (R).
      const rawDirs = [
        { dx:  0,    dy: -1   },  // top
        { dx: -0.9,  dy:  0.5 },  // bottom-left
        { dx:  0.9,  dy:  0.5 },  // bottom-right
      ];
      const dirs = rawDirs.map(d => {
        const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy) || 1;
        return { dx: d.dx / mag, dy: d.dy / mag };
      });

      circles.slice(0, 3).forEach((circ, i) => {
        const pos = positions[i];
        const color = circ.color || circleColors[i];
        slide.addShape(pres.shapes.OVAL, {
          x: pos.x - circleR, y: pos.y - circleR, w: circleR * 2, h: circleR * 2,
          fill: { color, transparency: 55 },
          line: { color, width: 1.5 }
        });

        // Text box: guaranteed inside circle by construction
        const offset = 0.38 * circleR;   // center of box is 0.38R from circle center
        const boxW   = 0.70 * circleR;   // box width  (half = 0.35R)
        const boxH   = 0.70 * circleR;   // box height (half = 0.35R)
        const dir    = dirs[i];
        const bx     = pos.x + dir.dx * offset - boxW / 2;
        const by     = pos.y + dir.dy * offset - boxH / 2;

        // Title: upper 32% of box
        const titleH = boxH * 0.32;
        const titleFs = Math.max(9, Math.min(13, Math.round(circleR * 10)));
        slide.addText(circ.title, {
          x: bx, y: by, w: boxW, h: titleH,
          fontSize: titleFs, fontFace: FONTS.primary,
          color, bold: true, align: "center", valign: "middle", margin: 0
        });

        // Items: lower 65% of box
        if (circ.items && circ.items.length > 0) {
          const displayItems = circ.items.slice(0, 3);
          const itemText = displayItems.map(it => "• " + it).join("\n");
          const itemH  = boxH * 0.65;
          const itemFs = calcFitFontSize(itemText, boxW * 0.9, itemH, 9, { minFontSize: 7 });
          slide.addText(itemText, {
            x: bx + boxW * 0.05, y: by + titleH + boxH * 0.03,
            w: boxW * 0.9, h: itemH,
            fontSize: itemFs, fontFace: FONTS.primary,
            color: C.TEXT, lineSpacingMultiple: 1.2, margin: 0
          });
        }
      });

      // Intersection label at center
      if (intersection) {
        const intFs = calcFitFontSize(intersection, 1.0, 0.5, 12, { minFontSize: 8 });
        slide.addText(intersection, {
          x: centerX - 0.5, y: centerY - 0.15, w: 1.0, h: 0.5,
          fontSize: intFs, fontFace: FONTS.primary,
          color: C.DANGER, bold: true, align: "center", valign: "middle", margin: 0
        });
      }
    }

    validateBounds(slide, maxBottom);
  },
};
