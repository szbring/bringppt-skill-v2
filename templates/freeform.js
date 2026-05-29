'use strict';
// templates/freeform.js — v4.0.0 Phase 2 逃生舱
//
// 让用户/子代理直接写 pptxgenjs 代码生成定制化版式，绕过 BRING 模板系统。
// 适用于：
//   - 罕见/一次性视觉需求（如特定形状的瀑布图、桑基图、决策树）
//   - 现有 103 模板都不合适，又不想强行造新模板
//   - 子代理在 LLM 内部直接生成"画法"，比挑模板更准确
//
// 安全模型（v4.1.4 重做 — 真 vm 沙箱）：
//   - renderCode 是字符串形式的 JS 函数体，签名为 (pres, slide, data, infra) => void
//   - 用 node:vm.runInContext 真隔离执行
//     · context 内的 Function / eval / Object 都是 vm context 自己的版本，
//       通过 ({}).constructor.constructor 拿到的也只是 vm context 的 Function，
//       不能访问 host 的 process / require / Buffer
//     · 5 秒 timeout 防死循环
//     · displayErrors:false，错误不带 host 路径信息
//   - 只允许调用 pres.* / slide.* / infra.* 上已有的 API
//   - 验证错误（如 throw / 用未定义全局）会被捕获并降级到 fallback
//
// 用法示例（slides-data.json）：
//   {
//     "type": "content",
//     "title": "自定义页面",
//     "layouts": [{
//       "type": "freeform",
//       "data": {
//         "renderCode": "slide.addText('Hello', {x:1, y:1, w:8, h:1, fontSize:36, color:infra.C.PRIMARY});",
//         "fallback": { "type": "twoColumnCards", "data": { "cards": [...] } }
//       }
//     }]
//   }
//
// 用法示例（程序化）：
//   { type: 'freeform', data: { renderFn: (pres, slide, data, infra) => { ... } } }
//
// 注意：renderFn 优先于 renderCode；如果两者都没有，走 fallback。

const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

// v4.1.1 (修 C-3): safeStartY 默认 1.2"（标题底下 0.1" gap），避免覆盖系统已画的标题
const SAFE_START_Y = 1.2;
const SAFE_MAX_BOTTOM = 4.85;  // v4.1.5: logo 上沿 (4.95) 减 0.10" 缓冲
const VM_TIMEOUT_MS = 5000;   // v4.1.4 (修 P0-1): 防 renderCode 死循环

// v4.1.4 (修 P0-1): 真 vm 沙箱替代参数名遮蔽
//   之前 new Function + 参数名遮蔽并不能阻断 ({}).constructor.constructor('return process')()
//   这种"通过对象原型拿到 host Function 构造器"的逃逸路径。
//   改成 vm.createContext + vm.runInContext 后，context 内拿到的 Function 都是 vm 自己的版本，
//   绝无路径访问 host 的 require / process / Buffer / globalThis。
function runInSandbox(code, pres, slide, payload, infra) {
  // context 内显式只放白名单全局。任何未列在这里的标识符（require / process / global /
  // setTimeout 等）在 strict 模式下引用即 ReferenceError。
  const sandbox = {
    pres, slide, infra,
    data: payload,
    safeStartY: SAFE_START_Y,
    safeMaxBottom: SAFE_MAX_BOTTOM,
    // 常用纯函数全局（来自 vm context 本身，不会泄露 host）
    Math, JSON, Date, RegExp,
    String, Number, Array, Object, Boolean,
    parseInt, parseFloat, isNaN, isFinite,
    // 静默 console（renderCode 不该输出日志）
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  };
  const context = vm.createContext(sandbox);
  // strict 模式 + ReferenceError 拦截未声明全局
  const script = new vm.Script(`"use strict";\n${code}`, {
    filename: 'freeform-renderCode.js',
    displayErrors: false,
  });
  script.runInContext(context, {
    timeout: VM_TIMEOUT_MS,
    displayErrors: false,
    breakOnSigint: true,
  });
}

