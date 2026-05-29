#!/usr/bin/env node
'use strict';
/**
 * scripts/inject-remaining-fromkeypoints.js — 把剩余 23 个模板（15 咨询框架 + 8 A 类页面）补上 fromKeyPoints。
 * v3.7.10 后：模板自带 fromKeyPoints 覆盖率从 66/89 → 89/89。
 *
 * 用法：
 *   node scripts/inject-remaining-fromkeypoints.js --dry-run
 *   node scripts/inject-remaining-fromkeypoints.js
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

// helper alias for clarity
const HELPERS = `    const { splitTitleDesc } = require('../lib/keypoints-helpers');`;

const ADAPTERS = {
  // ── B 类咨询框架（15 个）────────────────────────────────
  'ansoff-matrix.js': `${HELPERS}
    const kps = keyPoints || [];
    const t = arr => arr.map(s => splitTitleDesc(s).title || s);
    const n = Math.ceil(kps.length / 4) || 1;
    return {
      initiatives: {
        penetration: t(kps.slice(0, n)),
        productDev:  t(kps.slice(n, 2 * n)),
        marketDev:   t(kps.slice(2 * n, 3 * n)),
        diversify:   t(kps.slice(3 * n)),
      },
      title: (page && page.title) || '',
    };`,

  'arrow-chain.js': `${HELPERS}
    const kps = keyPoints || [];
    const items = kps.slice(0, 6).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      return { title, subtitle: desc || '' };
    });
    return { items, title: (page && page.title) || '' };`,

  'bcg-matrix.js': `${HELPERS}
    const kps = keyPoints || [];
    // 每行 keyPoint 形如 "名称: share/growth"，缺失时降级用 0
    const businesses = kps.slice(0, 6).map((kp, i) => {
      const { title: name, desc } = splitTitleDesc(kp);
      const nums = (desc || '').match(/-?\\d+(?:\\.\\d+)?/g) || [];
      return {
        name: name || \`业务\${i + 1}\`,
        share:  nums[0] !== undefined ? parseFloat(nums[0]) : 1,
        growth: nums[1] !== undefined ? parseFloat(nums[1]) : 10,
      };
    });
    return { businesses, title: (page && page.title) || '' };`,

  'big-number.js': `${HELPERS}
    const kps = keyPoints || [];
    const { title: num, desc } = splitTitleDesc(kps[0] || '');
    return {
      number: num || ((page && page.title) || '—'),
      label:  desc || ((page && page.subtitle) || ''),
    };`,

  'decision-tree.js': `${HELPERS}
    const kps = keyPoints || [];
    const root = (page && page.title) || splitTitleDesc(kps[0] || '').title || '决策';
    const branches = kps.slice(1, 4).map(kp => {
      const { title: condition, desc: outcome } = splitTitleDesc(kp);
      return { condition: condition || '分支', outcome: outcome || '结果' };
    });
    if (branches.length === 0) {
      branches.push({ condition: '是', outcome: '继续' }, { condition: '否', outcome: '终止' });
    }
    return { root, branches, title: (page && page.title) || '' };`,

  'issue-tree.js': `${HELPERS}
    const kps = keyPoints || [];
    const root = (page && page.title) || splitTitleDesc(kps[0] || '').title || '核心问题';
    const branches = kps.slice(1).slice(0, 3).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      const items = (desc || '').split(/[、，；,;]/).map(s => s.trim()).filter(Boolean);
      return { title: title || '分支', items: items.length ? items : [desc || '要点'] };
    });
    return { root, branches, title: (page && page.title) || '' };`,

  'mckinsey-7s.js': `${HELPERS}
    const kps = keyPoints || [];
    const keys = ['strategy', 'structure', 'systems', 'sharedValues', 'style', 'staff', 'skills'];
    const items = {};
    keys.forEach((k, i) => { items[k] = splitTitleDesc(kps[i] || '').desc || splitTitleDesc(kps[i] || '').title || ''; });
    return { items, title: (page && page.title) || '' };`,

  'pestel-analysis.js': `${HELPERS}
    const kps = keyPoints || [];
    const dims = ['P', 'E1', 'S', 'T', 'E2', 'L'];
    const items = dims.map((d, i) => {
      const { desc } = splitTitleDesc(kps[i] || '');
      const points = (desc || '').split(/[、，；,;]/).map(s => s.trim()).filter(Boolean);
      return { dimension: d, points: points.length ? points : (kps[i] ? [kps[i]] : []) };
    });
    return { items, title: (page && page.title) || '' };`,

  'phased-gantt.js': `${HELPERS}
    const kps = keyPoints || [];
    const months = (page && page.months) || ['Q1', 'Q2', 'Q3', 'Q4'];
    const span = Math.max(1, Math.floor(months.length / Math.max(1, kps.length)));
    const phases = kps.slice(0, 6).map((kp, i) => {
      const { title: name } = splitTitleDesc(kp);
      return {
        name: name || \`阶段\${i + 1}\`,
        startMonth: i * span + 1,
        endMonth: Math.min(months.length, (i + 1) * span),
      };
    });
    return { phases, months, title: (page && page.title) || '' };`,

  'porter-five-forces.js': `${HELPERS}
    const kps = keyPoints || [];
    const keys = ['rivalry', 'newEntrant', 'substitute', 'supplier', 'buyer'];
    const forces = {};
    keys.forEach((k, i) => { forces[k] = splitTitleDesc(kps[i] || '').desc || splitTitleDesc(kps[i] || '').title || ''; });
    return { forces, title: (page && page.title) || '' };`,

  'radial-nav.js': `${HELPERS}
    const kps = keyPoints || [];
    const core = (page && page.title) || splitTitleDesc(kps[0] || '').title || '核心';
    const items = kps.slice(1).slice(0, 6).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      return { title: title || '维度', desc: desc || '' };
    });
    return { core, items, title: (page && page.title) || '' };`,

  'risk-matrix.js': `${HELPERS}
    const kps = keyPoints || [];
    const risks = kps.slice(0, 8).map(kp => {
      const { title, desc } = splitTitleDesc(kp);
      const nums = (desc || '').match(/[1-5]/g) || [];
      return {
        name: title || '风险',
        probability: nums[0] ? parseInt(nums[0]) : 3,
        impact:      nums[1] ? parseInt(nums[1]) : 3,
      };
    });
    return { risks, title: (page && page.title) || '' };`,

  'scqa-narrative.js': `${HELPERS}
    const kps = keyPoints || [];
    return {
      situation:    kps[0] ? (splitTitleDesc(kps[0]).desc || kps[0]) : '',
      complication: kps[1] ? (splitTitleDesc(kps[1]).desc || kps[1]) : '',
      question:     kps[2] ? (splitTitleDesc(kps[2]).desc || kps[2]) : '我们应该如何应对？',
      answer:       kps[3] ? (splitTitleDesc(kps[3]).desc || kps[3]) : '',
      title:        (page && page.title) || '',
    };`,

  'stakeholder-map.js': `${HELPERS}
    const kps = keyPoints || [];
    const t = arr => arr.map(s => splitTitleDesc(s).title || s);
    const n = Math.ceil(kps.length / 4) || 1;
    return {
      stakeholders: {
        manage:  t(kps.slice(0, n)),
        satisfy: t(kps.slice(n, 2 * n)),
        inform:  t(kps.slice(2 * n, 3 * n)),
        monitor: t(kps.slice(3 * n)),
      },
      title: (page && page.title) || '',
    };`,

  'value-chain.js': `${HELPERS}
    const kps = keyPoints || [];
    // 前 5 个 keyPoints 映射主要活动，后 4 个映射支持活动
    const primaryKeys = ['inboundLogistics', 'operations', 'outboundLogistics', 'marketingSales', 'service'];
    const supportKeys = ['infrastructure', 'hrm', 'tech', 'procurement'];
    const t = kp => splitTitleDesc(kp).title || kp;
    return {
      primary: primaryKeys.map((k, i) => ({ key: k, points: kps[i] ? [t(kps[i])] : [] })),
      support: supportKeys.map((k, i) => ({ key: k, points: kps[5 + i] ? [t(kps[5 + i])] : [] })),
      title: (page && page.title) || '',
    };`,

  // ── A 类页面模板（8 个）── 这些通常由 storyboard-converter 直接构造，
  // 但补 fromKeyPoints 让"用 type:'content' + layouts:[{type:cover}]" 等边缘场景可达：
  'cover-slide.js': `    return {
      title:    (page && page.title) || (keyPoints && keyPoints[0]) || '演示文稿',
      subtitle: (page && page.subtitle) || (keyPoints && keyPoints[1]) || '',
      reporter: (page && page.reporter) || (page && page.author) || '',
      date:     (page && page.date) || '',
    };`,

  'back-cover-slide.js': `    return {
      text:     (page && page.text) || '谢谢各位',
      subtitle: (page && page.subtitle) || ((keyPoints || [])[0]) || '',
      contact:  (page && page.contact) || {},
    };`,

  'section-slide.js': `    return {
      sectionTitle:  (page && page.sectionTitle) || (page && page.title) || ((keyPoints || [])[0]) || '章节',
      sectionNumber: (page && page.sectionNumber) || '01',
      subtitle:      (page && page.subtitle) || '',
    };`,

  'toc-page.js': `${HELPERS}
    const items = (keyPoints || []).slice(0, 12).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      return { number: String(i + 1).padStart(2, '0'), title: title || kp, subtitle: desc || '' };
    });
    return { items, title: (page && page.title) || '目录' };`,

  'content-slide.js': `    return {
      title:              (page && page.title) || '',
      sectionTag:         (page && page.sectionTag) || '',
      engagementQuestion: (page && page.engagementQuestion) || '',
      sourceRef:          (page && page.sourceRef) || '',
    };`,

  'closing-quote.js': `${HELPERS}
    const kps = keyPoints || [];
    const { title: quote, desc: author } = splitTitleDesc(kps[0] || '');
    return {
      quote:  (page && page.quote) || quote || (page && page.title) || '',
      author: (page && page.author) || author || '',
      source: (page && page.source) || '',
    };`,

  'full-quote.js': `${HELPERS}
    const kps = keyPoints || [];
    const { title: quote, desc: author } = splitTitleDesc(kps[0] || '');
    return {
      quote:  (page && page.quote) || quote || '',
      author: (page && page.author) || author || '',
      source: (page && page.source) || '',
    };`,

  'case-divider.js': `${HELPERS}
    const kps = keyPoints || [];
    return {
      caseTitle:    (page && page.caseTitle) || (page && page.title) || (kps[0] ? splitTitleDesc(kps[0]).title : '案例'),
      caseSubtitle: (page && page.caseSubtitle) || (kps[1] ? splitTitleDesc(kps[1]).desc || kps[1] : ''),
    };`,
};

// 注入逻辑（复用与 inject-fromkeypoints.js 同样模式）
function inject(filename, body) {
  const fp = path.join(SKILL_DIR, 'templates', filename);
  if (!fs.existsSync(fp)) return { status: 'missing' };
  let src = fs.readFileSync(fp, 'utf-8');
  if (/fromKeyPoints\s*\(/m.test(src)) return { status: 'skipped' };

  const adapter = `  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
${body}
  },

`;
  // 优先注入到 selfLearning getter 之后
  const anchor = /(\s*get\s+selfLearning\s*\(\)[^]*?\},)/m;
  if (anchor.test(src)) {
    src = src.replace(anchor, (m) => `${m}\n\n${adapter}`);
  } else {
    // 没有 selfLearning，注入到 render 函数之前
    const renderRe = /(\n\s*render\s*\(pres, slide, data, infra\))/;
    if (!renderRe.test(src)) return { status: 'no-anchor' };
    src = src.replace(renderRe, `\n${adapter}$1`);
  }
  if (!DRY) fs.writeFileSync(fp, src, 'utf-8');
  return { status: 'injected' };
}

let injected = 0, skipped = 0, missing = 0, errors = 0;
for (const [filename, body] of Object.entries(ADAPTERS)) {
  const r = inject(filename, body);
  if (r.status === 'injected') { console.log(`  ✓ injected ${filename}`); injected++; }
  else if (r.status === 'skipped') { console.log(`  - skipped  ${filename}`); skipped++; }
  else if (r.status === 'missing') { console.log(`  ✗ missing  ${filename}`); missing++; }
  else { console.log(`  ✗ ${r.status}  ${filename}`); errors++; }
}

console.log(`\n汇总: injected ${injected}, skipped ${skipped}, missing ${missing}, errors ${errors}`);
if (DRY) console.log('(--dry-run，未写入)');
