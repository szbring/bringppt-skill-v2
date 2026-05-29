'use strict';

const path = require('path');
const fs = require('fs');

const WHITE = 'FFFFFF';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function normalizeHex(hex) {
  return String(hex || '')
    .replace('#', '')
    .trim()
    .toUpperCase();
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex);
  if (!/^[0-9A-F]{6}$/.test(clean)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function mixHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const k = clamp01(t);
  return rgbToHex({
    r: a.r * (1 - k) + b.r * k,
    g: a.g * (1 - k) + b.g * k,
    b: a.b * (1 - k) + b.b * k,
  });
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function readableTextColor(fillHex, C) {
  return luminance(fillHex) < 150 ? C.WHITE : C.PRIMARY;
}

function buildTargetColors(targets, C) {
  const ranked = targets
    .map((t, idx) => ({ t, idx }))
    .sort((a, b) => {
      const dv = (b.t.value || 0) - (a.t.value || 0);
      return dv !== 0 ? dv : a.idx - b.idx;
    });

  // Highest-value node keeps the brand color. The rest step down to lighter tints
  // so the right side reads as a ranked hierarchy rather than a flat stack.
  const ramp = [0.16, 0.34, 0.52];
  const colors = Array(targets.length).fill(C.PRIMARY);

  ranked.forEach((entry, rank) => {
    if (rank === 0) {
      colors[entry.idx] = C.PRIMARY;
      return;
    }
    colors[entry.idx] = mixHex(C.PRIMARY, WHITE, ramp[Math.min(rank - 1, ramp.length - 1)]);
  });

  return colors;
}

module.exports = {
  name: 'sankeyDiagram',
  version: '1.0.0',
  category: '分析/诊断型',
  description: '简化桑基图：左侧 2-4 个源节点 + 右侧 2-4 个汇节点，中间宽度按流量',

  schema: {
    sources: {
      type: 'array',
      required: true,
      min: 2,
      max: 4,
      item: {
        name: { type: 'string', required: true, warn: 12, error: 20 },
        value: { type: 'number', required: true },
      },
    },
    targets: {
      type: 'array',
      required: true,
      min: 2,
      max: 4,
      item: {
        name: { type: 'string', required: true, warn: 12, error: 20 },
        value: { type: 'number', required: true },
      },
    },
    flows: {
      type: 'array',
      description: '可选：明确指定 source -> target 流量',
      item: {
        from: { type: 'string', required: true },
        to: { type: 'string', required: true },
        value: { type: 'number', required: true },
      },
    },
  },

  usage: {
    when: '资金流 / 用户流向 / 多源多汇转化',
    notWhen: '单线流程用 funnel；分类用 chartPie',
    maxItems: 8,
    typicalHeight: '3.5"',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/sankey-diagram.json');
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return { errorPatterns: [], corrections: [] };
    }
  },

  fromKeyPoints(keyPoints, page) {
    const { extractNumber } = require('../lib/adapter-helpers');
    const kps = keyPoints || [];
    const half = Math.ceil(kps.length / 2);
    const sources = kps.slice(0, half).map(extractNumber).map(x => ({ name: x.label, value: x.value || 10 }));
    const targets = kps.slice(half, half * 2).map(extractNumber).map(x => ({ name: x.label, value: x.value || 10 }));
    while (sources.length < 2) sources.push({ name: `Source ${sources.length + 1}`, value: 10 });
    while (targets.length < 2) targets.push({ name: `Target ${targets.length + 1}`, value: 10 });
    return { sources: sources.slice(0, 4), targets: targets.slice(0, 4) };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY } = infra;
    const { sources = [], targets = [], startY } = data;
    const sy = resolveStartY(slide, startY, 1.4);
    const baseY = sy + 0.2;
    const areaH = 3.0;
    const leftX = 0.6;
    const leftW = 1.6;
    const rightX = 7.8;
    const rightW = 1.6;
    const targetColors = buildTargetColors(targets, C);

    const sTotal = Math.max(sources.reduce((s, x) => s + x.value, 0), 1);
    const tTotal = Math.max(targets.reduce((s, x) => s + x.value, 0), 1);

    let cy = baseY;
    const sourcePositions = sources.map((s, i) => {
      const h = (s.value / sTotal) * areaH;
      const color = STEP_COLORS[i % STEP_COLORS.length];
      slide.addShape(pres.shapes.RECTANGLE, {
        x: leftX,
        y: cy,
        w: leftW,
        h: h - 0.05,
        fill: { color },
      });
      slide.addText(`${s.name}\n${s.value}`, {
        x: leftX + 0.05,
        y: cy,
        w: leftW - 0.1,
        h: h - 0.05,
        fontSize: 11,
        fontFace: FONTS.primary,
        bold: true,
        color: C.WHITE,
        align: 'center',
        valign: 'middle',
        lineSpacingMultiple: 1.3,
        margin: 0,
      });
      const pos = { y: cy, h: h - 0.05, color };
      cy += h;
      return pos;
    });

    cy = baseY;
    const targetPositions = targets.map((t, i) => {
      const h = (t.value / tTotal) * areaH;
      const color = targetColors[i];
      const borderColor = color === C.PRIMARY
        ? mixHex(C.PRIMARY, WHITE, 0.18)
        : mixHex(color, C.PRIMARY, 0.16);

      slide.addShape(pres.shapes.RECTANGLE, {
        x: rightX,
        y: cy,
        w: rightW,
        h: h - 0.05,
        fill: { color },
        line: { color: borderColor, width: 0.5 },
      });
      slide.addText(`${t.name}\n${t.value}`, {
        x: rightX + 0.05,
        y: cy,
        w: rightW - 0.1,
        h: h - 0.05,
        fontSize: 11,
        fontFace: FONTS.primary,
        bold: true,
        color: readableTextColor(color, C),
        align: 'center',
        valign: 'middle',
        lineSpacingMultiple: 1.3,
        margin: 0,
      });
      const pos = { y: cy, h: h - 0.05, color };
      cy += h;
      return pos;
    });

    sourcePositions.forEach((sp, si) => {
      const segH = sp.h / targetPositions.length;
      targetPositions.forEach((tp, ti) => {
        const fromY = sp.y + ti * segH + segH / 2;
        const toY = tp.y + (si / sourcePositions.length) * tp.h + tp.h / (2 * sourcePositions.length);
        const stripH = Math.min(segH, tp.h / sourcePositions.length) * 0.8;
        slide.addShape(pres.shapes.RECTANGLE, {
          x: leftX + leftW,
          y: (fromY + toY) / 2 - stripH / 2,
          w: rightX - leftX - leftW,
          h: stripH,
          fill: { color: sp.color, transparency: 72 },
          line: { type: 'none' },
        });
      });
    });

    slide._bottomY = baseY + areaH;
  },
};
