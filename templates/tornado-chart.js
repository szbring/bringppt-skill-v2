'use strict';
// templates/tornado-chart.js — 龙卷风敏感性分析图
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'tornadoChart',
  version:     '1.0.0',
  category:    '分析/诊断型',
  description: '敏感性分析：各因素对基线的正负偏离，按绝对值降序排列形成"龙卷风"形',

  schema: {
    baseline: { type: 'number', required: true, description: '基线值' },
    factors:  { type: 'array', min: 3, max: 8, required: true,
      item: { name: { type: 'string', required: true, warn: 12, error: 20 },
              low:  { type: 'number', required: true },
              high: { type: 'number', required: true } } },
  },

  usage: {
    when:    '财务建模 / 估值 / 投资决策的敏感性',
    notWhen: '非连续变量；分类对比用 chartBar',
    maxItems: 8,
    typicalHeight: '3.5"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/tornado-chart.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const factors = kps.slice(0, 8).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      const nums = (desc || '').match(/(-?\d+(?:\.\d+)?)/g) || [];
      return {
        name: title || kp,
        low:  parseFloat(nums[0]) || -(10 + i * 2),
        high: parseFloat(nums[1]) || (10 + i * 2),
      };
    });
    // 按 |high - low| 降序排
    factors.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
    return { baseline: 0, factors };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, resolveStartY } = infra;
    const { factors = [], baseline = 0, startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);
    const n  = Math.min(factors.length, 8);
    const rowH = Math.min(0.4, (3.4 - 0.3) / n);
    const baseX = 0.6, labelW = 2.0;
    const barAreaX = baseX + labelW + 0.2;
    const barAreaW = 6.0;
    const centerX  = barAreaX + barAreaW / 2;

    const maxAbs = Math.max(...factors.flatMap(f => [Math.abs(f.low - baseline), Math.abs(f.high - baseline)]), 1);
    const scale = (barAreaW / 2) / maxAbs;

    // 中线
    slide.addShape(pres.shapes.LINE, {
      x: centerX, y: sy, w: 0, h: n * rowH + 0.1,
      line: { color: C.PRIMARY, width: 1.5 },
    });
    slide.addText(`基线 ${baseline}`, {
      x: centerX - 0.5, y: sy - 0.35, w: 1.0, h: 0.3,
      fontSize: 10, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'center', margin: 0,
    });

    factors.slice(0, n).forEach((f, i) => {
      const y = sy + i * rowH;
      slide.addText(f.name, {
        x: baseX, y: y + 0.05, w: labelW, h: rowH - 0.1,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: C.TEXT, align: 'right', valign: 'middle', margin: 0,
      });
      // 负向（左）
      const negW = Math.abs(f.low - baseline) * scale;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: centerX - negW, y: y + 0.05, w: negW, h: rowH - 0.1,
        fill: { color: C.DANGER },
      });
      slide.addText(String(f.low), {
        x: centerX - negW - 0.5, y: y + 0.05, w: 0.45, h: rowH - 0.1,
        fontSize: 9, fontFace: FONTS.numeric, bold: true,
        color: C.DANGER, align: 'right', valign: 'middle', margin: 0,
      });
      // 正向（右）
      const posW = Math.abs(f.high - baseline) * scale;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: centerX, y: y + 0.05, w: posW, h: rowH - 0.1,
        fill: { color: C.SUCCESS },
      });
      slide.addText(`+${f.high}`, {
        x: centerX + posW + 0.05, y: y + 0.05, w: 0.5, h: rowH - 0.1,
        fontSize: 9, fontFace: FONTS.numeric, bold: true,
        color: C.SUCCESS, valign: 'middle', margin: 0,
      });
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = sy + n * rowH + 0.2;
  },
};
