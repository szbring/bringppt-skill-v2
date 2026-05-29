#!/usr/bin/env node
/**
 * weekly-checkup.js — BRINGPPT 每周自检与学习积累脚本 v1
 *
 * 功能：
 *   1. 自动合并重复陷阱 + 归档 90 天以上的已解决/失效条目（调 consolidate）
 *   2. 从 learning/ 各数据文件读取状态，计算本周指标
 *   3. 和上周指标对比，识别变化趋势
 *   4. 生成 Markdown 周报到 learning/global/weekly-reports/YYYY-WWW.md
 *   5. 归档本周指标 JSON 到 learning/global/weekly-reports/YYYY-WWW.json
 *
 * 用法：
 *   node weekly-checkup.js              # 生成本周报告
 *   node weekly-checkup.js --dry-run    # 不执行清理、不写文件，仅打印预览
 *   node weekly-checkup.js --silent     # 仅写文件，不打印到控制台
 *
 * 建议配到 Windows 任务计划（每周一早上 9:00 执行）。
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const store = require('./lib/learning-store');

const SKILL_DIR    = __dirname;
const REPORTS_DIR  = store.runtimePath('global', 'weekly-reports')
  || path.join(store.paths.defaultGlobalDir, 'weekly-reports');

// ── 工具函数 ────────────────────────────────────────────────────
function loadJson(fp, def = null) {
  return store.readJson(fp, def);
}

function saveJson(fp, data) {
  store.writeJsonAtomic(fp, data);
}

function ensureDir(dir) {
  store.ensureDir(dir);
}

// ISO 周编号（ISO 8601 周一为一周起点）
function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

function weekKey({ year, week }) {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// 找最近一份比本周更早的周报 JSON（用于"本周新增"基准对比）
function findLatestPriorReport() {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const thisWeek = weekKey(isoWeekOf(new Date()));
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json') && f < `${thisWeek}.json`)
    .sort();
  if (files.length === 0) return null;
  return loadJson(path.join(REPORTS_DIR, files[files.length - 1]));
}

// ── 指标采集 ────────────────────────────────────────────────────
// 返回本次采样的全部指标（周报 + 归档 JSON 共用）
function collectMetrics() {
  const now   = new Date();
  const weekAgo = daysAgo(7);

  // 1. 调用埋点（解法 1 产出）
  const accessLog = store.globalRead('context-access-log.json', { accesses: [] });
  const accessesWeek = accessLog.accesses.filter(a => new Date(a.timestamp) >= weekAgo);

  // 2. 陷阱档案状态（open/resolved/invalidated/archived）
  let tplCount = 0, openCount = 0, resolvedCount = 0, invalidatedCount = 0, archivedCount = 0;
  const allOpenTraps = [];  // 所有当前 open 陷阱，后面用于判断"本周新增"

  for (const f of store.listTemplateJsonFiles()) {
      if (f.startsWith('test-')) continue;
      const d = store.loadLayeredTemplate(f);
      if (!d || !d.errorPatterns) continue;
      tplCount++;
      for (const ep of d.errorPatterns) {
        const status = ep.status || 'open';
        if (status === 'open')        openCount++;
        if (status === 'resolved')    resolvedCount++;
        if (status === 'invalidated') invalidatedCount++;
        if (status === 'open') {
          allOpenTraps.push({ id: ep.id, template: ep.template, condition: ep.condition, lastSeen: ep.lastSeen });
        }
      }
      archivedCount += (d.archived || []).length;
  }

  // 3. 重复踩坑（解法 2 产出）
  // 只统计仍然 open 的陷阱；已升级硬规则或已解决的历史事件不再作为本周待办噪声。
  const openTrapIds = new Set(allOpenTraps.map(t => t.id));
  const failures = store.globalRead('learning-failures.json', { events: [] });
  const failuresWeek = failures.events
    .filter(e => new Date(e.repeatedAt) >= weekAgo)
    .filter(e => openTrapIds.has(e.trapId));

  // 按 trapId 聚合本周重复
  const stubbornByTrap = {};
  for (const e of failuresWeek) {
    if (!stubbornByTrap[e.trapId]) {
      stubbornByTrap[e.trapId] = { trapId: e.trapId, template: e.template, condition: e.condition, count: 0 };
    }
    stubbornByTrap[e.trapId].count++;
  }
  const stubbornTraps = Object.values(stubbornByTrap).sort((a, b) => b.count - a.count);

  // "本周新增陷阱" = 上一份周报里没有记录过的 open 陷阱 id
  // 这样避免把"历史遗留、lastSeen 恰好在 7 天内"的条目误判为新增
  const priorReport = findLatestPriorReport();
  const priorTrapIds = priorReport ? new Set(priorReport.allOpenTrapIds || []) : null;
  const newTrapsWeek = allOpenTraps.filter(t => {
    if (priorTrapIds === null) return false;  // 首份周报无基准，不报"新增"
    return !priorTrapIds.has(t.id);
  });

  // 4. 生成统计（模板 QA 通过率）
  const stats = store.globalRead('generation-stats.json', { totalGenerations: 0, templateUsage: {} });
  const lowQaTemplates = Object.entries(stats.templateUsage || {})
    .filter(([, v]) => (v.qaPassRate ?? 1.0) < 0.9)
    .map(([name, v]) => ({ name, qaPassRate: v.qaPassRate, count: v.count }))
    .sort((a, b) => a.qaPassRate - b.qaPassRate);

  // 5. 用户偏好
  const prefs = store.userRead('preferences.json', {
    preferredTemplates: [], avoidedTemplates: [], corrections: [],
  });

  return {
    week:               weekKey(isoWeekOf(now)),
    generatedAt:        now.toISOString(),
    accessesThisWeek:   accessesWeek.length,
    repeatsThisWeek:    failuresWeek.length,
    stubbornTraps,            // 本周重复踩坑排行
    newTrapsWeek,             // 本周首次出现的陷阱
    allOpenTrapIds:     allOpenTraps.map(t => t.id),  // 供下周"新增"基准对比
    totalGenerations:   stats.totalGenerations,
    templateStats: {
      total:       tplCount,
      open:        openCount,
      resolved:    resolvedCount,
      invalidated: invalidatedCount,
      archived:    archivedCount,
    },
    lowQaTemplates,
    templateUsage:      stats.templateUsage || {},
    avoidedTemplates:   prefs.avoidedTemplates,
    preferredTemplates: prefs.preferredTemplates,
  };
}

// ── 与上周对比（决定 4：本周 vs 上周）────────────────────────────
function diffWithLastWeek(thisMetrics) {
  const files = fs.existsSync(REPORTS_DIR)
    ? fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json')).sort()
    : [];

  // 找本次生成之前的最新一份
  const priorReports = files.filter(f => f < `${thisMetrics.week}.json`);
  if (priorReports.length === 0) return null;

  const lastReport = loadJson(path.join(REPORTS_DIR, priorReports[priorReports.length - 1]));
  if (!lastReport) return null;

  return {
    weekLabel:       lastReport.week,
    accessesDelta:   thisMetrics.accessesThisWeek   - (lastReport.accessesThisWeek   || 0),
    repeatsDelta:    thisMetrics.repeatsThisWeek    - (lastReport.repeatsThisWeek    || 0),
    openDelta:       thisMetrics.templateStats.open - (lastReport.templateStats?.open || 0),
  };
}

// ── 建议动作生成（决定 3 的"建议动作清单"）────────────────────
function buildRecommendations(m, diff) {
  const recs = [];

  // 规则 1：AI 没调用 learning-context
  if (m.accessesThisWeek === 0 && m.totalGenerations > 0) {
    recs.push({
      priority: 'HIGH',
      text: 'AI 本周未调用 learning-context。检查生成流程是否接入了闸门 1（gen_ppt_template.js）。',
    });
  }

  // 规则 2：有顽固陷阱（重复 >= 3 次）
  const veryStubborn = m.stubbornTraps.filter(t => t.count >= 3);
  for (const t of veryStubborn) {
    recs.push({
      priority: 'HIGH',
      text: `${t.trapId} (${t.template}) 本周重复 ${t.count} 次。建议在 SKILL.md 写明该陷阱的修复规则，或直接在 validate-slides.js 加硬性拦截。`,
    });
  }

  // 规则 3：重复踩坑增长
  if (diff && diff.repeatsDelta > 3) {
    recs.push({
      priority: 'MEDIUM',
      text: `本周重复踩坑 ${m.repeatsThisWeek} 次，比上周增加 ${diff.repeatsDelta}。考虑启用 --strict-learning 阻断模式。`,
    });
  }

  // 规则 4：低 QA 模板（v3.7.9：带上 failureModes Top 让"为什么不通过"可见）
  const avoided = new Set(m.avoidedTemplates || []);
  const severe = m.lowQaTemplates.filter(t => t.qaPassRate < 0.7 && t.count >= 5 && !avoided.has(t.name));
  const usageMap = m.templateUsage || {};
  for (const t of severe) {
    const modes = usageMap[t.name] && usageMap[t.name].failureModes;
    let modeHint = '';
    if (modes && Object.keys(modes).length > 0) {
      const top = Object.entries(modes).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([k, v]) => `${k}×${v}`).join(', ');
      modeHint = `；Top 失败原因: ${top}`;
    }
    recs.push({
      priority: 'MEDIUM',
      text: `${t.name} QA 通过率仅 ${Math.round(t.qaPassRate * 100)}%（已用 ${t.count} 次）${modeHint}。考虑加入 preferences.avoidedTemplates 或修正模板实现。`,
    });
  }

  // 规则 5：open 陷阱膨胀
  if (m.templateStats.open > 50) {
    recs.push({
      priority: 'LOW',
      text: `累积 open 陷阱 ${m.templateStats.open} 条，偏多。建议人工审阅 learning/templates/*.json，把已修复的标 resolved。`,
    });
  }

  // 规则 6：本周全绿
  if (recs.length === 0 && m.totalGenerations > 0) {
    recs.push({
      priority: 'INFO',
      text: '本周无异常。系统自学习流程健康。',
    });
  }

  return recs;
}

// ── 渲染 Markdown 周报 ──────────────────────────────────────────
function renderMarkdown(m, diff, recs, cleanup) {
  const lines = [];
  const date = new Date().toISOString().slice(0, 10);

  lines.push(`# BRINGPPT 自学习周报 · ${m.week}`);
  lines.push('');
  lines.push(`**生成时间：** ${date}  `);
  lines.push(`**累计生成次数：** ${m.totalGenerations}  `);
  if (diff) {
    lines.push(`**对比基准：** ${diff.weekLabel}  `);
  } else {
    lines.push(`**对比基准：** 无（这是首份周报）`);
  }
  lines.push('');

  // ── 一、本周关键指标 ──
  lines.push('## 一、本周关键指标');
  lines.push('');
  lines.push('| 指标 | 本周 | 变化 |');
  lines.push('|------|------|------|');
  const fmtDelta = (v) => {
    if (v === 0 || v === undefined) return '—';
    return v > 0 ? `▲ +${v}` : `▼ ${v}`;
  };
  lines.push(`| AI 调用 learning-context 次数 | ${m.accessesThisWeek} | ${diff ? fmtDelta(diff.accessesDelta) : '—'} |`);
  lines.push(`| 重复踩坑次数 | ${m.repeatsThisWeek} | ${diff ? fmtDelta(diff.repeatsDelta) : '—'} |`);
  lines.push(`| 本周新发现陷阱 | ${m.newTrapsWeek.length} | — |`);
  lines.push(`| 当前 open 陷阱总数 | ${m.templateStats.open} | ${diff ? fmtDelta(diff.openDelta) : '—'} |`);
  lines.push('');

  // ── 二、学习效果 ──
  lines.push('## 二、学习效果');
  lines.push('');
  if (m.repeatsThisWeek === 0) {
    lines.push('✅ 本周无重复踩坑——AI 有效利用了历史陷阱知识。');
  } else {
    lines.push(`本周 AI 重复触发了 **${m.repeatsThisWeek} 次**已知陷阱，涉及 **${m.stubbornTraps.length} 个**独立陷阱。`);
    lines.push('');
    lines.push('### 最顽固陷阱（本周 Top 5）');
    lines.push('');
    lines.push('| 排名 | 陷阱 ID | 模板 | 重复次数 | 条件摘要 |');
    lines.push('|------|--------|------|---------|---------|');
    m.stubbornTraps.slice(0, 5).forEach((t, i) => {
      const cond = (t.condition || '').slice(0, 60).replace(/\|/g, '\\|');
      lines.push(`| ${i + 1} | ${t.trapId} | ${t.template} | ${t.count} | ${cond} |`);
    });
  }
  lines.push('');

  // ── 三、模板健康 ──
  lines.push('## 三、模板健康');
  lines.push('');
  lines.push(`**陷阱档案状态：** open ${m.templateStats.open} · resolved ${m.templateStats.resolved} · invalidated ${m.templateStats.invalidated} · archived ${m.templateStats.archived}  `);
  lines.push('');
  if (m.lowQaTemplates.length > 0) {
    lines.push('### QA 通过率偏低的模板（< 90%）');
    lines.push('');
    lines.push('| 模板 | 通过率 | 使用次数 |');
    lines.push('|------|--------|---------|');
    m.lowQaTemplates.forEach(t => {
      lines.push(`| ${t.name} | ${Math.round(t.qaPassRate * 100)}% | ${t.count} |`);
    });
    lines.push('');
  } else {
    lines.push('✅ 所有模板 QA 通过率均 ≥ 90%');
    lines.push('');
  }

  // ── 四、本周新发现的陷阱 ──
  if (m.newTrapsWeek.length > 0) {
    lines.push('## 四、本周新发现的陷阱');
    lines.push('');
    m.newTrapsWeek.slice(0, 10).forEach(t => {
      lines.push(`- **[${t.id}] ${t.template}** — ${(t.condition || '').slice(0, 100)}`);
    });
    if (m.newTrapsWeek.length > 10) {
      lines.push(`- （还有 ${m.newTrapsWeek.length - 10} 条未列出）`);
    }
    lines.push('');
  }

  // ── 五、自动清理动作 ──
  lines.push('## 五、本周自动清理');
  lines.push('');
  if (cleanup.merged > 0 || cleanup.archived > 0) {
    lines.push(`- 合并同根因陷阱：**${cleanup.merged}** 条`);
    lines.push(`- 归档 90+ 天陈旧条目：**${cleanup.archived}** 条`);
  } else {
    lines.push('本周无需清理（无同根因重复，无陈旧条目）。');
  }
  lines.push('');

  // ── 六、建议动作 ──
  lines.push('## 六、建议动作');
  lines.push('');
  const byPriority = { HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
  recs.forEach(r => byPriority[r.priority].push(r));

  if (byPriority.HIGH.length > 0) {
    lines.push('### 🔴 高优先级');
    byPriority.HIGH.forEach(r => lines.push(`- ${r.text}`));
    lines.push('');
  }
  if (byPriority.MEDIUM.length > 0) {
    lines.push('### 🟡 中优先级');
    byPriority.MEDIUM.forEach(r => lines.push(`- ${r.text}`));
    lines.push('');
  }
  if (byPriority.LOW.length > 0) {
    lines.push('### 🔵 低优先级');
    byPriority.LOW.forEach(r => lines.push(`- ${r.text}`));
    lines.push('');
  }
  if (byPriority.INFO.length > 0) {
    byPriority.INFO.forEach(r => lines.push(`${r.text}`));
    lines.push('');
  }

  // ── 七、用户偏好快照 ──
  lines.push('## 七、用户偏好快照');
  lines.push('');
  lines.push(`- 偏好模板：${m.preferredTemplates.length > 0 ? m.preferredTemplates.join(', ') : '（无）'}`);
  lines.push(`- 回避模板：${m.avoidedTemplates.length > 0 ? m.avoidedTemplates.join(', ') : '（无）'}`);
  lines.push('');

  lines.push('---');
  lines.push(`*由 weekly-checkup.js v1 生成 · 数据窗口 过去 7 天*`);
  lines.push('');

  return lines.join('\n');
}

// ── 失败兜底（决定 5：简化版报告）──────────────────────────────
function renderFallbackReport(err, week) {
  const date = new Date().toISOString().slice(0, 10);
  return `# BRINGPPT 自学习周报 · ${week}（⚠️ 简化版）

**生成时间：** ${date}

周报生成过程中遇到错误，仅输出简化信息：

\`\`\`
${err.stack || err.message || String(err)}
\`\`\`

可能的原因：
- \`learning/\` 目录下某个 JSON 文件损坏
- 磁盘权限问题
- record-learning.js 的 consolidate 函数异常

**建议动作：** 手动检查 \`learning/\` 目录，或联系维护者。

---
*由 weekly-checkup.js v1 生成（fallback 模式）*
`;
}

// ── 主流程 ──────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const silent = argv.includes('--silent');

  const log = (...a) => { if (!silent) console.log(...a); };

  log('📅 BRINGPPT 每周自检启动...');
  log(dryRun ? '   模式：DRY-RUN（只预览，不执行、不写文件）' : '   模式：正式执行');
  log('');

  // 先做安全兜底：记一下当前周键，失败时用
  const thisWeekKey = weekKey(isoWeekOf(new Date()));

  try {
    // Step 1: 自动清理（中等档位 = consolidate）
    let cleanup = { merged: 0, archived: 0 };
    if (!dryRun) {
      log('🧹 Step 1: 自动清理（合并同根因 + 归档 90+ 天）...');
      try {
        const { consolidate } = require('./record-learning');
        cleanup = consolidate({ silent: true });
        log(`   合并 ${cleanup.merged} 条，归档 ${cleanup.archived} 条`);
      } catch (e) {
        log(`   ⚠️  consolidate 调用失败：${e.message}（周报将标注此事实）`);
      }
    } else {
      log('🧹 Step 1: [DRY-RUN] 跳过自动清理');
    }

    // Step 2: 采集指标
    log('📊 Step 2: 采集指标...');
    const metrics = collectMetrics();

    // Step 3: 对比上周
    log('📈 Step 3: 和上周对比...');
    const diff = diffWithLastWeek(metrics);

    // Step 4: 生成建议
    log('💡 Step 4: 生成建议动作...');
    const recs = buildRecommendations(metrics, diff);
    log(`   共 ${recs.length} 条建议`);

    // Step 5: 渲染 Markdown + 归档 JSON
    const md = renderMarkdown(metrics, diff, recs, cleanup);

    if (dryRun) {
      log('');
      log('──────── DRY-RUN 预览输出 ────────');
      console.log(md);
      log('──────── 以上仅为预览，未写入文件 ────────');
      return;
    }

    ensureDir(REPORTS_DIR);
    const mdPath   = path.join(REPORTS_DIR, `${metrics.week}.md`);
    const jsonPath = path.join(REPORTS_DIR, `${metrics.week}.json`);

    fs.writeFileSync(mdPath, md, 'utf-8');
    saveJson(jsonPath, {
      ...metrics,
      cleanup,
      recommendations: recs,
      diff,
    });

    log('');
    log(`✅ 周报已生成：${path.relative(SKILL_DIR, mdPath)}`);
    log(`   数据归档：${path.relative(SKILL_DIR, jsonPath)}`);
    log('');
    log(`🔴 高优建议 ${recs.filter(r => r.priority === 'HIGH').length} 条` +
        ` · 🟡 中优 ${recs.filter(r => r.priority === 'MEDIUM').length} 条` +
        ` · 🔵 低优 ${recs.filter(r => r.priority === 'LOW').length} 条`);

    // v3.7.27 (Pillar F): webhook 推送——支持 Slack / 钉钉 / 飞书 / 通用 HTTP
    // 环境变量：
    //   BRINGPPT_WEBHOOK_URL       — 必填，启用推送
    //   BRINGPPT_WEBHOOK_TYPE      — 可选: slack | dingtalk | feishu | generic（默认 generic）
    //   BRINGPPT_WEBHOOK_DRY_RUN=1 — 只打印 payload 不发请求
    const webhook = process.env.BRINGPPT_WEBHOOK_URL;
    if (webhook && !args.dryRun) {
      try {
        const sender = require('./lib/webhook-sender');
        const summary = {
          week: metrics.week,
          highRecs: recs.filter(r => r.priority === 'HIGH').length,
          medRecs:  recs.filter(r => r.priority === 'MEDIUM').length,
          lowRecs:  recs.filter(r => r.priority === 'LOW').length,
          diffSummary: (diff && diff.summary) || '',
          mdRelPath:   path.relative(SKILL_DIR, mdPath),
        };
        await sender.sendDigest(webhook, summary, {
          type:   process.env.BRINGPPT_WEBHOOK_TYPE || 'generic',
          dryRun: process.env.BRINGPPT_WEBHOOK_DRY_RUN === '1',
        });
        log(`📨 已推送 webhook (${process.env.BRINGPPT_WEBHOOK_TYPE || 'generic'})`);
      } catch (whErr) {
        log(`⚠ webhook 推送失败：${whErr.message}（周报本地仍正常生成）`);
      }
    }

  } catch (err) {
    // 决定 5：失败兜底——写一份简化报告，不静默
    console.error('❌ weekly-checkup 主流程异常:', err.message);
    try {
      ensureDir(REPORTS_DIR);
      const fallbackMd = renderFallbackReport(err, thisWeekKey);
      const mdPath = path.join(REPORTS_DIR, `${thisWeekKey}-FALLBACK.md`);
      fs.writeFileSync(mdPath, fallbackMd, 'utf-8');
      console.error(`   已写入简化报告：${path.relative(SKILL_DIR, mdPath)}`);
    } catch (writeErr) {
      console.error(`   连简化报告也写不了：${writeErr.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { collectMetrics, buildRecommendations, renderMarkdown };
