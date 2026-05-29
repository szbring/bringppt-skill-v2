'use strict';
/**
 * lib/layout-map.js — 统一的 B 类布局映射
 *
 * 历史上 LAYOUT_MAP 被复制到三个地方（ppt-pipeline / gen_ppt_template / tests/run-baseline），
 * 三份手工维护互相漂移。本模块从 registry 自动生成 B 类 layout 到 add* 函数的映射，
 * 新增模板时**无需修改任何 LAYOUT_MAP 调用方**。
 *
 * v3.7.5: 函数返回前**自动注入 slide._templateName = name**，调用方不再需要手动设置
 * （之前必须 slide._templateName = lay.type 才能让 validateBounds 报对模板名）。
 *
 * 用法：
 *   const buildLayoutMap = require('{SKILL_DIR}/lib/layout-map');
 *   const layoutMap = buildLayoutMap(bring);   // 传入 bring-core 实例
 *   const fn = layoutMap[lay.type];
 *   if (fn) fn(pres, slide, lay.data);   // _templateName 自动注入，无需手设
 *
 * 设计：
 *   - 只包含 B 类模板（isPageTemplate !== true）
 *   - A 类页面模板走 lib/page-template-map.js（v3.7.4 起对称自动注册）
 *   - 函数签名：fn(pres, slide, data)
 */

const registry = require('../registry');

// v4.1.4 (修 P2-2): 历史名 alias，在 LAYOUT_MAP 中注册旧名指向当前模板的包装函数
//   与 registry.js 的 LEGACY_ALIAS 对齐。LLM 用 chartLine / causalChain / radialHub 等
//   旧名时 LAYOUT_MAP[name] 命中，避免走 unknown-layout 兜底。
const LEGACY_ALIAS = {
  causalChain:  'stepList',
  radialHub:    'cloudConcept',
  chartLine:    'chartBar',
  chartPie:     'chartBar',
  chartCombo:   'chartBar',
  chartArea:    'chartBar',
  cycleDiagram: 'cardGrid',
  imageText:    'twoColumnCards',
  imageGallery: 'cardGrid',
};

function buildLayoutMap(bring) {
  if (!bring || typeof bring !== 'object') {
    throw new TypeError('[layout-map] buildLayoutMap requires a bring-core instance');
  }
  const map = {};
  for (const tpl of registry.list()) {
    if (tpl.isPageTemplate) continue;
    const fnName = 'add' + tpl.name[0].toUpperCase() + tpl.name.slice(1);
    const rawFn = bring[fnName];
    if (typeof rawFn !== 'function') {
      // 这一般意味着 templates/ 加入了新模板但 bring-core 没正确导出
      console.warn(`[layout-map] Skipping template "${tpl.name}": bring.${fnName} is not a function`);
      continue;
    }
    // v3.7.5: 包装一层，调用 raw 函数前先注入 _templateName，避免 caller 漏写
    const name = tpl.name;
    map[name] = function wrappedTemplateFn(pres, slide, data) {
      if (slide && !slide._templateName) slide._templateName = name;
      return rawFn(pres, slide, data);
    };
  }
  // v4.1.4 (修 P2-2): 注册旧名 alias 指向已存在模板的包装函数
  for (const [legacy, target] of Object.entries(LEGACY_ALIAS)) {
    if (map[target] && !map[legacy]) {
      const targetFn = map[target];
      map[legacy] = function legacyAliasFn(pres, slide, data) {
        if (slide && !slide._templateName) slide._templateName = target;
        return targetFn(pres, slide, data);
      };
    }
  }
  return map;
}

module.exports = buildLayoutMap;
