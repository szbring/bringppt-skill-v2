#!/usr/bin/env node
'use strict';
/**
 * scripts/build-byd-all-templates-demo.js — 比亚迪主题 · 全 104 模板样例 PPT
 *
 * 基于 build-all-templates-demo.js，把通用 keyPoints 全部替换为比亚迪真实信息，
 * 演示 bringppt 在一个 真实客户主题下能力覆盖 104 模板全集。
 */

const fs   = require('fs');
const path = require('path');
const SKILL_DIR = path.resolve(__dirname, '..');
const reg = require(path.join(SKILL_DIR, 'registry'));
const { generatePptx } = require(path.join(SKILL_DIR, 'ppt-pipeline'));

// 通用 BYD 主题 keyPoints 池（覆盖大多数模板）— 每条 ≥ 15 字中文 desc
const BYD_KPS = [
  '垂直整合护城河: 从锂矿到整车 6 环节全自有 行业唯一全栈',
  '刀片电池技术: 磷酸铁锂能量密度第一 针刺不起火安全标准',
  '混动 DM-i 杀手锏: 第五代亏电油耗 2.9L/100km 燃油车 50%',
  '海外建厂规避壁垒: 巴西泰国印尼匈牙利乌兹别克 5 国设厂',
  '高端品牌矩阵: 仰望方程豹腾势覆盖 25 万至 200 万价格带',
  '研发投入领跑: 2024 投入 396 亿元行业第一 占营收 5.1%',
  '出海销量爆发: 2024 出口 41.7 万辆 同比增长 71.9% 创纪录',
  '规模效应碾压: 425 万辆销量带来单车 BOM 成本低 8-12%',
];

// 数据型模板 — BYD 真实数据
const NUMERIC_KPS = [
  '营收 7771 亿元 同比增 29%',
  '销量 425 万辆 全球 #1',
  '海外销量 41.7 万辆',
  '研发投入 396 亿元',
];

// 散点 / 气泡
const SCATTER_KPS = [
  '比亚迪: 425, 22.4',
  '特斯拉: 180, 19.8',
  '吉利极氪: 217, 15.3',
  '理想汽车: 50, 21.5',
];
const BUBBLE_KPS = [
  '王朝海洋: 80, 65, 350',
  '腾势: 60, 90, 18',
  '仰望: 90, 75, 0.7',
  '方程豹: 70, 60, 8',
];

// 风险矩阵 BYD 痛点
const RISK_KPS = [
  '海外贸易壁垒: 5, 4',
  '价格战伤毛利: 4, 5',
  '智驾相对落后: 3, 4',
  '高端品牌力弱: 3, 3',
];

// BCG 矩阵 BYD 业务
const BCG_KPS = [
  '乘用车明星: 1.8, 35',
  '混动 DM-i 现金牛: 1.6, 8',
  '高端仰望问号: 0.5, 25',
  '商用车瘦狗: 0.4, 5',
];

// 链接列表
const LINK_KPS = [
  '比亚迪官网: https://www.byd.com',
  '王朝品牌: https://www.bydauto.com.cn',
  '腾势汽车: https://www.dm.com.cn',
  '仰望汽车: https://www.yangwang-auto.com',
];

const KP_OVERRIDES = {
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
  bcgMatrix:       BCG_KPS,
  riskMatrix:      RISK_KPS,
  linkList:        LINK_KPS,
};

// A 类页面 BYD 数据
const A_CLASS_DATA = {
  cover: {
    title: '比亚迪 BYD · 客户分析',
    subtitle: 'BRINGPPT 全 104 模板覆盖样例 · 真实客户主题',
    reporter: '薄云咨询',
    date: new Date().toISOString().slice(0, 10),
  },
  section: { sectionTitle: 'A 类样例', sectionNumber: '0X', subtitle: 'sectionSlide 渲染' },
  toc: {
    title: '比亚迪客户分析 · 目录',
    items: [
      { number: '01', title: '客户概况',     subtitle: '基础信息与历史' },
      { number: '02', title: '行业格局',     subtitle: 'NEV 全球市场' },
      { number: '03', title: '战略主轴',     subtitle: '出海/自研/高端' },
      { number: '04', title: '业务画像',     subtitle: '财务与产品矩阵' },
    ],
  },
  closingQuote: {
    quote: '从手机电池到全球 NEV #1，技术为本是真护城河。',
    author: '薄云咨询 BRING',
    label: '结语',
    labelEn: 'CLOSING',
  },
  fullQuote: {
    quote: '比亚迪的下一战，是把"全栈自研"的中国故事讲到全球。',
    author: '薄云咨询 BRING',
  },
  caseDivider: {
    caseTitle: '案例：比亚迪 2024 — 425 万辆全球登顶之路',
    caseSubtitle: '垂直整合 + 海外建厂 + 高端突围',
  },
  backCover: { text: '谢谢各位（封底独立 demo）' },

  // A 类 hero 模板（v3.7.36 新增）
  heroCover: {
    title: '比亚迪 BYD',
    subtitle: '从手机电池到全球 NEV 龙头',
    clientName: '比亚迪',
    instructor: '薄云咨询',
    dateLine: new Date().toISOString().slice(0, 10),
  },
  heroSection: {
    sectionNumber: 5,
    sectionTitle: '出海是下一战略主轴',
    sectionTitleEn: 'GOING GLOBAL',
    sectionSubtitle: '5 国设厂规避贸易壁垒 实现真正本地化',
  },
  heroStat: {
    statValue: '425万',
    statLabel: '2024 年全球销量 · NEV 第一',
    context: '同比增长 41.3%，海外销量占 22%',
    comparison: 'vs 特斯拉 180 万',
    sourceRef: '中汽协 2024 年报',
  },
  heroQuote: {
    quote: '车企竞争的下一战不是公司之间 而是生态之间',
    author: '王传福',
    source: '2024 比亚迪股东大会',
    label: '战略洞察',
    labelEn: 'STRATEGIC INSIGHT',
  },
  heroClosing: {
    headline: '比亚迪客户合作路径已就绪',
    subline: '从 IPD 研发流程到海外组织能力，多模块咨询包匹配',
    cta: [
      '2025 Q3 海外业务总裁接触',
      'IPD 招标流程切入研发咨询',
      '仰望品牌策略合作',
    ],
  },
};

