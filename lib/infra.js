'use strict';
/**
 * lib/infra.js — BRINGPPT 基础设施层
 *
 * 包含所有模板的共同依赖（模板数量由 registry 动态统计，见 `registry.size()`）：
 *   - 品牌资产（LOGO_PATH）
 *   - 颜色常量（C、STEP_COLORS）
 *   - 共享页面元素（applyFooter、shadow）
 *   - SmartFit 文字引擎（calcFitFontSize、measureCharWidth）
 *   - 自动布局工具（resolveStartY、validateBounds）
 *   - 可选 Icon 渲染管线（renderIconSvg、iconToBase64Png，按需加载可选依赖）
 *   - 自学习数据入口（getLearningContext）
 *   - pptxgenjs 实例
 *
 * 从 bring-core.js L1-192 提取，不含任何模板渲染逻辑。
 */

const path = require('path');
const fs   = require('fs');
const store = require('./learning-store');
const grid  = require('./grid');  // v3.8.1 Tier-1 #3

const SKILL_DIR   = path.join(__dirname, '..');

// 通过标准 Node 模块解析（让 Node 从当前文件向上查找 node_modules）
const pptxgen        = require('pptxgenjs');

// ===== Brand Config =====
// v3.7.40 (P1-8): 支持白标/多品牌。环境变量 BRINGPPT_BRAND 选择品牌（默认 bring）。
// 品牌配置文件在 brand/<name>.json，定义 colors / fonts / logo / footer 等。
function loadBrandConfig() {
  const brandName = process.env.BRINGPPT_BRAND || 'bring';
  const brandPath = path.join(SKILL_DIR, 'brand', `${brandName}.json`);
  if (!fs.existsSync(brandPath)) {
    if (brandName !== 'bring') {
      console.warn(`[BRINGPPT] brand "${brandName}" not found, falling back to bring`);
    }
    const fallbackPath = path.join(SKILL_DIR, 'brand', 'bring.json');
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(brandPath, 'utf8'));
  } catch (e) {
    console.warn(`[BRINGPPT] failed to parse brand "${brandName}": ${e.message}`);
    return null;
  }
}

const BRAND = loadBrandConfig();

// ===== Brand Assets =====
const LOGO_PATH = (BRAND && BRAND.logo)
  ? path.join(SKILL_DIR, BRAND.logo)
  : path.join(SKILL_DIR, 'assets', 'bring_logo.png');

