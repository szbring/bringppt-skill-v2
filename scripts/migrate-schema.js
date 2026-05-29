#!/usr/bin/env node
'use strict';
/**
 * migrate-schema.js — v4.1.0
 *
 * 把 templates/*.js 中的 schema 块统一为标准形式：
 *   {
 *     type:        'string'|'number'|'boolean'|'array'|'object'|'function'|'any',
 *     required:    true,           // 默认不写 = 可选
 *     description: '...',
 *     warn:        N,              // 字符串长度软警告
 *     error:       N,              // 字符串长度硬错误
 *     min:         N,              // 数组长度
 *     max:         N,
 *     item:        { ...nestedSchema } | { type: 'string', ... } // 单数 item
 *   }
 *
 * 规则：
 *   1. `'string?'` / `'string'` / `'number?'` / `'string[]'` 等简写 → 完整对象
 *   2. `optional: true` → 删除该字段（不写 required 即可选）；不引入 required:false
 *      （仅当字段曾 required:true 才显式写 required:true）
 *   3. `items:`（在 type:'array' 字段中）→ 改为 `item:`
 *   4. `properties:`（嵌套对象）→ 直接展开为本字段下的子键
 *   5. 顶层与嵌套统一格式
 *
 * 用法：
 *   node scripts/migrate-schema.js --dry          # 只打印 diff，不写盘
 *   node scripts/migrate-schema.js                # 实际写盘
 *   node scripts/migrate-schema.js --only=name1,name2  # 限定模板
 */
const fs   = require('fs');
const path = require('path');

const TPLS_DIR = path.join(__dirname, '..', 'templates');
const FIELD_SPEC_KEYS = new Set([
  'type', 'warn', 'error', 'required', 'min', 'max',
  'item', 'optional', 'description', 'default',
]);

// ── 1. 字符串简写 → 字段 spec 对象 ────────────────────────────────
//    'string'    → { type: 'string', required: true }
//    'string?'   → { type: 'string' }                  // 可选，不写 required
//    'string[]'  → { type: 'array', required: true, item: { type: 'string' } }
//    'string[]?' → { type: 'array', item: { type: 'string' } }
//    'number'    → { type: 'number', required: true }
function expandShorthand(s) {
  if (typeof s !== 'string') return s;
  let val = s;
  let optional = false;
  if (val.endsWith('?')) { optional = true; val = val.slice(0, -1); }
  const isArr = val.endsWith('[]');
  if (isArr) val = val.slice(0, -2);
  // 基本类型集合
  const baseType = val || 'any';
  if (isArr) {
    const out = { type: 'array', item: { type: baseType } };
    if (!optional) out.required = true;
    return out;
  }
  const out = { type: baseType };
  if (!optional) out.required = true;
  return out;
}

// ── 2. 单字段 spec 规范化 ────────────────────────────────────────
//    - 把 optional:true 移除（不写 required = 可选）
//    - 把 items: → item:
//    - 处理 properties: → 直接 inline 到字段下（仅对 object 类型）
//    - 把 default 保留
//    - 递归处理 item / nested
function normalizeSpec(spec) {
  if (spec == null) return spec;
  if (typeof spec === 'string') return normalizeSpec(expandShorthand(spec));
  if (Array.isArray(spec)) return spec;
  if (typeof spec !== 'object') return spec;

  // 区分这是一个「字段 spec」还是「嵌套 schema 对象」
  //   字段 spec：必须包含 type 或 description/warn/error/required 等元属性
  //   注意：items / properties 单独存在不算字段 spec（comparison.left.items 是字段名）
  //   只有当 type:'array' 出现 时 items 才被视为 item: 的别名
  const keys = Object.keys(spec);
  const hasTypeOrMeta = keys.some(k => FIELD_SPEC_KEYS.has(k));
  if (!hasTypeOrMeta) {
    // 嵌套 schema 对象（字段名 → spec 的映射）
    return normalizeSchema(spec);
  }

  const out = {};
  // 维持稳定 key 顺序：type, required, description, default, warn, error, min, max, item
  if (spec.type !== undefined) out.type = spec.type;

  // optional 转换：optional:true → 不写 required；否则若 required:true 显式保留
  if (spec.required === true) out.required = true;
  // 注意：optional:true / required:false 都丢弃，可选是默认状态

  if (spec.description !== undefined) out.description = spec.description;
  if (spec.default !== undefined)     out.default     = spec.default;
  if (spec.warn !== undefined)        out.warn        = spec.warn;
  if (spec.error !== undefined)       out.error       = spec.error;
  if (spec.min !== undefined)         out.min         = spec.min;
  if (spec.max !== undefined)         out.max         = spec.max;

  // 处理数组 item：合并 item / items（item 优先）
  let rawItem = spec.item !== undefined ? spec.item : spec.items;
  if (rawItem !== undefined) {
    // 数组字段必须显式 type:'array'
    if (out.type === undefined || out.type === 'array') out.type = 'array';
    if (typeof rawItem === 'string') {
      // items: 'string' → item: { type: 'string' }
      const expanded = expandShorthand(rawItem);
      // 单值 item 不需要 required:true（数组本身的 required 决定）
      delete expanded.required;
      out.item = expanded;
    } else if (typeof rawItem === 'object' && !Array.isArray(rawItem)) {
      // 对象 item：可能是
      //   A. 单值 spec: { type:'string', warn:25 }
      //   B. 多字段嵌套: { title:'string', desc:'string?' }
      const itemKeys = Object.keys(rawItem);
      const allMeta  = itemKeys.every(k => FIELD_SPEC_KEYS.has(k));
      if (allMeta) {
        out.item = normalizeSpec(rawItem);
        // 单值 item 不写 required
        delete out.item.required;
      } else {
        // 多字段嵌套 schema
        out.item = normalizeSchema(rawItem);
      }
    }
  }

  // 处理 properties（旧 JSON-schema 风格）→ inline 到字段下作 nested schema
  // 注：约定上 type:'object' + properties → 直接把字段们 inline 到 out 作 sibling key
  // 但这会破坏 type:'object' 语义。我们采取：当存在 properties，转为标准嵌套 schema 对象返回
  // 即丢弃 type:'object' 包裹，直接返回 properties 的归一化结果。
  if (spec.properties && typeof spec.properties === 'object') {
    // 这是 type:'object' 的字段，properties 是子字段表
    // 标准格式里：直接把对象字段写成 sub-schema 对象（不包装 type:'object'）
    // 但为了保留语义（区分「字段是 object」与「字段有子结构」），我们把 properties 转换为兄弟字段：
    //   trackA: { type:'object', properties: { label:'string?', events:'array' } }
    //   →
    //   trackA: { label: {...}, events: {...} }
    // （顶层 schema 已经是字段名 → spec，不需要 type wrapper）
    return normalizeSchema(spec.properties);
  }

  return out;
}

