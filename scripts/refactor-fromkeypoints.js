#!/usr/bin/env node
'use strict';
/**
 * scripts/refactor-fromkeypoints.js — 批量重构 fromKeyPoints 适配器（Pillar 6）
 *
 * 识别"简单 splitTitleDesc + slice + map"模式，自动替换为 adapter-helpers 调用。
 * 不匹配复杂模式（reverse / 条件分支 / Math.floor / 自定义 transform）保持原样。
 *
 * 用法：
 *   node scripts/refactor-fromkeypoints.js --dry-run   # 仅显示
 *   node scripts/refactor-fromkeypoints.js             # 实际改
 */

const fs   = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'templates');
const dryRun = process.argv.includes('--dry-run');

function extractFromKeyPointsBody(src) {
  // 找到 fromKeyPoints( 起始，配对到匹配的 },
  const start = src.search(/fromKeyPoints\s*\(\s*keyPoints/);
  if (start < 0) return null;
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 1;
  let j = i + 1;
  while (j < src.length && depth > 0) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0) break;
    j++;
  }
  // j 现在指向匹配的 }
  // 前缀：扫到行首和上面的注释
  let pStart = start;
  // 回退到行首
  while (pStart > 0 && src[pStart - 1] !== '\n') pStart--;
  // 注释块向上扫
  let cStart = pStart;
  while (cStart > 0) {
    let lineStart = cStart - 1;
    while (lineStart > 0 && src[lineStart - 1] !== '\n') lineStart--;
    const line = src.slice(lineStart, cStart - 1).trim();
    if (line.startsWith('//')) { cStart = lineStart; }
    else break;
  }
  // 函数末尾找 }, 后第一个换行
  let end = j + 1;
  while (end < src.length && src[end] !== '\n') end++;
  // 跳过末尾 , 的换行
  return {
    fullStart: cStart,
    fnStart:   pStart,
    bodyStart: i + 1,
    bodyEnd:   j,
    fullEnd:   end,
    full:      src.slice(cStart, end),
    body:      src.slice(i + 1, j),
  };
}

function analyzeFn(body) {
  // 必要：含 splitTitleDesc
  if (!/splitTitleDesc/.test(body)) return null;

  // 排除复杂模式
  if (/reverse\(\)/.test(body)) return null;
  if (/Math\.floor|Math\.ceil/.test(body)) return null;
  if (/extract(?:DataHighlight|Number)/.test(body)) return null;
  if (/\bextract\w+\s*\(/.test(body)) return null;
  if (/page\s*\.\s*(?:images|imagePath)/.test(body)) return null;
  if (/\.filter\(/.test(body)) return null;
  // 含 if 分支但不是 ternary 的不动
  if (/^\s*if\s*\(/m.test(body)) return null;

  // 找 .slice(0, N).map(... splitTitleDesc ...)
  const sliceMapRe = /\.slice\(\s*0\s*,\s*(\d+)\s*\)\s*\.map\(\s*(?:\([^)]*\)|\w+)\s*=>\s*\{[\s\S]*?splitTitleDesc[\s\S]*?return\s*\{([\s\S]*?)\}\s*[\s\S]*?\}\s*\)/;
  const m = body.match(sliceMapRe);
  if (!m) return null;
  const max = parseInt(m[1]);
  const returnBody = m[2];

  // 提取 return 内每个 key
  // 简单解析 key: value 对
  const fields = {};
  const fieldRe = /([\w]+)\s*:\s*([^,}]+?)(?=,|$)/g;
  let fm;
  while ((fm = fieldRe.exec(returnBody)) !== null) {
    fields[fm[1]] = fm[2].trim();
  }

  // 必须至少含 title
  if (!fields.title) return null;
  // 不接受复杂 value（如 ternary、函数调用），但允许常量 null、字面量、t 变量
  const isSimple = v => /^[\w'"`.\-]+$|^null$|^''$|^""$|^t$|^d$|^d\s*\|\|\s*t$|^d\s*\|\|\s*''$|^d\s*\|\|\s*""$/.test(v);
  if (!Object.values(fields).every(isSimple)) return null;

  // 找 return 整体的字段名（外层挂载）
  // 形如  return { cards } 或 return { items, summary }
  // 找最后一个 return 语句
  const outerReturnRe = /return\s*\{([\s\S]*?)\};/g;
  let lastReturn = null;
  let rm;
  while ((rm = outerReturnRe.exec(body)) !== null) lastReturn = rm[1];
  if (!lastReturn) return null;

  // 解析外层字段
  const outerFields = {};
  // 提取 cards 或 cards: localVar
  const outerRe = /(\w+)(?:\s*:\s*([^,}]+))?/g;
  let om;
  while ((om = outerRe.exec(lastReturn)) !== null) {
    outerFields[om[1]] = om[2] ? om[2].trim() : om[1];
  }

  // 找哪个 outer field 的 value 对应 .map 结果
  // 该 var 名通常是变量名（cards, items, levels...）；用启发式：value === 'cards' 等于 key
  let arrayFieldName = null;
  for (const [k, v] of Object.entries(outerFields)) {
    if (v === k || /^[\w]+$/.test(v)) {
      // 找定义点：const cards = ... .slice.map
      const defRe = new RegExp(`(?:const|let)\\s+${v}\\s*=`);
      if (defRe.test(body) && body.indexOf(v) !== -1) {
        // 检查这个变量是不是 slice.map 的结果（同一赋值语句内，不跨等号）
        const checkRe = new RegExp(`(?:const|let)\\s+${v}\\s*=[^=]*?\\.slice\\(\\s*0\\s*,\\s*${max}`);
        if (checkRe.test(body)) {
          arrayFieldName = k;
          break;
        }
      }
    }
  }
  if (!arrayFieldName) return null;

  const extras = {};
  for (const [k, v] of Object.entries(outerFields)) {
    if (k === arrayFieldName) continue;
    extras[k] = v;
  }

  // 决定 titleField / descField
  // 大部分模板用 title, desc。若 fields 含别名（如 t/d），统一映射
  const titleField = 'title';
  const descField  = 'desc';

  // 额外字段（如 icon: null, number: String(i+1)）
  const extraItemFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'title' || k === 'desc') continue;
    extraItemFields[k] = v;
  }

  return {
    max,
    arrayFieldName,
    titleField,
    descField,
    extras,
    extraItemFields,
  };
}

