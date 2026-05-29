'use strict';

// templates/three-horizons.js
// Three Horizons: H1 / H2 / H3 with elastic card heights and a timeline that
// follows the tallest card instead of being pinned to a fixed baseline.
const path = require('path');
const fs = require('fs');

function estimateLines(text, charsPerLine) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (!len) return 1;
  return Math.max(1, Math.ceil(len / Math.max(8, charsPerLine)));
}

function cardHeightFor(h, idx) {
  const nameLines = estimateLines(h.name, 11);
  const focusLines = estimateLines(h.focus, 18);
  const timeframeLines = estimateLines(h.timeframe, 8);
  // Give H1/H2/H3 a visible stepped baseline, then let text add elastic growth
  // on top of that. The base itself already ascends left-to-right so the three
  // horizons keep a clear visual hierarchy even with similarly sized copy.
  const tierBase = [0.88, 1.12, 1.36][Math.min(2, Math.max(0, idx))];
  const body = 0.14 * nameLines + 0.10 * focusLines + 0.06 * timeframeLines;
  return tierBase + body;
}

module.exports = {
  name: 'threeHorizons',
  version: '1.0.0',
  category: '咨询框架',
  description: '三视野：H1 现在守业 / H2 中期增长 / H3 长期创新，曲线递进',

  schema: {
    horizons: {
      type: 'array',
      min: 3,
      max: 3,
      required: true,
      item: {
        name: { type: 'string', required: true, warn: 12, error: 20 },
        timeframe: { type: 'string', warn: 12, error: 20 },
        focus: { type: 'string', warn: 30, error: 50 },
      },
    },
  },

  usage: {
    when: '战略规划 / 公司转型，分三档时间视野',
    notWhen: '时间不是关键维度；多于 3 个阶段用 timeline',
    maxItems: 3,
    typicalHeight: '3.0"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/three-horizons.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const labels = ['H1 守业', 'H2 增长', 'H3 创新'];
    const horizons = (keyPoints || []).slice(0, 3).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      return { name: title || labels[i], timeframe: labels[i].split(' ')[0], focus: desc || '' };
    });
    while (horizons.length < 3) {
      horizons.push({ name: labels[horizons.length], timeframe: `H${horizons.length + 1}`, focus: '' });
    }
    return { horizons };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, calcFitFontSize, validateBounds } = infra;
    const { horizons = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);

    const baseX = 0.6;
    const totalW = 8.8;
    const segW = totalW / 3;
    const gap = 0.08;
    const titleY = sy + 0.30;
    const cardY = sy + 0.78;
    const bottomLimit = slide._contentMaxBottom || 4.85;

    const cards = horizons.slice(0, 3).map((h, i) => ({
      ...h,
      height: cardHeightFor(h, i),
      color: STEP_COLORS[i % STEP_COLORS.length],
    }));

    // Make the progression strictly increasing from left to right so the
    // horizon levels remain visually distinct even when text lengths are close.
    const minStep = 0.16;
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1].height;
      if (cards[i].height < prev + minStep) {
        cards[i].height = prev + minStep;
      }
    }

    const maxCardH = Math.max(...cards.map(c => c.height));
    const timelineY = cardY + maxCardH + 0.22;
    const timelineLabelY = timelineY + 0.05;
    const totalNeeded = timelineY + 0.38;

    let scale = 1;
    if (totalNeeded > bottomLimit) {
      const usable = Math.max(1.4, bottomLimit - cardY - 0.55);
      scale = Math.max(0.72, Math.min(1, usable / (maxCardH + 0.22 + 0.38)));
    }

    const scaledMaxH = maxCardH * scale;
    const finalTimelineY = cardY + scaledMaxH + 0.22;

    // Title / mini heading
    cards.forEach((h, i) => {
      const x = baseX + i * segW;
      slide.addText(h.timeframe, {
        x, y: titleY, w: segW - gap, h: 0.28,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: h.color, align: 'center', margin: 0,
      });
    });

    // Cards: top aligned so height grows downward instead of being pinned at the bottom.
    cards.forEach((h, i) => {
      const x = baseX + i * segW;
      const cardH = h.height * scale;
      const color = h.color;
      const fill = { color, transparency: 50 };
      const boxH = Math.max(0.82, cardH);

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: cardY, w: segW - gap, h: boxH,
        rectRadius: 0.1, fill,
        line: { color, width: 1.5 },
      });

      // Horizon name
      const nameFs = calcFitFontSize(h.name, segW - 0.3, 0.34, 14, { minFontSize: 10 });
      slide.addText(h.name, {
        x: x + 0.1, y: cardY + 0.10, w: segW - 0.3, h: 0.34,
        fontSize: nameFs, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
      });

      // Focus text gets the flexible height, so it no longer gets crushed by the lower timeline.
      const focusY = cardY + 0.45;
      const focusH = Math.max(0.18, boxH - 0.58);
      const focusFs = calcFitFontSize(h.focus || '', segW - 0.3, focusH, 10, { minFontSize: 8 });
      slide.addText(h.focus || '', {
        x: x + 0.12, y: focusY, w: segW - 0.24, h: focusH,
        fontSize: focusFs, fontFace: FONTS.primary,
        color: C.TEXT, align: 'center', valign: 'top',
        lineSpacingMultiple: 1.35, margin: 0,
      });
    });

    // Timeline moves below the tallest card.
    slide.addShape(pres.shapes.LINE, {
      x: baseX + 0.05, y: finalTimelineY, w: totalW - 0.1, h: 0,
      line: { color: C.TEXT_LIGHT, width: 1 },
    });
    slide.addText('→ 时间', {
      x: baseX + totalW - 0.8, y: timelineLabelY, w: 0.8, h: 0.24,
      fontSize: 10, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, valign: 'middle', margin: 0,
    });

    slide._bottomY = Math.min(bottomLimit, finalTimelineY + 0.34);
    validateBounds(slide, slide._bottomY, 'threeHorizons');
  },
};
