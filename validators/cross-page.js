'use strict';
/**
 * validators/cross-page.js — Pillar D · 跨页一致性校验
 *
 * 单页校验已经覆盖 schema / visual / 内容密度。但跨页 bug 是客户提案最容易踩的坑：
 *   - 同概念用不同写法（IR vs 初始需求 vs 客户需求）
 *   - 数字前后矛盾（slide 5 写 30 分钟，slide 12 写 30 秒）
 *   - 章节页标题与该章节内容主题不匹配
 *   - 相邻 slide 用同一 layout 视觉单调
 *   - 全 PPT 出现重复标题
 *
 * 用法（validate-slides.js 已自动加载）：
 *   const { run } = require('./validators/cross-page');
 *   run(slidesData) → { errors[], warnings[], info[] }
 */

// 同义词词典——可被 page.terminology 覆盖（项目级）
const DEFAULT_TERMS = {
  'IR':       ['IR', '初始需求', '客户需求', '原始需求'],
  'SR':       ['SR', '系统需求', '产品需求'],
  'AR':       ['AR', '分配需求', '专业需求'],
  'DFX':      ['DFX', 'Design for X'],
  'DFM':      ['DFM', '可制造性'],
  'DFT':      ['DFT', '可测试性'],
  'DFA':      ['DFA', '可装配性'],
  'DFS':      ['DFS', '可服务性'],
};

// 抽取数字+单位（如 30 分钟、3-5 天、95%、≥70%）
const NUM_RE = /(\d+(?:\.\d+)?)\s*(分钟|秒|天|月|周|年|小时|h|min|s|%|个工作日|工作日)/g;

