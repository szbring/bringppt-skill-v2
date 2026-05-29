'use strict';
// templates/constraint-check.js — 三维约束校核（v3.9.0 T-5）
//
// "约束 × 产品 SKU" cross-table，每格显示通过/接近/超限 + 利用率
// 例如：空间 × LE-44 = 42U/42U (100%)
//      电力 × LE-44 = 41.3kW/44kW (94%)

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'constraintCheck',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '约束 × 产品的 cross-table 校核：每格"实际/预算 + 利用率"，用于工程约束验证类页面',

  schema: {
    constraints: {
      type: 'array',
      required: true,
      min: 2,
      max: 5,
      item: {
        label: { type: 'string', warn: 10, error: 18 },
        labelEn: { type: 'string' },
        unit: { type: 'string' },
        budget: { type: 'number' }
      }
    },
    products: {
      type: 'array',
      required: true,
      min: 1,
      max: 4,
      item: { sku: { type: 'string', required: true, warn: 8 } }
    },
    cells: {
      type: 'array',
      required: true,
      item: {
        constraint: { type: 'string', required: true },
        product: { type: 'string', required: true },
        value: { type: 'number', required: true },
        budget: { type: 'number' },
        status: { type: 'string' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '"多约束 × 多产品/方案"的可视化校核',
    notWhen: '简单 SWOT 用 twoColumnCards；产品参数对比用 productMatrix',
    typicalHeight: '3.5"',
    scenarios: [
      { trigger: '工程约束校核', example: '空间/电力/冷却 × 3 档算力箱' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/constraint-check.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    // 极简：keyPoints 全部作为 constraints 列表
    return {
      constraints: (keyPoints || []).slice(0, 5).map(k => ({ label: String(k).slice(0, 12) })),
      products: [{ sku: '方案 A' }, { sku: '方案 B' }],
      cells: [],
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID } = infra;
    const { constraints = [], products = [], cells = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y);

    const headerH = 0.45;
    const labelColW = 1.8;
    const cellW = (GRID.CONTENT_WIDTH - labelColW) / products.length;
    const rowH = Math.min(0.7, (3.4 - headerH) / Math.max(1, constraints.length));

    // 表头：产品 SKU
    products.forEach((p, j) => {
      const x = GRID.LEFT + labelColW + j * cellW;
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cellW - 0.05, h: headerH,
        fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      });
      slide.addText(p.sku, {
        x, y: startY, w: cellW - 0.05, h: headerH,
        fontSize: 14, fontFace: FONTS.title, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
    });

    // 行：constraints
    constraints.forEach((c, i) => {
      const y = startY + headerH + i * rowH;
      // 左侧 label
      slide.addText(c.label || '', {
        x: GRID.LEFT, y, w: labelColW - 0.1, h: rowH,
        fontSize: 11, fontFace: FONTS.title, bold: true,
        color: C.PRIMARY, valign: 'middle', margin: 0,
      });
      if (c.labelEn) {
        slide.addText(c.labelEn, {
          x: GRID.LEFT, y: y + rowH * 0.45, w: labelColW - 0.1, h: rowH * 0.4,
          fontSize: 8, fontFace: FONTS.enSmall, color: C.TEXT_LIGHT, margin: 0,
        });
      }

      // 单元格
      products.forEach((p, j) => {
        const x = GRID.LEFT + labelColW + j * cellW;
        // 查找 cell
        const cell = cells.find(cc => cc.constraint === c.label && cc.product === p.sku);
        const v = cell ? cell.value : 0;
        const budget = (cell && cell.budget) || c.budget || 100;
        const pct = Math.min(1, Math.max(0, v / budget));
        let statusColor;
        if (cell && cell.status === 'fail')       statusColor = C.TEXT;
        else if (cell && cell.status === 'tight') statusColor = STEP_COLORS[2];
        else                                       statusColor = C.SECONDARY;

        // cell 背景
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y, w: cellW - 0.05, h: rowH - 0.05,
          fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 },
        });
        // 利用率小条
        const barH = 0.08;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: x + 0.1, y: y + rowH - 0.2, w: (cellW - 0.25) * pct, h: barH,
          fill: { color: statusColor }, line: { color: statusColor, width: 0 },
        });
        // 数值
        const txt = cell ? `${v}/${budget} ${c.unit || ''}`.trim() : '—';
        slide.addText(txt, {
          x, y: y + 0.05, w: cellW - 0.05, h: rowH * 0.5,
          fontSize: 12, fontFace: FONTS.numeric, bold: true,
          color: statusColor, align: 'center', valign: 'middle', margin: 0,
        });
        // 百分比
        if (cell) {
          slide.addText(`${Math.round(pct * 100)}%`, {
            x, y: y + rowH * 0.5, w: cellW - 0.05, h: rowH * 0.2,
            fontSize: 9, fontFace: FONTS.body, color: C.TEXT_LIGHT,
            align: 'center', margin: 0,
          });
        }
      });
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + headerH + constraints.length * rowH + 0.2;
    validateBounds(slide, startY + headerH + constraints.length * rowH + 0.2);
  },
};
