'use strict';
// templates/issue-tree.js
// v3.7.0 — Issue Tree / MECE 问题树（公开方法论：麦肯锡式 MECE 问题分解）

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'issueTree',
  version:     '1.0.0',
  category:    '咨询框架',
  description: 'Issue Tree / MECE 问题树：左侧根问题 → 中间 2-3 个子问题 → 右侧细分问题，层层 MECE 分解',

  schema: {
    root:     { type: 'string', required: true,  description: '根问题（中央 / 主标题，建议 ≤ 20 字）' },
    branches: {
      type: 'array', required: true,
      description: '一级分支 2-3 个 [{ title, items: [二级要点] }]；二级最多 4 项',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    rootEn:   { type: 'string', required: false, description: '根问题英文（可选）' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:    '将复杂问题逐层 MECE 分解；战略诊断、根因分析、方案设计中证明"穷尽且不重叠"',
    notWhen: '简单线性流程（用 stepList）；纯并列要素（用 cardGrid）',
    typicalHeight: '3.5~4.0 英寸',
    scenarios: [
      { trigger: '"如何提升业绩"的 MECE 拆解', example: '根=业绩提升 → 收入侧/成本侧 → 客单价/客户数/留存率' },
      { trigger: '"客户流失"根因分析', example: '根=流失 → 产品/服务/价格 → 各 2-3 个具体原因' },
      { trigger: '战略方案的 MECE 论证', example: '根=战略 → 业务/组织/数字化 → 各 2-3 项具体动作' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/issue-tree.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const root = (page && page.title) || splitTitleDesc(kps[0] || '').title || '核心问题';
    const branches = kps.slice(1).slice(0, 3).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      const items = (desc || '').split(/[、，；,;]/).map(s => s.trim()).filter(Boolean);
      return { title: title || '分支', items: items.length ? items : [desc || '要点'] };
    });
    return { root, branches, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    // v4.0.4: object → string 安全转换
    const asText = v => {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number') return String(v);
      if (typeof v === 'object') return v.title || v.label || v.text || v.name || '';
      return String(v);
    };
    const { root, rootEn, branches = [], title, startY } = data;
    const bCount = Math.min(branches.length, 3);
    if (!root || bCount === 0) {
      const sy0 = resolveStartY(slide, startY, 1.0);
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'issueTree', missingField: 'root + branches[]', hint: '需要 root (string) 与 2-3 个 {title, items[]} 分支', startY: sy0 });
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

    // v3.7.15: 横向总宽校准 — rootW + l1W + l2W + 间距 = 1.4 + 1.8 + 5.0 + 1.1 = 9.3，留 0.35×2 边距
    const rootX = 0.35, rootW = 1.4;
    const l1X = rootX + rootW + 0.3, l1W = 1.8;
    const l2X = l1X + l1W + 0.25, l2W = 5.0;
    // v3.7.13: treeH 3.6 → 2.9 修复 overflow 0.45"
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const treeH = Math.min(2.9, maxBottom - curY - 0.2);

    // 根问题块（垂直居中）
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: rootX, y: curY + (treeH - 1.4) / 2, w: rootW, h: 1.4,
      rectRadius: 0.1,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      shadow: shadow(),
    });
    slide.addText(asText(root), {
      x: rootX + 0.1, y: curY + (treeH - 1.4) / 2 + 0.05, w: rootW - 0.2, h: rootEn ? 0.8 : 1.3,
      fontSize: 16, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
    });
    if (rootEn) {
      slide.addText(rootEn, {
        x: rootX + 0.1, y: curY + (treeH - 1.4) / 2 + 0.9, w: rootW - 0.2, h: 0.4,
        fontSize: 10, fontFace: FONTS.enSmall,
        color: C.WHITE, transparency: 25,
        align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 一级分支：垂直平分高度
    const branchSlotH = treeH / bCount;
    branches.slice(0, bCount).forEach((br, i) => {
      const slotY = curY + i * branchSlotH;
      const cardH = Math.min(branchSlotH - 0.15, 1.0);
      const cardY = slotY + (branchSlotH - cardH) / 2;
      const color = STEP_COLORS[i % STEP_COLORS.length];

      // 根→分支连线（从根右侧到分支左侧）
      const rootMidY = curY + treeH / 2;
      const branchMidY = cardY + cardH / 2;
      // 水平段 + 垂直段 + 水平段（用 2 段 LINE 模拟"┐┘"）
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW, y: rootMidY, w: (l1X - rootX - rootW) / 2, h: 0,
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW + (l1X - rootX - rootW) / 2, y: Math.min(rootMidY, branchMidY),
        w: 0, h: Math.abs(rootMidY - branchMidY),
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: rootX + rootW + (l1X - rootX - rootW) / 2, y: branchMidY,
        w: (l1X - rootX - rootW) / 2, h: 0,
        line: { color: C.BLUE_LIGHT, width: 1.5 },
      });

      // 分支卡片
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: l1X, y: cardY, w: l1W, h: cardH,
        rectRadius: 0.06,
        fill: { color }, line: { color, width: 0 },
      });
      slide.addText(asText(br.title) || asText(br.label) || `分支 ${i + 1}`, {
        x: l1X + 0.1, y: cardY, w: l1W - 0.2, h: cardH,
        fontSize: 13, fontFace: FONTS.primary, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });

      // 二级要点：垂直分布在该分支的高度内
      // v4.0.4: 容忍 br.children 错配（部分作者用 children 代替 items）
      const items = (br.items || br.children || []).slice(0, 4);
      const iCount = items.length;
      if (iCount > 0) {
        const itemH = Math.min(0.5, (branchSlotH - 0.1) / iCount);
        items.forEach((it, j) => {
          const iy = slotY + (branchSlotH - iCount * itemH) / 2 + j * itemH;

          // 分支→要点连线
          const branchRightX = l1X + l1W;
          const itemMidY = iy + itemH / 2;
          slide.addShape(pres.shapes.LINE, {
            x: branchRightX, y: cardY + cardH / 2,
            w: 0.15, h: 0,
            line: { color: C.BLUE_PALE, width: 1 },
          });
          slide.addShape(pres.shapes.LINE, {
            x: branchRightX + 0.15, y: Math.min(cardY + cardH / 2, itemMidY),
            w: 0, h: Math.abs((cardY + cardH / 2) - itemMidY),
            line: { color: C.BLUE_PALE, width: 1 },
          });
          slide.addShape(pres.shapes.LINE, {
            x: branchRightX + 0.15, y: itemMidY,
            w: l2X - (branchRightX + 0.15), h: 0,
            line: { color: C.BLUE_PALE, width: 1 },
          });

          // 要点小卡片
          slide.addShape(pres.shapes.RECTANGLE, {
            x: l2X, y: iy + 0.04, w: l2W, h: itemH - 0.08,
            fill: { color: C.BG_LIGHT }, line: { color: color, width: 0 },
          });
          // 左侧 3pt 颜色条
          slide.addShape(pres.shapes.RECTANGLE, {
            x: l2X, y: iy + 0.04, w: 0.04, h: itemH - 0.08,
            fill: { color }, line: { color, width: 0 },
          });
          slide.addText(asText(it), {
            x: l2X + 0.15, y: iy, w: l2W - 0.25, h: itemH,
            fontSize: 11, fontFace: FONTS.primary,
            color: C.TEXT, valign: 'middle', margin: 0,
          });
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + treeH + 0.2;
    validateBounds(slide, curY + treeH + 0.2, 'issueTree');
  },
};
