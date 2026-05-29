'use strict';
// templates/icon-list.js
// Source: bring-core.js L1015-1066
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'iconList',
  version:     '1.0.0',
  category:    '并列型',
  description: '3-5个要素配图标/编号，适合并列要点展示',

  schema: {
    items: {
      type: 'array',
      min: 3,
      max: 5,
      item: {
        icon: { type: 'any' },
        title: { type: 'string', warn: 12, error: 20 },
        desc: { type: 'string', warn: 30, error: 50 }
      }
    },
    startY: { type: 'number' },
    numbered: { type: 'boolean' },
    gradientColors: { type: 'boolean' },
  },

  usage: {
    "when": "内容是3-5个并列要点，需要图标或编号区分",
    "notWhen": "要点有先后顺序（用stepList）；超过5个要点",
    "pairs": [
      "quoteBanner",
      "dataHighlight"
    ],
    "maxItems": 5,
    "typicalHeight": "2.0-3.2\"",
    scenarios: [
          {
                "trigger": "3-5个并列要点，需要图标辅助记忆",
                "example": "五大核心能力：速度/质量/成本/服务/创新，每点配图标"
          },
          {
                "trigger": "特点、优势、建议的列举",
                "example": "数字化转型的4个关键成功因素，每条有标题和说明"
          }
    ],

  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/iconList.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26 / v3.7.38: descMinLen 自动扩展避免触发 ≥15 字最小要求
  // v3.8.0 (Tier-1): 自动从 title+desc 推断 lucide icon
  // v4.1.4 (修 P1-2): 入口处宽容解析 LLM 常见错写：
  //   - page.items / page.bullets / page.points 字段直传
  //   - 对象 items: [{icon, title, desc}] / [{text}] / [{label, description}]
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    const { inferIconForKeyword } = require('../lib/icons');
    // v4.1.4 宽容解析：page 上常见 alias 字段优先
    if (page) {
      const altSource = page.items || page.bullets || page.points || page.list;
      if (Array.isArray(altSource) && altSource.length) {
        const items = altSource.slice(0, 5).map((it, i) => {
          if (typeof it === 'string') {
            const inferred = inferIconForKeyword(it);
            return { icon: inferred, title: it.slice(0, 20), desc: it };
          }
          if (it && typeof it === 'object') {
            const title = String(it.title || it.label || it.name || it.heading || '').trim();
            const desc  = String(it.desc || it.description || it.text || it.content || it.detail || '').trim();
            const icon  = it.icon || inferIconForKeyword(`${title} ${desc}`);
            return { icon, title: title || `要点 ${i+1}`, desc };
          }
          return { title: `要点 ${i+1}`, desc: String(it || '') };
        });
        return { items };
      }
    }
    return { items: mapKpsToItems(keyPoints, {
      max: 5,
      descMinLen: 15,
      transform: (item, i) => {
        const inferText = `${item.title || ''} ${item.desc || ''}`;
        const icon = item.icon || inferIconForKeyword(inferText);
        return { icon, ...item };
      },
    }) };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.1.8 (修 P3-A): 多种 alias — items / bullets / points / list / entries
    let { items, startY: explicitStartY, numbered = false, gradientColors = false } = data;
    if (!Array.isArray(items) || items.length === 0) {
      items = data.bullets || data.points || data.list || data.entries || [];
      items = items.map((it, i) => {
        if (typeof it === 'string') return { title: it.slice(0, 20), desc: it };
        if (it && typeof it === 'object') return {
          icon:  it.icon,
          title: String(it.title || it.label || it.name || `要点 ${i+1}`),
          desc:  String(it.desc || it.description || it.text || it.content || ''),
        };
        return { title: `要点 ${i+1}`, desc: String(it || '') };
      });
    }
    // v4.1.8 (修 P2-D): 空数组 → 友好失败卡
    if (!Array.isArray(items) || items.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'iconList', missingField: 'items[]', hint: '需要 3-5 个 {icon, title, desc} 要点', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  // v3.8.1 (Tier-1 #3): 12 列 grid，startX 对齐到 GRID.LEFT
  const startX = infra.GRID.LEFT;
  const n = items.length;
  const gap = n <= 3 ? 0.15 : 0.1;
  const available = maxBottom - top;
  const rowH = Math.min(0.9, (available - gap * (n - 1)) / n);
  // 纵向居中
  const contentH = n * rowH + (n - 1) * gap;
  const startY = top + Math.max(0, (available - contentH) / 2);
  const titleFs = rowH < 0.7 ? 15 : 18;
  const descFs = rowH < 0.7 ? 11 : 13;
  const circleSize = rowH < 0.7 ? 0.45 : 0.6;
  items.forEach((item, i) => {
    const y = startY + i * (rowH + gap);
    // v3.7.35: 默认上色——圆圈始终按梯度色显示（之前默认 BG_LIGHT 几乎隐形）
    //   只在用户显式传 gradientColors: 'off' 或 item.circleColor 时才覆盖
    let circleColor = STEP_COLORS[i % STEP_COLORS.length];
    if (item.circleColor) circleColor = item.circleColor;
    else if (gradientColors === 'off') circleColor = C.BG_LIGHT;
    // 圆圈带阴影 + 显式编号（即使 numbered=false 也显示位序），增强视觉层次
    const cx = startX, cy = y + (rowH - circleSize) / 2;
    slide.addShape(pres.shapes.OVAL, {
      x: cx, y: cy, w: circleSize, h: circleSize,
      fill: { color: circleColor },
      line: { color: C.WHITE, width: 1.5 },
      shadow: shadow(),
    });
    // 内圈高光（小一圈白色描边）增强深度感
    slide.addShape(pres.shapes.OVAL, {
      x: cx + 0.04, y: cy + 0.04, w: circleSize - 0.08, h: circleSize - 0.08,
      fill: { type: 'none' },
      line: { color: C.WHITE, width: 0.5, transparency: 50 },
    });
    // v3.8.0 (Tier-1): 优先用 lucide SVG icon，其次回退到 iconData/numbering
    const { svgToDataUri, getIconSvg } = require('../lib/icons');
    let iconDataUri = item.iconData;
    if (!iconDataUri && item.icon && typeof item.icon === 'string') {
      iconDataUri = svgToDataUri(getIconSvg(item.icon, C.WHITE));
    }
    if (iconDataUri) {
      const iconScale = 0.55;
      const iconSize = circleSize * iconScale;
      const iconOff = (circleSize - iconSize) / 2;
      slide.addImage({ data: iconDataUri, x: cx + iconOff, y: cy + iconOff,
                       w: iconSize, h: iconSize });
    } else {
      // 默认显示位序数字（顶咨级一致性）
      const numberFs = circleSize < 0.5 ? 14 : 18;
      slide.addText(String(i + 1), {
        x: cx, y: cy, w: circleSize, h: circleSize,
        fontSize: numberFs, fontFace: FONTS.numeric,
        color: C.WHITE, bold: true, align: 'center', valign: 'middle', margin: 0,
      });
    }
    slide.addText(item.title, {
      x: startX + 0.85, y, w: 7.5, h: rowH * 0.45,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.PRIMARY, bold: true, valign: "bottom", margin: 0
    });
    // v4.1.1 (修 C-4): desc 自适应字号 + 截断，避免横向溢出覆盖下一个 item
    let descText = String(item.desc || '');
    let actualDescFs = descFs;
    if (descText.length > 150) {
      descText = descText.slice(0, 148) + '…';
      actualDescFs = Math.max(9, descFs - 3);
    } else if (descText.length > 100) {
      actualDescFs = Math.max(9, descFs - 2);
    } else if (descText.length > 50) {
      actualDescFs = Math.max(10, descFs - 1);
    }
    slide.addText(descText, {
      x: startX + 0.85, y: y + rowH * 0.45, w: 7.5, h: rowH * 0.55,
      fontSize: actualDescFs, fontFace: FONTS.primary,
      color: C.TEXT_LIGHT, margin: 0,
      // 显式开启 wrap，确保超长 desc 自动折行而不是横向溢出
      isTextBox: true, fit: 'shrink',
    });
  });
  const finalBottom = Math.min(startY + n * (rowH + gap) - gap, maxBottom);
  slide._bottomY = finalBottom;
  validateBounds(slide, finalBottom, 'iconList');
  },
};
