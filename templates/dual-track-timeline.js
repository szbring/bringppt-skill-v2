'use strict';
// templates/dual-track-timeline.js
// Source: bring-core.js L3578-3726
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'dualTrackTimeline',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '双轨时间轴，中央横向时间线，上方轨道A下方轨道B',

  schema: {
    trackA: { label: { type: 'string' }, events: { type: 'array', required: true } },
    trackB: { label: { type: 'string' }, events: { type: 'array', required: true } },
    nodes: { type: 'array', description: '时间轴节点标签（如月份）', item: { type: 'string' } },
    startY: { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '展示两条并行进行的项目时间线，如开发线与运营线对比',
    notWhen:       '单一时间线，或超过8个时间节点',
    scenarios: [
          {
                "trigger": "两条并行推进的时间轴",
                "example": "A团队做技术，B团队做业务，同时推进的双轨项目计划"
          },
          {
                "trigger": "内部视角 vs 外部视角的时间线",
                "example": "上轨：公司内部里程碑，下轨：客户侧感知节点"
          },
          {
                "trigger": "理论与实践并行的课程设计",
                "example": "上轨：理论课程，下轨：实践项目，同步推进"
          }
    ],

    typicalHeight: '3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/dual-track-timeline.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const mid = Math.ceil(kps.length / 2);
          // v3.7.15: nodes 用纯数字（"节点 1" 三字在 OVAL 0.28" 圆内会越界）；events 字段含 {title, desc}
          const aEvents = kps.slice(0, mid).map(kp => {
            const { title, desc } = splitTitleDesc(kp);
            return { title, desc };
          });
          const bEvents = kps.slice(mid).map(kp => {
            const { title, desc } = splitTitleDesc(kp);
            return { title, desc };
          });
          const nodeCount = Math.max(aEvents.length, bEvents.length);
          const nodes = Array.from({ length: nodeCount }, (_, i) => String(i + 1));
          return {
            trackA: { label: (page && page.trackA) || '线路 A', events: aEvents },
            trackB: { label: (page && page.trackB) || '线路 B', events: bEvents },
            nodes,
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫 — nodes 必须是数组，且每个节点应包含 trackA/trackB 字段（而不是 a/b）
    const { trackA = {}, trackB = {}, nodes = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    if (!Array.isArray(nodes) || nodes.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'dualTrackTimeline', missingField: 'nodes[]', hint: '需要 3-7 个 {period, trackA: {events[]}, trackB: {events[]}} 时间节点', startY });
    }
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.0, baseX = 1.2;
    const labelW = 0.7;
    const labelX = baseX - labelW - 0.1;
    const availH = maxBottom - startY;
    const lineY = startY + availH * 0.5;
    const trackH = (availH - 0.5) / 2; // space for each track

    const nodeCount = nodes.length || Math.max(
      (trackA.events || []).length,
      (trackB.events || []).length,
      3
    );
    const segW = totalW / nodeCount;

    // Central thick blue arrow line
    slide.addShape(pres.shapes.RECTANGLE, {
      x: baseX, y: lineY - 0.04, w: totalW, h: 0.08,
      fill: { color: C.PRIMARY }
    });
    // Arrow head
    slide.addShape(pres.shapes.RIGHT_ARROW, {
      x: baseX + totalW - 0.2, y: lineY - 0.12, w: 0.35, h: 0.24,
      fill: { color: C.PRIMARY }
    });

    // Track labels
    if (trackA.label) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: labelX, y: lineY - trackH * 0.6 - 0.15, w: labelW, h: 0.3,
        rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      slide.addText(trackA.label, {
        x: labelX, y: lineY - trackH * 0.6 - 0.15, w: labelW, h: 0.3,
        fontSize: 10, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
    }
    if (trackB.label) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: labelX, y: lineY + trackH * 0.3 - 0.15, w: labelW, h: 0.3,
        rectRadius: 0.06, fill: { color: C.ACCENT }
      });
      slide.addText(trackB.label, {
        x: labelX, y: lineY + trackH * 0.3 - 0.15, w: labelW, h: 0.3,
        fontSize: 10, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
    }

    // Node circles and labels on the timeline
    // v4.0.4: 容忍 nodes 内是 object 的常见错配（{period, a, b} 等），转成 string 不崩
    nodes.forEach((label, i) => {
      const cx = baseX + (i + 0.5) * segW;
      slide.addShape(pres.shapes.OVAL, {
        x: cx - 0.14, y: lineY - 0.14, w: 0.28, h: 0.28,
        fill: { color: C.WHITE }, line: { color: C.PRIMARY, width: 2 }
      });
      const labelStr = (typeof label === 'string') ? label
        : (label && (label.period || label.label || label.name || label.title)) || `节点${i + 1}`;
      slide.addText(labelStr, {
        x: cx - segW * 0.4, y: lineY - 0.14, w: segW * 0.8, h: 0.28,
        fontSize: 8, fontFace: FONTS.primary,
        color: C.PRIMARY, bold: true, align: "center", valign: "middle", margin: 0
      });
    });

    // Track A events (above)
    const eventsA = trackA.events || [];
    eventsA.forEach((evt, i) => {
      const cx = baseX + (i + 0.5) * segW;
      const cardW = segW - 0.15;
      const cardH = trackH - 0.25;
      const cardX = cx - cardW / 2;
      const cardY = lineY - 0.25 - cardH;

      // Vertical connector line
      slide.addShape(pres.shapes.LINE, {
        x: cx, y: cardY + cardH, w: 0, h: 0.2,
        line: { color: C.PRIMARY, width: 1, dashType: "dash" }
      });

      // Card
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cardX, y: cardY, w: cardW, h: cardH,
        rectRadius: 0.06, fill: { color: C.BG_LIGHT },
        line: { color: C.PRIMARY, width: 0.5 }, shadow: shadow()
      });
      // v4.1.8 (修 P2-B): 无 desc 时 title 占满整卡居中，避免顶部 60% 留白
      if (evt.desc) {
        const titleFs = calcFitFontSize(evt.title, cardW - 0.12, 0.28, 11, { minFontSize: 8 });
        slide.addText(evt.title, {
          x: cardX + 0.06, y: cardY + 0.06, w: cardW - 0.12, h: 0.28,
          fontSize: titleFs, fontFace: FONTS.primary,
          color: C.PRIMARY, bold: true, valign: "middle", margin: 0
        });
        const descH = cardH - 0.38;
        const descFs = calcFitFontSize(evt.desc, cardW - 0.16, descH, 9, { minFontSize: 7 });
        slide.addText(evt.desc, {
          x: cardX + 0.08, y: cardY + 0.34, w: cardW - 0.16, h: descH,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, valign: "top", lineSpacingMultiple: 1.2, margin: 0
        });
      } else {
        const titleFs = calcFitFontSize(evt.title, cardW - 0.16, cardH - 0.16, 13, { minFontSize: 9 });
        slide.addText(evt.title, {
          x: cardX + 0.08, y: cardY + 0.08, w: cardW - 0.16, h: cardH - 0.16,
          fontSize: titleFs, fontFace: FONTS.primary,
          color: C.PRIMARY, bold: true, align: "center", valign: "middle", margin: 0
        });
      }
    });

    // Track B events (below)
    const eventsB = trackB.events || [];
    eventsB.forEach((evt, i) => {
      const cx = baseX + (i + 0.5) * segW;
      const cardW = segW - 0.15;
      const cardH = trackH - 0.25;
      const cardX = cx - cardW / 2;
      const cardY = lineY + 0.25;

      // Vertical connector line
      slide.addShape(pres.shapes.LINE, {
        x: cx, y: lineY + 0.05, w: 0, h: 0.2,
        line: { color: C.ACCENT, width: 1, dashType: "dash" }
      });

      // Card
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: cardX, y: cardY, w: cardW, h: cardH,
        rectRadius: 0.06, fill: { color: C.CASE_BG },
        line: { color: C.ACCENT, width: 0.5 }, shadow: shadow()
      });
      // v4.1.8 (修 P2-B): 同上，无 desc 时居中显示 title
      if (evt.desc) {
        const titleFs = calcFitFontSize(evt.title, cardW - 0.12, 0.28, 11, { minFontSize: 8 });
        slide.addText(evt.title, {
          x: cardX + 0.06, y: cardY + 0.06, w: cardW - 0.12, h: 0.28,
          fontSize: titleFs, fontFace: FONTS.primary,
          color: C.ACCENT, bold: true, valign: "middle", margin: 0
        });
        const descH = cardH - 0.38;
        const descFs = calcFitFontSize(evt.desc, cardW - 0.16, descH, 9, { minFontSize: 7 });
        slide.addText(evt.desc, {
          x: cardX + 0.08, y: cardY + 0.34, w: cardW - 0.16, h: descH,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, valign: "top", lineSpacingMultiple: 1.2, margin: 0
        });
      } else {
        const titleFs = calcFitFontSize(evt.title, cardW - 0.16, cardH - 0.16, 13, { minFontSize: 9 });
        slide.addText(evt.title, {
          x: cardX + 0.08, y: cardY + 0.08, w: cardW - 0.16, h: cardH - 0.16,
          fontSize: titleFs, fontFace: FONTS.primary,
          color: C.ACCENT, bold: true, align: "center", valign: "middle", margin: 0
        });
      }
    });

    validateBounds(slide, maxBottom);
  },
};
