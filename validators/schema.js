'use strict';
/**
 * validators/schema.js — Slide schema 验证（v3.7.9 全量抽取）
 *
 * 从 validate-slides.js 抽出全部 schema 常量 + validateSlide 主流程 + 辅助函数。
 * 不再使用模块级 issues 数组——调用方传入 issues 引用，验证函数 push 到该数组。
 *
 * 使用：
 *   const { validateSlide } = require('./validators/schema');
 *   const issues = [];
 *   validateSlide(issues, slide, index, allSlides);
 *
 * 依赖：validators/text-utils, template-selector（懒加载）, registry（懒加载）
 */

const { textLen, findColorValues } = require('./text-utils');

// ===== Character Limits =====
// { warnLen, errorLen } — Chinese character counts
const CHAR = {
  // Page-level templates
  cover: {
    title: { warn: 20, error: 30 },
    subtitle: { warn: 30, error: 50 },
  },
  section: {
    sectionTitle: { warn: 12, error: 20 },
    subtitle: { warn: 20, error: 35 },
    "coreLogic": { warn: 50, error: 80 },
    "cards[].title": { warn: 10, error: 18 },
    "cards[].desc": { warn: 25, error: 40 },
  },
  // caseDivider 已移除 (v3.7.30)
  backCover: {
    subtitle: { warn: 25, error: 40 },
  },
  // fullQuote 已移除 (v3.7.32)

  // Layout templates (overlay on content page)
  stepList: {
    "steps[].title": { warn: 15, error: 25 },
    "steps[].desc": { warn: 40, error: 60 },
    summary: { warn: 50, error: 80 },
  },
  comparison: {
    "left.title": { warn: 10, error: 20 },
    "right.title": { warn: 10, error: 20 },
    "items[]": { warn: 25, error: 40 },
    bottomText: { warn: 50, error: 80 },
  },
  twoColumnCards: {
    "cards[].title": { warn: 12, error: 20 },
    "cards[].content": { warn: 80, error: 120 },
  },
  threeColumn: {
    "cards[].title": { warn: 10, error: 18 },
    "cards[].bullets[]": { warn: 25, error: 40 },
    summary: { warn: 50, error: 80 },
  },
  processFlow: {
    "steps[].title": { warn: 10, error: 18 },
    "steps[].desc": { warn: 30, error: 50 },
  },
  timeline: {
    "events[].title": { warn: 12, error: 20 },
    "events[].desc": { warn: 25, error: 40 },
  },
  styledTable: {
    "cells[]": { warn: 15, error: 30 },
  },
  iconList: {
    "items[].title": { warn: 10, error: 18 },
    "items[].desc": { warn: 35, error: 55 },
  },
  dataHighlight: {
    "items[].number": { warn: 8, error: 15 },
    "items[].label": { warn: 12, error: 20 },
  },
  quadrantMatrix: {
    "quadrants[].title": { warn: 10, error: 18 },
    "quadrants[].content": { warn: 40, error: 60 },
  },
  pyramid: {
    "levels[].title": { warn: 12, error: 20 },
    "levels[].desc": { warn: 30, error: 50 },
  },
  colorMatrix: {
    "quadrants[].title": { warn: 10, error: 18 },
    "quadrants[].content": { warn: 40, error: 60 },
  },
  layeredList: {
    "layers[].title": { warn: 15, error: 22 },
    "layers[].desc": { warn: 40, error: 60 },
    summary: { warn: 50, error: 80 },
  },
  dualPanel: {
    "leftItems[]": { warn: 25, error: 40 },
    "rightItems[]": { warn: 25, error: 40 },
    summary: { warn: 50, error: 80 },
  },
  moduleOverview: {
    "topics[].title": { warn: 12, error: 20 },
    "topics[].desc": { warn: 30, error: 50 },
    overview: { warn: 60, error: 100 },
  },
  quoteEmphasis: {
    quote: { warn: 50, error: 80 },
    emphasis: { warn: 40, error: 65 },
    emphasisSub: { warn: 50, error: 80 },
  },
  impactQuestion: {
    question: { warn: 30, error: 50 },
    answer: { warn: 60, error: 100 },
  },
  quoteBanner: {
    quote: { warn: 50, error: 80 },
  },
  caseBox: {
    title: { warn: 15, error: 25 },
    content: { warn: 100, error: 150 },
  },
  imageText: {
    title: { warn: 15, error: 25 },
    content: { warn: 80, error: 120 },
  },
  beforeAfter: {
    "pairs[].before": { warn: 10, error: 20 },
    "pairs[].after": { warn: 10, error: 20 },
    "pairs[].afterDesc": { warn: 25, error: 40 },
    summary: { warn: 50, error: 80 },
  },
  cardGrid: {
    "cards[].title": { warn: 15, error: 25 },
    "cards[].desc": { warn: 30, error: 50 },
    summary: { warn: 50, error: 80 },
  },
  // V3.2 ISC-inspired templates
  sidebarLabel: {
    label: { warn: 6, error: 10 },
    "cards[].title": { warn: 10, error: 18 },
    "cards[].content": { warn: 80, error: 120 },
    summary: { warn: 40, error: 60 },
  },
  causalChain: {
    "steps[].tag": { warn: 8, error: 15 },
    "steps[].content": { warn: 30, error: 50 },
    "steps[].detail": { warn: 40, error: 60 },
    summary: { warn: 40, error: 60 },
  },
  insightBanner: {
    insight: { warn: 50, error: 80 },
    label: { warn: 8, error: 12 },
  },
};