function normalizeSchema(schema) {
  if (schema == null || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    out[k] = normalizeSpec(v);
  }
  return out;
}

// ── 3. 把 JS 对象序列化为单行（短）或多行（长）字面量 ───────────────
function quoteIdent(k) {
  // 合法 JS identifier 不加引号；否则加单引号
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)) return k;
  return `'${k.replace(/'/g, "\\'")}'`;
}
function valToJs(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(valToJs).join(', ') + ']';
  if (typeof v === 'object') return objToJs(v, /*inline=*/true);
  return String(v);
}
function objToJs(o, inline) {
  const entries = Object.entries(o);
  if (entries.length === 0) return '{}';
  const parts = entries.map(([k, v]) => `${quoteIdent(k)}: ${valToJs(v)}`);
  return '{ ' + parts.join(', ') + ' }';
}

// 多行美化输出（深嵌套时换行）
// curIndent = 当前打开括号所在行已用空格数（作为续行 padding 基础）
function pretty(o, curIndent) {
  if (o === null) return 'null';
  if (typeof o === 'string') return `'${o.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (typeof o === 'number' || typeof o === 'boolean') return String(o);
  if (Array.isArray(o)) return '[' + o.map(v => pretty(v, curIndent + 2)).join(', ') + ']';
  if (typeof o !== 'object') return String(o);
  const entries = Object.entries(o);
  if (entries.length === 0) return '{}';
  // 短对象单行
  const inline = '{ ' + entries.map(([k, v]) => `${quoteIdent(k)}: ${valToJs(v)}`).join(', ') + ' }';
  if (inline.length <= 100 && !inline.includes('\n')) return inline;
  // 多行 — 子项在 curIndent+2 缩进，结束 } 在 curIndent
  const pad   = ' '.repeat(curIndent + 2);
  const close = ' '.repeat(curIndent);
  const lines = entries.map(([k, v]) => `${pad}${quoteIdent(k)}: ${pretty(v, curIndent + 2)}`);
  return '{\n' + lines.join(',\n') + '\n' + close + '}';
}

// 顶层 schema 块格式化（每个顶层字段一行，必要时其值多行）
function renderSchemaBlock(schema, baseIndent = '  ') {
  const inner = baseIndent + '  ';  // 4 spaces
  const lines = Object.entries(schema).map(([k, v]) => {
    const valStr = pretty(v, inner.length);  // inner.length = 4 → 子项 6
    return `${inner}${quoteIdent(k)}: ${valStr},`;
  });
  return `${baseIndent}schema: {\n${lines.join('\n')}\n${baseIndent}},`;
}

// ── 4. 在源码里定位 `  schema: { ... },` 块（基于花括号匹配） ─────
function findSchemaBlock(src) {
  const startMatch = src.match(/\n  schema:\s*\{/);
  if (!startMatch) return null;
  const start = startMatch.index + 1; // skip the leading \n
  // 找到匹配的右花括号
  let depth = 0;
  let i = src.indexOf('{', start);
  let inStr = null, esc = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    // 注释跳过
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // 包含末尾的逗号
        let end = i + 1;
        while (end < src.length && (src[end] === ',' || src[end] === ' ')) end++;
        if (src[end - 1] !== ',') {
          // 没有逗号也接受
        }
        return { start, end };
      }
    }
  }
  return null;
}

// ── 5. 主流程 ────────────────────────────────────────────────────
// 检测 schema 中是否含有需要语义迁移的非标准写法
function hasNonCanonicalForm(schema) {
  let flag = false;
  function walk(s, ctx) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return;
    for (const [k, v] of Object.entries(s)) {
      if (ctx === 'fields' && typeof v === 'string') { flag = true; return; }
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      if (v.optional === true) { flag = true; return; }
      if (v.type === 'array' && 'items' in v) { flag = true; return; }
      if ('properties' in v) { flag = true; return; }
      // recurse
      const isFieldSpec = Object.keys(v).some(kk => FIELD_SPEC_KEYS.has(kk));
      if (v.item && typeof v.item === 'object' && !Array.isArray(v.item)) {
        const itemKeys = Object.keys(v.item);
        const allMeta  = itemKeys.every(kk => FIELD_SPEC_KEYS.has(kk));
        if (!allMeta) walk(v.item, 'fields');
      }
      if (v.items && typeof v.items === 'object') walk(v.items, 'fields');
      if (v.properties && typeof v.properties === 'object') walk(v.properties, 'fields');
      if (!isFieldSpec) walk(v, 'fields');
    }
  }
  walk(schema, 'fields');
  return flag;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const allMode = args.includes('--all');   // 全部重写（包括只是 quote style 不同的）
  const onlyArg = args.find(a => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

  // 强制重新加载（清缓存）
  const registry = require('../registry');

  const all = registry.list();
  const stats = { migrated: [], unchanged: [], skipped: [] };

  for (const tpl of all) {
    if (only && !only.includes(tpl.name)) continue;
    // 默认只迁移有非标准写法的模板；--all 强制全部重写
    if (!only && !allMode && !hasNonCanonicalForm(tpl.schema)) {
      stats.unchanged.push(tpl.name);
      continue;
    }
    // 寻找源文件
    const fileGuess1 = path.join(TPLS_DIR, tpl.name + '.js');
    const fileGuessKebab = path.join(TPLS_DIR, tpl.name.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '.js');
    let file = fs.existsSync(fileGuess1) ? fileGuess1
             : fs.existsSync(fileGuessKebab) ? fileGuessKebab
             : null;
    if (!file) {
      // 扫描目录回退查找
      const candidates = fs.readdirSync(TPLS_DIR).filter(f => f.endsWith('.js'));
      for (const c of candidates) {
        const p = path.join(TPLS_DIR, c);
        try {
          const m = require(p);
          if (m && m.name === tpl.name) { file = p; break; }
        } catch {}
      }
    }
    if (!file) { stats.skipped.push({ name: tpl.name, reason: '找不到源文件' }); continue; }

    const src = fs.readFileSync(file, 'utf8');
    // 检测 dynamic / getter schema → 跳过
    // 找 schema: 后面看是 { 还是 get schema 或函数
    const schemaSig = src.match(/\n  (?:get\s+)?schema(?:\s*\(\s*\)\s*\{|\s*:\s*function)/);
    if (schemaSig) { stats.skipped.push({ name: tpl.name, reason: 'schema 是 getter / 函数' }); continue; }

    const block = findSchemaBlock(src);
    if (!block) { stats.skipped.push({ name: tpl.name, reason: '未定位 schema 块' }); continue; }

    const normalized = normalizeSchema(tpl.schema);
    const newBlock = renderSchemaBlock(normalized, '  ');
    const oldBlockText = src.slice(block.start, block.end);

    // 规范化结尾逗号
    let cleanOld = oldBlockText.replace(/\s+$/, '');
    let cleanNew = newBlock.replace(/\s+$/, '');
    // old 块末尾可能有逗号也可能没有 — 保持与 new 一致
    if (!cleanOld.endsWith(',')) {
      // 如果原来没逗号，去掉 new 的逗号
      if (cleanNew.endsWith(',')) cleanNew = cleanNew.slice(0, -1);
    }

    if (cleanOld === cleanNew) {
      stats.unchanged.push(tpl.name);
      continue;
    }

    if (dryRun) {
      console.log('\n=== ' + tpl.name + ' (' + path.basename(file) + ') ===');
      console.log('--- OLD ---');
      console.log(cleanOld);
      console.log('--- NEW ---');
      console.log(cleanNew);
    } else {
      const newSrc = src.slice(0, block.start) + cleanNew + src.slice(block.end);
      fs.writeFileSync(file, newSrc);
    }
    stats.migrated.push(tpl.name);
  }

  console.log('\n=== migrate-schema 报告 ===');
  console.log('迁移:', stats.migrated.length, '个 →', stats.migrated.join(', '));
  console.log('未变化:', stats.unchanged.length, '个');
  console.log('跳过:', stats.skipped.length, '个');
  for (const s of stats.skipped) console.log('  -', s.name, ':', s.reason);
  if (dryRun) console.log('\n(dry-run 模式，未写盘)');
}

if (require.main === module) main();
module.exports = { normalizeSchema, normalizeSpec, expandShorthand, renderSchemaBlock };
