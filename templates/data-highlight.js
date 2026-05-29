'use strict';
// templates/data-highlight.js
// Source: bring-core.js L751-837
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'dataHighlight',
  version:     '1.0.0',
  category:    '数据/指标型',
  description: '2-4个核心大数字/指标醒目展示',

  schema: {
    items: {
      type: 'array',
      min: 2,
      max: 4,
      item: {
        number: { type: 'string', warn: 8, error: 12 },
        label: { type: 'string', warn: 12, error: 20 },
        unit: { type: 'string' },
        desc: { type: 'string', warn: 60, error: 120 }
      }
    },
    startY: { type: 'number' },
    fontSize: { type: 'number' },
  },

  usage: {
    "when": "页面有2-4个关键数字、百分比、金额需要视觉突出",
    "notWhen": "数字超过4个；数字不是核心内容",
    "pairs": [
      "quoteBanner",
      "comparison"
    ],
    "maxItems": 4,
    "typicalHeight": "1.5-2.0\"",
    scenarios: [
          {
                "trigger": "2-4个关键数字需要醒目展示",
                "example": "94%失败率、$4T损失、3.7x成本涨幅——大字数字配说明"
          },
          {
                "trigger": "开篇震撼数据页",
                "example": "用大数字建立问题严重性认知，引出后续解决方案"
          }
    ],

  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/dataHighlight.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v4.0.6: 不再主动截断 label
  //   extractDataHighlight 已三段式拆分（short label + number + long desc）
  //   render 时 label 字号自适应保单行，desc 字号自适应可 wrap 多行
  fromKeyPoints(keyPoints, page) {
    const { extractDataHighlight } = require('../lib/keypoints-helpers');
    // v4.1.7 (修 P2-3): 扩展 alias — page.items / numbers / metrics / stats / kpis
    if (page) {
      const altSource = page.items || page.numbers || page.metrics || page.stats || page.kpis;
      if (Array.isArray(altSource) && altSource.length) {
        const items = altSource.slice(0, 4).map(it => {
          if (typeof it === 'string') return extractDataHighlight(it);
          if (it && typeof it === 'object') {
            const number = it.number || it.value || it.figure;
            if (number != null) {
              return {
                number: String(number),
                unit:   String(it.unit || ''),
                label:  String(it.label || it.title || it.name || ''),
                desc:   String(it.desc || it.description || it.detail || ''),
              };
            }
            return extractDataHighlight(String(it.text || it.title || it.label || ''));
          }
          return extractDataHighlight(String(it || ''));
        });
        return { items };
      }
    }
    const items = (keyPoints || []).slice(0, 4).map(extractDataHighlight);
    return { items };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { items, startY: explicitStartY, fontSize: customFs } = data;
  // v4.1.6: 守护框 + 纵向居中
  const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
  const top = (explicitStartY != null) ? explicitStartY : box.top;
  const maxBottom = box.bottom;
  const count = items.length;
  // 估算最高 box（决定居中偏移）
  const _maxBoxH = items.reduce((m, it) => {
    const h = (it.desc && it.desc.length > 35) ? 2.8 : (it.desc ? 2.25 : (it.unit ? 1.9 : 1.5));
    return Math.max(m, h);
  }, 1.5);
  const startY = top + Math.max(0, (maxBottom - top - _maxBoxH) / 2);
  // v3.8.1 (Tier-1 #3): 12 列 grid，用 content 宽度均分
  const itemW = infra.GRID.CONTENT_WIDTH / count;
  const startX = infra.GRID.LEFT;
  // v3.7.13: 用 calcFitFontSize 真正按可用宽度自适应（之前只按字符数粗估）
  const baseFs = count <= 2 ? 40 : count === 3 ? 36 : 32;
  // 对每个 item 算最大可用 fontSize，取最小值统一显示
  const numBoxW = itemW * 0.92;
  const numBoxH = 0.9;
  const autoFs = items.reduce((minFs, it) => {
    const fitted = calcFitFontSize(String(it.number || ''), numBoxW, numBoxH, baseFs, { minFontSize: 18 });
    return Math.min(minFs, fitted);
  }, baseFs);
  const numFs = customFs || autoFs;

  items.forEach((item, i) => {
    const x = startX + i * itemW;

    // v3.9.2: 移除数字下方短线（用户反馈数字下不要横线）

    // 简化方案：使用单个文本框组合所有内容
    const textParts = [];

    // v4.0.6: 大数字默认 CHART_BLUE 中蓝；highlight:true 才用 ACCENT 金色"点睛"（仅 1 处原则）
    const numberColor = item.highlight
      ? (C.ACCENT || C.PRIMARY)
      : (C.CHART_BLUE || C.PRIMARY);
    textParts.push({
      text: item.number,
      options: {
        fontSize: numFs,
        fontFace: FONTS.numeric,
        color: numberColor,
        bold: true,
        breakLine: true
      }
    });

    // 单位部分（如果有）
    if (item.unit) {
      textParts.push({
        text: item.unit,
        options: {
          fontSize: 16,
          fontFace: FONTS.primary,
          color: C.ACCENT,
          bold: true,
          breakLine: true
        }
      });
    }

    // v4.0.6: label 字号自适应（保持单行）；desc 自动 wrap（多行可读）
    // label 短 (≤12 字) 大字号；过长缩字号
    const labelFs = item.label && item.label.length <= 8 ? 14
                  : item.label && item.label.length <= 14 ? 12
                  : 10;
    textParts.push({
      text: item.label,
      options: {
        fontSize: labelFs,
        fontFace: FONTS.primary,
        color: C.TEXT,
        bold: true,
        breakLine: !!item.desc,
      }
    });

    // 描述部分（v4.0.6: 长 desc 字号缩小允许 wrap，不截断）
    if (item.desc) {
      const descLen = item.desc.length;
      // 字号按长度递减 — 短 13pt / 中 11pt / 长 10pt / 超长 9pt
      const descFs = descLen <= 20 ? 13
                   : descLen <= 35 ? 11
                   : descLen <= 55 ? 10
                   : 9;
      textParts.push({
        text: item.desc,
        options: {
          fontSize: descFs,
          fontFace: FONTS.primary,
          color: C.TEXT_LIGHT,
          lineSpacingMultiple: 1.25,
        }
      });
    }

    // v4.0.6: boxH 按 desc 长度自适应（长描述需更高 box wrap 多行）
    let boxH;
    if (item.desc && item.desc.length > 35) {
      boxH = 2.8;  // 长描述：~4 行 wrap
    } else if (item.desc) {
      boxH = 2.25;
    } else if (item.unit) {
      boxH = 1.9;
    } else {
      boxH = 1.5;
    }

    // 使用单个文本框渲染所有内容
    slide.addText(textParts, {
      x, y: startY, w: itemW, h: boxH,
      align: "center", valign: "top", margin: 0.1
    });

    // 分隔线
    if (i < count - 1) {
      slide.addShape(pres.shapes.LINE, {
        x: x + itemW, y: startY + 0.3, w: 0, h: 1.5,
        line: { color: C.BORDER, width: 1 }
      });
    }
  });

  const lastItem = items[items.length - 1];
  const lastBoxH = (lastItem.desc && lastItem.desc.length > 35) ? 2.8
                  : (lastItem.desc ? 2.25 : (lastItem.unit ? 1.9 : 1.5));
  const finalBottom = Math.min(startY + lastBoxH, maxBottom);
  slide._bottomY = finalBottom;
  validateBounds(slide, finalBottom, 'dataHighlight');
  },
};