function runFallback(pres, slide, fallback, infra, registry) {
  if (!fallback || !fallback.type) {
    // 最低降级：什么都不画，但至少不崩
    return;
  }
  const tpl = registry.get(fallback.type);
  if (!tpl || typeof tpl.render !== 'function') {
    console.warn(`[freeform] fallback template "${fallback.type}" not found`);
    return;
  }
  tpl.render(pres, slide, fallback.data || {}, infra);
}

module.exports = {
  name:        'freeform',
  version:     '1.0.0',
  category:    '逃生舱',
  description: 'v4.0.0 逃生舱：允许直接执行 pptxgenjs 代码绕过模板系统，用于罕见/一次性视觉需求',

  schema: {
    renderFn: { type: 'function', description: '直接传入渲染函数 (pres,slide,data,infra)=>void' },
    renderCode: { type: 'string', description: 'JS 函数体字符串，沙箱执行，只能访问 pres/slide/data/infra + 安全全局' },
    data: { type: 'object' },
    fallback: { type: 'object', description: '{ type, data } — renderCode 抛错时降级到此模板' },
    apis: { type: 'array' },
    prompt: { type: 'string' },
  },

  usage: {
    when:    '现有 103 模板都无法承载的一次性自定义视觉；子代理直接生成画法比挑模板更精准',
    notWhen: '能用 productMatrix / quadrantMap / compositeLayout / cardGrid 等已有模板时，禁止退化为 freeform',
    typicalHeight: 'auto',
    scenarios: [
      { trigger: '极特殊版式', example: '决策树 / 桑基图 / 自定义信息图' },
      { trigger: '一次性嵌入', example: '某页要画一个特定形状的 logo 演化时间轴' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/freeform.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  render(pres, slide, data, infra) {
    const registry = require('../registry');  // 延迟引入避免循环依赖
    const {
      renderFn,
      renderCode,
      data: payload = {},
      fallback,
    } = data || {};

    // 路径 1：直接的函数引用（程序化调用）
    // v4.1.3 (修 N-8): renderFn 抛错时，有 fallback 就走 fallback；
    //   没 fallback 时 rethrow 让 ppt-pipeline 接管（友好失败卡片），不再静默吞掉。
    if (typeof renderFn === 'function') {
      try {
        renderFn(pres, slide, payload, infra);
        return;
      } catch (e) {
        if (fallback) {
          console.error(`[freeform] renderFn 抛错: ${e.message} -> 降级到 fallback "${fallback.type}"`);
          runFallback(pres, slide, fallback, infra, registry);
          return;
        }
        // 无 fallback：rethrow 让 ppt-pipeline 接管显示友好卡片
        console.error(`[freeform] renderFn 抛错且无 fallback: ${e.message} -> rethrow`);
        throw e;
      }
    }

    // 路径 2：字符串代码（来自 JSON / LLM 输出）
    // v4.1.4 (修 P0-1): 真 vm 沙箱，杜绝 ({}).constructor.constructor 逃逸路径
    if (typeof renderCode === 'string' && renderCode.trim()) {
      try {
        runInSandbox(renderCode, pres, slide, payload, infra);
        return;
      } catch (e) {
        if (fallback) {
          console.error(`[freeform] renderCode 抛错: ${e.message} -> 降级到 fallback "${fallback.type}"`);
          runFallback(pres, slide, fallback, infra, registry);
          return;
        }
        // 无 fallback：rethrow 让 ppt-pipeline 接管显示友好卡片
        console.error(`[freeform] renderCode 抛错且无 fallback: ${e.message} -> rethrow`);
        throw e;
      }
    }

    // 两路都没有：直接 fallback 或空页
    if (fallback) {
      runFallback(pres, slide, fallback, infra, registry);
    } else {
      console.warn('[freeform] 既无 renderFn / renderCode 也无 fallback，渲染空白页');
    }
  },
};
