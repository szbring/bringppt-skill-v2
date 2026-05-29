#!/usr/bin/env node
/**
 * learning-context.js — BRINGPPT 学习上下文读取器 v2
 *
 * 新增（v1 → v2）:
 *   - [Fix8] 每次调用自动埋点到 learning/global/context-access-log.json
 *   - [Fix7] 返回值新增 learningEffectiveness 字段（30天重复踩坑统计）
 *
 * 用法（两种）：
 *   1. CLI 查看:  node learning-context.js
 *   2. 代码调用: const ctx = require('./learning-context').getLearningContext()
 *
 * 返回结构化的"已知陷阱 + 用户偏好 + 模板统计 + 学习效果"，供 AI 在写 slides-data.js 前参考。
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const store = require('./lib/learning-store');

const LEARNING_DIR = store.RUNTIME_LEARNING_DIR;
const GLOBAL_DIR   = store.runtimePath('global');
const TPLS_DIR     = store.runtimePath('templates');
const USER_DIR     = store.runtimePath('user');

function loadJson(fp, def = null) { return store.loadJson(fp, def); }
function loadLayeredJson(rel, def = null) { return store.loadLayeredJson(rel, def); }

// ── [Fix8] 解法 1：调用埋点 ─────────────────────────────────
// 每次 getLearningContext 被调用时记录，用于回答"AI 到底有没有读"
function recordContextAccess({ trapsCount, activeTraps }) {
  try {
    const logPath = store.globalWritePath('context-access-log.json');
    if (!logPath) return;
    const log = store.globalRead('context-access-log.json', {
      description: '学习上下文访问日志：每次 getLearningContext 被调用都记一笔',
      version: 1,
      accesses: [],
    });

    log.accesses.push({
      timestamp: new Date().toISOString(),
      caller:    process.argv[1] ? path.basename(process.argv[1]) : 'library-call',
      trapsCount,
      topTraps:  activeTraps,  // 本次喂给调用方的 top 5 陷阱 id
    });

    // 最多保留最近 1000 条
    if (log.accesses.length > 1000) {
      log.accesses = log.accesses.slice(-1000);
    }

    store.saveJson(logPath, log);
  } catch {
    // 埋点失败不影响主流程（无声失败）
  }
}

// ── [Fix7] 解法 2 附属：计算学习失效率（过去 30 天窗口）──────
function getLearningEffectiveness() {
  const log = loadLayeredJson(['global', 'learning-failures.json'], { events: [] });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const recentFailures = (log.events || []).filter(ev => new Date(ev.repeatedAt) >= cutoff);

  // 按陷阱 id 聚合，找出最顽固的
  const byTrap = {};
  for (const ev of recentFailures) {
    const key = ev.trapId || 'unknown';
    if (!byTrap[key]) {
      byTrap[key] = { trapId: key, template: ev.template, condition: ev.condition, count: 0 };
    }
    byTrap[key].count += 1;
  }

  const stubborn = Object.values(byTrap)
    .filter(t => t.count >= 2)
    .sort((a, b) => b.count - a.count);

  return {
    windowDays:     30,
    totalRepeats:   recentFailures.length,
    uniqueTraps:    Object.keys(byTrap).length,
    stubbornTraps:  stubborn,
  };
}

// ── 核心函数 ──────────────────────────────────────────────────
function getLearningContext() {
  // 1. 生成统计
  const stats = loadLayeredJson(['global', 'generation-stats.json'], {
    totalGenerations: 0, templateUsage: {}, averageContentDensity: {}
  });

  // 2. 所有错误模式（按模板汇总）
  const knownTraps = {};
  for (const f of store.listTemplateJsonFiles()) {
    // 跳过测试数据
    if (f.startsWith('test-')) continue;
    const d = store.loadLayeredTemplate(f);
    if (!d || !d.errorPatterns || d.errorPatterns.length === 0) continue;
    const tplName = f.replace('.json', '');
    // [Fix3] 只输出 open 状态的陷阱，resolved/invalidated 不显示
    const activeTraps = d.errorPatterns.filter(ep => {
      const s = ep.status || 'open';
      const text = JSON.stringify(ep).toLowerCase();
      const isLegacyNotesTrap = text.includes('notes') || text.includes('speaker notes') || text.includes('讲师备注') || text.includes('备注');
      return s === 'open' && !isLegacyNotesTrap;
    });
    if (activeTraps.length === 0) continue;
    knownTraps[tplName] = activeTraps.map(ep => ({
      id:        ep.id,
      type:      ep.errorType,
      condition: ep.condition,
      fix:       ep.fix || '（暂无修复方案）',
      seen:      ep.occurrences || 1,
      lastSeen:  ep.lastSeen,
      source:    ep.source || 'unknown',  // [Fix6] 来源
    }));
  }

  // 3. SmartFit 校准
  const calibration = loadLayeredJson(['global', 'smartfit-calibration.json'], {
    charWidthMultipliers: { cjk: 1.0, ascii_letter: 0.55 },
    overflowIncidents: [],
    calibrationVersion: 1,
  });

  // 4. 高频 overflow 模板（出现 ≥1 次的）
  const overflowRisk = {};
  for (const inc of calibration.overflowIncidents) {
    if (!inc.template || inc.template === 'unknown') continue;
    overflowRisk[inc.template] = (overflowRisk[inc.template] || 0) + 1;
  }

  // 5. 用户偏好
  const prefs = store.sanitizeUserPreferences(loadLayeredJson(['user', 'preferences.json'], {
    preferredTemplates: [], avoidedTemplates: [], corrections: [], stylePreferences: {}
  }));

  // 6. QA 通过率低的模板（< 0.9）
  const lowQaTemplates = Object.entries(stats.templateUsage || {})
    .filter(([, v]) => v.qaPassRate < 0.9)
    .map(([name, v]) => ({ name, qaPassRate: v.qaPassRate, count: v.count }));

  // 7. 模板使用排行（Top 10）
  const templateRanking = Object.entries(stats.templateUsage || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, v]) => ({ name, count: v.count, qaPassRate: v.qaPassRate }));

  // 8. 低曝光模板推荐（使用<5次，有 scenarios 字段的）
  let registry = null;
  try { registry = require('./registry'); } catch {}
  const coldTemplates = [];
  if (registry) {
    const usageMap = stats.templateUsage || {};
    for (const tpl of registry.list()) {
      const count = usageMap[tpl.name]?.count || 0;
      if (count < 5 && tpl.usage && tpl.usage.scenarios && tpl.usage.scenarios.length > 0) {
        coldTemplates.push({
          name:      tpl.name,
          category:  tpl.category,
          count,
          scenarios: tpl.usage.scenarios,
          when:      tpl.usage.when,
        });
      }
    }
    coldTemplates.sort((a, b) => a.count - b.count);
  }

  // [Fix7] 解法 2 附属：带上学习失效率数据
  const effectiveness = getLearningEffectiveness();

  // 注意：getLearningContext 是纯读操作，不再隐式埋点。
  // 调用方在真正"使用"上下文时，应显式调用 logContextAccess(ctx)
  // —— CLI 入口 printContext 与 gen_ppt 自动装配脚本都已做此调用。
  return {
    meta: {
      totalGenerations: stats.totalGenerations,
      avgLayoutsPerSlide: stats.averageContentDensity?.layoutsPerSlide || 0,
      calibrationVersion: calibration.calibrationVersion,
    },
    knownTraps,          // { templateName: [{id, type, condition, fix, seen}] }
    overflowRisk,        // { templateName: count }
    lowQaTemplates,      // 通过率 < 90% 的模板
    templateRanking,     // Top 10 使用频率
    coldTemplates,       // 低曝光模板推荐（使用<5次，有scenarios）
    userPreferences: {
      preferred: prefs.preferredTemplates,
      avoided:   prefs.avoidedTemplates,
      recentCorrections: (prefs.corrections || []).slice(-5),
      style:     prefs.stylePreferences,
    },
    learningEffectiveness: effectiveness,  // [Fix7] 30天学习失效率指标
  };
}

// ── CLI 输出（格式化打印）────────────────────────────────────
function printContext() {
  const ctx = getLearningContext();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        BRINGPPT 自学习上下文（生成前必读）           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log(`📊 生成历史: 共 ${ctx.meta.totalGenerations} 次 | 平均 ${ctx.meta.avgLayoutsPerSlide} 版式/内容页`);
  console.log(`🔧 SmartFit 校准: v${ctx.meta.calibrationVersion}\n`);

  // [Fix7] 学习失效率（过去 30 天窗口）
  const eff = ctx.learningEffectiveness;
  if (eff.totalRepeats > 0) {
    console.log(`🎯 学习效果（过去 ${eff.windowDays} 天）：`);
    console.log(`   重复踩坑 ${eff.totalRepeats} 次 / 涉及 ${eff.uniqueTraps} 个陷阱`);
    if (eff.stubbornTraps.length > 0) {
      console.log(`   🔴 最顽固陷阱（重复 ≥ 2 次）：`);
      for (const t of eff.stubbornTraps.slice(0, 5)) {
        console.log(`      [${t.trapId}] ${t.template}: 重复 ${t.count} 次`);
      }
    }
    console.log('');
  } else {
    console.log(`🎯 学习效果：过去 30 天无重复踩坑 ✅\n`);
  }

  // 已知陷阱
  const trapCount = Object.values(ctx.knownTraps).reduce((s, v) => s + v.length, 0);
  if (trapCount > 0) {
    console.log(`⚠️  已知陷阱（${trapCount} 条，生成前务必规避）：`);
    for (const [tpl, traps] of Object.entries(ctx.knownTraps)) {
      console.log(`\n  【${tpl}】`);
      for (const t of traps) {
        console.log(`    [${t.id}] ${t.type}`);
        console.log(`      条件: ${t.condition}`);
        if (t.fix && t.fix !== '（暂无修复方案）') {
          console.log(`      修复: ${t.fix}`);
        }
      }
    }
    console.log('');
  } else {
    console.log('✅ 暂无已知陷阱记录\n');
  }

  // Overflow 高风险模板
  if (Object.keys(ctx.overflowRisk).length > 0) {
    console.log('📐 Overflow 高风险模板（使用时注意内容长度）：');
    for (const [tpl, cnt] of Object.entries(ctx.overflowRisk)) {
      console.log(`  ${tpl}: 出现 ${cnt} 次 overflow`);
    }
    console.log('');
  }

  // 低QA通过率模板
  if (ctx.lowQaTemplates.length > 0) {
    console.log('🔴 QA 通过率偏低的模板（谨慎使用）：');
    for (const t of ctx.lowQaTemplates) {
      console.log(`  ${t.name}: ${(t.qaPassRate * 100).toFixed(0)}% (使用 ${t.count} 次)`);
    }
    console.log('');
  }

  // 用户偏好
  if (ctx.userPreferences.preferred.length > 0) {
    console.log(`👍 用户偏好模板: ${ctx.userPreferences.preferred.join(', ')}`);
  }
  if (ctx.userPreferences.avoided.length > 0) {
    console.log(`👎 用户回避模板: ${ctx.userPreferences.avoided.join(', ')}`);
  }
  if (ctx.userPreferences.recentCorrections.length > 0) {
    console.log('📝 近期用户修正：');
    for (const c of ctx.userPreferences.recentCorrections) {
      console.log(`  ${c.date}: ${c.original} → ${c.correctedTo}（${c.reason}）`);
    }
  }
  console.log('');

  // 低曝光模板推荐
  if (ctx.coldTemplates && ctx.coldTemplates.length > 0) {
    console.log(`💡 低曝光模板推荐（${ctx.coldTemplates.length} 个，适合场景时优先考虑）：`);
    // 按分类分组输出
    const byCategory = {};
    for (const t of ctx.coldTemplates.slice(0, 20)) {  // 最多显示20个
      if (!byCategory[t.category]) byCategory[t.category] = [];
      byCategory[t.category].push(t);
    }
    for (const [cat, tpls] of Object.entries(byCategory)) {
      console.log(`  【${cat}】`);
      for (const t of tpls) {
        const countStr = t.count === 0 ? '从未使用' : `仅用${t.count}次`;
        console.log(`    ${t.name.padEnd(20)} (${countStr})`);
        // 显示第一个 scenario 作为快速提示
        if (t.scenarios && t.scenarios[0]) {
          console.log(`      → ${t.scenarios[0].trigger}`);
        }
      }
    }
    console.log('');
  }

  // 模板使用排行
  console.log('📈 模板使用 Top 10：');
  for (const t of ctx.templateRanking) {
    const qaStr = t.qaPassRate < 1 ? ` ⚠️ QA=${(t.qaPassRate*100).toFixed(0)}%` : '';
    console.log(`  ${t.name.padEnd(22)} ${t.count} 次${qaStr}`);
  }
  console.log('');
}

// ── 显式埋点（供使用方调用，而不是隐藏在 read 路径里）─────────
function logContextAccess(ctx) {
  try {
    if (!ctx) return;
    const allActiveTraps = Object.values(ctx.knownTraps || {}).flat();
    const topTraps = allActiveTraps.slice(0, 5).map(t => t.id);
    recordContextAccess({
      trapsCount:  allActiveTraps.length,
      activeTraps: topTraps,
    });
  } catch {
    // 埋点失败不影响主流程
  }
}

// ── 导出 ─────────────────────────────────────────────────────
module.exports = { getLearningContext, logContextAccess };

if (require.main === module) {
  // CLI 入口：读 + 显式埋点 + 打印
  const ctx = getLearningContext();
  logContextAccess(ctx);
  // printContext 会自身再读一遍——为避免重复埋点，这里直接传 ctx 给一个轻量版打印
  printContext();
}
