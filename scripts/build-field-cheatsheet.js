#!/usr/bin/env node
// build-field-cheatsheet.js — 从 registry 自动抽取每个模板的 schema 字段
// 生成 markdown 速查表，写到 references/template-fields.md
//
// v4.1.0: schema 已统一为单一标准 form（type / required / description / warn / error / min / max / item）
//
// 用法：
//   node scripts/build-field-cheatsheet.js               # 写到 references/template-fields.md
//   node scripts/build-field-cheatsheet.js --stdout      # 输出到 stdout
'use strict';

const fs   = require('fs');
const path = require('path');
const r    = require('../registry');

const CATEGORY_ORDER = [
  '数据/指标型',
  '并列型',
  '流程/步骤型',
  '流程/序列型',
  '对比型',
  '矩阵/框架型',
  '分析/诊断型',
  '咨询框架',
  '项目管理型',
  '叙事/引用型',
  '图文/复合型',
  '其他',
  '逃生舱',
  '页面模板',
];

// 是否是字段 spec（必须包含 type 或主要 meta key）
// 注意：items/properties/optional 是 legacy 仅作 meta 不算 field-spec 指示符（避免把 {title, items} 这种 nested schema 误判）
const FIELD_SPEC_KEYS = new Set(['type','warn','error','required','min','max','item','description','default']);
function isFieldSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return false;
  return Object.keys(spec).some(k => FIELD_SPEC_KEYS.has(k));
}

// 把 spec 渲染成一行 markdown bullet
function fmtFieldSpec(name, spec, depth) {
  const indent = '  '.repeat(depth);
  if (typeof spec === 'string') {
    // legacy shorthand 安全兜底
    return `${indent}- \`${name}\`: ${spec}`;
  }
  if (!spec || typeof spec !== 'object') return `${indent}- \`${name}\`: any`;

  // 嵌套 schema（无 type/meta key）→ 当作对象字段，展开子字段
  if (!isFieldSpec(spec)) {
    const parts = [`${indent}- \`${name}\`: object`];
    const lines = [parts.join('')];
    for (const [k, v] of Object.entries(spec)) {
      lines.push(fmtFieldSpec(k, v, depth + 1));
    }
    return lines.join('\n');
  }

  // 字段 spec
  const parts = [];
  let type = spec.type || 'any';
  if (Array.isArray(type)) type = type.join('|');
  parts.push(`\`${name}\`: ${type}`);

  // required 标记
  if (spec.required === true) parts.push('**required**');
  else parts.push('optional');

  // 数组容量
  if (spec.type === 'array' && (spec.min !== undefined || spec.max !== undefined)) {
    parts.push(`长度 ${spec.min ?? 0}–${spec.max ?? '∞'}`);
  }
  // 字符串长度
  if (spec.type === 'string' && (spec.warn !== undefined || spec.error !== undefined)) {
    parts.push(`长度 warn=${spec.warn ?? '-'} / error=${spec.error ?? '-'}`);
  }
  if (spec.default !== undefined) parts.push(`默认=${JSON.stringify(spec.default)}`);
  if (spec.description) parts.push(`— ${spec.description}`);

  let line = `${indent}- ${parts.join(' · ')}`;

  // 数组 item
  if (spec.item && typeof spec.item === 'object') {
    if (isFieldSpec(spec.item) && Object.keys(spec.item).every(k => FIELD_SPEC_KEYS.has(k))) {
      // 单值 item
      const t = spec.item.type || 'any';
      const extras = [];
      if (spec.item.warn !== undefined || spec.item.error !== undefined) {
        extras.push(`warn=${spec.item.warn ?? '-'} / error=${spec.item.error ?? '-'}`);
      }
      line += `\n${indent}  - 元素: \`${t}\`` + (extras.length ? ` (${extras.join(', ')})` : '');
    } else {
      // 对象 item — 递归子字段
      for (const [k, v] of Object.entries(spec.item)) {
        line += '\n' + fmtFieldSpec(k, v, depth + 1);
      }
    }
  }
  // legacy items 兜底
  if (!spec.item && spec.items && typeof spec.items === 'object') {
    line += '\n' + fmtFieldSpec('(item)', spec.items, depth + 1);
  }

  return line;
}

