'use strict';
/**
 * lib/asset-resolver.js — asset library 语义引用解析
 *
 * 把 storyboard 里的语义引用解析为实际资源：
 *   - iconRef:'trending-up'    → {type, char/shape/path}
 *   - imagePath:'asset:cover'  → 绝对路径
 *   - logoRef:'bring'          → 绝对路径
 *
 * 用法：
 *   const { resolveIcon, resolvePath } = require('./lib/asset-resolver');
 *   const icon = resolveIcon('trending-up'); // → {type:'shape', shape:'RIGHT_ARROW', rotate:-30}
 *   const p    = resolvePath('asset:cover-building');
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');

let _manifest = null;
function manifest() {
  if (_manifest) return _manifest;
  try { _manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); }
  catch { _manifest = { icons: {}, photos: {}, logos: {} }; }
  return _manifest;
}

function resolveIcon(ref) {
  if (!ref) return null;
  const icons = manifest().icons || {};
  return icons[ref] || null;
}

// 解析 'asset:<key>' 形式的图片/Logo 引用为绝对路径
function resolvePath(ref) {
  if (!ref || typeof ref !== 'string') return ref;
  if (!ref.startsWith('asset:')) return ref;
  const key = ref.slice('asset:'.length);
  const m = manifest();
  const rel = (m.photos && m.photos[key]) || (m.logos && m.logos[key]);
  if (!rel) return null;
  return path.join(ROOT, rel);
}

// 按 tag 搜图标（给 outline-to-storyboard / recommend-layout 用）
function searchIcon(keyword) {
  const icons = manifest().icons || {};
  const hits = [];
  for (const [name, def] of Object.entries(icons)) {
    if (name === '_help') continue;
    if (name.includes(keyword)) { hits.push(name); continue; }
    const tags = def.tags || [];
    if (tags.some(t => t.includes(keyword) || keyword.includes(t))) hits.push(name);
  }
  return hits;
}

// 列举所有 icon
function listIcons() {
  const icons = manifest().icons || {};
  return Object.keys(icons).filter(k => k !== '_help');
}

module.exports = {
  resolveIcon,
  resolvePath,
  searchIcon,
  listIcons,
  manifest,
};