// ===== Color Constants =====
// v3.5.0 — 高级商务蓝色系（monochrome blue + 中性灰，无暖色）
//
// 设计原则：
//   - 主色 #003591 来自顶咨级商务模板的实测取色（极深邃宝石蓝）
//   - 4 级蓝系深浅：PRIMARY → SECONDARY → BLUE_LIGHT → BLUE_PALE
//   - 中性灰 3 级：TEXT(主) → TEXT_LIGHT(次) → TEXT_SUB(辅助)
//   - 背景 2 级：BG_LIGHT(浅灰) → BG_PANEL(更浅灰)
//   - 保留 SUCCESS/DANGER/SKY/GOLD/ACCENT 等老键名（向后兼容），但全部映射到蓝灰系
//     以保证现有 73 个模板渲染出来仍是 monochrome 风格，不出现违和的红/绿/橙
//
// 如需"老彩虹配色"，将 BRINGPPT_THEME=legacy（v3.5.1 计划支持）
// v4.0.5 色板重构（顶咨级配色）：
//   - PRIMARY 加深一档（002F6C，McKinsey navy 风格），更"重"
//   - ACCENT / GOLD 真正成为金色 D4A14B（关键数字、推荐方案、sweet spot 高亮）
//   - DANGER / BRICK 真正成为砖红 9C2B1A（警示、风险、竞品）
//   - SUCCESS 改深绿 2D7A4A、WARNING 改琥珀 D97706 — 真语义化
//   - BG_PAPER 暖纸底 F5F1E8（客户提案用）/ BG_LIGHT 仍是浅灰（内部周报用）
//   - STEP_COLORS 前 3 蓝主调 + 第 4 金 + 第 5 砖红 — 3 卡场景无变化，4-5 卡有层次
const C = {
  // ─── 主色（4 级蓝系深浅）─────────────────────────────
  PRIMARY:       '002F6C',  // 顶咨 navy（v4.0.5 加深）— 标题/footer/品牌
  SECONDARY:     '4A6FA5',  // 中度蓝
  BLUE_LIGHT:    '9BB8D9',  // 浅蓝
  BLUE_PALE:     'D6E1F0',  // 极浅蓝（背景层）

  // ─── 图表主色（v4.0.6 顶咨色系对齐）─────────────────────
  // 顶咨惯例：标题用深 navy 厚重，但图表柱用稍亮的中蓝避免与白底过强对比
  CHART_BLUE:    '1F4E79',  // 稳重图表蓝（Excel/McKinsey 标准）

  // ─── 文字（3 级灰）─────────────────────────────────
  // v4.0.6 (顶咨色系对齐)：TEXT 262626 → 333333
  //   顶咨标准正文用中性深灰 #333333，避免与标题深 navy 双重重感累眼
  TEXT:          '333333',  // 主文字（顶咨标准中性深灰）
  TEXT_LIGHT:    '6B7280',  // 次文字
  TEXT_SUB:      '9CA3AF',  // 辅助文字
  TEXT_MUTED:    '9CA3AF',

  // ─── 背景 ─────────────────────────────────────────
  WHITE:         'FFFFFF',
  BG_LIGHT:      'F7F5F6',  // 浅灰背景（内部用）
  BG_PANEL:      'EFEDEF',
  BG_CARD:       'D6E1F0',  // 卡片浅蓝
  BG_PAPER:      'F5F1E8',  // v4.0.5: 暖纸底（客户提案 variant 用）

  // ─── 边框 / 分隔 ───────────────────────────────────
  BORDER:        'D8D8D4',  // v4.0.5：边框不再是 PRIMARY 蓝，改中性灰
  CHARCOAL:      '333333',  // v4.0.6: 与 TEXT 同步
  ATTR_GRAY:     'D9D9D9',
  INFO_GRAY:     '9CA3AF',
  SUBTITLE_DARK: 'D6E1F0',
  SLIDE_NUM:     '9CA3AF',
  TITLE_BLUE:    '002F6C',

  // ─── 真强调色（v4.0.5 终于真正区分）─────────────────
  ACCENT:        'D4A14B',  // 真金 — 关键数字 / 推荐方案 / sweet spot
  GOLD:          'D4A14B',  // 同 ACCENT
  BRICK:         '9C2B1A',  // 砖红 — 警示 / 风险 / 竞品
  SUCCESS:       '2D7A4A',  // 深绿 — 正面 / 已完成
  WARNING:       'D97706',  // 琥珀 — 预警
  DANGER:        '9C2B1A',  // 砖红 — 错误 / 失败
  SKY:           '9BB8D9',
  GRAY:          '6B7280',

  // ─── 场景背景 ─────────────────────────────────────
  CASE_BG:       'F5F1E8',  // 案例 → 暖纸底
  WARN_BG:       'FEF3E2',  // 预警 → 浅琥珀底
  WARN_TEXT:     'D97706',  // 预警文字 → 琥珀
};

// v3.7.40 (P1-8): brand config 覆盖默认 colors
if (BRAND && BRAND.colors) {
  Object.assign(C, BRAND.colors);
}

// v4.0.6 (顶咨色系对齐): STEP_COLORS 回归纯蓝梯度
//   原则："仅 1 处亮色点睛"应由作者显式指定 highlight 字段，不应位置默认就换金/砖红
//   3-5 卡场景全部走纯蓝（深→浅）+ 中性灰，无意外强调色
const STEP_COLORS = [C.PRIMARY, C.SECONDARY, C.BLUE_LIGHT, C.BLUE_PALE, C.INFO_GRAY];

