'use strict';
/**
 * lib/visual-hash.js — pptx → 每页 dHash 指纹
 *
 * 用于 baseline 视觉回归：
 *   - pptx → soffice → pdf
 *   - pdf → pdftoppm → 9x8 灰度 PGM（每页一张）
 *   - 每张 PGM 的 72 个灰度 byte → 64-bit dHash 指纹（hex）
 *
 * dHash 对小幅渲染抖动（字体重排、抗锯齿）有较强容忍度，比 aHash 更适合 PPT 回归。
 *
 * 依赖：soffice (LibreOffice)、pdftoppm。
 *
 * 用法（模块）：
 *   const { hashPptx, hammingHex } = require('./lib/visual-hash');
 *   const hashes = await hashPptx('/path/to/out.pptx');
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

function tmpdir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function pptxToPdf(pptxPath, outDir) {
  const loProfile = path.join(outDir, 'lo-profile');
  const r = spawnSync('soffice', [
    `-env:UserInstallation=${pathToFileURL(loProfile).href}`,
    '--headless',
    '--convert-to', 'pdf',
    '--outdir', outDir,
    pptxPath,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`soffice convert failed: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  const base = path.basename(pptxPath, path.extname(pptxPath));
  return path.join(outDir, `${base}.pdf`);
}

function pdfToPgms(pdfPath, outDir) {
  const prefix = path.join(outDir, 'page');
  const r = spawnSync('pdftoppm', [
    '-gray',
    '-scale-to-x', '9',
    '-scale-to-y', '8',
    pdfPath,
    prefix,
  ], { encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`pdftoppm failed: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  // pdftoppm 产物：page-1.pgm, page-2.pgm, ... 或 page-01.pgm（按页数自动 zero-pad）
  return fs.readdirSync(outDir)
    .filter(f => f.startsWith('page-') && f.endsWith('.pgm'))
    .sort((a, b) => {
      const na = parseInt(a.match(/page-(\d+)/)[1], 10);
      const nb = parseInt(b.match(/page-(\d+)/)[1], 10);
      return na - nb;
    })
    .map(f => path.join(outDir, f));
}

/**
 * 读取二进制 PGM (P5)，返回 72 个 byte (9x8, 0-255)。
 */
function pgmToGray9x8(pgmPath) {
  const buf = fs.readFileSync(pgmPath);
  let offset = 0;

  function nextToken() {
    while (offset < buf.length) {
      const ch = buf[offset];
      if (ch === 0x23) {
        while (offset < buf.length && buf[offset] !== 0x0a) offset++;
      } else if (/\s/.test(String.fromCharCode(ch))) {
        offset++;
      } else {
        break;
      }
    }
    const start = offset;
    while (offset < buf.length && !/\s/.test(String.fromCharCode(buf[offset]))) offset++;
    return buf.toString('ascii', start, offset);
  }

  const magic = nextToken();
  const w = parseInt(nextToken(), 10);
  const h = parseInt(nextToken(), 10);
  const max = parseInt(nextToken(), 10);
  while (offset < buf.length && /\s/.test(String.fromCharCode(buf[offset]))) offset++;

  if (magic !== 'P5' || w !== 9 || h !== 8 || max !== 255) {
    throw new Error(`Expected P5 9x8 max=255, got ${magic} ${w}x${h} max=${max} for ${pgmPath}`);
  }
  const raw = buf.slice(offset);
  if (raw.length !== 72) {
    throw new Error(`Expected 72 bytes (9x8), got ${raw.length} bytes for ${pgmPath}`);
  }
  return raw;
}

/**
 * dHash：9x8 灰度 → 64 位（每行 8 个邻接像素对比）→ 16 字符 hex
 */
function dHashFrom9x8(gray72) {
  let bits = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const a = gray72[row * 9 + col];
      const b = gray72[row * 9 + col + 1];
      bits += (a > b) ? '1' : '0';
    }
  }
  // 64 bit → 16 hex chars
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

function hammingHex(h1, h2) {
  if (!h1 || !h2 || h1.length !== h2.length) return Infinity;
  let n = 0;
  for (let i = 0; i < h1.length; i++) {
    const x = parseInt(h1[i], 16) ^ parseInt(h2[i], 16);
    n += (x.toString(2).match(/1/g) || []).length;
  }
  return n;
}

async function hashPptx(pptxPath, opts = {}) {
  const { keepTmp = false } = opts;
  const work = tmpdir('bringppt-vhash-');
  try {
    const pdf  = pptxToPdf(pptxPath, work);
    const pgms = pdfToPgms(pdf, work);
    return pgms.map((p, i) => ({
      page: i + 1,
      hash: dHashFrom9x8(pgmToGray9x8(p)),
    }));
  } finally {
    if (!keepTmp) {
      try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
    }
  }
}

module.exports = { hashPptx, hammingHex, dHashFrom9x8, pgmToGray9x8 };
