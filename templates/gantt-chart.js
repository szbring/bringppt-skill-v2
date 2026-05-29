'use strict';
// templates/gantt-chart.js
// Source: bring-core.js L2079-2192
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'ganttChart',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '甘特图/项目计划，展示任务时间线和进度',

  schema: {
    tasks:      { type: 'array', description: '任务列表 [{ name, start, duration, color?, milestone?, progress? }]，start/duration单位为月' },
    startMonth: { type: 'number', description: '起始月份编号' },
    months:     { type: 'number', default: 6, description: '显示月数' },
    title:      { type: 'string', description: '图表标题' },
    startY:     { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '项目进度展示，多任务并行时间规划',
    notWhen:       '任务超过8个或时间粒度需要精确到天时',
    scenarios: [
          {
                "trigger": "项目实施计划，有明确时间和责任人",
                "example": "6个工作包×12个月，标注开始/结束时间和负责团队"
          },
          {
                "trigger": "比phaseDiagram更需要精确时间节点时",
                "example": "任务有具体周数/月份，需要看并行情况和关键路径"
          },
          {
                "trigger": "实施路线图汇报",
                "example": "向客户展示完整项目时间表，显示咨询团队的专业规划能力"
          }
    ],

    typicalHeight: '3.0~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/gantt-chart.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const tasks = kps.slice(0, 6).map((kp, i) => {
            const { title: t } = splitTitleDesc(kp);
            return { name: t, start: i, duration: 1 };
          });
          return { tasks, startMonth: 1, months: kps.length, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { tasks, startMonth, months = 6, title, startY: explicitStartY } = data;
    // v4.1.6: 守护框 + 居中
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    const maxBottom = box.bottom;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const nameColW = 2.0;
    const chartW = totalW - nameColW;
    const monthW = chartW / months;

    // 预估总高 = 标题 + header + n*rowH，rowH 自动适配
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    const titleH = (title && !skipOwnTitle) ? 0.40 : 0;
    const headerH = 0.32;
    const taskCount = Math.min((tasks || []).length, 8);
    const desiredRowH = 0.42;
    const desiredTotalH = titleH + headerH + taskCount * desiredRowH;
    const available = maxBottom - top;
    let contentH = Math.min(desiredTotalH, available);
    // 居中
    const startY = top + Math.max(0, (available - contentH) / 2);

    let curY = startY;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: baseX, y: curY, w: totalW, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, margin: 0
      });
      curY += titleH;
    }

    // Header row
    slide.addShape(pres.shapes.RECTANGLE, {
      x: baseX, y: curY, w: nameColW, h: headerH,
      fill: { color: C.PRIMARY }
    });
    slide.addText("任务", {
      x: baseX, y: curY, w: nameColW, h: headerH,
      fontSize: 11, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
    for (let m = 0; m < months; m++) {
      const mx = baseX + nameColW + m * monthW;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: mx, y: curY, w: monthW, h: headerH,
        fill: { color: C.PRIMARY }
      });
      const label = startMonth ? "M" + (startMonth + m) : "M" + (m + 1);
      slide.addText(label, {
        x: mx, y: curY, w: monthW, h: headerH,
        fontSize: 10, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
    }
    curY += headerH;

    const availH = maxBottom - curY;
    // v4.1.6: rowH 严格不超 available
    const rowH = Math.min(desiredRowH, availH / Math.max(taskCount, 1));
    const barH = rowH * 0.5;
    const barPad = (rowH - barH) / 2;

    for (let ti = 0; ti < taskCount; ti++) {
      const task = tasks[ti];
      const y = curY + ti * rowH;
      const color = task.color || STEP_COLORS[ti % STEP_COLORS.length];

      for (let m = 0; m < months; m++) {
        const mx = baseX + nameColW + m * monthW;
        const bgColor = m % 2 === 0 ? C.BG_LIGHT : C.WHITE;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: mx, y, w: monthW, h: rowH,
          fill: { color: bgColor }
        });
      }

      slide.addShape(pres.shapes.RECTANGLE, {
        x: baseX, y, w: nameColW, h: rowH,
        fill: { color: ti % 2 === 0 ? C.WHITE : C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.3 }
      });
      const nameFs = calcFitFontSize(task.name, nameColW - 0.2, rowH, 11, { minFontSize: 8 });
      slide.addText(task.name, {
        x: baseX + 0.1, y, w: nameColW - 0.2, h: rowH,
        fontSize: nameFs, fontFace: FONTS.primary,
        color: C.TEXT, valign: "middle", margin: 0
      });

      if (task.milestone) {
        const mx = baseX + nameColW + task.start * monthW + monthW / 2;
        const diamondSize = barH * 0.8;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: mx - diamondSize / 2, y: y + rowH / 2 - diamondSize / 2,
          w: diamondSize, h: diamondSize,
          fill: { color }, rotate: 45
        });
      } else {
        const barX = baseX + nameColW + task.start * monthW;
        const barW = Math.max(monthW * 0.3, task.duration * monthW);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: barX, y: y + barPad, w: barW, h: barH,
          rectRadius: 0.04, fill: { color }
        });
        if (task.progress != null && task.progress > 0) {
          const progW = barW * Math.min(1, task.progress);
          slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
            x: barX, y: y + barPad, w: progW, h: barH,
            rectRadius: 0.04, fill: { color: C.PRIMARY }
          });
        }
      }

      slide.addShape(pres.shapes.LINE, {
        x: baseX + nameColW, y: y + rowH, w: chartW, h: 0,
        line: { color: C.BORDER, width: 0.3 }
      });
    }

    const bottomY = Math.min(curY + taskCount * rowH, maxBottom);
    slide._bottomY = bottomY;
    validateBounds(slide, bottomY, 'ganttChart');
  },
};
