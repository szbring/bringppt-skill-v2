'use strict';

const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'valueDriverTree',
  version: '1.0.0',
  category: '咨询框架',
  description: '左侧顶层指标，右侧逐层拆解为 2-4 个驱动因子，每节点包含数值与算子',

  schema: {
    root: {
      label: { type: 'string', required: true },
      value: { type: 'string', required: true },
      unit: { type: 'string' },
    },
    drivers: {
      type: 'array',
      required: true,
      min: 2,
      max: 4,
      item: {
        label: { type: 'string', required: true, warn: 12, error: 20 },
        value: { type: 'string', warn: 10, error: 15 },
        op: { type: 'string', description: '"+","-","×","÷"' },
        children: { type: 'array' },
      },
    },
  },

  usage: {
    when: '财务指标拆解到驱动因子：营收 = 客户数 × 客单价 × 复购率 × 转化率',
    notWhen: '非可拆解指标；纯并列概念请用 threeColumn',
    maxItems: 4,
    typicalHeight: '3.5"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/value-driver-tree.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const drivers = kps.slice(0, 4).map((kp) => {
      const { title, desc } = splitTitleDesc(kp);
      const m = (desc || kp).match(/(\d+(?:\.\d+)?\s*[%元万亿]+)/);
      return {
        label: title || kp,
        value: m ? m[1] : '',
        op: '×',
      };
    });
    return {
      root: { label: (page && page.title) || '核心指标', value: '100', unit: '' },
      drivers,
    };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, shadow, resolveStartY } = infra;
    const { root, drivers = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);

    const rootW = 2.2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 0.5, y: sy + 1.0, w: rootW, h: 1.5,
      rectRadius: 0.08, fill: { color: C.PRIMARY }, shadow: shadow(),
    });
    slide.addText(root.label, {
      x: 0.5, y: sy + 1.05, w: rootW, h: 0.6,
      fontSize: 15, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText(`${root.value} ${root.unit || ''}`.trim(), {
      x: 0.5, y: sy + 1.6, w: rootW, h: 0.8,
      fontSize: 30, fontFace: FONTS.numeric, bold: true,
      color: C.ACCENT, align: 'center', valign: 'middle', margin: 0,
    });

    const n = Math.min(drivers.length, 4);
    const driverX = 0.5 + rootW + 1.6;
    const driverW = 2.2;
    const totalH = n * 0.75 + (n - 1) * 0.15;
    const baseY = sy + 1.75 - totalH / 2;

    drivers.slice(0, n).forEach((d, i) => {
      const y = baseY + i * 0.9;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: driverX, y, w: driverW, h: 0.75,
        rectRadius: 0.06, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
      });
      slide.addText(d.label, {
        x: driverX + 0.1, y: y + 0.05, w: driverW - 0.2, h: 0.35,
        fontSize: 12, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: 'middle', margin: 0,
      });
      slide.addText(d.value || '', {
        x: driverX + 0.1, y: y + 0.4, w: driverW - 0.2, h: 0.3,
        fontSize: 14, fontFace: FONTS.numeric, bold: true,
        color: C.ACCENT, valign: 'middle', margin: 0,
      });

      const opChar = d.op || '×';
      slide.addText(opChar, {
        x: 0.5 + rootW + 0.5, y: y + 0.1, w: 0.6, h: 0.55,
        fontSize: 22, fontFace: FONTS.numeric, bold: true,
        color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
      });

      const fromX = 0.5 + rootW;
      const fromY = sy + 1.75;
      const toX = driverX;
      const toY = y + 0.375;
      const midX = (fromX + toX) / 2;

      slide.addShape(pres.shapes.LINE, {
        x: fromX, y: fromY, w: midX - fromX, h: 0,
        line: { color: C.SECONDARY, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: midX, y: Math.min(fromY, toY), w: 0, h: Math.abs(fromY - toY),
        line: { color: C.SECONDARY, width: 1.5 },
      });
      slide.addShape(pres.shapes.LINE, {
        x: midX, y: toY, w: toX - midX, h: 0,
        line: { color: C.SECONDARY, width: 1.5 },
      });
    });

    slide._bottomY = Math.max(sy + 2.5, baseY + totalH);
  },
};
