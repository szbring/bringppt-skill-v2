'use strict';
/**
 * validators/traps.js — 已知陷阱命中检测（v3.7.7 抽取）
 *
 * 给定一组 validate 出来的 errors 和 slides，
 * 在 learning/templates/*.json 中找命中的已知 trap。
 * 没有共享状态，纯函数。
 *
 * 调用方：validate-slides.js（默认/strict 模式）、weekly-checkup（统计）。
 */

// ===== [Fix9] 闸门 2：已知陷阱命中检测 =====
// 给定本次 errors 和 slides，返回命中了 learning/templates/*.json 里 open 陷阱的条目
function detectKnownTrapHits(errors, allSlides) {
  const fs = require("fs");
  const path = require("path");
  const store = require("../lib/learning-store");

  // 1. 加载所有 open 状态的陷阱，按模板分组
  const activeTraps = {};  // { templateName: [{id, condition, fix}, ...] }

  for (const f of store.listJsonFiles(store.paths.templatesDir, store.paths.defaultTemplatesDir)) {
    if (f.startsWith("test-")) continue;
    let data;
    try { data = store.readTemplateFile(f); }
    catch { continue; }
    if (!data || !data.errorPatterns) continue;

    const tplName = f.replace(".json", "");
    const opens = data.errorPatterns.filter(ep => (ep.status || "open") === "open");
    if (opens.length > 0) activeTraps[tplName] = opens;
  }

  // 2. 构建 slideId → template 映射（复用 main 里同样的推断逻辑）
  const slideLayoutMap = {};
  for (const s of allSlides) {
    if (s.id && s.layouts) slideLayoutMap[s.id] = s.layouts.map(l => l.type);
    if (s.id && s.type && s.type !== "content") slideLayoutMap[s.id] = [s.type];
  }

  // 3. 归一化函数——去掉数字/空白差异，只看语义骨架
  //    "length 78 exceeds error limit 40" → "length N exceeds error limit N"
  const normalize = s => (s || "")
    .replace(/\d+(\.\d+)?/g, "N")        // 所有数字归一
    .replace(/\s+/g, " ")                 // 连续空白变单空格
    .trim()
    .slice(0, 80)                         // 取前 80 字符做骨架
    .toLowerCase();

  // 4. 对每条 error，尝试推断模板并在该模板的 active traps 里找匹配
  const hits = [];
  const seen = new Set();  // 去重：同一 trapId 只报一次

  for (const err of errors) {
    // 推断模板名（和 main 里逻辑一致）
    let templateName = "unknown";
    const layoutMatch = err.msg.match(/layout\s+"([^"]+)"/i);
    const typeMatch   = err.msg.match(/for type\s+"([^"]+)"/i);
    const fieldMatch  = err.msg.match(/missing required field "[^"]+" for type "([^"]+)"/);
    const forTplMatch = err.msg.match(/for\s+(\w+)\s*$/i);  // "...for iconList"

    if (layoutMatch)         templateName = layoutMatch[1];
    else if (fieldMatch)     templateName = fieldMatch[1];
    else if (typeMatch)      templateName = typeMatch[1];
    else if (forTplMatch)    templateName = forTplMatch[1];
    else if (err.slideId && slideLayoutMap[err.slideId]) {
      templateName = slideLayoutMap[err.slideId][0] || "unknown";
    }

    const traps = activeTraps[templateName];
    if (!traps) continue;

    const errSig = normalize(err.msg);
    for (const trap of traps) {
      if (seen.has(trap.id)) continue;
      const trapSig = normalize(trap.condition);
      // 命中条件：归一化后前 60 字符相同（容忍数字差异）
      if (errSig.slice(0, 60) === trapSig.slice(0, 60) && errSig.length > 20) {
        hits.push({
          trapId:    trap.id,
          template:  templateName,
          condition: trap.condition,
          fix:       trap.fix || "",
          triggeringError: err.msg,
        });
        seen.add(trap.id);
      }
    }
  }

  return hits;
}

module.exports = { detectKnownTrapHits };
