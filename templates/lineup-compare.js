'use strict';
// templates/lineup-compare.js — 2 档产品对比 + 指标利用率（v3.9.0 T-5）
//
// LiquidEdge p-8 风格："LE-88 vs LE-200" 两侧对比，每侧 4 个配置选项 + 底部 3 个利用率条

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'lineupCompare',
  version:     '1.0.0',
  category:    '对比型',
  description: '2 档产品横向对比：每侧 SKU 标题 + 4 个 GPU/配置选项 + 底部 3 个 利用率条，用于 SKU 深度对比',

  schema: {
    columns: {
      type: 'array',
      required: true,
      min: 2,
      max: 2,
      item: {
        sku: { type: 'string', required: true, warn: 8, error: 15 },
        tagline: { type: 'string', warn: 18, error: 30 },
        tagCN: { type: 'string' },
        options: {
          type: 'array',
          required: true,
          min: 2,
          max: 5,
          item: {
            spec: { type: 'string', required: true, warn: 18, error: 30 },
            metric: { type: 'string' },
            badge: { type: 'string' }
          }
        },
        utilizations: {
          type: 'array',
          item: {
            label: { type: 'string' },
            value: { type: 'number' },
            max: { type: 'number' },
            unit: { type: 'string' },
            note: { type: 'string' }
          }
        }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '2 个 SKU/方案的深度对比，每个 SKU 有多个配置选项 + 利用率指标',
    notWhen: '3+ 档产品矩阵用 productMatrix；纯文字对比用 twoColumnCards',
    typicalHeight: '4.0"',
    scenarios: [
      { trigger: '2 档算力箱对比', example: 'LE-88 vs LE-200，4 个 GPU 选项 + 利用率条' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/lineup-compare.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    // 极简：前半 keyPoints 是 SKU A 的 options，后半是 B 的
    const kps = keyPoints || [];
    const half = Math.ceil(kps.length / 2);
    return {
      columns: [
        { sku: '方案 A', options: kps.slice(0, half).map(o => ({ spec: String(o) })) },
        { sku: '方案 B', options: kps.slice(half).map(o => ({ spec: String(o) })) },
      ]
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID, shadow } = infra;
    // v4.1.1 (修 C-2): schema 守卫——支持 columns / items / sides 三种命名（用户常见误写）
    let columns = data.columns;
    if (!Array.isArray(columns) || !columns.length) {
      // 兼容 items / sides
      if (Array.isArray(data.items)) columns = data.items;
      else if (Array.isArray(data.sides)) columns = data.sides;
    }
    if (!Array.isArray(columns) || columns.length < 2) {
      throw new Error('lineupCompare 缺少必填字段 columns（应为 2 项数组 [{ sku, tagline, options: [...] }, ...]）');
    }
    const { startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y);

    const gap = 0.25;
    const colW = (GRID.CONTENT_WIDTH - gap) / 2;
    // v3.9.1: totalH 从 4.2 收口到 3.7，避免覆盖 logo
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || GRID.CONTENT_BOTTOM_Y;
    const totalH = Math.min(3.7, maxBottom - startY - 0.05);
    const headerH = 0.7;
    // v4.0.2: utilH 从 1.0 收口到 0.85，腾出 0.15" 给 options 行高
    const utilH = columns.some(c => c.utilizations && c.utilizations.length) ? 0.85 : 0;
    const optsH = totalH - headerH - utilH - 0.2;

    columns.forEach((col, i) => {
      const x = GRID.LEFT + i * (colW + gap);
      const accent = STEP_COLORS[i % STEP_COLORS.length];

      // 边框框
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: colW, h: totalH,
        fill: { color: C.BG_LIGHT, transparency: 80 },
        line: { color: accent, width: 1.5 },
      });

      // 顶部 SKU + tagline
      slide.addText(col.sku, {
        x: x + 0.2, y: startY + 0.15, w: colW - 0.4, h: 0.5,
        fontSize: 28, fontFace: FONTS.title, bold: true,
        color: C.PRIMARY, margin: 0,
      });
      if (col.tagline) {
        slide.addText(col.tagline, {
          x: x + 0.2, y: startY + 0.55, w: colW - 0.4, h: 0.25,
          fontSize: 11, fontFace: FONTS.enSmall, charSpacing: 1,
          color: C.TEXT_LIGHT, margin: 0,
        });
      }
      if (col.tagCN) {
        slide.addText(col.tagCN, {
          x: x + 0.2, y: startY + 0.8, w: colW - 0.4, h: 0.25,
          fontSize: 10, fontFace: FONTS.body, color: C.TEXT, margin: 0,
        });
      }

      // options 区
      slide.addText('▸ GPU OPTIONS · GPU 配置选项', {
        x: x + 0.2, y: startY + headerH + 0.3, w: colW - 0.4, h: 0.25,
        fontSize: 9, fontFace: FONTS.enSmall, charSpacing: 1,
        color: accent, bold: true, margin: 0,
      });
      const opts = col.options || [];
      const optH = (optsH - 0.4) / Math.max(1, opts.length);
      opts.forEach((o, j) => {
        const oy = startY + headerH + 0.55 + j * optH;
        // 行底
        slide.addShape(pres.shapes.RECTANGLE, {
          x: x + 0.2, y: oy + 0.02, w: colW - 0.4, h: optH - 0.05,
          fill: { color: C.WHITE }, line: { color: C.BORDER, width: 0.3 },
        });
        // 三角符号
        slide.addText('▸', {
          x: x + 0.25, y: oy + 0.05, w: 0.2, h: optH - 0.1,
          fontSize: 11, fontFace: FONTS.body, color: accent,
          valign: 'middle', margin: 0,
        });
        // v4.0.2: spec + metric 合并为单 textBox + 多 runs，让 pptxgenjs 自动处理行间距
        // 之前两个独立 textBox + 各自 valign:middle，optH 较小时垂直叠加
        // 字号 11/9 → 10.5/8.5、lineSpacingMultiple 1.15 → 1.0，确保双行总高 ≤ optH-0.04
        const specRuns = [
          { text: o.spec, options: { fontSize: 10.5, fontFace: FONTS.body, bold: true, color: C.TEXT } },
        ];
        if (o.metric) {
          specRuns.push({
            text:    '\n' + o.metric,
            options: { fontSize: 8.5, fontFace: FONTS.body, italic: true, color: C.TEXT_LIGHT },
          });
        }
        // textBox 高度对齐行底矩形，避免文字底部被框线压切
        slide.addText(specRuns, {
          x: x + 0.45, y: oy + 0.02, w: colW - 1.6, h: optH - 0.05,
          valign: 'middle', margin: 0, lineSpacingMultiple: 1.0,
        });
        // badge 右侧
        if (o.badge) {
          slide.addText(o.badge, {
            x: x + colW - 1.2, y: oy + 0.05, w: 1.0, h: optH - 0.1,
            fontSize: 11, fontFace: FONTS.numeric, bold: true,
            color: accent, align: 'right', valign: 'middle', margin: 0,
          });
        }
      });

      // 底部 utilizations
      if (col.utilizations && col.utilizations.length) {
        const uts = col.utilizations.slice(0, 3);
        const utWidth = (colW - 0.4 - 0.15 * (uts.length - 1)) / uts.length;
        const utY = startY + headerH + optsH + 0.25;
        uts.forEach((u, j) => {
          const ux = x + 0.2 + j * (utWidth + 0.15);
          const pct = Math.min(1, (u.value || 0) / (u.max || 100));
          // label
          slide.addText(u.label, {
            x: ux, y: utY, w: utWidth, h: 0.2,
            fontSize: 9, fontFace: FONTS.enSmall, charSpacing: 1,
            color: accent, bold: true, margin: 0,
          });
          // bar track
          slide.addShape(pres.shapes.RECTANGLE, {
            x: ux, y: utY + 0.25, w: utWidth, h: 0.12,
            fill: { color: C.BG_PANEL }, line: { color: C.BG_PANEL, width: 0 },
          });
          // bar fill
          slide.addShape(pres.shapes.RECTANGLE, {
            x: ux, y: utY + 0.25, w: utWidth * pct, h: 0.12,
            fill: { color: accent }, line: { color: accent, width: 0 },
          });
          // 数值
          slide.addText(`${u.value}/${u.max} ${u.unit || ''}`, {
            x: ux, y: utY + 0.4, w: utWidth, h: 0.22,
            fontSize: 10, fontFace: FONTS.numeric, bold: true,
            color: C.TEXT, margin: 0,
          });
          // note
          if (u.note) {
            slide.addText(u.note, {
              x: ux, y: utY + 0.6, w: utWidth, h: 0.22,
              fontSize: 8, fontFace: FONTS.body, italic: true,
              color: C.TEXT_LIGHT, margin: 0,
            });
          }
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + totalH + 0.2;
    validateBounds(slide, startY + totalH + 0.2);
  },
};
