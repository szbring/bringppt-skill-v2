'use strict';
/**
 * lib/page-template-map.js — 统一的 A 类页面模板分发（v3.7.4）
 *
 * 与 lib/layout-map.js 对称：
 *   - layout-map.js  负责 B 类（content slide 内的 layout 块）
 *   - page-template-map.js 负责 A 类（整页页面模板：cover / section / toc / backCover / closingQuote 等）
 *
 * 设计动机：
 *   v3.7.3 之前，A 类分发在 gen_ppt_template.js 和 ppt-pipeline.js 里各有一个 7-case 硬编码 switch。
 *   新增 closingQuote（v3.7.0）时漏改两处 switch，导致 storyboard 用 type:"closingQuote" 时被
 *   静默 fallthrough。本模块从 registry 自动生成 dispatcher，新增 A 类模板时 0 处手工改。
 *
 * 用法：
 *   const buildPageMap = require('{SKILL_DIR}/lib/page-template-map');
 *   const pageMap = buildPageMap(bring);   // 传入 bring-core 实例
 *   const fn = pageMap[s.type];            // 例如 type='cover'→addCoverSlide, type='closingQuote'→addClosingQuote
 *   if (fn) slide = fn(pres, s);
 *
 * 命名规则（storyboard type → registry name）：
 *   storyboard 的 type 简化命名（如 'cover'/'section'/'toc'/'backCover'）与 registry 的全称
 *   （'coverSlide'/'sectionSlide'/'tocPage'/'backCoverSlide'）之间有一层别名映射。
 *   下方 ALIASES 表是历史包袱兼容；新增 A 类模板时直接用 registry 名作为 type 即可（如 closingQuote）。
 */

const registry = require('../registry');

// 历史包袱：storyboard type → registry 模板名
const ALIASES = {
  cover:       'coverSlide',
  section:     'sectionSlide',
  backCover:   'backCoverSlide',
  toc:         'tocPage',
  // contentSlide、closingQuote 与 registry 名一致，无需别名
};

function buildPageMap(bring) {
  if (!bring || typeof bring !== 'object') {
    throw new TypeError('[page-template-map] buildPageMap requires a bring-core instance');
  }
  const map = {};
  for (const tpl of registry.list()) {
    if (!tpl.isPageTemplate) continue;
    const fnName = 'add' + tpl.name[0].toUpperCase() + tpl.name.slice(1);
    const fn = bring[fnName];
    if (typeof fn !== 'function') {
      console.warn(`[page-template-map] Skipping A-class template "${tpl.name}": bring.${fnName} is not a function`);
      continue;
    }
    // 注册 registry 名 (如 'closingQuote', 'coverSlide')
    map[tpl.name] = fn;
  }
  // 注册历史别名（'cover' → 'coverSlide' 的函数）
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (map[target]) map[alias] = map[target];
  }
  return map;
}

module.exports = buildPageMap;
