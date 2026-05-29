'use strict';
// templates/customer-segmentation.js — 客户分层矩阵（4 象限 + 每象限分层描述）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'customerSegmentation',
  version:     '1.0.0',
  category:    '咨询框架',
  description: '客户/产品分层：高价值 / 高增长 / 低粘性 / 待开发 四类分群可视化',

  schema: {
    segments: { type: 'array', min: 4, max: 4, required: true,
      item: { name: { type: 'string', required: true, warn: 10, error: 18 },
              size: { type: 'string', description: '占比/规模', warn: 12, error: 18 },
              value: { type: 'string', description: '价值贡献', warn: 12, error: 18 },
              strategy: { type: 'string', warn: 30, error: 50 } } },
    xAxis: { type: 'string', description: 'X 轴标签' },
    yAxis: { type: 'string', description: 'Y 轴标签' },
  },

  usage: {
    when:    '客户/产品/市场分层 4 群分类策略',
    notWhen: '维度数不是 4；连续分布用 chartScatter',
    maxItems: 4,
    typicalHeight: '3.8"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/customer-segmentation.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const segments = (keyPoints || []).slice(0, 4).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      return { name: title || kp, size: '', value: '', strategy: desc || '' };
    });
    while (segments.length < 4) segments.push({ name: `分群 ${segments.length+1}`, size: '', value: '', strategy: '' });
    return { segments, xAxis: '价值高 →', yAxis: '增长快 ↑' };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, resolveStartY } = infra;
    const { segments = [], xAxis, yAxis, startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const baseX = 1.2, baseY = sy;
    const matrixW = 7.4, matrixH = Math.min(3.2, maxBottom - baseY - 0.4);
    const cellW = matrixW / 2, cellH = matrixH / 2;
    const colors = [C.SUCCESS, C.SECONDARY, C.WARNING, C.DANGER];

    // 4 个象限
    segments.slice(0, 4).forEach((s, i) => {
      // 排列：左上 / 右上 / 左下 / 右下
      const col = i % 2, row = Math.floor(i / 2);
      const x = baseX + col * cellW;
      const y = baseY + row * cellH;
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w: cellW - 0.05, h: cellH - 0.05,
        fill: { color: colors[i], transparency: 75 },
        line: { color: colors[i], width: 1.5 },
      });
      slide.addText(s.name, {
        x: x + 0.15, y: y + 0.1, w: cellW - 0.3, h: 0.35,
        fontSize: 15, fontFace: FONTS.primary, bold: true,
        color: colors[i], valign: 'top', margin: 0,
      });
      if (s.size || s.value) {
        slide.addText(`${s.size}${s.size && s.value ? ' · ' : ''}${s.value}`, {
          x: x + 0.15, y: y + 0.45, w: cellW - 0.3, h: 0.3,
          fontSize: 10, fontFace: FONTS.primary, italic: true,
          color: C.TEXT, valign: 'top', margin: 0,
        });
      }
      slide.addText(s.strategy || '', {
        x: x + 0.15, y: y + 0.78, w: cellW - 0.3, h: cellH - 0.85,
        fontSize: 11, fontFace: FONTS.primary,
        color: C.TEXT, valign: 'top', lineSpacingMultiple: 1.4, margin: 0,
      });
    });

    // 坐标轴
    slide.addShape(pres.shapes.LINE, {
      x: baseX, y: baseY + matrixH + 0.05, w: matrixW, h: 0,
      line: { color: C.TEXT, width: 1.5 },
    });
    slide.addShape(pres.shapes.LINE, {
      x: baseX - 0.05, y: baseY, w: 0, h: matrixH,
      line: { color: C.TEXT, width: 1.5 },
    });
    slide.addText(xAxis || '→', {
      x: baseX + matrixW - 1.0, y: baseY + matrixH + 0.1, w: 1.0, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.TEXT, align: 'right', valign: 'middle', margin: 0,
    });
    slide.addText(yAxis || '↑', {
      x: baseX - 1.0, y: baseY, w: 0.9, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.TEXT, align: 'right', valign: 'middle', margin: 0,
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = baseY + matrixH + 0.4;
  },
};
