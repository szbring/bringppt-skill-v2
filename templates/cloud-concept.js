'use strict';
// templates/cloud-concept.js
// v3.2.6 — 云形概念展示（pptxgenjs SHAPE_NAME.cloud 包装）
// 用于"未来趋势 / 模糊概念 / 灵感发散"

const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'cloudConcept',
  version:     '1.0.0',
  category:    '叙事/引用型',
  description: '3-5 个云朵形状，每朵承载一个开放性概念或趋势词；适合战略愿景、未来畅想、灵感发散页',

  schema: {
    clouds: {
      type: 'array',
      required: true,
      description: '云朵数组（3-5 项）：{ keyword, desc? }',
    },
    title:  { type: 'string', required: false, description: '小标题' },
    startY: { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:          '战略愿景、未来畅想、概念发散；"想象一下"的场景',
    notWhen:       '需要精确数据或结构化对比时（用 dataHighlight / comparison）',
    typicalHeight: '2.8~3.4 英寸',
    scenarios: [
      { trigger: '战略畅想：未来 3 年的可能方向', example: '"AI 原生 / 数据驱动 / 全场景 / 生态化" 四朵云排开' },
      { trigger: '行业关键词云图', example: '梳理"行业趋势"的 4-5 个关键词，云形承载' },
      { trigger: '价值主张的几个支柱', example: '"创新 / 协同 / 可信 / 可持续" 作为公司核心理念展示' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/cloud-concept.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const clouds = kps.slice(0, 5).map(kp => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            return { keyword: t, desc: d };
          });
          return { clouds, title };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow, resolveStartY, validateBounds, FONTS } = infra;
    const { clouds = [], title, startY } = data;
    const count = Math.min(clouds.length, 5);
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

    // 横向排开，云朵尺寸根据数量自适应
    const availW = 8.5;
    const gap = 0.15;
    const w = (availW - gap * (count - 1)) / count;
    const h = Math.min(1.8, w * 0.85);
    const totalW = w * count + gap * (count - 1);
    const startX = 0.75 + (availW - totalW) / 2;

    clouds.slice(0, count).forEach((c, i) => {
      const x = startX + i * (w + gap);
      const y = curY + 0.1 + (i % 2) * 0.25;  // 错落感
      const color = STEP_COLORS[i % STEP_COLORS.length];

      // 云形
      slide.addShape(pres.shapes.CLOUD, {
        x, y, w, h,
        fill: { color: C.WHITE },
        line: { color, width: 2 },
        shadow: shadow(),
      });

      // v4.1.8 (修 P1-C): 根据 desc 字符数动态缩字号，防止云形外溢截断
      const descLen = (c.desc || '').length;
      const baseDescFs = 10;
      // 单云宽 w（英寸）× 缩放系数；每英寸约可容 4 中文字（10pt）
      // 估算每行可容字符数；若 desc 超 2 行容量，逐步降到 8pt
      const charsPerLine = Math.max(4, Math.floor((w - 0.3) / 0.18)); // 0.18"/字 @ 10pt
      const linesCap = 2;
      let descFs = baseDescFs;
      if (descLen > charsPerLine * linesCap) descFs = 9;
      if (descLen > charsPerLine * (linesCap + 1)) descFs = 8;

      // 关键词（云中央）
      slide.addText(c.keyword, {
        x: x + 0.1, y: y + (c.desc ? h * 0.15 : 0), w: w - 0.2, h: c.desc ? h * 0.5 : h,
        fontSize: count <= 3 ? 18 : 15, fontFace: FONTS.primary, bold: true,
        color, align: 'center', valign: 'middle', margin: 0,
      });

      // 简短说明
      if (c.desc) {
        slide.addText(c.desc, {
          x: x + 0.15, y: y + h * 0.55, w: w - 0.3, h: h * 0.35,
          fontSize: descFs, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: 'center', valign: 'top', margin: 0,
          shrinkText: true,
        });
      }
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = curY + 1.8 + 0.4;
    validateBounds(slide, curY + 1.8 + 0.4);
  },
};