// v4.0.6: STEP_HIGHLIGHTS — 模板需要"点睛"时显式调用
//   typical：cardGrid 用户传 highlight: 'gold' → 该卡用金；不传则走 STEP_COLORS 蓝梯度
const STEP_HIGHLIGHTS = {
  gold:  C.ACCENT,  // D4A14B
  brick: C.BRICK,   // 9C2B1A
};

// ===== Font Stacks（v3.8.0 Tier-1 优化：3-tier 字体系统）=====
//
// CSS 风格 fallback：先用第一个系统装的字体，没装就降级。PowerPoint/Keynote/WPS 都支持。
//
// 三层字体设计（顶咨级 deck 的关键差异）：
//   - TITLE 标题：Source Han Sans / Inter 这种几何感强的无衬线，
//     回退到 Microsoft YaHei Bold；带视觉张力，与正文形成对比
//   - BODY 正文：Microsoft YaHei，最稳的中文覆盖
//   - NUMERIC 数字：Barlow / DIN，几何感强适合大数字
//
// 设计原则：
//   1. 中英文混排自然（中文 fallback 链都以 Microsoft YaHei 收尾，保证中文一定能显示）
//   2. 标题 vs 正文要有"字体张力"（不只是字号大小差异，字形也要差异）
//   3. 大数字单独一套字（Barlow 等几何感强）
const FONT = {
  // ─── 3-tier 主字体（v3.8.0 新增）────────────────────
  TITLE:  'Source Han Sans CN, Inter, Microsoft YaHei, sans-serif',  // 标题：几何感 / 现代感
  BODY:   'Microsoft YaHei, Source Han Sans CN, sans-serif',          // 正文：稳定中文
  NUMERIC:'Barlow, DIN, Microsoft YaHei, Arial',                       // 大数字 / 编号

  // ─── 向后兼容（旧键名，等同上面 3-tier 的别名）─────────
  CN:    'Microsoft YaHei, Source Han Sans CN, sans-serif',
  CN_B:  'Source Han Sans CN, Microsoft YaHei, sans-serif',  // 中文加粗：升级到 Source Han Sans
  NUM:   'Barlow, DIN, Microsoft YaHei, Arial',
  EN:    'Inter, Barlow, Open Sans, Arial',
  EN_S:  'Barlow, Inter, Arial',
  MONO:  'JetBrains Mono, Consolas, Monaco, monospace',
  SERIF: 'Source Han Serif CN, Georgia, Times New Roman, serif',  // 衬线：金句页
};

// ===== Shared Decorators =====
const shadow = () => ({
  type: 'outer', blur: 6, offset: 2, angle: 135,
  color: '000000', opacity: 0.12,
});

// ===== Shared Page Furniture =====
//
// v3.2.5 改造：从"每张幻灯片重画 Logo + 页码"改为 SlideMaster 一次定义、所有
// 内容页继承。仍保留 applyFooter() 作为兼容入口——内部检测：
//   - 若该 slide 已挂母版（pres._bringMastersDefined && slide._fromMaster），no-op
//   - 否则按旧逻辑画 Logo + 页码（向后兼容老的直接调用方式）

/**
 * 在指定 pres 实例上注册薄云品牌母版。多次调用幂等（用 pres._bringMastersDefined 标记）。
 *
 * 母版列表：
 *   - BRING_LIGHT  浅色页（content/section/toc）：白底 + Logo + 蓝色竖条 + 页码
 *   - BRING_DARK   深色页：仅 Logo（白色 PNG 兼容深底）+ 页码（备用母版）
 *
 * 调用方：
 *   - bring.addCoverSlide / addBackCoverSlide  不使用母版（独立设计）
 *   - bring.addContentSlide / addSectionSlide / addTocPage  使用 BRING_LIGHT
 */
