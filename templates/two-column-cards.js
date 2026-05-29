'use strict';
// templates/two-column-cards.js
// Source: bring-core.js L549-583
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'twoColumnCards',
  version:     '1.0.0',
  category:    '并列型',
  description: '2个概念并列展示，每个含标题+描述文字',

  schema: {
    cards: {
      type: 'array',
      min: 2,
      max: 2,
      item: {
        title: { type: 'string', warn: 12, error: 20 },
        content: { type: 'string', warn: 80, error: 120 }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    "when": "内容是2个需要对比或并列展示的概念，各含一段描述",
    "notWhen": "内容超过2个概念；描述文字极短（用threeColumn更好）",
    "pairs": [
      "quoteBanner",
      "dataHighlight"
    ],
    "maxItems": 2,
    "typicalHeight": "1.5-2.5\"",
    scenarios: [
          {
                "trigger": "两个概念并排介绍，篇幅相当",
                "example": "效率 vs 弹性、传统供应链 vs 数字化供应链——两栏对等展示"
          },
          {
                "trigger": "左右对比但不是优劣，而是两种路径",
                "example": "两种战略路径的分析，无对错之分，各有侧重"
          }
    ],

  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/twoColumnCards.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: keyPoints 适配器
  // v4.1.3 (修 N-1 残留): 对象形 kp 先 stringify 再 join，避免 [object Object]
  fromKeyPoints(keyPoints, page) {
    const { ensureVisibleText, splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const mid = Math.ceil(kps.length / 2);
    const title = (page && page.title) || '';
    const kpToString = kp => {
      if (kp && typeof kp === 'object' && !Array.isArray(kp)) {
        const { title: t, desc: d } = splitTitleDesc(kp);
        return d ? `${t}：${d}` : t;
      }
      return String(kp || '');
    };
    const left  = kps.slice(0, mid).map(kpToString).filter(Boolean).join('\n');
    const right = kps.slice(mid).map(kpToString).filter(Boolean).join('\n');
    return {
      cards: [
        { title: (page && page.leftTitle)  || '核心要点', content: ensureVisibleText(left  || kpToString(kps[0]), title) },
        { title: (page && page.rightTitle) || '应用方向', content: ensureVisibleText(right || kpToString(kps[1]), title) },
      ],
    };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.1.8 (修 P1-E / P3-A): 接受 cards 或 left/right 两种命名
    //   - cards: [{ title, content }, { title, content }]
    //   - left / right: { title, content } 旧形
    //   - leftItems / rightItems: 数组形（拼成 content）
    let cards = data.cards;
    if (!Array.isArray(cards) || cards.length < 2) {
      const leftRaw  = data.left  || data.leftCard  || data.leftSide;
      const rightRaw = data.right || data.rightCard || data.rightSide;
      const toCard = (raw, fallbackTitle) => {
        if (!raw) return null;
        if (typeof raw === 'string') return { title: fallbackTitle, content: raw };
        if (Array.isArray(raw))      return { title: fallbackTitle, content: raw.join('\n') };
        return {
          title:   String(raw.title || raw.heading || raw.label || fallbackTitle).trim(),
          content: String(raw.content || raw.desc || raw.description || raw.text || (Array.isArray(raw.items) ? raw.items.join('\n') : '')).trim(),
        };
      };
      const L = toCard(leftRaw,  '左') || (Array.isArray(data.leftItems)  ? { title: '左', content: data.leftItems.join('\n') }  : null);
      const R = toCard(rightRaw, '右') || (Array.isArray(data.rightItems) ? { title: '右', content: data.rightItems.join('\n') } : null);
      if (L && R) cards = [L, R];
    }
    if (!Array.isArray(cards) || cards.length < 2) {
      throw new Error('twoColumnCards 缺少必填字段 cards（应为 [{title,content},{title,content}]，或 left+right 兼容形）');
    }
    const { startY: explicitStartY } = data;
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const gap = infra.GRID.GAP_L;
  const cardW = (infra.GRID.CONTENT_WIDTH - gap) / 2;
  const available = maxBottom - top;
  const cardH = Math.min(3.0, available);
  const startY = top + Math.max(0, (available - cardH) / 2);
  const startX = infra.GRID.LEFT;
  cards.forEach((card, i) => {
    const x = startX + i * (cardW + gap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: C.BG_LIGHT }, shadow: shadow(),
      line: { color: C.BORDER, width: 0.5 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: 0.07, fill: { color: C.SECONDARY }
    });
    if (card.iconData) {
      slide.addImage({ data: card.iconData, x: x + 0.3, y: startY + 0.3, w: 0.4, h: 0.4 });
    }
    slide.addText(card.title, {
      x: x + 0.3, y: startY + (card.iconData ? 0.8 : 0.3), w: cardW - 0.6, h: 0.5,
      fontSize: 20, fontFace: FONTS.primary,
      color: C.PRIMARY, bold: true, margin: 0
    });
    const contentYOff = card.iconData ? 1.5 : 1.0;
    const contentH = cardH - contentYOff - 0.3, contentW = cardW - 0.6;
    const contentFs = calcFitFontSize(card.content, contentW, contentH, 13, { minFontSize: 10 });
    slide.addText(card.content, {
      x: x + 0.3, y: startY + contentYOff, w: contentW, h: contentH,
      fontSize: contentFs, fontFace: FONTS.primary,
      color: C.TEXT, lineSpacingMultiple: 1.4, margin: 0, autoFit: true
    });
  });
  const finalBottom = Math.min(startY + cardH, maxBottom);
  slide._bottomY = finalBottom;
  validateBounds(slide, finalBottom, 'twoColumnCards');
  },
};
