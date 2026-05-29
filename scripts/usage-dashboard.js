#!/usr/bin/env node
'use strict';
/**
 * scripts/usage-dashboard.js — bringppt 模板用量仪表盘 (P2-15)
 *
 * 把 learning/global/generation-stats.json 可视化为：
 *   - 各模板使用次数（Top 10 高频）
 *   - 各模板错误率（qaPassRate 取反）
 *   - 从未使用的"僵尸模板"列表（候选软删除）
 *   - 高错误率模板（>20% fallback / qaPass < 0.8）
 *
 * 用法：
 *   $ node scripts/usage-dashboard.js
 *   $ npm run dashboard
 */

const fs = require('fs');
const path = require('path');
const r = require('../registry');

// ── ANSI 着色 ──────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  gray:    '\x1b[90m',
};

const STATS_PATH = path.join(__dirname, '..', 'learning', 'global', 'generation-stats.json');

function readStats() {
  if (!fs.existsSync(STATS_PATH)) return null;
  try {
    const raw = fs.readFileSync(STATS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function makeBar(value, max, width = 12) {
  if (max <= 0) return ''.padEnd(width, '░');
  const filled = Math.max(1, Math.round((value / max) * width));
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

function colorErrorRate(rate) {
  if (rate >= 0.20) return C.red;
  if (rate >= 0.10) return C.yellow;
  return C.green;
}

function pad(s, w) {
  const len = String(s).length;
  return String(s) + ' '.repeat(Math.max(0, w - len));
}

function main() {
  console.log();
  console.log(`${C.bold}${C.cyan}bringppt 模板用量仪表盘${C.reset}`);
  console.log(`${C.gray}─────────────────────────────────────────${C.reset}`);
  console.log();

  const stats = readStats();
  const allTemplates = r.list().filter(t => !t.isPageTemplate && t.name !== 'freeform');
  const allNames = new Set(allTemplates.map(t => t.name));

  if (!stats || !stats.templateUsage || Object.keys(stats.templateUsage).length === 0) {
    console.log(`${C.yellow}暂无生成记录${C.reset}`);
    console.log(`${C.dim}请先跑几次 pipeline，再回来查看仪表盘：${C.reset}`);
    console.log(`${C.dim}  $ node ppt-pipeline.js --input <storyboard.json> --output <out.pptx>${C.reset}`);
    console.log();
    console.log(`${C.gray}注册表中共有 ${allTemplates.length} 个 B 类模板等待使用${C.reset}`);
    console.log();
    return;
  }

  // 整理数据
  const usage = stats.templateUsage;
  const rows = Object.entries(usage).map(([name, u]) => ({
    name,
    count: u.count || 0,
    qaPassRate: typeof u.qaPassRate === 'number' ? u.qaPassRate : 1,
  }));
  const totalGen = stats.totalGenerations || rows.reduce((s, r) => s + r.count, 0);

  // 总览
  console.log(`${C.bold}[总览]${C.reset}`);
  console.log(`  总生成次数：${C.cyan}${totalGen}${C.reset}`);
  console.log(`  使用过的模板：${C.cyan}${rows.filter(r => r.count > 0).length}${C.reset} / 注册表 ${allTemplates.length}`);
  console.log();

  // Top 10 高频
  console.log(`${C.bold}高频 Top 10：${C.reset}`);
  const sorted = [...rows].filter(r => r.count > 0).sort((a, b) => b.count - a.count);
  const top10 = sorted.slice(0, 10);
  const maxCount = top10.length ? top10[0].count : 1;
  for (const row of top10) {
    const errRate = 1 - row.qaPassRate;
    const errColor = colorErrorRate(errRate);
    const errPct = (errRate * 100).toFixed(1);
    console.log(
      `  ${pad(row.name, 22)}${C.cyan}${makeBar(row.count, maxCount)}${C.reset}  ${pad(row.count + ' 次', 8)}` +
      ` · 错误 ${errColor}${errPct}%${C.reset}`
    );
  }
  console.log();

  // 僵尸模板
  const usedNames = new Set(rows.filter(r => r.count > 0).map(r => r.name));
  const zombies = [...allNames].filter(n => !usedNames.has(n)).sort();
  console.log(`${C.bold}僵尸模板${C.reset}（注册表中存在但从未使用，候选软删除）：`);
  if (zombies.length === 0) {
    console.log(`  ${C.green}无 — 全部模板都至少被用过一次${C.reset}`);
  } else {
    // 按行展示，每行 4 个
    const perRow = 4;
    for (let i = 0; i < zombies.length; i += perRow) {
      const chunk = zombies.slice(i, i + perRow).map(n => pad(n, 22)).join('');
      console.log(`  ${C.gray}${chunk}${C.reset}`);
    }
    console.log(`  ${C.dim}（共 ${zombies.length} 个）${C.reset}`);
  }
  console.log();

  // 高错误率
  const highErr = sorted.filter(r => r.count >= 5 && (1 - r.qaPassRate) >= 0.20);
  console.log(`${C.bold}高错误率${C.reset}（使用 ≥5 次且错误率 ≥20%）：`);
  if (highErr.length === 0) {
    console.log(`  ${C.green}无 — 所有高频模板错误率均 <20%${C.reset}`);
  } else {
    for (const row of highErr) {
      const errRate = 1 - row.qaPassRate;
      const errPct = (errRate * 100).toFixed(0);
      console.log(`  ${C.red}${pad(row.name, 22)}${C.reset}${pad(row.count + ' 次', 8)} · 错误 ${C.red}${errPct}%${C.reset}`);
    }
  }
  console.log();

  // 注册表外（统计里有，但注册表没了 — 软删除或重命名）
  const orphan = rows.filter(r => !allNames.has(r.name)).map(r => r.name);
  if (orphan.length > 0) {
    console.log(`${C.bold}${C.yellow}统计孤儿${C.reset}（生成日志中出现但注册表已无 — 可能软删除）：`);
    orphan.forEach(n => console.log(`  ${C.yellow}${n}${C.reset}`));
    console.log(`  ${C.dim}建议清理：从 generation-stats.json 移除或保留为历史${C.reset}`);
    console.log();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`${C.red}仪表盘渲染失败：${e.message}${C.reset}`);
    process.exit(1);
  }
}

module.exports = { readStats };
