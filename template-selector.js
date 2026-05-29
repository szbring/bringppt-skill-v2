'use strict';
/**
 * template-selector.js — Phase 2.2
 *
 * 三层稳定性机制（解决"容易调错模板"问题）
 *
 * 第1层：usage.notWhen 硬性排除
 *   → 从 notWhen 文本自动解析可编程规则 + 内容类型过滤
 *   → 是直接排除，不是减分
 *
 * 第2层：schema 强验证（调用前）
 *   → 对 buildLayoutData 返回的数据做完整结构校验
 *   → 不合法 → 自动换备选，不崩溃报错
 *
 * 第3层：selfLearning.errorPatterns 历史规避（运行时）
 *   → 已知失败模式降低优先级，严重错误直接排除
 *
 * 用法：
 *   const { selectBestLayout } = require('./template-selector');
 *   const { layout, data, reason } = selectBestLayout(page, buildFn);
 */

const registry = require('./registry');
const store = require('./lib/learning-store');

// ── contentType 互斥规则（决定性排除） ──────────────────────────────
// key: notWhen 文本中出现的关键词 → 对应的 contentType 或标志位
const CONTENT_TYPE_EXCLUSIONS = {
  // 如果模板 notWhen 含这些词 且 page.contentType 匹配 → 排除
  '流程说明':   ['process'],
  '流程图':     ['process'],
  '时间线':     ['process'],
  '数据图表':   ['data'],
  '数据展示':   ['data'],
  '数据对比':   ['data', 'comparison'],
  '对比分析':   ['comparison'],
  '图片画廊':   [],          // 不影响 contentType（需要 imageData，另外处理）
  '并列概念':   ['concept'],
  '并列内容':   ['concept'],
  '引用类内容': ['case'],
};

// ── "超过N个" 后面跟的是计数类还是维度类词 ─────────────────────────────
// 维度类：不影响 keyPoint 数量，应跳过
const NON_KP_CONTEXT = /^(维度|象限|集合|列|行|层|组|类|边|侧|圆|圈)/;

// ── 从 notWhen 文本解析数量上限/下限 ───────────────────────────────
function parseCountRule(notWhen) {
  const rules = [];

  // 上限规则："超过N个XX" ── 只有 XX 是计数类词时才提取
  for (const m of notWhen.matchAll(/超过\s*(\d+)\s*个(.{0,3})/g)) {
    const ctx = (m[2] || '').trim();
    if (NON_KP_CONTEXT.test(ctx)) continue;  // 维度/象限/集合等 → 跳过
    rules.push({ type: 'max', value: parseInt(m[1]) });
  }
  // "N步" "N阶段" 等不带"个"的写法
  for (const m of notWhen.matchAll(/(\d+)\s*[步阶]/g)) {
    rules.push({ type: 'max', value: parseInt(m[1]) });
  }

  // 精确数量："不是N个"（同样排除维度类）
  const exactMatch = notWhen.match(/不是\s*(\d+)\s*个(.{0,3})/);
  if (exactMatch) {
    const ctx = (exactMatch[2] || '').trim();
    if (!NON_KP_CONTEXT.test(ctx)) rules.push({ type: 'exact', value: parseInt(exactMatch[1]) });
  }

  // 下限规则："少于N个"
  const underMatch = notWhen.match(/少于\s*(\d+)\s*个/);
  if (underMatch) rules.push({ type: 'min', value: parseInt(underMatch[1]) });

  return rules;
}

// ── 第1层：usage.notWhen 硬性排除 ────────────────────────────────────

/**
 * 检查 page 是否被模板的 notWhen 条件排除
 * @returns {boolean} true = 应排除, false = 可用
 */
