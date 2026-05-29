'use strict';
/**
 * lib/keypoints-helpers.js — 模板 fromKeyPoints 适配器共用工具
 *
 * 历史：这些工具原本散落在 storyboard-converter.js 的 856 行 god switch 里。
 * v3.7.7 起：每个模板自带 fromKeyPoints(keyPoints, page)，需要共用工具时 require 这里。
 * storyboard-converter 退化为：优先调用 tpl.fromKeyPoints；fallback 走老 switch（仍保留作为兜底）。
 */

/**
 * 把一个 keyPoint 字符串拆分为 {title, desc}
 * 规则：含「：」「:」时拆分，否则整个作为 title，desc 为空
 *
 * v4.1.3 (修 N-1): 支持对象形 keyPoints { title, desc }（LLM 高频写法）
 *   之前 String(kp) 处理对象会得到 "[object Object]" 写到 PPT 上。
 */
function splitTitleDesc(kp) {
  if (kp && typeof kp === 'object' && !Array.isArray(kp)) {
    return {
      title: String(kp.title || kp.heading || kp.label || kp.name || '').trim(),
      desc:  String(kp.desc  || kp.description || kp.text  || kp.content || kp.detail || '').trim(),
    };
  }
  const m = String(kp || '').match(/^(.+?)[：:]\s*(.+)$/);
  if (m) return { title: m[1].trim(), desc: m[2].trim() };
  return { title: String(kp || '').trim(), desc: '' };
}

/**
 * 保证字符串至少 min 字符；不足时拼接 fallback 与提示语，防止生成 0 字段被 schema 拒绝。
 *
 * v4.1.3 (修 N-1): 对象形输入优先取 text/desc/value/title 字段，避免 [object Object]
 */
function ensureVisibleText(text, fallback, min = 12) {
  let value;
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    value = String(text.text || text.desc || text.value || text.title || text.label || text.content || '').trim();
  } else {
    value = String(text || '').trim();
  }
  if (value.length >= min) return value;
  const base = value || String(fallback || '').trim() || '核心内容';
  return `${base}，支撑本页主题`;
}

/**
 * 从 keyPoint 提取数字 + 短 label + 长 desc（dataHighlight / kpiDashboard 用）
 *
 * v4.0.6: 三段式拆分（之前两段式导致 label 过长被截断）
 *   - 冒号前 (≤12 字) → label (短关键词)
 *   - 数字 (优先 % > 单位 > 纯数字) → number
 *   - 剩余完整内容 → desc (长描述，由模板做字号自适应 / wrap)
 *
 * v4.1.3 (修 N-1): 对象形 { number, label, unit, desc } 直接返回，不走字符串解析路径
 */
function extractDataHighlight(kp) {
  if (kp && typeof kp === 'object' && !Array.isArray(kp)) {
    return {
      number: String(kp.number || kp.value || kp.stat || kp.num || '—').trim(),
      label:  String(kp.label  || kp.title || kp.name  || '').trim(),
      unit:   String(kp.unit   || '').trim(),
      desc:   String(kp.desc   || kp.description || kp.text || kp.content || '').trim(),
    };
  }

  let label = '';
  let body  = String(kp || '').trim();

  // 冒号拆分（中英文）
  const colonMatch = body.match(/^(.{1,12})[：:]\s*(.+)$/);
  if (colonMatch) {
    label = colonMatch[1].trim();
    body  = colonMatch[2].trim();
  }

  // 抽数字：优先百分比 > 带单位 > 纯数字
  let number = '—';
  const pctMatch  = body.match(/(\d+(?:\.\d+)?%)/);
  const unitMatch = !pctMatch && body.match(/([¥$￥]?\s*[\d,.]+\s*[亿万千百兆个家条项人元]+)/);
  const bareNum   = !pctMatch && !unitMatch && body.match(/(\d+(?:\.\d+)?)/);
  const m = pctMatch || unitMatch || bareNum;
  if (m) number = m[1].trim();

  if (!label) {
    // 无冒号兜底：从 body 头部取短 label，剩余继续作 desc
    label = body.slice(0, 8);
  }

  return { number, label, unit: '', desc: body };
}

/**
 * v4.1.8 (修 P1-E): 把语义颜色关键字映射为 hex
 *   gauge / kpiDashboard / riskMatrix / heatMap 等模板的 zones.color 字段
 *   LLM 高频写 "green/orange/red/blue/gray"，pptxgenjs 只认 hex
 *   传入 hex 或 #hex 时原样返回。
 */
function normalizeColor(input, fallback) {
  if (input == null) return fallback;
  const s = String(input).trim().replace(/^#/, '');
  // hex 直接返回（兼容 3 位 / 6 位）
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  if (/^[0-9A-Fa-f]{3}$/.test(s)) return s.toUpperCase();
  const map = {
    green:   '2D7A4A',
    success: '2D7A4A',
    ok:      '2D7A4A',
    safe:    '2D7A4A',
    orange:  'D97706',
    warning: 'D97706',
    warn:    'D97706',
    amber:   'D97706',
    yellow:  'D97706',
    red:     'C92A2A',
    danger:  'C92A2A',
    error:   'C92A2A',
    critical:'C92A2A',
    blue:    '1F4E79',
    info:    '1F4E79',
    primary: '1F4E79',
    gray:    '999999',
    grey:    '999999',
    neutral: '999999',
    purple:  '8B5CF6',
    pink:    'EC4899',
    teal:    '14B8A6',
    black:   '000000',
    white:   'FFFFFF',
  };
  const k = s.toLowerCase();
  return map[k] || fallback;
}

module.exports = { splitTitleDesc, ensureVisibleText, extractDataHighlight, normalizeColor };