function buildReplacement(info) {
  const { max, arrayFieldName, extras, extraItemFields } = info;

  const hasExtraItemFields = Object.keys(extraItemFields).length > 0;

  const opts = [`max: ${max}`];
  // 自定义 transform
  if (hasExtraItemFields) {
    const fields = Object.entries(extraItemFields).map(([k, v]) => `${k}: ${v}`).join(', ');
    opts.push(`transform: (item, i) => ({ ${fields}, ...item })`);
  }

  const optsStr = opts.length === 1 ? `{ ${opts[0]} }` : `{\n      ${opts.join(',\n      ')},\n    }`;

  const extraReturn = Object.entries(extras).length
    ? ', ' + Object.entries(extras).map(([k, v]) => k === v ? k : `${k}: ${v}`).join(', ')
    : '';

  return `  // v3.7.26: 批量重构到 adapter-helpers.mapKpsToItems
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { ${arrayFieldName}: mapKpsToItems(keyPoints, ${optsStr})${extraReturn} };
  },`;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
const candidates = [];
const skipped = [];

for (const f of files) {
  const fp  = path.join(DIR, f);
  const src = fs.readFileSync(fp, 'utf8');
  if (/adapter-helpers/.test(src)) { skipped.push({ f, reason: 'already-refactored' }); continue; }
  const fn = extractFromKeyPointsBody(src);
  if (!fn) { skipped.push({ f, reason: 'no-fn-or-parse-fail' }); continue; }
  const info = analyzeFn(fn.body);
  if (!info) { skipped.push({ f, reason: 'pattern-mismatch' }); continue; }
  candidates.push({ file: fp, name: f, fn, info, src });
}

console.log(`扫描 ${files.length} 个模板\n`);
console.log(`可重构: ${candidates.length}`);
console.log(`已重构: ${skipped.filter(s => s.reason === 'already-refactored').length}`);
console.log(`模式不匹配: ${skipped.filter(s => s.reason === 'pattern-mismatch').length}`);
console.log(`解析失败: ${skipped.filter(s => s.reason === 'no-fn-or-parse-fail').length}\n`);

if (dryRun) {
  candidates.forEach(c => {
    console.log(`  ✓ ${c.name} → ${c.info.arrayFieldName}, max=${c.info.max}, extras=[${Object.keys(c.info.extras).join(',')}], itemExtras=[${Object.keys(c.info.extraItemFields).join(',')}]`);
  });
  process.exit(0);
}

let applied = 0;
for (const c of candidates) {
  const replacement = buildReplacement(c.info);
  const newSrc = c.src.slice(0, c.fn.fullStart) + replacement + c.src.slice(c.fn.fullEnd);
  fs.writeFileSync(c.file, newSrc);
  applied++;
}
console.log(`\n实际重构 ${applied}/${candidates.length} 个模板`);