// ===== Items Count Limits =====
const ITEMS = {
  stepList: { field: "steps", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 7 },
  comparison: { field: "left.items|right.items", warnMin: 2, warnMax: 4, errorMin: 1, errorMax: 6 },
  twoColumnCards: { field: "cards", warnMin: 2, warnMax: 2, errorMin: 2, errorMax: 2 },
  threeColumn: { field: "cards", warnMin: 3, warnMax: 3, errorMin: 3, errorMax: 3 },
  processFlow: { field: "steps", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 5 },
  timeline: { field: "events", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 7 },
  iconList: { field: "items", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 6 },
  dataHighlight: { field: "items", warnMin: 2, warnMax: 4, errorMin: 2, errorMax: 5 },
  pyramid: { field: "levels", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 6 },
  layeredList: { field: "layers", warnMin: 2, warnMax: 4, errorMin: 2, errorMax: 5 },
  colorMatrix: { field: "quadrants", warnMin: 4, warnMax: 4, errorMin: 4, errorMax: 4 },
  quadrantMatrix: { field: "quadrants", warnMin: 4, warnMax: 4, errorMin: 4, errorMax: 4 },
  moduleOverview: { field: "topics", warnMin: 2, warnMax: 4, errorMin: 1, errorMax: 6 },
  beforeAfter: { field: "pairs", warnMin: 2, warnMax: 4, errorMin: 2, errorMax: 5 },
  cardGrid: { field: "cards", warnMin: 3, warnMax: 8, errorMin: 2, errorMax: 12 },
  sidebarLabel: { field: "cards", warnMin: 2, warnMax: 4, errorMin: 2, errorMax: 4 },
  causalChain: { field: "steps", warnMin: 3, warnMax: 5, errorMin: 2, errorMax: 5 },
};




// ===== Required Fields per Type =====
const REQUIRED_FIELDS = {
  cover: ["title"],
  section: ["sectionTitle", "sectionNumber"],
  backCover: [],
  content: ["title"],
};

