'use strict';
/**
 * lib/render-empty-state.js — v4.0.4
 *
 * 模板 render 函数遇到关键字段缺失/为空时，调用此函数渲染一个"友好空状态"
 * 取代之前的 throw → ppt-pipeline 兜底成 insightBanner。
 *
 * 视觉：浅灰底卡 + ⚠ 图标 + "缺少字段 X" 中文提示。
 * 保留 slide 标题/chip/logo（已由 contentSlide 渲染），所以不破坏页面骨架。
 */

function renderEmptyState(slide, infra, opts = {}) {
  const { C, FONTS } = infra;
  const {
    template     = 'unknown',     // 模板名
    missingField = '?',           // 缺失字段名
    hint         = '',            // 额外人话说明
    startY       = 1.0,
  } = opts;

  // 浅灰带边框面板
  slide.addShape('rect', {
    x: 0.5, y: startY, w: 9.0, h: 3.3,
    rectRadius: 0.1,
    fill: { color: 'F5F5F0' },
    line: { color: 'D8D8D4', width: 0.5 },
  });

  // ⚠ 警告头
  slide.addText('⚠ 数据字段缺失', {
    x: 0.7, y: startY + 0.4, w: 8.6, h: 0.4,
    fontSize: 18, fontFace: FONTS.primary, bold: true,
    color: 'C95C3E', margin: 0,
  });

  // 模板名 + 缺失字段
  slide.addText(`模板：${template}`, {
    x: 0.7, y: startY + 1.0, w: 8.6, h: 0.3,
    fontSize: 14, fontFace: FONTS.primary,
    color: C ? C.TEXT : '262626', margin: 0,
  });

  slide.addText(`需要的字段：${missingField}`, {
    x: 0.7, y: startY + 1.35, w: 8.6, h: 0.3,
    fontSize: 14, fontFace: FONTS.primary,
    color: C ? C.TEXT : '262626', margin: 0,
  });

  if (hint) {
    slide.addText(hint, {
      x: 0.7, y: startY + 1.75, w: 8.6, h: 0.6,
      fontSize: 12, fontFace: FONTS.primary, italic: true,
      color: C ? C.TEXT_LIGHT : '6B7280', margin: 0,
    });
  }

  // 底部指引
  slide.addText('参考：bringppt-storyboard skill 的 references/template-fields.md', {
    x: 0.7, y: startY + 2.75, w: 8.6, h: 0.3,
    fontSize: 10, fontFace: FONTS.enSmall,
    color: '888888', margin: 0,
  });

  // 标记给 validateBounds 用
  if (slide) slide._bottomY = startY + 3.3;
}

module.exports = { renderEmptyState };
