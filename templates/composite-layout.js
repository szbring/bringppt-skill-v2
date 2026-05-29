'use strict';
// templates/composite-layout.js — 复合页布局（v3.9.0 T-3）
//
// 一页上 2-4 个内容块，按预设网格排列。每个块是"title + body"型迷你卡片，
// body 可以是文字段落 / bullets 列表 / 关键数字 / 进度条。
//
// 用例：LiquidEdge p-3 那种 "主图 + 侧 panel + 4 reason 卡" 类型的复合页。

const path = require('path');
const fs   = require('fs');

const GRID_PRESETS = {
  // grid name → blocks 数组各自的 {x, y, w, h} 相对值（0-1）
  'left-right':       [{x:0,   y:0, w:0.5, h:1}, {x:0.5, y:0, w:0.5, h:1}],
  '7-3':              [{x:0,   y:0, w:0.7, h:1}, {x:0.7, y:0, w:0.3, h:1}],
  '6-4':              [{x:0,   y:0, w:0.6, h:1}, {x:0.6, y:0, w:0.4, h:1}],
  'top-2bottom':      [{x:0,   y:0,   w:1, h:0.55}, {x:0, y:0.55, w:0.5, h:0.45}, {x:0.5, y:0.55, w:0.5, h:0.45}],
  '2top-bottom':      [{x:0,   y:0,   w:0.5, h:0.55}, {x:0.5, y:0, w:0.5, h:0.55}, {x:0, y:0.55, w:1, h:0.45}],
  'left-2right':      [{x:0,   y:0, w:0.55, h:1}, {x:0.55, y:0, w:0.45, h:0.48}, {x:0.55, y:0.52, w:0.45, h:0.48}],
  '2x2':              [{x:0,y:0,w:0.5,h:0.5},{x:0.5,y:0,w:0.5,h:0.5},{x:0,y:0.5,w:0.5,h:0.5},{x:0.5,y:0.5,w:0.5,h:0.5}],
  '4col':             [{x:0,y:0,w:0.25,h:1},{x:0.25,y:0,w:0.25,h:1},{x:0.5,y:0,w:0.25,h:1},{x:0.75,y:0,w:0.25,h:1}],
};

