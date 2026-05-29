'use strict';
/**
 * storyboard-converter.js — Phase 2.1 + Phase 2.2
 *
 * 分镜脚本 JSON (ppt-outline) → slides-data (bringppt) 转换器
 * 集成三层稳定性机制（template-selector.js）
 *
 * 核心逻辑：
 *   1. 三层稳定性机制保障版式选择准确（Phase 2.2）
 *      L1: usage.notWhen 硬性排除
 *      L2: schema 强验证
 *      L3: selfLearning.errorPatterns 历史规避
 *   2. 固定插入封面页和封底页
 *   3. 每章自动生成 sectionSlide
 *   4. keyPoints → 各版式结构化数据（智能映射）
 *
 * 用法：
 *   const { convert } = require('./storyboard-converter');
 *   const slidesData = convert(storyboard);  // storyboard 符合 storyboard-schema.md
 */

const path     = require('path');
const registry = require('./registry');
const { selectBestLayout, validateAgainstSchema, validateTemplateRuntimeConstraints } = require('./template-selector');

// ── 旧版单层 fallback 链（向后兼容保留）────────────────────────────
// v4.0.1: 已与 template-selector 的 CANDIDATE_CHAINS 对齐（chart 收口、移除已删模板）
const FALLBACK_CHAINS = {
  data:       ['dataHighlight', 'chartBar', 'styledTable', 'iconList'],
  process:    ['stepList', 'processFlow', 'timeline', 'phaseDiagram', 'iconList'],
  comparison: ['comparison', 'beforeAfter', 'twoColumnCards', 'iconList'],
  concept:    ['iconList', 'threeColumn', 'layeredList', 'cardGrid'],
  case:       ['twoColumnCards', 'caseBox', 'iconList'],
  action:     ['checklist', 'stepList', 'cardGrid', 'iconList'],
  default:    ['iconList', 'threeColumn', 'stepList', 'layeredList'],
};

// ── keyPoints → layout data 转换器 ──────────────────────────────────

/**
 * 把一个 keyPoint 字符串拆分为 {title, desc}
 * 规则：含「：」「:」时拆分，否则整个作为 title，desc 为空
 */
function splitTitleDesc(kp) {
  const m = kp.match(/^(.+?)[：:]\s*(.+)$/);
  if (m) return { title: m[1].trim(), desc: m[2].trim() };
  return { title: kp.trim(), desc: '' };
}

function ensureVisibleText(text, fallback, min = 12) {
  const value = String(text || '').trim();
  if (value.length >= min) return value;
  const base = value || String(fallback || '').trim() || '核心内容';
  return `${base}，支撑本页主题`;
}

/**
 * 从 keyPoint 提取数字+单位+标签
 * e.g. "2024年市场规模 $2000亿" → { number: '$2000亿', label: '2024年市场规模', unit: '' }
 * e.g. "年增长率 35%" → { number: '35%', label: '年增长率', unit: '%' }
 */
function extractDataHighlight(kp) {
  // 匹配百分比
  const pctMatch = kp.match(/^(.*?)(\d+(?:\.\d+)?%)/);
  if (pctMatch) {
    return { number: pctMatch[2], label: pctMatch[1].trim().replace(/[：:]\s*$/, '') || kp, unit: '' };
  }
  // 匹配带单位的数字 (¥/$等货币 或 纯数字+中文单位)
  const numMatch = kp.match(/([¥$￥]?\s*[\d,.]+\s*[亿万千百兆MB GB TB个家条项人元]+)/);
  if (numMatch) {
    const label = kp.replace(numMatch[1], '').trim().replace(/^[：:\s]+|[：:\s]+$/, '') || kp;
    return { number: numMatch[1].trim(), label, unit: '' };
  }
  // 匹配纯数字
  const bareNum = kp.match(/(\d+(?:\.\d+)?)/);
  if (bareNum) {
    const label = kp.replace(bareNum[1], '').trim() || kp;
    return { number: bareNum[1], label, unit: '' };
  }
  // 无数字，降级为文本标签
  return { number: '—', label: kp.trim(), unit: '' };
}

