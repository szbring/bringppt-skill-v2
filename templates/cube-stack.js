'use strict';
// templates/cube-stack.js
// v3.2.6 — 3D 立方堆叠（pptxgenjs SHAPE_NAME.cube 包装）
// 用于"技术栈分层 / 资产分类 / 数据架构"

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'cubeStack',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '3-5 层立体方块从下往上堆叠，每层一个概念；表达"层级架构"或"由下而上的演进"',

  schema: {
    layers: {
      type: 'array',
      required: true,
      description: '层级数组（3-5 项，由下到上）：{ title, desc? }',
    },
    title:  { type: 'string', required: false, description: '小标题' },
    startY: { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '技术栈/资产/数据架构等"层级堆叠"结构的可视化；强调"基础 → 应用"的支撑关系',
    notWhen:       '层数 > 5 时（视觉拥挤，改用 layeredList）；非层级关系不要硬套（用 cardGrid）',
    typicalHeight: '2.8~3.4 英寸',
    scenarios: [
      { trigger: 'AI 平台技术栈', example: '"基础设施 / 数据 / 模型 / 应用 / 用户"五层立方堆叠' },
      { trigger: '咨询服务体系层级', example: '"研究方法 / 工具 / 项目实施 / 客户价值"四层架构' },
      { trigger: '数据资产分类', example: '"原始数据 / 清洗数据 / 主数据 / 分析数据 / 数据产品"五层' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/cube-stack.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return {
      layers: mapKpsToItems(keyPoints, { max: 5 }),
      title:  (page && page.title) || '',
    };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    const { layers = [], title, startY } = data;
    const count = Math.min(layers.length, 5);
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

    // 立方区域：居左，文字描述居右
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const cubeX = 1.0;
    const cubeW = 3.5;
    const stackH = Math.min(2.8, count * 0.55 + 0.2, maxBottom - curY - 0.3);
    const cubeH = stackH / count;
    const textX = cubeX + cubeW + 0.5;
    const textW = 4.5;

    // 从下到上画（数组顺序：[0] 是最底层）
    layers.slice(0, count).forEach((lay, i) => {
      const y = curY + stackH - (i + 1) * cubeH;
      const color = STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.CUBE, {
        x: cubeX, y, w: cubeW, h: cubeH * 0.92,
        fill: { color },
        line: { color, width: 0 },
        shadow: shadow(),
      });
      slide.addText(lay.title, {
        x: cubeX + 0.2, y, w: cubeW - 0.4, h: cubeH * 0.92,
        fontSize: 14, fontFace: FONTS.primary, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
      });

      // 右侧描述
      if (lay.desc) {
        slide.addShape(pres.shapes.LINE, {
          x: textX - 0.2, y: y + cubeH * 0.46, w: 0.15, h: 0,
          line: { color, width: 1.5 },
        });
        slide.addText(lay.title + '：' + lay.desc, {
          x: textX, y, w: textW, h: cubeH * 0.92,
          fontSize: 11, fontFace: FONTS.primary,
          color: C.TEXT, valign: 'middle', margin: 0,
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + stackH + 0.3;
    validateBounds(slide, curY + stackH + 0.3);
  },
};
