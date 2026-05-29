'use strict';
// templates/step-list.js
// Source: bring-core.js L650-702
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'stepList',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '3-5个有序步骤，每步含标题+详细描述',

  schema: {
    steps: {
      type: 'array',
      min: 2,
      max: 5,
      item: {
        title: { type: 'string', warn: 15, error: 25 },
        desc: { type: 'string', required: true, warn: 40, error: 60 }
      }
    },
    summary: { type: 'string', warn: 50, error: 80 },
    startY: { type: 'number' },
  },

  usage: {
    "when": "内容是有先后顺序的3-5个步骤，需要详细描述每步",
    "notWhen": "内容是并列概念或案例；步骤超过5个",
    "pairs": [
      "quoteBanner",
      "caseBox"
    ],
    "maxItems": 5,
    "typicalHeight": "2.0-3.0\"",
    scenarios: [
          {
                "trigger": "3-5个步骤，每步需要详细说明",
                "example": "实施5步法，每步有标题和2-3行说明文字"
          },
          {
                "trigger": "比processFlow需要更多文字时",
                "example": "processFlow适合短标题，stepList适合每步要详述"
          }
    ],

  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/stepList.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers 重构（descMinLen 自动扩展 + min 自动补足）
  // v4.1.4 (修 P1-2): 入口处宽容解析 LLM 常见错写：
  //   - page.steps / page.stages 字段直传 → 直接采用
  //   - 字符串数组（["a","b"]）→ mapKpsToItems 自动拆成 {title, desc}
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    // v4.1.4: 宽容解析 — 检测 page 上常见的 alias 字段
    if (page) {
      // v4.1.7 (修 P2-3): 扩展 alias — actions / milestones / items
      const altSource = page.steps || page.stages || page.phases || page.actions || page.milestones || page.items;
      if (Array.isArray(altSource) && altSource.length) {
        const steps = altSource.slice(0, 5).map((s, i) => {
          if (typeof s === 'string') return { title: s.slice(0, 25) || `步骤 ${i+1}`, desc: s };
          if (s && typeof s === 'object') {
            return {
              title: String(s.title || s.name || s.label || s.heading || `步骤 ${i+1}`).slice(0, 25),
              desc:  String(s.desc || s.description || s.text || s.content || s.detail || '').trim(),
            };
          }
          return { title: `步骤 ${i+1}`, desc: String(s || '') };
        });
        return { steps, summary: steps.map(s => s.title).join(' → ') };
      }
    }
    let steps = mapKpsToItems(keyPoints, { max: 5, descMinLen: 15 });
    // 单 KP 时拆成「准备 / 执行」两步以满足 min:2
    if (steps.length === 1) {
      const t = steps[0].title;
      steps = [
        { title: '准备 ' + t, desc: `${t}的前置准备与资源到位` },
        { title: '执行 ' + t, desc: steps[0].desc },
      ];
    }
    return { steps, summary: steps.map(s => s.title).join(' → ') };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    // v4.1.8 (修 P1-E / P3-A): render 入口接受 6 种 alias — steps / items / actions / milestones / phases / stages
    let { steps, summary, startY: explicitStartY } = data;
    if (!Array.isArray(steps) || steps.length === 0) {
      steps = data.items || data.actions || data.milestones || data.phases || data.stages || [];
      // 字符串元素 → 自动包成 {title, desc}
      steps = (steps || []).map((s, i) => {
        if (typeof s === 'string') return { title: s.slice(0, 25), desc: s };
        if (s && typeof s === 'object') return {
          title: String(s.title || s.name || s.label || `步骤 ${i+1}`).slice(0, 25),
          desc:  String(s.desc || s.description || s.text || s.content || s.detail || ''),
        };
        return { title: `步骤 ${i+1}`, desc: String(s || '') };
      });
    }
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(steps) || steps.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'stepList', missingField: 'steps[]', hint: '需要 2-7 个 {title, desc} 步骤对象', startY });
    }
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const panelW = infra.GRID.CONTENT_WIDTH;
  const startX = infra.GRID.LEFT;
  const summarySpace = summary ? 0.55 : 0;
  const available = maxBottom - top - summarySpace;
  const n = steps.length;
  const gap = n <= 3 ? 0.15 : 0.1;
  const panelH = Math.min(0.7, (available - gap * (n - 1)) / n);
  // 纵向居中：steps 总高 = n*panelH + (n-1)*gap，加 summarySpace
  const stepsH = n * panelH + (n - 1) * gap;
  const contentH = stepsH + summarySpace;
  const renderStartY = top + Math.max(0, (maxBottom - top - contentH) / 2);
  // v4.1.7 (修 P1-3): STEP_COLORS 第 4/5 位用 BLUE_PALE / INFO_GRAY 对比度太低，
  //   04/05 编号在白底上几乎不可见。本地覆盖：所有数字+侧条统一用前 3 色循环，
  //   保证文字对比度 ≥ 4.5:1。
  const SAFE_STEP_COLORS = [
    STEP_COLORS[0], STEP_COLORS[1], STEP_COLORS[2],
    STEP_COLORS[0], STEP_COLORS[1],  // 第 4、5 位回到 PRIMARY / SECONDARY
  ];
  steps.forEach((step, i) => {
    const y = renderStartY + i * (panelH + gap);
    const color = SAFE_STEP_COLORS[i % SAFE_STEP_COLORS.length];
    slide.addShape(pres.shapes.RECTANGLE, {
      x: startX, y, w: panelW, h: panelH,
      fill: { color: C.BG_LIGHT }, shadow: shadow()
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: startX, y, w: 0.07, h: panelH, fill: { color }
    });
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: startX + 0.2, y, w: 0.6, h: panelH,
      fontSize: panelH < 0.6 ? 18 : 22, fontFace: FONTS.primary,
      color, bold: true, valign: "middle", margin: 0
    });
    slide.addText(step.title, {
      x: startX + 0.9, y, w: 3, h: panelH,
      fontSize: panelH < 0.6 ? 14 : 16, fontFace: FONTS.primary,
      color: C.TEXT, bold: true, valign: "middle", margin: 0
    });
    slide.addText(step.desc, {
      x: startX + 4, y, w: panelW - 4.2, h: panelH,
      fontSize: panelH < 0.6 ? 12 : 13, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, valign: "middle", margin: 0
    });
  });
  if (summary) {
    const sumY = renderStartY + n * (panelH + gap) + 0.12;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: startX, y: sumY, w: panelW, h: 0.4, fill: { color: C.PRIMARY }
    });
    const stepSumFs = calcFitFontSize(summary, panelW, 0.4, 15, { minFontSize: 11, lineSpacing: 1.2 });
    slide.addText(summary, {
      x: startX, y: sumY, w: panelW, h: 0.4,
      fontSize: stepSumFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, autoFit: true
    });
    const finalBottom = Math.min(sumY + 0.4, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'stepList');
  } else {
    const finalBottom = Math.min(renderStartY + n * (panelH + gap), maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'stepList');
  }
  },
};
