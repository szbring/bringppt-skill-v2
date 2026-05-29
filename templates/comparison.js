'use strict';
// templates/comparison.js
// Source: bring-core.js L838-898
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'comparison',
  version:     '1.0.0',
  category:    '对比型',
  description: '左右两栏对比，适合正反/优劣/两方对比',

  schema: {
    left: {
      title: { type: 'string', warn: 10, error: 20 },
      items: { type: 'array', item: { type: 'string', warn: 30, error: 50, min: 8 } }
    },
    right: {
      title: { type: 'string', warn: 10, error: 20 },
      items: { type: 'array', item: { type: 'string', warn: 30, error: 50, min: 8 } }
    },
    showVS: { type: 'boolean' },
    bottomText: { type: 'string', warn: 50, error: 80 },
    startY: { type: 'number' },
  },

  usage: {
    "when": "内容是两方面的对比，如优/劣、前/后、方案A/B",
    "notWhen": "超过2个维度的比较；内容不是对立关系",
    "pairs": [
      "quoteBanner",
      "caseBox"
    ],
    "maxItems": 5,
    "typicalHeight": "1.8-2.5\"",
    scenarios: [
          {
                "trigger": "左右两方的优缺点、差异对比",
                "example": "变革前 vs 变革后、问题清单 vs 解法清单"
          },
          {
                "trigger": "两种方案/观点的全面对比",
                "example": "传统模式 vs 数字化模式：各列5-8个对比条目"
          },
          {
                "trigger": "注意：items必须是string[]，不能是对象",
                "example": "正确：['条目文字', '条目文字']，错误：[{text:'...'}]"
          }
    ],

  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/comparison.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: keyPoints 适配器
  // v4.1.4 (修 P1-2): 入口处宽容解析 LLM 常见错写：
  //   - 显式 left/right 对象（{ items | bullets | points }）
  //   - 扁平 leftItems / rightItems 数组
  //   - 扁平 left / right 字符串数组（LLM 误用）
  //   - leftTitle / rightTitle 标题 alias
  fromKeyPoints(keyPoints, page) {
    function normalizeItems(arr) {
      if (!Array.isArray(arr)) return [];
      return arr.map(x => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object') {
          return String(x.text || x.title || x.label || x.content || x.desc || '').trim();
        }
        return String(x || '');
      }).filter(Boolean);
    }
    function normalizeSide(side, fallbackTitle) {
      if (side && typeof side === 'object' && !Array.isArray(side)) {
        const items = normalizeItems(side.items || side.bullets || side.points || side.list);
        return { title: String(side.title || side.heading || fallbackTitle).slice(0, 20), items };
      }
      if (Array.isArray(side)) {
        return { title: fallbackTitle, items: normalizeItems(side) };
      }
      return null;
    }
    if (page) {
      // v4.1.7 (修 P2-3): 扩展 alias — pros/cons / before/after / optionA/optionB
      const leftIn  = page.left || page.leftItems || page.pros || page.before || page.optionA || page.a;
      const rightIn = page.right || page.rightItems || page.cons || page.after || page.optionB || page.b;
      const leftTitle  = page.leftTitle || (page.pros ? '优势' : page.before ? '改变前' : page.optionA ? '方案 A' : '方案一');
      const rightTitle = page.rightTitle || (page.cons ? '劣势' : page.after ? '改变后' : page.optionB ? '方案 B' : '方案二');
      const leftSide  = normalizeSide(leftIn,  leftTitle);
      const rightSide = normalizeSide(rightIn, rightTitle);
      if (leftSide && rightSide && (leftSide.items.length || rightSide.items.length)) {
        return {
          left:  leftSide,
          right: rightSide,
          showVS: true,
          bottomText: (page.bottomText) || `综合以上${leftSide.items.length + rightSide.items.length}个要点`,
        };
      }
    }
    const kps = keyPoints || [];
    const mid = Math.ceil(kps.length / 2);
    return {
      left:  { title: (page && page.leftTitle)  || '方案一', items: kps.slice(0, mid) },
      right: { title: (page && page.rightTitle) || '方案二', items: kps.slice(mid) },
      showVS: true,
      bottomText: (page && page.bottomText) || `综合以上${kps.length}个要点`,
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v3.7.24: 兼容历史误用 left.bullets / right.bullets → 自动转为 items（68 次重复陷阱中 26 次是此误用）
    if (data.left && Array.isArray(data.left.bullets) && !data.left.items) data.left.items = data.left.bullets;
    if (data.right && Array.isArray(data.right.bullets) && !data.right.items) data.right.items = data.right.bullets;
    // v4.1.8 (修 P3-A): 接受 5 种 alias 对 — left+right / leftItems+rightItems / pros+cons / before+after / optionA+optionB
    //   render 入口同步 fromKeyPoints 的扁平 alias 解析（这是 LLM 直接生成 layout 时高频写法）
    let { left, right, startY: explicitStartY, showVS = false, bottomText } = data;
    const buildSide = (raw, fallbackTitle) => {
      if (!raw) return null;
      if (Array.isArray(raw)) return { title: fallbackTitle, items: raw.map(x => typeof x === 'string' ? x : String(x.text || x.title || x.label || x)).filter(Boolean) };
      if (typeof raw === 'object') {
        const items = raw.items || raw.bullets || raw.points || raw.list || [];
        return { title: raw.title || raw.heading || fallbackTitle, color: raw.color, items: items.map(x => typeof x === 'string' ? x : String(x.text || x.title || x.label || x)).filter(Boolean) };
      }
      return null;
    };
    if (!left || !left.items) {
      const rawL = data.left || data.leftItems || data.pros || data.before || data.optionA;
      left = buildSide(rawL, data.leftTitle || '方案一') || left;
    }
    if (!right || !right.items) {
      const rawR = data.right || data.rightItems || data.cons || data.after || data.optionB;
      right = buildSide(rawR, data.rightTitle || '方案二') || right;
    }
    if (!left || !right || !Array.isArray(left.items) || !Array.isArray(right.items)) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'comparison', missingField: 'left.items + right.items', hint: '需要 left+right 或 pros+cons / before+after 对比对', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const colW = 4.0, gap = showVS ? 0.6 : 0.4;
  const startX = (10 - colW * 2 - gap) / 2;
  const leftColor = left.color || C.DANGER;
  const rightColor = right.color || C.SUCCESS;
  const btSpace = bottomText ? 0.55 : 0;
  const available = maxBottom - top;
  // 卡片实际渲染高度 = contentH + 0.5（contentH 是文字区高，卡片高 = +0.5）
  const cardHmax = Math.min(2.6, available - btSpace - 0.2);
  const contentH = cardHmax;
  // 整体高度 = 卡片高度 + 0.5 + btSpace
  const totalH = contentH + 0.5 + btSpace;
  const startY = top + Math.max(0, (available - totalH) / 2);
  [{ data: left, x: startX, color: leftColor },
   { data: right, x: startX + colW + gap, color: rightColor }].forEach(({ data, x, color }) => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: startY, w: colW, h: contentH + 0.5,
      rectRadius: 0.08, fill: { color: C.BG_LIGHT }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: colW, h: 0.07, fill: { color }
    });
    slide.addText(data.title, {
      x, y: startY + 0.15, w: colW, h: 0.45,
      fontSize: 16, fontFace: FONTS.primary,  // v3.7.15: 20 → 16 字号偏大
      color, bold: true, align: "center", valign: "middle", margin: 0
    });
    const textItems = data.items.map((item, i) => ({
      text: item,
      options: {
        bullet: true, breakLine: i < data.items.length - 1,
        fontSize: 12, fontFace: FONTS.primary, color: C.TEXT  // v3.7.15: 14 → 12
      }
    }));
    slide.addText(textItems, {
      x: x + 0.3, y: startY + 0.7, w: colW - 0.6, h: contentH - 0.4,
      lineSpacingMultiple: 1.5, margin: 0
    });
  });
  if (showVS) {
    const vsX = startX + colW + (gap - 0.45) / 2;
    const vsY = startY + contentH / 2;
    slide.addShape(pres.shapes.OVAL, {
      x: vsX, y: vsY, w: 0.45, h: 0.45, fill: { color: C.ACCENT }
    });
    slide.addText("VS", {
      x: vsX, y: vsY, w: 0.45, h: 0.45,
      fontSize: 14, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
  }
  if (bottomText) {
    const btW = colW * 2 + gap;
    const btFs = calcFitFontSize(bottomText, btW, 0.35, 16, { minFontSize: 11, lineSpacing: 1.2 });
    const btY = startY + contentH + 0.5 + 0.15;
    slide.addText(bottomText, {
      x: startX, y: btY, w: btW, h: 0.35,
      fontSize: btFs, fontFace: FONTS.primary,
      color: C.PRIMARY, bold: true, align: "center", margin: 0, autoFit: true
    });
    const finalBottom = Math.min(btY + 0.35, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'comparison');
  } else {
    const finalBottom = Math.min(startY + contentH + 0.5, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'comparison');
  }
  },
};
