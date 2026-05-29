'use strict';
// templates/decision-tree.js
// v3.7.0 — 决策树（战略选择 / 路径决策的标准工具）

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'decisionTree',
  version:     '1.0.0',
  category:    '咨询框架',
  description: '决策树：起始问题 → 分支条件 → 终点结论；适合"如果-则"型战略选择展示',

  schema: {
    root: { type: 'string', required: true, description: '起始决策点文字（如"是否进入海外市场？"），≤ 20 字' },
    branches: {
      type: 'array', required: true,
      description: '一级分支 2-3 个 [{ condition, outcome, sub: [{condition, outcome}] }]；condition 是判断条件（≤ 12 字），outcome 是结论（≤ 20 字），sub 可选',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:    '战略选择、路径决策、风险分支评估；表达"如果 X 则 Y"的判断逻辑',
    notWhen: '纯并列问题分解（用 issueTree）；流程步骤（用 stepList）',
    typicalHeight: '3.5~4.0 英寸',
    scenarios: [
      { trigger: '战略选择决策', example: '"是否进入海外市场" → "市场规模 ≥ X" → "本地化能力够" → "进入"' },
      { trigger: '产品路径决策', example: '"主推 SaaS 还是定制" 的 if-then 选择' },
      { trigger: '投资判断逻辑', example: '"基于 3 个条件判断是否值得投资"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/decision-tree.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const root = (page && page.title) || splitTitleDesc(kps[0] || '').title || '决策';
    const branches = kps.slice(1, 4).map(kp => {
      const { title: condition, desc: outcome } = splitTitleDesc(kp);
      return { condition: condition || '分支', outcome: outcome || '结果' };
    });
    if (branches.length === 0) {
      branches.push({ condition: '是', outcome: '继续' }, { condition: '否', outcome: '终止' });
    }
    return { root, branches, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    // v4.0.4: object → string 安全转换，应对 storyboard 字段错配
    const asText = v => {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (typeof v === 'object') return v.title || v.label || v.text || v.name || '';
      return String(v);
    };
    const { root, branches = [], title, startY } = data;
    const bCount = Math.min(branches.length, 3);
    if (!root || bCount === 0) {
      const sy0 = resolveStartY(slide, startY, 1.0);
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'decisionTree', missingField: 'root + branches[]', hint: '需要 root (string) 与 2-3 个 {condition, outcome, sub[]} 分支', startY: sy0 });
    }

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.45;
    }

    // 三栏：根决策（1.8") → 条件菱形 + 结论卡（5.5"）→ 子分支（2.5"）
    const rootX = 0.5, rootW = 1.6;
    const condX = rootX + rootW + 0.4, condW = 1.5;
    const outX = condX + condW + 0.3, outW = 2.5;
    const subX = outX + outW + 0.2, subW = 1.9;
    // v3.7.13: treeH 3.5 → 3.0 修复 overflow 0.25"
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const treeH = Math.min(3.0, maxBottom - curY - 0.1);

    // 根决策菱形（旋转 45° 的矩形 == DIAMOND 形）
    slide.addShape(pres.shapes.DIAMOND, {
      x: rootX, y: curY + (treeH - 1.5) / 2, w: rootW, h: 1.5,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      shadow: shadow(),
    });
    slide.addText(asText(root), {
      x: rootX + 0.15, y: curY + (treeH - 1.5) / 2 + 0.1, w: rootW - 0.3, h: 1.3,
      fontSize: 12, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: 'middle',
      lineSpacingMultiple: 1.2, margin: 0,
    });

    // 分支：垂直平分
    const branchSlotH = treeH / bCount;
    branches.slice(0, bCount).forEach((br, i) => {
      const slotY = curY + i * branchSlotH;
      const midY = slotY + branchSlotH / 2;
      const color = STEP_COLORS[i % STEP_COLORS.length];
      const isLight = (color === C.BLUE_PALE || color === C.INFO_GRAY);

      // 根 → 条件 连线（带"是/否"标签）
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW, y: curY + treeH / 2,
        w: (condX - rootX - rootW) / 2, h: 0,
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW + (condX - rootX - rootW) / 2,
        y: Math.min(curY + treeH / 2, midY),
        w: 0, h: Math.abs((curY + treeH / 2) - midY),
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW + (condX - rootX - rootW) / 2, y: midY,
        w: (condX - rootX - rootW) / 2, h: 0,
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });

      // 条件菱形
      const condY = midY - 0.4;
      slide.addShape(pres.shapes.DIAMOND, {
        x: condX, y: condY, w: condW, h: 0.8,
        fill: { color }, line: { color, width: 0 },
      });
      slide.addText(asText(br.condition) || '条件 ' + (i + 1), {
        x: condX + 0.1, y: condY, w: condW - 0.2, h: 0.8,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: isLight ? C.PRIMARY : C.WHITE,
        align: 'center', valign: 'middle', margin: 0,
      });

      // 条件 → 结论 连线
      slide.addShape(pres.shapes.RIGHT_ARROW, {
        x: condX + condW + 0.05, y: midY - 0.1, w: 0.2, h: 0.2,
        fill: { color: C.BLUE_LIGHT }, line: { color: C.BLUE_LIGHT, width: 0 },
      });

      // 结论卡
      const outY = midY - 0.45;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: outX, y: outY, w: outW, h: 0.9,
        rectRadius: 0.06,
        fill: { color: C.BG_LIGHT }, line: { color, width: 1 },
      });
      slide.addText(asText(br.outcome) || '结论 ' + (i + 1), {
        x: outX + 0.1, y: outY, w: outW - 0.2, h: 0.9,
        fontSize: 11, fontFace: FONTS.primary,
        color: C.TEXT, valign: 'middle',
        lineSpacingMultiple: 1.3, margin: 0,
      });

      // 子分支（如有）
      const subItems = (br.sub || []).slice(0, 2);
      if (subItems.length > 0) {
        const subTotalH = subItems.length * 0.5;
        const subStartY = midY - subTotalH / 2;
        subItems.forEach((sub, j) => {
          const sy2 = subStartY + j * 0.5;
          slide.addShape(pres.shapes.LINE, {
            x: outX + outW + 0.02, y: midY,
            w: 0.1, h: 0,
            line: { color: C.BLUE_PALE, width: 1 },
          });
          slide.addShape(pres.shapes.RECTANGLE, {
            x: subX, y: sy2, w: subW, h: 0.42,
            fill: { color: C.BG_PANEL }, line: { color: color, width: 0 },
          });
          slide.addShape(pres.shapes.RECTANGLE, {
            x: subX, y: sy2, w: 0.04, h: 0.42,
            fill: { color }, line: { color, width: 0 },
          });
          slide.addText((asText(sub.condition) ? asText(sub.condition) + ' → ' : '') + asText(sub.outcome), {
            x: subX + 0.1, y: sy2, w: subW - 0.15, h: 0.42,
            fontSize: 9, fontFace: FONTS.primary,
            color: C.TEXT, valign: 'middle', margin: 0,
          });
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + treeH + 0.1;
    validateBounds(slide, curY + treeH + 0.1, 'decisionTree');
  },
};