function gatherTexts(slide) {
  const texts = [];
  if (slide.title) texts.push(slide.title);
  if (slide.sectionTitle) texts.push(slide.sectionTitle);
  const walk = v => {
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  (slide.layouts || []).forEach(l => walk(l.data));
  return texts;
}

function checkTerminologyConsistency(slides, terms, errors, warnings) {
  // 统计每个标准词的同义词命中分布
  const usage = {};
  for (const canonical of Object.keys(terms)) {
    usage[canonical] = {};
  }
  slides.forEach((s, idx) => {
    const text = gatherTexts(s).join(' ');
    for (const [canonical, syns] of Object.entries(terms)) {
      syns.forEach(syn => {
        const re = new RegExp(syn, 'g');
        const m = text.match(re);
        if (m) {
          usage[canonical][syn] = (usage[canonical][syn] || 0) + m.length;
          if (!usage[canonical]._slides) usage[canonical]._slides = {};
          usage[canonical]._slides[syn] = usage[canonical]._slides[syn] || [];
          usage[canonical]._slides[syn].push(idx + 1);
        }
      });
    }
  });

  for (const [canonical, dist] of Object.entries(usage)) {
    const seen = Object.keys(dist).filter(k => k !== '_slides');
    if (seen.length <= 1) continue;
    // 混用 → warning
    const summary = seen.map(s => `${s}(${dist[s]})`).join(' / ');
    const slidesInvolved = [...new Set(
      seen.flatMap(s => (dist._slides && dist._slides[s]) || []).sort((a, b) => a - b)
    )].slice(0, 8);
    warnings.push(`[术语混用] 同一概念混用了 ${seen.length} 种写法：${summary}。涉及 slides: ${slidesInvolved.join(', ')}。建议统一用 "${canonical}"`);
  }
}

function checkNumericConsistency(slides, warnings) {
  // 收集所有"键 → 出现的值"，若同一前置词出现 ≥2 个不同值 → 标
  const ctx = {};
  slides.forEach((s, idx) => {
    const texts = gatherTexts(s);
    texts.forEach(t => {
      // 找前置短语，简化版：取数字前 4-8 字符作为 key
      let m;
      const re = new RegExp(NUM_RE, 'g');
      while ((m = re.exec(t)) !== null) {
        const before = t.slice(Math.max(0, m.index - 6), m.index).replace(/[\s,，。；;:：]/g, '').slice(-6);
        if (!before || before.length < 2) continue;
        const key = `${before}_${m[2]}`;
        if (!ctx[key]) ctx[key] = {};
        const val = m[1];
        ctx[key][val] = ctx[key][val] || [];
        ctx[key][val].push(idx + 1);
      }
    });
  });

  for (const [key, vals] of Object.entries(ctx)) {
    const distinct = Object.keys(vals);
    if (distinct.length < 2) continue;
    const total = Object.values(vals).reduce((s, arr) => s + arr.length, 0);
    if (total < 2) continue;
    const [, unit] = key.split('_');
    const before = key.replace(`_${unit}`, '');
    const detail = distinct.map(v => `${v}${unit}@slides ${vals[v].slice(0, 3).join(',')}`).join(' vs ');
    warnings.push(`[数字不一致] "${before}" 出现 ${distinct.length} 个不同数值：${detail}`);
  }
}

function checkDuplicateTitles(slides, warnings) {
  const titleMap = {};
  slides.forEach((s, idx) => {
    if (!s.title || s.type === 'section' || s.type === 'cover' || s.type === 'toc') return;
    const t = s.title.trim();
    if (t.length < 3) return;
    titleMap[t] = titleMap[t] || [];
    titleMap[t].push(idx + 1);
  });
  for (const [t, idxs] of Object.entries(titleMap)) {
    if (idxs.length > 1) {
      warnings.push(`[重复标题] "${t.slice(0, 30)}" 出现 ${idxs.length} 次：slides ${idxs.join(', ')}`);
    }
  }
}

function checkAdjacentSameLayout(slides, warnings) {
  for (let i = 1; i < slides.length; i++) {
    const a = slides[i - 1], b = slides[i];
    if (a.type !== 'content' || b.type !== 'content') continue;
    const aL = (a.layouts || []).map(l => l.type).join(',');
    const bL = (b.layouts || []).map(l => l.type).join(',');
    if (!aL || !bL || aL !== bL) continue;
    warnings.push(`[相邻同 layout] slide ${i} 和 ${i + 1} 都用 "${aL}"，建议交替版式避免视觉单调`);
  }
}

function checkSectionTopicAlignment(slides, warnings) {
  // 找每个 section 及其后续 content slides，看 section 标题关键词是否出现在 content 标题里
  let currentSection = null;
  let sectionContents = [];
  const flush = () => {
    if (!currentSection || sectionContents.length === 0) return;
    const secWords = (currentSection.sectionTitle || '').match(/[一-龥A-Za-z]+/g) || [];
    if (secWords.length === 0) return;
    const matchedCount = sectionContents.filter(c => {
      const ctxt = (c.title || '') + ' ' + JSON.stringify(c.layouts || '').slice(0, 500);
      return secWords.some(w => w.length >= 2 && ctxt.includes(w));
    }).length;
    const rate = matchedCount / sectionContents.length;
    if (rate < 0.3) {
      warnings.push(`[章节-内容主题不齐] "${currentSection.sectionTitle}" 章节下 ${sectionContents.length} 页只有 ${matchedCount} 页（${Math.round(rate * 100)}%）包含章节关键词`);
    }
  };
  slides.forEach(s => {
    if (s.type === 'section') {
      flush();
      currentSection = s;
      sectionContents = [];
    } else if (s.type === 'content' && currentSection) {
      sectionContents.push(s);
    }
  });
  flush();
}

function run(slidesData, opts = {}) {
  const slides = (slidesData && slidesData.slides) || [];
  const meta   = (slidesData && slidesData.meta)   || {};
  const errors = [], warnings = [], info = [];

  if (slides.length < 2) return { errors, warnings, info };

  const terms = Object.assign({}, DEFAULT_TERMS, meta.terminology || {});
  checkTerminologyConsistency(slides, terms, errors, warnings);
  checkNumericConsistency(slides, warnings);
  checkDuplicateTitles(slides, warnings);
  checkAdjacentSameLayout(slides, warnings);
  checkSectionTopicAlignment(slides, warnings);

  info.push(`[CROSS-PAGE] 跨页一致性扫描完成：${errors.length} ERROR / ${warnings.length} WARN`);
  return { errors, warnings, info };
}

module.exports = { run };
