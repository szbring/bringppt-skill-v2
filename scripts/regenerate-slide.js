#!/usr/bin/env node
'use strict';
/**
 * scripts/regenerate-slide.js — 单页快速重生成
 *
 * 思路：
 *   1. 读取已有 slides-data.json（含上次生成所有 slide 数据）
 *   2. 用户指定要重生成的 slide id 或 index
 *   3. 用 pptxgenjs 单独生成一份「只含目标 slide」的 PPTX
 *   4. 用 zip 工具把这一页的 slideN.xml 抽出来，替换原 PPTX 里对应位置
 *
 * 限制：
 *   - 适合不改 slide 数量、不改 layout structure 的微调（改文字、数字等）
 *   - 添加/删除 slide 仍需走完整 pipeline
 *
 * 用法：
 *   node scripts/regenerate-slide.js \
 *     --base output.pptx \
 *     --slides-data _temp/pipeline-work/_temp/slides-data.json \
 *     --slide-id p-3-2 \
 *     --output output-v2.pptx
 *
 *   修改 slides-data.json 后跑此命令，<1 秒拿到只改了那一页的新 PPTX。
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const PptxGenJS = require('pptxgenjs');
const JSZip = require('jszip');

const args = process.argv.slice(2);
function arg(flag, fb) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fb; }

const basePath   = arg('--base');
const dataPath   = arg('--slides-data');
const slideId    = arg('--slide-id');
const slideIdxArg= arg('--slide-index');
const outPath    = arg('--output');

if (!basePath || !dataPath || (!slideId && !slideIdxArg) || !outPath) {
  console.error('用法: regenerate-slide.js --base output.pptx --slides-data _temp/.../slides-data.json --slide-id p-3-2 --output v2.pptx');
  process.exit(1);
}

const slidesData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const meta   = slidesData.meta || {};
const slides = slidesData.slides || [];

let targetIdx;
if (slideIdxArg) targetIdx = parseInt(slideIdxArg) - 1;
else targetIdx = slides.findIndex(s => s.id === slideId);

if (targetIdx < 0 || targetIdx >= slides.length) {
  console.error(`找不到 slide id="${slideId}" 或 index=${slideIdxArg}`);
  process.exit(1);
}

const target = slides[targetIdx];
console.log(`目标 slide ${targetIdx + 1}: ${target.id} (${target.type}${target.layouts ? ' / ' + target.layouts.map(l=>l.type).join(',') : ''})`);

// 用现有 generatePptx 重新生成一份"只含目标 slide"的 PPTX
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bringppt-regen-'));
const singlePptx = path.join(tmpDir, 'single.pptx');

(async () => {
  // 复用 pipeline 的 generatePptx，但 slides 只包含目标这一页
  const SKILL_DIR = path.resolve(__dirname, '..');
  const pipeline  = require(path.join(SKILL_DIR, 'ppt-pipeline'));
  // pipeline.generatePptx 是导出的——直接调
  if (typeof pipeline.generatePptx !== 'function') {
    console.error('ppt-pipeline.generatePptx 未导出，无法调用');
    process.exit(1);
  }
  await pipeline.generatePptx([target], meta, singlePptx);
  console.log(`单页 PPTX 已生成: ${singlePptx}`);

  const baseZip = await JSZip.loadAsync(fs.readFileSync(basePath));
  const singleZip = await JSZip.loadAsync(fs.readFileSync(singlePptx));
  const sourceSlide = singleZip.file('ppt/slides/slide1.xml');
  if (!sourceSlide) {
    console.error('single-slide PPTX missing ppt/slides/slide1.xml');
    process.exit(1);
  }
  const targetSlideName = `ppt/slides/slide${targetIdx + 1}.xml`;
  baseZip.file(targetSlideName, await sourceSlide.async('string'));
  const out = await baseZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(outPath, out);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  console.log(`✅ 已生成: ${outPath}`);
  console.log(`   只重渲染了 slide ${targetIdx + 1} (${target.id})`);
})();
