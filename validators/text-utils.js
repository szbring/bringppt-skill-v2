'use strict';
/**
 * validators/text-utils.js — 文本工具函数（v3.7.5 首付从 validate-slides.js 抽出）
 *
 * 这是把 validate-slides.js 1814 行 god module 分拆的第一步。
 * 后续会按 validators/README.md 的计划继续拆。
 */

/**
 * 计算字符串的"视觉长度"。
 * 把换行符当 0 字符（不算"占位"），中英文都按 1 字符计。
 * 用于 schema 中的 warn/error 字数阈值检查。
 *
 * @param {string} s
 * @returns {number}
 */
function textLen(s) {
  if (typeof s !== 'string') return 0;
  return s.replace(/\n/g, '').length;
}

/**
 * 递归遍历对象，收集所有 key 名包含 "color" 的字段值。
 * 用于检测模板数据里直接写死颜色（应该用 C.PRIMARY 等品牌色键名）。
 *
 * @param {object} obj
 * @param {string} [path]  调试路径
 * @returns {Array<{path: string, value: string}>}
 */
function findColorValues(obj, path = '') {
  const results = [];
  if (!obj || typeof obj !== 'object') return results;
  for (const [key, val] of Object.entries(obj)) {
    const p = path ? `${path}.${key}` : key;
    if (typeof val === 'string' && /color/i.test(key)) {
      results.push({ path: p, value: val });
    } else if (typeof val === 'object') {
      results.push(...findColorValues(val, p));
    }
  }
  return results;
}

module.exports = { textLen, findColorValues };