module.exports = {
  name:        'compositeLayout',
  version:     '1.0.0',
  category:    '其他',
  description: '复合页：一页 2-4 个内容块按 grid 预设布局，每块独立标题 + 文字/bullets/数据，适合信息密度高的页面',

  schema: {
    grid: { type: 'string', required: true },
    blocks: {
      type: 'array',
      required: true,
      min: 2,
      max: 4,
      item: {
        title: { type: 'string', warn: 18, error: 32 },
        body: { type: 'string', warn: 100, error: 200 },
        bullets: { type: 'array' },
        bigNumber: { type: 'string' },
        bigLabel: { type: 'string' },
        accentColor: { type: 'string' }
      }
    },
    startY: { type: 'number' },
  },

  usage: {
    when: '一页要表达 2-4 个并列信息块，每块结构不同（如主图 + 侧 panel + 4 数据卡）',
    notWhen: '所有块结构相同用 cardGrid；纯并列文字用 threeColumn',
    typicalHeight: '3.6"',
    scenarios: [
      { trigger: '主图 + 侧栏说明 + 数据卡组合', example: '产品定位象限 + 4 个 reason 卡' },
      { trigger: '左侧大块 + 右侧 2 个上下细化', example: '战略 + 关键举措 + 衡量指标' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/composite-layout.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const n = Math.min(4, Math.max(2, (keyPoints || []).length));
    const grids = { 2: 'left-right', 3: 'left-2right', 4: '2x2' };
    const blocks = (keyPoints || []).slice(0, n).map((kp) => {
      const { title, desc } = splitTitleDesc(kp);
      return { title: title || kp.slice(0, 12), body: desc || kp };
    });
    return { grid: grids[n] || 'left-right', blocks };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, FONTS, resolveStartY, validateBounds, GRID, shadow, calcFitFontSize } = infra;
    // v4.1.1 (修 C-2): schema 守卫——blocks / panes / cells 三种命名兼容
    let blocks = data.blocks;
    if (!Array.isArray(blocks) || !blocks.length) {
      if (Array.isArray(data.panes)) blocks = data.panes;
      else if (Array.isArray(data.cells)) blocks = data.cells;
      else if (Array.isArray(data.items)) blocks = data.items;
    }
    if (!Array.isArray(blocks) || !blocks.length) {
      throw new Error('compositeLayout 缺少必填字段 blocks（应为 [{ title, body }, ...]，2-4 项）');
    }
    const { grid = 'left-right', startY: explicitStartY } = data;
    // v4.1.6: 守护框严格守
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const startY = (explicitStartY != null) ? explicitStartY : box.top;
    const totalW = GRID.CONTENT_WIDTH;
    const maxBottom = box.bottom;
    const totalH = Math.max(0.5, maxBottom - startY - 0.10);
    const padding = 0.08;  // 块之间留白
    const preset = GRID_PRESETS[grid] || GRID_PRESETS['left-right'];

    blocks.slice(0, preset.length).forEach((b, i) => {
      const cell = preset[i];
      const x = GRID.LEFT + cell.x * totalW + (cell.x > 0 ? padding / 2 : 0);
      const y = startY + cell.y * totalH + (cell.y > 0 ? padding / 2 : 0);
      const w = cell.w * totalW - (cell.x > 0 ? padding / 2 : 0)
                                - (cell.x + cell.w < 1 ? padding / 2 : 0);
      const h = cell.h * totalH - (cell.y > 0 ? padding / 2 : 0)
                                - (cell.y + cell.h < 1 ? padding / 2 : 0);
      const accent = b.accentColor || STEP_COLORS[i % STEP_COLORS.length];

      // 块卡片
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h, rectRadius: 0.06,
        fill: { color: C.BG_LIGHT }, line: { color: C.BORDER, width: 0.5 },
        shadow: shadow(),
      });
      // 顶部色带
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y, w, h: 0.08, fill: { color: accent }, line: { color: accent, width: 0 },
      });

      let cursorY = y + 0.18;

      // 标题
      if (b.title) {
        slide.addText(b.title, {
          x: x + 0.15, y: cursorY, w: w - 0.3, h: 0.35,
          fontSize: 14, fontFace: FONTS.title, bold: true,
          color: C.PRIMARY, margin: 0, valign: 'top',
        });
        cursorY += 0.4;
      }

      // bigNumber 模式
      // v4.1.5 (修 Fix-3): 用 calcFitFontSize 自适应字号 + 留 margin 防越界
      // v4.1.5+: baseFs 上限收紧 32（之前 40 会让 4-6 字数字 fit 到 60+ pt 把下方 label 挤出 block）
      //          numBoxH 从 0.7 缩到 0.55，给 bigLabel 留 0.3 + 间距
      if (b.bigNumber) {
        const numBoxW = w - 0.4;  // 左右各 0.20" margin
        const numBoxH = 0.55;
        const baseFs = Math.min(32, w > 3 ? 32 : 26);
        const numFs = calcFitFontSize(String(b.bigNumber), numBoxW, numBoxH, baseFs, {
          minFontSize: 16, lineSpacing: 1.0,
        });
        slide.addText(b.bigNumber, {
          x: x + 0.2, y: cursorY, w: numBoxW, h: numBoxH,
          fontSize: numFs, fontFace: FONTS.numeric, bold: true,
          color: accent, valign: 'middle', margin: 0,
        });
        cursorY += 0.6;
        if (b.bigLabel) {
          // v4.1.5: bigLabel 11pt → 10pt 给数字让空间，单行限高
          slide.addText(b.bigLabel, {
            x: x + 0.2, y: cursorY, w: w - 0.4, h: 0.28,
            fontSize: 10, fontFace: FONTS.body, color: C.TEXT_LIGHT, margin: 0,
          });
          cursorY += 0.30;
        }
      }

      // body 段落
      if (b.body) {
        slide.addText(b.body, {
          x: x + 0.15, y: cursorY, w: w - 0.3, h: h - (cursorY - y) - 0.15,
          fontSize: 10, fontFace: FONTS.body, color: C.TEXT,
          lineSpacingMultiple: 1.3, valign: 'top', margin: 0,
        });
      }

      // bullets
      if (b.bullets && b.bullets.length) {
        const bulletH = (h - (cursorY - y) - 0.2) / b.bullets.length;
        b.bullets.forEach((bl, j) => {
          const by = cursorY + j * bulletH;
          slide.addShape(pres.shapes.OVAL, {
            x: x + 0.18, y: by + bulletH * 0.4, w: 0.08, h: 0.08,
            fill: { color: accent }, line: { color: accent, width: 0 },
          });
          const text = typeof bl === 'string' ? bl
                       : (bl.title + (bl.desc ? '：' + bl.desc : ''));
          slide.addText(text, {
            x: x + 0.32, y: by, w: w - 0.45, h: bulletH,
            fontSize: 10, fontFace: FONTS.body, color: C.TEXT,
            valign: 'middle', margin: 0,
          });
        });
      }
    });

    // v4.1.6: 钳制到 box.bottom
    const finalBottom = Math.min(startY + totalH, maxBottom);
    slide._bottomY = finalBottom;
    validateBounds(slide, finalBottom, 'compositeLayout');
  },
};
