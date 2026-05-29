#!/usr/bin/env node
'use strict';
/**
 * scripts/build-storyboard-88.js — 构造 storyboard JSON，覆盖全部 88 模板
 *
 * 用 bringppt 完整流水线生成 PPT：
 *   storyboard.json → npm run pipeline
 *     → storyboard-converter（含 selectBestLayout 三层稳定性）
 *     → validate-slides（content + visual + stats）
 *     → generatePptx（含 closingQuote + backCover 两页封底）
 *     → assertPptxSize 16:9 检查
 *     → record-learning 写学习库
 *
 * 输出：_temp/storyboard-88.json
 * 跑：  npm run pipeline -- --input _temp/storyboard-88.json --output 88模板全量样例.pptx
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const reg = require(path.join(SKILL_DIR, 'registry'));

// 通用 keyPoints（每条 ≥ 15 字 desc）
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

// 数据类
const NUMERIC_KPS = [
  '营收同比增长 35%',
  '客户规模累计 250 万',
  'NPS 净推荐值 72 分',
  'ARPU 人均贡献 88 元',
];
const SCATTER_KPS  = ['产品 A: 80, 65', '产品 B: 60, 90', '产品 C: 45, 40', '产品 D: 70, 75'];
const BUBBLE_KPS   = ['业务 A: 80, 65, 120', '业务 B: 60, 90, 200', '业务 C: 45, 40, 80', '业务 D: 70, 75, 150'];
const RISK_KPS     = ['数据隐私: 4, 5', '供应链中断: 3, 4', '人才流失: 3, 3', '监管变化: 4, 4'];
const BCG_KPS      = ['明星 A: 1.8, 25', '现金牛 B: 1.6, 5', '问号 C: 0.7, 22', '瘦狗 D: 0.5, 3'];
const LINK_KPS     = [
  '薄云官网: https://bring.consulting',
  '客户成功故事: https://bring.consulting/cases',
  '团队介绍: https://bring.consulting/team',
  '联系我们: https://bring.consulting/contact',
];

const KP_OVERRIDES = {
  dataHighlight:   NUMERIC_KPS, kpiDashboard:    NUMERIC_KPS,
  achievement:     NUMERIC_KPS, bigNumber:       ['80%: 关键指标显著提升'],
  chartBar:        NUMERIC_KPS, chartLine:       NUMERIC_KPS,
  chartArea:       NUMERIC_KPS, chartPie:        NUMERIC_KPS,
  chartCombo:      NUMERIC_KPS, chartBar3D:      NUMERIC_KPS,
  chartRadar:      NUMERIC_KPS,
  chartScatter:    SCATTER_KPS, chartBubble:     BUBBLE_KPS,
  bcgMatrix:       BCG_KPS,     riskMatrix:      RISK_KPS,
  linkList:        LINK_KPS,
  // v3.7.18: 对 maxItems 较小的模板手工限量
  imageGallery:    GENERIC_KPS.slice(0, 4),
  imageText:       GENERIC_KPS.slice(0, 2),
  flowerPetal:     GENERIC_KPS.slice(0, 4),
};

const all = reg.list();
// B 类按 category 分组
const bClass = all.filter(t => !t.isPageTemplate);
const byCat = {};
for (const t of bClass) {
  const cat = t.category || '其他';
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(t);
}

const categories = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length);

// v3.7.18: 按每模板 usage.maxItems 截断 keyPoints，避免 L1 notWhen 把超量数据一刀切到 cardGrid
function kpsForTemplate(tpl) {
  const overrides = KP_OVERRIDES[tpl.name];
  if (overrides) return overrides;
  // 默认 maxItems 表（按 schema items.max 或 usage 经验值）
  const max = (tpl.usage && tpl.usage.maxItems) || 5;
  return GENERIC_KPS.slice(0, max);
}

// v3.7.18: 图片模板需要 imagePath；用 brand asset 当 placeholder
const SKILL_BUILDING_IMG = path.join(SKILL_DIR, 'assets', 'cover-building.jpg');

const chapters = categories.map((cat, ci) => {
  const pages = byCat[cat].map((tpl, pi) => {
    const page = {
      id:              `p-${ci + 1}-${pi + 1}`,
      title:           tpl.name,
      keyPoints:       kpsForTemplate(tpl),
      suggestedLayout: tpl.name,
    };
    if (tpl.name === 'imageGallery' || tpl.name === 'imageText') {
      page.imagePath = SKILL_BUILDING_IMG;  // 让 L1 not-when 通过
    }
    return page;
  });
  return {
    sectionTitle:    cat,
    sectionNumber:   ci + 1,
    sectionSubtitle: `${byCat[cat].length} 个模板`,
    pages,
  };
});

// 加一章 A 类 page 类型 demo：fullQuote / caseDivider
chapters.push({
  sectionTitle:    'A 类页面模板',
  sectionNumber:   chapters.length + 1,
  sectionSubtitle: 'fullQuote / caseDivider 样例',  // v3.7.17: 缩短避免 81 字超限
  pages: [
    {
      id: 'p-fullQuote',
      title: 'fullQuote 样例',
      type: 'fullQuote',
      quote: '管理咨询的本质是把复杂留给自己，把简单交给客户。',
      author: '薄云咨询 BRING',
    },
    {
      id: 'p-caseDivider',
      title: '案例：供应链重塑',  // v3.7.17: caseDivider 要求 title 字段
      type: 'caseDivider',
      caseTitle: '案例：供应链重塑',
      caseSubtitle: '6 个月库存周转 +38%',
    },
  ],
});

const storyboard = {
  meta: {
    title:    'BRINGPPT 88 模板全量样例',  // v3.7.17: ≤ 30 字
    author:   '薄云咨询',
    subtitle: 'storyboard → pipeline 完整流水线生成',
    includeToc: true,
    closingQuote: {
      quote:  '看完所有模板，就能放心选模板。',
      author: '薄云咨询 BRING',
      label:  '结语', labelEn: 'CLOSING',
    },
    backCover: { text: '谢谢各位' },
  },
  chapters,
};

const outPath = path.join(SKILL_DIR, '_temp', 'storyboard-88.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(storyboard, null, 2) + '\n', 'utf-8');

const pageCount = chapters.reduce((s, c) => s + c.pages.length, 0);
console.log(`✅ storyboard 已生成：${outPath}`);
console.log(`   ${chapters.length} 章 · ${pageCount} 个内容页 · 覆盖 88 个模板`);
console.log('\n下一步：');
console.log(`  npm run pipeline -- --input ${path.relative(process.cwd(), outPath)} --output 88-pipeline-output.pptx --verbose`);
