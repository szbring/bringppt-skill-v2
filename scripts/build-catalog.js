#!/usr/bin/env node
'use strict';
/**
 * scripts/build-catalog.js — 88 模板可视化目录
 *
 * 给每个模板渲染一页样本 → PDF → 缩略 PNG → 单页 HTML 目录。
 * 每模板配 when/notWhen/maxItems/category 元数据，并可点击展开看用法。
 *
 * 用法：
 *   node scripts/build-catalog.js                 # 生成 docs/catalog/index.html
 *   node scripts/build-catalog.js --skip-render   # 跳过 PDF 渲染（只刷 metadata）
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { spawnSync } = require('child_process');
const PptxGenJS = require('pptxgenjs');

const SKILL_DIR = path.resolve(__dirname, '..');
const reg = require(path.join(SKILL_DIR, 'registry'));
const { validateAgainstSchema } = require(path.join(SKILL_DIR, 'template-selector'));

const CATALOG_DIR = path.join(SKILL_DIR, 'docs', 'catalog');
fs.mkdirSync(path.join(CATALOG_DIR, 'thumbs'), { recursive: true });

const skipRender = process.argv.includes('--skip-render');

// 合成 KPs（与 contract-test 同步）
const SYNTH_KPS = [
  '阿尔法标题: 这是一个有效的描述文本足够长',
  '贝塔标题: 第二项的描述文本也足够长测试',
  '伽马标题: 第三项描述以避免触发短描述错误',
  '德尔塔标题: 第四项描述满足最小长度要求',
  '艾普西龙: 第五项描述同样有合理长度',
  '泽塔标题: 第六项描述长度合规可用',
  '伊塔标题: 第七项描述也包含足够字数',
  '西塔标题: 第八项描述用于压测多容量版式',
];
const NUMERIC_KPS = ['指标 A: 35', '指标 B: 60', '指标 C: 72', '指标 D: 88'];
const NUMERIC_TEMPLATES = new Set([
  'chartBar', 'chartLine', 'chartArea', 'chartPie', 'chartCombo', 'chartBar3D',
  'chartRadar', 'chartScatter', 'chartBubble', 'bcgMatrix', 'riskMatrix',
  'dataHighlight', 'kpiDashboard', 'achievement', 'bigNumber',
]);

const SPECIAL_KP_COUNT = {
  // 一些模板对数量敏感（L1 notWhen 严格）
  twoColumnCards: 2,
  flowerPetal:    4,
  hourglass:      4,
  threeColumn:    3,
  comparison:     4,
};

const IMG_PATH = path.join(SKILL_DIR, 'assets', 'cover-building.jpg');

function kpsFor(tplName) {
  if (NUMERIC_TEMPLATES.has(tplName)) return NUMERIC_KPS.slice(0, SPECIAL_KP_COUNT[tplName] || 4);
  if (tplName === 'bigNumber') return ['80%: 关键指标提升'];
  if (tplName === 'linkList') return ['官网: https://bring.consulting', '案例: https://bring.consulting/cases', '团队: https://bring.consulting/team'];
  const n = SPECIAL_KP_COUNT[tplName] || 5;
  return SYNTH_KPS.slice(0, n);
}

function pageFor(tplName) {
  const p = { id: `cat-${tplName}`, title: `${tplName} 示例`, keyPoints: kpsFor(tplName) };
  if (['imageGallery', 'imageText'].includes(tplName)) p.imagePath = IMG_PATH;
  return p;
}

function buildInfra() {
  const C = {
    PRIMARY: '1F3A5F', SECONDARY: '2E6FB5', ACCENT: 'D4A82F',
    SUCCESS: '5BA15B', WARNING: 'E08E45', DANGER: 'C95C3E', INFO: '4A8FBF',
    GOLD: 'D4A82F', SKY: '6FA3BF', VIOLET: '8A5CB8', GRAY: '7A8794',
    TEXT: '262626', TEXT_LIGHT: '6B7280', TEXT_MUTED: '9CA3AF',
    WHITE: 'FFFFFF', BG_LIGHT: 'F5F7FA', BG_ALT: 'EAF0F6',
    BORDER: 'CED4DA', BLUE_LIGHT: '8AB4D6', BLUE_PALE: 'D8E4F0',
  };
  return {
    C,
    STEP_COLORS: [C.PRIMARY, C.SECONDARY, C.ACCENT, C.SUCCESS, C.SKY, C.VIOLET, C.GRAY],
    FONTS: { primary: 'Microsoft YaHei', enSmall: 'Calibri', numeric: 'Calibri', monoEn: 'Consolas', serifEn: 'Georgia' },
    shadow: () => ({ type: 'outer', color: '888888', blur: 4, offset: 2, angle: 45, opacity: 0.3 }),
    calcFitFontSize: (text, w, h, base, opts) => Math.max((opts && opts.minFontSize) || 8, base || 12),
    measureCharWidth: (s, fs) => (s || '').length * fs * 0.1,
    resolveStartY: (slide, startY, dflt) => startY || dflt || 1.0,
    validateBounds: () => {},
    renderIconSvg: () => null, iconToBase64Png: () => null, ensureBrandMasters: () => {},
  };
}

async function renderAll() {
  const targets = reg.list().filter(t => !t.isPageTemplate)
    .sort((a, b) => a.name.localeCompare(b.name));

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.defineLayout({ name: 'LAYOUT_WIDE', width: 10, height: 5.625 });
  const infra = buildInfra();
  const ordered = [];

  for (const tpl of targets) {
    if (typeof tpl.fromKeyPoints !== 'function') continue;
    const page = pageFor(tpl.name);
    let data;
    try { data = tpl.fromKeyPoints(page.keyPoints, page); } catch { continue; }
    if (!data) continue;
    const { valid } = validateAgainstSchema(tpl.schema, data);
    if (!valid) continue;

    const slide = pres.addSlide();
    slide.addText(tpl.name, { x: 0.3, y: 0.15, w: 9.4, h: 0.4, fontSize: 14, color: '6B7280', bold: true });
    try { tpl.render(pres, slide, data, infra); ordered.push(tpl.name); }
    catch { /* skip */ }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bringppt-catalog-'));
  const pptxPath = path.join(tmpDir, 'all.pptx');
  await pres.writeFile({ fileName: pptxPath });

  // PPTX → PDF
  console.log('PPTX → PDF...');
  const lo = spawnSync('python3', [path.join(SKILL_DIR, 'scripts', 'soffice.py'), '--headless', '--convert-to', 'pdf', '--outdir', tmpDir, pptxPath]);
  if (lo.status !== 0) throw new Error('soffice 转 PDF 失败');

  const pdfPath = pptxPath.replace(/\.pptx$/, '.pdf');
  // PDF → PNG（每页一张缩略图）
  console.log('PDF → 缩略图...');
  spawnSync('pdftoppm', ['-r', '60', '-png', pdfPath, path.join(tmpDir, 'thumb')]);

  // 移到 docs/catalog/thumbs/<name>.png
  const thumbFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith('thumb-')).sort();
  thumbFiles.forEach((f, i) => {
    if (i >= ordered.length) return;
    const src = path.join(tmpDir, f);
    const dst = path.join(CATALOG_DIR, 'thumbs', `${ordered[i]}.png`);
    fs.copyFileSync(src, dst);
  });
  console.log(`✓ 写入 ${ordered.length} 张缩略图到 ${path.relative(process.cwd(), path.join(CATALOG_DIR, 'thumbs'))}`);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  return ordered;
}

