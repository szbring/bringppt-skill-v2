'use strict';
/**
 * lib/grid.js — 12 列严格 grid 系统 (v3.8.1 Tier-1 #3)
 *
 * BRINGPPT 幻灯片标准尺寸 10" × 5.63"（16:9）。content 区 0.5"-9.5"，9.0" 宽。
 * 12 列每列 0.75" 宽。所有模板的 x / w 应该 snap 到此 grid。
 *
 * 命名约定：
 *   - col 表示 grid 列号 0..12（0 = 左缘 0.5"，12 = 右缘 9.5"）
 *   - span 表示卡片占多少列宽
 *
 * 关键 API：
 *   gridX(col)           col 0..12 → x 坐标
 *   gridW(span)          span × 0.75 (注意 gap 由调用方控制)
 *   gridSpan(items, gap) n 张卡片均分 12 列时每张的 (x, w) 数组
 *   snapX(x)             把任意 x 吸附到最近 0.0625" (grid 1/12 精度)
 *   layout(template)     针对常见 layout 形态返回标准 (x, w) — 见 LAYOUT_PRESETS
 *
 * Anchor 锚点（统一 y 坐标）：
 *   TITLE_Y = 0.40  contentSlide 标题统一位置
 *   CONTENT_TOP_Y = 1.10  内容区起始
 *   CONTENT_BOTTOM_Y = 4.80  footer 上沿
 *   FOOTER_LINE_Y = 4.90  装饰横线
 */

const GRID = Object.freeze({
  // ─── 边界 ─────────────────────────────────
  LEFT:         0.5,
  RIGHT:        9.5,
  TOP:          0.3,
  BOTTOM:       5.30,

  // ─── 内容区 ───────────────────────────────
  CONTENT_LEFT: 0.5,
  CONTENT_RIGHT: 9.5,
  CONTENT_WIDTH: 9.0,
  // v4.1.5: CONTENT_TOP_Y 1.10 → 1.20（与 takeaway 留 0.15" 间距）
  //         CONTENT_BOTTOM_Y 4.80 → 4.85（logo 上沿 4.95 减 0.10" 缓冲）
  CONTENT_TOP_Y:    1.20,
  CONTENT_BOTTOM_Y: 4.85,

  // ─── 12 列 ────────────────────────────────
  COLS: 12,
  COL_WIDTH: 0.75,

  // ─── 锚点 y ────────────────────────────────
  TITLE_Y:      0.40,
  TITLE_H:      0.55,
  SUBTITLE_Y:   1.00,
  FOOTER_TOP:   5.00,
  FOOTER_LINE_Y: 4.90,

  // ─── 通用 gap ─────────────────────────────
  GAP_S: 0.10,
  GAP_M: 0.15,
  GAP_L: 0.25,
});

/**
 * col → x 坐标
 * gridX(0) = 0.5
 * gridX(6) = 0.5 + 6 × 0.75 = 5.0 (middle)
 * gridX(12) = 9.5 (right edge)
 */
function gridX(col) {
  return GRID.LEFT + col * GRID.COL_WIDTH;
}

/**
 * span 列 → 宽度
 * gridW(4) = 3.0
 */
function gridW(span) {
  return span * GRID.COL_WIDTH;
}

/**
 * 把任意 x 吸附到最近 0.0625" (1/16) — 比 0.75 列稍细的吸附精度，
 * 给非精确 grid 内容用（如装饰元素）。
 */
function snapX(x, granularity = 0.0625) {
  return Math.round(x / granularity) * granularity;
}

/**
 * n 张卡片均分 12 列，返回每张的 {x, w}。
 *
 * @param {number} n 卡片数
 * @param {number} gap 卡片间距（英寸）
 * @returns {{x: number, w: number}[]}
 */
function gridSpan(n, gap = GRID.GAP_M) {
  if (n <= 0) return [];
  const totalGap = gap * (n - 1);
  const cardW = (GRID.CONTENT_WIDTH - totalGap) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: GRID.LEFT + i * (cardW + gap),
    w: cardW,
  }));
}

/**
 * 预设布局：给常见排版返回 (x, w, ...) 数组
 *
 * @example
 *   layout('threeColumn').forEach((c, i) => slide.addShape(..., {x: c.x, w: c.w, ...}))
 */
const LAYOUT_PRESETS = {
  oneCol:       () => gridSpan(1, 0),
  twoColumn:    () => gridSpan(2, GRID.GAP_L),  // 2 列大间距
  threeColumn:  () => gridSpan(3, GRID.GAP_M),
  fourColumn:   () => gridSpan(4, GRID.GAP_M),
  fiveColumn:   () => gridSpan(5, GRID.GAP_S),
  sixColumn:    () => gridSpan(6, GRID.GAP_S),

  // 不均分（左侧主，右侧辅）
  leftMain_7_5: () => [
    { x: GRID.LEFT,           w: gridW(7) },                        // 5.25"
    { x: gridX(7) + 0.2,      w: gridW(5) - 0.2 },                  // ~3.55"
  ],
  // 左侧辅，右侧主
  rightMain_5_7: () => [
    { x: GRID.LEFT,                w: gridW(5) - 0.1 },
    { x: gridX(5) + 0.1,            w: gridW(7) - 0.1 },
  ],
  // 左侧主，右侧 2 辅栏
  hero_8_4: () => [
    { x: GRID.LEFT,            w: gridW(8) },                       // 6"
    { x: gridX(8) + 0.2,       w: gridW(4) - 0.2 },                 // ~2.8"
  ],
};

function layout(name) {
  if (typeof name === 'function') return name();
  const fn = LAYOUT_PRESETS[name];
  return fn ? fn() : null;
}

module.exports = {
  GRID,
  gridX,
  gridW,
  gridSpan,
  snapX,
  layout,
  LAYOUT_PRESETS,
};
