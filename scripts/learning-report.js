#!/usr/bin/env node
'use strict';
/**
 * scripts/learning-report.js — 学习系统周报（v3.7.5）
 *
 * 把 learning/global 下散乱的统计 JSON 整合成一份可读 markdown 报告：
 *   - Top 10 高频模板（用得多 → 该重点保养）
 *   - Top 10 低 QA 通过率模板（用得多但成功率低 → 该优化）
 *   - Top 10 顽固陷阱（重复踩 → 模板需要修）
 *   - 最近 SmartFit 校准（哪些模板字号自动调整频繁）
 *   - 每周生成总量趋势
 *
 * 用法：
 *   npm run learning:report                # 打印到 stdout
 *   npm run learning:report -- --out FILE  # 写到文件
 *   npm run learning:report -- --json      # JSON 输出（供 CI 消费）
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const store = require(path.join(SKILL_DIR, 'lib', 'learning-store'));

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const triageMode = args.includes('--triage');
const outIdx = args.indexOf('--out');
const outFile = outIdx > -1 ? args[outIdx + 1] : null;

// ── --triage 模式：按 occurrences 分桶（1 / 2-4 / ≥5）+ 建议 action ──
if (triageMode) {
  const buckets = { '1': [], '2-4': [], '>=5': [] };
  const promotedIds = (() => {
    try { return new Set(require('../validators/learned-rules.json').promotedIds || []); }
    catch { return new Set(); }
  })();
  for (const f of store.listTemplateJsonFiles()) {
    if (f.startsWith('test-')) continue;
    const data = store.loadLayeredTemplate(f, { errorPatterns: [] });
    const tpl = f.replace('.json', '');
    for (const ep of (data.errorPatterns || [])) {
      const status = ep.status || 'open';
      const isPromoted = promotedIds.has(ep.id);
      // 跳过非 open 且未 promoted 的 trap；promoted 不管 status 都展示
      if (status !== 'open' && !isPromoted) continue;
      const n = ep.occurrences || 1;
      const bucket = n === 1 ? '1' : (n < 5 ? '2-4' : '>=5');
      buckets[bucket].push({ id: ep.id, tpl, n, cond: (ep.condition || '').slice(0, 80), promoted: isPromoted, status });
    }
  }
  console.log(`\n=== TRAP TRIAGE （open 状态 trap 按 occurrences 分桶）===\n`);
  for (const [label, list] of Object.entries(buckets)) {
    const sorted = list.sort((a, b) => b.n - a.n).slice(0, 10);
    const action =
      label === '1'    ? '建议：等待积累更多数据，或人工 review 是否标 resolved' :
      label === '2-4'  ? '建议：监控；3次以上可考虑写 negative test + schema 加严' :
                         '建议：promote-traps 已升级为硬规则（如有未升级，检查阈值或 promoted 集合）';
    console.log(`【occurrences=${label}】共 ${list.length} 条 · ${action}`);
    sorted.forEach(t => {
      const mark = t.promoted ? '🛡' : '  ';
      console.log(`  ${mark} ${t.id.padEnd(8)} ${t.tpl.padEnd(20)} x${t.n}  ${t.cond}`);
    });
    if (list.length > 10) console.log(`     ... 及其余 ${list.length - 10} 条`);
    console.log('');
  }
  console.log('🛡 = 已在 validators/learned-rules.json 中（硬规则）');
  process.exit(0);
}

const stats   = store.globalRead('generation-stats.json', { totalGenerations: 0, templateUsage: {} });
const fails   = store.globalRead('learning-failures.json', { repeats: [], events: [] });
const fit     = store.globalRead('smartfit-calibration.json', { perTemplate: {} });

const openTrapIds = new Set();
for (const f of store.listTemplateJsonFiles()) {
  if (f.startsWith('test-')) continue;
  const data = store.loadLayeredTemplate(f, { errorPatterns: [] });
  for (const ep of data.errorPatterns || []) {
    if ((ep.status || 'open') === 'open') openTrapIds.add(ep.id);
  }
}

// ── Top usage ─────────────────────────────────────────────
const usage = Object.entries(stats.templateUsage || {})
  .map(([name, v]) => ({ name, count: v.count || 0, qa: v.qaPassRate ?? null }))
  .sort((a, b) => b.count - a.count);

const topUsed = usage.slice(0, 10);
const lowQA   = usage
  .filter(t => t.qa !== null && t.count >= 10 && t.qa < 0.7)
  .sort((a, b) => a.qa - b.qa)
  .slice(0, 10);

// ── Top stubborn traps ────────────────────────────────────
const rawTraps = Array.isArray(fails.repeats) ? fails.repeats : (Array.isArray(fails.events) ? fails.events : []);
const traps = rawTraps.filter(r => openTrapIds.has(r.trapId || r.id || 'unknown'));
const trapCount = {};
traps.forEach(r => { trapCount[r.trapId || r.id || 'unknown'] = (trapCount[r.trapId || r.id || 'unknown'] || 0) + 1; });
const topTraps = Object.entries(trapCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([id, count]) => ({ id, count }));

const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  totalGenerations: stats.totalGenerations || 0,
  topUsed,
  lowQA,
  topTraps,
  totalRepeatTraps: traps.length,
  smartFitCalibratedTemplates: Object.keys(fit.perTemplate || {}).length,
};

if (jsonOut) {
  const out = JSON.stringify(report, null, 2);
  if (outFile) fs.writeFileSync(outFile, out, 'utf-8');
  else console.log(out);
  process.exit(0);
}

// ── Markdown render ──────────────────────────────────────
const lines = [];
lines.push(`# BRINGPPT 学习系统周报 · ${report.generatedAt}`);
lines.push('');
lines.push(`**总生成次数**：${report.totalGenerations}`);
lines.push(`**累计重复陷阱**：${report.totalRepeatTraps}`);
lines.push(`**SmartFit 已校准模板**：${report.smartFitCalibratedTemplates}`);
lines.push('');
lines.push('## Top 10 高频模板（重点保养）');
lines.push('');
lines.push('| # | 模板 | 使用次数 | QA 通过率 |');
lines.push('|---|---|---:|---:|');
report.topUsed.forEach((t, i) => {
  const qa = t.qa === null ? '—' : (t.qa * 100).toFixed(0) + '%';
  lines.push(`| ${i + 1} | \`${t.name}\` | ${t.count} | ${qa} |`);
});
lines.push('');

if (report.lowQA.length > 0) {
  lines.push('## ⚠️ 低 QA 通过率模板（高频但 < 70%，建议优化）');
  lines.push('');
  lines.push('| # | 模板 | 使用次数 | QA 通过率 |');
  lines.push('|---|---|---:|---:|');
  report.lowQA.forEach((t, i) => {
    lines.push(`| ${i + 1} | \`${t.name}\` | ${t.count} | ${(t.qa * 100).toFixed(0)}% |`);
  });
  lines.push('');
}

if (report.topTraps.length > 0) {
  lines.push('## 🔁 Top 10 顽固陷阱（重复触发）');
  lines.push('');
  lines.push('| # | 陷阱 ID | 重复次数 |');
  lines.push('|---|---|---:|');
  report.topTraps.forEach((t, i) => {
    lines.push(`| ${i + 1} | ${t.id} | ${t.count} |`);
  });
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('*由 `npm run learning:report` 自动生成 · 数据源 runtime-first learning-store*');

const md = lines.join('\n');
if (outFile) {
  fs.writeFileSync(outFile, md, 'utf-8');
  console.log(`✅ 报告已写入: ${outFile}`);
} else {
  console.log(md);
}
