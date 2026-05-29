#!/usr/bin/env node
'use strict';
/**
 * scripts/lint-fonts.js — 字体硬编码静态检查（v3.7.5）
 *
 * 扫描所有模板与脚本中直接写死的字体字符串（'Microsoft YaHei' / 'Barlow, ...' 等）。
 * 新模板应该用 infra.FONTS.primary / FONTS.en / FONTS.numeric 引用，便于一处修改全局生效。
 *
 * 当前状态（v3.7.5）：infra.FONTS 已就位但 89 个老模板仍直接写字面量；本脚本输出报告
 * 用于：（1）保护新代码不重蹈覆辙；（2）后续分批迁移老模板时跟踪进度。
 *
 * 用法：
 *   npm run lint:fonts             # 报告所有命中
 *   npm run lint:fonts -- --strict # 命中即 exit 1（CI 用）
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

// 需要扫描的目录
const SCAN_DIRS = ['templates', 'lib', 'tests'];

// 豁免文件：字体常量定义点本身必须保留字面量
const EXEMPT_FILES = new Set([
  'lib/infra.js',
]);

// 已知字体字面量（v3.7.5 起标记为"待迁移"）
const PATTERNS = [
  { re: /'Microsoft YaHei'/g,                 name: 'Microsoft YaHei',     hint: "→ FONTS.primary 或 FONTS.CN" },
  { re: /"Microsoft YaHei"/g,                 name: 'Microsoft YaHei (双引号)', hint: "→ FONTS.primary" },
  { re: /'Barlow, Microsoft YaHei[^']*'/g,     name: 'Barlow 数字栈',         hint: "→ FONTS.numeric / FONTS.NUM" },
  { re: /'Barlow, Open Sans[^']*'/g,           name: 'Barlow 英文栈',         hint: "→ FONTS.en" },
  { re: /'Barlow, Arial'/g,                    name: 'Barlow 英文小字栈',     hint: "→ FONTS.enSmall / FONTS.EN_S" },
  { re: /'Consolas, Monaco[^']*'/g,            name: '等宽字体栈',            hint: "→ FONTS.mono" },
];

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (f.endsWith('.js')) out.push(full);
  }
  return out;
}

let total = 0;
const perFile = {};

for (const subdir of SCAN_DIRS) {
  const root = path.join(SKILL_DIR, subdir);
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const rel = path.relative(SKILL_DIR, file);
    if (EXEMPT_FILES.has(rel)) continue;
    const src = fs.readFileSync(file, 'utf-8');
    let hits = 0;
    for (const p of PATTERNS) {
      const m = src.match(p.re);
      if (m) hits += m.length;
    }
    if (hits > 0) {
      perFile[rel] = hits;
      total += hits;
    }
  }
}

console.log('\n=== 字体硬编码扫描报告 (v3.7.5) ===');
console.log(`总命中: ${total} 处 / ${Object.keys(perFile).length} 个文件\n`);

const sorted = Object.entries(perFile).sort((a, b) => b[1] - a[1]);
console.log('Top 20 文件:');
sorted.slice(0, 20).forEach(([f, n]) => {
  console.log(`  ${String(n).padStart(4)}  ${f}`);
});

if (sorted.length > 20) console.log(`  ... 及其余 ${sorted.length - 20} 个文件`);

console.log('\n建议：');
console.log('  • 新模板：直接 const { FONTS } = infra; 然后用 FONTS.primary / FONTS.en');
console.log('  • 老模板：可按需替换；保留字面量也不会出错（FONTS 与 FONT 本质值相同）');
console.log('  • CI / 提交前：可用 npm run lint:fonts -- --strict 在新代码引入字面量时报错');

if (STRICT && total > 0) process.exit(1);
