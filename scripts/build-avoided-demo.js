#!/usr/bin/env node
'use strict';
/**
 * scripts/build-avoided-demo.js — 给当前 preferences.avoidedTemplates 里的每个模板
 * 生成一页 demo + 一页权重诊断。用 tpl.fromKeyPoints 构造合规 layout data。
 *
 * 输出：_temp/avoided-demo/slides-data.json + output.pptx
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const reg   = require(path.join(SKILL_DIR, 'registry'));
const store = require(path.join(SKILL_DIR, 'lib', 'learning-store'));
const { generatePptx } = require(path.join(SKILL_DIR, 'ppt-pipeline'));

const stats = store.globalRead('generation-stats.json', { templateUsage: {} });
const prefs = store.userRead('preferences.json', { avoidedTemplates: [] });
const usage = stats.templateUsage || {};

// 为每个回避模板预设 representative keyPoints
const REPRESENTATIVE = {
  comparison: [
    '传统人工模式: 决策周期长平均 14 天落地',
    '智能数字模式: 决策实时输出秒级响应',
    '人工模式: 异常事件依赖排查会议',
    '数字模式: 系统主动预警提前 48 小时',
  ],
  iconList: [
    '客户洞察: 通过行为数据持续刷新画像',
    '产品迭代: 双周节奏带动核心指标提升',
    '组织协同: 跨职能小组打破筒仓壁垒',
    '资本效率: 投资回报周期缩短约 30%',
  ],
  dataHighlight: [
    '营收同比增长 35%',
    '客户规模累计 250 万',
    'NPS 净推荐值 72 分',
    'ARPU 人均贡献 88 元',
  ],
  styledTable: [
    '北区市场: 收入 ¥2.4 亿,占比 38%,增长 +22%',
    '南区市场: 收入 ¥1.8 亿,占比 28%,增长 +9%',
    '西区市场: 收入 ¥1.1 亿,占比 17%,增长 +18%',
    '海外市场: 收入 ¥1.0 亿,占比 16%,增长 +45%',
    '线上渠道: 收入 ¥0.7 亿,占比 11%,增长 +60%',
  ],
};

function qaCell(q) {
  if (q == null) return '—';
  const p = Math.round(q * 100);
  if (p >= 90) return `🟢 ${p}%`;
  if (p >= 70) return `🟡 ${p}%`;
  return `🔴 ${p}%`;
}

const slides = [];

// 封面
slides.push({
  id:       'cover',
  type:     'cover',
  title:    '"回避模板"实地复盘',
  subtitle: `当前 ${prefs.avoidedTemplates.length} 个被系统自动回避的版式 · 真实渲染与权重诊断`,
  reporter: '薄云咨询 BRING Consulting',
  date:     new Date().toISOString().slice(0, 10),
});

// 总览页：把 4 个回避模板的核心权重摆在一起
slides.push({
  id:    'overview',
  type:  'content',
  title: '回避模板权重总览',
  sectionTag: '诊断',
  sourceRef:  '数据来源 ~/.bringppt/learning runtime',
  layouts: [{
    type: 'styledTable',
    data: {
      headers: ['模板', '类别', '使用次数', 'QA 通过率', 'Top 失败原因'],
      rows: prefs.avoidedTemplates.map(name => {
        const t = reg.get(name);
        const u = usage[name] || {};
        const modes = u.failureModes || {};
        const top = Object.entries(modes).sort((a, b) => b[1] - a[1])[0];
        return [
          name,
          (t && t.category) || '—',
          String(u.count || 0),
          qaCell(u.qaPassRate),
          top ? `${top[0]}×${top[1]}` : '—',
        ];
      }),
      summary: '后续每页是该模板的实际渲染样例 + schema 备注',
    },
  }],
});

// 每个回避模板一个章节 + 一页 demo + 一页"为什么被回避"
prefs.avoidedTemplates.forEach((name, idx) => {
  const tpl = reg.get(name);
  if (!tpl || typeof tpl.fromKeyPoints !== 'function') return;

  const u = usage[name] || {};
  const failureModes = u.failureModes || {};
  const topModes = Object.entries(failureModes).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // ── 章节分隔页 ──
  slides.push({
    id:           `section-${name}`,
    type:         'section',
    sectionTitle: `${idx + 1}. ${name}`,
    sectionNumber: String(idx + 1).padStart(2, '0'),
    subtitle:     `${tpl.category}  ·  ${u.count || 0} 次调用  ·  QA ${qaCell(u.qaPassRate)}`,
  });

  // ── demo 渲染页 ──
  const kps = REPRESENTATIVE[name] || ['示例要点一: 描述说明用以展示版式排版效果', '示例要点二: 描述说明用以展示版式排版效果'];
  let layoutData;
  try {
    layoutData = tpl.fromKeyPoints(kps, { title: `${name} 样例` });
  } catch (e) {
    console.warn(`${name} fromKeyPoints 失败: ${e.message}`);
    layoutData = null;
  }

  if (layoutData) {
    slides.push({
      id:        `demo-${name}`,
      type:      'content',
      title:     `${name} — 实际渲染`,
      sectionTag: name,
      sourceRef:  `fromKeyPoints(REPRESENTATIVE.${name})`,
      layouts: [{ type: name, data: layoutData }],
    });
  }

  // ── 诊断页：为什么被回避 + 失败原因明细 ──
  slides.push({
    id:    `diag-${name}`,
    type:  'content',
    title: `${name} — 为什么被回避`,
    sectionTag: name,
    layouts: [{
      type: 'comparison',
      data: {
        left: {
          title: '当前权重',
          items: [
            `使用次数: ${u.count || 0}`,
            `QA 通过率: ${qaCell(u.qaPassRate)}`,
            `类别: ${tpl.category}`,
            `回避起点: QA < 70%`,
          ],
        },
        right: {
          title: 'Top 失败原因',
          items: topModes.length
            ? topModes.map(([k, v]) => `${k} × ${v} 次`)
            : ['暂无 failureModes 数据', '可能为旧数据，建议跑 npm run backfill:failures'],
        },
        showVS: false,
        bottomText: `恢复路径: 修正 schema/render 让 QA 回到 ≥ 95% → record-learning 自动从 avoidedTemplates 中移除`,
      },
    }],
  });
});

// 学习闭环说明
slides.push({
  id:    'note',
  type:  'content',
  title: '系统自动回避机制',
  sectionTag: '学习闭环',
  layouts: [{
    type: 'insightBanner',
    data: {
      insight: 'QA 通过率 < 70% + 使用 ≥ 5 次 → 自动加入 avoidedTemplates。template-selector 在自动选模板时给它们降权（不影响 suggestedLayout 显式指定）',
      label: '减权规则',
    },
  }],
});

// 封底两页：金句页 + thanks 页
slides.push({
  id:       'closing-quote',
  type:     'closingQuote',
  quote:    '回避不是结论，它是下一轮工程的起点。',
  author:   '薄云咨询 BRING Consulting',
  label:    '结语',
  labelEn:  'CLOSING',
});
slides.push({
  id:       'back-cover',
  type:     'backCover',
  text:     '谢谢各位',
});

const outDir = path.join(SKILL_DIR, '_temp', 'avoided-demo');
fs.mkdirSync(outDir, { recursive: true });
const dataPath = path.join(outDir, 'slides-data.json');
const outPath  = path.join(outDir, 'output.pptx');
const data = {
  meta: { title: '回避模板复盘', author: '薄云咨询', outputPath: outPath },
  slides,
};
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✅ slides-data.json: ${dataPath} (${slides.length} 页)`);

generatePptx(slides, data.meta, outPath).then(() => {
  console.log(`✅ output.pptx: ${outPath}`);
}).catch(e => { console.error('❌', e.message); process.exit(1); });
