#!/usr/bin/env node
'use strict';
/**
 * scripts/scan-zorder.js — 扫描带连线/箭头的模板，识别"线在卡之后画"导致被遮挡的 z-order 错误。
 *
 * 规则：在同一个模板的 render 函数中，addShape(LINE/ARROW) 出现的代码顺序应该在
 *      第一处 addShape(RECTANGLE/ROUNDED_RECTANGLE/OVAL/DIAMOND) 之前，
 *      否则线条会被卡片盖住。
 *
 * 用法：npm run lint:zorder
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');

const TEMPLATES_DIR = path.join(SKILL_DIR, 'templates');
const LINE_RE = /shapes\.(LINE|RIGHT_ARROW|LEFT_ARROW|UP_ARROW|DOWN_ARROW|CHEVRON)/;
const CARD_RE = /shapes\.(RECTANGLE|ROUNDED_RECTANGLE|OVAL|DIAMOND)/;

const offenders = [];

for (const f of fs.readdirSync(TEMPLATES_DIR)) {
  if (!f.endsWith('.js') || f.endsWith('.bak')) continue;
  const src = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8');

  // 只看 render 函数内部
  const m = src.match(/render\s*\(pres,\s*slide,\s*data,\s*infra\)\s*\{([\s\S]*?)\n\s*\}\s*,?\s*\}\s*;?\s*$/);
  if (!m) continue;
  const body = m[1];

  // 找所有 addShape 调用，记录顺序
  const shapeCalls = [];
  const re = /slide\.addShape\(pres\.shapes\.(\w+)/g;
  let mm;
  while ((mm = re.exec(body)) !== null) {
    const kind = mm[1];
    const type = (/^(LINE|RIGHT_ARROW|LEFT_ARROW|UP_ARROW|DOWN_ARROW|CHEVRON)$/.test(kind)) ? 'line'
               : (/^(RECTANGLE|ROUNDED_RECTANGLE|OVAL|DIAMOND)$/.test(kind)) ? 'card'
               : 'other';
    if (type !== 'other') shapeCalls.push({ kind, type, pos: mm.index });
  }

  if (shapeCalls.length < 2) continue;

  // 检查：第一个 card 之后是否有 line
  const firstCardIdx = shapeCalls.findIndex(c => c.type === 'card');
  if (firstCardIdx < 0) continue;
  const linesAfterCard = shapeCalls.slice(firstCardIdx + 1).filter(c => c.type === 'line');
  if (linesAfterCard.length > 0) {
    offenders.push({
      file: f,
      firstCard: shapeCalls[firstCardIdx].kind,
      linesAfter: linesAfterCard.map(l => l.kind),
    });
  }
}

console.log(`\n=== z-order 扫描：${offenders.length} 个模板有"线/箭头在卡片之后画"的情况 ===\n`);
offenders.forEach(o => {
  console.log(`  ${o.file.padEnd(28)}  first card: ${o.firstCard}  → 之后画了: ${o.linesAfter.join(', ')}`);
});
if (offenders.length === 0) console.log('  ✓ 全部模板 z-order 正确（线/箭头在卡片之前画）');

console.log('\n规则：线/箭头作为"底层装饰"必须先 addShape，再画卡片；否则线条被卡片遮挡。');
console.log('详见 docs/TEMPLATE-SPEC.md "z-order 规范" 节。');