function ensureBrandMasters(pres) {
  if (pres._bringMastersDefined) return;

  // v3.9.1: 按用户反馈移除 3 个装饰元素，只保留 Logo + 页码（最简洁母版）：
  //   ❌ 顶部 header line — 移除
  //   ❌ 左下角 signature corner mark — 移除
  //   ❌ 右侧 column rule — 移除
  //   ✅ logo — 保留（左下角，标准位置）
  //   ✅ 页码 — 保留（母版 slideNumber 定义）
  const signatureObjects = [
    { image: { path: LOGO_PATH, x: 0.4, y: 4.95, w: 1.1, h: 0.33 } },
  ];

  // 浅色页母版：白底 + 装饰 + Logo + 页码（多数内容页/章节页/目录页用）
  pres.defineSlideMaster({
    title: 'BRING_LIGHT',
    background: { color: C.WHITE },
    objects: signatureObjects,
    slideNumber: {
      x: 8.8, y: 5.15, w: 0.8, h: 0.35,
      fontSize: 13, fontFace: 'Microsoft YaHei',
      color: C.SLIDE_NUM, prefix: 'P',
    },
  });

  // 深色页母版：仅 Logo + 页码（备用，可用于未来深底页面）
  pres.defineSlideMaster({
    title: 'BRING_DARK',
    objects: [
      { image: { path: LOGO_PATH, x: 0.2, y: 5.0, w: 1.1, h: 0.33 } },
    ],
    slideNumber: {
      x: 8.8, y: 5.15, w: 0.8, h: 0.35,
      fontSize: 13, fontFace: 'Microsoft YaHei',
      color: C.WHITE, prefix: 'P',
    },
  });

  pres._bringMastersDefined = true;
}

/**
 * applyFooter — 向后兼容入口
 *
 * 历史用法：每个 A 类页面模板在 render() 末尾 applyFooter(slide, logoPath)。
 * 现在：A 类模板已改为 pres.addSlide({ masterName: 'BRING_LIGHT' | 'BRING_DARK' }) +
 * slide._fromMaster = true 标记，此处检测后跳过；保留以兼容外部调用方。
 */
function applyFooter(slide, logoPath) {
  if (slide && slide._fromMaster) return;  // 已经走母版，跳过
  if (logoPath) {
    slide.addImage({ path: logoPath, x: 0.2, y: 5.0, w: 1.1, h: 0.33 });
  }
  slide.slideNumber = {
    x: 8.8, y: 5.15, w: 0.8, h: 0.35,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.SLIDE_NUM, prefix: 'P',
  };
}

// ===== Self-Learning: Calibration Loader =====
// 支持新路径 learning/global/ 和旧路径 learning/ 兼容读取
let _calibration = { cjk: 1.0, ascii_letter: 0.55, ascii_punct: 0.35 };
function loadCalibration() {
  const cal = store.globalRead('smartfit-calibration.json', null)
    || store.readJson(store.legacyDefaultPath('smartfit-calibration.json'), null);
  if (cal && cal.charWidthMultipliers) _calibration = cal.charWidthMultipliers;
}
loadCalibration();

// ===== SmartFit Text Utility =====
function measureCharWidth(ch, fontSize) {
  const code = ch.charCodeAt(0);
  const unit = fontSize / 72;

  if (
    (code >= 0x2E80 && code <= 0x9FFF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0xFE30 && code <= 0xFE4F) ||
    (code >= 0x3000 && code <= 0x303F) ||
    (code >= 0xFF00 && code <= 0xFFEF)
  ) {
    return unit * _calibration.cjk;
  }
  if ('，。；：！？、\u201C\u201D\u2018\u2019（）【】'.indexOf(ch) !== -1) {
    return unit * _calibration.cjk;
  }
  if (code >= 0x20 && code <= 0x7E) {
    return unit * _calibration.ascii_letter;
  }
  return unit * 0.7;
}

