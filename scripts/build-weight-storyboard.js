#!/usr/bin/env node
'use strict';
/**
 * scripts/build-weight-storyboard.js — 把 89 模板的权重情况生成 slides-data，
 * 通过 gen_ppt_template.js 渲染成一份"模板权重总览"PPT。
 *
 * 输出：_temp/weight-overview/slides-data.json
 *
 * 用法：
 *   node scripts/build-weight-storyboard.js
 *   node gen_ppt_template.js  # 在 _temp/weight-overview/ 下跑（或者用 BRINGPPT_SKILL_DIR 指）
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const reg   = require(path.join(SKILL_DIR, 'registry'));
const store = require(path.join(SKILL_DIR, 'lib', 'learning-store'));

const stats = store.globalRead('generation-stats.json', { templateUsage: {} });
const prefs = store.userRead('preferences.json', { preferredTemplates: [], avoidedTemplates: [] });
let learnedIds = new Set();
try { learnedIds = new Set((require(path.join(SKILL_DIR, 'validators/learned-rules.json')).promotedIds || [])); } catch {}

const usage = stats.templateUsage || {};
const pref  = new Set(prefs.preferredTemplates || []);
const avoid = new Set(prefs.avoidedTemplates || []);

// 收集每模板权重
const all = reg.list().map(t => {
  const u = usage[t.name] || {};
  // 数模板在 promoted trap 里出现的次数（按 trap.template 字段近似）
  return {
    name:           t.name,
    category:       t.category || '其他',
    isPageTemplate: !!t.isPageTemplate,
    count:          u.count || 0,
    qaPct:          u.qaPassRate != null ? Math.round(u.qaPassRate * 100) : null,
    preferred:      pref.has(t.name),
    avoided:        avoid.has(t.name),
    failureModes:   u.failureModes || {},
  };
});

// 按 category 分组
const byCat = {};
for (const t of all) {
  if (!byCat[t.category]) byCat[t.category] = [];
  byCat[t.category].push(t);
}
for (const cat of Object.keys(byCat)) byCat[cat].sort((a, b) => b.count - a.count);

// 标识符
function tag(t) {
  const flags = [];
  if (t.preferred) flags.push('★偏好');
  if (t.avoided)   flags.push('✗回避');
  if (t.isPageTemplate) flags.push('A 类');
  return flags.join(' ');
}

function qaCell(qaPct) {
  if (qaPct == null) return '—';
  let mark = '';
  if (qaPct >= 90) mark = '🟢';
  else if (qaPct >= 70) mark = '🟡';
  else mark = '🔴';
  return `${mark} ${qaPct}%`;
}

// ─── 构造 slides ──────────────────────────────────────────
const slides = [];

// 1. 封面
slides.push({
  id:       'cover',
  type:     'cover',
  title:    'BRINGPPT 89 模板权重总览',
  subtitle: '基于运行态学习数据自动生成 · v3.7.11',
  reporter: '薄云咨询 BRING Consulting',
  date:     new Date().toISOString().slice(0, 10),
});

// 2. 目录（按 category 章节）
const categories = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length);

// 3. 总览页：使用频次 Top 10（dataHighlight 不合适，用 styledTable）
const top10 = [...all].sort((a, b) => b.count - a.count).slice(0, 10);
slides.push({
  id:    'overview-top10',
  type:  'content',
  title: '使用频次 Top 10',
  sectionTag: '权重总览',
  layouts: [
    {
      type: 'styledTable',
      data: {
        headers: ['# ', '模板名', '类别', '使用次数', 'QA 通过率', '状态'],
        rows: top10.map((t, i) => [
          String(i + 1),
          t.name,
          t.category,
          String(t.count),
          qaCell(t.qaPct),
          tag(t) || '—',
        ]),
        summary: `Top 10 共占用累计生成的 ${top10.reduce((s, t) => s + t.count, 0)} 次调用`,
      },
    },
  ],
});

// 4. 低 QA / 高频踩坑页（usage ≥ 10 且 qa < 70%）
const lowQa = all.filter(t => t.count >= 10 && t.qaPct != null && t.qaPct < 70)
                 .sort((a, b) => a.qaPct - b.qaPct);
if (lowQa.length > 0) {
  slides.push({
    id:    'overview-lowqa',
    type:  'content',
    title: '低 QA 通过率模板（usage ≥ 10 & QA < 70%）',
    sectionTag: '权重总览',
    layouts: [{
      type: 'styledTable',
      data: {
        headers: ['模板名', '类别', '使用次数', 'QA 通过率', 'Top 失败原因'],
        rows: lowQa.slice(0, 10).map(t => {
          const topMode = Object.entries(t.failureModes).sort((a, b) => b[1] - a[1])[0];
          return [
            t.name,
            t.category,
            String(t.count),
            qaCell(t.qaPct),
            topMode ? `${topMode[0]}×${topMode[1]}` : '—',
          ];
        }),
        summary: `共 ${lowQa.length} 个低 QA 模板，已自动加入回避清单的: ${lowQa.filter(t => t.avoided).map(t => t.name).join(', ') || '无'}`,
      },
    }],
  });
}

// 5. 偏好 / 回避总览
const preferred = all.filter(t => t.preferred);
const avoided   = all.filter(t => t.avoided);
slides.push({
  id:    'overview-prefs',
  type:  'content',
  title: '系统自动偏好 / 回避清单',
  sectionTag: '权重总览',
  layouts: [{
    type: 'comparison',
    data: {
      left:  { title: `★ 偏好 (${preferred.length})`, items: preferred.map(t => `${t.name} · 用 ${t.count} 次 · ${qaCell(t.qaPct)}`).slice(0, 8) },
      right: { title: `✗ 回避 (${avoided.length})`, items: avoided.map(t => `${t.name} · 用 ${t.count} 次 · ${qaCell(t.qaPct)}`).slice(0, 8) },
      showVS: false,
      bottomText: `规则：使用 ≥ 10 次 且 QA ≥ 95% → 自动偏好；QA < 70% → 自动回避（v3.7.8+ 加 selector 减权）`,
    },
  }],
});

// 6. 按 category 分章节，每章一个 chapter
for (const cat of categories) {
  slides.push({
    id:           `section-${cat}`,
    type:         'section',
    sectionTitle: cat,
    sectionNumber: String(categories.indexOf(cat) + 1).padStart(2, '0'),
    subtitle:     `共 ${byCat[cat].length} 个模板`,
  });

  // 该类别下的所有模板做成一个或多个 styledTable 页（每页 ≤ 8 行避免溢出）
  const rows = byCat[cat].map(t => [
    t.name,
    String(t.count),
    qaCell(t.qaPct),
    tag(t) || '—',
  ]);
  const PER_PAGE = 8;
  const pages = Math.ceil(rows.length / PER_PAGE);
  for (let p = 0; p < pages; p++) {
    const slice = rows.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    slides.push({
      id:    `cat-${cat}-${p + 1}`,
      type:  'content',
      title: pages > 1 ? `${cat}（${p + 1}/${pages}）` : cat,
      sectionTag: cat,
      sourceRef:  `来源：~/.bringppt/learning runtime`,
      layouts: [{
        type: 'styledTable',
        data: {
          headers: ['模板名', '使用次数', 'QA 通过率', '状态'],
          rows: slice,
          summary: p === pages - 1
            ? `本类合计 ${byCat[cat].reduce((s, t) => s + t.count, 0)} 次调用`
            : '续下一页',
        },
      }],
    });
  }
}

// 7. 已升级硬规则总览（promoted traps）
if (learnedIds.size > 0) {
  slides.push({
    id:    'overview-learned',
    type:  'content',
    title: `已升级硬规则 trap (${learnedIds.size} 条)`,
    sectionTag: '学习闭环',
    sourceRef: 'validators/learned-rules.json',
    layouts: [{
      type: 'insightBanner',
      data: {
        insight: `命中这些 trap 的 slides-data 在 validate-slides 阶段直接 exit 2（无需 --strict-learning）。promote 规则：trap 累计 ≥ 5 次 → 自动升级`,
        label: '硬阻断',
      },
    }],
  });
}

// 8. 封底两页：金句页 + thanks 页
slides.push({
  id:       'closing-quote',
  type:     'closingQuote',
  quote:    '权重不是终点，它只是把猜变成看见。',
  author:   '薄云咨询 BRING Consulting',
  label:    '结语',
  labelEn:  'CLOSING',
});
slides.push({
  id:       'back-cover',
  type:     'backCover',
  text:     '谢谢各位',
});

// ─── 写出 ──────────────────────────────────────────
const outDir = path.join(SKILL_DIR, '_temp', 'weight-overview');
fs.mkdirSync(outDir, { recursive: true });
const dataPath = path.join(outDir, 'slides-data.json');
const data = {
  meta: {
    title:      'BRINGPPT 89 模板权重总览',
    author:     '薄云咨询',
    outputPath: path.join(outDir, 'output.pptx'),
  },
  slides,
};
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✅ slides-data.json 已生成: ${dataPath}`);
console.log(`   共 ${slides.length} 页`);
console.log(`   下一步: cd _temp/weight-overview && node ${path.relative(outDir, path.join(SKILL_DIR, 'gen_ppt_template.js'))}`);
