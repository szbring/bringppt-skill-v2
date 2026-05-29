#!/usr/bin/env node
'use strict';
/**
 * scripts/promote-traps.js — 把"反复踩坑"的陷阱升级为 schema 级硬规则
 *
 * 设计：
 *   - 软提醒（gen_ppt_template.js 顶部 console.log）：所有 open 状态 trap
 *   - 硬规则（本脚本产出）：occurrences ≥ THRESHOLD 的 trap → 写入
 *     validators/learned-rules.json；validate-slides.js 启动时加载，命中
 *     即按 ERROR 处理（且不需要 --strict-learning 标志）。
 *
 * 用法：
 *   npm run promote:traps             # 默认阈值 5；改写 validators/learned-rules.json
 *   node scripts/promote-traps.js --threshold 10 --dry-run
 *   node scripts/promote-traps.js --show-only
 *
 * 输出文件结构：
 *   validators/learned-rules.json
 *   {
 *     "generatedAt": "2026-05-13T...",
 *     "threshold": 5,
 *     "rules": [
 *       {
 *         "trapId": "EP-145",
 *         "template": "comparison",
 *         "condition": "layout \"comparison\" left.bullets → should be left.items",
 *         "fix": "...",
 *         "occurrences": 14,
 *         "lastSeen": "2026-05-10"
 *       }, ...
 *     ]
 *   }
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const store     = require(path.join(SKILL_DIR, 'lib', 'learning-store'));

const args = process.argv.slice(2);
function arg(flag, defVal) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : defVal;
}
const THRESHOLD = parseInt(arg('--threshold', '5'), 10);
const DRY       = args.includes('--dry-run');
const SHOW_ONLY = args.includes('--show-only');
const OUT_PATH  = path.join(SKILL_DIR, 'validators', 'learned-rules.json');

// v3.7.9：读取既有 promotedIds，确保已升级的 trap 即使被标 resolved/validation_guard
// 也持续保留为硬规则。修了"升级后 promote 衰减"的 bug。
let prevPromoted = new Set();
let prevRulesByTrapId = {};
try {
  const prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'));
  for (const id of (prev.promotedIds || prev.rules?.map(r => r.trapId) || [])) prevPromoted.add(id);
  for (const r of (prev.rules || [])) prevRulesByTrapId[r.trapId] = r;
} catch { /* 首次跑或文件损坏 */ }

// 收集所有满足阈值的 open trap + 既有 promoted trap（不管 status）
const rules = [];
const seenTrapIds = new Set();
let newlyPromoted = 0, carriedOver = 0;

const tplFiles = store.listJsonFiles(store.paths.templatesDir, store.paths.defaultTemplatesDir);
for (const f of tplFiles) {
  if (f.startsWith('test-')) continue;
  let data;
  try { data = store.readTemplateFile(f); } catch { continue; }
  if (!data || !Array.isArray(data.errorPatterns)) continue;

  const tplName = f.replace('.json', '');
  for (const ep of data.errorPatterns) {
    if (seenTrapIds.has(ep.id)) continue;

    const status = ep.status || 'open';
    const n      = ep.occurrences || 0;
    const isReachingThreshold = (status === 'open' && n >= THRESHOLD);
    const wasPreviouslyPromoted = prevPromoted.has(ep.id);

    if (!isReachingThreshold && !wasPreviouslyPromoted) continue;
    seenTrapIds.add(ep.id);

    if (wasPreviouslyPromoted && !isReachingThreshold) carriedOver++;
    else newlyPromoted++;

    rules.push({
      trapId:      ep.id,
      template:    ep.template || tplName,
      errorType:   ep.errorType || 'unknown',
      condition:   ep.condition || '',
      fix:         ep.fix || '',
      occurrences: n,
      lastSeen:    ep.lastSeen || null,
      source:      ep.source || 'unknown',
      carriedOver: wasPreviouslyPromoted && !isReachingThreshold,  // 兼容 resolved 后继续作为硬规则
    });
  }
}

// 即使原 trap 文件被删，也保留既有 promoted 规则（不让硬规则消失）
for (const trapId of prevPromoted) {
  if (seenTrapIds.has(trapId)) continue;
  if (!prevRulesByTrapId[trapId]) continue;
  seenTrapIds.add(trapId);
  carriedOver++;
  rules.push({ ...prevRulesByTrapId[trapId], carriedOver: true, _source: 'prev-snapshot' });
}

rules.sort((a, b) => b.occurrences - a.occurrences);

console.log(`\n=== Trap → 硬规则升级（阈值 ${THRESHOLD}）===\n`);
console.log(`扫描模板学习文件: ${tplFiles.length}`);
console.log(`既有 promoted（保留为硬规则）: ${carriedOver}`);
console.log(`本次新升级（≥${THRESHOLD} 次）:    ${newlyPromoted}`);
console.log(`硬规则总数:                  ${rules.length}\n`);

if (rules.length === 0) {
  console.log('（无 trap 达到阈值，跳过写入）');
  process.exit(0);
}

console.log('Top 升级清单：');
rules.slice(0, 15).forEach(r => {
  const cond = (r.condition || '').slice(0, 70);
  console.log(`  [${r.trapId}] ${r.template} x${r.occurrences}  ${cond}`);
});
if (rules.length > 15) console.log(`  ... 及其余 ${rules.length - 15} 条`);

if (SHOW_ONLY) {
  console.log('\n--show-only 模式，未写入。');
  process.exit(0);
}

const payload = {
  generatedAt: new Date().toISOString(),
  threshold:   THRESHOLD,
  count:       rules.length,
  promotedIds: rules.map(r => r.trapId),  // v3.7.9：独立 ID 集合，下次跑保留这些规则即便上游标 resolved
  rules,
};

if (DRY) {
  console.log('\n--dry-run，未写入。预览：');
  console.log(JSON.stringify(payload, null, 2).slice(0, 800));
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
console.log(`\n✅ 已写入 ${path.relative(SKILL_DIR, OUT_PATH)}`);
console.log('   下一次 validate-slides 运行时，命中这些 trap 的错误将被强制升级为 ERROR（无需 --strict-learning）。');