function calcFitFontSize(text, boxW, boxH, baseFontSize, opts = {}) {
  const { lineSpacing = 1.4, minFontSize = 10, paddingX = 0, paddingY = 0 } = opts;
  if (!text) return baseFontSize;
  const effectiveW = boxW - paddingX * 2;
  const effectiveH = boxH - paddingY * 2;
  if (effectiveW <= 0 || effectiveH <= 0) return minFontSize;

  for (let fs = baseFontSize; fs >= minFontSize; fs--) {
    const segments = String(text).split('\n');
    let totalLines = 0;
    for (const seg of segments) {
      if (seg.length === 0) { totalLines += 1; continue; }
      let lineWidth = 0, lines = 1;
      for (let ci = 0; ci < seg.length; ci++) {
        const cw = measureCharWidth(seg[ci], fs);
        if (lineWidth + cw > effectiveW) { lines++; lineWidth = cw; }
        else { lineWidth += cw; }
      }
      totalLines += lines;
    }
    if (totalLines * fs * lineSpacing / 72 <= effectiveH) return fs;
  }
  return minFontSize;
}

// ===== Auto-Layout Constants (v4.1.6) =====
// B 类 layout 区上下边界 — 统一守护，避免各模板写死 4.8 / 1.0
//   LAYOUT_TOP = takeaway 下沿 (1.05) + 视觉缓冲 (0.15) = 1.20
//   LAYOUT_BOTTOM = logo 上沿 (4.95) - 视觉缓冲 (0.10) = 4.85
//   BANNER_TOP / BANNER_BOTTOM = insightBanner 专属区
//   LAYOUT_BOTTOM_WITH_BANNER = 上层 layout 的可用区下沿（banner 之上 0.05" gap）
const LAYOUT_TOP = 1.20;
const LAYOUT_BOTTOM = 4.85;
const BANNER_TOP = 4.45;
const BANNER_BOTTOM = 4.85;
const LAYOUT_BOTTOM_WITH_BANNER = 4.40;
const BANNER_H = 0.40;

// v4.1.6 — 计算 layout 在守护框 [top, bottom] 内的纵向居中起点。
//   contentH ≤ available 时居中；超出时返回 top（让模板自己缩，最后再钳制）。
function centerYInBox(top, bottom, contentH) {
  const available = bottom - top;
  if (contentH >= available) return top;
  return top + (available - contentH) / 2;
}

// v4.1.6 — 守护读取器：模板按统一接口拿可用区。
//   优先用 slide 上的 _layoutTop / _layoutBottom（由 pipeline 设置）；
//   缺省回退到 LAYOUT_TOP / LAYOUT_BOTTOM。
// v4.1.8 (修 P3-C): _contentMaxBottom 与 _layoutBottom 字段统一 —
//   旧模板可能设了 _contentMaxBottom 但忘了 _layoutBottom（或反之），
//   getLayoutBox 取较小值作为最终下沿（更安全），缺一回退到另一个，
//   两个都缺时用 LAYOUT_BOTTOM 默认。
function getLayoutBox(slide) {
  const top = (slide && typeof slide._layoutTop === 'number') ? slide._layoutTop : LAYOUT_TOP;
  const lb = slide && typeof slide._layoutBottom === 'number' ? slide._layoutBottom : null;
  const cmb = slide && typeof slide._contentMaxBottom === 'number' ? slide._contentMaxBottom : null;
  let bottom;
  if (lb != null && cmb != null) bottom = Math.min(lb, cmb);
  else if (lb != null) bottom = lb;
  else if (cmb != null) bottom = cmb;
  else bottom = LAYOUT_BOTTOM;
  return { top, bottom, available: bottom - top };
}

// v4.1.8 (修 P3-C): 工具方法 — 同时设置两个字段，避免漂移
function setLayoutBottom(slide, value) {
  if (!slide) return;
  slide._layoutBottom = value;
  slide._contentMaxBottom = value;  // deprecated alias，保持同步直到 v4.2 统一移除
}

// ===== Auto-Layout Utilities =====
function resolveStartY(slide, explicitStartY, defaultStartY) {
  // v4.1.7 (修 P1-3): 让 ~60 个未改造旧模板自动享受守护框保护。
  //   所有路径都用 _layoutTop 作为下限，防 startY 顶撞标题 / 跑到守护框上沿之上。
  const topGuard = (slide && typeof slide._layoutTop === 'number') ? slide._layoutTop : LAYOUT_TOP;
  if (explicitStartY != null) return Math.max(explicitStartY, topGuard);
  if (slide._bottomY) return Math.max(slide._bottomY + 0.25, topGuard);
  // v4.1.5: 默认起点抬到 LAYOUT_TOP (1.20)，与 takeaway 留 0.15" 间距
  return Math.max(defaultStartY != null ? defaultStartY : LAYOUT_TOP, topGuard);
}

