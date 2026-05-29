'use strict';
/**
 * validators/grounding-check.js — Pillar A · 内容真实性校验（Rule 1 落地）
 *
 * 把 slides 里每条 claim 与"源文档"对齐，防 LLM 编出未在源里的事实。
 * Rule 1（内容忠实性）在此从纸面规则变成自动门禁。
 *
 * 两层校验：
 *   Layer 1 · 本地启发式（默认，0 成本）
 *     - n-gram 子串匹配：claim 切 4-字 n-gram，看是否在源文中出现
 *     - 数字精确匹配：claim 里所有数字必须在源文中出现
 *     - 命中率 < threshold → flag
 *
 *   Layer 2 · LLM 校验（可选，BRINGPPT_GROUNDING_LLM=1 启用）
 *     - 把 Layer 1 标 suspicious 的 claim 发给小模型，问"是否能在源文中找到支撑"
 *     - 用 BRINGPPT_LLM_PROVIDER=<anthropic|openai|...> 切换
 *     - 缓存按 (claimHash, sourceHash) 写到 learning/global/grounding-cache.json，
 *       同内容二次跑 0 成本
 *
 * 用法：
 *   const { runGrounding } = require('./validators/grounding-check');
 *   const result = await runGrounding(slidesData, sourceDocText, opts);
 *   → { suspicious: [{ slideIdx, claim, hitRate, layer }], summary }
 *
 * 集成：
 *   ppt-pipeline.js 在 storyboard 含 meta.sourceDocPath 时自动跑 Layer 1
 *   Layer 2 仅在显式启用时调用
 */

const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

const CACHE_PATH = path.join(__dirname, '..', 'learning', 'global', 'grounding-cache.json');

// 从 slide 抽出所有需要核对的 claim 文本
function extractClaims(slide) {
  const claims = [];
  const walk = (v, label) => {
    if (typeof v === 'string') {
      // 太短的不算 claim
      if (v.length >= 6) claims.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(item => walk(item, label));
    } else if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (['title', 'desc', 'name', 'label', 'event', 'content', 'text', 'caption', 'subtitle', 'summary'].includes(k)) {
          walk(val, k);
        }
      }
    }
  };
  if (slide.title) claims.push(slide.title);
  (slide.layouts || []).forEach(l => walk(l.data, ''));
  return [...new Set(claims)];
}

// 提取 claim 里的数字（保留单位用于精确比对）
function extractNumbers(text) {
  const out = [];
  const re = /(\d+(?:\.\d+)?)\s*(%|分钟|秒|天|月|周|年|小时|min|h|s|K|M|个|条|次|倍)?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] + (m[2] || ''));
  }
  return out;
}

// 把文本切成 4-字 n-gram（中文友好）
function ngramSet(text, n = 4) {
  const t = text.replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i <= t.length - n; i++) set.add(t.slice(i, i + n));
  return set;
}

// Layer 1 启发式：claim 的 n-gram 在源文中出现率
function heuristicHitRate(claim, sourceText) {
  const c = claim.replace(/\s+/g, '');
  if (c.length < 4) return 1.0; // 短 claim 跳过
  const grams = [...ngramSet(c, 4)];
  if (grams.length === 0) return 1.0;
  let hits = 0;
  for (const g of grams) if (sourceText.includes(g)) hits++;
  return hits / grams.length;
}

// Layer 1 启发式：claim 里的数字必须在源中出现
function numberMatch(claim, sourceText) {
  const nums = extractNumbers(claim);
  if (nums.length === 0) return { ok: true, missing: [] };
  const missing = nums.filter(n => !sourceText.includes(n));
  return { ok: missing.length === 0, missing };
}

