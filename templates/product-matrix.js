'use strict';
// templates/product-matrix.js — 产品矩阵跨档对比（v3.9.0 T-5）
//
// 3 档产品横向展示，每档含 form / power / cool / GPU / ideal-for 5 字段
// 适合"硬件产品方案 / SKU 对比 / 产品矩阵介绍"页

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'productMatrix',
  version:     '1.0.0',
  category:    '对比型',
  description: '产品矩阵：2-4 档产品横向并列展示，每档结构化字段（spec/价格/适用），用于硬件方案与 SKU 对比',

  schema: {
    products: {
      type: 'array',
      required: true,
      min: 2,
      max: 4,
      item: {
        sku: { type: 'string', required: true, warn: 8, error: 15 },
        tagline: { type: 'string', warn: 15, error: 28 },
        tagCN: { type: 'string' },
        badge: { type: 'string' },
        fields: {
          type: 'array',
          required: true,
          item: {
            label: { type: 'string', warn: 10, error: 18 },
            value: { type: 'string', warn: 30, error: 45 },
            sublabel: { type: 'string' }
          }
        },
        idealFor: { type: 'string', warn: 25, error: 40 },
        idealForCN: { type: 'string' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '2-4 档产品并列展示，每档有相同结构字段（规格 / 容量 / 价格 / 适用场景）',
    notWhen: '简单 2 列对比用 twoColumnCards；非产品矩阵用 cardGrid',
    typicalHeight: '4.0"',
    scenarios: [
      { trigger: '硬件产品 3 档矩阵', example: 'LE-44 / LE-88 / LE-200 三档算力箱' },
      { trigger: 'SaaS 套餐对比', example: 'Starter / Pro / Enterprise 三档' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/product-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    // 简易：每个 kp 是一档，用 "SKU: tagline | field1=val | field2=val | idealFor"
    const products = (keyPoints || []).slice(0, 4).map((kp) => {
      const parts = String(kp).split('|').map(s => s.trim());
      const first = parts[0] || '';
      const m = first.match(/^(.+?)[:：]\s*(.+)$/);
      const sku = m ? m[1].trim() : first.slice(0, 8);
      const tagline = m ? m[2].trim() : '';
      const fields = parts.slice(1, -1).map(p => {
        const fm = p.match(/^(.+?)=(.+)$/);
        return fm ? { label: fm[1].trim(), value: fm[2].trim() } : { label: 'Item', value: p };
      });
      const idealFor = parts[parts.length - 1] || '';
      return { sku, tagline, fields, idealFor };
    });
    return { products };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID, shadow } = infra;
    const { products = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y);

    const n = products.length;
    const gap = 0.2;
    const cardW = (GRID.CONTENT_WIDTH - gap * (n - 1)) / n;
    // v3.9.1: cardH 从 4.0 收口到 3.7，避免覆盖 logo（logo 顶部 y=4.95）
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || GRID.CONTENT_BOTTOM_Y;
    const cardH = Math.min(3.7, maxBottom - startY - 0.05);

    products.forEach((p, i) => {
      const x = GRID.LEFT + i * (cardW + gap);
      const accent = STEP_COLORS[i % STEP_COLORS.length];

      // 卡片本体
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: startY, w: cardW, h: cardH,
        rectRadius: 0.08, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
      });
      // 顶部色带
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cardW, h: 0.1, fill: { color: accent },
      });
      // FLAGSHIP / 旗舰 badge（右上角）
      if (p.badge) {
        slide.addShape(pres.shapes.RECTANGLE, {
          x: x + cardW - 1.0, y: startY + 0.12, w: 0.95, h: 0.28,
          fill: { color: C.ACCENT }, line: { color: C.ACCENT, width: 0 },
        });
        slide.addText(p.badge, {
          x: x + cardW - 1.0, y: startY + 0.12, w: 0.95, h: 0.28,
          fontSize: 9, fontFace: FONTS.enSmall, bold: true, charSpacing: 2,
          color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
        });
      }

      // v3.9.3: SKU 字号按长度自适应（中文 6+ 字降到 18pt 防越界）
      let cy = startY + 0.28;
      const skuLen = (p.sku || '').length;
      const skuFs = skuLen <= 4 ? 28 : (skuLen <= 6 ? 22 : 18);
      const skuH = skuLen <= 4 ? 0.5 : 0.85;  // 长 SKU 双行
      slide.addText(p.sku, {
        x: x + 0.2, y: cy, w: cardW - 0.4, h: skuH,
        fontSize: skuFs, fontFace: FONTS.title, bold: true,
        color: accent, valign: 'top', margin: 0,
      });
      cy += skuH + 0.05;
      if (p.tagline) {
        slide.addText(p.tagline, {
          x: x + 0.2, y: cy, w: cardW - 0.4, h: 0.28,
          fontSize: 11, fontFace: FONTS.enSmall, charSpacing: 1,
          color: C.TEXT_LIGHT, margin: 0,
        });
        cy += 0.3;
      }
      if (p.tagCN) {
        slide.addText(p.tagCN, {
          x: x + 0.2, y: cy, w: cardW - 0.4, h: 0.25,
          fontSize: 10, fontFace: FONTS.body,
          color: C.TEXT, margin: 0,
        });
        cy += 0.3;
      }

      // 分割线
      slide.addShape(pres.shapes.LINE, {
        x: x + 0.2, y: cy + 0.05, w: cardW - 0.4, h: 0,
        line: { color: C.BORDER, width: 0.5 },
      });
      cy += 0.15;

      // v3.9.5: 字段 inline 单行 — label 加粗前缀，value 跟在后面，值过长截断
      //   每行 0.4" 行高，font 9pt label + 10pt value，单行展示
      const fields = p.fields || [];
      const fieldsAvail = cardH - (cy - startY) - 0.65;
      const fieldH = Math.min(0.42, fieldsAvail / Math.max(1, fields.length));
      const maxValChars = Math.floor((cardW - 0.5) * 6);  // 估算单行能放多少字符
      fields.forEach((f) => {
        // 截断过长 value
        let val = f.value || '';
        if (val.length > maxValChars) val = val.slice(0, maxValChars - 1) + '…';
        // 用 addText 多段：label + 空格 + value 在一行
        slide.addText([
          { text: (f.label || '').toUpperCase() + '  ',
            options: { fontSize: 8, fontFace: FONTS.enSmall, color: accent, bold: true, charSpacing: 1 } },
          { text: val,
            options: { fontSize: 10, fontFace: FONTS.body, color: C.TEXT, bold: true } },
        ], {
          x: x + 0.2, y: cy, w: cardW - 0.4, h: fieldH,
          valign: 'middle', margin: 0,
        });
        // 单字段之间细分隔线（仅顶咨级视觉提示）
        if (fields.indexOf(f) < fields.length - 1) {
          slide.addShape(pres.shapes.LINE, {
            x: x + 0.2, y: cy + fieldH - 0.02, w: cardW - 0.4, h: 0,
            line: { color: C.BORDER, width: 0.25, transparency: 60 },
          });
        }
        cy += fieldH;
      });

      // 底部分割线 + idealFor
      slide.addShape(pres.shapes.LINE, {
        x: x + 0.2, y: startY + cardH - 0.65, w: cardW - 0.4, h: 0,
        line: { color: accent, width: 1 },
      });
      slide.addText('▸ IDEAL FOR', {
        x: x + 0.2, y: startY + cardH - 0.6, w: cardW - 0.4, h: 0.2,
        fontSize: 8, fontFace: FONTS.enSmall, charSpacing: 1,
        color: accent, bold: true, margin: 0,
      });
      if (p.idealFor) {
        // v3.9.3: idealFor 高度增加 + 长文截断
        const ifText = p.idealFor.length > 24 ? p.idealFor.slice(0, 22) + '…' : p.idealFor;
        slide.addText(ifText, {
          x: x + 0.2, y: startY + cardH - 0.42, w: cardW - 0.4, h: 0.4,
          fontSize: 9.5, fontFace: FONTS.body, bold: true,
          color: C.TEXT, valign: 'top', lineSpacingMultiple: 1.2, margin: 0,
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = startY + cardH + 0.2;
    validateBounds(slide, startY + cardH + 0.2);
  },
};
