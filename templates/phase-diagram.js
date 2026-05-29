'use strict';
// templates/phase-diagram.js
// Source: bring-core.js L2441-2518
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'phaseDiagram',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '阶段图/路线图，横向展示多阶段内容',

  schema: {
    phases: { type: 'array', description: '阶段列表 [{ name, items: string[], color? }]，3-5个阶段' },
    title:  { type: 'string', description: '标题' },
    startY: { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '展示项目路线图、多阶段实施计划',
    notWhen:       '阶段超过5个或需要时间轴精度时',
    scenarios: [
          {
                "trigger": "3-4个阶段的实施路线图",
                "example": "18个月四阶段：基础夯实/能力建设/规模推广/持续优化"
          },
          {
                "trigger": "比ganttChart更概括，不需要精确时间",
                "example": "展示阶段名+周期+关键任务，不需要具体日期"
          }
    ],

    typicalHeight: '3.0~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/phase-diagram.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const phases = kps.slice(0, 5).map(kp => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            return { name: t, items: d ? d.split(/[,，；;]/).map(s => s.trim()).filter(Boolean) : [t] };
          });
          return { phases, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫 + 字段 alias 容忍 — 用户常用 title/desc 代替 name/items
    const { phases = [], title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(phases) || phases.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, {
        template:     'phaseDiagram',
        missingField: 'phases[]',
        hint:         '需要 3-5 个 {name, items[]} 阶段对象（也接受 {title, desc} 别名）',
        startY,
      });
    }
    // 规范化：name ← name | title；items[] ← items | desc 拆 | content
    const normalizedPhases = phases.map(p => ({
      name:  p.name || p.title || p.label || '',
      items: Array.isArray(p.items) ? p.items
           : (p.desc ? [p.desc]
           : (p.content ? [p.content] : [])),
      color: p.color,
    }));
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const count = Math.min(normalizedPhases.length, 5);

    let curY = startY;
    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: baseX, y: curY, w: totalW, h: 0.35,
        fontSize: 14, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, margin: 0
      });
      curY += 0.4;
    }

    const arrowW = 0.3;
    const gapX = 0.05;
    const phaseW = (totalW - (count - 1) * (arrowW + gapX * 2)) / count;
    const availH = maxBottom - curY;
    const headerH = 0.4;
    const phaseH = Math.min(2.8, availH);
    const bodyH = phaseH - headerH;

    normalizedPhases.slice(0, count).forEach((phase, i) => {
      const x = baseX + i * (phaseW + arrowW + gapX * 2);
      const color = phase.color || STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: curY, w: phaseW, h: headerH,
        rectRadius: 0.06, fill: { color }
      });
      const nameFs = calcFitFontSize(phase.name, phaseW - 0.2, headerH, 13, { minFontSize: 9 });
      slide.addText(phase.name, {
        x, y: curY, w: phaseW, h: headerH,
        fontSize: nameFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: curY + headerH, w: phaseW, h: bodyH,
        rectRadius: 0.06, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }
      });

      const items = phase.items || [];
      const itemTexts = items.map((item, j) => ({
        text: "• " + item,
        options: {
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT, breakLine: j < items.length - 1
        }
      }));
      if (itemTexts.length > 0) {
        slide.addText(itemTexts, {
          x: x + 0.1, y: curY + headerH + 0.08, w: phaseW - 0.2, h: bodyH - 0.16,
          lineSpacingMultiple: 1.35, margin: 0
        });
      }

      if (i < count - 1) {
        const ax = x + phaseW + gapX;
        const arrowY = curY + phaseH / 2 - 0.12;
        slide.addShape(pres.shapes.CHEVRON, {
          x: ax, y: arrowY, w: arrowW, h: 0.24,
          fill: { color: C.SECONDARY }
        });
      }
    });

    const bottomY = curY + phaseH;
    validateBounds(slide, bottomY);
  },
};
