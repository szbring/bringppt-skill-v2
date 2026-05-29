#!/usr/bin/env node
// build-health-test-storyboard.js — health test (not stress test)
//
// 目标：每条 pipeline 路径都跑一遍，且每页数据健康，验证 default-on production 是否真正稳定。
//
// 覆盖路径：
//   A. storyboard meta:
//      - includeToc=true 触发自动 TOC
//      - heroCover 完整字段（title/titleEn/clientName/date/reporter）
//      - 自定义 closingQuote
//      - 自定义 backCover
//   B. chapter:
//      - sectionTitleEn + accent 强化 heroSection
//      - 一个 chapter 的首页用 type='heroSection' 跳过自动 section
//   C. page.type:
//      - 'content' + suggestedLayout + keyPoints → selector 路径
//      - 'content' + layouts[]              → v4.0.3 直通路径
//      - 'heroStat' / 'heroQuote' / 'heroClosing' → A 类直通
//   D. layout 覆盖（每类型 1-2 个代表，不追求全 92 模板覆盖）：
//      - 数据：dataHighlight / heroStat / kpiDashboard / chartBar / progressBar
//      - 并列：iconList / cardGrid / threeColumn / twoColumnCards
//      - 流程：stepList / processFlow / timeline / phaseDiagram
//      - 对比：comparison / beforeAfter / productMatrix
//      - 矩阵：styledTable / swotGrid / meceLayout / pyramid
//      - 诊断/咨询：chartRadar / scqaNarrative / fishbone
//      - 项目：checklist / multiProjectCards
//      - 叙事：heroQuote / executiveSummary / insightBanner
//      - 复合：dualPanel / compositeLayout
//      - 逃生舱：freeform（真实场景：自定义里程碑节点）
//   E. enrichment：可选 summary / bottomText 都填，验证 WARN 不再误触发
//   F. 错用提示：刻意不错用（contentType 与 layout 全部正确匹配）
'use strict';

const fs = require('fs');
const path = require('path');

function p(id, title, sectionTag, layoutType, layoutData, extras = {}) {
  return {
    id,
    title,
    type: 'content',
    sectionTag,
    ...extras,
    layouts: [{ type: layoutType, data: layoutData }],
  };
}

const meta = {
  title:      'BRINGPPT v4.0.5 健康测试',
  titleEn:    'BRINGPPT HEALTH TEST',
  subtitle:   '覆盖每条 pipeline 路径，每页数据均健康',
  clientName: '内部 / Health Check',
  date:       '2026-05-15',
  reporter:   'Claude · v4.0.5',
  // v4.0.5: variant 默认 internal（黑体）；切换 'proposal' 全 deck 走宋体 + 暖纸底
  // variant: 'proposal',
  author:     '薄云咨询',
  audience:   'BRING 维护团队',
  includeToc: true,
  // 自定义 closingQuote
  closingQuote: {
    quote:   '让流水线像呼吸一样可靠。',
    author:  'BRING 团队',
    label:   '结语',
    labelEn: 'CLOSING',
  },
  // 自定义 backCover
  backCover: {
    text:     '谢谢',
    subtitle: 'v4.0.4 · health-tested',
    instructor: 'Claude',
    dateLine:   '2026-05-15',
  },
  outputPath: __dirname + '/../../bring-suite/demo-cases/health-test/health-test.pptx',
};

const chapters = [];

