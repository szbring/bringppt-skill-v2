#!/usr/bin/env node
'use strict';
/**
 * scripts/build-all-templates-demo.js — 89 模板全量样例 PPT
 *
 * 遍历 registry 的所有模板，每个模板用 fromKeyPoints + 通用合规 keyPoints
 * 生成 1 页 demo（B 类）或 1 页独立页面（A 类），按 category 分章节合并。
 *
 * 输出：_temp/all-templates-demo/output.pptx
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const reg = require(path.join(SKILL_DIR, 'registry'));
const { generatePptx } = require(path.join(SKILL_DIR, 'ppt-pipeline'));

// 通用 keyPoints 池：每条 ≥ 15 字中文 desc，覆盖大多数模板的字数要求
const GENERIC_KPS = [
  '客户洞察: 通过行为数据持续刷新用户画像准确度',
  '产品迭代: 双周节奏小步快跑驱动核心指标提升',
  '组织协同: 跨职能小组打破筒仓壁垒提升协同效率',
  '资本效率: 投资回报周期较行业平均缩短约 30%',
  '风险管控: 数字化预警让异常事件提前 48 小时识别',
  '生态扩展: 战略合作伙伴网络扩大覆盖三大新业态',
  '人才储备: 培养梯队结构化建设核心能力体系',
  '品牌升级: 数字化体验重塑提升 NPS 净推荐值',
];

// 数据型模板需要数字
const NUMERIC_KPS = [
  '营收同比增长 35%',
  '客户规模累计 250 万',
  'NPS 净推荐值 72 分',
  'ARPU 人均贡献 88 元',
];

// 散点 / 气泡需要 "x,y[,size]"
const SCATTER_KPS = [
  '产品 A: 80, 65',
  '产品 B: 60, 90',
  '产品 C: 45, 40',
  '产品 D: 70, 75',
];
const BUBBLE_KPS = [
  '业务 A: 80, 65, 120',
  '业务 B: 60, 90, 200',
  '业务 C: 45, 40, 80',
  '业务 D: 70, 75, 150',
];

// 风险矩阵需要 1-5 数值
const RISK_KPS = [
  '数据隐私风险: 4, 5',
  '供应链中断: 3, 4',
  '人才流失: 3, 3',
  '监管变化: 4, 4',
];

// BCG 矩阵需要 share + growth
const BCG_KPS = [
  '明星业务 A: 1.8, 25',
  '现金牛业务 B: 1.6, 5',
  '问号业务 C: 0.7, 22',
  '瘦狗业务 D: 0.5, 3',
];

// 链接列表需要 url
const LINK_KPS = [
  '薄云官网: https://bring.consulting',
  '客户成功故事: https://bring.consulting/cases',
  '团队介绍: https://bring.consulting/team',
  '联系我们: https://bring.consulting/contact',
];

// 个别模板的 keyPoints 偏好
const KP_OVERRIDES = {
  // 数据型
  dataHighlight:   NUMERIC_KPS,
  kpiDashboard:    NUMERIC_KPS,
  achievement:     NUMERIC_KPS,
  bigNumber:       ['80%: 关键指标显著提升'],
  chartBar:        NUMERIC_KPS,
  chartLine:       NUMERIC_KPS,
  chartArea:       NUMERIC_KPS,
  chartPie:        NUMERIC_KPS,
  chartCombo:      NUMERIC_KPS,
  chartBar3D:      NUMERIC_KPS,
  chartRadar:      NUMERIC_KPS,
  chartScatter:    SCATTER_KPS,
  chartBubble:     BUBBLE_KPS,
  // 矩阵框架
  bcgMatrix:       BCG_KPS,
  riskMatrix:      RISK_KPS,
  // 链接
  linkList:        LINK_KPS,
};

// A 类页面模板的独立数据（不走 keyPoints）
const A_CLASS_DATA = {
  cover: {
    title: 'BRINGPPT 89 模板全量样例',
    subtitle: '从 registry 自动生成 · v3.7.12',
    reporter: '薄云咨询',
    date: new Date().toISOString().slice(0, 10),
  },
  section: { sectionTitle: 'A 类样例：章节分隔页', sectionNumber: '0X', subtitle: '本页演示 sectionSlide 渲染' },
  toc:     {
    title: '目录页样例',
    items: [
      { number: '01', title: '第一章：战略蓝图',   subtitle: '愿景与价值' },
      { number: '02', title: '第二章：执行路径',   subtitle: '阶段与里程碑' },
      { number: '03', title: '第三章：数据驱动',   subtitle: '指标与反馈' },
      { number: '04', title: '第四章：组织保障',   subtitle: '人才与机制' },
    ],
  },
  closingQuote: { quote: '行胜于言，知行合一。', author: '薄云咨询', label: '结语', labelEn: 'CLOSING' },
  fullQuote:    { quote: '管理咨询的本质，是把复杂留给自己，把简单交给客户。', author: '薄云咨询 BRING' },
  caseDivider:  { caseTitle: '案例：某零售龙头的供应链重塑', caseSubtitle: '6 个月内库存周转率提升 38%' },
  // backCover 和 contentSlide 由两页封底逻辑覆盖，独立 demo 用以下：
  backCover:    { text: '谢谢各位（封底模板独立 demo）' },
};

const slides = [];

// ── 封面 ──
slides.push({ id: 'cover', type: 'cover', ...A_CLASS_DATA.cover });

// ── 目录页（v3.7.15 新增）—— 在创建章节后由后续逻辑回填 items
let tocIdx = slides.length;
slides.push({ id: 'toc', type: 'toc', title: '目录', items: [] });

// 总览说明页
slides.push({
  id:    'intro',
  type:  'content',
  title: '使用说明',
  sectionTag: '导览',
  layouts: [{
    type: 'insightBanner',
    data: {
      insight: '本 PPT 自动遍历 registry 全部 89 模板，每个模板用 fromKeyPoints + 通用 keyPoints 生成一页 demo；按 category 分章节。',
      label: '生成方式',
    },
  }],
});

// ── 按 category 分组 ──
const all = reg.list();
const byCat = {};
for (const t of all) {
  const cat = t.isPageTemplate ? 'A 类页面模板' : (t.category || '其他');
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(t);
}

// 按模板数排序，A 类放最后
const categories = Object.keys(byCat).sort((a, b) => {
  if (a === 'A 类页面模板') return 1;
  if (b === 'A 类页面模板') return -1;
  return byCat[b].length - byCat[a].length;
});

let errors = [];

// v3.7.15: 回填目录 items（每个 category 一个目录项）
slides[tocIdx].items = categories.map((cat, i) => ({
  number:   String(i + 1).padStart(2, '0'),
  title:    cat,
  subtitle: `${byCat[cat].length} 个模板`,
}));

categories.forEach((cat, ci) => {
  // 章节分隔
  slides.push({
    id:           `section-cat-${ci}`,
    type:         'section',
    sectionTitle: cat,
    sectionNumber: String(ci + 1).padStart(2, '0'),
    subtitle:     `${byCat[cat].length} 个模板`,
  });

  // 该类下所有模板
  for (const tpl of byCat[cat]) {
    const name = tpl.name;

    // A 类页面模板：独立成页
    if (tpl.isPageTemplate) {
      // backCoverSlide / sectionSlide / coverSlide / tocPage 等命名映射到 storyboard slide.type
      const typeMap = {
        coverSlide:        'cover',
        backCoverSlide:    'backCover',
        sectionSlide:      'section',
        tocPage:           'toc',
        closingQuote:      'closingQuote',
        fullQuote:         'fullQuote',
        caseDivider:       'caseDivider',
        contentSlide:      'content',  // contentSlide 是 content 底座，需要 layouts
      };
      const t = typeMap[name] || name;
      const data = A_CLASS_DATA[t] || A_CLASS_DATA[name] || {};
      // contentSlide 特别：作为 content 底座 + 一个 demo layout
      if (t === 'content') {
        slides.push({
          id: `demo-${name}`,
          type: 'content',
          title: 'contentSlide 底座样例',
          sectionTag: 'A 类',
          engagementQuestion: '这是 engagementQuestion 字段位置',
          sourceRef: '这是 sourceRef 字段位置',
          layouts: [{
            type: 'insightBanner',
            data: { insight: 'contentSlide 是承载 B 类版式的页面底座，本身不展示内容；通常组合 B 类版式使用。', label: '底座' },
          }],
        });
      } else {
        slides.push({ id: `demo-${name}`, type: t, ...data });
      }
      continue;
    }

    // B 类版式：用 fromKeyPoints
    if (typeof tpl.fromKeyPoints !== 'function') {
      errors.push(`${name}: 缺 fromKeyPoints`);
      continue;
    }
    const kps = KP_OVERRIDES[name] || GENERIC_KPS;
    let layoutData;
    try {
      layoutData = tpl.fromKeyPoints(kps, { title: `${name} 样例` });
    } catch (e) {
      errors.push(`${name}: fromKeyPoints 抛错 ${e.message}`);
      continue;
    }
    if (!layoutData || typeof layoutData !== 'object') {
      errors.push(`${name}: fromKeyPoints 返回非对象`);
      continue;
    }
    slides.push({
      id: `demo-${name}`,
      type: 'content',
      title: `${name}`,
      sectionTag: cat,
      sourceRef: `category: ${tpl.category}`,
      layouts: [{ type: name, data: layoutData }],
    });
  }
});

// ── 末页：金句 + 封底（两页封底结构）──
slides.push({
  id:    'closing-quote-end',
  type:  'closingQuote',
  quote: '看完所有模板，就能放心选模板。',
  author:'薄云咨询 BRING Consulting',
  label: '结语',
  labelEn: 'CLOSING',
});
slides.push({
  id: 'back-cover',
  type: 'backCover',
  text: '谢谢各位',
});

// ── 写出 + 渲染 ──
const outDir = path.join(SKILL_DIR, '_temp', 'all-templates-demo');
fs.mkdirSync(outDir, { recursive: true });
const dataPath = path.join(outDir, 'slides-data.json');
const outPath  = path.join(outDir, 'output.pptx');

const data = {
  meta: { title: 'BRINGPPT 89 模板全量样例', author: '薄云咨询', outputPath: outPath },
  slides,
};
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✅ slides-data: ${dataPath}`);
console.log(`   ${slides.length} 页 (89 模板 + 封面/导览/章节/金句/封底)`);
if (errors.length) {
  console.log(`\n⚠️  ${errors.length} 个模板未能生成 demo:`);
  errors.forEach(e => console.log(' ', e));
}

generatePptx(slides, data.meta, outPath).then(() => {
  console.log(`\n✅ output.pptx: ${outPath}`);
}).catch(e => { console.error('❌', e.message); process.exit(1); });
