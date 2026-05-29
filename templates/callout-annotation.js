'use strict';
// templates/callout-annotation.js
// v4.1.5 已软删除（module.exports = null，registry 静默跳过）
//
// 历史说明（保留代码以备查阅）：calloutAnnotation 原本是"产品 UI 截图 + 指引线 + 气泡"
// 标注模板，但在实际生成中，LLM 子代理常常孤立调用它 — 没有底图、没有 tipX/tipY，
// 只剩 3 个气泡水平排开，视觉上无意义且容易被误用为"卡片"。
//
// v4.1.5 软删：用户决定移除该模板。若未来需要标注气泡能力，建议改造为：
//   - 强制 require base image 或 chart_id（hard requirement）
//   - 或合并进 freeform.js 的"插画 + 标注"复合 layout
//
// 当前 export null，registry.js 静默跳过此文件（见 v4.0.0 软删除支持）。
module.exports = null;