const REQUIRED_LAYOUT_FIELDS = {
  stepList: ["steps"],
  comparison: ["left", "right"],
  twoColumnCards: ["cards"],
  threeColumn: ["cards"],
  processFlow: ["steps"],
  timeline: ["events"],
  styledTable: ["headers", "rows"],
  iconList: ["items"],
  dataHighlight: ["items"],
  quadrantMatrix: ["quadrants"],
  pyramid: ["levels"],
  colorMatrix: ["quadrants"],
  layeredList: ["layers"],
  dualPanel: ["leftItems", "rightItems"],
  moduleOverview: ["moduleNumber", "moduleTitle", "topics"],
  quoteEmphasis: ["quote", "emphasis"],
  impactQuestion: ["question", "answer"],
  quoteBanner: ["quote"],
  caseBox: ["title", "content"],
  imageText: ["title"],
  beforeAfter: ["pairs"],
  cardGrid: ["cards"],
  // V3.2 ISC-inspired templates
  sidebarLabel: ["label", "cards"],
  causalChain: ["steps"],
  insightBanner: ["insight"],
};

// ===== HEX Color Regex =====
const HEX_RE = /^[0-9A-Fa-f]{6}$/;

// ===== Wrong Field Name Detection (catches common documentation-vs-code mismatches) =====
const WRONG_FIELD_NAMES = {
  comparison: [
    { wrong: "bullets", correct: "items", path: "left/right" },
  ],
  twoColumnCards: [
    { wrong: "bullets", correct: "content", path: "cards[]", note: "content is a string, not an array" },
  ],
  quadrantMatrix: [
    { wrong: "items", correct: "content", path: "quadrants[]", note: "content is a string, not an array" },
  ],
  colorMatrix: [
    { wrong: "items", correct: "content", path: "quadrants[]", note: "content is a string, not an array" },
  ],
  caseBox: [
    { wrong: "scenario", correct: "title", path: "root" },
    { wrong: "conflict", correct: "content", path: "root" },
    { wrong: "result", correct: "content", path: "root" },
  ],
};

// ===== Additional Required Fields (not in REQUIRED_LAYOUT_FIELDS) =====
const EXTRA_REQUIRED = {
  layeredList: { "layers[].tag": "each layer must have a tag field" },
  caseBox: { "startY": "startY is required (no default value)" },
  dualPanel: {
    "leftItems[].from": "each leftItem must have from field",
    "leftItems[].to": "each leftItem must have to field",
    "rightItems[].number": "each rightItem must have number field",
    "rightItems[].title": "each rightItem must have title field",
  },
};

// Auto-stack layouts sit at the bottom edge of a content slide and do not form the body.
// A content page that contains only auto-stack layouts will still have a blank middle.
const AUTO_STACK_LAYOUTS = new Set(["insightBanner"]);


// ===== Validation Logic =====

// ── validateAgainstSchema（未知字段检测，懒加载）──────────────
let _schemaValidator = null;
function getSchemaValidator() {
  if (!_schemaValidator) {
    try { _schemaValidator = require('../template-selector').validateAgainstSchema; }
    catch { _schemaValidator = () => ({ errors: [], warnings: [] }); }
  }
  return _schemaValidator;
}

// ── Registry 优先读取字符限制（懒加载，注意 ../ 路径）──────
let _registry = null;
function getRegistry() {
  if (!_registry) {
    try { _registry = require('../registry'); } catch { _registry = null; }
  }
  return _registry;
}

function getCharLimitFromRegistry(layoutType, fieldPath) {
  const reg = getRegistry();
  if (!reg) return null;
  const tpl = reg.get(layoutType);
  if (!tpl || !tpl.schema) return null;
  const schema = tpl.schema;

  // 解析 fieldPath → schema 节点
  // 支持格式: "field", "field[]", "parent.field", "array[].field", "parent.array[]"
  const parts = fieldPath.split(/\.(?![^[]*\])/); // 按 . 分割，但不切 [] 内的点

  let node = schema;
  for (const part of parts) {
    if (!node) return null;
    const isArray = part.endsWith('[]');
    const key = isArray ? part.slice(0, -2) : part;

    if (node[key] === undefined) return null;
    node = node[key];

    if (isArray) {
      // 进入 item 子节点（如果有）
      node = node.item || node; // string item 直接留在当前节点
    }
  }
  if (!node || (node.warn === undefined && node.error === undefined)) return null;
  return { warn: node.warn, error: node.error };
}

