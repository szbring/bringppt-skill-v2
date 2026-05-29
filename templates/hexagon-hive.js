'use strict';
// templates/hexagon-hive.js
// v3.2.6 — 六边形蜂窝（pptxgenjs SHAPE_NAME.hexagon 包装）
// 用于核心能力图谱、生态系统、技术栈

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'hexagonHive',
  version:     '1.0.0',
  category:    '并列型',
  description: '六边形蜂窝排布，承载 6 或 7 个并列要素；中央可放核心概念，外围 6 边形辐射',

  schema: {
    items: {
      type: 'array',
      required: true,
      description: '蜂窝要素数组（6 项 = 中心 + 周围 6 个？不，简化为 6 个独立六边形）：{ title, desc? }',
    },
    title:  { type: 'string', required: false, description: '小标题' },
    layout: { type: 'string', default: 'cluster', description: 'cluster（紧凑蜂窝）| line（横向单排）' },
    startY: { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '展示 4-6 个并列的核心能力、生态系统组成、技术栈层级',
    notWhen:       '需要严格顺序时（用 stepList / processFlow）；要素数 > 6 时（视觉拥挤）',
    typicalHeight: '2.8~3.4 英寸',
    scenarios: [
      { trigger: '咨询团队 6 大核心能力', example: '战略 / 运营 / 品牌 / 数字化 / 组织 / 人才——6 块六边形' },
      { trigger: '产品生态构成', example: '"开发者 / 合作伙伴 / 客户 / 服务商 / 资本 / 政府" 六维生态' },
      { trigger: '技术栈分层（非顺序）', example: '基础设施 / 数据 / AI / 应用 / 用户 / 监控 6 个模块' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hexagon-hive.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    const items = mapKpsToItems(keyPoints, { max: 6 });
    return {
      items,
      title:  (page && page.title) || '',
      layout: items.length > 3 ? 'cluster' : 'line',
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    const { items = [], title, layout = 'cluster', startY } = data;
    const count = Math.min(items.length, 6);
    if (count === 0) return;

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2: 若 contentSlide 母版已画大标题（_hasContentTitle），跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.75, y: sy, w: 8.5, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.5;
    }

    if (layout === 'line') {
      // 横向单排，最多 6 个
      const availW = 8.5;
      const gap = 0.1;
      const hexW = (availW - gap * (count - 1)) / count;
      const hexH = hexW * 1.0;
      items.slice(0, count).forEach((it, i) => {
        const x = 0.75 + i * (hexW + gap);
        const y = curY + 0.1;
        const color = STEP_COLORS[i % STEP_COLORS.length];

        slide.addShape(pres.shapes.HEXAGON, {
          x, y, w: hexW, h: hexH,
          fill: { color },
          line: { color, width: 0 },
          shadow: shadow(),
        });

        slide.addText(it.title, {
          x: x + 0.1, y: y + hexH * 0.25, w: hexW - 0.2, h: hexH * 0.3,
          fontSize: 14, fontFace: FONTS.primary, bold: true,
          color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
        });

        if (it.desc) {
          slide.addText(it.desc, {
            x: x + 0.15, y: y + hexH * 0.55, w: hexW - 0.3, h: hexH * 0.3,
            fontSize: 9, fontFace: FONTS.primary,
            color: C.WHITE, transparency: 15,
            align: 'center', valign: 'top', margin: 0,
          });
        }
      });
      // v4.1.0: 接力契约 — 让下方 layout 从这里起步
      slide._bottomY = curY + hexH + 0.2;
      validateBounds(slide, curY + hexH + 0.2);
    } else {
      // cluster 蜂窝：2 行交错排列（上排 3 个，下排错位 3 个）
      const hexW = 2.0, hexH = 1.7;
      const rowGap = hexH * 0.25;  // 六边形蜂窝错位间隙
      const colGap = 0.05;
      const rows = Math.ceil(count / 3);
      const totalW = hexW * 3 + colGap * 2 + hexW / 2;  // 偏移
      const cx = 0.75 + (8.5 - totalW) / 2;

      items.slice(0, count).forEach((it, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const xOffset = (row % 2 === 1) ? (hexW + colGap) / 2 : 0;
        const x = cx + col * (hexW + colGap) + xOffset;
        const y = curY + 0.1 + row * (hexH - rowGap);
        const color = STEP_COLORS[i % STEP_COLORS.length];

        slide.addShape(pres.shapes.HEXAGON, {
          x, y, w: hexW, h: hexH,
          fill: { color },
          line: { color, width: 0 },
          shadow: shadow(),
        });

        slide.addText(it.title, {
          x: x + 0.15, y: y + hexH * 0.2, w: hexW - 0.3, h: hexH * 0.3,
          fontSize: 14, fontFace: FONTS.primary, bold: true,
          color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
        });

        if (it.desc) {
          slide.addText(it.desc, {
            x: x + 0.2, y: y + hexH * 0.5, w: hexW - 0.4, h: hexH * 0.3,
            fontSize: 9, fontFace: FONTS.primary,
            color: C.WHITE, transparency: 15,
            align: 'center', valign: 'top', margin: 0,
          });
        }
      });
      validateBounds(slide, curY + rows * (hexH - rowGap) + 0.3);
    }
  },
};
