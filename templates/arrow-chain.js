'use strict';
// templates/arrow-chain.js
// v3.5.0 — 商务级 5 段箭头链（顶咨级"项目阶段"表达）
// 灵感：高级商务蓝模板的"市场调研 → 品牌推广 → 具体执行 → 任务优化 → 项目复盘"

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'arrowChain',
  version:     '1.0.0',
  category:    '流程/步骤型',
  description: '商务级 5 段箭头链：每段箭头形 + 顶部标签 + 底部说明，比 chainFlow 更精致',

  schema: {
    items: {
      type: 'array',
      required: true,
      description: '箭头节点（3-6 项），每项 { title, subtitle?, date? }',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    subtitle: { type: 'string', required: false, description: '底部一句话总结' },
    showHighlight: { type: 'number', required: false, description: '高亮第 N 段（0-based 索引；可选）' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '展示阶段性项目路径、咨询服务流程、产品演化路线；强调"顺序 + 阶段性"',
    notWhen:       '项数 < 3 或 > 6（用 stepList）；非顺序关系（用 cardGrid）',
    typicalHeight: '2.0~2.8 英寸',
    scenarios: [
      { trigger: '项目五阶段路径', example: '"诊断 → 设计 → 试点 → 推广 → 持续优化"，可标记当前所在阶段' },
      { trigger: '咨询服务流程', example: '"立项 → 调研 → 分析 → 方案 → 交付"' },
      { trigger: '产品演化时间线（非精确时间）', example: '"v1.0 → v2.0 → v3.0 → v4.0"，可附年份' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/arrow-chain.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const items = kps.slice(0, 6).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      return { title, subtitle: desc || '' };
    });
    return { items, title: (page && page.title) || '' };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, resolveStartY, validateBounds, FONTS } = infra;
    const { items = [], title, subtitle, showHighlight, startY } = data;
    const count = Math.min(items.length, 6);
    if (count === 0) return;

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

    // 箭头链布局：横向均分，箭头形（用 PENTAGON 五边形 + 拼接）
    const totalW = 9.0;
    const gap = 0.05;
    const arrowW = (totalW - gap * (count - 1)) / count;
    const arrowH = 0.55;
    const startX = 0.5;

    items.slice(0, count).forEach((it, i) => {
      const x = startX + i * (arrowW + gap);
      const y = curY;
      // 默认深→浅；如指定 showHighlight，仅该项深色
      let color;
      if (showHighlight !== undefined) {
        color = (i === showHighlight) ? C.PRIMARY : C.BLUE_PALE;
      } else {
        color = STEP_COLORS[i % STEP_COLORS.length];
      }
      const textColor = (color === C.BLUE_PALE || color === C.INFO_GRAY) ? C.PRIMARY : C.WHITE;

      // 箭头：用 PENTAGON（向右指向五边形）
      slide.addShape(pres.shapes.PENTAGON, {
        x, y, w: arrowW, h: arrowH,
        fill: { color },
        line: { color, width: 0 },
      });

      slide.addText(it.title, {
        x: x + 0.1, y, w: arrowW - 0.25, h: arrowH,
        fontSize: 12, fontFace: FONTS.primary, bold: true,
        color: textColor, align: 'center', valign: 'middle', margin: 0,
      });

      // 底部副标题（如有）
      if (it.subtitle) {
        slide.addText(it.subtitle, {
          x: x + 0.05, y: y + arrowH + 0.08, w: arrowW - 0.1, h: 0.3,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT, align: 'center', valign: 'top', margin: 0,
        });
      }

      // 日期/阶段名（如有）
      if (it.date) {
        const dateY = it.subtitle ? y + arrowH + 0.42 : y + arrowH + 0.1;
        slide.addText(it.date, {
          x: x + 0.05, y: dateY, w: arrowW - 0.1, h: 0.25,
          fontSize: 9, fontFace: FONTS.enSmall,
          color: C.TEXT_LIGHT, align: 'center', valign: 'top', margin: 0,
        });
      }
    });

    // 底部一句话总结
    const bottomY = curY + arrowH + 0.9;
    if (subtitle) {
      slide.addShape(pres.shapes.LINE, {
        x: 0.5, y: bottomY, w: 9.0, h: 0,
        line: { color: C.PRIMARY, width: 1.2 },
      });
      slide.addText(subtitle, {
        x: 0.5, y: bottomY + 0.1, w: 9.0, h: 0.4,
        fontSize: 12, fontFace: FONTS.primary, italic: true,
        color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
      });
      validateBounds(slide, bottomY + 0.6);
    } else {
      // v4.1.0: 接力契约 — 让下方 layout 从这里起步
      slide._bottomY = curY + arrowH + 0.6;
      validateBounds(slide, curY + arrowH + 0.6);
    }
  },
};
