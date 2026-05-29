#!/usr/bin/env node
// build-stress-test-storyboard.js
//
// 用途：构造一个 storyboard.json，目标是
//   1) 完全覆盖 bringppt v4.0.1 所有 88 个 B 类 + 5 个非 contentSlide A 类模板
//   2) 故意加越界压测页（freeform / 超量 / 错用）
//   3) 输出 stress-test-storyboard.json，喂给 ppt-pipeline 生成 pptx
//
// 章节结构：
//   §0 引言（heroCover 由 meta 自动生成 + heroSection 由 chapter 生成）
//   §1 数据/指标型（8 个模板）
//   §2 并列/卡片型（6 个）
//   §3 流程/步骤型（11 个 + timelineWithMetrics）
//   §4 对比型（5 个）
//   §5 矩阵/框架型（16 个）
//   §6 分析/诊断型（9 个）
//   §7 咨询框架（9 个）
//   §8 项目管理型（6 个）
//   §9 叙事/引用型（11 个）
//   §10 图文/复合型（4 个）+ compositeLayout（1 个）
//   §11 逃生舱：freeform（含 3-4 个自定义视觉）
//   §12 压测：越界场景（超量 / 错用 / 缺字段）
'use strict';

const fs = require('fs');
const path = require('path');

// ── 工具：每页都用 layouts 直通；selectorReason 注释帮助阅读 ──
function p(id, title, sectionTag, layoutType, layoutData) {
  return {
    id,
    title,
    type: 'content',
    sectionTag,
    layouts: [{ type: layoutType, data: layoutData }],
  };
}

const meta = {
  title:        'BRINGPPT 模板压测报告 v4.0.3',
  titleEn:      'BRINGPPT TEMPLATE STRESS TEST',
  subtitle:     '覆盖 88 个 B 类 + 5 个 A 类 + freeform 逃生舱 + 越界场景',
  clientName:   '内部 / Stress Test',
  date:         '2026-05-15',
  reporter:     'Claude · v4.0.3',
  author:       '薄云咨询',
  audience:     'BRING 维护团队',
  includeToc:   true,
  outputPath:   __dirname + '/../../bring-suite/demo-cases/stress-test/stress-test.pptx',
};

const chapters = [];

