#!/usr/bin/env node
// audit-bottom-y.js — 扫描 92 模板，检查 _bottomY / _contentMaxBottom 合规
// 支持两种用法：
//   $ node scripts/audit-bottom-y.js           # CLI 打印报告
//   const { auditBottomY } = require('./scripts/audit-bottom-y');
//   const { issues, pristine, p1, p2 } = auditBottomY();   // 程序化使用（release gate）
'use strict';

const fs = require('fs');
const path = require('path');
const r = require('../registry');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function auditBottomY() {
  const issues = [];
  const pristine = [];

  // 自身就是 banner/footer 的模板：豁免 P1 检测（它们不需要设 _bottomY，因为是底部块本体）
  const BOTTOM_BLOCK_TEMPLATES = new Set(['insightBanner']);

  r.list().forEach(t => {
    if (t.isPageTemplate || t.name === 'freeform') return;
    if (BOTTOM_BLOCK_TEMPLATES.has(t.name)) { pristine.push(t.name); return; }
    // 模板文件名：camelCase → kebab-case
    const fname = t.name.replace(/([A-Z])/g, '-$1').toLowerCase() + '.js';
    const filePath = path.join(TEMPLATES_DIR, fname);
    if (!fs.existsSync(filePath)) {
      issues.push({ name: t.name, level: 'P0-MISS', note: 'file not found: ' + fname });
      return;
    }
    const src = fs.readFileSync(filePath, 'utf8');
    if (src.includes('module.exports = null')) return;  // soft-deleted

    const setsBottomY   = /slide\._bottomY\s*=/.test(src);
    const usesMaxBottom = /_contentMaxBottom/.test(src);
    const hasSummary    = /summary[\s\S]{0,400}(slide\.addText|slide\.addShape)/.test(src);
    const hasBanner     = /banner[\s\S]{0,300}(slide\.addText|slide\.addShape)/.test(src);
    const hasFooter     = /footer[\s\S]{0,300}(slide\.addText|slide\.addShape)/.test(src);
    const hasBottomBlock = hasSummary || hasBanner || hasFooter;

    if (hasBottomBlock && !setsBottomY) {
      issues.push({ name: t.name, level: 'P1', tag: [hasSummary && 'summary', hasBanner && 'banner', hasFooter && 'footer'].filter(Boolean).join('+'), usesMaxBottom });
    } else if (!setsBottomY && !usesMaxBottom) {
      issues.push({ name: t.name, level: 'P2', tag: '(no bottom block, no contracts)', usesMaxBottom: false });
    } else {
      pristine.push(t.name);
    }
  });

  return {
    issues,
    pristine,
    p0: issues.filter(i => i.level === 'P0-MISS').length,
    p1: issues.filter(i => i.level === 'P1').length,
    p2: issues.filter(i => i.level === 'P2').length,
    total: issues.length + pristine.length,
  };
}

function printReport() {
  const { issues, pristine, p1, p2, total } = auditBottomY();
  console.log('=== P1: 有底部块但没设 slide._bottomY (会导致与 insightBanner 重叠) ===');
  issues.filter(i => i.level === 'P1').forEach(i => console.log('  ' + i.name.padEnd(22) + ' [' + i.tag + ']' + (i.usesMaxBottom ? '  ✓ reads maxBot' : '  ✗ also ignores maxBot')));
  console.log();
  console.log('=== P2: 既不设 _bottomY 也不读 _contentMaxBottom (轻度) ===');
  issues.filter(i => i.level === 'P2').forEach(i => console.log('  ' + i.name));
  console.log();
  console.log('=== ✓ 已合规 ===');
  console.log('  ' + pristine.join(', '));
  console.log();
  console.log('Total templates audited: ' + total);
  console.log('P1 (high priority):       ' + p1);
  console.log('P2 (low priority):        ' + p2);
  console.log('Pristine:                 ' + pristine.length);
}

module.exports = { auditBottomY };

if (require.main === module) {
  printReport();
}