function validateBounds(slide, bottomY, templateName) {
  // v4.1.6: 默认下限统一到 _layoutBottom（含 banner 自动收缩）回退 LAYOUT_BOTTOM
  const maxBottom = (slide && typeof slide._layoutBottom === 'number')
    ? slide._layoutBottom
    : (slide._contentMaxBottom || LAYOUT_BOTTOM);
  // 浮点容差：> maxBottom + 0.15 才视为真正溢出（避免 4.90 vs 4.90 FP 比较误报）
  if (bottomY > maxBottom + 0.15) {
    const overflowAmt = (bottomY - maxBottom).toFixed(2);
    const tpl = templateName || slide._templateName || 'unknown';
    const sid = slide._slideId || '';
    console.warn(
      `[BRINGPPT] Layout overflow: bottomY=${bottomY.toFixed(2)}" exceeds maxBottom=${maxBottom}" by ${overflowAmt}" [template=${tpl}${sid ? ', slide=' + sid : ''}]`
    );
    // 自动写入 SmartFit 校准数据
    try {
      const { spawnSync } = require("child_process");
      const recordScript = require("path").join(__dirname, "..", "record-learning.js");
      const payload = JSON.stringify({
        template:           templateName || slide._templateName || "unknown",
        boxH:               maxBottom,
        actualBottomY:      bottomY,
        overflowInches:     parseFloat(overflowAmt),
        source:             "auto_overflow",   // [Fix6] 来源追踪
        date:               new Date().toISOString().slice(0, 10),
      });
      spawnSync(process.execPath, [recordScript, "--calibrate", payload], { stdio: "pipe" });
    } catch (e) { /* 校准记录失败不影响主流程 */ }
  }
  slide._bottomY = bottomY;
}

// ===== Icon Rendering =====
// Optional feature: do not make React/sharp mandatory for the core PPT generator.
// Templates currently render numeric placeholders by default. If a future template
// explicitly passes React icon components, these dependencies are loaded lazily.
let _iconDeps = null;
function loadIconDeps() {
  if (_iconDeps) return _iconDeps;
  try {
    _iconDeps = {
      React: require('react'),
      ReactDOMServer: require('react-dom/server'),
      sharp: require('sharp'),
    };
    return _iconDeps;
  } catch (e) {
    throw new Error('Icon rendering requires optional packages react, react-dom, and sharp. Install them only if icon rendering is needed. Original error: ' + e.message);
  }
}

function renderIconSvg(IconComponent, color = '#000000', size = 256) {
  const { React, ReactDOMServer } = loadIconDeps();
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const { sharp } = loadIconDeps();
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + pngBuffer.toString('base64');
}

// ===== Self-Learning: Context Reader =====
function getLearningContext() {
  try {
    const reader = require('../learning-context');
    const ctx = reader.getLearningContext();
    const trapCount = Object.values(ctx.knownTraps || {}).reduce((sum, arr) => sum + arr.length, 0);
    const lines = ['=== BRINGPPT 学习上下文 ==='];

    if (trapCount > 0) {
      lines.push(`\n【已知陷阱】(${trapCount}条)`);
      for (const [tpl, traps] of Object.entries(ctx.knownTraps || {})) {
        for (const ep of traps.slice(-3)) {
          lines.push(`- ${ep.id}: ${tpl} ${ep.condition} -> ${ep.fix || ''}`);
        }
      }
    }

    const prefs = ctx.userPreferences || {};
    if ((prefs.preferred || []).length > 0 || (prefs.avoided || []).length > 0 || (prefs.recentCorrections || []).length > 0) {
      lines.push('\n【用户偏好】');
      if ((prefs.preferred || []).length > 0) lines.push(`- 偏好模板: ${prefs.preferred.join(', ')}`);
      if ((prefs.avoided || []).length > 0) lines.push(`- 回避模板: ${prefs.avoided.join(', ')}`);
      for (const c of (prefs.recentCorrections || [])) {
        lines.push(`- 修正: ${c.original}->${c.correctedTo} (${c.reason})`);
      }
    }

    if (ctx.meta && ctx.meta.totalGenerations > 0) {
      lines.push(`\n【模板使用统计】(${ctx.meta.totalGenerations}次生成)`);
      for (const t of (ctx.templateRanking || []).slice(0, 5)) {
        lines.push(`- ${t.name}: ${t.count}次`);
      }
    }

    if (ctx.meta) {
      lines.push(`\n【SmartFit校准】v${ctx.meta.calibrationVersion}`);
    }

    return lines.length > 1 ? lines.join('\n') : '（暂无学习数据）';
  } catch {
    return '（学习上下文读取失败）';
  }
}

