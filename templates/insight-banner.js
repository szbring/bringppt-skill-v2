'use strict';
// templates/insight-banner.js
// 全宽底部核心洞察条（来自ISC汇报方案每页底部蓝色引言条）
// 可单独叠加在任意内容页底部，传达核心结论
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'insightBanner',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '全宽底部核心洞察条：深蓝背景+白字，左侧橙色竖线，用于每页底部的核心结论/诊断要点强调',

  schema: {
    insight:  { type: 'string', required: true,  description: '核心洞察/结论文字（建议20-60字）' },
    label:    { type: 'string', required: false, description: '左侧小标签（如"核心洞察""诊断结论"）' },
    style:    { type: 'string', required: false, description: '"blue"（默认）| "orange" | "dark" | "gold" | "brick" | "minimal"（v4.0.5）' },
    accent:   { type: 'string', required: false, description: 'v4.0.5: "gold" | "brick" — minimal 样式下的左侧竖线颜色' },
    startY:   { type: 'number', required: false, description: '起始Y坐标（英寸），默认贴内容底部' },
  },

  usage: {
    when:          '需要在页面底部强调核心结论、诊断要点、关键洞察时；咨询汇报类PPT每页底部使用',
    notWhen:       '已有 engagementQuestion 时（二者位置相同）；封面/章节页',
    scenarios: [
          {
                "trigger": "需要在页面底部加核心结论",
                "example": "任何内容页底部加一条'深蓝背景白字'的核心洞察强调"
          },
          {
                "trigger": "比engagementQuestion更正式的总结条",
                "example": "咨询汇报风格，每页底部固定有结论条，不是互动问题"
          }
    ],

    typicalHeight: '约0.52英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/insight-banner.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  // v4.1.3 (修 N-2): 对象形 kps[0] 会被 pptxgenjs 内部 forEach 误判为 rich-text 数组
  //   抛 "text.forEach is not a function"。这里 stringify 为 "title：desc" 兜底。
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const first = kps[0];
    let insight = '';
    if (first != null) {
      const { title: t, desc: d } = splitTitleDesc(first);
      insight = d ? `${t}：${d}` : t;
    }
    if (!insight) {
      insight = String((page && (page.takeaway || page.title)) || '').trim() || '核心洞察';
    }
    return {
      insight,
      label: (page && (page.insightLabel || page.label)) || '核心洞察',
      style: 'blue',
    };
  },



  render(pres, slide, data, infra) {
    const { C, FONTS, BANNER_TOP = 4.45, BANNER_H = 0.40, BANNER_BOTTOM = 4.85, setLayoutBottom } = infra;
    // v4.1.6: insightBanner 固定在专属区 [4.45, 4.85]，不再读 _contentMaxBottom，
    //   不再触发 validateBounds（自己就是底部）。重置 _contentMaxBottom 为 BANNER_BOTTOM
    //   只为兼容下游误用（不期待还有下游 layout）。
    // v4.1.8 (修 P3-C): 同步 _layoutBottom 避免下游用错字段
    if (setLayoutBottom) setLayoutBottom(slide, BANNER_BOTTOM);
    else { slide._contentMaxBottom = BANNER_BOTTOM; slide._layoutBottom = BANNER_BOTTOM; }
    let { insight, label, style = 'blue', accent } = data;
    // v4.1.3 (修 N-2 / N-3 防御层): insight 若是对象或数组，stringify 为安全文本
    if (insight && typeof insight === 'object') {
      if (Array.isArray(insight)) {
        insight = insight.map(x => {
          if (x && typeof x === 'object') return String(x.title || x.text || x.desc || x.label || '').trim();
          return String(x || '').trim();
        }).filter(Boolean).join('  ·  ');
      } else {
        insight = String(insight.title || insight.text || insight.desc || insight.label || insight.content || '').trim();
      }
    }
    if (!insight) insight = '核心洞察';

    // v4.1.6: banner 固定 y = BANNER_TOP (4.45)，高度固定 BANNER_H (0.40)
    //   完全忽略 data.startY 与 slide._bottomY — banner 是专属区底部装饰带，不接力
    const bannerH = BANNER_H;
    const startY = BANNER_TOP;

    // v4.0.5/v4.0.6: minimal 真正"无背景版" — 只留左侧竖线 + label + 文字
    //   避免与上方 threeColumn / layeredList 等用 BG_LIGHT 卡片底色相同导致"视觉覆盖"
    const accentColor = accent === 'brick' ? C.BRICK : (accent === 'gold' ? C.ACCENT : C.ACCENT);
    const schemes = {
      blue:    { bg: C.PRIMARY,   accent: C.ACCENT,    text: C.WHITE,    isMinimal: false },
      orange:  { bg: C.ACCENT,    accent: C.PRIMARY,   text: C.WHITE,    isMinimal: false },
      dark:    { bg: '#1A1A2E',   accent: C.ACCENT,    text: C.WHITE,    isMinimal: false },
      gold:    { bg: C.ACCENT,    accent: C.PRIMARY,   text: C.TEXT,     isMinimal: false },
      brick:   { bg: C.BRICK,     accent: C.ACCENT,    text: C.WHITE,    isMinimal: false },
      // v4.0.6: minimal 无背景 — bg=null 表示不画背景条
      minimal: { bg: null, accent: accentColor, text: C.TEXT, isMinimal: true, labelColor: accentColor },
    };
    const sc = schemes[style] || schemes.blue;

    // 背景条（minimal 不画）
    if (sc.bg) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0.3, y: startY, w: 9.4, h: bannerH,
        fill: { color: sc.bg },
      });
    }

    // 左侧竖线装饰（v4.0.6: minimal 加粗到 0.08，更"咨询竖线感"）
    const stripeW = sc.isMinimal ? 0.08 : 0.07;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: startY + 0.06, w: stripeW, h: bannerH - 0.12,
      fill: { color: sc.accent },
      line: { color: sc.accent, width: 0 },
    });

    // 小标签（可选）
    // v4.1.6: bannerH=0.40，label 高度收到 0.28，y=startY+0.06 居中
    let textX = sc.isMinimal ? 0.7 : 0.55;
    const labelH = 0.28;
    const labelY = startY + (bannerH - labelH) / 2;
    if (label) {
      if (sc.isMinimal) {
        // v4.0.5 minimal: 标签大写 + 字间距，无背景块
        const labelUp = label.toUpperCase();
        const lw = labelUp.length * 0.18 + 0.2;
        slide.addText(labelUp, {
          x: textX, y: labelY, w: lw, h: labelH,
          fontSize: 10, fontFace: FONTS.enSmall,
          color: sc.labelColor || sc.accent, bold: true, charSpacing: 3,
          align: 'left', valign: 'middle', margin: 0,
        });
        textX += lw + 0.25;
      } else {
        const lw = label.length * 0.18 + 0.3;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: textX, y: labelY, w: lw, h: labelH,
          rectRadius: 0.06,
          fill: { color: sc.accent },
        });
        slide.addText(label, {
          x: textX, y: labelY, w: lw, h: labelH,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.WHITE, bold: true,
          align: 'center', valign: 'middle', margin: 0,
        });
        textX += lw + 0.12;
      }
    }

    // 洞察文字
    // v4.0.6: 右边距留到 9.5 (grid 右边界)，minimal 模式正文用 normal 体重不再 bold
    const insightW = 9.5 - textX;
    slide.addText(insight, {
      x: textX, y: startY, w: insightW, h: bannerH,
      fontSize: 12, fontFace: FONTS.primary,
      color: sc.text, bold: !sc.isMinimal,
      valign: 'middle', margin: 0,
    });

    // v4.1.6: 不再调 validateBounds — banner 自己就是页面底部装饰带
    slide._bottomY = startY + bannerH;
  },
};