/**
 * 核心：将 keyPoints 转换为特定版式的数据对象
 * @param {string[]} keyPoints - 关键要点列表
 * @param {string}   layout    - 目标版式名（camelCase）
 * @param {object}   page      - 原始 page 对象（备用字段 title/details 等）
 * @returns {object} data - 可直接传给 bringppt addXxx 的 data 对象
 *
 * v3.7.7 起每个模板自带 fromKeyPoints(keyPoints, page) 适配器。
 * v4.0.x: 91/91 模板全部实现 fromKeyPoints，旧 god switch 已彻底下线。
 */
// v4.1.3 (修 N-1 总闸): 让所有 91+ 模板的 fromKeyPoints 都看到字符串形 keyPoints，
//   避免 LLM 用对象形 { title, desc } 时 String(kp) → "[object Object]" 渗到 PPT 上。
//   对象形 → "title：desc" 拼接；数字 → 字符串；保留 _raw 引用供需要的模板（如 dataHighlight
//   的 extractDataHighlight）通过 helpers 重新读取结构化字段（helpers 已支持对象形）。
//   注意：buildLayoutData 会同时把 _raw 数组挂到 page._rawKeyPoints 上以备索引访问。
function _normalizeKeyPoint(kp) {
  if (kp == null) return '';
  if (typeof kp === 'string') return _truncateLongKp(kp);
  if (typeof kp === 'number' || typeof kp === 'boolean') return String(kp);
  if (Array.isArray(kp)) return _truncateLongKp(kp.map(_normalizeKeyPoint).filter(Boolean).join(' '));
  if (typeof kp === 'object') {
    // 优先 title+desc 形式（最常见）
    const t = String(kp.title || kp.heading || kp.label || kp.name || '').trim();
    const d = String(kp.desc  || kp.description || kp.text  || kp.content || kp.detail || '').trim();
    const n = (kp.number != null || kp.value != null) ? String(kp.number || kp.value).trim() : '';
    const u = String(kp.unit || '').trim();
    if (t && d) return _truncateLongKp(n ? `${t}：${n}${u} ${d}` : `${t}：${d}`);
    if (t && n) return _truncateLongKp(`${t}：${n}${u}`);
    if (t) return _truncateLongKp(t);
    if (d) return _truncateLongKp(d);
    if (n) return `${n}${u}`;
    // 兜底：扁平 JSON 关键字段拼接
    return _truncateLongKp(Object.values(kp).filter(v => typeof v === 'string' || typeof v === 'number').join(' ').trim());
  }
  return String(kp);
}

// v4.1.4 (修 P1-5): 单条 keyPoint > 200 字时截断到 180 + "…"
//   schema warn=50 但 graceful 模式不阻断，800 字 desc 直接渲染严重溢出。
//   截断后在 INFO 日志告知用户哪里被截了（仅截断时打一次）。
const _MAX_KP_CHARS = 200;
const _TRUNC_KP_CHARS = 180;
let _truncWarnedCount = 0;
function _truncateLongKp(s) {
  if (typeof s !== 'string') return s;
  if (s.length <= _MAX_KP_CHARS) return s;
  if (_truncWarnedCount < 3) {
    console.warn(
      `[BRINGPPT] keyPoint 过长（${s.length} 字 > ${_MAX_KP_CHARS}）已截断到 ${_TRUNC_KP_CHARS} 字 + "…": "${s.slice(0, 30)}…"`
    );
    _truncWarnedCount++;
    if (_truncWarnedCount === 3) {
      console.warn(`[BRINGPPT] (后续 keyPoint 截断不再单独打日志)`);
    }
  }
  return s.slice(0, _TRUNC_KP_CHARS) + '…';
}

