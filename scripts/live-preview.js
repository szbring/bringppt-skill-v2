#!/usr/bin/env node
'use strict';
/**
 * scripts/live-preview.js — storyboard.json 实时预览
 *
 * 监听 storyboard.json 变化，每次保存自动：
 *   1. 重跑 pipeline（带 --skip-validate 加速）
 *   2. PPTX → PDF → 每页 PNG 缩略图
 *   3. 浏览器自动刷新看新版
 *
 * 用法：
 *   node scripts/live-preview.js --input storyboard.json
 *   node scripts/live-preview.js --input storyboard.json --port 4321
 *
 * 浏览器打开 http://localhost:4321 看实时刷新。
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const os   = require('os');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
function arg(flag, fb) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fb; }

const inputPath = arg('--input');
const port      = parseInt(arg('--port', '4321'));

if (!inputPath) {
  console.error('用法: node scripts/live-preview.js --input storyboard.json [--port 4321]');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
const SKILL_DIR = path.resolve(__dirname, '..');
const WORK_DIR  = fs.mkdtempSync(path.join(os.tmpdir(), 'bringppt-live-'));
console.log(`工作目录: ${WORK_DIR}`);
console.log(`监听文件: ${absInput}`);

let busy = false;
let pending = false;
let lastRender = null;
let lastError  = null;

async function renderOnce() {
  if (busy) { pending = true; return; }
  busy = true;
  const t0 = Date.now();
  try {
    const pptxPath = path.join(WORK_DIR, 'preview.pptx');

    // 跑 pipeline（用 --skip-validate 加速，关学习写入避免噪音）
    const pipe = spawnSync('node', [
      path.join(SKILL_DIR, 'ppt-pipeline.js'),
      '--input',       absInput,
      '--output',      pptxPath,
      '--project-dir', WORK_DIR,
      '--skip-validate',
      '--no-learn',
      '--graceful',
    ], { encoding: 'utf-8' });

    if (pipe.status !== 0) {
      lastError = (pipe.stderr || pipe.stdout || '').slice(-2000);
      console.error('[pipeline] 失败:', lastError.split('\n').slice(-3).join('\n'));
      busy = false;
      if (pending) { pending = false; renderOnce(); }
      return;
    }

    // PPTX → PDF
    const lo = spawnSync('python3', [
      path.join(SKILL_DIR, 'scripts', 'soffice.py'),
      '--headless', '--convert-to', 'pdf', '--outdir', WORK_DIR, pptxPath,
    ], { encoding: 'utf-8' });
    if (lo.status !== 0) {
      lastError = '[soffice] PDF 转换失败:\n' + (lo.stderr || '').slice(-500);
      console.error(lastError);
      busy = false;
      if (pending) { pending = false; renderOnce(); }
      return;
    }

    // PDF → PNG 缩略图（清掉旧的）
    const pdfPath = pptxPath.replace(/\.pptx$/, '.pdf');
    // 清理旧 PNG
    fs.readdirSync(WORK_DIR).forEach(f => {
      if (f.startsWith('thumb-') && f.endsWith('.png')) {
        try { fs.unlinkSync(path.join(WORK_DIR, f)); } catch {}
      }
    });
    const pp = spawnSync('pdftoppm', ['-r', '60', '-png', pdfPath, path.join(WORK_DIR, 'thumb')], { encoding: 'utf-8' });
    if (pp.status !== 0) {
      lastError = '[pdftoppm] 失败:\n' + (pp.stderr || '').slice(-500);
      console.error(lastError);
      busy = false;
      if (pending) { pending = false; renderOnce(); }
      return;
    }

    const thumbs = fs.readdirSync(WORK_DIR).filter(f => f.startsWith('thumb-') && f.endsWith('.png')).sort();
    lastRender = { thumbs, ts: Date.now(), duration: Date.now() - t0 };
    lastError = null;
    console.log(`[render] ${thumbs.length} 页 / ${lastRender.duration}ms`);
  } catch (e) {
    lastError = '[render] 异常: ' + e.message;
    console.error(lastError);
  }
  busy = false;
  if (pending) { pending = false; renderOnce(); }
}

// 监听 storyboard.json 变化
let debounceTimer = null;
fs.watch(absInput, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => renderOnce(), 200);
});

// 首次渲染
renderOnce();

// HTTP 服务
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>BRINGPPT Live Preview</title>
<style>
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; margin: 0; background: #F3F4F6; }
  header { position: sticky; top: 0; background: #1F3A5F; color: white; padding: 12px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: space-between; z-index: 10; }
  header h1 { margin: 0; font-size: 16px; font-weight: 500; }
  header .meta { font-size: 12px; opacity: 0.8; }
  header .status { padding: 4px 10px; border-radius: 4px; font-size: 12px; }
  header .status.ok { background: #5BA15B; }
  header .status.err { background: #C95C3E; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 20px; }
  .slide { background: white; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); overflow: hidden; }
  .slide img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; background: #EEE; }
  .slide .idx { padding: 6px 10px; font-size: 12px; color: #6B7280; }
  .error { padding: 20px; margin: 20px; background: #FEE2E2; border-left: 4px solid #C95C3E; color: #991B1B; font-family: monospace; white-space: pre-wrap; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>BRINGPPT Live Preview · ${path.basename(absInput)}</h1>
  <span class="meta" id="meta">连接中...</span>
</header>
<div id="container"></div>
<script>
async function poll() {
  try {
    const r = await fetch('/state');
    const s = await r.json();
    const meta = document.getElementById('meta');
    const cont = document.getElementById('container');
    if (s.error) {
      meta.textContent = '⚠ 渲染失败';
      meta.className = 'status err';
      cont.innerHTML = '<div class="error">' + s.error.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</div>';
    } else if (s.render) {
      meta.textContent = s.render.thumbs.length + ' 页 · ' + s.render.duration + 'ms · ' + new Date(s.render.ts).toLocaleTimeString();
      meta.className = 'status ok';
      if (window._lastTs !== s.render.ts) {
        window._lastTs = s.render.ts;
        cont.innerHTML = '<div class="grid">' + s.render.thumbs.map((t, i) =>
          '<div class="slide"><img src="/thumb?f=' + encodeURIComponent(t) + '&v=' + s.render.ts + '"><div class="idx">slide ' + (i+1) + '</div></div>'
        ).join('') + '</div>';
      }
    } else {
      meta.textContent = '渲染中...';
    }
  } catch (e) { /* 忽略 */ }
}
poll();
setInterval(poll, 1500);
</script>
</body></html>`);
    return;
  }
  if (req.url === '/state') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ render: lastRender, error: lastError }));
    return;
  }
  if (req.url.startsWith('/thumb')) {
    const url = new URL(req.url, 'http://localhost');
    const f = url.searchParams.get('f');
    if (!f || !/^thumb-[\d-]+\.png$/.test(f)) { res.statusCode = 404; return res.end(); }
    const p = path.join(WORK_DIR, f);
    if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', 'image/png');
    fs.createReadStream(p).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end();
});

server.listen(port, () => {
  console.log(`\n📺 Live preview 已启动：http://localhost:${port}`);
  console.log(`   编辑 ${path.basename(absInput)} 后保存——浏览器 1-2 秒后自动刷新`);
  console.log(`   按 Ctrl+C 退出\n`);
});
