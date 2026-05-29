#!/usr/bin/env node
'use strict';
/**
 * scripts/migrate-fonts.js — 一次性把 templates/*.js 里的字体字面量批量迁到 FONTS.*
 *
 * 用法：
 *   node scripts/migrate-fonts.js --dry-run    # 只看会改什么
 *   node scripts/migrate-fonts.js              # 实际改写
 *
 * 规则：
 *   'Microsoft YaHei'                        → FONTS.primary
 *   "Microsoft YaHei"                        → FONTS.primary
 *   'Barlow, Microsoft YaHei, Arial'         → FONTS.numeric
 *   'Barlow, Open Sans, Arial'               → FONTS.en
 *   'Barlow, Arial'                          → FONTS.enSmall
 *   'Consolas, Monaco, monospace'            → FONTS.mono
 *
 * 同时：若 render 函数的 `const { ... } = infra;` 没有 FONTS，则注入。
 *
 * 排除：lib/infra.js（字体常量定义本身）、scripts/lint-fonts.js（规则定义）。
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const DRY      = process.argv.includes('--dry-run');

const REPLACEMENTS = [
  [/'Barlow, Microsoft YaHei, Arial'/g,   'FONTS.numeric'],
  [/'Barlow, Microsoft YaHei'/g,           'FONTS.numeric'],   // 简化变体
  [/'Barlow, Open Sans, Arial'/g,          'FONTS.en'],
  [/'Barlow, Arial'/g,                     'FONTS.enSmall'],
  [/'Consolas, Monaco, monospace'/g,       'FONTS.mono'],
  [/'Microsoft YaHei'/g,                   'FONTS.primary'],
  [/"Microsoft YaHei"/g,                   'FONTS.primary'],
];

const SKIP_FILES = new Set([
  'lib/infra.js',
  'scripts/lint-fonts.js',
  'scripts/migrate-fonts.js',
]);

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

/**
 * 把字体字面量替换为 FONTS.xxx；返回 { src, replaced }
 */
function applyReplacements(src) {
  let replaced = 0;
  let out = src;
  for (const [re, to] of REPLACEMENTS) {
    out = out.replace(re, (m) => { replaced++; return to; });
  }
  return { src: out, replaced };
}

/**
 * 如果文件内使用了 FONTS.xxx，但 render 函数的 const { ... } = infra; 没解构 FONTS，
 * 在 destructure 列表里加 FONTS。
 *
 * 处理两种形态：
 *   const { C, shadow } = infra;        → const { C, shadow, FONTS } = infra;
 *   const { C, shadow,
 *           foo } = infra;              → const { C, shadow,
 *                                                  foo, FONTS } = infra;
 */
function ensureFontsDestructured(src) {
  if (!/\bFONTS\.\w+/.test(src)) return { src, injected: 0 };
  if (/FONTS\b[\s,]*[},]/.test(src) && /=\s*infra\b/.test(src)) {
    // 已经有 FONTS 在 destructure 里
    if (/const\s*\{[^}]*\bFONTS\b[^}]*\}\s*=\s*infra/m.test(src)) {
      return { src, injected: 0 };
    }
  }

  // 找第一个 `} = infra` 把 FONTS 塞进 destructure
  // 用 multiline+lazy 抓 `const { ... } = infra;`
  const re = /const\s*\{([^}]+)\}\s*=\s*infra/m;
  const m = src.match(re);
  if (!m) {
    // 找不到统一 destructure；模板可能直接写 infra.FONTS.xxx，这种情况已经能工作，跳过
    return { src, injected: 0 };
  }
  const inner = m[1];
  if (/\bFONTS\b/.test(inner)) return { src, injected: 0 };
  const updatedInner = inner.replace(/\s*$/, '') + ', FONTS';
  const updated = src.replace(re, `const {${updatedInner} } = infra`);
  return { src: updated, injected: 1 };
}

let totalFiles = 0, totalReplaced = 0, totalInjected = 0;
const SCAN_DIRS = ['templates', 'tests'];

for (const subdir of SCAN_DIRS) {
  const root = path.join(SKILL_DIR, subdir);
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const rel = path.relative(SKILL_DIR, file);
    if (SKIP_FILES.has(rel)) continue;
    const original = fs.readFileSync(file, 'utf-8');
    let { src, replaced } = applyReplacements(original);
    if (replaced === 0) continue;

    const { src: src2, injected } = ensureFontsDestructured(src);
    src = src2;

    if (!DRY) fs.writeFileSync(file, src, 'utf-8');
    totalFiles++;
    totalReplaced += replaced;
    totalInjected += injected;
    console.log(`  ${replaced.toString().padStart(3)} replace${injected ? ' +FONTS' : ''}  ${rel}`);
  }
}

console.log('\n--- 汇总 ---');
console.log(`文件: ${totalFiles}`);
console.log(`字面量替换: ${totalReplaced}`);
console.log(`FONTS destructure 注入: ${totalInjected}`);
if (DRY) console.log('（--dry-run，未实际写入）');
