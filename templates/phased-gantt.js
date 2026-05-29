'use strict';
// templates/phased-gantt.js
// v3.5.0 — 双层项目计划：顶部箭头链概述 + 底部精确甘特表
// 灵感：高级商务蓝模板的 "市场调研→品牌推广→具体执行→任务优化→项目复盘" + 月份甘特

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'phasedGantt',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '双层项目计划：上层箭头链概括阶段顺序，下层甘特表给精确时间窗口',

  schema: {
    phases: {
      type: 'array',
      required: true,
      description: '阶段数组（3-6 项），每项 { name, startMonth?, endMonth? }；其中 month 是 1-based 索引（对齐到下方甘特表的列）',
    },
    months: {
      type: 'array',
      required: true,
      description: '月份标签数组（如 ["Apr","May","Jun","Jul","Aug","Sep","Oct"]）',
    },
    tasks: {
      type: 'array',
      required: false,
      description: '甘特任务（可选；不提供则只画顶部箭头链），每项 { name, startCol, span, color? }',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    subtitle: { type: 'string', required: false, description: '底部一句话总结' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '项目计划 + 阶段路径双重表达；既要"阶段顺序"又要"精确时间"时',
    notWhen:       '只有阶段无精确时间（用 arrowChain）；只有时间无阶段（用 ganttChart）',
    typicalHeight: '3.2~3.8 英寸',
    scenarios: [
      { trigger: '项目计划顶部 + 月份甘特', example: '5 阶段项目 × 6 个月时间窗' },
      { trigger: '咨询服务路径 + 时间承诺', example: '"诊断 1 月 / 设计 2 月 / 试点 2 月 / 推广 3 月 / 优化持续"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/phased-gantt.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const months = (page && page.months) || ['Q1', 'Q2', 'Q3', 'Q4'];
    const span = Math.max(1, Math.floor(months.length / Math.max(1, kps.length)));
    const phases = kps.slice(0, 6).map((kp, i) => {
      const { title: name } = splitTitleDesc(kp);
      return {
        name: name || `阶段${i + 1}`,
        startMonth: i * span + 1,
        endMonth: Math.min(months.length, (i + 1) * span),
      };
    });
    return { phases, months, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, resolveStartY, validateBounds, FONTS } = infra;
    const { phases = [], months = [], tasks = [], title, subtitle, startY } = data;
    const pCount = Math.min(phases.length, 6);
    const mCount = Math.min(months.length, 12);
    if (pCount === 0 || mCount === 0) return;

    // v4.1.6: 守护框 + 居中 + rowH 自适应
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85 };
    const top = (startY != null) ? startY : box.top;
    const maxBottom = box.bottom;
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.50 : 0;
    const arrowH = 0.45;
    const arrowGap = 0.40;
    const headerH = 0.40;
    const rowCount0 = Math.min(tasks.length, 6);
    const subtitleH = subtitle ? 0.45 : 0;
    const desiredRowH = 0.40;
    let rowH = desiredRowH;
    let totalH = titleH + arrowH + arrowGap + headerH + rowCount0 * rowH + 0.2 + subtitleH;
    const available = maxBottom - top;
    if (totalH > available) {
      // 收缩 rowH
      const minRowH = 0.25;
      const baseFixed = titleH + arrowH + arrowGap + headerH + 0.2 + subtitleH;
      rowH = Math.max(minRowH, (available - baseFixed) / Math.max(rowCount0, 1));
      totalH = baseFixed + rowCount0 * rowH;
    }
    const sy = top + Math.max(0, (available - totalH) / 2);
    let curY = sy;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + titleH;
    }

    // ─── 上层箭头链 ──────────────────────────────────
    const totalW = 9.0;
    const gap = 0.05;
    const arrowW = (totalW - gap * (pCount - 1)) / pCount;
    const startX = 0.5;

    phases.slice(0, pCount).forEach((ph, i) => {
      const x = startX + i * (arrowW + gap);
      const y = curY;
      const color = STEP_COLORS[i % STEP_COLORS.length];
      const textColor = (color === C.BLUE_PALE || color === C.INFO_GRAY) ? C.PRIMARY : C.WHITE;

      slide.addShape(pres.shapes.PENTAGON, {
        x, y, w: arrowW, h: arrowH,
        fill: { color }, line: { color, width: 0 },
      });
      slide.addText(ph.name, {
        x: x + 0.05, y, w: arrowW - 0.2, h: arrowH,
        fontSize: 11, fontFace: FONTS.primary, bold: true,
        color: textColor, align: 'center', valign: 'middle', margin: 0,
      });
    });

    curY += arrowH + arrowGap;

    // ─── 下层甘特表 ──────────────────────────────────
    const tableX = 0.5;
    const tableW = 9.0;
    const labelW = 1.5;
    const colW = (tableW - labelW) / mCount;

    // 表头（月份）
    slide.addShape(pres.shapes.RECTANGLE, {
      x: tableX, y: curY, w: tableW, h: 0.4,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
    });
    months.slice(0, mCount).forEach((m, i) => {
      slide.addText(m, {
        x: tableX + labelW + i * colW, y: curY, w: colW, h: 0.4,
        fontSize: 11, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
    });

    // 任务行
    const rowCount = rowCount0;
    for (let r = 0; r < rowCount; r++) {
      const task = tasks[r];
      const ry = curY + 0.4 + r * rowH;

      // 行底色（交替）
      slide.addShape(pres.shapes.RECTANGLE, {
        x: tableX, y: ry, w: tableW, h: rowH,
        fill: { color: r % 2 === 0 ? C.BG_LIGHT : C.WHITE },
        line: { color: C.BG_PANEL, width: 0.3 },
      });

      // 任务名
      slide.addText(task.name, {
        x: tableX + 0.1, y: ry, w: labelW - 0.1, h: rowH,
        fontSize: 11, fontFace: FONTS.primary,
        color: C.TEXT, valign: 'middle', margin: 0,
      });

      // 甘特条
      const sc = Math.max(1, Math.min(task.startCol || 1, mCount));
      const sp = Math.max(1, Math.min(task.span || 1, mCount - sc + 1));
      const barX = tableX + labelW + (sc - 1) * colW + 0.05;
      const barW = sp * colW - 0.1;
      const barColor = task.color || STEP_COLORS[r % STEP_COLORS.length];

      slide.addShape(pres.shapes.RECTANGLE, {
        x: barX, y: ry + 0.08, w: barW, h: rowH - 0.16,
        fill: { color: barColor },
        line: { color: barColor, width: 0 },
      });
    }

    const bottomY = curY + headerH + rowCount * rowH + 0.1;

    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: bottomY, w: 9.0, h: 0.35,
        fontSize: 11, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
      });
      const finalBottom = Math.min(bottomY + 0.45, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'phasedGantt');
    } else {
      const finalBottom = Math.min(bottomY, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'phasedGantt');
    }
  },
};