// 缓存
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}
function saveCache(cache) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.warn('[grounding] 缓存写入失败:', e.message);
  }
}
function hashKey(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

// Layer 2: LLM provider 接口（pluggable）
async function llmGroundCheck(claim, sourceText, opts) {
  const provider = opts.provider || process.env.BRINGPPT_LLM_PROVIDER || 'stub';
  if (provider === 'stub') {
    // 默认 stub：返回 unknown 不阻断
    return { grounded: null, reason: 'stub-provider', confidence: 0 };
  }
  // 真正接 Anthropic / OpenAI 时在此插入 fetch 调用
  // 这里保持框架可扩展，但不引入网络依赖
  throw new Error(`LLM provider "${provider}" 暂未实现，请在 validators/grounding-check.js#llmGroundCheck 中扩展`);
}

async function runGrounding(slidesData, sourceText, opts = {}) {
  const {
    minHitRate    = 0.5,    // 启发式 n-gram 命中率阈值
    enableLLM     = false,  // 是否调 Layer 2
    cache         = true,
  } = opts;

  const slides = (slidesData && slidesData.slides) || [];
  const suspicious = [];
  const ngramFails = [];
  const numberFails = [];

  if (!sourceText || sourceText.length < 100) {
    return { error: '源文档过短或为空（<100 字），无法对齐', suspicious, summary: null };
  }

  const sourceHash = hashKey(sourceText.slice(0, 4000));
  const cacheStore = cache ? loadCache() : {};

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    // 只对 content slide 的 layout data 做核对（cover / section 的标题是创意文案，不算事实 claim）
    if (s.type !== 'content') continue;
    const claims = extractClaims(s);
    for (const claim of claims) {
      // v3.7.27 校准（两档严重度）：
      //   1. 含数字 → 数字必须在源里精确出现（数据捏造最严重）
      //   2. 纯文本且长度 ≥15 → 命中率 <0.2 视为重大改写，可能含编造
      //   3. 短文本（<15 字）一律放过——多半是标题/标签/段名
      const hasNumber = /\d/.test(claim);
      if (claim.length < 15 && !hasNumber) continue;

      const hit = heuristicHitRate(claim, sourceText);
      const numCheck = numberMatch(claim, sourceText);

      const failedHeuristic = hasNumber
        ? !numCheck.ok
        : hit < 0.2;
      if (!failedHeuristic) continue;

      const item = {
        slideIdx: i + 1,
        slideId:  s.id || '-',
        claim:    claim.length > 80 ? claim.slice(0, 80) + '…' : claim,
        hitRate:  Math.round(hit * 100) / 100,
        missingNumbers: numCheck.missing,
        layer:    'heuristic',
      };

      // Layer 2：只对 heuristic 标 suspicious 的 claim 发 LLM
      if (enableLLM) {
        const ck = `${hashKey(claim)}_${sourceHash}`;
        let llmResult = cacheStore[ck];
        if (!llmResult) {
          try {
            llmResult = await llmGroundCheck(claim, sourceText, opts);
            if (cache && llmResult.grounded !== null) cacheStore[ck] = llmResult;
          } catch (e) {
            llmResult = { grounded: null, reason: `llm-error: ${e.message}` };
          }
        }
        item.llm = llmResult;
        // 只有 LLM 明确判定 NOT grounded 才升级为最终 suspicious
        if (llmResult.grounded === false) {
          item.layer = 'llm-confirmed';
          suspicious.push(item);
        } else if (llmResult.grounded === true) {
          continue; // LLM 平反，跳过
        } else {
          item.layer = 'llm-unknown';
          suspicious.push(item);
        }
      } else {
        suspicious.push(item);
      }

      if (!numCheck.ok) numberFails.push(item);
      else              ngramFails.push(item);
    }
  }

  if (cache && enableLLM) saveCache(cacheStore);

  return {
    suspicious,
    summary: {
      totalSlides:         slides.length,
      totalSuspicious:     suspicious.length,
      heuristicNgramFail:  ngramFails.length,
      numberFail:          numberFails.length,
      llmEnabled:          enableLLM,
    },
  };
}

module.exports = { runGrounding, extractClaims, heuristicHitRate, numberMatch };