function isExcludedByNotWhen(tpl, page) {
  const notWhen     = (tpl.usage && tpl.usage.notWhen) || '';
  const contentType = page.contentType || 'default';
  const kpCount     = (page.keyPoints || []).length;

  if (!notWhen) return false;

  // 1a. 数量规则检查
  const countRules = parseCountRule(notWhen);
  for (const rule of countRules) {
    if (rule.type === 'max'   && kpCount > rule.value)  return true;
    if (rule.type === 'min'   && kpCount < rule.value)  return true;
    if (rule.type === 'exact' && kpCount !== rule.value) return true;
  }

  // 1b. 内容类型互斥检查
  for (const [keyword, excludedTypes] of Object.entries(CONTENT_TYPE_EXCLUSIONS)) {
    if (notWhen.includes(keyword) && excludedTypes.includes(contentType)) {
      return true;
    }
  }

  // 1c. 特定内容类型与模板类型的强制互斥
  // 流程类模板 不应用于 对比型内容
  // v4.0.1: 移除已删除的 cycleDiagram
  const PROCESS_TEMPLATES = ['stepList', 'processFlow', 'phaseDiagram', 'chainFlow', 'snakeFlow', 'waveProgression', 'staircase'];
  // v4.0.1: chart 家族精简到 chartBar；其他 chart 类型可用 freeform 实现
  const DATA_TEMPLATES    = ['dataHighlight', 'chartBar', 'kpiDashboard', 'achievement'];

  if (contentType === 'comparison' && PROCESS_TEMPLATES.includes(tpl.name)) return true;
  if (contentType === 'data'       && !DATA_TEMPLATES.includes(tpl.name) &&
      ['process', 'comparison', 'concept', 'case', 'action'].includes(contentType)) {
    // data 内容优先 DATA_TEMPLATES，但不强制排除其他（有 suggestedLayout 时尊重它）
  }

  // 1d. v4.0.1: imageGallery/imageText 已删除，无需再做"无图片排除"判断

  // 1e. flowerPetal 严格要求 4 个要素
  if (tpl.name === 'flowerPetal' && kpCount !== 4) return true;

  // 1f. 特殊：单要素/零要素时排除所有需要数组的模板
  if (kpCount === 0) {
    const schema = tpl.schema || {};
    for (const s of Object.values(schema)) {
      // required:true 且为 array 才排除（与 validateAgainstSchema 逻辑保持一致）
      if (s.type === 'array' && s.required === true) return true;
    }
  }

  return false;
}

// ── 第2层：schema 强验证 ──────────────────────────────────────────────

/**
 * 深度验证 data 对象是否符合 schema 约束
 * @returns {{ valid: boolean, errors: string[] }}
 */
// ── Schema 辅助：判断一个 spec 是「字段描述」还是「嵌套对象 schema」
// 字段描述：有 type/warn/error/required/min/max/item 等元属性
// 嵌套对象：值本身是包含子字段描述的对象（如 comparison.left = { title:{}, items:{} }）
// v4.1.0: 字段 spec 的标准 meta-key 集合
// 'optional' / 'items' 是 legacy 写法，保留在集合里仅为兼容外部输入；模板内部已统一为 'required' / 'item'
const FIELD_SPEC_KEYS = new Set(['type','warn','error','required','min','max','item','optional','description','default','items']);
function isFieldSpec(spec) {
  if (!spec || typeof spec !== 'object') return true;
  return Object.keys(spec).some(k => FIELD_SPEC_KEYS.has(k));
}

// ── Schema 辅助：检测 data 中存在但 schema 未定义的字段（未知字段 = 可能是拼写错误）
function detectUnknownFields(schema, data, prefix) {
  const warnings = [];
  if (!schema || !data || typeof data !== 'object' || Array.isArray(data)) return warnings;
  for (const key of Object.keys(data)) {
    if (!(key in schema)) {
      // 找出 schema 中与该字段名相似的已知字段（简单前缀匹配）
      const knownKeys = Object.keys(schema);
      const similar = knownKeys.find(k =>
        k.startsWith(key.slice(0,3)) || key.startsWith(k.slice(0,3))
      );
      const hint = similar ? `（是否应为 "${similar}"？）` : '（schema 中无此字段）';
      warnings.push(`未知字段 "${prefix}${key}" ${hint}`);
    } else {
      // 递归检查嵌套对象
      const spec = schema[key];
      if (!isFieldSpec(spec) && data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
        warnings.push(...detectUnknownFields(spec, data[key], `${prefix}${key}.`));
      }
    }
  }
  return warnings;
}