// ===== Exports =====
// v3.7.5: FONTS 是 FONT 的别名（新模板应该用 FONTS.primary / FONTS.en / FONTS.numeric
// 这种语义键名；FONT.CN/EN/NUM 保留向后兼容）
const FONTS = Object.freeze({
  primary: FONT.CN,         // 中文主字体
  primaryBold: FONT.CN_B,
  numeric: FONT.NUM,        // 大数字 / 编号
  en: FONT.EN,              // 英文正文
  enSmall: FONT.EN_S,       // 英文小字
  mono: FONT.MONO,
  monoEn: FONT.MONO,
  serifEn: FONT.SERIF,
  // v3.8.0 新增：3-tier 语义键
  title: FONT.TITLE,        // 章节标题、页面大标题
  body:  FONT.BODY,         // 正文
  // 兼容老键名（直接转发）
  CN: FONT.CN, CN_B: FONT.CN_B, NUM: FONT.NUM,
  EN: FONT.EN, EN_S: FONT.EN_S, MONO: FONT.MONO, SERIF: FONT.SERIF,
});

module.exports = {
  pptxgen,
  C,
  STEP_COLORS,
  STEP_HIGHLIGHTS,  // v4.0.6: { gold, brick } — 模板按需调用作"仅 1 处点睛"
  FONT,
  FONTS,
  LOGO_PATH,
  BRAND,          // v3.7.40: 当前生效的品牌配置（{name, displayName, colors, fonts, logo, footer}）
  GRID: grid.GRID,                  // v3.8.1: 12 列 grid 常量
  gridX: grid.gridX,                // v3.8.1: grid 列号 → x 坐标
  gridW: grid.gridW,                // v3.8.1: span → 宽度
  gridSpan: grid.gridSpan,          // v3.8.1: n 张卡均分 12 列
  snapX: grid.snapX,                // v3.8.1: snap 到最近 1/16 英寸
  gridLayout: grid.layout,          // v3.8.1: 预设布局
  shadow,
  applyFooter,
  ensureBrandMasters,
  calcFitFontSize,
  measureCharWidth,
  resolveStartY,
  validateBounds,
  LAYOUT_TOP,                  // v4.1.5: B 类 layout 区上边界 1.20
  LAYOUT_BOTTOM,               // v4.1.5: B 类 layout 区下边界 4.85
  BANNER_TOP,                  // v4.1.6: insightBanner 专属区上沿 4.45
  BANNER_BOTTOM,               // v4.1.6: insightBanner 专属区下沿 4.85
  BANNER_H,                    // v4.1.6: banner 固定高度 0.40
  LAYOUT_BOTTOM_WITH_BANNER,   // v4.1.6: 含 banner 时上层 layout 下沿 4.40
  centerYInBox,                // v4.1.6: 纵向居中辅助
  getLayoutBox,                // v4.1.6: 拿守护框 { top, bottom, available }
  setLayoutBottom,             // v4.1.8: 同时设置 _layoutBottom + _contentMaxBottom（避免漂移）
  renderIconSvg,
  iconToBase64Png,
  getLearningContext,
};
