#!/usr/bin/env node
/**
 * validate-slides.js — Pre-build data validator for BRINGPPT slides-data
 *
 * Usage:
 *   node validate-slides.js ./slides-data.js
 *   node validate-slides.js ./slides-data-m1.js ./slides-data-m2.js ...
 *
 * Exit code: 1 if ERROR found, 0 if only WARN or clean
 */

// ===== Validators 入口（v3.7.9 全量拆分后，本文件退化为 CLI + main 调度）=====
const { collectStats, printStats } = require('./validators/stats');
const { detectKnownTrapHits } = require('./validators/traps');
const { validateVisualLayout } = require('./validators/visual');
const { validateContentDensity } = require('./validators/content');
const { validateSlide } = require('./validators/schema');
const { textLen } = require('./validators/text-utils');

// 收集主 schema validation 的 issues（其余子 validator 各自返回数组）
const issues = [];



// ===== Main =====
function main() {
  const rawArgs = process.argv.slice(2);
  const contentMode = rawArgs.includes("--content");
  const statsMode = rawArgs.includes("--stats");
  const visualMode = rawArgs.includes("--visual");
  const strictLearning = rawArgs.includes("--strict-learning");  // [Fix9] 闸门 2
  // v3.7.5: 学习写入改为默认开启（数据飞轮真正转起来）
  //   -- 老命令保留：--record-learning 仍是有效开关（兼容）
  //   -- 新开关：--no-record-learning 显式关闭（CI / 测试草稿场景）
  //   -- 环境变量 BRINGPPT_LEARNING_DISABLED=1 全局关闭（已存在）
  const explicitOff = rawArgs.includes("--no-record-learning") || rawArgs.includes("--no-learn");
  const explicitOn  = rawArgs.includes("--record-learning") || rawArgs.includes("--learn");
  const envDisabled = process.env.BRINGPPT_LEARNING_DISABLED === '1';
  const recordLearning = explicitOn || (!explicitOff && !envDisabled);
  const files = rawArgs.filter(a => !a.startsWith("--"));

  if (files.length === 0) {
    console.log("Usage: node validate-slides.js [--content] [--stats] [--visual] [--strict-learning] [--no-record-learning] <slides-data.json> [more-files...]");
    console.log("  Validates slides-data files before PPT generation.");
    console.log("  --content              Run content density checks (desc length and enrichment fields)");
    console.log("  --stats                Print stats report (layout distribution, enrichment rates, param usage)");
    console.log("  --visual               Run visual layout checks (space budget, overlap detection, height estimation)");
    console.log("  --strict-learning      Exit 2 if errors match known traps (for CI / pipeline integration; normal validation failure exits 1)");
    console.log("  --no-record-learning   Disable recording validation ERRORs into the runtime learning store");
    console.log("                         (default is ON since v3.7.5; can also be disabled via BRINGPPT_LEARNING_DISABLED=1)");
    process.exit(0);
  }

  let allSlides = [];

  for (const file of files) {
    let mod;
    try {
      mod = require(require("path").resolve(file));
    } catch (e) {
      console.error(`[ERROR] Cannot load "${file}": ${e.message}`);
      process.exit(1);
    }
    const slideArr = mod.slides || mod.default?.slides || (Array.isArray(mod) ? mod : null);
    if (!slideArr) {
      console.error(`[ERROR] "${file}" does not export a "slides" array`);
      process.exit(1);
    }
    allSlides = allSlides.concat(slideArr);
  }

  // Run validation
  for (let i = 0; i < allSlides.length; i++) {
    validateSlide(issues, allSlides[i], i, allSlides);
  }

  // Run content density validation (--content mode)
  let contentIssues = [];
  if (contentMode) {
    for (let i = 0; i < allSlides.length; i++) {
      contentIssues = contentIssues.concat(validateContentDensity(allSlides[i], i));
    }
  }

  // Run visual layout validation (--visual mode)
  let visualIssues = [];
  if (visualMode) {
    for (let i = 0; i < allSlides.length; i++) {
      visualIssues = visualIssues.concat(validateVisualLayout(allSlides[i], i));
    }
  }

  // v3.7.27: 跨页一致性校验（Pillar D）—— content/visual 任一开启时自动跑
  let crossPageIssues = [];
  if (contentMode || visualMode) {
    try {
      const crossPage = require('./validators/cross-page');
      const r = crossPage.run({ slides: allSlides });
      r.errors.forEach(m => crossPageIssues.push({ level: 'ERROR', slideId: '(cross-page)', msg: m }));
      r.warnings.forEach(m => crossPageIssues.push({ level: 'WARN', slideId: '(cross-page)', msg: m }));
    } catch (e) {
      console.warn('[cross-page] validator 失败：', e.message);
    }
  }

  // Output results
  const allIssues = issues.concat(contentIssues).concat(visualIssues).concat(crossPageIssues);
  const errors = allIssues.filter(i => i.level === "ERROR");
  const warns = allIssues.filter(i => i.level === "WARN");

  for (const iss of allIssues) {
    const tag = iss.level === "ERROR" ? "\x1b[31m[ERROR]\x1b[0m" : "\x1b[33m[WARN]\x1b[0m";
    console.log(`${tag}  ${iss.slideId}: ${iss.msg}`);
  }

  // Content density summary (--content mode)
  if (contentMode) {
    let totalDesc = 0, descCount = 0;
    for (const s of allSlides) {
      if (s.type === "content" && s.layouts) {
        for (const lay of s.layouts) {
          if (!lay.data) continue;
          const d = lay.data;
          const descFields = [
            ...(Array.isArray(d.steps) ? d.steps.map(x => x.desc) : []),
            ...(Array.isArray(d.layers) ? d.layers.map(x => x.desc) : []),
            ...(Array.isArray(d.items) ? d.items.map(x => x.desc) : []),
          ];
          for (const df of descFields) {
            if (typeof df === "string") { totalDesc += textLen(df); descCount++; }
          }
        }
      }
    }
    console.log("");
    console.log(`[CONTENT]  Avg desc length: ${descCount ? Math.round(totalDesc / descCount) : 0} chars (${descCount} desc fields)`);
    console.log(`[CONTENT]  Content density issues: ${contentIssues.filter(i => i.level === "ERROR").length} ERROR, ${contentIssues.filter(i => i.level === "WARN").length} WARN`);
  }

  // Visual layout summary (--visual mode)
  if (visualMode) {
    console.log("");
    console.log(`[VISUAL]  Layout height estimation and space budget validation`);
    console.log(`[VISUAL]  Visual layout issues: ${visualIssues.filter(i => i.level === "ERROR").length} ERROR, ${visualIssues.filter(i => i.level === "WARN").length} WARN`);

    // Count slides with multiple layouts
    const multiLayoutSlides = allSlides.filter(s => s.type === "content" && s.layouts && s.layouts.length > 1).length;
    if (multiLayoutSlides > 0) {
      console.log(`[VISUAL]  ${multiLayoutSlides} slides with multiple layouts (high risk for overlap)`);
    }
  }

  console.log("");
  const modeStr = [contentMode && "content", visualMode && "visual"].filter(Boolean).join(", ");
  console.log(`[INFO]  Checked ${allSlides.length} slides: ${errors.length} ERROR, ${warns.length} WARN${modeStr ? ` (including ${modeStr})` : ""}`);

  // Stats report (--stats mode)
  if (statsMode) {
    const stats = collectStats(allSlides);
    const enrichChecks = printStats(stats);

    // v4.0.3 (修 4-A + 4-E): Enrichment checks degraded from ERROR to WARN
    //   - 这些字段在 schema 里都是 optional（summary / bottomText 等）
    //   - 之前当 100% 必填 → exit 1，导致 LLM 输出几乎全失败
    //   - 现在统一 WARN，不阻塞 pipeline；建议高密度 deck 仍尽量填
    //   - startY 自定义率指标已删除（多模板已内置 _bottomY 自动接力，该指标已过时）
    if (allSlides.length >= 30) {
      for (const check of enrichChecks) {
        if (check.rate < check.required) {
          console.log(`\x1b[33m[WARN]\x1b[0m  [ENRICHMENT] ${check.name} 命中率 ${Math.round(check.rate * 100)}% < 推荐 ${Math.round(check.required * 100)}%（建议但非必填，参见 docs/bring-templates.md）`);
        }
      }
      // startY 自定义率指标 v4.0.3 已删除 — 多模板已用 slide._bottomY 自动接力
    }
  }

  // ── 记录 ERROR 到自学习系统（v3.7.5 默认开启；草稿/测试可显式关闭） ─────────
  if (recordLearning && errors.length > 0) {
    const recordScript = require("path").join(__dirname, "record-learning.js");
    const { spawnSync } = require("child_process");

    // 构建 slideId → layoutTypes 映射，用于从错误中推断模板名
    const slideLayoutMap = {};
    for (const s of allSlides) {
      if (s.id && s.layouts) {
        slideLayoutMap[s.id] = s.layouts.map(l => l.type);
      }
      if (s.id && s.type && s.type !== "content") {
        slideLayoutMap[s.id] = [s.type];
      }
    }

    // 按 condition 去重，每种错误只记录一次
    const recorded = new Set();
    for (const err of errors) {
      // 尝试提取模板名：优先从消息中提取，其次从 slideId 对应的 layout 推断
      let templateName = "unknown";
      const layoutMatch  = err.msg.match(/layout\s+"([^"]+)"/i);
      const typeMatch    = err.msg.match(/for type\s+"([^"]+)"/i);
      const fieldMatch   = err.msg.match(/missing required field "[^"]+" for type "([^"]+)"/);

      if (layoutMatch)   templateName = layoutMatch[1];
      else if (fieldMatch) templateName = fieldMatch[1];
      else if (typeMatch)  templateName = typeMatch[1];
      else if (err.slideId && slideLayoutMap[err.slideId]) {
        templateName = slideLayoutMap[err.slideId][0] || "unknown";
      }

      const key = `${templateName}::${err.msg.slice(0, 80)}`;
      if (recorded.has(key)) continue;
      recorded.add(key);

      try {
        const payload = JSON.stringify({
          template:  templateName,
          errorType: "validation_error",
          condition: err.msg,
          fix:       "",
          source:    "auto_validate",   // [Fix6] 来源追踪
        });
        spawnSync(process.execPath, [recordScript, "--error", payload], { stdio: "pipe" });
      } catch (e) { /* 学习记录失败不影响主流程 */ }
    }
  }

  // ── [Fix9 / v3.7.7] 闸门 2：命中陷阱时强制中断 ──────────
  // 升级规则：
  //   - 默认：只在 --strict-learning 时强制 exit 2
  //   - v3.7.7: 若命中的 trap 在 validators/learned-rules.json（occurrences ≥ 5
  //     的"已升级硬规则"）中，无论是否 --strict-learning，都强制 exit 2。
  //     这就把"软提醒"自动升级为"硬阻断"，闭合学习系统的"读"端缺口。
  let learnedRules = [];
  try {
    const lr = require('./validators/learned-rules.json');
    learnedRules = Array.isArray(lr.rules) ? lr.rules : [];
  } catch { /* 文件不存在时跳过 */ }
  const learnedTrapIds = new Set(learnedRules.map(r => r.trapId));

  if (errors.length > 0) {
    const hitTraps = detectKnownTrapHits(errors, allSlides);
    const promotedHits = hitTraps.filter(h => learnedTrapIds.has(h.trapId));
    const trapBlock = strictLearning ? hitTraps : promotedHits;
    if (trapBlock.length > 0) {
      console.log("");
      console.log("\x1b[31m╔══════════════════════════════════════════════════════════╗\x1b[0m");
      console.log("\x1b[31m║  🚫 命中已知陷阱 — AI 未从历史错误中学习                 ║\x1b[0m");
      console.log("\x1b[31m╚══════════════════════════════════════════════════════════╝\x1b[0m");
      const promotedCount = promotedHits.length;
      const totalCount    = trapBlock.length;
      if (promotedCount > 0) {
        console.log(`\n命中"已升级硬规则"陷阱（${promotedCount} 条，重复 ≥ 5 次自动升级，强制阻断）:`);
        for (const h of promotedHits) {
          console.log(`  [${h.trapId}] ${h.template}: ${h.condition.slice(0, 80)}`);
          if (h.fix) console.log(`    已知修复: ${h.fix.slice(0, 120)}`);
        }
      }
      const softHits = trapBlock.filter(h => !learnedTrapIds.has(h.trapId));
      if (softHits.length > 0) {
        console.log(`\n命中"软陷阱"（${softHits.length} 条，--strict-learning 模式才阻断）:`);
        for (const h of softHits) {
          console.log(`  [${h.trapId}] ${h.template}: ${h.condition.slice(0, 80)}`);
          if (h.fix) console.log(`    已知修复: ${h.fix.slice(0, 120)}`);
        }
      }
      console.log(`\n请让 AI 重新生成，这次必须避开上述陷阱。`);
      console.log('运行 `npm run promote:traps -- --show-only` 可查看当前所有硬规则。');
      process.exit(2);  // exit 2 区分于普通验证失败（exit 1）
    }
  }

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
