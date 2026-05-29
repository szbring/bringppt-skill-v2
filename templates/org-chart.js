'use strict';
// templates/org-chart.js
// Source: bring-core.js L4436-4608
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'orgChart',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '组织架构图，树形层级结构，最多3层',

  schema: {
    root:   { type: 'object', description: '{ title, role?, children?: [{ title, role?, children?: [] }] }' },
    startY: { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示组织结构、汇报关系、层级体系',
    notWhen:       '超过3层或节点过多时',
    scenarios: [
          {
                "trigger": "展示组织架构、汇报关系",
                "example": "新供应链中心架构设计：COO→供应链VP→3个部门长"
          },
          {
                "trigger": "变革后的新组织设计方案",
                "example": "改革前后组织架构对比，用两页orgChart说明变化"
          },
          {
                "trigger": "利益相关方层级关系",
                "example": "项目治理结构：委员会→项目组→工作流"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/org-chart.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const children = kps.slice(1).map(kp => ({ title: splitTitleDesc(kp).title }));
          return { root: { title: kps[0] ? splitTitleDesc(kps[0]).title : title, children } };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { root, startY: explicitStartY } = data;
  // v4.1.1 (修 C-2): schema 守卫——缺 root 时显式抛错，让上层 graceful 捕获到友好卡片
  if (!root || typeof root !== 'object' || (!root.title && !root.name)) {
    throw new Error('orgChart 缺少必填字段 root（应为 { title, children?: [] }）');
  }
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const totalW = 8.5, baseX = (10 - totalW) / 2;

  // Determine depth
  const children1 = root.children || [];
  let maxDepth = 1;
  if (children1.length > 0) {
    maxDepth = 2;
    children1.forEach(c => { if (c.children && c.children.length > 0) maxDepth = 3; });
  }

  const levelColors = [C.PRIMARY, C.SECONDARY, C.BG_LIGHT];
  const levelTextColors = [C.WHITE, C.WHITE, C.TEXT];
  const lineColor = C.BORDER;

  // Per-level node heights (smaller at deeper levels to prevent overlap)
  let nodeHeights = maxDepth === 3 ? [0.7, 0.65, 0.5] : maxDepth === 2 ? [0.75, 0.7] : [0.85];
  let totalNodeH = nodeHeights.reduce((s, h) => s + h, 0);
  let vertGap = Math.min(0.45, ((maxBottom - top) - totalNodeH) / Math.max(maxDepth - 1, 1));
  if (vertGap < 0.15) {
    // 缩节点高度让能放下
    const scale = (maxBottom - top - 0.15 * Math.max(maxDepth - 1, 1)) / totalNodeH;
    if (scale > 0 && scale < 1) {
      nodeHeights = nodeHeights.map(h => Math.max(0.40, h * scale));
      totalNodeH = nodeHeights.reduce((s, h) => s + h, 0);
      vertGap = Math.max(0.15, ((maxBottom - top) - totalNodeH) / Math.max(maxDepth - 1, 1));
    } else {
      vertGap = 0.15;
    }
  }
  // 实际总高度
  const treeH = totalNodeH + vertGap * Math.max(maxDepth - 1, 0);
  // 纵向居中
  const startY = top + Math.max(0, (maxBottom - top - treeH) / 2);
  const availH = maxBottom - startY;

  // Calculate level Y positions using per-level heights
  const levelY = [startY];
  for (let d = 1; d < maxDepth; d++) {
    levelY.push(levelY[d - 1] + nodeHeights[d - 1] + vertGap);
  }

  // Helper to draw a node with explicit height
  function drawNode(x, y, w, h, title, role, level) {
    const color = levelColors[Math.min(level, 2)];
    const textColor = levelTextColors[Math.min(level, 2)];
    // Per-level font size limits
    const titleMaxFs = level === 0 ? 13 : level === 1 ? 12 : 10;
    const titleMinFs = level === 2 ? 6 : level === 1 ? 8 : 9;
    const roleMaxFs = level === 2 ? 8 : 10;
    const roleMinFs = level === 2 ? 6 : 7;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h,
      rectRadius: 0.06, fill: { color },
      line: { color: level === 2 ? C.BORDER : color, width: level === 2 ? 1 : 0 },
      shadow: shadow()
    });
    const titleText = title || "";
    const hasRole = role && role.length > 0;
    const titleFs = calcFitFontSize(titleText, w - 0.15, hasRole ? h * 0.55 : h, titleMaxFs, { minFontSize: titleMinFs });
    slide.addText(titleText, {
      x: x + 0.05, y, w: w - 0.1, h: hasRole ? h * 0.55 : h,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: textColor, bold: true, align: "center", valign: hasRole ? "bottom" : "middle", margin: 0
    });
    if (hasRole) {
      const roleFs = calcFitFontSize(role, w - 0.15, h * 0.4, roleMaxFs, { minFontSize: roleMinFs });
      slide.addText(role, {
        x: x + 0.05, y: y + h * 0.55, w: w - 0.1, h: h * 0.4,
        fontSize: roleFs, fontFace: FONTS.primary,
        color: level === 2 ? C.TEXT_LIGHT : C.WHITE, align: "center", valign: "top",
        transparency: level < 2 ? 20 : 0, margin: 0
      });
    }
  }

  // Level 0: root node centered
  const rootW = Math.min(2.2, totalW * 0.25);
  const rootX = baseX + (totalW - rootW) / 2;
  drawNode(rootX, levelY[0], rootW, nodeHeights[0], root.title, root.role, 0);

  if (children1.length === 0) {
    validateBounds(slide, levelY[0] + nodeHeights[0]);
    return;
  }

  // Level 1: children spread
  const count1 = Math.min(children1.length, 6);
  const gap1 = 0.15;
  const nodeW1 = Math.min(1.8, (totalW - (count1 - 1) * gap1) / count1);
  const totalW1 = count1 * nodeW1 + (count1 - 1) * gap1;
  const startX1 = baseX + (totalW - totalW1) / 2;

  // Vertical line from root bottom
  const rootCenterX = rootX + rootW / 2;
  const junctionY1 = levelY[0] + nodeHeights[0] + vertGap * 0.4;
  slide.addShape(pres.shapes.LINE, {
    x: rootCenterX, y: levelY[0] + nodeHeights[0], w: 0, h: junctionY1 - (levelY[0] + nodeHeights[0]),
    line: { color: lineColor, width: 1.5 }
  });

  // Horizontal line connecting all level-1 children
  if (count1 > 1) {
    const firstCx = startX1 + nodeW1 / 2;
    const lastCx = startX1 + (count1 - 1) * (nodeW1 + gap1) + nodeW1 / 2;
    slide.addShape(pres.shapes.LINE, {
      x: firstCx, y: junctionY1, w: lastCx - firstCx, h: 0,
      line: { color: lineColor, width: 1.5 }
    });
  }

  // Store level-1 node center positions for grandchild alignment
  const l1Centers = [];
  children1.slice(0, count1).forEach((child, i) => {
    const cx = startX1 + i * (nodeW1 + gap1);
    const nodeCenterX = cx + nodeW1 / 2;
    l1Centers.push(nodeCenterX);

    // Vertical drop from junction to node
    slide.addShape(pres.shapes.LINE, {
      x: nodeCenterX, y: junctionY1, w: 0, h: levelY[1] - junctionY1,
      line: { color: lineColor, width: 1.5 }
    });

    drawNode(cx, levelY[1], nodeW1, nodeHeights[1], child.title, child.role, 1);
  });

  // Level 2: grandchildren — centered under PARENT center, not column zone
  if (maxDepth >= 3) {
    const gap2 = 0.05;
    const nodeW2 = 0.65;
    const nodeH2 = nodeHeights[2];
    const junctionY2 = levelY[1] + nodeHeights[1] + vertGap * 0.4;

    children1.slice(0, count1).forEach((child, i) => {
      if (!child.children || child.children.length === 0) return;
      const kids = child.children.slice(0, 4);
      const count2 = kids.length;
      const parentCenterX = l1Centers[i];

      // Calculate grandchild group centered under parent
      const totalW2 = count2 * nodeW2 + (count2 - 1) * gap2;
      const startX2 = parentCenterX - totalW2 / 2;

      // Clamp to slide boundaries
      const minX = baseX;
      const maxX = baseX + totalW - totalW2;
      const clampedStartX2 = Math.max(minX, Math.min(maxX, startX2));

      // Vertical line from parent bottom to junction
      slide.addShape(pres.shapes.LINE, {
        x: parentCenterX, y: levelY[1] + nodeHeights[1], w: 0, h: junctionY2 - (levelY[1] + nodeHeights[1]),
        line: { color: lineColor, width: 1 }
      });

      // Horizontal line for grandchildren (using SAME gap2 as node positioning)
      if (count2 > 1) {
        const firstGx = clampedStartX2 + nodeW2 / 2;
        const lastGx = clampedStartX2 + (count2 - 1) * (nodeW2 + gap2) + nodeW2 / 2;
        slide.addShape(pres.shapes.LINE, {
          x: firstGx, y: junctionY2, w: lastGx - firstGx, h: 0,
          line: { color: lineColor, width: 1 }
        });
      }

      kids.forEach((gc, gi) => {
        const gx = clampedStartX2 + gi * (nodeW2 + gap2);
        const gcCenterX = gx + nodeW2 / 2;

        slide.addShape(pres.shapes.LINE, {
          x: gcCenterX, y: junctionY2, w: 0, h: levelY[2] - junctionY2,
          line: { color: lineColor, width: 1 }
        });

        drawNode(gx, levelY[2], nodeW2, nodeH2, gc.title, gc.role, 2);
      });
    });
  }

  validateBounds(slide, levelY[maxDepth - 1] + nodeHeights[maxDepth - 1]);
  },
};