function getCharLimit(layoutType, fieldPath) {
  // 1. 优先 registry
  const fromReg = getCharLimitFromRegistry(layoutType, fieldPath);
  if (fromReg) return fromReg;
  // 2. fallback CHAR
  const charDef = CHAR[layoutType];
  if (!charDef) return null;
  return charDef[fieldPath] || null;
}



// 工厂模式：每次 validate 调用前 make 一组绑定 issues 数组的辅助函数
function makeHelpers(issues) {
  function error(slideId, msg) { issues.push({ level: "ERROR", slideId, msg }); }
  function warn(slideId, msg) { issues.push({ level: "WARN", slideId, msg }); }
  function checkCharLen(slideId, layoutType, fieldPath, text) {
    if (!text || typeof text !== "string") return;
    const limit = getCharLimit(layoutType, fieldPath);
    if (!limit) return;
    const len = textLen(text);
    if (len > limit.error) error(slideId, `${layoutType}.${fieldPath} length ${len} exceeds error limit ${limit.error}`);
    else if (len > limit.warn) warn(slideId, `${layoutType}.${fieldPath} length ${len} exceeds warn limit ${limit.warn}`);
  }
  function checkArrayItems(slideId, layoutType, fieldPath, arr) {
    if (!Array.isArray(arr)) return;
    const lim = ITEMS[layoutType];
    if (!lim) return;
    const n = arr.length;
    if (n < lim.errorMin || n > lim.errorMax) {
      error(slideId, `items count ${n} outside valid range [${lim.errorMin}-${lim.errorMax}] for ${layoutType}`);
    } else if (n < lim.warnMin || n > lim.warnMax) {
      warn(slideId, `items count ${n} outside recommended range [${lim.warnMin}-${lim.warnMax}] for ${layoutType}`);
    }
  }
  return { error, warn, checkCharLen, checkArrayItems };
}

