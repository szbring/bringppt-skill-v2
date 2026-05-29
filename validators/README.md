# validators/

**目标布局**：把 `validate-slides.js`（原 1814 行 god module）分拆为多个 < 300 行的职责单一模块。

## 当前状态（v3.7.7）

| 模块 | 已抽出 | 职责 |
|---|---|---|
| `text-utils.js` | ✅ | 文本长度、color 值递归遍历等纯函数工具 |
| `height-estimator.js` | ✅ | `estimateLayoutHeight()` 与 `LAYOUT_HEIGHT` 表 |
| `schema.js` | 🚧 计划 | `validateSlide()` 主流程 + schema lookup |
| `visual.js` | 🚧 计划 | `validateVisualLayout()` 空间预算、重叠检测 |
| `content.js` | 🚧 计划 | `validateContentDensity()` desc 字数、enrichment |
| `stats.js` | ✅ | `collectStats()` + `printStats()` |
| `traps.js` | ✅ | `detectKnownTrapHits()` 学习库比对 |

## 设计目标

- 每个模块 ≤ 300 行
- 单一职责，可独立单测
- `validate-slides.js` 退化为 CLI 入口 + 调度器（目标 ≤ 200 行）

## 抽取流程模板

1. 找出 god module 里一组高内聚的函数
2. 复制到 `validators/<topic>.js`，加 'use strict' + module.exports
3. validate-slides.js 顶部 require 进来；旧函数体改为 `const { foo } = require('./validators/topic')` 转发
4. 跑 `npm test` 确保 5/5 不退化
5. 一次 PR 一个模块，避免一次大重构带回归
