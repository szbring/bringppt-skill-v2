#!/usr/bin/env node
'use strict';
/**
 * scripts/inject-fromkeypoints.js — 一次性把 fromKeyPoints 注入热门模板
 *
 * 把 storyboard-converter.js 的 god switch 里的 keyPoints→data 逻辑搬到
 * 各模板自身。注入完成后，storyboard-converter 优先调用 tpl.fromKeyPoints。
 *
 * 注入点：每个模板的 `get selfLearning() { ... },` 紧后面。
 * 已注入的模板（含 `fromKeyPoints(`）会被跳过。
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');

const ADAPTERS = {
  'data-highlight.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { extractDataHighlight } = require('../lib/keypoints-helpers');
    const items = (keyPoints || []).slice(0, 4).map(extractDataHighlight);
    return { items };
  },

`,
  'comparison.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const kps = keyPoints || [];
    const mid = Math.ceil(kps.length / 2);
    return {
      left:  { title: (page && page.leftTitle)  || '方案一', items: kps.slice(0, mid) },
      right: { title: (page && page.rightTitle) || '方案二', items: kps.slice(mid) },
      showVS: true,
      bottomText: (page && page.bottomText) || \`综合以上\${kps.length}个要点\`,
    };
  },

`,
  'two-column-cards.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { ensureVisibleText } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const mid = Math.ceil(kps.length / 2);
    const title = (page && page.title) || '';
    const left  = kps.slice(0, mid).join('\\n');
    const right = kps.slice(mid).join('\\n');
    return {
      cards: [
        { title: (page && page.leftTitle)  || '核心要点', content: ensureVisibleText(left  || kps[0], title) },
        { title: (page && page.rightTitle) || '应用方向', content: ensureVisibleText(right || kps[1], title) },
      ],
    };
  },

`,
  'icon-list.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const items = (keyPoints || []).slice(0, 5).map(kp => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { icon: null, title: t, desc: d || '' };
    });
    return { items };
  },

`,
  'process-flow.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const steps = (keyPoints || []).slice(0, 6).map(kp => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { title: t, desc: d || '' };
    });
    return { steps };
  },

`,
  'timeline.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const events = (keyPoints || []).slice(0, 6).map((kp, i) => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return { time: \`步骤\${i + 1}\`, event: t, desc: d || '' };
    });
    return { events };
  },

`,
  'chart-bar.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    const labels = kps.map((kp, i) => splitTitleDesc(kp).title || \`项目\${i + 1}\`);
    const values = kps.map(kp => {
      const m = String(kp).match(/(\\d+(?:\\.\\d+)?)/);
      return m ? parseFloat(m[1]) : 0;
    });
    return { data: [{ name: title, labels, values }], title };
  },

`,
  'styled-table.js': `  // v3.7.7: keyPoints 适配器
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const rows = (keyPoints || []).slice(0, 8).map(kp => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return [t, d || ''];
    });
    const cells = [['项目', '说明'], ...rows];
    return { cells, title: (page && page.title) || '' };
  },

`,
};

// 用正则定位每个 selfLearning getter 结束 + 紧跟的 render 起始
// pattern: `},\\n\\n  render(`
const INSERT_AT_RE = /(\}\,)(\s*\n\s*\n\s*)(render\(pres, slide, data, infra\))/;

let injected = 0, skipped = 0, missing = 0;
for (const [filename, adapter] of Object.entries(ADAPTERS)) {
  const fp = path.join(SKILL_DIR, 'templates', filename);
  if (!fs.existsSync(fp)) {
    console.log(`  ✗ missing  ${filename}`);
    missing++;
    continue;
  }
  let src = fs.readFileSync(fp, 'utf-8');
  if (/fromKeyPoints\s*\(/m.test(src)) {
    console.log(`  - skipped  ${filename}  (already has fromKeyPoints)`);
    skipped++;
    continue;
  }
  if (!INSERT_AT_RE.test(src)) {
    console.log(`  ✗ no anchor  ${filename}`);
    continue;
  }
  src = src.replace(INSERT_AT_RE, (m, brace, ws, render) => {
    return `${brace}\n\n${adapter.replace(/^/gm, '')}  ${render}`;
  });
  fs.writeFileSync(fp, src, 'utf-8');
  console.log(`  ✓ injected ${filename}`);
  injected++;
}

console.log(`\n汇总: injected ${injected}, skipped ${skipped}, missing ${missing}`);
