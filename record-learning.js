#!/usr/bin/env node
/**
 * record-learning.js — BRINGPPT 自学习数据记录脚本 v4
 *
 * 修复记录（v3 → v4）:
 *   - [Fix7] 新增"重复踩坑"检测：recordError 发现已知陷阱再次触发时
 *            写入 learning/global/learning-failures.json，用于度量学习失效率
 *
 * 修复记录（v2 → v3）:
 *   - [Fix1+4] 每条错误加 status(open/resolved/invalidated) + resolution 字段
 *   - [Fix3]   --consolidate 合并同类错误，清理过期噪音
 *   - [Fix6]   source 字段追踪来源（auto_validate/auto_overflow/manual_qa/manual_entry）
 *   - [Fix2]   SmartFit 支持分模板独立校准（perTemplateAdjustments）
 *   - [Fix5]   preferences 填充机制完善
 *
 * 用法:
 *   node record-learning.js --error <json>           记录错误（必须含 source 字段）
 *   node record-learning.js --resolve <id> <json>    标记错误已解决
 *   node record-learning.js --invalidate <id> <reason> 标记错误已失效
 *   node record-learning.js --consolidate            合并同类错误，清理噪音
 *   node record-learning.js --stats <slides-data>    更新生成统计
 *   node record-learning.js --calibrate <json>       记录SmartFit校准（支持分模板）
 *   node record-learning.js --preference <json>      记录用户偏好
 *   node record-learning.js --summary                输出学习摘要
 */

const fs   = require("fs");
const path = require("path");
const store = require("./lib/learning-store");
const { paths } = store;

const LEARNING_DIR = paths.runtimeDir || paths.defaultDir;
const GLOBAL_DIR   = paths.globalDir || paths.defaultGlobalDir;
const TPLS_DIR     = paths.templatesDir || paths.defaultTemplatesDir;
const USER_DIR     = paths.userDir || paths.defaultUserDir;

[GLOBAL_DIR, TPLS_DIR, USER_DIR].forEach(d => store.ensureDir(d));

