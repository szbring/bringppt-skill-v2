'use strict';
/**
 * bring-core.js — 聚合导出器 (v4.0)
 *
 * 职责：从 lib/infra.js + templates/ registry 动态组装全部导出。
 * 调用方式与 v3.x 完全兼容。
 *
 * A类页面模板（isPageTemplate=true）：addXxx(pres, data)  → slide
 * B类布局模板：                        addXxx(pres, slide, data)
 */

const infra    = require('./lib/infra');
const registry = require('./registry');

// ── 动态生成 add* 函数 ─────────────────────────────────────────
const templateExports = {};

registry.list().forEach(tpl => {
  // 标准驼峰函数名：threeColumn → addThreeColumn
  const stdFn = 'add' + tpl.name[0].toUpperCase() + tpl.name.slice(1);

  const fn = tpl.isPageTemplate
    ? (pres, data)        => tpl.render(pres, data, infra)   // A类
    : (pres, slide, data) => tpl.render(pres, slide, data, infra); // B类

  templateExports[stdFn] = fn;
});

// ── 向后兼容别名 ───────────────────────────────────────────────
// threeColumn 旧函数名为 addThreeColumnWithSummary
templateExports.addThreeColumnWithSummary = templateExports.addThreeColumn;

// ── 自学习上下文（供 AI 生成前读取）──────────────────────────
let _learningContext;
function getLearningContext() {
  if (!_learningContext) {
    try {
      _learningContext = require('./learning-context').getLearningContext();
    } catch { _learningContext = null; }
  }
  return _learningContext;
}

// ── 导出 ──────────────────────────────────────────────────────
module.exports = { ...infra, ...templateExports, registry, getLearningContext };
