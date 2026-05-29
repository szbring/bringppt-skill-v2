'use strict';
// templates/progress-list.js
// Source: bring-core.js L2604-2670
const path = require('path');
const fs   = require('fs');

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function normalizeHex(hex) {
  return String(hex || '').replace('#', '').trim().toUpperCase();
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

function lerpColorStops(stops, pct) {
  const p = clamp01((pct || 0) / 100);
  if (!Array.isArray(stops) || stops.length === 0) return '000000';
  if (p <= stops[0].at) return stops[0].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (p <= b.at) {
      const span = Math.max(1e-6, b.at - a.at);
      return mixHex(a.color, b.color, (p - a.at) / span);
    }
  }
  return stops[stops.length - 1].color;
}

module.exports = {
  name:        'progressList',
  version:     '1.0.0',
  category:    '项目管理型',
  description: '进度条列表，展示多项任务完成百分比',

  schema: {
    items:  { type: 'array', description: '进度项列表 [{ name, percent, desc? }]，最多8项' },
    title:  { type: 'string', description: '标题' },
    startY: { type: 'number', description: '起始Y坐标' },
  },

  usage: {
    when:          '展示多个任务/指标的完成进度',
    notWhen:       '任务超过8个或需要展示绝对数值时',
    scenarios: [
          {
                "trigger": "多个任务/目标的完成进度",
                "example": "6个战略目标的完成率：进度条显示50%/80%/100%等"
          },
          {
                "trigger": "比checklist更需要展示百分比时",
                "example": "不只是完成/未完成，而是0-100%的连续进度"
          }
    ],

    typicalHeight: '2.5~3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/progress-list.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.25: 用 adapter-helpers.mapKps 自定义映射（name + percent 字段）
  fromKeyPoints(keyPoints, page) {
    const { mapKps } = require('../lib/adapter-helpers');
    const items = mapKps(keyPoints, (kp, i, parts) => {
      const m = kp.match(/(\d+(?:\.\d+)?)\s*%?/);
      const pct = m ? Math.min(100, parseFloat(m[1])) : Math.max(40, 90 - i * 12);
      return { name: parts.title || kp, percent: pct };
    }, { max: 5 });
    return { items, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { items, title, startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.85;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const count = Math.min(items.length, 8);

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

    const availH = maxBottom - curY;
    const rowGap = 0.1;
    const rowH = Math.min(0.42, (availH - rowGap * (count - 1)) / count);
    const nameW = 2.2;
    const barX = baseX + nameW + 0.15;
    const pctW = 0.6;
    const barW = totalW - nameW - 0.15 - pctW - 0.25; // Extra right margin
    const pctStops = [
      { at: 0.00, color: C.DANGER || 'F25C54' },        // 0-39: red / light orange
      { at: 0.39, color: C.ACCENT || 'F1A14F' },        // 40-59: ochre / yellow
      { at: 0.60, color: C.CHART_BLUE || C.SECONDARY || '4E78B8' }, // 60-79: blue
      { at: 0.80, color: C.SKY || '5DA5DA' },           // 80-99: blue-green
      { at: 1.00, color: C.SUCCESS || '2E8B57' },       // 100: green
    ];

    items.slice(0, count).forEach((item, i) => {
      const y = curY + i * (rowH + rowGap);
      const pct = Math.min(100, Math.max(0, item.percent || 0));
      const color = item.color || lerpColorStops(pctStops, pct);
      const trackColor = mixHex(color, 'FFFFFF', 0.84);

      // Name
      const nameFs = calcFitFontSize(item.name, nameW - 0.1, rowH, 12, { minFontSize: 9 });
      slide.addText(item.name, {
        x: baseX, y, w: nameW, h: rowH,
        fontSize: nameFs, fontFace: FONTS.primary,
        color: C.TEXT, bold: true, valign: "middle", margin: 0
      });

      // Bar background
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: barX, y: y + rowH * 0.3, w: barW, h: rowH * 0.4,
        rectRadius: 0.04, fill: { color: trackColor }
      });

      // Bar fill
      if (pct > 0) {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: barX, y: y + rowH * 0.3, w: barW * (pct / 100), h: rowH * 0.4,
          rectRadius: 0.04, fill: { color },
        });
      }

      // Percentage text
      slide.addText(pct + "%", {
        x: barX + barW + 0.1, y, w: pctW, h: rowH,
        fontSize: 12, fontFace: FONTS.primary,
        color, bold: true, valign: "middle", margin: 0
      });
    });

    const bottomY = curY + count * (rowH + rowGap) - rowGap;
    validateBounds(slide, bottomY);
  },
};