function buildLayoutData(keyPoints, layout, page) {
  const rawKps = keyPoints || [];
  // v4.1.3 (修 N-1): 先 normalize 为字符串数组，避免任意模板直接 String(kp) 时崩
  const kps = rawKps.map(_normalizeKeyPoint);
  const tpl = registry.get(layout);
  if (!tpl) {
    throw new Error(`[storyboard-converter] layout "${layout}" not registered (template missing or already removed)`);
  }
  if (typeof tpl.fromKeyPoints !== 'function') {
    throw new Error(`[storyboard-converter] template "${layout}" has no fromKeyPoints() — every template must implement it (no more legacy switch fallback)`);
  }
  // 把原始对象形挂到 page._rawKeyPoints 供 dataHighlight 等需要结构化字段的模板用 helpers 读取
  const pageWithRaw = Object.assign({}, page, { _rawKeyPoints: rawKps });
  // 对于 dataHighlight / kpiDashboard 这类模板，仍用 raw 对象（helpers extractDataHighlight 已支持）；
  // 其他模板用归一化的字符串数组，避免 [object Object]
  const RAW_FRIENDLY_TEMPLATES = new Set([
    'dataHighlight', 'kpiDashboard', 'achievement', 'heroStat', 'bigNumber',
    'stakeholderMap',  // v4.1.3 (修 N-9): 支持 stakeholders 数组对象
  ]);
  const useRaw = RAW_FRIENDLY_TEMPLATES.has(layout);
  const data = tpl.fromKeyPoints(useRaw ? rawKps : kps, pageWithRaw);
  if (!data || typeof data !== 'object') {
    throw new Error(`[storyboard-converter] template "${layout}".fromKeyPoints() returned non-object: ${typeof data}`);
  }
  return data;
}

// ── 向后兼容：旧版单层选择（已被三层选择器取代，保留供外部调用者兼容）──
/**
 * @deprecated 请使用 template-selector.js 的 selectBestLayout()
 * 保留是为了向后兼容，内部 convert() 已升级为三层机制
 */
function selectLayout(page) {
  const result = selectBestLayout(page, buildLayoutData);
  return result.layout;
}


// ── 主转换函数 ──────────────────────────────────────────────────────

/**
 * 将 storyboard JSON 转换为 slides-data 格式
 *
 * @param {object} storyboard  - 符合 storyboard-schema.md 的 JSON
 * @param {object} [options]
 * @param {string} [options.outputPath] - 覆盖 meta.outputPath
 * @param {boolean} [options.verbose]  - 打印版式选择日志
 * @returns {{ meta, slides }} - bringppt slides-data 格式
 */
// v4.0.3 (修 4-F): contentType-template 错用检查
// 与 template-selector L1c 的 PROCESS_TEMPLATES / DATA_TEMPLATES 互斥规则对齐
// v4.0.4: 移除已删除的 journeyMap
const PROCESS_TEMPLATES = ['stepList', 'processFlow', 'phaseDiagram', 'chainFlow', 'snakeFlow', 'waveProgression', 'staircase', 'arrowChain', 'dualTrackTimeline', 'timeline', 'timelineWithMetrics'];
const DATA_TEMPLATES    = ['dataHighlight', 'chartBar', 'kpiDashboard', 'achievement', 'heroStat', 'progressBar', 'progressRing', 'gauge'];
const COMPARISON_TEMPLATES = ['comparison', 'beforeAfter', 'hourglass', 'lineupCompare', 'productMatrix', 'twoColumnCards'];

function checkContentTypeMismatch(layoutType, contentType) {
  if (contentType === 'comparison' && PROCESS_TEMPLATES.includes(layoutType)) {
    return '流程模板装对比内容';
  }
  if (contentType === 'process' && COMPARISON_TEMPLATES.includes(layoutType)) {
    return '对比模板装流程内容（流程顺序无法表达）';
  }
  if (contentType === 'data' && (PROCESS_TEMPLATES.includes(layoutType) || ['iconList', 'cardGrid', 'twoColumnCards'].includes(layoutType))) {
    return '关键指标建议用数据型模板（dataHighlight/heroStat 等）以突出数字';
  }
  return null;
}