const slides = [];

// 封面
slides.push({ id: 'cover', type: 'cover', ...A_CLASS_DATA.cover });

// 目录页占位
let tocIdx = slides.length;
slides.push({ id: 'toc', type: 'toc', title: '目录', items: [] });

// intro
slides.push({
  id: 'intro',
  type: 'content',
  title: '使用说明',
  sectionTag: '导览',
  layouts: [{
    type: 'insightBanner',
    data: {
      insight: '本 PPT 用比亚迪真实主题铺到全 104 模板，每页演示一个模板能力。' +
                '从 registry 自动遍历，按 category 分章节。',
      label: '生成方式',
    },
  }],
});

// 按 category 分组
const all = reg.list();
const byCat = {};
for (const t of all) {
  const cat = t.isPageTemplate ? 'A 类页面模板' : (t.category || '其他');
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(t);
}

const categories = Object.keys(byCat).sort((a, b) => {
  if (a === 'A 类页面模板') return 1;
  if (b === 'A 类页面模板') return -1;
  return byCat[b].length - byCat[a].length;
});

let errors = [];

// 回填目录
slides[tocIdx].items = categories.map((cat, i) => ({
  number:   String(i + 1).padStart(2, '0'),
  title:    cat,
  subtitle: `${byCat[cat].length} 个模板`,
}));

categories.forEach((cat, ci) => {
  slides.push({
    id: `section-cat-${ci}`,
    type: 'section',
    sectionTitle: cat,
    sectionNumber: String(ci + 1).padStart(2, '0'),
    subtitle: `${byCat[cat].length} 个模板`,
  });

  for (const tpl of byCat[cat]) {
    const name = tpl.name;

    if (tpl.isPageTemplate) {
      const typeMap = {
        coverSlide:        'cover',
        backCoverSlide:    'backCover',
        sectionSlide:      'section',
        tocPage:           'toc',
        closingQuote:      'closingQuote',
        fullQuote:         'fullQuote',
        caseDivider:       'caseDivider',
        contentSlide:      'content',
      };
      const t = typeMap[name] || name;
      const data = A_CLASS_DATA[t] || A_CLASS_DATA[name] || {};

      if (t === 'content') {
        slides.push({
          id: `demo-${name}`,
          type: 'content',
          title: 'contentSlide 底座样例',
          sectionTag: 'A 类',
          engagementQuestion: '这是 engagementQuestion 字段位置',
          sourceRef: '比亚迪 2024 年报',
          layouts: [{
            type: 'insightBanner',
            data: {
              insight: 'contentSlide 是承载 B 类版式的页面底座，本身不展示内容；通常组合 B 类版式使用。',
              label: '底座',
            },
          }],
        });
      } else {
        slides.push({ id: `demo-${name}`, type: t, ...data });
      }
      continue;
    }

    // B 类
    if (typeof tpl.fromKeyPoints !== 'function') {
      errors.push(`${name}: 缺 fromKeyPoints`);
      continue;
    }
    const kps = KP_OVERRIDES[name] || BYD_KPS;
    let layoutData;
    try {
      layoutData = tpl.fromKeyPoints(kps, { title: `${name} · 比亚迪样例` });
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

// 末页
slides.push({
  id: 'closing-quote-end',
  type: 'closingQuote',
  quote: '看完 104 模板，就能给比亚迪交付合适的 deck。',
  author: '薄云咨询 BRING',
  label: '结语',
  labelEn: 'CLOSING',
});
slides.push({
  id: 'back-cover',
  type: 'backCover',
  text: '谢谢各位',
});

// 输出
const outDir = path.join(SKILL_DIR, '_temp', 'byd-all-templates-demo');
fs.mkdirSync(outDir, { recursive: true });
const dataPath = path.join(outDir, 'slides-data.json');
const outPath  = path.join(outDir, 'BYD-全模板样例.pptx');

const data = {
  meta: {
    title: '比亚迪 BYD · BRINGPPT 全 104 模板覆盖样例',
    author: '薄云咨询',
    outputPath: outPath,
  },
  slides,
};

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`📄 slides-data 写出: ${dataPath}`);
console.log(`   ${slides.length} 页 / ${categories.length} 个 category`);

generatePptx(data.slides, data.meta, outPath).then(() => {
  console.log(`\n✅ 生成完成: ${outPath} (${slides.length} 页)`);
  if (errors.length) {
    console.log(`\n⚠️  ${errors.length} 个模板有问题:`);
    errors.forEach(e => console.log('  -', e));
  }
}).catch((err) => {
  console.error(`\n❌ 生成失败:`, err.message);
  if (errors.length) {
    console.log(`\n⚠️  此前已知问题:`);
    errors.forEach(e => console.log('  -', e));
  }
  process.exit(1);
});