// ── v4.1.0: schema 写法已统一为单一标准 form（见 migrate-schema.js）
//    标准 form：{ type, required?, description?, warn?, error?, min?, max?, item? }
//    item 单数；optional/items/properties/string-shorthand 等历史写法已全部迁移
//    保留少量 legacy fallback（标注 // legacy:）以兼容外部 slides-data 输入；
//    在 v4.2.0 完全删除。
function validateAgainstSchema(schema, data) {
  const errors   = [];
  const warnings = [];

  if (!schema || !data) return { valid: true, errors, warnings };

  // ── 第一步：遍历 schema 键，检查值约束
  for (const [key, spec] of Object.entries(schema)) {
    const value = data[key];

    // legacy: optional:true 仍兼容外部输入；标准 form 中已被 migrate-schema 移除
    const isRequired = spec.required === true;
    const isOptional = !isRequired;

    // 可选字段允许缺失
    if (isOptional && (value === undefined || value === null)) continue;

    // 必要字段缺失检查
    if (value === undefined || value === null) {
      errors.push(`缺少必要字段 "${key}"；建议在 storyboard 中补充该字段`);
      continue;
    }

    // 数组类型检查
    if (spec.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`字段 "${key}" 应为数组（当前是 ${typeof value}）；建议改为 ${key}: [...]`);
        continue;
      }
      if (spec.min && value.length < spec.min) {
        errors.push(`"${key}" 仅 ${value.length} 项，少于最少要求 ${spec.min}；建议补到 ${spec.min} 项或换更轻量模板`);
      }
      if (spec.max && value.length > spec.max) {
        errors.push(`"${key}" 多达 ${value.length} 项，超过最多 ${spec.max}；建议合并/精简至 ${spec.max} 项或换更大容量模板`);
      }
      // 子项校验：标准 form 只看 spec.item（单数）
      const itemSpec = spec.item /* legacy: */ || spec.items;
      if (itemSpec && Array.isArray(value)) {
        // 区分两种 item 形态（不再支持 string 简写 / 'string?' 等）：
        //   A. 单值 spec: { type:'string', warn?, error? }            → 元素是 string/number
        //   B. 对象 spec: { title:{type:'string'}, desc:{type:'string'} } → 元素是对象
        const isSingleValueSpec = itemSpec && typeof itemSpec === 'object'
          && Object.keys(itemSpec).every(k => FIELD_SPEC_KEYS.has(k));

        for (let i = 0; i < value.length; i++) {
          const item = value[i];

          if (isSingleValueSpec) {
            // Form A：单值
            const expType = itemSpec.type;
            if (expType === 'string' && typeof item !== 'string') {
              errors.push(`第 ${i + 1} 个 ${key} 应为字符串（当前是 ${typeof item}）；建议改为简短文案`);
            } else if (expType === 'number' && typeof item !== 'number') {
              errors.push(`第 ${i + 1} 个 ${key} 应为数字（当前是 ${typeof item}）`);
            }
            if (expType === 'string' && itemSpec.error && String(item).length > itemSpec.error) {
              errors.push(`第 ${i + 1} 个 ${key} 长度 ${String(item).length} 超过 ${itemSpec.error} 字阈值；建议拆短或换更大容量模板`);
            }
            continue;
          }

          // Form B：对象 item — 严格要求是非空对象
          if (item === null || item === undefined) {
            errors.push(`第 ${i + 1} 个 ${key} 为空；建议补全 {${Object.keys(itemSpec).join(', ')}} 字段`);
            continue;
          }
          if (typeof item !== 'object' || Array.isArray(item)) {
            errors.push(`第 ${i + 1} 个 ${key} 应为对象（当前 ${typeof item}）；建议改为 {${Object.keys(itemSpec).join(', ')}}`);
            continue;
          }
          // 字段名错配检测——item 是对象但所有 key 都不在 schema 里
          const itemKeys   = Object.keys(item);
          const schemaKeys = Object.keys(itemSpec);
          const matched    = itemKeys.filter(k => schemaKeys.includes(k));
          if (itemKeys.length > 0 && matched.length === 0) {
            errors.push(`第 ${i + 1} 个 ${key} 字段名全部不匹配（输入 {${itemKeys.join(', ')}}，期望 {${schemaKeys.join(', ')}}）；建议改字段名`);
            continue;
          }
          // 关键字段隐式必填——title/name/text 在 schema 里必须存在于 data
          const KEY_FIELDS = ['title', 'name', 'text'];
          for (const kf of KEY_FIELDS) {
            if (kf in itemSpec && !(kf in item)) {
              errors.push(`第 ${i + 1} 个 ${key} 缺少 ${kf}（输入字段 {${itemKeys.join(', ')}}）；建议补充简短标签，如 "增长 20%"`);
              break;
            }
          }

          // 子字段校验（标准 form：iSpec 一定是对象，不是字符串简写）
          for (const [iKey, iSpec] of Object.entries(itemSpec)) {
            const iVal = item[iKey];
            const required = iSpec && iSpec.required === true;
            const present  = iVal !== undefined && iVal !== null && iVal !== '';

            if (required && !present) {
              errors.push(`第 ${i + 1} 个 ${key}.${iKey} 为空（必填）；建议补充内容`);
              continue;
            }
            if (!present) continue;

            if (iSpec.type === 'string' && typeof iVal !== 'string') {
              errors.push(`第 ${i + 1} 个 ${key}.${iKey} 应为字符串（当前 ${typeof iVal}）`);
            } else if (iSpec.type === 'number' && typeof iVal !== 'number') {
              errors.push(`第 ${i + 1} 个 ${key}.${iKey} 应为数字（当前 ${typeof iVal}）`);
            } else if (iSpec.type === 'array' && !Array.isArray(iVal)) {
              errors.push(`第 ${i + 1} 个 ${key}.${iKey} 应为数组`);
            }
            if ((iSpec.type === 'string' || typeof iVal === 'string') && iSpec.error) {
              if (String(iVal).length > iSpec.error) {
                errors.push(`第 ${i + 1} 个 ${key}.${iKey} 长度 ${String(iVal).length} 超过 ${iSpec.error} 字阈值；建议拆短或换更大容量模板`);
              }
            }
          }
        }
      }
      continue;
    }

    // 嵌套对象 schema：递归校验
    if (!isFieldSpec(spec) && value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = validateAgainstSchema(spec, value);
      errors.push(...nested.errors.map(e => `${key}.${e}`));
      warnings.push(...nested.warnings.map(w => `${key}.${w}`));
      continue;
    }

    // 字符串长度检查（error 级别）
    if ((spec.type === 'string' || typeof value === 'string') && spec.error) {
      if (String(value).length > spec.error) {
        errors.push(`"${key}" 长度 ${String(value).length} 超过 ${spec.error} 字阈值；建议拆短或换更大容量模板`);
      }
    }

    // 数字类型检查
    if (spec.type === 'number' && typeof value !== 'number') {
      errors.push(`"${key}" 应为数字（当前 ${typeof value}）`);
    }
  }

  // ── 第二步：检测 data 中的未知字段（仅检查顶层，嵌套层已由递归处理）
  for (const key of Object.keys(data)) {
    if (!(key in schema)) {
      const knownKeys  = Object.keys(schema);
      const similar    = knownKeys.find(k => k.startsWith(key.slice(0,3)) || key.startsWith(k.slice(0,3)));
      const hint       = similar ? `（是否应为 "${similar}"？）` : '（schema 中无此字段）';
      warnings.push(`未知字段 "${key}" ${hint}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}


// ── 运行期容量约束：补足部分模板 schema 未写 min/max 的历史缺口 ─────
const LAYOUT_ITEM_LIMITS = {
  stepList:       { field: 'steps', min: 2, max: 7 },
  processFlow:    { field: 'steps', min: 2, max: 5 },
  timeline:       { field: 'events', min: 2, max: 7 },
  iconList:       { field: 'items', min: 2, max: 6 },
  dataHighlight:  { field: 'items', min: 2, max: 5 },
  threeColumn:    { field: 'cards', min: 3, max: 3 },
  twoColumnCards: { field: 'cards', min: 2, max: 2 },
  cardGrid:       { field: 'cards', min: 2, max: 12 },
  layeredList:    { field: 'layers', min: 2, max: 5 },
  beforeAfter:    { field: 'pairs', min: 2, max: 5 },
  sidebarLabel:   { field: 'cards', min: 2, max: 4 },
  // v4.0.1: causalChain 已删除
};

function getByPath(obj, fieldPath) {
  return String(fieldPath).split('.').reduce((cur, key) => cur && cur[key], obj);
}

function validateTemplateRuntimeConstraints(layoutName, data) {
  const errors = [];
  const limit = LAYOUT_ITEM_LIMITS[layoutName];
  if (limit) {
    const value = getByPath(data, limit.field);
    if (!Array.isArray(value)) errors.push(`${limit.field} 应为数组`);
    else if (value.length < limit.min || value.length > limit.max) errors.push(`${limit.field} count ${value.length} outside valid range [${limit.min}-${limit.max}]`);
  }
  if (layoutName === 'comparison') {
    const left = data && data.left && Array.isArray(data.left.items) ? data.left.items.length : 0;
    const right = data && data.right && Array.isArray(data.right.items) ? data.right.items.length : 0;
    if (left < 1 || right < 1) errors.push(`comparison requires at least 1 item on both left and right (got ${left}/${right})`);
  }
  return { valid: errors.length === 0, errors };
}

// ── 第3层：selfLearning.errorPatterns 历史规避 ───────────────────────

/**
 * 检查是否命中已知错误模式
 * @returns {{ skip: boolean, reason: string|null }}
 */
function checkErrorPatterns(tpl, page, data) {
  const learning       = tpl.selfLearning || {};
  const errorPatterns  = learning.errorPatterns || [];
  const kpCount        = (page.keyPoints || []).length;

  for (const ep of errorPatterns) {
    // 通用条件解析
    if (ep.condition === 'few_keypoints'  && kpCount < 2) {
      return { skip: true, reason: `历史错误: 要点数不足 (${ep.description || ep.condition})` };
    }
    if (ep.condition === 'many_keypoints' && kpCount > 5) {
      return { skip: true, reason: `历史错误: 要点数过多 (${ep.description || ep.condition})` };
    }
    if (ep.condition === 'overflow'       && ep.severity === 'critical') {
      return { skip: true, reason: `历史错误: 严重溢出 (${ep.description || ep.condition})` };
    }
    // 匹配自定义条件（支持 ep.contentType 过滤）
    if (ep.contentType && ep.contentType !== page.contentType) continue;
    if (ep.kpCount && kpCount !== ep.kpCount) continue;
    if (ep.kpCountMax && kpCount > ep.kpCountMax) {
      return { skip: true, reason: `历史错误: ${ep.description || ep.condition}` };
    }
    if (ep.kpCountMin && kpCount < ep.kpCountMin) {
      return { skip: true, reason: `历史错误: ${ep.description || ep.condition}` };
    }
  }

  return { skip: false, reason: null };
}

// ── contentType → 候选版式链 ──────────────────────────────────────────
// 按优先级排列，长链保证总有候选
// v4.0.1: 移除已删除的 radialHub / cycleDiagram；chart 家族收口到 chartBar
const CANDIDATE_CHAINS = {
  data:       ['dataHighlight', 'chartBar', 'styledTable', 'kpiDashboard', 'achievement', 'iconList', 'threeColumn'],
  process:    ['stepList', 'processFlow', 'timeline', 'phaseDiagram', 'staircase', 'chainFlow', 'waveProgression', 'snakeFlow', 'iconList'],
  comparison: ['comparison', 'beforeAfter', 'hourglass', 'twoColumnCards', 'swotGrid', 'dualPanel', 'iconList'],
  concept:    ['iconList', 'twoColumnCards', 'threeColumn', 'layeredList', 'cardGrid', 'flowerPetal'],
  case:       ['twoColumnCards', 'caseBox', 'iconList', 'dualPanel', 'layeredList'],
  action:     ['checklist', 'stepList', 'cardGrid', 'iconList', 'processFlow'],
  default:    ['iconList', 'twoColumnCards', 'threeColumn', 'stepList', 'layeredList', 'cardGrid', 'insightBanner'],
};


function preferredByContentAndCount(contentType, kpCount) {
  if (contentType === 'process') {
    if (kpCount <= 1) return ['insightBanner', 'processFlow', 'stepList', 'cardGrid'];
    if (kpCount <= 3) return ['stepList', 'processFlow', 'timeline', 'phaseDiagram'];
    if (kpCount <= 5) return ['processFlow', 'stepList', 'phaseDiagram', 'timeline', 'cardGrid'];
    return ['snakeFlow', 'cardGrid', 'timeline', 'processFlow'];
  }
  if (contentType === 'comparison') {
    if (kpCount <= 2) return ['twoColumnCards', 'comparison', 'beforeAfter', 'dualPanel', 'insightBanner'];
    return ['comparison', 'beforeAfter', 'dualPanel', 'hourglass', 'twoColumnCards'];
  }
  if (contentType === 'data') {
    if (kpCount <= 4) return ['dataHighlight', 'chartBar', 'kpiDashboard', 'achievement'];
    return ['chartBar', 'styledTable', 'kpiDashboard', 'cardGrid'];
  }
  if (contentType === 'action') {
    return kpCount <= 3
      ? ['checklist', 'stepList', 'processFlow', 'cardGrid']
      : ['checklist', 'cardGrid', 'progressList', 'styledTable'];
  }
  if (contentType === 'concept' || contentType === 'case') {
    if (kpCount <= 2) return ['twoColumnCards', 'insightBanner', 'iconList', 'cardGrid'];
    if (kpCount === 3) return ['threeColumn', 'iconList', 'cardGrid', 'layeredList'];
    return ['cardGrid', 'iconList', 'layeredList'];  // v4.0.1: 去掉 radialHub
  }
  return kpCount <= 1
    ? ['insightBanner', 'stepList', 'twoColumnCards', 'iconList', 'cardGrid', 'threeColumn']
    : kpCount === 2
      ? ['twoColumnCards', 'comparison', 'stepList', 'beforeAfter', 'insightBanner', 'iconList', 'cardGrid', 'threeColumn']
      : kpCount === 3
        ? ['threeColumn', 'iconList', 'stepList', 'cardGrid', 'layeredList']
        : ['iconList', 'stepList', 'cardGrid', 'layeredList', 'dataHighlight'];
}

function prioritizeByKeyPointCount(chain, kpCount, contentType = 'default') {
  const preferred = preferredByContentAndCount(contentType, kpCount);
  const seen = new Set();
  const result = [];
  for (const name of [...preferred, ...chain]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

function getSelectionHints() {
  const prefs = store.userRead('preferences.json', {
    preferredTemplates: [],
    avoidedTemplates: [],
    corrections: [],
    stylePreferences: {},
  });
  const stats = store.globalRead('generation-stats.json', {
    templateUsage: {},
  });
  return {
    preferred: new Set(prefs.preferredTemplates || []),
    avoided: new Set(prefs.avoidedTemplates || []),
    usage: stats.templateUsage || {},
  };
}

function rankByLearningSignals(chain) {
  const hints = getSelectionHints();
  return chain
    .map((name, index) => {
      const usage = hints.usage[name] || {};
      let penalty = 0;
      if (hints.avoided.has(name)) penalty += 25;
      if (typeof usage.qaPassRate === 'number' && (usage.count || 0) >= 10) {
        if (usage.qaPassRate < 0.7) penalty += 10;
        else if (usage.qaPassRate < 0.9) penalty += 5;
      }
      if (hints.preferred.has(name)) penalty -= 2;
      return { name, index, score: index * 10 + penalty };
    })
    .sort((a, b) => (a.score - b.score) || (a.index - b.index))
    .map(x => x.name);
}

function tryCandidate(layoutName, page, buildFn) {
  const tpl = registry.get(layoutName);
  if (!tpl) return { ok: false, reason: `${layoutName}: 未注册` };
  if (isExcludedByNotWhen(tpl, page)) {
    return { ok: false, reason: `${layoutName}: [L1] notWhen 排除 (kp=${(page.keyPoints || []).length}, type=${page.contentType || 'default'})` };
  }
  let data;
  try {
    data = buildFn(page.keyPoints || [], layoutName, page);
  } catch (e) {
    return { ok: false, reason: `${layoutName}: [L2] buildData 异常: ${e.message}` };
  }
  const { valid, errors } = validateAgainstSchema(tpl.schema, data);
  if (!valid) {
    return { ok: false, reason: `跳过 ${layoutName}: ${errors.slice(0, 2).join('; ')}` };
  }
  const runtime = validateTemplateRuntimeConstraints(layoutName, data);
  if (!runtime.valid) {
    return { ok: false, reason: `跳过 ${layoutName}: 数据量与模板容量不匹配: ${runtime.errors.slice(0, 2).join('; ')}` };
  }
  const { skip, reason } = checkErrorPatterns(tpl, page, data);
  if (skip) return { ok: false, reason: `跳过 ${layoutName}: ${reason}` };
  return { ok: true, tpl, data };
}

// ── 核心选择器 ─────────────────────────────────────────────────────────

/**
 * 选择最佳版式（三层稳定性）
 *
 * @param {object} page        - storyboard page 对象
 * @param {Function} buildFn   - (keyPoints, layout, page) → data
 * @param {object}  [opts]
 * @param {boolean} [opts.verbose] - 打印决策日志
 * @returns {{ layout: string, data: object, reason: string, skippedLogs: string[] }}
 */
function selectBestLayout(page, buildFn, opts = {}) {
  const { verbose = false } = opts;
  const { contentType = 'default', suggestedLayout, keyPoints = [] } = page;
  const kpCount   = keyPoints.length;
  const skipped   = [];  // 决策日志

  // 组装候选链（suggestedLayout 优先）
  const base  = rankByLearningSignals(
    prioritizeByKeyPointCount(CANDIDATE_CHAINS[contentType] || CANDIDATE_CHAINS.default, kpCount, contentType)
  );
  const chain = suggestedLayout && registry.get(suggestedLayout)
    ? [suggestedLayout, ...base.filter(l => l !== suggestedLayout)]
    : base;

  for (const layoutName of chain) {
    const attempt = tryCandidate(layoutName, page, buildFn);
    if (!attempt.ok) {
      skipped.push(attempt.reason);
      continue;
    }

    if (verbose && skipped.length) {
      console.log(`  [selector] [INFO] 候选评估：${skipped.join(' | ')}`);
    }
    const reason = layoutName === suggestedLayout
      ? `直接采用推荐版式 ${suggestedLayout}`
      : `推荐版式 ${suggestedLayout || '无'} 不符 → 改用 ${layoutName}（数据量与字段匹配）`;

    return { layout: layoutName, data: attempt.data, reason, skippedLogs: skipped };
  }

  // 终极兜底：仍必须通过 schema validation；绝不返回非法 layout data。
  const fallbackNames = rankByLearningSignals(
    prioritizeByKeyPointCount(['twoColumnCards', 'stepList', 'iconList', 'cardGrid', 'insightBanner', 'threeColumn'], kpCount, contentType)
  );
  for (const fallbackName of fallbackNames) {
    const attempt = tryCandidate(fallbackName, page, buildFn);
    if (attempt.ok) {
      if (verbose) console.log(`  [selector] [INFO] 推荐候选链均不匹配，启用兜底版式 ${fallbackName}（建议复查 keyPoints 数量或字段长度）`);
      return {
        layout: fallbackName,
        data: attempt.data,
        reason: `推荐链均不匹配 → 兜底用 ${fallbackName}`,
        skippedLogs: skipped,
      };
    }
    skipped.push(attempt.reason);
  }
  throw new Error(`无法为页面 "${page.id || page.title || '未命名'}" 选出可用版式；最近失败原因：${skipped.slice(-3).join(' | ')}；建议精简内容或提供更宽松的 keyPoints`);
}

// ── 批量预检（用于 validate-slides 前置检查）──────────────────────────

/**
 * 对 slides-data 中的每个 content slide 做三层预检
 * @param {object[]} slides  - slides-data.slides 数组
 * @returns {{ ok: number, warn: number, errors: object[] }}
 */
function preflightCheck(slides) {
  const results = [];

  for (const slide of slides) {
    if (slide.type !== 'content') continue;
    for (const lay of (slide.layouts || [])) {
      const tpl = registry.get(lay.type);
      if (!tpl) {
        results.push({ slideId: slide.id, layout: lay.type, level: 'error', msg: '版式未注册' });
        continue;
      }

      // L2 检查（直接验证已有数据）
      const { valid, errors } = validateAgainstSchema(tpl.schema, lay.data);
      if (!valid) {
        results.push({ slideId: slide.id, layout: lay.type, level: 'warn',
                       msg: `schema 校验: ${errors.slice(0, 2).join('; ')}` });
      }

      // L3 检查
      const fakePage = { contentType: 'default', keyPoints: [] };
      const { skip, reason } = checkErrorPatterns(tpl, fakePage, lay.data);
      if (skip) {
        results.push({ slideId: slide.id, layout: lay.type, level: 'warn', msg: reason });
      }
    }
  }

  const ok   = slides.filter(s => s.type === 'content').length - results.filter(r => r.level === 'error').length;
  const warn  = results.filter(r => r.level === 'warn').length;
  const errors = results.filter(r => r.level === 'error');
  return { ok, warn, errors, results };
}

module.exports = {
  selectBestLayout,
  isExcludedByNotWhen,
  validateAgainstSchema,
  validateTemplateRuntimeConstraints,
  checkErrorPatterns,
  preflightCheck,
};