// ── I/O 工具 ──────────────────────────────────────────────────────
function loadJson(filePath, defaultVal = null) {
  return store.readJson(filePath, defaultVal);
}
function saveJson(filePath, data) {
  const wrote = store.writeJsonAtomic(filePath, data);
  if (!wrote) console.warn("[WARN] 学习系统已禁用或路径不可写，本次记录未持久化");
}
function loadJsonFallback(newPath, oldPath, defaultVal = null) {
  return store.readJsonRuntimeFirst(newPath, oldPath, defaultVal);
}
function tplErrorPath(templateName) {
  return store.templateWritePath(templateName);
}
function tplErrorReadPath(templateName) {
  const runtime = store.runtimePath("templates", `${templateName}.json`);
  const bundled = store.defaultPath("templates", `${templateName}.json`);
  return fs.existsSync(runtime || "") ? runtime : bundled;
}
function defaultTplError() {
  return { errorPatterns: [], corrections: [] };
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── [Fix7] 解法 2：重复踩坑记录 ─────────────────────────────────
// 当 recordError 发现新错误命中已知陷阱时调用，产出学习失效率数据
function recordLearningFailure({ trapId, template, condition, lastSeen }) {
  const logPath = store.globalWritePath("learning-failures.json");
  if (!logPath) return;
  const log = store.globalRead("learning-failures.json", {
    description: "重复踩坑记录：AI 再次触发已知陷阱的事件流水",
    version: 1,
    events: [],
  });

  // 计算距离上次见到这个陷阱的天数
  let gapDays = null;
  if (lastSeen) {
    const last = new Date(lastSeen);
    const now  = new Date(today());
    gapDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
  }

  log.events.push({
    trapId,
    template,
    condition: (condition || "").slice(0, 100),
    repeatedAt: today(),
    gapDays,
  });

  // 最多保留最近 500 条，避免文件无限膨胀
  if (log.events.length > 500) {
    log.events = log.events.slice(-500);
  }

  saveJson(logPath, log);
}

// ── 计算全局错误模式总数（用于 ID 生成）──────────────────────────
function countAllErrors() {
  let total = 0;
  for (const f of store.listJsonFiles(paths.templatesDir, paths.defaultTemplatesDir)) {
    const d = store.readTemplateFile(f);
    if (d && d.errorPatterns) total += d.errorPatterns.length;
  }
  return total;
}

// ── 枚举所有错误（含文件来源）──────────────────────────────────────
function allErrors() {
  const results = [];
  for (const f of store.listJsonFiles(paths.templatesDir, paths.defaultTemplatesDir)) {
    const runtime = store.runtimePath("templates", f);
    const bundled = store.defaultPath("templates", f);
    const readPath = fs.existsSync(runtime || "") ? runtime : bundled;
    const d = store.readJsonRuntimeFirst(runtime, bundled, defaultTplError());
    if (d && d.errorPatterns) {
      for (const ep of d.errorPatterns) {
        results.push({ ...ep, _file: f, _path: readPath });
      }
    }
  }
  return results;
}

// ── [Fix1+4] --error: 记录错误（含 status + source）─────────────
function recordError(jsonStr) {
  const input = JSON.parse(jsonStr);
  const templateName = input.template || "unknown";

  // source 字段警告（不强制 error，允许历史兼容）
  if (!input.source) {
    console.warn("[WARN] --error 缺少 source 字段，建议填写: auto_validate | auto_overflow | manual_qa | manual_entry");
  }

  const fpath = tplErrorPath(templateName);
  const data  = store.readJsonRuntimeFirst(fpath, store.defaultPath("templates", `${templateName}.json`), defaultTplError());

  // 去重：相同 condition（前80字）只累加 occurrences
  const condKey = (input.condition || "").slice(0, 80);
  const existing = data.errorPatterns.find(ep =>
    ep.status !== "invalidated" &&
    (ep.condition || "").slice(0, 80) === condKey
  );
  if (existing) {
    // [Fix7] 解法 2：先记录"重复踩坑"事件（在累加 occurrences 之前）
    recordLearningFailure({
      trapId:    existing.id,
      template:  templateName,
      condition: input.condition,
      lastSeen:  existing.lastSeen,
    });

    existing.occurrences = (existing.occurrences || 1) + 1;
    existing.lastSeen = today();
    if (input.fix && !existing.fix) existing.fix = input.fix;
    // 重新出现的已解决错误，重置为 open
    if (existing.status === "resolved") {
      existing.status = "open";
      existing.reopen_reason = "条件再次触发";
      existing.reopenedAt = today();
      console.warn(`[WARN] 已解决的错误 ${existing.id} 再次出现，已重置为 open`);
    }
    saveJson(fpath, data);
    console.log(`OK: 已更新错误模式 ${existing.id} (occurrences=${existing.occurrences}) → templates/${templateName}.json`);
    return;
  }

  const id = `EP-${String(countAllErrors() + 1).padStart(3, "0")}`;
  data.errorPatterns.push({
    id,
    errorType:   input.errorType   || "unknown",
    template:    templateName,
    condition:   input.condition   || "",
    fix:         input.fix         || "",
    source:      input.source      || "unknown",         // [Fix6] 来源追踪
    status:      "open",                                  // [Fix1] 状态机
    resolution:  null,                                    // [Fix4] 解决记录（初始为空）
    occurrences: 1,
    lastSeen:    today(),
  });

  // 同步降低 qaPassRate + 记录 failureModes（v3.7.9：把"为什么失败"暴露出来）
  const statsPath = store.globalWritePath("generation-stats.json");
  const stats = store.globalRead("generation-stats.json", null);
  if (stats && stats.templateUsage && stats.templateUsage[templateName]) {
    const cur = stats.templateUsage[templateName];
    cur.qaPassRate = Math.max(0.5, parseFloat(((cur.qaPassRate ?? 1.0) - 0.05).toFixed(2)));
    // 累计 failureModes by errorType，让 weekly-checkup 能讲清"为什么"
    cur.failureModes = cur.failureModes || {};
    const et = input.errorType || "unknown";
    cur.failureModes[et] = (cur.failureModes[et] || 0) + 1;
    saveJson(statsPath, stats);
  }

  saveJson(fpath, data);
  console.log(`OK: 已记录错误模式 ${id} → templates/${templateName}.json`);
}

// ── [Fix1+4] --resolve: 标记错误已解决 ───────────────────────────
function resolveError(idStr, jsonStr) {
  const input  = jsonStr ? JSON.parse(jsonStr) : {};
  const errors = allErrors();
  const target = errors.find(ep => ep.id === idStr);

  if (!target) {
    console.error(`错误: 未找到错误模式 ${idStr}`);
    process.exit(1);
  }

  const writePath = store.templateWritePath(target.template || target._file?.replace(".json", "") || "global");
  const data  = store.readJsonRuntimeFirst(writePath, target._path, defaultTplError());
  const ep    = data.errorPatterns.find(e => e.id === idStr);
  if (!ep) { console.error("内部错误：找不到目标"); process.exit(1); }

  ep.status     = "resolved";
  ep.resolution = {
    method:     input.method   || "unspecified",  // code_fix | doc_fix | validation_guard | workaround
    summary:    input.summary  || "",
    verifiedBy: input.verifiedBy || "unverified", // unverified | code_verified | test_verified | manual_tested
    resolvedAt: today(),
    resolvedBy: input.resolvedBy || "unknown",
  };

  // 同步提高 qaPassRate（修复后+0.05，最高1.0）
  if (ep.template && ep.template !== "global" && ep.template !== "unknown") {
    const statsPath = store.globalWritePath("generation-stats.json");
    const stats = store.globalRead("generation-stats.json", null);
    if (stats && stats.templateUsage && stats.templateUsage[ep.template]) {
      const current = stats.templateUsage[ep.template].qaPassRate ?? 1.0;
      stats.templateUsage[ep.template].qaPassRate = Math.min(1.0, parseFloat((current + 0.05).toFixed(2)));
      saveJson(statsPath, stats);
    }
  }

  saveJson(writePath, data);
  console.log(`OK: ${idStr} 已标记为 resolved（method: ${ep.resolution.method}）`);
}

// ── [Fix1] --invalidate: 标记错误已失效 ──────────────────────────
function invalidateError(idStr, reason) {
  const errors = allErrors();
  const target = errors.find(ep => ep.id === idStr);

  if (!target) {
    console.error(`错误: 未找到错误模式 ${idStr}`);
    process.exit(1);
  }

  const writePath = store.templateWritePath(target.template || target._file?.replace(".json", "") || "global");
  const data = store.readJsonRuntimeFirst(writePath, target._path, defaultTplError());
  const ep   = data.errorPatterns.find(e => e.id === idStr);
  ep.status          = "invalidated";
  ep.invalidatedAt   = today();
  ep.invalidatedReason = reason || "模板已迭代，此错误不再适用";

  saveJson(writePath, data);
  console.log(`OK: ${idStr} 已标记为 invalidated（${ep.invalidatedReason}）`);
}

// ── [Fix3] --consolidate: 合并同类错误，清理噪音 ─────────────────
function consolidate(opts = {}) {
  const silent = opts.silent === true;
  let merged = 0, archived = 0;
  const STALE_DAYS = 90; // 超过90天未见且已解决/失效 → 归档

  for (const f of store.listJsonFiles(paths.templatesDir, paths.defaultTemplatesDir)) {
    const fpath = store.runtimePath("templates", f) || store.defaultPath("templates", f);
    const data  = store.readJsonRuntimeFirst(store.runtimePath("templates", f), store.defaultPath("templates", f), defaultTplError());
    if (!data.errorPatterns || data.errorPatterns.length === 0) continue;

    // 1. 合并同 errorType 下 condition 高度相似的条目（前60字相同 = 同根因）
    const groups = {};
    for (const ep of data.errorPatterns.filter(e => e.status !== "invalidated")) {
      const key = `${ep.errorType}::${(ep.condition || "").slice(0, 60)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ep);
    }
    for (const [, group] of Object.entries(groups)) {
      if (group.length <= 1) continue;
      // 保留最新的、occurrences 最多的，合并其余
      group.sort((a, b) => (b.occurrences || 1) - (a.occurrences || 1));
      const primary = group[0];
      const duplicates = group.slice(1);
      for (const dup of duplicates) {
        primary.occurrences = (primary.occurrences || 1) + (dup.occurrences || 1);
        if (!primary.fix && dup.fix) primary.fix = dup.fix;
        // 标记重复条目为 invalidated
        const dupEp = data.errorPatterns.find(e => e.id === dup.id);
        if (dupEp) {
          dupEp.status = "invalidated";
          dupEp.invalidatedReason = `合并到 ${primary.id}（同根因）`;
          dupEp.invalidatedAt = today();
        }
        merged++;
      }
    }

    // 2. 归档超期的已解决/失效条目（移到 archived 数组）
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);
    if (!data.archived) data.archived = [];

    const toArchive = data.errorPatterns.filter(ep => {
      if (ep.status !== "resolved" && ep.status !== "invalidated") return false;
      const lastDate = new Date(ep.resolution?.resolvedAt || ep.invalidatedAt || ep.lastSeen || "2000-01-01");
      return lastDate < cutoff;
    });
    for (const ep of toArchive) {
      data.archived.push({ ...ep, archivedAt: today() });
      archived++;
    }
    data.errorPatterns = data.errorPatterns.filter(ep => !toArchive.includes(ep));

    saveJson(fpath, data);
  }

  if (!silent) {
    console.log(`OK: 合并同类错误 ${merged} 条，归档超期条目 ${archived} 条`);
    console.log(`提示：已失效条目保留在文件中（status=invalidated），超过90天后下次 consolidate 自动归档`);
  }
  return { merged, archived };
}

// ── [Fix5] --stats: 更新生成统计（含用户偏好推断）───────────────
function loadSlidesData(slidesDataPath) {
  const resolved = path.resolve(slidesDataPath);
  if (resolved.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(resolved, "utf-8"));
  }
  return require(resolved);
}

function recordStats(slidesDataPath) {
  const slidesData = loadSlidesData(slidesDataPath);
  const slides     = slidesData.slides || [];

  const statsPath = store.globalWritePath("generation-stats.json");
  const data = loadJsonFallback(
    statsPath,
    store.defaultPath("global", "generation-stats.json"),
    { totalGenerations: 0, templateUsage: {}, averageContentDensity: { layoutsPerSlide: 0 }, version: 1 }
  );

  data.totalGenerations++;
  let totalLayouts = 0, contentSlides = 0;

  for (const slide of slides) {
    if (slide.layouts) {
      contentSlides++;
      totalLayouts += slide.layouts.length;
      for (const layout of slide.layouts) {
        const t = layout.type;
        if (!data.templateUsage[t]) data.templateUsage[t] = { count: 0, qaPassRate: 1.0 };
        data.templateUsage[t].count++;
      }
    }
  }

  if (contentSlides > 0) {
    data.averageContentDensity.layoutsPerSlide = +(totalLayouts / contentSlides).toFixed(1);
  }

  // [Fix5] 自动推断用户偏好：使用频次 >= 10 且 qaPassRate >= 0.95 → 加入偏好列表
  const prefPath = store.userWritePath("preferences.json");
  const prefs = store.userRead("preferences.json", { preferredTemplates: [], avoidedTemplates: [], layoutDensity: "medium", corrections: [], stylePreferences: {}, version: 1 });
  for (const [name, info] of Object.entries(data.templateUsage)) {
    if (info.count >= 10 && info.qaPassRate >= 0.95 && !prefs.preferredTemplates.includes(name)) {
      prefs.preferredTemplates.push(name);
      console.log(`[自动偏好] ${name} 使用${info.count}次且QA通过率${(info.qaPassRate*100).toFixed(0)}% → 加入偏好模板`);
    }
    // 低QA模板 → 加入回避列表
    if (info.qaPassRate < 0.75 && info.count >= 5 && !prefs.avoidedTemplates.includes(name)) {
      prefs.avoidedTemplates.push(name);
      console.log(`[自动回避] ${name} QA通过率仅${(info.qaPassRate*100).toFixed(0)}% → 加入回避模板`);
    }
  }
  saveJson(prefPath, store.sanitizeUserPreferences(prefs));

  saveJson(statsPath, data);
  console.log(`OK: 已更新生成统计（第${data.totalGenerations}次生成，${slides.length}页）→ global/generation-stats.json`);
}

// ── [Fix2] --calibrate: SmartFit 分模板校准 ──────────────────────
function recordCalibration(jsonStr) {
  const input  = JSON.parse(jsonStr);
  const calPath = store.globalWritePath("smartfit-calibration.json");
  const data = loadJsonFallback(
    calPath,
    store.defaultPath("global", "smartfit-calibration.json"),
    {
      charWidthMultipliers: { cjk: 1.0, ascii_letter: 0.55, ascii_punct: 0.35 },
      perTemplateAdjustments: {},   // [Fix2] 分模板校准
      overflowIncidents: [],
      calibrationVersion: 1,
      description: "SmartFit校准数据，从溢出事件中微调字符宽度乘数",
    }
  );
  if (!data.perTemplateAdjustments) data.perTemplateAdjustments = {};

  data.overflowIncidents.push({
    template:        input.template        || "unknown",
    text:            input.text            || "",
    boxW:            input.boxW            || 0,
    boxH:            input.boxH            || 0,
    calculatedFontSize: input.calculatedFontSize || 0,
    actualOverflow:  true,
    adjustedFontSize: input.adjustedFontSize || 0,
    actualBottomY:   input.actualBottomY   || 0,
    overflowInches:  input.overflowInches  || 0,
    source:          input.source          || "auto_overflow",
    date:            today(),
  });

  // [Fix2] 分模板校准：记录模板级别的溢出量，独立计算该模板的底部余量建议
  const tpl = input.template;
  if (tpl && tpl !== "unknown") {
    if (!data.perTemplateAdjustments[tpl]) {
      data.perTemplateAdjustments[tpl] = { overflowCount: 0, avgOverflowInches: 0, recommendedBottomMargin: 0 };
    }
    const adj = data.perTemplateAdjustments[tpl];
    adj.overflowCount++;
    adj.avgOverflowInches = parseFloat(
      ((adj.avgOverflowInches * (adj.overflowCount - 1) + (input.overflowInches || 0)) / adj.overflowCount).toFixed(3)
    );
    // 建议底部留白 = 平均溢出量 + 0.1" 安全余量
    adj.recommendedBottomMargin = parseFloat((adj.avgOverflowInches + 0.1).toFixed(3));
  }

  // 全局校准：仅在 5 条以上的无模板信息溢出时才调整全局乘数
  const unknownOverflows = data.overflowIncidents.filter(o => !o.template || o.template === "unknown");
  if (unknownOverflows.length >= 5 && unknownOverflows.length % 5 === 0) {
    data.charWidthMultipliers.cjk          = Math.min(1.15, data.charWidthMultipliers.cjk + 0.02);
    data.charWidthMultipliers.ascii_letter = Math.min(0.65, data.charWidthMultipliers.ascii_letter + 0.01);
    data.calibrationVersion++;
    console.log(`自动校准全局乘数: CJK=${data.charWidthMultipliers.cjk}, ASCII=${data.charWidthMultipliers.ascii_letter}`);
  }

  saveJson(calPath, data);
  console.log(`OK: 已记录SmartFit校准（共${data.overflowIncidents.length}条，模板:${tpl || "unknown"}）`);
}

// ── --preference: 记录用户偏好 ───────────────────────────────────
function recordPreference(jsonStr) {
  const input   = JSON.parse(jsonStr);
  const prefPath = store.userWritePath("preferences.json");
  const data = loadJsonFallback(
    prefPath,
    store.defaultPath("user", "preferences.json"),
    { preferredTemplates: [], avoidedTemplates: [], layoutDensity: "medium", corrections: [], stylePreferences: {}, version: 1 }
  );

  if (input.correction) {
    const c = input.correction;
    data.corrections.push({
      date:        today(),
      original:    c.original    || "",
      correctedTo: c.correctedTo || "",
      reason:      c.reason      || "",
    });
    if (c.correctedTo && !data.preferredTemplates.includes(c.correctedTo)) data.preferredTemplates.push(c.correctedTo);
    if (c.original   && !data.avoidedTemplates.includes(c.original))   data.avoidedTemplates.push(c.original);
    if (c.original) {
      const statsPath = store.globalWritePath("generation-stats.json");
      const stats = store.globalRead("generation-stats.json", null);
      if (stats && stats.templateUsage && stats.templateUsage[c.original]) {
        const current = stats.templateUsage[c.original].qaPassRate ?? 1.0;
        stats.templateUsage[c.original].qaPassRate = Math.max(0.5, parseFloat((current - 0.1).toFixed(2)));
        saveJson(statsPath, stats);
      }
    }
  }
  if (input.preferred) { for (const t of input.preferred) { if (!data.preferredTemplates.includes(t)) data.preferredTemplates.push(t); } }
  if (input.avoided)   { for (const t of input.avoided)   { if (!data.avoidedTemplates.includes(t))   data.avoidedTemplates.push(t); } }
  if (input.style) Object.assign(data.stylePreferences, input.style);

  saveJson(prefPath, store.sanitizeUserPreferences(data));
  console.log("OK: 已更新用户偏好 → user/preferences.json");
}

// ── --summary: 输出学习摘要（含状态分布）────────────────────────
function printSummary(opts = {}) {
  const { all = false, query = null } = opts;

  const stats = loadJsonFallback(
    store.runtimePath("global", "generation-stats.json"),
    store.defaultPath("global", "generation-stats.json"),
    { totalGenerations: 0, templateUsage: {}, averageContentDensity: { layoutsPerSlide: 0 } }
  );
  const calib = loadJsonFallback(
    store.runtimePath("global", "smartfit-calibration.json"),
    store.defaultPath("global", "smartfit-calibration.json"),
    { calibrationVersion: 1, charWidthMultipliers: { cjk: 1.0, ascii_letter: 0.55 }, overflowIncidents: [] }
  );
  const prefs = loadJsonFallback(
    store.runtimePath("user", "preferences.json"),
    store.defaultPath("user", "preferences.json"),
    { preferredTemplates: [], avoidedTemplates: [], corrections: [] }
  );

  const errors = allErrors();
  const byStatus = { open: 0, resolved: 0, invalidated: 0, unknown: 0 };
  for (const ep of errors) { byStatus[ep.status || "unknown"] = (byStatus[ep.status || "unknown"] || 0) + 1; }

  console.log("=== BRINGPPT 学习摘要（v3 分层结构）===\n");
  console.log(`生成次数: ${stats.totalGenerations}`);
  console.log(`平均每页版式数: ${stats.averageContentDensity.layoutsPerSlide}\n`);

  console.log("模板使用Top5:");
  const sorted = Object.entries(stats.templateUsage).sort((a, b) => b[1].count - a[1].count);
  for (const [name, info] of sorted.slice(0, 5)) {
    console.log(`  ${name}: ${info.count}次 (QA通过率 ${(info.qaPassRate * 100).toFixed(0)}%)`);
  }

  console.log(`\n错误模式: ${errors.length}条（${fs.existsSync(TPLS_DIR) ? fs.readdirSync(TPLS_DIR).filter(f=>f.endsWith('.json')).length : 0} 个文件）`);
  console.log(`  状态分布: open=${byStatus.open} resolved=${byStatus.resolved} invalidated=${byStatus.invalidated}`);

  // 三种显示模式：
  //   query = "EP-xxx" → 精确查询，显示该 EP 的全部状态字段
  //   --recent         → 仅显示最近 5 条 open 错误（紧凑视图）
  //   默认             → 显示全部 open 错误（团队历史经验可查）
  const openErrors = errors.filter(e => (e.status || "open") === "open");
  let list;
  if (query) {
    const found = errors.filter(e => e.id === query || (e.id && e.id.toUpperCase() === query.toUpperCase()));
    if (found.length === 0) {
      console.log(`  （查询 ${query} 无匹配）`);
    } else {
      for (const ep of found) {
        console.log(`  [${ep.id}] [${ep.status || 'open'}] ${ep.errorType} @ ${ep._file}`);
        console.log(`    condition: ${(ep.condition||"").slice(0, 200)}`);
        if (ep.fix) console.log(`    fix: ${ep.fix.slice(0, 200)}`);
        if (ep.source) console.log(`    source: ${ep.source}`);
        if (ep.lastSeen) console.log(`    lastSeen: ${ep.lastSeen}`);
      }
    }
    list = [];
  } else if (opts.recent) {
    list = openErrors.slice(-5);
  } else {
    // 默认：全部 open（保留 --all 兼容入口）
    list = openErrors;
  }
  for (const ep of list) {
    const src = ep.source ? `[${ep.source}]` : "";
    console.log(`  [${ep.id}] ${src} ${ep.errorType} @ ${ep._file}: ${(ep.condition||"").slice(0, 55)}`);
  }

  console.log(`\nSmartFit校准: v${calib.calibrationVersion}`);
  console.log(`  CJK乘数: ${calib.charWidthMultipliers.cjk}`);
  console.log(`  ASCII乘数: ${calib.charWidthMultipliers.ascii_letter}`);
  console.log(`  溢出记录: ${calib.overflowIncidents.length}条`);
  const perAdj = calib.perTemplateAdjustments || {};
  if (Object.keys(perAdj).length > 0) {
    console.log(`  分模板校准:`);
    for (const [tpl, adj] of Object.entries(perAdj)) {
      console.log(`    ${tpl}: 溢出${adj.overflowCount}次, 建议底部留白 ${adj.recommendedBottomMargin}"`);
    }
  }

  console.log(`\n用户偏好:`);
  console.log(`  偏好模板: ${prefs.preferredTemplates.join(", ") || "（暂无）"}`);
  console.log(`  回避模板: ${prefs.avoidedTemplates.join(", ") || "（暂无）"}`);
  console.log(`  修正记录: ${prefs.corrections.length}条`);
}

// ── 库调用导出（weekly-checkup 等脚本可 require 使用）──────────
module.exports = { consolidate };

// ── 主入口 ────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const cmd   = args[0];

// 仅在作为 CLI 脚本直接运行时才执行 switch；被 require 时不触发
if (require.main === module) {
switch (cmd) {
  case "--error":       recordError(args[1]);                 break;
  case "--resolve":     resolveError(args[1], args[2]);        break;
  case "--invalidate":  invalidateError(args[1], args[2]);     break;
  case "--consolidate": consolidate();                          break;
  case "--stats":       recordStats(args[1]);                  break;
  case "--calibrate":   recordCalibration(args[1]);             break;
  case "--preference":  recordPreference(args[1]);              break;
  case "--summary": {
    // 默认显示全部 open 错误；--recent 仅显示最近 5 条；EP-xxx 精确查询
    const recent = args.includes("--recent");
    const query = args.slice(1).find(a => /^EP-/i.test(a)) || null;
    printSummary({ recent, query });
    break;
  }
  default:
    console.log("用法:");
    console.log("  node record-learning.js --error '<json>'              ← 记录错误（含source字段）");
    console.log("  node record-learning.js --resolve <EP-id> '<json>'   ← 标记已解决");
    console.log("  node record-learning.js --invalidate <EP-id> <reason> ← 标记已失效");
    console.log("  node record-learning.js --consolidate                 ← 合并同类/清理噪音");
    console.log("  node record-learning.js --stats <slides-data.js>     ← 更新生成统计");
    console.log("  node record-learning.js --calibrate '<json>'          ← SmartFit分模板校准");
    console.log("  node record-learning.js --preference '<json>'         ← 记录用户偏好");
    console.log("  node record-learning.js --summary");
}
}