function emit() {
  const lines = [];
  const all = r.list();
  lines.push('# BRINGPPT 模板字段速查表');
  lines.push('');
  lines.push(`> 自动从 bringppt registry 抽取，共 **${all.length} 个模板**。`);
  lines.push('> 生成命令：`node scripts/build-field-cheatsheet.js` (npm script: `npm run cheatsheet`)');
  lines.push('> v4.1.0 之后 schema 已统一为单一标准 form：`{ type, required?, description?, warn?, error?, min?, max?, item? }`');
  lines.push('');
  lines.push('## Schema 写法约定');
  lines.push('');
  lines.push('每个字段定义：');
  lines.push('');
  lines.push('```js');
  lines.push('{');
  lines.push("  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'function' | 'any',");
  lines.push('  required: true,           // 默认 false（不写就是可选）');
  lines.push("  description: '中文描述',");
  lines.push('  warn: 20,                 // 字符串长度软警告');
  lines.push('  error: 35,                // 字符串长度硬错误（仅 type:string）');
  lines.push('  min: 2,                   // 数组长度最小（仅 type:array）');
  lines.push('  max: 4,');
  lines.push('  item: { ...nestedSchema } // 数组单元素 schema（单数 item）');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('嵌套对象字段直接写成 `{ child1: {...spec}, child2: {...spec} }`（不需要 type:object 包裹）。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 索引');
  lines.push('');

  // 按 category 分组
  const byCat = {};
  all.forEach(t => {
    const cat = t.category || '其他';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(t);
  });
  const orderedCats = [
    ...CATEGORY_ORDER.filter(c => byCat[c]),
    ...Object.keys(byCat).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  // 索引
  orderedCats.forEach(cat => {
    const list = byCat[cat].sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`- **${cat}** (${list.length}): ${list.map(t => `[\`${t.name}\`](#${t.name.toLowerCase()})`).join(' · ')}`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // 详细字段
  orderedCats.forEach(cat => {
    lines.push(`## ${cat}`);
    lines.push('');
    byCat[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(t => {
      lines.push(`### \`${t.name}\``);
      lines.push('');
      if (t.description) lines.push(`**说明**：${t.description}`);
      if (t.usage && t.usage.when)    lines.push(`**何时用**：${t.usage.when}`);
      if (t.usage && t.usage.notWhen) lines.push(`**不要用**：${t.usage.notWhen}`);
      if (t.usage && t.usage.typicalHeight) lines.push(`**典型高度**：${t.usage.typicalHeight}`);
      lines.push('');
      if (t.schema && Object.keys(t.schema).length) {
        lines.push('**字段**：');
        lines.push('');
        Object.entries(t.schema).forEach(([k, v]) => lines.push(fmtFieldSpec(k, v, 0)));
        lines.push('');
      } else {
        lines.push('_无显式 schema（A 类页面模板由 contentSlide 提供底座）_');
        lines.push('');
      }
      // 示例
      if (t.usage && Array.isArray(t.usage.scenarios) && t.usage.scenarios.length) {
        lines.push('**典型场景**：');
        t.usage.scenarios.slice(0, 3).forEach(s => {
          lines.push(`- ${s.trigger || ''}${s.example ? ` — \`${s.example}\`` : ''}`);
        });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });
  });

  return lines.join('\n');
}

if (require.main === module) {
  const out = emit();
  if (process.argv.includes('--stdout')) {
    process.stdout.write(out);
  } else {
    const target = path.join(__dirname, '..', 'references', 'template-fields.md');
    fs.writeFileSync(target, out);
    const lc = out.split('\n').length;
    console.log(`[cheatsheet] 写入 ${target} （${lc} 行，${r.list().length} 个模板）`);
  }
}

module.exports = { emit };
