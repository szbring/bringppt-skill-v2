#!/usr/bin/env node
'use strict';
/**
 * scripts/extract-fromkeypoints.js — 从 storyboard-converter.js god switch 提取 case body，
 * 自动注入为各模板的 fromKeyPoints(keyPoints, page)，配合 v3.7.7 已落地的 10 个适配器。
 *
 * 用法：
 *   node scripts/extract-fromkeypoints.js --dry-run   # 看会改什么
 *   node scripts/extract-fromkeypoints.js             # 实际写入
 *
 * 规则：
 *   - 已有 fromKeyPoints 的模板跳过
 *   - case body 内引用 splitTitleDesc / ensureVisibleText / extractDataHighlight
 *     时自动 require ./lib/keypoints-helpers
 *   - case body 内的 kps / title 变量在 wrapper 顶部 reconstruct
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');

const DRY = process.argv.includes('--dry-run');

const conv = fs.readFileSync(path.join(SKILL_DIR, 'storyboard-converter.js'), 'utf-8');

// 用 token-walk 提取每个 `case 'X': { ... }` 块（直到匹配的 `}`）。
// 同时支持 fall-through `case 'a': case 'b': { ... }`
function extractCases(src) {
  const result = {};
  const re = /(\s*case\s+'([^']+)':\s*)+\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    // 找 fall-through case 名集合（向前看）
    const headStart = src.lastIndexOf('case ', m.index + 1);
    let scan = headStart;
    const names = [];
    while (scan >= 0) {
      const cm = /case\s+'([^']+)':\s*/g.exec(src.slice(scan));
      if (!cm) break;
      if (cm.index !== 0) break;
      names.push(cm[1]);
      // 继续往后扫
      const after = scan + cm[0].length;
      if (/^case\s+'/.test(src.slice(after).replace(/^\s+/, ''))) {
        scan = src.indexOf('case ', after);
      } else break;
    }
    // 简化：从 m.index 起重新解析
    let pi = src.indexOf("'", m.index);
    const namesA = [];
    while (true) {
      // 跳到 case 'X': 后下一个非空白
      const start = src.indexOf("case '", pi - 6);
      if (start < 0 || start > m.index + 200) break;
      const q1 = src.indexOf("'", start + 5);
      const q2 = src.indexOf("'", q1 + 1);
      namesA.push(src.slice(q1 + 1, q2));
      const colon = src.indexOf(':', q2);
      // 看后面是 case 还是 {
      const tail = src.slice(colon + 1).replace(/^\s+/, '');
      if (tail.startsWith("case '")) {
        pi = src.indexOf("case '", colon) + 6;
        continue;
      } else if (tail.startsWith('{')) {
        break;
      } else break;
    }
    const groupNames = namesA.length ? namesA : [m[2]];

    // 找匹配的 } 闭括号
    let depth = 1, i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const bodyStart = m.index + m[0].length;
    const bodyEnd = i;
    const body = src.slice(bodyStart, bodyEnd).trim();
    for (const n of groupNames) result[n] = body;
    re.lastIndex = bodyEnd + 1;
  }
  return result;
}

const cases = extractCases(conv);
const allCaseNames = Object.keys(cases);

// 找模板文件
const reg = require(path.join(SKILL_DIR, 'registry'));
function findTemplateFile(tplName) {
  const tplsDir = path.join(SKILL_DIR, 'templates');
  for (const f of fs.readdirSync(tplsDir)) {
    if (!f.endsWith('.js') || f.endsWith('.bak')) continue;
    try {
      const mod = require(path.join(tplsDir, f));
      if (mod && mod.name === tplName) return f;
    } catch {}
  }
  return null;
}

function needsHelpers(body) {
  const h = [];
  if (/\bsplitTitleDesc\b/.test(body)) h.push('splitTitleDesc');
  if (/\bensureVisibleText\b/.test(body)) h.push('ensureVisibleText');
  if (/\bextractDataHighlight\b/.test(body)) h.push('extractDataHighlight');
  return h;
}

function wrapAsFromKeyPoints(body) {
  // 调整：把 case body 包成 fromKeyPoints。body 假设引用 `kps`、`title`、`page`。
  // 我们在 wrapper 顶部声明 kps/title。
  const helpers = needsHelpers(body);
  const requireLine = helpers.length
    ? `    const { ${helpers.join(', ')} } = require('../lib/keypoints-helpers');\n`
    : '';
  return `  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
${requireLine}    const kps = keyPoints || [];
    const title = (page && page.title) || '';
${body.split('\n').map(l => '    ' + l).join('\n')}
  },

`;
}

let injected = 0, skipped = 0, missing = 0, errors = 0;
for (const tplName of allCaseNames) {
  const tplFile = findTemplateFile(tplName);
  if (!tplFile) { console.log(`  ✗ no file   ${tplName}`); missing++; continue; }
  const fp = path.join(SKILL_DIR, 'templates', tplFile);
  let src = fs.readFileSync(fp, 'utf-8');
  if (/fromKeyPoints\s*\(/m.test(src)) { console.log(`  - skipped   ${tplName}  (already has fromKeyPoints)`); skipped++; continue; }
  const anchor = /(\s*get\s+selfLearning\s*\(\)[^]*?\},)/m;
  if (!anchor.test(src)) {
    // 如果没 selfLearning getter，尝试 render 前注入
    const renderRe = /(\n\s*render\s*\(pres, slide, data, infra\))/;
    if (!renderRe.test(src)) { console.log(`  ✗ no anchor ${tplName}`); errors++; continue; }
    src = src.replace(renderRe, `\n${wrapAsFromKeyPoints(cases[tplName])}$1`);
  } else {
    src = src.replace(anchor, (m) => `${m}\n\n${wrapAsFromKeyPoints(cases[tplName])}`);
  }
  if (!DRY) fs.writeFileSync(fp, src, 'utf-8');
  console.log(`  ✓ injected ${tplName.padEnd(20)} → ${tplFile}`);
  injected++;
}

console.log(`\n汇总: injected ${injected}, skipped ${skipped}, no-file ${missing}, errors ${errors}`);
if (DRY) console.log('(--dry-run，未写入)');