function buildHtml(renderedNames) {
  const all = reg.list().sort((a, b) => a.name.localeCompare(b.name));
  const byCat = {};
  all.forEach(t => {
    const cat = t.isPageTemplate ? 'A 类 · 页面' : (t.category || '其他');
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(t);
  });

  const rendered = new Set(renderedNames);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>BRINGPPT 88 模板可视化目录</title>
<style>
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; margin: 0; padding: 20px 32px; color: #262626; background: #FAFBFC; }
  h1 { color: #1F3A5F; border-bottom: 3px solid #1F3A5F; padding-bottom: 8px; }
  h2 { color: #2E6FB5; margin-top: 32px; padding: 6px 12px; background: #EAF0F6; border-left: 4px solid #2E6FB5; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: box-shadow 0.15s; }
  .card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border: 1px solid #E5E7EB; background: #F5F7FA; }
  .card .placeholder { width: 100%; aspect-ratio: 16/9; background: linear-gradient(135deg, #EAF0F6, #D8E4F0); display: flex; align-items: center; justify-content: center; color: #2E6FB5; border: 1px dashed #2E6FB5; }
  .card h3 { margin: 8px 0 4px; font-size: 16px; color: #1F3A5F; }
  .card .meta { font-size: 11px; color: #6B7280; margin-bottom: 6px; }
  .card .when { font-size: 12px; color: #262626; margin: 6px 0 4px; }
  .card .notwhen { font-size: 11px; color: #9CA3AF; }
  .badge { display: inline-block; background: #1F3A5F; color: white; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-right: 4px; }
  .badge.b { background: #2E6FB5; }
  .stats { background: #1F3A5F; color: white; padding: 12px 18px; border-radius: 8px; margin-bottom: 24px; }
  .stats span { display: inline-block; margin-right: 24px; font-size: 14px; }
  .stats b { font-size: 18px; color: #D4A82F; }
  input[type="search"] { width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #CED4DA; border-radius: 6px; margin-bottom: 18px; }
</style>
</head>
<body>
<h1>BRINGPPT 88 模板可视化目录</h1>
<div class="stats">
  <span>总模板：<b>${all.length}</b></span>
  <span>已渲染：<b>${rendered.size}</b></span>
  <span>A 类页面：<b>${all.filter(t => t.isPageTemplate).length}</b></span>
  <span>B 类布局：<b>${all.filter(t => !t.isPageTemplate).length}</b></span>
  <span>生成时间：${new Date().toLocaleString('zh-CN')}</span>
</div>
<input type="search" id="filter" placeholder="🔍 搜索模板名 / 使用场景 / 分类...">
`;

  for (const [cat, items] of Object.entries(byCat)) {
    html += `<h2>${cat} (${items.length})</h2>\n<div class="grid">\n`;
    for (const t of items) {
      const u = t.usage || {};
      const tags = (u.scenarios || []).map(s => s.trigger).slice(0, 2).join(' / ') || '';
      const thumbExists = rendered.has(t.name);
      const thumb = thumbExists
        ? `<img src="thumbs/${t.name}.png" alt="${t.name}">`
        : `<div class="placeholder">${t.isPageTemplate ? 'A 类页面' : '（暂无缩略图）'}</div>`;
      html += `<div class="card" data-search="${t.name} ${cat} ${(u.when || '').replace(/"/g, '&quot;')} ${tags}">
  ${thumb}
  <h3>${t.name}</h3>
  <div class="meta">
    <span class="badge${t.isPageTemplate ? '' : ' b'}">${t.isPageTemplate ? 'A 类' : 'B 类'}</span>
    ${u.maxItems ? `max ${u.maxItems}` : ''}
    ${u.typicalHeight ? ` · ${u.typicalHeight}` : ''}
  </div>
  <div class="when"><b>用：</b>${u.when || '-'}</div>
  <div class="notwhen"><b>不用：</b>${u.notWhen || '-'}</div>
</div>\n`;
    }
    html += `</div>\n`;
  }

  html += `<script>
  const f = document.getElementById('filter');
  const cards = document.querySelectorAll('.card');
  f.addEventListener('input', () => {
    const q = f.value.trim().toLowerCase();
    cards.forEach(c => {
      const txt = (c.dataset.search || '').toLowerCase();
      c.style.display = !q || txt.includes(q) ? '' : 'none';
    });
  });
</script>
</body>
</html>
`;

  const out = path.join(CATALOG_DIR, 'index.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log(`✓ ${path.relative(process.cwd(), out)} 已生成（${all.length} 模板）`);
  return out;
}

(async () => {
  let rendered = [];
  if (skipRender) {
    // 用现有 thumbs/ 文件作为已渲染列表
    try {
      rendered = fs.readdirSync(path.join(CATALOG_DIR, 'thumbs')).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, ''));
    } catch {}
    console.log(`跳过渲染，复用 ${rendered.length} 张已有缩略图`);
  } else {
    rendered = await renderAll();
  }
  buildHtml(rendered);
})();
