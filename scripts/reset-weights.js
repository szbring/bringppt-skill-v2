#!/usr/bin/env node
'use strict';
/**
 * scripts/reset-weights.js — 把所有运行态学习权重清零（保留 packaged 默认知识库）
 *
 * 清零的：
 *   - generation-stats.json     templateUsage 全部 count=0 / qaPassRate=1.0 / failureModes={}
 *   - preferences.json          preferred/avoided/corrections 全清
 *   - learning-failures.json    events=[] repeats=[]
 *   - context-access-log.json   accesses=[]
 *   - smartfit-calibration.json overflowIncidents=[]（保留 charWidthMultipliers 学得的乘数）
 *   - validators/learned-rules.json  rules=[] promotedIds=[]
 *
 * 不清的：
 *   - learning/templates/*.json  这些是 packaged 知识库（trap definitions），不是"权重"
 *   - 运行态 ~/.bringppt/learning/templates/  如有，按需手工清
 *
 * 用法：
 *   node scripts/reset-weights.js --dry-run   # 只列出会清什么，不动
 *   node scripts/reset-weights.js             # 实际清零（会先备份到 _trash/learning-snapshot-TS/）
 *   node scripts/reset-weights.js --no-backup # 不备份（不推荐）
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const store     = require(path.join(SKILL_DIR, 'lib', 'learning-store'));

const args = process.argv.slice(2);
const DRY  = args.includes('--dry-run');
const NO_BACKUP = args.includes('--no-backup');

const runtime = store.paths;

function readJson(fp, def) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch { return def; }
}

function writeJson(fp, obj) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

// ── 0. 备份 ──
function backup() {
  if (NO_BACKUP) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkDir = path.join(SKILL_DIR, '_trash', `learning-snapshot-${ts}`);
  fs.mkdirSync(bkDir, { recursive: true });

  const sources = [
    path.join(runtime.globalDir,   'generation-stats.json'),
    path.join(runtime.globalDir,   'context-access-log.json'),
    path.join(runtime.globalDir,   'learning-failures.json'),
    path.join(runtime.globalDir,   'smartfit-calibration.json'),
    path.join(runtime.userDir,     'preferences.json'),
    path.join(SKILL_DIR, 'validators', 'learned-rules.json'),
  ];
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    const rel = path.relative(SKILL_DIR, src).replace(/[\/\\]/g, '__');
    const dst = path.join(bkDir, rel);
    if (DRY) continue;
    try { fs.copyFileSync(src, dst); } catch (e) {
      // 沙箱 cp 可能失败，改用 read+write
      try { fs.writeFileSync(dst, fs.readFileSync(src)); } catch {}
    }
  }
  return bkDir;
}

const bkDir = backup();
if (bkDir) console.log(`📦 备份目录: ${bkDir}${DRY ? ' (--dry-run，未实际备份)' : ''}\n`);

const summary = [];

// ── 1. generation-stats: 清零 templateUsage 的 count / qaPassRate / failureModes ──
{
  const fp = path.join(runtime.globalDir, 'generation-stats.json');
  const cur = readJson(fp, null);
  if (cur) {
    const before = Object.keys(cur.templateUsage || {}).length;
    const reset = {
      ...cur,
      totalGenerations: 0,
      templateUsage: {},
      averageContentDensity: { layoutsPerSlide: 0 },
    };
    if (!DRY) writeJson(fp, reset);
    summary.push(`generation-stats.json: templateUsage 清空（之前 ${before} 个模板）`);
  }
}

// ── 2. preferences: 清空 preferred/avoided/corrections ──
{
  const fp = path.join(runtime.userDir, 'preferences.json');
  const cur = readJson(fp, null);
  if (cur) {
    const beforeP = (cur.preferredTemplates || []).length;
    const beforeA = (cur.avoidedTemplates   || []).length;
    const beforeC = (cur.corrections        || []).length;
    const reset = {
      ...cur,
      preferredTemplates: [],
      avoidedTemplates:   [],
      corrections:        [],
    };
    if (!DRY) writeJson(fp, reset);
    summary.push(`preferences.json: preferred=${beforeP}→0, avoided=${beforeA}→0, corrections=${beforeC}→0`);
  }
}

// ── 3. learning-failures: events/repeats 清空 ──
{
  const fp = path.join(runtime.globalDir, 'learning-failures.json');
  const cur = readJson(fp, null);
  if (cur) {
    const beforeE = (cur.events  || []).length;
    const beforeR = (cur.repeats || []).length;
    const reset = { ...cur, events: [], repeats: [] };
    if (!DRY) writeJson(fp, reset);
    summary.push(`learning-failures.json: events=${beforeE}→0, repeats=${beforeR}→0`);
  }
}

// ── 4. context-access-log: accesses 清空 ──
{
  const fp = path.join(runtime.globalDir, 'context-access-log.json');
  const cur = readJson(fp, null);
  if (cur) {
    const before = (cur.accesses || []).length;
    const reset = { ...cur, accesses: [] };
    if (!DRY) writeJson(fp, reset);
    summary.push(`context-access-log.json: accesses=${before}→0`);
  }
}

// ── 5. smartfit-calibration: overflowIncidents 清空，保留 charWidthMultipliers ──
{
  const fp = path.join(runtime.globalDir, 'smartfit-calibration.json');
  const cur = readJson(fp, null);
  if (cur) {
    const before = (cur.overflowIncidents || []).length;
    const reset = { ...cur, overflowIncidents: [] };
    if (!DRY) writeJson(fp, reset);
    summary.push(`smartfit-calibration.json: overflowIncidents=${before}→0 (charWidthMultipliers 保留)`);
  }
}

// ── 6. validators/learned-rules.json: 硬规则清空 ──
{
  const fp = path.join(SKILL_DIR, 'validators', 'learned-rules.json');
  const cur = readJson(fp, null);
  if (cur) {
    const before = (cur.rules || []).length;
    const reset = {
      generatedAt: new Date().toISOString(),
      threshold:   cur.threshold || 5,
      count:       0,
      promotedIds: [],
      rules:       [],
    };
    if (!DRY) writeJson(fp, reset);
    summary.push(`validators/learned-rules.json: 硬规则=${before}→0`);
  }
}

console.log('=== 清零汇总 ===');
summary.forEach(s => console.log('  ✓ ' + s));
console.log(DRY ? '\n(--dry-run，未实际写入)' : '\n✅ 清零完成。下次 pipeline / validate 跑起来会重新累积权重。');
if (bkDir && !DRY) console.log(`   如需恢复，备份在 ${path.relative(SKILL_DIR, bkDir)}/`);