function validateSlide(issues, slide, index, allSlides) {
  const { error, warn, checkCharLen, checkArrayItems } = makeHelpers(issues);
  const sid = slide.id || `slide[${index}]`;

  // 1. Check id exists
  if (!slide.id) {
    warn(sid, `missing "id" field`);
  }

  // 2. Check type exists
  if (!slide.type) {
    error(sid, `missing "type" field`);
    return;
  }

  // 3. Check required fields for page types
  const reqFields = REQUIRED_FIELDS[slide.type];
  if (reqFields) {
    for (const f of reqFields) {
      if (slide[f] === undefined || slide[f] === null || slide[f] === "") {
        error(sid, `missing required field "${f}" for type "${slide.type}"`);
      }
    }
  }

  // 5. Check colors in the entire slide object
  const colors = findColorValues(slide);
  for (const { path, value } of colors) {
    if (!HEX_RE.test(value)) {
      error(sid, `color "${value}" is not valid 6-digit hex (field: ${path})`);
    }
  }

  // 6. Check page-level char limits
  // 优先从 registry schema 读取限制，fallback 到 CHAR 硬编码
  // 映射 slide.type → registry 模板名
  const PAGE_TYPE_MAP = {
    cover: 'coverSlide', section: 'sectionSlide',
    backCover: 'backCoverSlide', toc: 'tocPage',
  };
  const regTypeName = PAGE_TYPE_MAP[slide.type] || slide.type;
  const charDef = CHAR[slide.type]; // fallback
  const pageFieldsToCheck = charDef ? Object.keys(charDef).filter(f => !f.includes("[")) : [];

  // 从 registry schema 追加字段（有 warn/error 的）
  const reg = getRegistry();
  const regTpl = reg && reg.get(regTypeName);
  if (regTpl && regTpl.schema) {
    for (const [k, v] of Object.entries(regTpl.schema)) {
      if (v && (v.warn !== undefined || v.error !== undefined) && !pageFieldsToCheck.includes(k)) {
        pageFieldsToCheck.push(k);
      }
    }
  }

  for (const fieldName of pageFieldsToCheck) {
    if (slide[fieldName] !== undefined) {
      checkCharLen(sid, regTypeName, fieldName, slide[fieldName]);
    }
  }

  // Check section cards
  if (slide.type === "section" && Array.isArray(slide.cards)) {
    checkArrayItems(sid, "section", "cards", slide.cards);
    for (let ci = 0; ci < slide.cards.length; ci++) {
      const card = slide.cards[ci];
      if (card.title) checkCharLen(sid, regTypeName, "cards[].title", card.title);
      if (card.desc)  checkCharLen(sid, regTypeName, "cards[].desc",  card.desc);
    }
  }
  // Check section coreLogic
  if (slide.type === "section" && typeof slide.coreLogic === "object" && slide.coreLogic.desc) {
    checkCharLen(sid, regTypeName, "coreLogic", slide.coreLogic.desc);
  } else if (slide.type === "section" && typeof slide.coreLogic === "string") {
    checkCharLen(sid, regTypeName, "coreLogic", slide.coreLogic);
  }

  // 6.5 Check content pages have non-empty layouts (empty layouts = blank page)
  if (slide.type === "content") {
    if (!slide.layouts || !Array.isArray(slide.layouts) || slide.layouts.length === 0) {
      error(sid, `content page has no layouts — will render as blank page (violates Rule 9: no large blank areas)`);
    } else {
      const bodyLayouts = slide.layouts.filter(l => l && l.type && !AUTO_STACK_LAYOUTS.has(l.type));
      if (bodyLayouts.length === 0) {
        const selectorHint = slide._selectorReason ? ` selector=${slide._selectorReason}` : "";
        const skippedHint = Array.isArray(slide._selectorSkippedLogs) && slide._selectorSkippedLogs.length
          ? ` skipped=${slide._selectorSkippedLogs.slice(0, 3).join(" | ")}`
          : "";
        error(
          sid,
          `content page has no body layouts — only auto-stack layouts found${selectorHint}${skippedHint}; middle area will stay blank`
        );
      }
    }
  }

  // 7. Check layouts for content type
  if (slide.type === "content" && slide.layouts) {
    for (const lay of slide.layouts) {
      if (!lay.type) {
        error(sid, `layout missing "type" field`);
        continue;
      }
      // 检查 layout type 是否在 registry 中存在（未知模板会导致空白页）
      const reg = getRegistry();
      if (reg && !reg.has(lay.type)) {
        // tocPage 特殊处理：gen_ppt 会自动兼容，给 WARN 而非 ERROR
        if (lay.type === 'tocPage') {
          warn(sid, `layout type "tocPage" should be used as top-level type:"toc" instead. gen_ppt will auto-redirect but please fix for clarity.`);
        } else {
          error(sid, `unknown layout type "${lay.type}" — not in registry, will render as BLANK PAGE. Check docs/bring-templates.md for valid types.`);
          continue;
        }
      }
      if (!lay.data) {
        error(sid, `layout "${lay.type}" missing "data" field`);
        continue;
      }
      const d = lay.data;
      const lt = lay.type;

      // Check required layout fields
      const reqLay = REQUIRED_LAYOUT_FIELDS[lt];
      if (reqLay) {
        for (const f of reqLay) {
          if (d[f] === undefined || d[f] === null) {
            error(sid, `layout "${lt}" missing required field "${f}"`);
          }
        }
      }

      // Check for WRONG field names (common documentation mismatches)
      const wrongFields = WRONG_FIELD_NAMES[lt];
      if (wrongFields) {
        for (const { wrong, correct, path, note } of wrongFields) {
          // Check root level
          if (d[wrong] !== undefined) {
            error(sid, `layout "${lt}" uses wrong field name "${wrong}" → should be "${correct}"${note ? ` (${note})` : ""}`);
          }
          // Check nested in left/right (comparison)
          if (path === "left/right") {
            for (const side of ["left", "right"]) {
              if (d[side] && d[side][wrong] !== undefined) {
                error(sid, `layout "${lt}" ${side}.${wrong} → should be ${side}.${correct}`);
              }
            }
          }
          // Check nested in arrays (cards[], quadrants[])
          if (path.includes("[]")) {
            const arrField = path.replace("[]", "");
            if (Array.isArray(d[arrField])) {
              for (let ai = 0; ai < d[arrField].length; ai++) {
                if (d[arrField][ai] && d[arrField][ai][wrong] !== undefined) {
                  error(sid, `layout "${lt}" ${arrField}[${ai}].${wrong} → should be ${arrField}[${ai}].${correct}${note ? ` (${note})` : ""}`);
                }
              }
            }
          }
        }
      }

      // Check extra required fields (tag, startY, from/to, etc.)
      const extraReq = EXTRA_REQUIRED[lt];
      if (extraReq) {
        for (const [fieldPath, msg] of Object.entries(extraReq)) {
          if (fieldPath.includes("[].")) {
            // Array element field check
            const [arrName, subField] = fieldPath.split("[].");
            if (Array.isArray(d[arrName])) {
              for (let ai = 0; ai < d[arrName].length; ai++) {
                if (!d[arrName][ai] || d[arrName][ai][subField] === undefined || d[arrName][ai][subField] === null || d[arrName][ai][subField] === "") {
                  error(sid, `layout "${lt}" ${arrName}[${ai}] missing "${subField}" — ${msg}`);
                }
              }
            }
          } else {
            // Root field check
            if (d[fieldPath] === undefined || d[fieldPath] === null) {
              error(sid, `layout "${lt}" missing "${fieldPath}" — ${msg}`);
            }
          }
        }
      }

      // ── 未知字段检测（validateAgainstSchema warnings）────────────
      {
        const reg = getRegistry && getRegistry();
        const tplDef = reg ? reg.list().find(t => t.name === lt) : null;
        if (tplDef && tplDef.schema) {
          const validator = getSchemaValidator();
          const result = validator(tplDef.schema, d);
          for (const w of (result.warnings || [])) {
            warn(sid, `layout "${lt}" 疑似字段拼写错误: ${w} → 可能导致空白页`);
          }
        }
      }

      // Check char limits and item counts per layout type
      switch (lt) {
        case "stepList":
          if (Array.isArray(d.steps)) {
            checkArrayItems(sid, lt, "steps", d.steps);
            for (const step of d.steps) {
              checkCharLen(sid, lt, "steps[].title", step.title);
              checkCharLen(sid, lt, "steps[].desc", step.desc);
            }
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;

        case "comparison":
          if (d.left) {
            checkCharLen(sid, lt, "left.title", d.left.title);
            if (Array.isArray(d.left.items)) {
              for (const item of d.left.items) checkCharLen(sid, lt, "left.items[]", item);
            }
          }
          if (d.right) {
            checkCharLen(sid, lt, "right.title", d.right.title);
            if (Array.isArray(d.right.items)) {
              for (const item of d.right.items) checkCharLen(sid, lt, "right.items[]", item);
            }
          }
          if (d.bottomText) checkCharLen(sid, lt, "bottomText", d.bottomText);
          break;

        case "twoColumnCards":
          if (Array.isArray(d.cards)) {
            checkArrayItems(sid, lt, "cards", d.cards);
            for (const card of d.cards) {
              checkCharLen(sid, lt, "cards[].title", card.title);
              if (typeof card.content === "string") {
                checkCharLen(sid, lt, "cards[].content", card.content);
              }
            }
          }
          break;

        case "threeColumn":
          if (Array.isArray(d.cards)) {
            checkArrayItems(sid, lt, "cards", d.cards);
            for (const card of d.cards) {
              checkCharLen(sid, lt, "cards[].title", card.title);
              if (Array.isArray(card.bullets)) {
                for (const b of card.bullets) checkCharLen(sid, lt, "cards[].bullets[]", b);
              }
            }
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;

        case "processFlow":
          if (Array.isArray(d.steps)) {
            checkArrayItems(sid, lt, "steps", d.steps);
            for (const step of d.steps) {
              checkCharLen(sid, lt, "steps[].title", step.title);
              checkCharLen(sid, lt, "steps[].desc", step.desc);
            }
          }
          break;

        case "timeline":
          if (Array.isArray(d.events)) {
            checkArrayItems(sid, lt, "events", d.events);
            for (const ev of d.events) {
              checkCharLen(sid, lt, "events[].title", ev.title || ev.year || ev.label);
              checkCharLen(sid, lt, "events[].desc", ev.desc);
            }
          }
          break;

        case "styledTable":
          if (Array.isArray(d.rows)) {
            for (const row of d.rows) {
              if (Array.isArray(row)) {
                for (const cell of row) checkCharLen(sid, lt, "cells[]", cell);
              }
            }
          }
          break;

        case "iconList":
          if (Array.isArray(d.items)) {
            checkArrayItems(sid, lt, "items", d.items);
            for (const item of d.items) {
              checkCharLen(sid, lt, "items[].title", item.title);
              checkCharLen(sid, lt, "items[].desc", item.desc);
            }
          }
          break;

        case "dataHighlight":
          if (Array.isArray(d.items)) {
            checkArrayItems(sid, lt, "items", d.items);
            for (const item of d.items) {
              checkCharLen(sid, lt, "items[].number", item.number);
              checkCharLen(sid, lt, "items[].label", item.label);
            }
          }
          break;

        case "quadrantMatrix":
          if (Array.isArray(d.quadrants)) {
            checkArrayItems(sid, lt, "quadrants", d.quadrants);
            for (const q of d.quadrants) {
              checkCharLen(sid, lt, "quadrants[].title", q.title);
              if (typeof q.content === "string") {
                checkCharLen(sid, lt, "quadrants[].content", q.content);
              }
            }
          }
          break;

        case "pyramid":
          if (Array.isArray(d.levels)) {
            checkArrayItems(sid, lt, "levels", d.levels);
            for (const lv of d.levels) {
              checkCharLen(sid, lt, "levels[].title", lv.title);
              checkCharLen(sid, lt, "levels[].desc", lv.desc);
            }
          }
          break;

        case "colorMatrix":
          if (Array.isArray(d.quadrants)) {
            checkArrayItems(sid, lt, "quadrants", d.quadrants);
            for (const q of d.quadrants) {
              checkCharLen(sid, lt, "quadrants[].title", q.title);
              if (typeof q.content === "string") {
                checkCharLen(sid, lt, "quadrants[].content", q.content);
              }
            }
          }
          break;

        case "layeredList":
          if (Array.isArray(d.layers)) {
            checkArrayItems(sid, lt, "layers", d.layers);
            for (const layer of d.layers) {
              checkCharLen(sid, lt, "layers[].title", layer.title);
              checkCharLen(sid, lt, "layers[].desc", layer.desc);
            }
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;

        case "dualPanel":
          if (Array.isArray(d.leftItems)) {
            for (const item of d.leftItems) {
              if (typeof item === "string") {
                checkCharLen(sid, lt, "leftItems[].from", item);
              } else {
                checkCharLen(sid, lt, "leftItems[].from", item.from);
                checkCharLen(sid, lt, "leftItems[].to",   item.to);
              }
            }
          }
          if (Array.isArray(d.rightItems)) {
            for (const item of d.rightItems) {
              if (typeof item === "string") {
                checkCharLen(sid, lt, "rightItems[].title", item);
              } else {
                checkCharLen(sid, lt, "rightItems[].title", item.title);
                checkCharLen(sid, lt, "rightItems[].desc",  item.desc);
              }
            }
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;

        case "moduleOverview":
          if (d.overview) checkCharLen(sid, lt, "overview", d.overview);
          if (Array.isArray(d.topics)) {
            checkArrayItems(sid, lt, "topics", d.topics);
            for (const topic of d.topics) {
              checkCharLen(sid, lt, "topics[].title", topic.title);
              checkCharLen(sid, lt, "topics[].desc", topic.desc);
            }
          }
          break;

        case "quoteEmphasis":
          checkCharLen(sid, lt, "quote", d.quote);
          checkCharLen(sid, lt, "emphasis", d.emphasis);
          if (d.emphasisSub) checkCharLen(sid, lt, "emphasisSub", d.emphasisSub);
          break;

        case "impactQuestion":
          checkCharLen(sid, lt, "question", d.question);
          checkCharLen(sid, lt, "answer", d.answer);
          break;

        case "quoteBanner":
          checkCharLen(sid, lt, "quote", d.quote);
          break;

        case "caseBox":
          checkCharLen(sid, lt, "title", d.title);
          checkCharLen(sid, lt, "content", d.content);
          break;

        case "imageText":
          if (d.title) checkCharLen(sid, lt, "title", d.title);
          if (d.content) checkCharLen(sid, lt, "content", d.content);
          break;

        case "beforeAfter":
          if (Array.isArray(d.pairs)) {
            d.pairs.forEach((p, pi) => {
              if (p.before) checkCharLen(sid, lt, "pairs[].before", p.before);
              if (p.after) checkCharLen(sid, lt, "pairs[].after", p.after);
              if (p.afterDesc) checkCharLen(sid, lt, "pairs[].afterDesc", p.afterDesc);
            });
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;

        case "cardGrid":
          if (Array.isArray(d.cards)) {
            d.cards.forEach((c, ci) => {
              if (c.title) checkCharLen(sid, lt, "cards[].title", c.title);
              if (c.desc) checkCharLen(sid, lt, "cards[].desc", c.desc);
            });
          }
          if (d.summary) checkCharLen(sid, lt, "summary", d.summary);
          break;
      }
    }
  }

  // 8. Adjacent layout uniqueness check (enhanced: compares primary layout of multi-layout pages too)
  if (index > 0 && slide.type === "content" && allSlides[index - 1].type === "content") {
    const prevLayouts = allSlides[index - 1].layouts;
    const currLayouts = slide.layouts;
    if (prevLayouts && currLayouts && prevLayouts.length > 0 && currLayouts.length > 0) {
      const prevPrimary = prevLayouts[0].type;
      const currPrimary = currLayouts[0].type;
      if (prevPrimary === currPrimary) {
        warn(sid, `adjacent slides ${allSlides[index - 1].id} and ${sid} both use "${currPrimary}" as primary layout`);
      }
    }
  }

  // 9. Multi-layout startY gap validation
  if (slide.type === "content" && slide.layouts && slide.layouts.length > 1) {
    const startYs = [];
    for (let li = 0; li < slide.layouts.length; li++) {
      const lay = slide.layouts[li];
      if (!lay.data) continue;
      const sy = lay.data.startY;
      if (li > 0 && (sy === undefined || sy === null)) {
        warn(sid, `layout[${li}] "${lay.type}" missing startY in multi-layout page (will overlap with previous layout)`);
      }
      if (typeof sy === "number") startYs.push({ idx: li, type: lay.type, y: sy });
    }
    // Check ascending order and minimum gap
    for (let si = 1; si < startYs.length; si++) {
      const prev = startYs[si - 1];
      const curr = startYs[si];
      if (curr.y <= prev.y) {
        error(sid, `layout[${curr.idx}] "${curr.type}" startY=${curr.y} ≤ previous layout[${prev.idx}] "${prev.type}" startY=${prev.y} (will overlap)`);
      } else if (curr.y - prev.y < 0.15) {
        warn(sid, `layout[${curr.idx}] "${curr.type}" startY gap only ${(curr.y - prev.y).toFixed(2)}" from previous (recommend ≥0.2")`);
      }
    }
    // Check last layout doesn't exceed safe bottom
    if (startYs.length > 0) {
      const lastY = startYs[startYs.length - 1].y;
      const safeBottom = slide.engagementQuestion ? 4.55 : 4.8;
      if (lastY > safeBottom - 0.5) {
        warn(sid, `last layout startY=${lastY} is very close to safe bottom ${safeBottom}" — risk of overflow`);
      }
    }
  }
}



module.exports = { validateSlide, CHAR, ITEMS, REQUIRED_FIELDS, REQUIRED_LAYOUT_FIELDS, getRegistry, getSchemaValidator };
