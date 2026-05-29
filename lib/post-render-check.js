'use strict';
/**
 * Post-render sanity checks for generated PPTX files.
 *
 * Uses JSZip so ChatGPT Agent Builder does not need a platform `unzip`
 * binary or the undeclared `yauzl` dependency.
 */
const fs = require('fs');
const JSZip = require('jszip');

const TEXT_FIELDS = new Set([
  'title', 'desc', 'description', 'label', 'name', 'text', 'content',
  'caption', 'subtitle', 'summary', 'event', 'year', 'condition', 'outcome',
  'centerLabel', 'centerTitle', 'sectionTitle', 'period', 'phase', 'step',
]);

function collectTextValues(data, acc = []) {
  if (!data) return acc;
  if (typeof data === 'string') return acc;
  if (Array.isArray(data)) {
    data.forEach(item => collectTextValues(item, acc));
    return acc;
  }
  if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') {
        if (TEXT_FIELDS.has(k) && v.length >= 2) acc.push(v);
      } else if (typeof v === 'object') {
        collectTextValues(v, acc);
      }
    }
  }
  return acc;
}

async function extractAllSlideTexts(pptxPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));
  const slideEntries = Object.keys(zip.files)
    .map((name) => {
      const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/);
      return m ? { name, idx: Number(m[1]) - 1 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.idx - b.idx);

  const slidesByIdx = [];
  for (const entry of slideEntries) {
    const xml = await zip.file(entry.name).async('string');
    const texts = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let mm;
    while ((mm = re.exec(xml)) !== null) {
      if (mm[1].trim()) texts.push(mm[1]);
    }
    slidesByIdx[entry.idx] = texts;
  }
  return slidesByIdx.map((x) => x || []);
}

const GRAPHIC_HEAVY_LAYOUTS = new Set([
  'chartBar', 'chartRadar', 'chartBubble', 'chartScatter',
  'progressRing', 'gauge', 'sankeyDiagram', 'tornadoChart',
  'freeform',
]);

async function checkPostRender(pptxPath, slides, opts = {}) {
  const { minBlocks = 5, minChars = 30 } = opts;
  const allTexts = await extractAllSlideTexts(pptxPath);
  const suspicious = [];

  slides.forEach((s, idx) => {
    if (s.type !== 'content') return;
    const layouts = (s.layouts || []).map(l => l.type);
    if (layouts.some(t => GRAPHIC_HEAVY_LAYOUTS.has(t))) return;

    const texts = allTexts[idx] || [];
    const blockCount = texts.length;
    const charCount = texts.reduce((sum, t) => sum + t.length, 0);

    if (blockCount <= minBlocks && charCount <= minChars) {
      suspicious.push({
        slideIdx: idx + 1,
        slideId: s.id,
        layouts: layouts.join(','),
        blockCount,
        charCount,
        hint: 'rendered slide has very little text; possible field mismatch or silent render failure',
      });
    }
  });

  return { ok: suspicious.length === 0, suspicious };
}

module.exports = { checkPostRender, collectTextValues, extractAllSlideTexts };
