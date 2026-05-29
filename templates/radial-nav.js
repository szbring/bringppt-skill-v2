'use strict';
// templates/radial-nav.js
// v3.5.0 — 半环形导航 + 中央概念 + 右侧详情列表（顶咨"框架展示"风格）
// 灵感：高级商务蓝模板的"品牌决策"页

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'radialNav',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '左侧半环形 4-5 段 + 中央圆形概念 + 右侧编号列表；展示"核心概念 + 多支柱"的咨询框架',

  schema: {
    core: {
      type: 'string',
      required: true,
      description: '中央圆形的核心概念（中文，建议 ≤ 6 字）',
    },
    coreEn:    { type: 'string', required: false, description: '核心概念英文（如 "BRAND DECISION"）' },
    items:     { type: 'array',  required: true,  description: '支柱数组（4-5 项），每项 { title, desc? }' },
    title:     { type: 'string', required: false, description: '小标题' },
    startY:    { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '展示"一个核心 + 4-5 个支柱"的咨询框架；价值主张拆解、能力图谱、战略支柱',
    notWhen:       '支柱 < 3 或 > 6（用 cardGrid）；纯流程顺序（用 stepList）',
    typicalHeight: '3.0~3.5 英寸',
    scenarios: [
      { trigger: '战略 4 大支柱', example: '"客户成功"为核心，4 个支柱（产品/服务/品牌/生态）' },
      { trigger: '咨询能力图谱', example: '"AI 落地"为核心，5 个能力支柱' },
      { trigger: '价值主张拆解', example: '"为什么选我们"为核心，4 个差异化能力' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/radial-nav.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const core = (page && page.title) || splitTitleDesc(kps[0] || '').title || '核心';
    const items = kps.slice(1).slice(0, 6).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      return { title: title || '维度', desc: desc || '' };
    });
    return { core, items, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    const { core, coreEn, items = [], title, startY } = data;
    const count = Math.min(items.length, 5);
    if (count === 0 || !core) return;

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.5;
    }

    // ─── 左侧：半环形（用同心圆 - OVAL 形）+ 中央圆心 ─────────
    const circleCX = 2.2;  // 中心 x
    const circleCY = curY + 1.6;
    const outerR = 1.5;
    const innerR = 0.9;

    // 用 5 段同心半环——实际用扇形较复杂，简化为：
    //   1. 浅灰大背景圆
    //   2. 中央深蓝圆
    //   3. 围绕中央圆的 4-5 个深浅渐变小圆（呈半弧线分布）
    // 大背景圆
    slide.addShape(pres.shapes.OVAL, {
      x: circleCX - outerR, y: circleCY - outerR, w: outerR * 2, h: outerR * 2,
      fill: { color: C.BG_LIGHT },
      line: { color: C.BG_PANEL, width: 0 },
    });
    // 中央深蓝圆
    slide.addShape(pres.shapes.OVAL, {
      x: circleCX - innerR, y: circleCY - innerR, w: innerR * 2, h: innerR * 2,
      fill: { color: C.PRIMARY },
      shadow: shadow(),
    });
    // 核心概念中文（中央圆里）
    slide.addText(core, {
      x: circleCX - innerR, y: circleCY - 0.3, w: innerR * 2, h: 0.45,
      fontSize: 18, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
    });
    if (coreEn) {
      slide.addText(coreEn, {
        x: circleCX - innerR, y: circleCY + 0.15, w: innerR * 2, h: 0.3,
        fontSize: 9, fontFace: FONTS.enSmall,
        color: C.WHITE, transparency: 25,
        align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 围绕中央圆的小圆（半弧线分布在右侧）
    // count 个小圆，沿 -60° → +60° 弧线分布
    const smallR = 0.18;
    items.slice(0, count).forEach((it, i) => {
      const angleSpan = 120; // -60° to +60°
      const startAngle = -60;
      const angle = count === 1 ? 0 : startAngle + (angleSpan / (count - 1)) * i;
      const rad = (angle * Math.PI) / 180;
      const ringR = outerR - 0.08;
      const px = circleCX + Math.cos(rad) * ringR;
      const py = circleCY + Math.sin(rad) * ringR;
      const color = STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.OVAL, {
        x: px - smallR, y: py - smallR, w: smallR * 2, h: smallR * 2,
        fill: { color }, line: { color: C.WHITE, width: 1.2 },
      });
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: px - smallR, y: py - smallR, w: smallR * 2, h: smallR * 2,
        fontSize: 9, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });
    });

    // ─── 右侧：编号列表 ──────────────────────────────────
    const listX = 4.2;
    const listW = 5.2;
    // v3.7.13: itemH 上限 0.75 → 0.6，total 高度 3.5 → 3.0
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩 itemH
    const maxBottom = slide._contentMaxBottom || 4.85;
    const availListH = Math.max(1.0, maxBottom - curY - 0.4);
    const itemH = Math.min(0.6, availListH / count - 0.1);
    items.slice(0, count).forEach((it, i) => {
      const y = curY + 0.2 + i * (itemH + 0.1);
      const color = STEP_COLORS[i % STEP_COLORS.length];
      const numStr = String(i + 1).padStart(2, '0');

      // 编号圆角矩形
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: listX, y, w: 0.6, h: itemH,
        rectRadius: 0.05,
        fill: { color },
        line: { color, width: 0 },
      });
      slide.addText(numStr, {
        x: listX, y, w: 0.6, h: itemH,
        fontSize: 16, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });

      // 标题
      slide.addText(it.title, {
        x: listX + 0.75, y, w: listW - 0.75, h: it.desc ? itemH * 0.5 : itemH,
        fontSize: 13, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: it.desc ? 'bottom' : 'middle', margin: 0,
      });

      // 说明（如有）
      if (it.desc) {
        slide.addText(it.desc, {
          x: listX + 0.75, y: y + itemH * 0.5, w: listW - 0.75, h: itemH * 0.5,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, valign: 'top', margin: 0,
        });
      }
    });

    // v3.7.13: 实际 list 高度 = items.length * (itemH+0.1) + 0.2，上限 3.2 修复 overflow 0.2"
    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + 3.2;
    validateBounds(slide, curY + 3.2, 'radialNav');
  },
};
