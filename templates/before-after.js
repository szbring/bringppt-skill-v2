'use strict';
// templates/before-after.js
// Source: bring-core.js L1645-1737
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'beforeAfter',
  version:     '1.0.0',
  category:    '对比型',
  description: '变革前后对比：每列展示变革前（灰色）→ 变革后（彩色），支持汇总栏',

  schema: {
    pairs:   { type: 'array',  required: true, description: '对比项列表 [{before, after, afterDesc, color}]', item: { before: { type: 'string', warn: 10, error: 20 }, after: { type: 'string', warn: 10, error: 20 }, afterDesc: { type: 'string', warn: 25, error: 40 } } },
    summary: { type: 'string', warn: 50, error: 80, description: '底部汇总文本（可选）' },
    startY:  { type: 'number', description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '变革前后对比、改革效果展示、转型前后状态说明',
    notWhen:       '单一内容、流程图、数据图表',
    scenarios: [
          {
                "trigger": "变革前后的对比，强调改变",
                "example": "零库存→分层安全库存、统一政策→差异化策略"
          },
          {
                "trigger": "改进措施的效果展示",
                "example": "每对比项有旧方式和新方式，底部有总结条"
          }
    ],

    typicalHeight: '3.0~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/before-after.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  // v3.7.17: 每条 before/after ≤ 20 字（schema 限制），用 splitTitleDesc 取 title 部分
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const trim = s => String(s || '').length > 20 ? String(s).slice(0, 20) : String(s || '');
    const titleOnly = kp => trim(splitTitleDesc(kp).title || kp);
    const mid = Math.ceil(kps.length / 2);
    const pairs = [];
    const maxPairs = Math.min(kps.slice(0, mid).length, kps.slice(mid).length);
    for (let i = 0; i < maxPairs; i++) {
      pairs.push({ before: titleOnly(kps[i]), after: titleOnly(kps[mid + i] || kps[i]) });
    }
    return {
      pairs: pairs.length ? pairs : [{ before: titleOnly(kps[0]), after: titleOnly(kps[1]) }],
      summary: '改善前后对比',
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { pairs, summary, startY: explicitStartY } = data;

    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const count = pairs.length;
    const gap = 0.25;
    const cardW = (8.5 - (count - 1) * gap) / count;
    const startX = (10 - count * cardW - (count - 1) * gap) / 2;
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩 afterH（变革后卡片）
    const maxBottom = slide._contentMaxBottom || 4.85;
    // v4.1.2 (修 P4 文字溢出): 当任一 before 文字 >12 字 时拉高 beforeH 让 wrap 完整呈现
    const beforeLabelH = 0.22;
    const longestBefore = Math.max(0, ...pairs.map(p => String(p.before || '').length));
    const longestAfter  = Math.max(0, ...pairs.map(p => String(p.after  || '').length));
    const beforeH = longestBefore > 12 ? 1.05 : (longestBefore > 8 ? 0.85 : 0.7);
    const arrowH = 0.35;
    const reservedForSummary = summary ? 0.62 : 0.05;
    const afterMinH = longestAfter > 12 ? 1.05 : 1.6;
    const afterH = Math.max(afterMinH, Math.min(1.8, maxBottom - startY - beforeH - arrowH - reservedForSummary));

    pairs.forEach((pair, i) => {
      const x = startX + i * (cardW + gap);
      const color = pair.color || STEP_COLORS[i % STEP_COLORS.length];

      // Before card (gray)
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: startY, w: cardW, h: beforeH,
        rectRadius: 0.06, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }
      });
      slide.addText("\u53d8\u9769\u524d", {
        x, y: startY + 0.05, w: cardW, h: beforeLabelH,
        fontSize: 9, fontFace: FONTS.primary,
        color: C.TEXT_LIGHT, align: "center", margin: 0
      });
      // v4.1.2: calcFitFontSize 自适应防溢出
      const beforeBoxW = cardW - 0.2;
      const beforeBoxH = beforeH - beforeLabelH - 0.1;
      const beforeFs = calcFitFontSize(pair.before, beforeBoxW, beforeBoxH, 12, { minFontSize: 8 });
      slide.addText(pair.before, {
        x: x + 0.1, y: startY + beforeLabelH + 0.05, w: beforeBoxW, h: beforeBoxH,
        fontSize: beforeFs, fontFace: FONTS.primary,
        color: C.TEXT, bold: true, align: "center", valign: "middle", margin: 0,
        shrinkText: true,
      });

      // Down arrow
      slide.addShape(pres.shapes.DOWN_ARROW, {
        x: x + cardW / 2 - 0.12, y: startY + beforeH + 0.05, w: 0.24, h: arrowH - 0.1,
        fill: { color: C.SECONDARY }
      });

      // After card (colored)
      const afterY = startY + beforeH + arrowH;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: afterY, w: cardW, h: afterH,
        rectRadius: 0.06, fill: { color }
      });
      slide.addText("\u53d8\u9769\u540e", {
        x, y: afterY + 0.05, w: cardW, h: beforeLabelH,
        fontSize: 9, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 30, align: "center", margin: 0
      });
      const afterTitleH = pair.afterDesc ? 0.5 : afterH - beforeLabelH - 0.1;
      const afterBoxW = cardW - 0.2;
      // v4.1.2: 对称应用 calcFitFontSize 防止溢出
      const afterFs = calcFitFontSize(pair.after, afterBoxW, afterTitleH, 12, { minFontSize: 8 });
      slide.addText(pair.after, {
        x: x + 0.1, y: afterY + beforeLabelH + 0.05, w: afterBoxW, h: afterTitleH,
        fontSize: afterFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0,
        shrinkText: true,
      });
      if (pair.afterDesc) {
        const descTopY = afterY + beforeLabelH + 0.05 + afterTitleH + 0.08;
        const descH = afterH - (descTopY - afterY) - 0.1;
        slide.addText(pair.afterDesc, {
          x: x + 0.1, y: descTopY, w: cardW - 0.2, h: descH,
          fontSize: 12, fontFace: FONTS.primary,
          color: C.WHITE, transparency: 15, align: "center", valign: "top", margin: 0
        });
      }

      // Horizontal arrow between after cards
      if (i < count - 1) {
        const arrowX = x + cardW + 0.02;
        const arrowY2 = afterY + afterH / 2 - 0.08;
        slide.addShape(pres.shapes.RIGHT_ARROW, {
          x: arrowX, y: arrowY2, w: gap - 0.04, h: 0.16,
          fill: { color: C.ACCENT }
        });
      }
    });

    if (summary) {
      const sumY = startY + beforeH + arrowH + afterH + 0.2;
      const sumW = count * cardW + (count - 1) * gap;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: startX, y: sumY, w: sumW, h: 0.42,
        rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      const baSumFs = calcFitFontSize(summary, sumW, 0.42, 14, { minFontSize: 11 });
      slide.addText(summary, {
        x: startX, y: sumY, w: sumW, h: 0.42,
        fontSize: baSumFs, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, autoFit: true
      });
      slide._bottomY = sumY + 0.42;  // v4.0.6: 让下游 layout 接力
      validateBounds(slide, sumY + 0.42);
    } else {
      slide._bottomY = startY + beforeH + arrowH + afterH;  // v4.0.6
      validateBounds(slide, startY + beforeH + arrowH + afterH);
    }
  },
};
