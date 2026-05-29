'use strict';
// templates/risk-matrix.js
// v3.7.0 — 风险矩阵（概率 × 影响）：项目管理 / 风险评估的标准工具

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'riskMatrix',
  version:     '1.0.0',
  category:    '咨询框架',
  description: '风险矩阵（5×5 概率 × 影响）：将风险按发生概率与影响程度分类，标识优先级',

  schema: {
    risks: {
      type: 'array', required: false,
      description: '风险数组 [{ name, probability: 1-5, impact: 1-5, category? }]；按 probability/impact 坐标定位到矩阵格',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    size:     { type: 'string', required: false, description: '"3x3"（粗分类） / "5x5"（默认精细）' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:    '项目风险评估、变革管理、新业务进入风险扫描；视觉化优先级排序',
    notWhen: '机会评估（用 ansoffMatrix 或 bcgMatrix）；定性宏观分析（用 pestel）',
    typicalHeight: '3.8~4.2 英寸',
    scenarios: [
      { trigger: '咨询项目风险登记册', example: '识别 10-15 个项目风险，按概率×影响定位' },
      { trigger: '新业务进入风险扫描', example: '"市场风险 / 运营风险 / 合规风险"分类' },
      { trigger: '战略实施风险评估', example: '识别可能影响战略落地的关键风险点' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/risk-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  // v4.1.2 (修 P31 圆圈堆叠): 没有显式 probability/impact 时按索引散点分布，避免全部叠到 (3,3)
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    // 散点默认坐标
    // v4.1.3 (修 N-7): 旧表 (4,4)(3,2)(2,4)(5,3) 仍在 2x2 中央簇，4 个默认风险视觉聚簇。
    //   改为 5x5 网格四角 + 中心散布，前 4 个风险天然分散到 4 个对角区。
    const SCATTER = [
      { p: 5, i: 2 },  // 左上：高概率·低影响
      { p: 4, i: 5 },  // 右上：高概率·高影响
      { p: 2, i: 4 },  // 中下偏右：低概率·中高影响
      { p: 1, i: 1 },  // 左下：低概率·低影响
      { p: 3, i: 3 },  // 中央
      { p: 5, i: 5 },  // 极端右上
      { p: 2, i: 1 },  // 左下偏上
      { p: 4, i: 3 },  // 中上
    ];
    const risks = kps.slice(0, 8).map((kp, idx) => {
      const { title, desc } = splitTitleDesc(kp);
      const nums = (desc || '').match(/[1-5]/g) || [];
      const fallback = SCATTER[idx % SCATTER.length];
      return {
        name: title || '风险',
        probability: nums[0] ? parseInt(nums[0]) : fallback.p,
        impact:      nums[1] ? parseInt(nums[1]) : fallback.i,
      };
    });
    return { risks, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, resolveStartY, validateBounds, FONTS } = infra;
    const { risks = [], title, size = '5x5', startY } = data;

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2 (修 Mi-6 同类): 若页面已有 contentSlide 标题，跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.45;
    }

    const dim = size === '3x3' ? 3 : 5;
    // 矩阵区
    const mx = 1.4, my = curY + 0.1;
    // v3.7.13: mh 3.0 → 2.35 修复 overflow 0.45"
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const mw = 5.5, mh = Math.min(2.35, maxBottom - my - 0.7);
    const cellW = mw / dim;
    const cellH = (mh - 0.4) / dim;
    const cellPadX = Math.max(0.035, Math.min(0.07, cellW * 0.12));
    const cellPadY = Math.max(0.035, Math.min(0.07, cellH * 0.12));

    // 颜色按风险级别（probability * impact）— 用蓝灰系深浅
    function levelColor(p, i) {
      const score = p + i;  // 2-10 (5x5) 或 2-6 (3x3)
      const max = dim * 2;
      const ratio = score / max;
      if (ratio < 0.4) return C.BLUE_PALE;     // 低
      if (ratio < 0.7) return C.BLUE_LIGHT;    // 中
      if (ratio < 0.9) return C.SECONDARY;     // 高
      return C.PRIMARY;                         // 极高
    }

    // 渲染矩阵格子
    for (let p = dim; p >= 1; p--) {        // p = 概率（Y 轴，从下到上）
      for (let i = 1; i <= dim; i++) {      // i = 影响（X 轴，从左到右）
        const x = mx + (i - 1) * cellW;
        const y = my + (dim - p) * cellH;
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y, w: cellW - 0.02, h: cellH - 0.02,
          fill: { color: levelColor(p, i) },
          line: { color: C.WHITE, width: 0.5 },
        });
      }
    }

    // 渲染风险点（在对应格子内）
    // v4.1.2 (修 P31): 同格 dodge — 多风险落同格时按斜对角线散开避免完全重叠
    // v4.1.8 (修 P2-A): 圆圈直径 0.36" → 间距需 ≥ 0.36" 才不重叠；
    //   原 dx/dy = ±0.11 间距仅 0.22" → 圆圈仍叠加。改为 ±0.18（间距 0.36"），
    //   并把圆圈缩到 0.28" 以适应紧密 cell（cellW≈0.66"）。
    const cellCount = {};
    const circleD = Math.min(0.28, cellW - cellPadX * 2 - 0.02, cellH - cellPadY * 2 - 0.02);
    const DODGE = Math.min(0.18, Math.max(0.09, Math.min(cellW, cellH) * 0.22));
    risks.slice(0, 12).forEach((r, idx) => {
      const p = Math.max(1, Math.min(dim, r.probability || 1));
      const i = Math.max(1, Math.min(dim, r.impact || 1));
      const key = p + ',' + i;
      const stackIdx = cellCount[key] || 0;
      cellCount[key] = stackIdx + 1;
      // 同格内最多并排显示 4 个圆圈（2x2 排布），dodge 偏移控制在 cell 内
      const dx = (stackIdx % 2) * DODGE - DODGE / 2;
      const dy = Math.floor(stackIdx / 2) * DODGE - DODGE / 2;
      const cellX = mx + (i - 1) * cellW;
      const cellY = my + (dim - p) * cellH;
      const half = circleD / 2;
      const minCx = cellX + cellPadX + half;
      const maxCx = cellX + cellW - cellPadX - half;
      const minCy = cellY + cellPadY + half;
      const maxCy = cellY + cellH - cellPadY - half;
      const rawCx = cellX + cellW / 2 + dx;
      const rawCy = cellY + cellH / 2 + dy;
      const cx = Math.max(minCx, Math.min(maxCx, rawCx));
      const cy = Math.max(minCy, Math.min(maxCy, rawCy));
      // 小圆点 + 编号（v4.1.8：直径 0.28"）
      slide.addShape(pres.shapes.OVAL, {
        x: cx - half, y: cy - half, w: circleD, h: circleD,
        fill: { color: C.WHITE }, line: { color: C.PRIMARY, width: 1.5 },
      });
      slide.addText(String(idx + 1), {
        x: cx - half, y: cy - half, w: circleD, h: circleD,
        fontSize: 10, fontFace: FONTS.numeric, bold: true,
        color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
      });
    });

    // X 轴标签（底部）
    slide.addText('低', {
      x: mx, y: my + dim * cellH + 0.05, w: cellW, h: 0.25,
      fontSize: 9, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText('高', {
      x: mx + (dim - 1) * cellW, y: my + dim * cellH + 0.05, w: cellW, h: 0.25,
      fontSize: 9, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText('影响 Impact →', {
      x: mx, y: my + dim * cellH + 0.3, w: mw, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
    });

    // Y 轴标签（左侧）
    slide.addText('↑\n概率\nProb.', {
      x: 0.3, y: my + mh / 2 - 0.6, w: 1.0, h: 1.2,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'right', valign: 'middle',
      lineSpacingMultiple: 1.2, margin: 0,
    });

    // 右侧风险清单
    const listX = mx + mw + 0.3, listW = 2.5;
    if (risks.length > 0) {
      slide.addText('风险清单', {
        x: listX, y: my, w: listW, h: 0.3,
        fontSize: 12, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: 'middle', margin: 0,
      });
      const listText = risks.slice(0, 12).map((r, idx) => '#' + (idx + 1) + ' ' + r.name).join('\n');
      slide.addText(listText, {
        x: listX, y: my + 0.4, w: listW, h: mh - 0.4,
        fontSize: 9, fontFace: FONTS.primary,
        color: C.TEXT, lineSpacingMultiple: 1.5, valign: 'top', margin: 0,
      });
    }

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = my + mh + 0.7;
    validateBounds(slide, my + mh + 0.7, 'riskMatrix');
  },
};
