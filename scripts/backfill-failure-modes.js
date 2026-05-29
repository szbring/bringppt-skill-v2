#!/usr/bin/env node
'use strict';
/**
 * scripts/backfill-failure-modes.js — 把历史 trap 的 errorType 累计回 generation-stats.failureModes
 *
 * 背景：v3.7.9 起 recordError 会更新 templateUsage[X].failureModes[errorType] = count，
 * 但历史已经记录的 trap 没回填，导致 weekly-checkup 看不到"为什么不通过"的细节。
 *
 * 一次性回填：扫 learning/templates/*.json 中所有 status=open 的 trap，按
 * template + errorType 累计，写回 generation-stats.json。
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const store     = require(path.join(SKILL_DIR, 'lib', 'learning-store'));

const tplFiles = store.listJsonFiles(store.paths.templatesDir, store.paths.defaultTemplatesDir);
const byTpl = {};

for (const f of tplFiles) {
  if (f.startsWith('test-')) continue;
  let d;
  try { d = store.readTemplateFile(f); } catch { continue; }
  if (!d || !Array.isArray(d.errorPatterns)) continue;
  const tpl = f.replace('.json', '');
  for (const ep of d.errorPatterns) {
    if ((ep.status || 'open') !== 'open') continue;
    const et = ep.errorType || 'unknown';
    byTpl[tpl] = byTpl[tpl] || {};
    byTpl[tpl][et] = (byTpl[tpl][et] || 0) + (ep.occurrences || 1);
  }
}

const stats = store.globalRead('generation-stats.json', { templateUsage: {} });
let updated = 0;
for (const [tpl, modes] of Object.entries(byTpl)) {
  if (!stats.templateUsage[tpl]) {
    stats.templateUsage[tpl] = { count: 0, qaPassRate: 1.0 };
  }
  stats.templateUsage[tpl].failureModes = modes;
  updated++;
}

const out = store.globalWritePath('generation-stats.json');
fs.writeFileSync(out, JSON.stringify(stats, null, 2) + '\n', 'utf-8');

console.log(`回填完成：${updated} 个模板的 failureModes 已写入 ${out}\n`);

const interesting = Object.entries(byTpl)
  .map(([tpl, modes]) => ({ tpl, total: Object.values(modes).reduce((a, b) => a + b, 0), modes }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 8);

console.log('Top 8（按 trap 累计次数）:');
for (const r of interesting) {
  const top = Object.entries(r.modes).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => `${k}×${v}`).join(', ');
  console.log(`  ${r.tpl.padEnd(20)} total=${r.total}  | ${top}`);
}
