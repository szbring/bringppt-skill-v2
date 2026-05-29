'use strict';
// templates/service-blueprint.js — 服务蓝图（横向阶段 × 纵向角色矩阵）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'serviceBlueprint',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '服务蓝图：横向阶段 × 纵向 3 层（前台 / 后台 / 支撑系统）触点矩阵',

  schema: {
    stages: { type: 'array', min: 3, max: 6, required: true,
      item: { name: { type: 'string', required: true, warn: 10, error: 18 },
              frontstage: { type: 'string', warn: 25, error: 40 },
              backstage:  { type: 'string', warn: 25, error: 40 },
              system:     { type: 'string', warn: 25, error: 40 } } },
  },

  usage: {
    when:    '服务设计 / 业务流程梳理需要分层（用户可见 / 内部 / 系统）',
    notWhen: '单纯流程用 stepList；用户视角用 journeyMap',
    maxItems: 6,
    typicalHeight: '3.8"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/service-blueprint.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const stages = (keyPoints || []).slice(0, 6).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      const parts = (desc || '').split(/[|｜/]/);
      return {
        name: title || `阶段 ${i + 1}`,
        frontstage: parts[0] || desc || '用户操作',
        backstage:  parts[1] || '内部协调',
        system:     parts[2] || '系统支持',
      };
    });
    return { stages };
  },

  render(pres, slide, data, infra) {
    const { C, FONTS, resolveStartY } = infra;
    const { stages = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);
    const n  = Math.min(stages.length, 6);
    const baseX = 1.2, totalW = 8.0, colW = totalW / n;
    const rowLabels = ['前台 Frontstage', '后台 Backstage', '系统 System'];
    const rowColors = [C.SECONDARY, C.WARNING, C.GRAY];
    const rowH = 0.85;

    // 顶部阶段名
    stages.slice(0, n).forEach((s, i) => {
      const x = baseX + i * colW;
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: sy, w: colW - 0.05, h: 0.4,
        fill: { color: C.PRIMARY },
      });
      slide.addText(`${i + 1}. ${s.name}`, {
        x, y: sy, w: colW - 0.05, h: 0.4,
        fontSize: 12, fontFace: FONTS.primary, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
    });

    // 三行内容
    ['frontstage', 'backstage', 'system'].forEach((field, ri) => {
      const ry = sy + 0.5 + ri * rowH;
      // 行标签
      slide.addText(rowLabels[ri], {
        x: 0.3, y: ry, w: 0.85, h: rowH - 0.05,
        fontSize: 10, fontFace: FONTS.primary, bold: true,
        color: rowColors[ri], align: 'right', valign: 'middle',
        lineSpacingMultiple: 1.2, margin: 0,
      });
      stages.slice(0, n).forEach((s, i) => {
        const x = baseX + i * colW;
        slide.addShape(pres.shapes.RECTANGLE, {
          x, y: ry, w: colW - 0.05, h: rowH - 0.05,
          fill: { color: ri === 0 ? C.BLUE_PALE : ri === 1 ? C.BG_PAPER : C.BG_LIGHT },
          line: { color: C.BORDER, width: 0.5 },
        });
        slide.addText(s[field] || '—', {
          x: x + 0.08, y: ry + 0.05, w: colW - 0.2, h: rowH - 0.15,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT, align: 'center', valign: 'middle',
          lineSpacingMultiple: 1.3, margin: 0,
        });
      });
    });
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = sy + 0.5 + 3 * rowH;
  },
};