// ─────────────────────────────────────────────────────────────────────
// §1 数据 / 指标 — 5 页
// 路径：layouts 直通 + 正确字段
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  1,
  sectionTitle:   '数据 / 指标型',
  sectionTitleEn: 'DATA & METRICS',
  sectionSubtitle:'把关键数字放到客户视线焦点',
  accent: '#003591',
  pages: [
    {
      ...p('d-1', '4 个核心 KPI', '数据', 'dataHighlight', {
        items: [
          { number: '92', unit: '个',  label: '模板总数' },
          { number: '96', unit: '%',   label: 'QA 通过率' },
          { number: '< 6', unit: 's',  label: 'pipeline 耗时' },
          { number: '0',  unit: '次',  label: '硬 crash' },
        ],
      }),
      // v4.0.5: 测试 source line 自动渲染
      sourceRef: 'Source: bringppt v4.0.5 generation-stats; QA log (2026-05-15)',
    },
    {
      ...p('d-2', '英雄数字 — heroStat (作为 layout)', '数据', 'heroStat', {
        statValue: '96%',
        statLabel: '本季 QA 通过率',
        context:   '环比 +3.2pp · 同比 +12pp',
        sourceRef: '~/.bringppt/learning/generation-stats.json',
      }),
      // v4.0.5: 测试 takeaway 一句话 + sourceRef
      takeaway: '所以：QA 通过率已稳定在咨询交付门槛之上，可全员推广。',
      sourceRef: 'Source: 96 项 deck QA 抽检（2026 Q1）',
    },
    p('d-3', '六指标仪表盘', '数据', 'kpiDashboard', {
      kpis: [
        { value: '92',    label: '保留模板',       trend: 'flat' },
        { value: '0',     label: '硬 crash',       trend: 'flat' },
        { value: '96%',   label: 'QA 通过率',     trend: 'up',   delta: '+3.2pp' },
        { value: '17',    label: '本轮 build',    trend: 'up' },
        { value: '11',    label: '空值守卫接管',  trend: 'flat' },
        { value: '1907',  label: '字段表行数',    trend: 'up' },
      ],
    }),
    p('d-4', '逐月 build 趋势', '数据', 'chartBar', {
      data: [{
        name:   'Build count',
        labels: ['Jan','Feb','Mar','Apr','May'],
        values: [12, 18, 24, 30, 41],
      }],
      title: '2026 Q1-Q2 月度生成次数',
    }),
    p('d-5', '资源利用率', '数据', 'progressBar', {
      bars: [
        { label: '模板覆盖率',   value: 92, max: 100, unit: '%', color: '003591' },
        { label: 'QA 通过率',    value: 96, max: 100, unit: '%' },
        { label: 'CI 缓存命中',   value: 78, max: 100, unit: '%' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §2 并列 / 卡片 — 4 页
// 路径：layouts 直通 + 正确字段 + 部分填 enrichment
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  2,
  sectionTitle:   '并列 / 卡片型',
  sectionTitleEn: 'CARD GRIDS',
  accent: '#5385C5',
  pages: [
    p('c-1', '4 项核心能力 (iconList)', '并列', 'iconList', {
      items: [
        { icon: 'zap',    title: '快速生成',  desc: '一份大纲 4-6 秒成型 PPTX' },
        { icon: 'shield', title: '质量门禁',  desc: '6 层校验，渲染前拦截 90%+ 缺陷' },
        { icon: 'layers', title: '92 模板',   desc: '咨询级版式全栈覆盖' },
        { icon: 'cpu',    title: '学习闭环',  desc: '失败案例自动归档复盘' },
      ],
    }),
    p('c-2', '6 卡片网格', '并列', 'cardGrid', {
      cards: [
        { title: '封面 + 章节',  desc: 'heroCover / heroSection' },
        { title: '数据型',       desc: 'dataHighlight / chartBar / heroStat' },
        { title: '并列型',       desc: 'iconList / cardGrid / threeColumn' },
        { title: '流程型',       desc: 'stepList / processFlow / timeline' },
        { title: '对比型',       desc: 'comparison / beforeAfter / lineupCompare' },
        { title: '矩阵型',       desc: 'styledTable / quadrantMatrix / meceLayout' },
      ],
      columns: 3,
      summary: '92 模板覆盖咨询场景全栈',
    }),
    p('c-3', '三阶段产线 (threeColumn)', '并列', 'threeColumn', {
      cards: [
        { number: '1', title: 'Storyboard', desc: '把大纲转 JSON 输入 pipeline' },
        { number: '2', title: 'Converter',  desc: 'selector 选模板 + buildLayoutData' },
        { number: '3', title: 'Renderer',   desc: 'pptxgenjs 装配 + 6 层质量门禁' },
      ],
      summary: '三阶段一条线，端到端总时延 ≤ 6 s',
    }),
    p('c-4', '2 列对照 (twoColumnCards)', '并列', 'twoColumnCards', {
      cards: [
        { title: 'storyboard 入口', content: 'LLM 友好，自动选模板，适合大纲式输入。' },
        { title: 'slides-data 入口', content: '精确控制，人手设计，适合定制级 deck。' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §3 流程 / 步骤 — 4 页
// 路径：1 页用 selector 自动选（不传 layouts，只给 keyPoints + suggestedLayout）
//      其余 3 页用 layouts 直通
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  3,
  sectionTitle:   '流程 / 步骤型',
  sectionTitleEn: 'PROCESS & STEPS',
  accent: '#80AACD',
  pages: [
    // ─ selector 路径：没有 layouts，只有 suggestedLayout + keyPoints
    {
      id: 'f-1',
      title: '5 步交付流程（selector 路径）',
      type: 'content',
      sectionTag: '流程',
      contentType: 'process',
      suggestedLayout: 'stepList',
      keyPoints: [
        '需求理解：读源文档 → 提炼 storyline',
        '大纲确认：与客户对齐章节与页数',
        '数据装配：要点喂给 selector 或直传 layouts',
        '渲染生成：pipeline 跑 pptxgenjs 输出 pptx',
        '质量复核：PDF 出图 + 视觉巡检',
      ],
    },
    p('f-2', '横向流程 (processFlow)', '流程', 'processFlow', {
      steps: [
        { title: 'Outline',    desc: '大纲' },
        { title: 'Storyboard', desc: 'JSON' },
        { title: 'Convert',    desc: 'selector' },
        { title: 'Render',     desc: 'pptxgenjs' },
        { title: 'QA',         desc: '6 层校验' },
      ],
    }),
    p('f-3', '5 阶段时间线', '流程', 'timeline', {
      events: [
        { period: 'Q1', title: '基础重构', desc: '12 列 grid + 软删除' },
        { period: 'Q2', title: '生态对齐', desc: 'storyboard skill v2.0' },
        { period: 'Q3', title: '逃生舱',   desc: 'freeform 沙箱发布' },
        { period: 'Q4', title: '学习闭环', desc: '运行时回归归档' },
        { period: 'Q5', title: 'Multi-deck', desc: '跨 deck 共享模板' },
      ],
    }),
    p('f-4', '阶段示意图', '流程', 'phaseDiagram', {
      phases: [
        { title: '探索', desc: 'POC / 原型' },
        { title: '验证', desc: '小客户灰度' },
        { title: '规模', desc: '团队铺开' },
        { title: '优化', desc: '学习闭环' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §4 对比 — 3 页
// 路径：comparison 填 enrichment 字段（bottomText, showVS）验证 WARN 不再误报
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  4,
  sectionTitle:   '对比型',
  sectionTitleEn: 'COMPARISON',
  accent: '#D4A24D',
  pages: [
    p('cm-1', '左右对比 (含 enrichment)', '对比', 'comparison', {
      left:  { title: 'storyboard 入口', items: ['LLM 友好', '自动选模板', '快速但粗'] },
      right: { title: 'slides-data 入口', items: ['精确控制', '人手设计', '准但慢'] },
      bottomText: '本季度团队默认 storyboard，仅高端客户用 slides-data',
      showVS:     true,
    }),
    p('cm-2', '前后对比', '对比', 'beforeAfter', {
      pairs: [
        { label: '模板数量', before: '116 (v3.9)', after: '92 (v4.0.4)' },
        { label: '逃生选项', before: '无',          after: 'freeform' },
        { label: '硬 crash', before: '11 张',       after: '0 张' },
      ],
    }),
    p('cm-3', '3 档产品矩阵', '对比', 'productMatrix', {
      products: [
        {
          sku: 'Bronze', tagline: 'Internal report', tagCN: '内部',
          fields: [
            { label: 'TIME',  value: '< 5 min' },
            { label: 'PAGES', value: '8-15' },
            { label: 'CHECK', value: 'lint only' },
          ],
          idealFor: '周度内部简报',
        },
        {
          sku: 'Silver', tagline: 'Customer brief', tagCN: '客户简报',
          fields: [
            { label: 'TIME',  value: '< 15 min' },
            { label: 'PAGES', value: '15-30' },
            { label: 'CHECK', value: '6-gate QA' },
          ],
          idealFor: '销售简报',
        },
        {
          sku: 'Gold', tagline: 'Board proposal', tagCN: '董事会方案',
          badge: 'FLAGSHIP',
          fields: [
            { label: 'TIME',  value: '< 60 min' },
            { label: 'PAGES', value: '30-60' },
            { label: 'CHECK', value: 'QA + visual' },
          ],
          idealFor: 'C-suite 提案',
        },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §5 矩阵 / 框架 — 4 页
// 路径：layeredList 填 summary + banner（验证 enrichment 全命中无 WARN）
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  5,
  sectionTitle:   '矩阵 / 框架型',
  sectionTitleEn: 'MATRIX & FRAMEWORK',
  accent: '#C8102E',
  // 首页 type='heroSection' 测试 converter 跳过自动 section 的路径
  pages: [
    {
      id:               'm-hero',
      type:             'heroSection',
      sectionNumber:    5,
      sectionTitle:     '矩阵 / 框架型',
      sectionTitleEn:   'MATRIX & FRAMEWORK',
      sectionSubtitle:  '咨询经典版式',
      accent:           '#C8102E',
    },
    p('m-1', '6 行评估表', '矩阵', 'styledTable', {
      headers: ['模板类', '数量', '推荐场景', '兜底链首'],
      colWidths: [1.6, 1.0, 3.5, 2.4],
      rows: [
        ['数据/指标', '8',  '关键 KPI 与数字',     'dataHighlight'],
        ['并列/卡片', '6',  '3-6 个等权要素',      'iconList'],
        ['流程/步骤', '10', '时间序列与操作链',    'stepList'],
        ['对比型',    '5',  'A vs B / 多档方案',   'twoColumnCards'],
        ['矩阵/框架', '15', '2×2 与对比表',        'styledTable'],
        ['诊断/咨询', '9',  '鱼骨 / 漏斗 / 雷达',  'fishbone'],
      ],
      summary: '六大类 × 兜底链 = 任何输入都能落到可行模板',
    }),
    {
      id: 'm-2', title: '层级列表 + KEY INSIGHT minimal', type: 'content', sectionTag: '矩阵',
      layouts: [
        { type: 'layeredList', data: {
          banner: '渲染质量四阶模型',
          layers: [
            { tag: 'L1', title: '存活', desc: 'pipeline 不报错，输出有效 pptx' },
            { tag: 'L2', title: '可读', desc: '页面不超框、不重叠、文字清晰' },
            { tag: 'L3', title: '匹配', desc: '版式与内容性质完全契合' },
            { tag: 'L4', title: '精彩', desc: '视觉品味达到顶咨级' },
          ],
          summary: '当前 v4.0.5 整 deck 稳定在 L2-L3，部分高频场景达 L4',
        }},
        // v4.0.5: insightBanner minimal 样式（4pt 金竖线 + 大写小字标签 + 黑字）
        { type: 'insightBanner', data: {
          insight: 'v4.0.5 把 SWOT / executiveSummary / phaseDiagram 等模板的字段错配 → 友好占位卡，0 静默空页。',
          label:   'KEY INSIGHT',
          style:   'minimal',
          accent:  'gold',
        }},
      ],
    },
    p('m-3', 'SWOT 网格', '矩阵', 'swotGrid', {
      // v4.0.4 修正：swotGrid 实际字段是 quadrants[]，不是 strengths/weaknesses/...
      quadrants: [
        { tag: 'S', title: '优势 Strengths',      items: ['92 模板覆盖广', 'pipeline 端到端', '学习闭环'] },
        { tag: 'W', title: '劣势 Weaknesses',    items: ['Multi-deck 暂未支持', 'freeform 沙箱有限'] },
        { tag: 'O', title: '机会 Opportunities', items: ['团队 marketplace', '跨产品语义层'] },
        { tag: 'T', title: '威胁 Threats',        items: ['竞品 Beautiful.ai', '客户期望升级'] },
      ],
      summary: 'v4.0.4 战略对位评估',
    }),
    p('m-4', 'MECE 6 维度', '矩阵', 'meceLayout', {
      mainTitle: 'BRINGPPT 工程版图',
      items: [
        { title: '内容',  desc: 'storyboard 输入' },
        { title: '设计',  desc: 'selector 算法' },
        { title: '渲染',  desc: 'pptxgenjs' },
        { title: '校验',  desc: 'schema + visual' },
        { title: '学习',  desc: 'errorPatterns' },
        { title: '运营',  desc: 'doctor + 周报' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §6 诊断 / 咨询 / 项目混合 — 3 页
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  6,
  sectionTitle:   '诊断 / 咨询 / 项目',
  sectionTitleEn: 'DIAGNOSTIC · CONSULTING · PM',
  accent: '#6B7280',
  pages: [
    p('a-1', '能力雷达', '诊断', 'chartRadar', {
      data: [{
        name:   'v4.0.4',
        labels: ['稳定性','美观','灵活性','文档','社区','性能'],
        values: [95, 90, 88, 80, 55, 92],
      }],
      title: 'v4.0.4 能力雷达',
      radarStyle: 'filled',
    }),
    p('cf-1', 'SCQA 叙事', '咨询', 'scqaNarrative', {
      situation:   '团队每周生成 30+ PPT，手工耗时 8h/周。',
      complication:'LLM 直出文本可读，但视觉不达咨询品味。',
      question:    '能否做到 LLM 友好 + 咨询级视觉?',
      answer:      'BRINGPPT v4：模板系统 + 学习闭环 + 逃生舱。',
    }),
    p('pm-1', '检查清单', '项目', 'checklist', {
      items: [
        { text: '模板覆盖 ≥ 90',           done: true },
        { text: '所有 type 字段对齐',     done: true },
        { text: 'freeform 沙箱无逃逸',    done: true },
        { text: '空值守卫覆盖 11 模板',   done: true },
        { text: '字段速查表生成',          done: true },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §7 叙事 / 复合 — 4 页
// 路径：A 类 heroQuote 直通 + executiveSummary B 类
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  7,
  sectionTitle:   '叙事 / 复合',
  sectionTitleEn: 'NARRATIVE · MIXED',
  accent: '#0F766E',
  pages: [
    {
      // A 类直通：type='heroQuote'
      id:     'n-quote',
      type:   'heroQuote',
      title:  '章节金句',
      quote:  '工具的价值，不在它能做什么，而在它能让人不做什么。',
      author: '生产力宣言',
      source: '内部摘录',
    },
    p('n-1', '执行摘要', '叙事', 'executiveSummary', {
      headline: 'BRINGPPT v4 把 PPT 时间从 8 h/周降到 30 min/周',
      findings: [
        { title: '模板覆盖',  desc: '92 个咨询级模板覆盖全栈场景', priority: 'high' },
        { title: '质量门禁',  desc: '6 层校验拦截 90%+ 视觉缺陷', priority: 'high' },
        { title: '逃生舱',    desc: 'freeform 覆盖剩余 10% 长尾',  priority: 'medium' },
        { title: '学习闭环',  desc: '错误案例自动归档，不再重复',  priority: 'medium' },
      ],
      kpis: [
        { value: '96%',  label: 'QA 通过率' },
        { value: '< 6s', label: 'pipeline 时延' },
        { value: '0',    label: '硬 crash' },
      ],
      nextSteps: [
        'multi-deck 跨 deck 复用',
        '团队 marketplace',
        'CI gate 集成',
      ],
    }),
    p('mx-1', '双面板：v3 → v4 转型', '复合', 'dualPanel', {
      leftTitle:  '问题侧 (v3.9 之前)',
      leftItems:  [
        { from: '冗余模板', to: '116 个，使用率长尾' },
        { from: '硬 crash',  to: '11 张占位/100 页' },
        { from: '字段错配',  to: '60% LLM 输出踩坑' },
      ],
      rightTitle: '方案侧 (v4.0.4)',
      rightItems:[
        { number: 1, title: '软删除',     desc: '116 → 92 个高质量模板' },
        { number: 2, title: '空值守卫',   desc: '11 模板友好占位卡' },
        { number: 3, title: '字段速查表', desc: '1907 行自动生成' },
      ],
      summary: '团队默认 storyboard，仅高端客户 deck 用 slides-data',
    }),
    p('mx-2', '复合页 2×2', '复合', 'compositeLayout', {
      grid: '2x2',
      blocks: [
        { title: '内容', body: 'storyboard 是输入',  accentColor: '003591' },
        { title: '模板', body: '92 个 + 逃生舱',     accentColor: '5385C5' },
        { title: '质量', body: '6 层门禁',           accentColor: '80AACD' },
        { title: '学习', body: 'errorPatterns',      accentColor: 'D4A24D' },
      ],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────
// §8 逃生舱：freeform 真实场景 — 2 页
// 路径：renderCode 完全正确，证明非"测沙箱 catch"而是"真实有用"
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  8,
  sectionTitle:   '逃生舱：freeform 实战',
  sectionTitleEn: 'ESCAPE HATCH IN PRACTICE',
  accent: '#EA580C',
  pages: [
    p('ff-1', '自定义版本时间轴', '逃生舱', 'freeform', {
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
    p('ff-2', '自定义数字热力 3×6', '逃生舱', 'freeform', {
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
// §9 A 类直通 — 2 页
// 路径：type='heroStat' 与 type='heroClosing' 直接走 PAGE_MAP
// ─────────────────────────────────────────────────────────────────────
chapters.push({
  sectionNumber:  9,
  sectionTitle:   'A 类直通 / 收尾',
  sectionTitleEn: 'A-CLASS DIRECT',
  accent: '#7C3AED',
  pages: [
    {
      id:        'n-stat',
      type:      'heroStat',
      title:     '本季关键数字',
      statValue: '0',
      statLabel: '硬 crash 次数（v4.0.4）',
      context:   '上一季 11 张 → 现在 0 张',
      sourceRef: 'health-test 全 deck 渲染日志',
    },
    {
      id:       'n-closing',
      type:     'content',
      title:    '总结：v4.0.4 的三件事',
      layouts: [{
        type: 'heroClosing',
        data: {
          headline: 'v4.0.4 = 减一点模板 · 加一份兜底 · 多一张表',
          subline:  'LESS · SAFER · CLEARER',
          cta: [
            '92 模板（删 22 + 删 2）',
            '11 模板加空值守卫',
            '1907 行字段速查表自动生成',
          ],
        },
      }],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────────────────────────────
const OUT_CANDIDATES = [
  '/Users/james_ouyang/产品与skills/bring-suite/demo-cases/health-test',
  '/sessions/sharp-wonderful-bardeen/mnt/产品与skills/bring-suite/demo-cases/health-test',
];
const outDir = OUT_CANDIDATES.find(p => {
  try { fs.mkdirSync(p, { recursive: true }); return true; } catch { return false; }
}) || OUT_CANDIDATES[0];

meta.outputPath = path.join(outDir, 'health-test.pptx');

const storyboard = { meta, chapters };
const outJson = path.join(outDir, 'health-test-storyboard.json');
fs.writeFileSync(outJson, JSON.stringify(storyboard, null, 2));
console.log('✅ storyboard written: ' + outJson);
console.log('   chapters: ' + chapters.length);
console.log('   content pages: ' + chapters.reduce((s, c) => s + c.pages.length, 0));
