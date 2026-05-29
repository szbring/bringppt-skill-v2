'use strict';
// templates/timeline-with-metrics.js — 时间线 + 配套指标卡（v3.9.0 T-5）
//
// 顶部水平 timeline（N 个阶段），底部 K 个指标卡（如 "0 days / 0 m³ / <5 ppl / 100%"）

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'timelineWithMetrics',
  version:     '1.0.0',
  category:    '流程/序列型',
  description: '时间线 + 指标卡：顶部 3-6 个时间阶段，底部 3-4 个量化指标卡，适合"X 周交付"类计划页',

  schema: {
    phases: {
      type: 'array',
      required: true,
      min: 3,
      max: 6,
      item: {
        period: { type: 'string', required: true, warn: 10, error: 18 },
        title: { type: 'string', required: true, warn: 15, error: 28 },
        titleCN: { type: 'string' },
        notes: { type: 'string', warn: 35, error: 60 }
      }
    },
    metrics: {
      type: 'array',
      item: {
        value: { type: 'string', required: true, warn: 8, error: 12 },
        label: { type: 'string', warn: 18, error: 30 },
        labelCN: { type: 'string' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '"X 周/月内完成"类计划页：顶部分阶段进度 + 底部量化承诺指标',
    notWhen: '纯流程用 stepList；纯时间事件用 timeline',
    typicalHeight: '4.0"',
    scenarios: [
      { trigger: '8 周交付计划', example: '5 个 Wk 阶段 + 4 个指标卡（0 days / 100%）' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/timeline-with-metrics.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints) {
    // 前 5 个 kp 是 phases，后 4 个是 metrics（如果有的话）
    const kps = keyPoints || [];
    const phases = kps.slice(0, 5).map((kp, i) => {
      const t = String(kp);
      const m = t.match(/^(.+?)[:：]\s*(.+)$/);
      return {
        period: `Wk ${i + 1}`,
        title: m ? m[1].trim() : t.slice(0, 14),
        notes: m ? m[2].trim() : '',
      };
    });
    return { phases };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID } = infra;
    const { phases = [], metrics = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, GRID.CONTENT_TOP_Y);

    // 顶部时间线
    const tlY = startY + 0.3;
    const tlW = GRID.CONTENT_WIDTH;
    const tlX = GRID.LEFT;
    const n = phases.length;
    const colW = tlW / n;
    const nodeD = 0.26;
    const nodeY = tlY + 0.42;
    const nodeCenterY = nodeY + nodeD / 2;
    const lineStartX = tlX + colW * 0.5;
    const lineEndX = tlX + tlW - colW * 0.5;

    // 横线
    slide.addShape(pres.shapes.LINE, {
      x: lineStartX, y: nodeCenterY, w: lineEndX - lineStartX, h: 0,
      line: { color: STEP_COLORS[0], width: 2.5 },
    });

    phases.forEach((p, i) => {
      const cx = tlX + colW * (i + 0.5);
      const color = STEP_COLORS[i % STEP_COLORS.length];

      // period 标
      slide.addText(p.period, {
        x: cx - 0.7, y: tlY + 0.0, w: 1.4, h: 0.25,
        fontSize: 11, fontFace: FONTS.enSmall, bold: true, charSpacing: 1,
        color, align: 'center', margin: 0,
      });
      // title
      slide.addText(p.title, {
        x: cx - 0.85, y: tlY + 0.22, w: 1.7, h: 0.3,
        fontSize: 11, fontFace: FONTS.title, bold: true,
        color: C.PRIMARY, align: 'center', margin: 0,
      });
      // 圆点
      slide.addShape(pres.shapes.OVAL, {
        x: cx - nodeD / 2, y: nodeY, w: nodeD, h: nodeD,
        fill: { color }, line: { color: C.WHITE, width: 2 },
      });
      // titleCN
      if (p.titleCN) {
        slide.addText(p.titleCN, {
          x: cx - 0.85, y: tlY + 0.75, w: 1.7, h: 0.25,
          fontSize: 10, fontFace: FONTS.body,
          color: C.TEXT, align: 'center', margin: 0,
        });
      }
      // notes
      if (p.notes) {
        slide.addText(p.notes, {
          x: cx - 0.95, y: tlY + 1.0, w: 1.9, h: 0.5,
          fontSize: 9, fontFace: FONTS.body, italic: true,
          color: C.TEXT_LIGHT, align: 'center', valign: 'top', margin: 0,
        });
      }
    });

    // 底部 metrics
    if (metrics.length) {
      // v4.0.6: 尊重 slide._contentMaxBottom（ppt-pipeline 在有下游 insightBanner 时已预留空间）
      const maxBot = (typeof slide._layoutBottom === 'number') ? slide._layoutBottom : (slide._contentMaxBottom || 4.85);
      const mY = tlY + 1.8;
      // mH 默认 1.5"，但不超过 maxBot - mY；至少 0.7" 保证可读
      const mH = Math.max(0.7, Math.min(1.5, maxBot - mY));
      const mW = (GRID.CONTENT_WIDTH - 0.15 * (metrics.length - 1)) / metrics.length;
      // v4.0.6: 内部元素位置按 mH 比例缩放，避免 mH < 1.5" 时溢出
      const valueH    = mH * 0.50;  // 大数字占 50%
      const valueY    = mY + mH * 0.06;
      const labelEnY  = mY + mH * 0.58;
      const labelEnH  = mH * 0.20;
      const labelCnY  = mY + mH * 0.78;
      const labelCnH  = mH * 0.20;
      const valueFs   = mH >= 1.3 ? 36 : (mH >= 1.0 ? 30 : 24);
      metrics.forEach((m, i) => {
        const mx = GRID.LEFT + i * (mW + 0.15);
        const color = STEP_COLORS[i % STEP_COLORS.length];
        // 卡
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: mx, y: mY, w: mW, h: mH, rectRadius: 0.06,
          fill: { color: C.BG_LIGHT }, line: { color, width: 1.2 },
        });
        // 大数字
        slide.addText(m.value, {
          x: mx + 0.1, y: valueY, w: mW - 0.2, h: valueH,
          fontSize: valueFs, fontFace: FONTS.numeric, bold: true,
          color: C.PRIMARY, valign: 'top', margin: 0,
        });
        // label EN
        if (m.label) {
          slide.addText(m.label, {
            x: mx + 0.1, y: labelEnY, w: mW - 0.2, h: labelEnH,
            fontSize: 11, fontFace: FONTS.title, bold: true,
            color: C.TEXT, valign: 'top', margin: 0,
          });
        }
        // label CN（仅 mH >= 1.2 时画，避免太挤）
        if (m.labelCN && mH >= 1.2) {
          slide.addText(m.labelCN, {
            x: mx + 0.1, y: labelCnY, w: mW - 0.2, h: labelCnH,
            fontSize: 10, fontFace: FONTS.body,
            color: C.TEXT_LIGHT, valign: 'top', margin: 0,
          });
        }
      });
      const finalBottom = Math.min(mY + mH, maxBot);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'timelineWithMetrics');
    } else {
      const guard = (typeof slide._layoutBottom === 'number') ? slide._layoutBottom : 4.85;
      const finalBottom = Math.min(tlY + 1.8, guard);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'timelineWithMetrics');
    }
  },
};