// ─────────────────────────────────────────────────────────────────────
// §1 数据 / 指标型 (8)
// dataHighlight / heroStat / kpiDashboard / chartBar / progressBar
// progressRing / gauge / achievement
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 1,
  sectionTitle:  '数据 / 指标型',
  sectionTitleEn:'DATA & METRICS',
  sectionSubtitle: '把关键数字放到客户视线焦点',
  accent: '#003591',
  pages: [
    p('d-1', '4 个关键数字', '数据', 'dataHighlight', {
      items: [
        { number: '94', unit: '个',  label: '保留模板' },
        { number: '22', unit: '个',  label: '已淘汰模板' },
        { number: '≤ 4', unit: 's',  label: '生成耗时' },
        { number: '6',  unit: '层',  label: '质量门禁' },
      ],
    }),
    p('d-2', 'KPI 仪表盘', '数据', 'kpiDashboard', {
      kpis: [
        { value: '94',    label: '模板总数',    trend: 'up',   delta: '+0' },
        { value: '95.6%', label: 'QA 通过率',  trend: 'up',   delta: '+3.2pp' },
        { value: '1.13', label: '平均 PUE',    trend: 'down', delta: '-0.04' },
        { value: '0',    label: '硬 crash 次数', trend: 'flat' },
        { value: '17',   label: '本轮 build 次数', trend: 'up' },
        { value: '6',    label: 'A 类页面',    trend: 'flat' },
      ],
    }),
    p('d-3', '逐月 build 趋势', '数据', 'chartBar', {
      data: [{
        name:   'Build count',
        labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
        values: [12, 18, 24, 30, 41, 28, 33, 39, 45, 51, 58, 64],
      }],
      title: '2026 月度生成次数',
    }),
    p('d-4', '资源利用率', '数据', 'progressBar', {
      bars: [
        { label: 'CPU 使用率',    value: 38, max: 100, unit: '%' },
        { label: '内存使用率',    value: 67, max: 100, unit: '%' },
        { label: '模板覆盖率',    value: 94, max: 100, unit: '%', color: '003591' },
        { label: 'QA 通过率',     value: 96, max: 100, unit: '%' },
      ],
    }),
    p('d-5', '环形进度', '数据', 'progressRing', {
      rings: [
        { value: 94, max: 100, label: '模板覆盖',  unit: '%' },
        { value: 96, max: 100, label: 'QA 通过率', unit: '%' },
        { value: 87, max: 100, label: '客户满意度', unit: '%' },
      ],
    }),
    p('d-6', '关键阈值仪表', '数据', 'gauge', {
      gauges: [
        { value: 1.13, min: 1.0, max: 2.0, label: 'PUE',         unit: ''  },
        { value: 44,   min: 0,    max: 200, label: 'kW/box',     unit: 'kW'},
        { value: 96,   min: 0,    max: 100, label: 'QA 通过率',  unit: '%' },
      ],
    }),
    p('d-7', '里程碑成就', '成就', 'achievement', {
      achievements: [
        { value: '104',   label: '历史峰值模板数', sublabel: 'v3.9.x 阶段' },
        { value: '94',    label: '当前模板数',     sublabel: 'v4.0.1' },
        { value: '+8',    label: 'v4 新增',        sublabel: 'hero/freeform/...' },
        { value: '-22',   label: 'v4 淘汰',        sublabel: '冗余/低质量' },
      ],
    }),
    p('d-8', '英雄数字 — 唯一指标', '数据', 'heroStat', {
      statValue: '95.6%',
      statLabel: '本季度 QA 通过率',
      context:   '环比 +3.2pp · 同比 +12pp',
      sourceRef: '~/.bringppt/learning/global/generation-stats.json',
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §2 并列 / 卡片型 (6)
// iconList / cardGrid / threeColumn / twoColumnCards / flowerPetal / hexagonHive
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 2,
  sectionTitle:  '并列 / 卡片型',
  sectionTitleEn:'CARD GRIDS',
  accent: '#5385C5',
  pages: [
    p('c-1', '4 项核心能力 (iconList)', '并列', 'iconList', {
      items: [
        { icon: 'zap',      title: '快速生成', desc: '一份大纲，4 秒成型 PPTX' },
        { icon: 'shield',   title: '质量门禁', desc: '6 层校验，渲染前拦截' },
        { icon: 'layers',   title: '94 模板',  desc: '咨询级版式全栈覆盖' },
        { icon: 'cpu',      title: '学习闭环', desc: '失败案例自动归档复盘' },
      ],
    }),
    p('c-2', '6 卡片网格 (cardGrid)', '并列', 'cardGrid', {
      cards: [
        { title: '封面 + 章节',  desc: 'heroCover / heroSection' },
        { title: '数据型',       desc: 'dataHighlight / chartBar / heroStat' },
        { title: '并列型',       desc: 'iconList / cardGrid / threeColumn' },
        { title: '流程型',       desc: 'stepList / processFlow / timeline' },
        { title: '对比型',       desc: 'comparison / beforeAfter / lineupCompare' },
        { title: '矩阵型',       desc: 'styledTable / quadrantMap / meceLayout' },
      ],
      columns: 3,
      summary: '94 模板覆盖咨询场景全栈',
    }),
    p('c-3', '3 列定式 (threeColumn)', '并列', 'threeColumn', {
      cards: [
        { number: '1', title: 'Storyboard', desc: '把大纲转 JSON 输入 pipeline' },
        { number: '2', title: 'Converter',  desc: 'selector 选模板 + buildLayoutData' },
        { number: '3', title: 'Renderer',   desc: 'pptxgenjs 装配 + 质量门禁' },
      ],
      summary: '三阶段一条线，pipeline 总时延 ≤ 4 s',
    }),
    p('c-4', '2 列对照 (twoColumnCards)', '并列', 'twoColumnCards', {
      cards: [
        { title: 'storyboard 入口', content: '高层 chapters/pages，自动选模板，适合 LLM 直出。' },
        { title: 'slides-data 入口', content: '底层 layouts 数组，精确控制每页，适合人手设计。' },
      ],
    }),
    p('c-5', '4 瓣花形 (flowerPetal)', '并列', 'flowerPetal', {
      petals: [
        { title: '低代码',  desc: '一份 storyboard JSON 即可' },
        { title: '可学习',  desc: '失败案例自动回归' },
        { title: '可定制',  desc: 'freeform 逃生舱兜底' },
        { title: '已校验',  desc: '6 层质量门禁全 deck 通过' },
      ],
      center: 'BRING\nPPT',
    }),
    p('c-6', '六边形蜂窝 (hexagonHive)', '并列', 'hexagonHive', {
      items: [
        { title: 'docs',         desc: 'STORYBOARD-SCHEMA / bring-templates' },
        { title: 'references',   desc: 'capacity-limits / layout-selection' },
        { title: 'evals',        desc: 'run-evals 自动化契约' },
        { title: 'learning',     desc: '运行时失败模式回归' },
        { title: 'tests',        desc: 'baseline / contract / visual-88' },
        { title: 'scripts',      desc: 'doctor / prepack / lint' },
      ],
      title: 'Skill 工程体系',
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §3 流程 / 步骤型 (12)
// stepList / processFlow / timeline / phaseDiagram / staircase
// chainFlow / waveProgression / snakeFlow / arrowChain / dualTrackTimeline
// journeyMap / timelineWithMetrics
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 3,
  sectionTitle:  '流程 / 步骤型',
  sectionTitleEn:'PROCESS & STEPS',
  accent: '#80AACD',
  pages: [
    p('f-1', '5 步交付流程 (stepList)', '流程', 'stepList', {
      items: [
        { title: '需求理解',   desc: '读源文档 → 提炼 storyline' },
        { title: '大纲确认',   desc: '与客户对齐章节与页数' },
        { title: '数据装配',   desc: '把要点喂给 selector / 直传 layouts' },
        { title: '渲染生成',   desc: 'pipeline 跑 pptxgenjs 输出 pptx' },
        { title: '质量复核',   desc: 'PDF 出图 + 视觉巡检' },
      ],
    }),
    p('f-2', '横向流程 (processFlow)', '流程', 'processFlow', {
      steps: [
        { title: 'Outline',    desc: '大纲' },
        { title: 'Storyboard', desc: 'JSON' },
        { title: 'Convert',    desc: 'selector' },
        { title: 'Render',     desc: 'pptxgenjs' },
        { title: 'QA',         desc: '6 层校验' },
      ],
    }),
    p('f-3', '5 阶段时间线 (timeline)', '流程', 'timeline', {
      events: [
        { period: 'Q1', title: '基础重构',    desc: '12 列 grid + 软删除机制' },
        { period: 'Q2', title: '生态对齐',    desc: 'storyboard skill v2.0' },
        { period: 'Q3', title: '逃生舱',      desc: 'freeform 沙箱发布' },
        { period: 'Q4', title: '学习闭环',    desc: '运行时回归归档' },
        { period: 'Q5', title: 'multi-deck',   desc: '跨 deck 共享模板' },
      ],
    }),
    p('f-4', '阶段示意图 (phaseDiagram)', '流程', 'phaseDiagram', {
      phases: [
        { title: '探索',  desc: 'POC / 原型' },
        { title: '验证',  desc: '小客户灰度' },
        { title: '规模',  desc: '团队铺开' },
        { title: '优化',  desc: '学习闭环' },
      ],
    }),
    p('f-5', '阶梯上升 (staircase)', '流程', 'staircase', {
      steps: [
        { label: 'L0',  title: '手写 PPT',     desc: '完全人工' },
        { label: 'L1',  title: 'AI 草稿',      desc: 'LLM 出大纲' },
        { label: 'L2',  title: '一键转 PPT',   desc: 'bringppt 渲染' },
        { label: 'L3',  title: '学习闭环',     desc: '错误归档复盘' },
        { label: 'L4',  title: '智能 deck',    desc: '自动选模板 + 修缺陷' },
      ],
    }),
    p('f-6', '链式衔接 (chainFlow)', '流程', 'chainFlow', {
      links: [
        { title: 'Source',     desc: 'PRD / 大纲' },
        { title: 'LLM',        desc: '理解 + 切分' },
        { title: 'Storyboard', desc: 'JSON' },
        { title: 'Converter',  desc: 'selector' },
        { title: 'PPTX',       desc: '渲染' },
      ],
    }),
    p('f-7', '波浪渐进 (waveProgression)', '流程', 'waveProgression', {
      waves: [
        { label: 'P0',  desc: '种子' },
        { label: 'P1',  desc: '试点' },
        { label: 'P2',  desc: '推广' },
        { label: 'P3',  desc: '规模' },
        { label: 'P4',  desc: '反哺' },
      ],
    }),
    p('f-8', '蛇形长流程 (snakeFlow)', '流程', 'snakeFlow', {
      steps: [
        { title: '阅读源',  desc: '抽提要点' },
        { title: '判定意图', desc: '内容/对比/数据' },
        { title: '挑模板',   desc: '三层稳定性' },
        { title: '装配数据', desc: 'buildLayoutData' },
        { title: '校验',     desc: 'schema + ITEM_LIMITS' },
        { title: '渲染',     desc: 'pptxgenjs' },
        { title: '兜底',     desc: 'fallback 链' },
        { title: '出包',     desc: 'pptx + pdf' },
      ],
    }),
    p('f-9', '箭头序列 (arrowChain)', '流程', 'arrowChain', {
      items: [
        { title: '理解' },
        { title: '设计' },
        { title: '生成' },
        { title: '校验' },
        { title: '交付' },
      ],
    }),
    p('f-10', '双轨并行 (dualTrackTimeline)', '流程', 'dualTrackTimeline', {
      trackA: { title: 'AI 路线' },
      trackB: { title: '人工路线' },
      nodes: [
        { period: 'W1', a: '大纲生成', b: '需求访谈' },
        { period: 'W2', a: 'storyboard', b: '内容校对' },
        { period: 'W3', a: '一键生成',   b: '视觉精修' },
        { period: 'W4', a: '自动质检',   b: '客户对齐' },
      ],
    }),
    p('f-11', '客户旅程 (journeyMap)', '流程', 'journeyMap', {
      stages: [
        { stage: '认知',  action: '搜索/推荐', feeling: '好奇', insight: '"听说有自动生成 PPT 的工具"' },
        { stage: '试用',  action: '跑 demo', feeling: '兴奋',   insight: '"5 分钟搞定一份"' },
        { stage: '采纳',  action: '团队推广', feeling: '依赖',  insight: '"每周用 3 次"' },
        { stage: '反馈',  action: '提需求', feeling: '主人翁',  insight: '"希望加新模板"' },
      ],
    }),
    p('f-12', '带指标时间线 (timelineWithMetrics)', '流程', 'timelineWithMetrics', {
      phases: [
        { period: 'Wk 1-2', title: 'Audit',    titleCN: '盘点', notes: '94 模板归档分类' },
        { period: 'Wk 3-4', title: 'Refactor', titleCN: '重构', notes: '12 列 grid + soft-delete' },
        { period: 'Wk 5-6', title: 'Test',     titleCN: '压测', notes: '本份 deck 即产物' },
        { period: 'Wk 7',   title: 'Ship',     titleCN: '发布', notes: 'v4.0.3 进入主分支' },
      ],
      metrics: [
        { value: '94',  label: '模板覆盖' },
        { value: '6',   label: '质量门禁层数' },
        { value: '17',  label: '本轮 build 次数' },
        { value: '0',   label: '硬 crash' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §4 对比型 (5)
// comparison / beforeAfter / hourglass / lineupCompare / productMatrix
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 4,
  sectionTitle:  '对比型',
  sectionTitleEn:'COMPARISON',
  accent: '#D4A24D',
  pages: [
    p('cm-1', '基础左右对比 (comparison)', '对比', 'comparison', {
      left:  { title: 'storyboard 入口', items: ['LLM 友好', '自动选模板', '快速但粗'] },
      right: { title: 'slides-data 入口', items: ['精确控制', '人手设计', '准但慢'] },
    }),
    p('cm-2', '前后对比 (beforeAfter)', '对比', 'beforeAfter', {
      pairs: [
        { label: '模板数量', before: '116 (v3.9)', after: '94 (v4.0)' },
        { label: '冗余度',  before: '高',          after: '低' },
        { label: '逃生选项', before: '无',          after: 'freeform' },
      ],
    }),
    p('cm-3', '上下漏斗 (hourglass)', '对比', 'hourglass', {
      top:    { title: '输入域', items: ['大纲', 'PRD', '会议纪要', 'storyboard JSON'] },
      bottom: { title: '输出域', items: ['pptx', 'pdf', 'thumbs', 'metrics'] },
      pivot:  'bringppt v4.0',
    }),
    p('cm-4', 'SKU 深度对比 (lineupCompare)', '对比', 'lineupCompare', {
      columns: [
        {
          sku: 'Storyboard', tagline: 'Auto-select layouts', tagCN: '高层入口',
          options: [
            { spec: 'chapters/pages',  metric: 'JSON' },
            { spec: 'suggestedLayout', metric: '提示' },
            { spec: 'keyPoints',       metric: '要点数组' },
          ],
          utilizations: [
            { label: 'CTRL',  value: 30, max: 100, unit: '%', note: '低控制' },
            { label: 'SPEED', value: 95, max: 100, unit: '%', note: '快' },
          ],
        },
        {
          sku: 'SlidesData', tagline: 'Hand-crafted layouts', tagCN: '底层入口',
          options: [
            { spec: 'slides[].layouts', metric: '数组' },
            { spec: 'type 直传',        metric: '精确' },
            { spec: 'startY 接力',      metric: '自管理' },
          ],
          utilizations: [
            { label: 'CTRL',  value: 100, max: 100, unit: '%', note: '完全控制' },
            { label: 'SPEED', value: 50,  max: 100, unit: '%', note: '慢' },
          ],
        },
      ],
    }),
    p('cm-5', '3 档矩阵 (productMatrix)', '对比', 'productMatrix', {
      products: [
        {
          sku: 'Bronze', tagline: 'Internal report', tagCN: '内部',
          fields: [
            { label: 'TIME',   value: '< 5 min' },
            { label: 'PAGES',  value: '8-15' },
            { label: 'CHECK',  value: 'lint only' },
          ],
          idealFor: 'Quick weekly digest',
        },
        {
          sku: 'Silver', tagline: 'Customer brief', tagCN: '客户简报',
          fields: [
            { label: 'TIME',   value: '< 15 min' },
            { label: 'PAGES',  value: '15-30' },
            { label: 'CHECK',  value: '6-gate QA' },
          ],
          idealFor: 'Sales briefing',
        },
        {
          sku: 'Gold', tagline: 'Board proposal', tagCN: '董事会方案',
          badge: 'FLAGSHIP',
          fields: [
            { label: 'TIME',   value: '< 60 min' },
            { label: 'PAGES',  value: '30-60' },
            { label: 'CHECK',  value: 'QA + visual' },
          ],
          idealFor: 'C-suite proposal',
        },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §5 矩阵 / 框架型 (16)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 5,
  sectionTitle:  '矩阵 / 框架型',
  sectionTitleEn:'MATRIX & FRAMEWORK',
  accent: '#C8102E',
  pages: [
    p('m-1', '6 行评估表 (styledTable)', '矩阵', 'styledTable', {
      headers: ['模板类', '数量', '推荐场景', '兜底'],
      colWidths: [1.8, 1.0, 3.2, 2.5],
      rows: [
        ['数据/指标',    '8',  '关键 KPI 与数字',           'dataHighlight'],
        ['并列/卡片',    '6',  '3-6 个等权要素',            'iconList'],
        ['流程/步骤',    '12', '时间序列与操作链',          'stepList'],
        ['对比型',       '5',  'A vs B / 多档方案',         'twoColumnCards'],
        ['矩阵/框架',    '16', '咨询经典 2×2 与表格',       'styledTable'],
        ['分析/诊断',    '9',  'SWOT / 鱼骨 / 漏斗',        'analysisMatrix'],
      ],
      summary: '六大类 × 兜底链 = 任何输入都有可行模板',
    }),
    p('m-2', '2×2 分析矩阵 (analysisMatrix)', '矩阵', 'analysisMatrix', {
      title: '推广策略矩阵',
      cells: [
        { quadrant: 'TL', title: '低投入 · 高回报', desc: '内部 demo + 培训' },
        { quadrant: 'TR', title: '高投入 · 高回报', desc: '大客户提案' },
        { quadrant: 'BL', title: '低投入 · 低回报', desc: '随手 demo' },
        { quadrant: 'BR', title: '高投入 · 低回报', desc: '过度定制（避免）' },
      ],
      xLabel: '投入',
      yLabel: '回报',
    }),
    p('m-3', '左右括号汇总 (bracketGroup)', '矩阵', 'bracketGroup', {
      items: [
        { title: 'A 类页面', desc: '6' },
        { title: 'B 类版式', desc: '88' },
        { title: '逃生舱',   desc: 'freeform' },
      ],
      summary: 'BRINGPPT v4.0 模板版图',
    }),
    p('m-4', '颜色矩阵评分 (colorMatrix)', '矩阵', 'colorMatrix', {
      headers: ['模板', '稳定性', '美观度', '上手成本'],
      rows: [
        ['stepList',      'A',  'B', 'A'],
        ['dataHighlight', 'A',  'A', 'A'],
        ['quadrantMap',   'B',  'A', 'C'],
        ['compositeLayout', 'C', 'A', 'C'],
        ['freeform',      'B',  'A', 'D'],
      ],
    }),
    p('m-5', '约束自检 (constraintCheck)', '矩阵', 'constraintCheck', {
      constraints: [
        { name: '页数 ≤ 60',         status: 'pass', detail: '当前 ~80 页（压测特例）' },
        { name: '每页文字 ≤ 250 字', status: 'pass', detail: '由 schema warn/error 把守' },
        { name: 'PUE ≤ 1.15',         status: 'pass', detail: '渲染时间维度类比' },
        { name: '总耗时 ≤ 60s',       status: 'warn', detail: '压测页含 freeform，~70s' },
      ],
    }),
    p('m-6', '立方堆叠 (cubeStack)', '矩阵', 'cubeStack', {
      layers: [
        { title: 'L0 数据',      desc: 'storyboard JSON' },
        { title: 'L1 模板',      desc: 'B 类 88 + A 类 6' },
        { title: 'L2 引擎',      desc: 'pptxgenjs + selector' },
        { title: 'L3 学习闭环',  desc: 'errorPatterns + stats' },
      ],
    }),
    p('m-7', '层级列表 (layeredList)', '矩阵', 'layeredList', {
      layers: [
        { title: '存活',  desc: 'render 不报错' },
        { title: '可读',  desc: '不超框、不重叠' },
        { title: '匹配',  desc: '版式适配内容' },
        { title: '精彩',  desc: '视觉品味顶咨级' },
      ],
    }),
    p('m-8', 'MECE 6 维度 (meceLayout)', '矩阵', 'meceLayout', {
      items: [
        { title: '内容', desc: 'storyboard 输入' },
        { title: '设计', desc: 'selector 算法' },
        { title: '渲染', desc: 'pptxgenjs' },
        { title: '校验', desc: 'schema + visual' },
        { title: '学习', desc: 'errorPatterns' },
        { title: '运营', desc: 'doctor + 周报' },
      ],
    }),
    p('m-9', '组织架构 (orgChart)', '矩阵', 'orgChart', {
      root: { title: 'BRINGPPT v4.0.3' },
      children: [
        { title: 'A 类 (6)', children: [{ title: 'heroCover' }, { title: 'heroSection' }, { title: 'tocPage' }] },
        { title: 'B 类 (88)', children: [{ title: '数据 (8)' }, { title: '流程 (12)' }, { title: '矩阵 (16)' }] },
        { title: '逃生舱',    children: [{ title: 'freeform' }] },
      ],
    }),
    p('m-10', '金字塔 (pyramid)', '矩阵', 'pyramid', {
      levels: [
        { label: 'L4', title: '愿景',  desc: 'AI 内容操作系统' },
        { label: 'L3', title: '产品',  desc: 'bringppt skill' },
        { label: 'L2', title: '能力',  desc: '94 模板 + freeform' },
        { label: 'L1', title: '基础',  desc: 'pptxgenjs + node' },
      ],
    }),
    p('m-11', '2×2 象限地图 (quadrantMap)', '矩阵', 'quadrantMap', {
      xAxis: { label: '复杂度',    labelEn: 'COMPLEXITY' },
      yAxis: { label: '使用频率',  labelEn: 'FREQ' },
      points: [
        { label: 'dataHighlight', x: 20, y: 92, group: 'own',        sublabel: '高频低复杂' },
        { label: 'stepList',      x: 25, y: 88, group: 'own' },
        { label: 'quadrantMap',   x: 78, y: 35, group: 'own' },
        { label: 'compositeLayout', x: 85, y: 28, group: 'competitor', sublabel: '高复杂中频' },
        { label: 'freeform',      x: 95, y: 15, group: 'competitor', sublabel: '逃生舱' },
      ],
      annotations: [
        { type: 'dashed-rect', x: 10, y: 75, w: 30, h: 20, label: 'SWEET SPOT', color: 'D4A24D' },
      ],
    }),
    p('m-12', '简化象限矩阵 (quadrantMatrix)', '矩阵', 'quadrantMatrix', {
      quadrants: [
        { label: 'TL', title: '高使用 / 低成本',  desc: 'dataHighlight / stepList' },
        { label: 'TR', title: '高使用 / 高成本',  desc: 'styledTable / chartBar' },
        { label: 'BL', title: '低使用 / 低成本',  desc: 'hexagonHive' },
        { label: 'BR', title: '低使用 / 高成本',  desc: 'sankeyDiagram（已删）' },
      ],
    }),
    p('m-13', '辐射导航 (radialNav)', '矩阵', 'radialNav', {
      center: { title: 'BRINGPPT' },
      spokes: [
        { title: 'Skills' },
        { title: 'Templates' },
        { title: 'Pipeline' },
        { title: 'Learning' },
        { title: 'Tests' },
        { title: 'Docs' },
      ],
    }),
    p('m-14', '服务蓝图 (serviceBlueprint)', '矩阵', 'serviceBlueprint', {
      stages: [
        {
          name: 'Plan',
          frontstage:  '用户提需求',
          backstage:   'LLM 起草',
          support:     'storyboard skill',
        },
        {
          name: 'Build',
          frontstage:  '审稿确认',
          backstage:   'converter 装配',
          support:     '94 模板 registry',
        },
        {
          name: 'Render',
          frontstage:  '收 pptx',
          backstage:   'pptxgenjs',
          support:     '6 层质量门禁',
        },
      ],
    }),
    p('m-15', 'SWOT 网格 (swotGrid)', '矩阵', 'swotGrid', {
      strengths:  ['94 模板覆盖广', 'pipeline 端到端', '学习闭环'],
      weaknesses: ['压测能力刚启动', 'freeform 沙箱有限'],
      opportunities: ['Multi-deck 拼接', '团队 marketplace'],
      threats:    ['竞品 Beautiful.ai', '客户期望提升'],
    }),
    p('m-16', '维恩图 (vennDiagram)', '矩阵', 'vennDiagram', {
      sets: [
        { label: 'Storyboard', items: ['JSON', '章节化'] },
        { label: 'Templates',  items: ['B 类 88', '可定制'] },
        { label: 'Learning',   items: ['errorPatterns', 'stats'] },
      ],
      intersections: [
        { sets: ['Storyboard', 'Templates'], label: 'selector' },
        { sets: ['Templates',  'Learning'],  label: 'qaPassRate' },
        { sets: ['Storyboard', 'Learning'],  label: 'corrections' },
        { sets: ['Storyboard', 'Templates', 'Learning'], label: 'BRINGPPT' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §6 分析 / 诊断型 (9)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 6,
  sectionTitle:  '分析 / 诊断型',
  sectionTitleEn:'DIAGNOSTIC',
  accent: '#6B7280',
  pages: [
    p('a-1', '气泡图 (chartBubble)', '诊断', 'chartBubble', {
      data: [
        { name: 'X', values: [20, 35, 55, 75, 25] },
        { name: 'Y', values: [80, 60, 40, 30, 45], sizes: [40, 65, 80, 30, 55] },
      ],
      title: '模板使用频率 × 失败率 × 复杂度',
    }),
    p('a-2', '雷达图 (chartRadar)', '诊断', 'chartRadar', {
      data: [{
        name:   'v4.0.3',
        labels: ['稳定性','美观','灵活性','文档','社区','性能'],
        values: [92, 88, 85, 70, 50, 90],
      }],
      title: 'v4 能力雷达',
      radarStyle: 'filled',
    }),
    p('a-3', '散点图 (chartScatter)', '诊断', 'chartScatter', {
      data: [
        { name: 'X', values: [1, 2, 3, 4, 5, 6, 7, 8] },
        { name: 'Y', values: [3, 5, 8, 12, 18, 28, 45, 68] },
      ],
      title: '页数 vs 渲染耗时',
    }),
    p('a-4', '鱼骨图 (fishbone)', '诊断', 'fishbone', {
      problem: '生成失败率高',
      bones: [
        { category: '内容', causes: ['输入字段缺失', '超长文本'] },
        { category: '选模板', causes: ['suggestedLayout 错', '容量超限'] },
        { category: '渲染', causes: ['cell 溢出', 'logo 覆盖'] },
        { category: '环境', causes: ['Node 版本', 'pptxgenjs bug'] },
      ],
    }),
    p('a-5', '漏斗 (funnel)', '诊断', 'funnel', {
      stages: [
        { label: '原始 storyboard', value: 100 },
        { label: '通过 schema 校验', value: 92 },
        { label: '通过 selector',    value: 85 },
        { label: '渲染成功',         value: 82 },
        { label: '视觉巡检通过',     value: 78 },
      ],
    }),
    p('a-6', '成熟度模型 (maturityModel)', '诊断', 'maturityModel', {
      levels: [
        { stage: 'L1 临时',     desc: '靠 LLM 一次性生成，无 QA' },
        { stage: 'L2 模板化',   desc: '走 bringppt 走 schema' },
        { stage: 'L3 学习化',   desc: '错误归档自动复盘' },
        { stage: 'L4 自适应',   desc: '运行时按数据动态选模板' },
        { stage: 'L5 自治',     desc: '无人监督端到端' },
      ],
    }),
    p('a-7', '问题→方案 (problemSolution)', '诊断', 'problemSolution', {
      pairs: [
        { problem: '内容超 cell 溢出', solution: 'cellFs 自适应 + minColW' },
        { problem: '标题撞 chip',       solution: 'titleW 动态收缩' },
        { problem: '模板选错',          solution: '三层稳定性 + fallback 链' },
      ],
    }),
    p('a-8', '桑基图 (sankeyDiagram)', '诊断', 'sankeyDiagram', {
      flows: [
        { from: '所有输入',        to: 'schema OK',    value: 92 },
        { from: '所有输入',        to: 'schema FAIL',  value: 8 },
        { from: 'schema OK',       to: 'selector OK',  value: 85 },
        { from: 'schema OK',       to: 'fallback',     value: 7 },
        { from: 'selector OK',     to: '渲染 OK',      value: 82 },
        { from: 'selector OK',     to: '渲染 FAIL',    value: 3 },
      ],
    }),
    p('a-9', '龙卷风敏感性 (tornadoChart)', '诊断', 'tornadoChart', {
      factors: [
        { label: '模板数量',  low: -8,  high: 12 },
        { label: '字号策略',  low: -5,  high: 8  },
        { label: '列宽自定',  low: -3,  high: 10 },
        { label: '学习闭环',  low: -2,  high: 15 },
      ],
      unit: 'pp · QA 通过率',
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §7 咨询框架 (9)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 7,
  sectionTitle:  '咨询框架',
  sectionTitleEn:'CONSULTING FRAMEWORKS',
  accent: '#2D7A4A',
  pages: [
    p('cf-1', '安索夫矩阵 (ansoffMatrix)', '咨询', 'ansoffMatrix', {
      title:  '产品-市场扩张策略',
      cells: {
        existing_existing: { title: '市场渗透',  desc: '现有团队推广 v4' },
        existing_new:      { title: '市场开发',  desc: '拓展到新行业客户' },
        new_existing:      { title: '产品开发',  desc: '加新模板' },
        new_new:           { title: '多元化',    desc: '跨产品（excel/word）' },
      },
    }),
    p('cf-2', '客户分群 (customerSegmentation)', '咨询', 'customerSegmentation', {
      segments: [
        { name: '咨询师',  size: '40%', need: '客户提案' },
        { name: 'PM',      size: '30%', need: '内部周报' },
        { name: '销售',    size: '20%', need: '客户简报' },
        { name: '教师',    size: '10%', need: '课程讲义' },
      ],
    }),
    p('cf-3', '决策树 (decisionTree)', '咨询', 'decisionTree', {
      root: { title: '内容类型?' },
      branches: [
        { label: '数据', node: { title: 'dataHighlight / chartBar' } },
        { label: '流程', node: { title: 'stepList / processFlow' } },
        { label: '对比', node: { title: 'comparison / lineupCompare' } },
        { label: '其他', node: { title: 'iconList / freeform' } },
      ],
    }),
    p('cf-4', '问题树 (issueTree)', '咨询', 'issueTree', {
      root: { title: '如何提升 QA 通过率?' },
      branches: [
        { title: '输入侧', children: [{ title: '严格 schema' }, { title: 'LLM prompt 改进' }] },
        { title: '处理侧', children: [{ title: '选模板算法' }, { title: 'fallback 链' }] },
        { title: '输出侧', children: [{ title: '视觉巡检' }, { title: '回归测试' }] },
      ],
    }),
    p('cf-5', '风险矩阵 (riskMatrix)', '咨询', 'riskMatrix', {
      risks: [
        { name: 'freeform 沙箱逃逸', prob: 'low',    impact: 'high',   mitigation: '禁用 require/eval' },
        { name: 'pptxgenjs 版本破坏', prob: 'medium', impact: 'high',   mitigation: 'lock 4.0.1' },
        { name: '模板视觉退化',       prob: 'medium', impact: 'medium', mitigation: '视觉回归测试' },
        { name: 'LLM 输入 fabricate',  prob: 'high',   impact: 'low',    mitigation: 'grounding check' },
      ],
    }),
    p('cf-6', 'SCQA 叙事 (scqaNarrative)', '咨询', 'scqaNarrative', {
      situation:  '团队每周生成 30+ PPT，手工耗时 8h/周。',
      complication: 'LLM 直出文本可读，但视觉不达咨询品味。',
      question:    '能否做到 LLM 友好 + 咨询级视觉?',
      answer:      'BRINGPPT v4：模板系统 + 学习闭环 + 逃生舱。',
    }),
    p('cf-7', '干系人地图 (stakeholderMap)', '咨询', 'stakeholderMap', {
      stakeholders: [
        { name: '团队 PM',    power: 'high', interest: 'high', sublabel: '强推动' },
        { name: '设计师',     power: 'medium', interest: 'high', sublabel: '协作' },
        { name: '一线咨询师', power: 'low',  interest: 'high', sublabel: '核心用户' },
        { name: '客户高管',   power: 'high', interest: 'low',  sublabel: '终端消费者' },
      ],
    }),
    p('cf-8', '三层时间轴 (threeHorizons)', '咨询', 'threeHorizons', {
      horizons: [
        { label: 'H1 当前',  title: '94 模板基线',  desc: '保住现有用户' },
        { label: 'H2 近期',  title: 'multi-deck',   desc: '跨 deck 重用' },
        { label: 'H3 远期',  title: '内容操作系统', desc: '跨产品语义' },
      ],
    }),
    p('cf-9', '价值驱动树 (valueDriverTree)', '咨询', 'valueDriverTree', {
      root: { title: '团队 PPT 产出价值' },
      drivers: [
        { name: '速度',  weight: 0.4, subDrivers: ['模板速率', '工具熟练度'] },
        { name: '质量',  weight: 0.35, subDrivers: ['模板覆盖', 'QA 严密'] },
        { name: '一致性', weight: 0.25, subDrivers: ['品牌规范', '权限管理'] },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §8 项目管理型 (6)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 8,
  sectionTitle:  '项目管理型',
  sectionTitleEn:'PROJECT MGMT',
  accent: '#7C3AED',
  pages: [
    p('pm-1', '检查清单 (checklist)', '项目', 'checklist', {
      items: [
        { text: '模板覆盖 ≥ 80',          done: true },
        { text: '所有 type 字段对齐',     done: true },
        { text: 'freeform 沙箱无逃逸',    done: true },
        { text: '视觉回归 ≥ 88 页',        done: false },
        { text: 'CI 中加 contract test',  done: false },
      ],
    }),
    p('pm-2', '甘特图 (ganttChart)', '项目', 'ganttChart', {
      tasks: [
        { name: 'Audit',     start: 1, duration: 2, lane: 'Plan' },
        { name: 'Refactor',  start: 2, duration: 3, lane: 'Build' },
        { name: 'Test',      start: 4, duration: 2, lane: 'QA' },
        { name: 'Ship',      start: 6, duration: 1, lane: 'Release' },
      ],
      weeks: ['W1','W2','W3','W4','W5','W6','W7'],
    }),
    p('pm-3', '多项目卡 (multiProjectCards)', '项目', 'multiProjectCards', {
      projects: [
        { name: 'v4.0.0 重构',  status: 'done',       progress: 100, owner: 'Claude', dueDate: '5-15' },
        { name: 'storyboard v2', status: 'done',      progress: 100, owner: 'Claude', dueDate: '5-15' },
        { name: '压测 deck',     status: 'in-progress', progress: 65, owner: 'Claude', dueDate: '5-15' },
        { name: 'multi-deck',    status: 'planned',     progress: 0,   owner: 'TBD',   dueDate: 'Q3' },
      ],
    }),
    p('pm-4', '阶段甘特 (phasedGantt)', '项目', 'phasedGantt', {
      phases: [
        { name: '规划', tasks: [
          { name: 'Audit', start: 1, duration: 1 },
          { name: 'Spec',  start: 2, duration: 1 },
        ]},
        { name: '开发', tasks: [
          { name: 'Refactor', start: 3, duration: 2 },
          { name: 'New tpl',  start: 4, duration: 1 },
        ]},
        { name: '验收', tasks: [
          { name: 'Stress test', start: 5, duration: 2 },
        ]},
      ],
    }),
    p('pm-5', '进度列表 (progressList)', '项目', 'progressList', {
      items: [
        { label: '模板审计',    value: 100, max: 100 },
        { label: '软删除机制',  value: 100, max: 100 },
        { label: '逃生舱',      value: 100, max: 100 },
        { label: '压测 deck',    value: 80,  max: 100 },
        { label: '视觉回归',     value: 30,  max: 100 },
      ],
    }),
    p('pm-6', '季度计划 (quarterlyPlan)', '项目', 'quarterlyPlan', {
      quarters: [
        { quarter: 'Q1', themes: ['基础重构'],   keyResults: ['12 列 grid', '软删除'] },
        { quarter: 'Q2', themes: ['生态对齐'],   keyResults: ['storyboard v2', 'eval 自动化'] },
        { quarter: 'Q3', themes: ['Multi-deck'], keyResults: ['跨 deck 复用', 'marketplace'] },
        { quarter: 'Q4', themes: ['智能化'],     keyResults: ['自适应选模板', '自修复'] },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §9 叙事 / 引用型 (11)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 9,
  sectionTitle:  '叙事 / 引用型',
  sectionTitleEn:'NARRATIVE & QUOTE',
  accent: '#0F766E',
  pages: [
    p('n-1', '行动标题页 (actionTitleSlide)', '叙事', 'actionTitleSlide', {
      action: '本节回答 3 个问题',
      bullets: [
        '为什么需要模板系统?',
        '94 模板怎么挑?',
        '不够用时怎么办?',
      ],
    }),
    p('n-2', '案例方框 (caseBox)', '叙事', 'caseBox', {
      caseTitle: 'LiquidEdge AI POD',
      situation: '客户需要单箱液冷算力 GPU 方案的提案',
      action:    '用 bringppt v4 重做 19 页 deck',
      result:    '4 秒生成 + 0 渲染失败 + 3 处视觉修复后达到客户预期',
    }),
    p('n-3', '概念云 (cloudConcept)', '叙事', 'cloudConcept', {
      clouds: [
        { keyword: '速度',        desc: '4 秒 / 60 页' },
        { keyword: '质量',        desc: '6 层质量门禁' },
        { keyword: '覆盖',        desc: '94 模板' },
        { keyword: '逃生舱',      desc: 'freeform' },
        { keyword: '学习闭环',    desc: 'errorPatterns' },
      ],
      title: 'BRINGPPT 关键词',
    }),
    p('n-4', '执行摘要 (executiveSummary)', '叙事', 'executiveSummary', {
      headline: 'BRINGPPT v4 把 PPT 从 8h/周降到 30min/周',
      points: [
        '94 个咨询级模板覆盖全栈场景',
        '6 层质量门禁拦截 90%+ 视觉缺陷',
        'freeform 逃生舱覆盖剩余 10% 长尾',
        '学习闭环让错误不再重复出现',
      ],
      callout: '关键证据：本份 80 页压测 deck 由 v4.0.3 自动生成，整 deck 渲染 < 70s。',
    }),
    p('n-5', '英雄结尾页 (heroClosing — 作为 layout)', '叙事', 'heroClosing', {
      headline: '让算力建在 GPU 的旁边',
      subline:  'BUILT WHERE GPUs LIVE · LIVE IN EIGHT WEEKS',
      cta: [
        '94 模板覆盖咨询级版式',
        '学习闭环让错误不再重复',
        'freeform 逃生舱托底长尾',
      ],
    }),
    p('n-6', '英雄引用 (heroQuote)', '叙事', 'heroQuote', {
      quote:  '未来的竞争，不是公司之间，而是工作流之间。',
      author: '匿名',
      source: '咨询白皮书摘录',
    }),
    p('n-7', '冲击式提问 (impactQuestion)', '叙事', 'impactQuestion', {
      question: '如果每周省下 7 小时 PPT 时间，你的团队会用来做什么?',
      followUp: '把这一小问题，写进本周复盘。',
    }),
    p('n-8', '洞察横幅 (insightBanner)', '叙事', 'insightBanner', {
      insight: '94 模板 + 1 逃生舱 + 6 层质量门禁 = 咨询级 PPT 工厂',
      label:   '核心洞察',
      style:   'blue',
    }),
    p('n-9', '关键词高亮 (keywordHighlight)', '叙事', 'keywordHighlight', {
      text: [
        { content: '我们把 PPT 生成的核心难题归纳为三个词：' },
        { content: '速度',  highlight: 'FFFF00', bold: true },
        { content: ' / ' },
        { content: '质量',  highlight: 'FFFF00', bold: true },
        { content: ' / ' },
        { content: '逃生舱', highlight: 'FFFF00', bold: true },
        { content: '。' },
      ],
    }),
    p('n-10', '引用横幅 (quoteBanner)', '叙事', 'quoteBanner', {
      quote:  '工具的价值，不在它能做什么，而在它能让人不做什么。',
      author: '生产力宣言',
    }),
    p('n-11', '强调引用 (quoteEmphasis)', '叙事', 'quoteEmphasis', {
      quote: '"我们写得越好的 storyboard，bringppt 输出就越接近作品。"',
      author: 'BRING 维护团队',
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §10 图文 / 复合型 (5)
// calloutAnnotation / dualPanel / moduleOverview / sidebarLabel / compositeLayout
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 10,
  sectionTitle:  '图文 / 复合型',
  sectionTitleEn:'MIXED LAYOUT',
  accent: '#DC2626',
  pages: [
    p('mx-1', '标注气泡 (calloutAnnotation)', '复合', 'calloutAnnotation', {
      callouts: [
        { x: 1.5, y: 2.0, w: 2.5, h: 0.6, text: '入口：storyboard JSON' },
        { x: 4.5, y: 2.0, w: 2.5, h: 0.6, text: '中枢：selector' },
        { x: 1.5, y: 3.5, w: 2.5, h: 0.6, text: '校验：schema' },
        { x: 4.5, y: 3.5, w: 2.5, h: 0.6, text: '出口：pptxgenjs' },
      ],
      title: 'pipeline 总览',
    }),
    p('mx-2', '双面板对照 (dualPanel)', '复合', 'dualPanel', {
      left:  { title: 'storyboard',   body: '{ meta, chapters }', label: '高层' },
      right: { title: 'slides-data',  body: '{ meta, slides[]  }', label: '底层' },
    }),
    p('mx-3', '模块总览 (moduleOverview)', '复合', 'moduleOverview', {
      modules: [
        { title: 'storyboard-converter', desc: '高层 → 底层', stack: '380 行' },
        { title: 'template-selector',    desc: '三层稳定性', stack: '650 行' },
        { title: 'ppt-pipeline',         desc: 'graceful 渲染', stack: '470 行' },
        { title: 'lib/*',                desc: '工具集',     stack: '~2k 行' },
      ],
    }),
    p('mx-4', '侧栏标签 (sidebarLabel)', '复合', 'sidebarLabel', {
      label: '本节小结',
      cards: [
        { title: '准入', content: '94 模板挂在 registry 上' },
        { title: '选优', content: 'selector 三层把守' },
        { title: '兜底', content: 'fallback 链 + freeform' },
        { title: '复盘', content: 'errorPatterns 归档' },
      ],
    }),
    p('mx-5', '复合页 (compositeLayout)', '复合', 'compositeLayout', {
      grid: '2x2',
      blocks: [
        { title: '内容',  body: 'storyboard 是输入',  accentColor: '003591' },
        { title: '模板',  body: '94 个 + 逃生舱',     accentColor: '5385C5' },
        { title: '质量',  body: '6 层门禁',           accentColor: '80AACD' },
        { title: '学习',  body: 'errorPatterns',      accentColor: 'D4A24D' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §11 逃生舱：freeform (3 个自定义视觉)
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 11,
  sectionTitle:  '逃生舱：freeform',
  sectionTitleEn:'ESCAPE HATCH',
  accent: '#EA580C',
  pages: [
    p('ff-1', '自定义决策树 (freeform · 决策树)', '逃生舱', 'freeform', {
      renderCode: `
        const cx = 5, cy0 = 1.4;
        // 根节点
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx-1, y: cy0, w: 2, h: 0.5, fill: { color: infra.C.PRIMARY }, line: { color: infra.C.PRIMARY } });
        slide.addText('Content type?', { x: cx-1, y: cy0, w: 2, h: 0.5, fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
        const branches = [
          { x: 1.0, label: 'data',       node: 'dataHighlight' },
          { x: 3.4, label: 'process',    node: 'stepList' },
          { x: 5.8, label: 'comparison', node: 'comparison' },
          { x: 8.2, label: 'other',      node: 'iconList' };
        // (above intentionally invalid — wraps to test fallback)
      `,
      fallback: {
        type: 'twoColumnCards',
        data: { cards: [
          { title: 'Decision Tree', content: 'Custom freeform 渲染失败示意 — fallback 已接管。' },
          { title: '原因',          content: 'renderCode 中有语法错误（缺右花括号）— sandbox 抛错被 catch。' },
        ]},
      },
    }),
    p('ff-2', '自定义时间轴 (freeform · 时间轴)', '逃生舱', 'freeform', {
      renderCode: `
        const y = 2.5;
        slide.addShape(pres.shapes.LINE, { x: 0.8, y: y, w: 8.4, h: 0, line: { color: infra.C.PRIMARY, width: 3 } });
        const events = [
          { x: 1.2, label: 'v3.0', desc: '初版' },
          { x: 3.0, label: 'v3.7', desc: '104 模板' },
          { x: 5.0, label: 'v3.9', desc: 'hero 系列' },
          { x: 7.0, label: 'v4.0', desc: '重构 / 逃生舱' },
          { x: 8.8, label: 'v4.1', desc: 'multi-deck' },
        ];
        events.forEach(e => {
          slide.addShape(pres.shapes.OVAL, { x: e.x - 0.12, y: y - 0.12, w: 0.24, h: 0.24, fill: { color: infra.C.ACCENT || infra.C.PRIMARY }, line: { color: infra.C.PRIMARY } });
          slide.addText(e.label, { x: e.x - 0.5, y: y - 0.55, w: 1, h: 0.35, fontSize: 12, bold: true, color: infra.C.PRIMARY, align: 'center' });
          slide.addText(e.desc,  { x: e.x - 0.6, y: y + 0.15, w: 1.2, h: 0.35, fontSize: 9,  color: '666666',          align: 'center' });
        });
      `,
      fallback: { type: 'timeline', data: { events: [{ period: 'v3', title: '初版' }, { period: 'v4', title: '重构' }] } },
    }),
    p('ff-3', '自定义热力 (freeform · 数字网格)', '逃生舱', 'freeform', {
      renderCode: `
        const xs = [1, 2.5, 4, 5.5, 7, 8.5];
        const ys = [1.5, 2.5, 3.5];
        const vals = [[0.9,0.7,0.5,0.3,0.6,0.2],[0.6,0.95,0.8,0.4,0.7,0.55],[0.3,0.5,0.85,0.65,0.45,0.7]];
        ys.forEach((y, ri) => xs.forEach((x, ci) => {
          const v = vals[ri][ci];
          const alpha = Math.round((1 - v) * 90);
          slide.addShape(pres.shapes.RECTANGLE, { x: x - 0.55, y: y - 0.35, w: 1.1, h: 0.7, fill: { color: infra.C.PRIMARY, transparency: alpha }, line: { color: 'FFFFFF', width: 1 } });
          slide.addText((v * 100).toFixed(0) + '%', { x: x - 0.55, y: y - 0.35, w: 1.1, h: 0.7, fontSize: 13, bold: true, color: v > 0.6 ? 'FFFFFF' : infra.C.PRIMARY, align: 'center', valign: 'middle' });
        }));
        slide.addText('Custom 3×6 heatmap (freeform demo)', { x: 0.5, y: 4.3, w: 9, h: 0.4, fontSize: 11, italic: true, color: '666666', align: 'center' });
      `,
      fallback: { type: 'styledTable', data: { headers: ['Row','C1','C2','C3','C4','C5','C6'], rows: [['R1','90%','70%','50%','30%','60%','20%']] } },
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §12 压测：越界场景（超量 / 错用 / 缺字段）
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber: 12,
  sectionTitle:  '压测：越界与错用',
  sectionTitleEn:'STRESS · OUT-OF-BOUNDS',
  accent: '#C8102E',
  pages: [
    // 超量 — cardGrid 20 项（schema max=12）
    p('s-1', '超量：20 卡 cardGrid (max=12)', '压测', 'cardGrid', {
      cards: Array.from({length: 20}, (_, i) => ({
        title:  '卡 ' + (i + 1),
        desc:   '故意超出 schema 上限 12 — 应被 selector 静默降级或质量门禁警告。',
      })),
      columns: 5,
      summary: '预期：要么 selector 拒绝，要么部分卡被截断',
    }),
    // 超量 — stepList 12 步（schema max=7）
    p('s-2', '超量：12 步 stepList (max=7)', '压测', 'stepList', {
      items: Array.from({length: 12}, (_, i) => ({
        title: '步骤 ' + (i + 1),
        desc:  '这是为了让步骤数超出 stepList 容量上限的填充内容。',
      })),
    }),
    // 超量 — styledTable 15 行 × 10 列
    p('s-3', '超量：styledTable 15×10', '压测', 'styledTable', {
      headers: Array.from({length: 10}, (_, i) => 'C' + (i + 1)),
      rows: Array.from({length: 15}, (_, r) => Array.from({length: 10}, (_, c) => 'r' + (r + 1) + 'c' + (c + 1) + ' 长内容')),
      summary: '15 行 × 10 列：模板能扛多大表?',
    }),
    // 错用 — 纯数据放 iconList
    p('s-4', '错用：把 KPI 放 iconList', '压测', 'iconList', {
      items: [
        { icon: 'chart',  title: '95.6%', desc: 'QA 通过率' },
        { icon: 'chart',  title: '94',    desc: '模板总数' },
        { icon: 'chart',  title: '1.13',  desc: 'PUE' },
      ],
    }),
    // 错用 — 流程内容放 comparison
    p('s-5', '错用：流程内容放 comparison', '压测', 'comparison', {
      left:  { title: '左', items: ['步骤 1', '步骤 2', '步骤 3', '步骤 4', '步骤 5'] },
      right: { title: '右', items: ['步骤 6', '步骤 7'] },
    }),
    // 缺字段 — quadrantMap.points 为空
    p('s-6', '缺字段：quadrantMap.points 为空', '压测', 'quadrantMap', {
      xAxis: { label: 'X' },
      yAxis: { label: 'Y' },
      points: [],
    }),
    // 缺字段 — heroStat 无 statValue
    {
      id: 's-7',
      title: '缺字段：heroStat 无 statValue',
      type: 'heroStat',
      sectionTag: '压测',
      // statValue 故意不传
      statLabel: '应触发 schema warning',
      context:   '渲染时可能空白或回退',
    },
    // 超长文本 — heroQuote
    p('s-8', '超长文本：heroQuote 超 200 字', '压测', 'heroQuote', {
      quote:  '在持续高强度的咨询交付场景中，每周需要产出多份高质量的客户级 PPT 文档，这对个人时间精力以及团队协作配合都构成显著挑战。传统的手工 PPT 制作流程，从大纲整理、版式设计、视觉精修到最终交付，平均消耗 4 至 8 小时不等。即便借助 LLM 辅助生成，多数情况下也只能解决"内容草稿"这一前置环节，最终的视觉品味与品牌一致性仍需大量返工。',
      author: '虚构的咨询师',
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// 写入 storyboard 文件
// ─────────────────────────────────────────────────────────────────────
// 自动定位 bring-suite/demo-cases 目录（mac 实路径 or sandbox 路径）
const OUT_CANDIDATES = [
  '/Users/james_ouyang/产品与skills/bring-suite/demo-cases/stress-test',
  '/sessions/sharp-wonderful-bardeen/mnt/产品与skills/bring-suite/demo-cases/stress-test',
];
const outDir = OUT_CANDIDATES.find(p => {
  try { fs.mkdirSync(p, { recursive: true }); return true; }
  catch { return false; }
}) || OUT_CANDIDATES[0];

meta.outputPath = path.join(outDir, 'stress-test.pptx');

const storyboard = { meta, chapters };
const outJson = path.join(outDir, 'stress-test-storyboard.json');
fs.writeFileSync(outJson, JSON.stringify(storyboard, null, 2));
console.log('✅ storyboard written: ' + outJson);
console.log('   chapters: ' + chapters.length);
console.log('   total pages: ' + chapters.reduce((s, c) => s + c.pages.length, 0));
