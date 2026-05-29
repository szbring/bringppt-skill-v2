#!/usr/bin/env node
'use strict';
/**
 * scripts/recommend-layout.js — 智能模板推荐
 *
 * 给一组 keyPoints + 上下文，返回 top-N 推荐版式 + 理由。
 * 综合：
 *   1. L1 notWhen 排除（schema 容量约束）
 *   2. L2 schema 验证通过性
 *   3. 历史 QA 通过率（学习数据）
 *   4. 关键词启发式（来自 outline-to-storyboard）
 *
 * 用法：
 *   node scripts/recommend-layout.js --kps "信息断裂..., 变更失控..., 质量..."
 *   node scripts/recommend-layout.js --kps-file kps.txt --top 5
 *   echo "kp1\nkp2" | node scripts/recommend-layout.js --top 3
 */

const fs   = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const reg       = require(path.join(SKILL_DIR, 'registry'));
const conv      = require(path.join(SKILL_DIR, 'storyboard-converter'));
const { selectBestLayout } = require(path.join(SKILL_DIR, 'template-selector'));

const args = process.argv.slice(2);
function arg(flag, fb) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fb; }

const kpStr  = arg('--kps');
const kpFile = arg('--kps-file');
const title  = arg('--title', '推荐测试');
const top    = parseInt(arg('--top', '3'));
const verbose= args.includes('--verbose');

let kps;
if (kpStr) kps = kpStr.split(/[;；]\s*/);
else if (kpFile) kps = fs.readFileSync(kpFile, 'utf-8').split(/\r?\n/).filter(Boolean);
else {
  // 读 stdin
  const chunks = [];
  try { chunks.push(fs.readFileSync(0, 'utf-8')); }
  catch { console.error('未提供 keyPoints。用 --kps "..." 或 --kps-file path'); process.exit(1); }
  kps = chunks.join('').split(/\r?\n/).filter(Boolean);
}

if (!kps.length) {
  console.error('keyPoints 为空');
  process.exit(1);
}

// 加载历史 QA 数据
let qaData = {};
try {
  const stats = require(path.join(SKILL_DIR, 'learning', 'global', 'generation-stats.json'));
  qaData = stats.templateUsage || {};
} catch { /* 没数据无所谓 */ }

const page = { id: 'rec-probe', title, keyPoints: kps };
const allTpls = reg.list().filter(t => !t.isPageTemplate);

// 关键词启发式（与 outline-to-storyboard 共享思路）
const text = [title, ...kps].join(' ');
function keywordHint(name) {
  const rules = [
    [/(对比|vs|比较|前后)/, ['comparison','beforeAfter','hourglass'], 30],
    [/(\d+%|百分比|占比)/, ['dataHighlight','kpiDashboard','chartPie'], 25],
    [/(流程|步骤|阶段)/, ['stepList','snakeFlow','processFlow','arrowChain'], 25],
    [/(矩阵|四象限)/, ['quadrantMatrix','colorMatrix'], 30],
    [/(三层|金字塔|层级)/, ['pyramid','layeredList','cubeStack'], 25],
    [/(时间线|路线图)/, ['timeline','ganttChart','phasedGantt'], 25],
    [/(因果|根因)/, ['fishbone','causalChain','issueTree'], 25],
    [/(组织|架构)/, ['orgChart','stakeholderMap'], 25],
    [/(SWOT|swot)/, ['swotGrid'], 40],
    [/(PESTEL|pestel)/, ['pestelAnalysis'], 40],
    [/(波特|五力)/, ['porterFiveForces'], 40],
    [/(BCG|波士顿)/, ['bcgMatrix'], 40],
    [/(SCQA)/, ['scqaNarrative'], 40],
  ];
  let bonus = 0;
  for (const [re, tpls, b] of rules) {
    if (re.test(text) && tpls.includes(name)) bonus += b;
  }
  return bonus;
}

// 对每个 B 类模板算综合分
const scored = [];
for (const tpl of allTpls) {
  if (typeof tpl.fromKeyPoints !== 'function') continue;
  let score = 0;
  const reasons = [];

  // 1. L1+L2+L3 跑一遍——通过则得 50 基础分
  page.suggestedLayout = tpl.name;
  let l123Pass = false;
  let l123Reason = '';
  try {
    const r = selectBestLayout(page, conv.buildLayoutData);
    l123Pass = (r.layout === tpl.name);
    l123Reason = r.reason || '';
  } catch { /* 选择器抛错说明都失败 */ }
  if (l123Pass) {
    score += 50;
    reasons.push('三层稳定性 ✓');
  } else {
    // 显式被排除，跳过
    if (verbose) console.error(`  [skip] ${tpl.name}: ${l123Reason.slice(0, 60)}`);
    continue;
  }

  // 2. 历史 QA 通过率（0-40 分）
  const qa = qaData[tpl.name];
  if (qa) {
    const pts = Math.round((qa.qaPassRate || 0) * 40);
    score += pts;
    reasons.push(`历史 QA ${Math.round(qa.qaPassRate * 100)}% (${qa.count} 次)`);
  } else {
    score += 20;  // 无数据中性分
    reasons.push('无历史数据');
  }

  // 3. 关键词启发式 bonus（0-40 分）
  const kb = keywordHint(tpl.name);
  if (kb > 0) {
    score += kb;
    reasons.push(`关键词命中 +${kb}`);
  }

  // 4. 数量适配——keyPoints 数与 maxItems 接近时加分
  const maxItems = (tpl.usage && tpl.usage.maxItems) || 0;
  if (maxItems > 0) {
    const ratio = kps.length / maxItems;
    if (ratio >= 0.6 && ratio <= 1.0) {
      score += 15;
      reasons.push(`数量匹配 ${kps.length}/${maxItems}`);
    }
  }

  scored.push({ name: tpl.name, category: tpl.category, score, reasons, usage: tpl.usage || {} });
}

scored.sort((a, b) => b.score - a.score);
const result = scored.slice(0, top);

console.log(`\n💡 给定 ${kps.length} 个 keyPoint，推荐 Top ${top} 版式：\n`);
result.forEach((r, i) => {
  console.log(`  #${i + 1}  ${r.name}  (${r.category}, 分数 ${r.score})`);
  console.log(`       理由：${r.reasons.join(' · ')}`);
  console.log(`       用：${r.usage.when || '-'}`);
  console.log('');
});

if (verbose) {
  console.log('\n所有通过 L1+L2+L3 的版式（按分数排序）:');
  scored.forEach(r => console.log(`  ${r.name.padEnd(22)} ${r.score}`));
}
