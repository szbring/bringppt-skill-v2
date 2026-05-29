'use strict';
/**
 * registry.js — BRINGPPT 模板注册中心
 *
 * 自动加载 templates/ 目录下所有插件，提供统一查询接口。
 * 供 bring-core.js（导出）、validate-slides.js（验证）、agent（选模板）共同使用。
 *
 * v4.1.0 启动测量与懒加载评估：
 *   - 实测 92 个模板冷启动 ≈ 40-55ms（去重前估计 250-400ms 不成立）。
 *   - 瓶颈不在 registry.js：Node module cache 让重复 require 免费，
 *     单文件平均解析时间 ~0.4ms。Top-5 模板（lineupCompare/bigNumber/
 *     achievement/beforeAfter/actionTitleSlide）合计 ~7ms。
 *   - 已加 require cache 复用 + sort 仅一次。
 *   - bring-core.js 通过 registry.list().forEach 包装 render 到闭包，
 *     未真正调用 render 之前，模板 inner require（如 keypoints-helpers）
 *     不会触发执行——天然懒加载，无需 Proxy。
 *
 *   对外 API 不变：register / get / has / list / names / listByCategory /
 *                  categories / size。get(name).render(...) 仍可工作。
 *
 *   可调用环境变量 BRINGPPT_REGISTRY_PROFILE=1 输出加载耗时分布。
 */

const path = require('path');
const fs   = require('fs');

const _templates = new Map();
const _profile   = process.env.BRINGPPT_REGISTRY_PROFILE === '1';

function attachRuntimeLearningGetter(tpl) {
  if (Object.getOwnPropertyDescriptor(tpl, 'selfLearning')) return;
  Object.defineProperty(tpl, 'selfLearning', {
    enumerable: true,
    configurable: true,
    get() {
      try {
        const store = require('./lib/learning-store');
        return store.loadTemplateLearning(tpl.name, { errorPatterns: [], corrections: [] });
      } catch {
        return { errorPatterns: [], corrections: [] };
      }
    },
  });
}

function register(tpl) {
  const required = ['name', 'schema', 'render', 'usage'];
  required.forEach(k => {
    if (!tpl[k]) throw new Error(`[registry] Template "${tpl.name}" missing required field: ${k}`);
  });
  attachRuntimeLearningGetter(tpl);
  if (_templates.has(tpl.name)) {
    console.warn(`[registry] Overwriting existing template: ${tpl.name}`);
  }
  _templates.set(tpl.name, tpl);
}

// v4.1.4 (修 P2-2): 旧名 → 当前名 alias map
//   LLM 子代理常用历史名（如 causalChain / chartLine / radialHub），但 v4.0.0 起这些
//   都被软删除，触发 unknown-layout 兜底。此处补一层 alias 让旧名命中合理的现存模板。
//   注意：tocPage 是当前注册名，不在 alias map（A 类页面用 page-template-map 的 'toc' 别名）。
const LEGACY_ALIAS = {
  causalChain:  'stepList',     // 因果链 → 步骤型（最近义）
  radialHub:    'cloudConcept', // 中心辐射 → 关键概念云
  chartLine:    'chartBar',     // chart 家族在 v4.0.0 收口到 chartBar
  chartPie:     'chartBar',
  chartCombo:   'chartBar',
  chartArea:    'chartBar',
  cycleDiagram: 'cardGrid',     // 循环图 → 卡片网格
  imageText:    'twoColumnCards', // 图文 → 双列卡片
  imageGallery: 'cardGrid',     // 图片画廊 → 卡片网格
};

function _resolveAlias(name) {
  if (_templates.has(name)) return name;
  if (LEGACY_ALIAS[name] && _templates.has(LEGACY_ALIAS[name])) {
    return LEGACY_ALIAS[name];
  }
  return name;  // 返回原名，上游 get() 会得到 null → unknown-layout 路径
}

function get(name) {
  const resolved = _resolveAlias(name);
  return _templates.get(resolved) || null;
}
function has(name)           { return _templates.has(_resolveAlias(name)); }
function list()              { return [..._templates.values()]; }
function names()             { return [..._templates.keys()]; }
function listByCategory(cat) { return list().filter(t => t.category === cat); }
function categories()        { return [...new Set(list().map(t => t.category))]; }
function size()              { return _templates.size; }

// 自动加载 templates/ 目录（按文件名字母序，跳过 _ 开头的文件）
const TPLS_DIR = path.join(__dirname, 'templates');
if (fs.existsSync(TPLS_DIR)) {
  const _t0 = _profile ? process.hrtime.bigint() : null;
  const _times = _profile ? [] : null;
  fs.readdirSync(TPLS_DIR)
    .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.'))
    .sort()
    .forEach(f => {
      try {
        const _ts = _profile ? process.hrtime.bigint() : null;
        const tpl = require(path.join(TPLS_DIR, f));
        if (_profile) _times.push({ f, ms: Number(process.hrtime.bigint() - _ts) / 1e6 });
        // v4.0.0: 软删除支持 — 文件 export null/undefined 时静默跳过
        if (tpl && tpl.name) register(tpl);
      } catch (e) {
        console.error(`[registry] Failed to load template ${f}: ${e.message}`);
      }
    });
  if (_profile) {
    const total = Number(process.hrtime.bigint() - _t0) / 1e6;
    _times.sort((a, b) => b.ms - a.ms);
    console.error(`[registry] loaded ${_templates.size} templates in ${total.toFixed(2)}ms`);
    console.error('[registry] top-5 slowest:');
    _times.slice(0, 5).forEach(t => console.error(`  ${t.ms.toFixed(3)}ms  ${t.f}`));
  }
}

module.exports = { register, get, has, list, names, listByCategory, categories, size };