// v4.1.1 (修 Mi-5): dataHighlight 无数字数据时建议跳过
function hasNumericData(layoutType, data) {
  if (layoutType !== 'dataHighlight') return true;  // 仅对 dataHighlight 检查
  if (!data) return false;
  // dataHighlight 期望 stats: [{ number, label }] 或 数字字段
  const stats = data.stats || data.items || data.metrics || data.numbers;
  if (Array.isArray(stats) && stats.length) {
    const hasNum = stats.some(s => {
      const v = s && (s.number != null ? s.number : (s.value != null ? s.value : s.stat));
      return v != null && String(v).match(/\d/);
    });
    return hasNum;
  }
  return false;
}

function convert(storyboard, options = {}) {
  const { verbose = false } = options;
  const { meta = {}, chapters = [] } = storyboard;

  const slides = [];
  const conversionLog = [];

  // ── 封面页 ──────────────────────────────────────────────────────
  // v4.0.0: cover 已废弃，自动转 heroCover（左色块标题 + 右建筑大图）
  slides.push({
    id:    'cover',
    type:  'heroCover',
    title:     meta.title    || '演示文稿',
    titleEn:   meta.titleEn  || '',
    subtitle:  meta.subtitle || '',
    clientName: meta.clientName || (meta.audience || ''),
    date:      meta.date     || '',
    // v4.0.6: 不再把 author 自动 fallback 到 reporter
    //   author 是 PPTX 文件 metadata（公司），reporter 是讲师/汇报人（人名）
    //   只有 meta.reporter 显式提供时才显示讲师行
    reporter:  meta.reporter || undefined,
    image:     meta.coverImage || undefined,
  });

  // ── 自动目录页（meta.includeToc=true 且章节 ≥ 2 时生成）─────────
  // 目录项的 targetSlide 索引会在章节遍历过程中回填；这里先占位。
  let tocIndex = -1;  // 目录页在 slides 数组中的位置
  if (meta.includeToc && chapters.length >= 2) {
    tocIndex = slides.length;
    slides.push({
      id:    'toc',
      type:  'toc',
      title: '目录',
      items: chapters.map((c, i) => ({
        number:   String(i + 1).padStart(2, '0'),
        title:    c.sectionTitle || `第${c.sectionNumber || (i + 1)}章`,
        subtitle: c.sectionSubtitle || '',
        // targetSlide 占位，遍历章节时回填
      })),
    });
  }

  // ── 各章节 ──────────────────────────────────────────────────────
  for (const [chIdx, chapter] of chapters.entries()) {
    const { sectionTitle, sectionNumber, sectionSubtitle, pages = [] } = chapter;

    // v3.7.38: 章节首页若用户已显式提供 heroSection / sectionSlide 类型的首页，跳过自动 section 避免重复
    const firstPageType = (pages[0] && pages[0].type) || null;
    const userProvidesSection = ['heroSection', 'section'].includes(firstPageType);

    // 章节分隔页（仅当用户未提供时自动生成）
    // v4.0.0: section 已废弃，自动转 heroSection（左侧 220pt 章节号 + 右侧大字标题）
    const sectionSlideIdx = slides.length;  // 0-based index, +1 即为 pptxgenjs slide number
    if (!userProvidesSection) {
      slides.push({
        id:               `section-${sectionNumber}`,
        type:             'heroSection',
        sectionNumber,
        sectionTitle:     sectionTitle || `第${sectionNumber}章`,
        sectionTitleEn:   chapter.sectionTitleEn || '',
        sectionSubtitle:  sectionSubtitle || '',
        accent:           chapter.accent || undefined,
      });
    }

    // 回填目录项的 targetSlide（pptxgenjs slide 索引从 1 开始）
    if (tocIndex >= 0 && slides[tocIndex] && slides[tocIndex].items[chIdx]) {
      slides[tocIndex].items[chIdx].targetSlide = sectionSlideIdx + 1;
    }

    // 内容页
    for (const [pIdx, page] of pages.entries()) {
      let { id, title, type = 'content', keyPoints = [] } = page;

      // v4.0.0: 兼容老 storyboard 显式使用 type:'cover'/'section' 的情况
      if (type === 'cover')   type = 'heroCover';
      if (type === 'section') type = 'heroSection';

      // v4.0.5: 给每个内容页注入 chapterInfo，供 contentSlide 渲染 section footer
      const chapterInfo = {
        number:           sectionNumber,
        title:            sectionTitle || '',
        titleEn:          chapter.sectionTitleEn || '',
        pageInChapter:    pIdx + 1,
        pagesInChapter:   pages.length,
      };

      // v3.7.36: 自动透传 A 类 page.type（含新增 heroCover/heroSection/...）
      //          通过 fromKeyPoints 适配器把 page 字段转为 slide 顶层字段
      // v4.0.4 (修 4-I): type 名也允许是 B 类 layout（如 heroQuote/heroStat/heroClosing）
      //                  自动包成 content slide + 该 layout，与 ppt-pipeline 的 type 直通对称
      if (type !== 'content') {
        const tpl = registry.get(type);
        if (tpl && !tpl.isPageTemplate) {
          // B 类 layout 名当 type 用：包成 content slide + layouts
          const { id: _id, type: _t, title: _title, sectionTag: _st, keyPoints: _kp, ...layoutData } = page;
          slides.push({
            id:         id || `slide-${slides.length + 1}`,
            type:       'content',
            title,
            sectionTag: page.sectionTag,
          sourceRef: page.sourceRef,
          chapterInfo,
          variant: meta.variant,
          engagementQuestion: page.engagementQuestion,
          takeaway: page.takeaway,
            layouts:    [{ type, data: layoutData }],
            _selectorReason: `B-class layout "${type}" as page.type (auto-wrapped)`,
            _selectorSkippedLogs: [],
          });
          continue;
        }
        if (tpl && tpl.isPageTemplate) {
          let pageData = {};
          if (typeof tpl.fromKeyPoints === 'function') {
            // v4.1.3 (修 N-1): A 类页面模板同样走 normalize，避免对象形 kp 渗到 PPT
            const _normKps = (keyPoints || []).map(_normalizeKeyPoint);
            const _pageRaw = Object.assign({}, page, { _rawKeyPoints: keyPoints });
            try { pageData = tpl.fromKeyPoints(_normKps, _pageRaw) || {}; }
            catch (e) { if (verbose) console.warn(`[converter] [WARN] ${id || '?'} → ${type} 自动数据构造失败：${e.message}；建议显式提供 page 字段或检查 keyPoints 格式`); }
          }
        slides.push({
          id:   id || `slide-${slides.length + 1}`,
          type,
          ...pageData,
          // 显式 page 字段优先（如 title / subtitle / clientName 等）
          ...Object.fromEntries(Object.entries(page).filter(([k]) => !['id','type','keyPoints'].includes(k))),
          _selectorSkippedLogs: [],
        });
          continue;
      }
      }

      // v4.0.3: 若 page.layouts 显式提供，跳过 selector 直接透传
      // 用途：精确控制版式（如压测/模板画册/已成熟设计）；selector 自动选版仍是默认路径
      // v4.0.3 (修 4-C + 4-F): 直通路径上仍跑 schema + 容量 + contentType 互斥三道检查
      //                        超量/错用给 WARN 但不阻断渲染（保持向后兼容）
      if (Array.isArray(page.layouts) && page.layouts.length > 0) {
        if (verbose) {
          conversionLog.push(`  ${id || '?'} "${title}" → [explicit] ${page.layouts.map(l => l.type).join(' + ')}`);
        }
        // 三道软校验
        for (const lay of page.layouts) {
          const tpl = registry.get(lay.type);
          if (!tpl) {
            console.warn(`[converter] [WARN] ${id || '?'} → 模板 "${lay.type}" 未注册（v4 可能已软删除）；建议换为同类替代模板，如 twoColumnCards/threeColumn`);
            continue;
          }
          if (tpl.schema) {
            const { valid, errors } = validateAgainstSchema(tpl.schema, lay.data || {});
            if (!valid) console.warn(`[converter] [WARN] ${id || '?'} → ${lay.type} 数据不符 schema：${errors.slice(0, 2).join('; ')}`);
          }
          const rt = validateTemplateRuntimeConstraints(lay.type, lay.data || {});
          if (!rt.valid) console.warn(`[converter] [WARN] ${id || '?'} → ${lay.type} 数据量超容量：${rt.errors.slice(0, 2).join('; ')}；建议精简至阈值内或换更大容量模板`);
          // contentType-template 互斥 (修 4-F)
          if (page.contentType) {
            const mis = checkContentTypeMismatch(lay.type, page.contentType);
            if (mis) console.warn(`[converter] [WARN] ${id || '?'} → ${lay.type} 与 contentType="${page.contentType}" 不匹配：${mis}；建议换更贴合的模板或修正 contentType`);
          }
          // v4.1.1 (修 Mi-5): dataHighlight 无数字数据时 WARN
          if (lay.type === 'dataHighlight' && !hasNumericData(lay.type, lay.data || {})) {
            console.warn(`[converter] [WARN] ${id || '?'} → dataHighlight 但 stats 中无数字字段；建议换 cardGrid/twoColumnCards 等纯文本模板`);
          }
        }
        slides.push({
          id:         id || `slide-${slides.length + 1}`,
          type:       'content',
          title,
          sectionTag: page.sectionTag,
          sourceRef: page.sourceRef,
          chapterInfo,
          variant: meta.variant,
          engagementQuestion: page.engagementQuestion,
          takeaway: page.takeaway,
          layouts:    page.layouts,
          _selectorReason: 'explicit page.layouts',
        });
        continue;
      }

      // 普通内容页：三层稳定性选版式 + 构建数据
      // v4.1.0: 整段包 try/catch — 若三层选择 + buildLayoutData 全 fail（极罕见），
      //        降级为 insightBanner 终极兜底（页面不空白），并记录到 learning log
      let chosenLayout, layoutData, reason, skippedLogs;
      try {
        const selection = selectBestLayout(page, buildLayoutData, { verbose });
        chosenLayout = selection.layout;
        layoutData = selection.data;
        reason = selection.reason;
        skippedLogs = selection.skippedLogs;
      } catch (e) {
        // 终极降级：insightBanner + keyPoints 转纯文本
        console.warn(`[converter] [ERROR→FALLBACK] ${id || '?'} "${title}" 无可用版式：${e.message}；已降级为 insightBanner 兜底（页面不空白）；建议复查 keyPoints 数量与字段长度`);
        // v4.1.3 (修 N-3): 字段名从 text 改为 insight（insightBanner 模板要的是 insight 字段），
        //   并 stringify 对象形 keyPoints，避免 [object Object] / forEach 崩溃
        chosenLayout = 'insightBanner';
        layoutData = {
          label: 'KEY POINTS',
          insight: (keyPoints || []).map(kp => {
            if (kp && typeof kp === 'object' && !Array.isArray(kp)) {
              const t = String(kp.title || kp.label || kp.heading || '').trim();
              const d = String(kp.desc  || kp.description || kp.text || kp.content || '').trim();
              return d ? `${t}：${d}` : t;
            }
            return String(kp || '').trim();
          }).filter(Boolean).join('  ·  ').slice(0, 200) || title || '核心要点',
          style: 'minimal',
        };
        reason = `[fallback] selector 全 fail (${e.message})`;
        skippedLogs = [];
        // 记录到 learning log（best-effort，失败不影响主流程）
        try {
          const { recordError } = require('./learning-context');
          recordError && recordError({ phase: 'converter', pageId: id, title, error: e.message, layout: page.suggestedLayout });
        } catch { /* learning log 不可用时静默 */ }
      }

      if (verbose) {
        const original = page.suggestedLayout || 'auto';
        const changed  = chosenLayout !== original ? ` (fallback from ${original})` : '';
        conversionLog.push(`  ${id || '?'} "${title}" → ${chosenLayout}${changed}`);
        if (skippedLogs && skippedLogs.length) conversionLog.push(`    跳过: ${skippedLogs.join(' | ')}`);
      }

      slides.push({
        id:    id || `slide-${slides.length + 1}`,
        type:  'content',
        title,
        sectionTag: page.sectionTag,
          sourceRef: page.sourceRef,
          chapterInfo,
          variant: meta.variant,
          engagementQuestion: page.engagementQuestion,
          takeaway: page.takeaway,
        layouts: [{ type: chosenLayout, data: layoutData }],
        _selectorReason: reason,
        _selectorSkippedLogs: skippedLogs || [],
      });
    }
  }

  // ── 封底两页结构（v3.7.12）─────────────────────────────────────
  // 倒数第二页：closingQuote 金句页
  // 最后一页：backCover thank-you 页（仅 thanks + 二维码 + 联系方式）
  //
  // 用户在 meta.closingQuote 显式提供则用之；否则用合理默认。
  // 若 meta.disableClosingQuote=true，则跳过金句页（兼容老项目）。
  if (!meta.disableClosingQuote) {
    const cq = meta.closingQuote || {};
    slides.push({
      id:        'closing-quote',
      type:      'closingQuote',
      quote:     cq.quote     || meta.subtitle || '行胜于言，知行合一。',
      author:    cq.author    || meta.author   || '薄云咨询',
      source:    cq.source    || '',
      label:     cq.label     || '结语',
      labelEn:   cq.labelEn   || 'CLOSING',
    });
  }

  // 最后一页：纯 thank-you / 二维码 / 联系方式
  slides.push({
    id:       'back-cover',
    type:     'backCover',
    text:     (meta.backCover && meta.backCover.text) || '谢谢各位',
    // subtitle 留空：thank-you 页不应该重复主标题
    subtitle: (meta.backCover && meta.backCover.subtitle) || '',
    instructor: (meta.backCover && meta.backCover.instructor) || meta.author || '',
    dateLine:   (meta.backCover && meta.backCover.dateLine)   || '',
    // contact / qrCode 由模板默认值注入薄云联系方式
  });

  if (verbose && conversionLog.length) {
    console.log('\n[storyboard-converter] 版式选择：');
    conversionLog.forEach(l => console.log(l));
    console.log();
  }

  const slidesData = {
    meta: {
      title:      meta.title      || '演示文稿',
      author:     meta.author     || '薄云咨询',
      outputPath: options.outputPath || meta.outputPath || './output.pptx',
      // v4.1.9：upload_file_to_drive 契约相关 meta 字段，pipeline 末尾用于
      // 构造 OpenAPI UploadFileToDriveRequest。命名与 OpenAPI 对齐：
      //   destinationFolderId  ↔ destination_folder_id
      //   destinationFolderUrl ↔ destination_folder_url
      //   onConflict           ↔ on_conflict
      destinationFolderId:  meta.destinationFolderId  || undefined,
      destinationFolderUrl: meta.destinationFolderUrl || undefined,
      onConflict:           meta.onConflict           || undefined,
    },
    slides,
  };

  return slidesData;
}

/**
 * 转换 + 打印摘要（供调试使用）
 */
function convertWithSummary(storyboard, options = {}) {
  const result = convert(storyboard, { ...options, verbose: true });
  const { slides } = result;

  const total    = slides.length;
  const covers   = slides.filter(s => s.type === 'cover' || s.type === 'heroCover' || s.type === 'backCover').length;
  const sections = slides.filter(s => s.type === 'section' || s.type === 'heroSection').length;
  const content  = slides.filter(s => s.type === 'content').length;
  const specials = total - covers - sections - content;

  console.log(`[storyboard-converter] 转换完成:`);
  console.log(`  总页数: ${total}（封面/封底${covers} + 章节页${sections} + 内容页${content}${specials ? ` + 特殊页${specials}` : ''}）`);

  return result;
}

module.exports = { convert, convertWithSummary, selectLayout, buildLayoutData };
