#!/usr/bin/env node
/**
 * add-scenarios.js — 为所有模板补充 scenarios 字段
 *
 * scenarios 格式：
 * [
 *   { trigger: "用户说...", example: "适合用法描述" },
 *   ...
 * ]
 *
 * 运行：node scripts/add-scenarios.js
 */

const fs   = require('fs');
const path = require('path');

const TPLS_DIR = path.join(__dirname, '..', 'templates');

/**
 * 每个模板的 scenarios 定义
 * 格式：{ trigger: "用户说/上下文关键词", example: "具体用法说明" }
 */
const SCENARIOS = {

  // ── 数据/指标型 ──────────────────────────────────────────────
  achievement: [
    { trigger: "展示成绩、里程碑、项目成果", example: "项目完成率92%、客户满意度4.8分——用圆形进度环强调数值" },
    { trigger: "季度/年度复盘汇报的亮点数据", example: "年度营收增长35%、新增客户120家——2-4个核心成就并排展示" },
    { trigger: "比 dataHighlight 更需要进度感时", example: "有目标值和完成率的指标，如KPI完成度70%→100%" },
  ],
  chartCombo: [
    { trigger: "收入和利润率要同时看趋势", example: "左轴柱状图显示营收，右轴折线显示利润率——双轴组合" },
    { trigger: "量和率同时展示，单图不够", example: "销售量（柱）+同比增长率（折线），揭示量增但增速放缓" },
    { trigger: "投入产出双维度分析", example: "广告费用（柱）+ ROI（折线）——找到最优投放区间" },
  ],
  chartLine: [
    { trigger: "时间序列趋势，看走势而非比较", example: "12个月营收趋势、用户增长曲线——连续变化时优于柱图" },
    { trigger: "多条趋势对比", example: "A/B/C三条产品线的增长曲线对比" },
    { trigger: "预测数据展示", example: "历史6个月实线 + 未来3个月虚线预测" },
  ],
  chartPie: [
    { trigger: "各部分占整体的比例", example: "收入构成：产品30%、服务45%、其他25%——5个以内最清晰" },
    { trigger: "市场份额分布", example: "公司在市场中占据28%份额，竞争对手分别占多少" },
    { trigger: "资源分配比例", example: "预算分配：研发40%、销售30%、运营30%" },
  ],
  kpiDashboard: [
    { trigger: "月度/季度运营数据总览", example: "GMV、DAU、转化率、毛利率4个核心指标卡片式展示" },
    { trigger: "业务健康度快速一览", example: "比dataHighlight更适合：有目标值、实际值、环比变化三要素时" },
    { trigger: "给高管看的数据摘要页", example: "不需要图表，只看关键数字，配色区分好坏状态" },
  ],

  // ── 矩阵/框架型 ──────────────────────────────────────────────
  analysisMatrix: [
    { trigger: "能力评估、维度打分、对标分析", example: "竞争对手能力矩阵：5家公司×8个维度，彩色格子直观对比" },
    { trigger: "用户旅程地图、客户体验评估", example: "5个旅程阶段×6个接触点，标注好/中/差体验" },
    { trigger: "比styledTable更强调视觉对比时", example: "有明显高/中/低分层的数据，用颜色深浅区分" },
  ],
  orgChart: [
    { trigger: "展示组织架构、汇报关系", example: "新供应链中心架构设计：COO→供应链VP→3个部门长" },
    { trigger: "变革后的新组织设计方案", example: "改革前后组织架构对比，用两页orgChart说明变化" },
    { trigger: "利益相关方层级关系", example: "项目治理结构：委员会→项目组→工作流" },
  ],
  pyramid: [
    { trigger: "需求层次、价值层级、优先级金字塔", example: "马斯洛需求层次、产品价值金字塔（基础→核心→差异化）" },
    { trigger: "重要性从底到顶递增的层级结构", example: "战略执行金字塔：操作→流程→能力→战略" },
    { trigger: "比layeredList更强调层级视觉感时", example: "底宽顶窄的层次关系，强调越往上越少越重要" },
  ],
  vennDiagram: [
    { trigger: "两个概念的共同点与差异", example: "效率 vs 效果的维恩图，中间是两者都关注的部分" },
    { trigger: "产品差异化定位，找独特交叉点", example: "客户需求 ∩ 技术能力 ∩ 竞争空白 = 差异化机会" },
    { trigger: "受众重叠分析、用户画像交叉", example: "两个用户群体的特征重叠，指导产品/营销设计" },
  ],

  // ── 页面模板 ──────────────────────────────────────────────────
  coverSlide: [
    { trigger: "PPT第一页封面", example: "主标题+副标题+关键词+地点——所有PPT的封面页" },
  ],
  backCoverSlide: [
    { trigger: "PPT最后一页结束页", example: "谢谢+团队信息+公司+日期+网址——所有PPT的封底页" },
  ],
  contentSlide: [
    { trigger: "标准内容页的底座（不单独使用）", example: "内部工具，gen_ppt自动调用，不需要AI直接指定" },
  ],
  sectionSlide: [
    { trigger: "章节过渡页，分隔不同模块", example: "MODULE 01 · 战略定位——带编号横幅、逻辑条和3个预览卡片" },
    { trigger: "汇报PPT的章节切换", example: "每进入新章节前用sectionSlide做视觉分隔，让观众知道切换了" },
  ],
  caseDivider: [
    { trigger: "引入案例研究、客户故事", example: "深色背景+徽章+案例标题，宣告下一部分是真实案例" },
    { trigger: "课件中的案例分析环节", example: "教学型PPT，在内容讲解后插入案例分析页" },
  ],
  fullQuote: [
    { trigger: "用名言/CEO金句开场或结尾", example: "全页深蓝背景+大引号+名人名言，配行业权威背书" },
    { trigger: "核心观点整页强调", example: "'没有感知的管理是伪管理'——用整页引语页高亮核心判断" },
  ],

  // ── 对比型 ──────────────────────────────────────────────────
  hourglass: [
    { trigger: "问题聚焦→解决方案发散的沙漏结构", example: "左侧列出5个痛点，中间漏斗汇聚，右侧展开5个解法" },
    { trigger: "现状挑战 vs 目标状态的对比", example: "左侧现状问题清单，右侧目标愿景清单，中间是变革" },
    { trigger: "比comparison更强调'收敛-发散'结构时", example: "两侧条目通过中心视觉上有聚合感的对比" },
  ],

  // ── 并列型 ──────────────────────────────────────────────────
  flowerPetal: [
    { trigger: "4个并列要素围绕一个核心", example: "以客户为中心的4个服务维度：速度/质量/价格/体验" },
    { trigger: "比radialHub更需要交叉感、整体感时", example: "4个要素既独立又相互支撑，半透明交叉视觉强调整体性" },
  ],
  radialHub: [
    { trigger: "一个核心概念向外延伸多个分支", example: "数字化转型核心平台→辐射出：数据/流程/客户/组织/技术5个维度" },
    { trigger: "生态系统图、产品矩阵", example: "公司核心产品为Hub，周边服务/合作伙伴/渠道为辐射" },
    { trigger: "比flowerPetal分支更多（5-6个）时", example: "5-6个并列主题，辐射状布局比花瓣更清晰" },
  ],

  // ── 叙事/引用型 ──────────────────────────────────────────────
  impactQuestion: [
    { trigger: "用反问句引发思考、开启讨论", example: "'如果供应链明天断了，你还有几天的库存？'——先问题后答案" },
    { trigger: "演讲者想停顿让观众思考时", example: "大字问题配小字答案，节奏感强，适合现场演讲" },
    { trigger: "比engagementQuestion更需要整页强调时", example: "独立一页强调一个颠覆性问题，不是放在内容页底部" },
  ],
  quoteEmphasis: [
    { trigger: "重要观点引用+补充解释", example: "大块引用框+下方强调要点，适合学术/研究型报告" },
    { trigger: "客户证言+关键结论提炼", example: "'薄云咨询帮我们节省了30%的成本'——客户原话+量化结论" },
  ],

  // ── 流程/步骤型 ──────────────────────────────────────────────
  chainFlow: [
    { trigger: "环环相扣的价值链、供应链", example: "采购→生产→仓储→分销→零售——椭圆形节点互相衔接" },
    { trigger: "比processFlow更强调链条连续性时", example: "步骤之间有明显的传递关系，不只是顺序执行" },
  ],
  cycleDiagram: [
    { trigger: "PDCA、持续改进、迭代循环", example: "Plan→Do→Check→Act四个节点围绕中心循环" },
    { trigger: "有反馈闭环的流程，不是线性结束", example: "客户反馈→产品迭代→客户体验→客户反馈——循环往复" },
    { trigger: "生命周期、轮换机制", example: "产品生命周期：导入→成长→成熟→衰退→新产品导入" },
  ],
  dualTrackTimeline: [
    { trigger: "两条并行推进的时间轴", example: "A团队做技术，B团队做业务，同时推进的双轨项目计划" },
    { trigger: "内部视角 vs 外部视角的时间线", example: "上轨：公司内部里程碑，下轨：客户侧感知节点" },
    { trigger: "理论与实践并行的课程设计", example: "上轨：理论课程，下轨：实践项目，同步推进" },
  ],
  snakeFlow: [
    { trigger: "6-10个步骤的复杂流程", example: "供应链全流程10步：需求→计划→采购→入库→生产→质检→出库→配送→签收→结算" },
    { trigger: "processFlow放不下时的替代", example: "步骤超过6个时用snakeFlow折行排列，比横向挤压更清晰" },
  ],
  waveProgression: [
    { trigger: "3-5个阶段的递进成长过程", example: "从初级→中级→高级→专家的能力成长路径，波浪形上升感" },
    { trigger: "比staircase更流畅柔和的递进", example: "转型阶段的曲线发展，不是硬台阶式跳跃" },
  ],

  // ── 项目管理型 ──────────────────────────────────────────────
  ganttChart: [
    { trigger: "项目实施计划，有明确时间和责任人", example: "6个工作包×12个月，标注开始/结束时间和负责团队" },
    { trigger: "比phaseDiagram更需要精确时间节点时", example: "任务有具体周数/月份，需要看并行情况和关键路径" },
    { trigger: "实施路线图汇报", example: "向客户展示完整项目时间表，显示咨询团队的专业规划能力" },
  ],
  multiProjectCards: [
    { trigger: "3-5个并行项目的状态总览", example: "Q2在跑的5个项目：各自进度条+状态标签+负责人" },
    { trigger: "项目集管理、Portfolio汇报", example: "给PMO或高管看的项目群全景图，一页看清所有在途项目" },
  ],
  quarterlyPlan: [
    { trigger: "Q1-Q4季度目标和任务分配", example: "年度计划分解：4列卡片分别展示每季度的核心目标和关键任务" },
    { trigger: "年度规划汇报", example: "战略落地四季度节奏：Q1夯实基础、Q2快赢、Q3规模化、Q4固化" },
  ],
  progressList: [
    { trigger: "多个任务/目标的完成进度", example: "6个战略目标的完成率：进度条显示50%/80%/100%等" },
    { trigger: "比checklist更需要展示百分比时", example: "不只是完成/未完成，而是0-100%的连续进度" },
  ],

  // ── 图文/复合型 ──────────────────────────────────────────────
  dualPanel: [
    { trigger: "左侧旧→新对比条目，右侧具体行动步骤", example: "左：从功能型到集成型供应链的转变（6项变化），右：具体实施步骤" },
    { trigger: "变革前后+执行方案同一页呈现", example: "比beforeAfter更适合：需要在对比后紧接行动清单的场合" },
  ],
  imageGallery: [
    { trigger: "展示1-4张图片，配图说明", example: "工厂参观图片集：生产线/仓库/员工现场4张图" },
    { trigger: "案例研究的现场照片", example: "客户实施效果：改造前后对比图片2张" },
    { trigger: "产品外观/界面截图展示", example: "APP界面截图3张，配各自功能说明" },
  ],
  imageText: [
    { trigger: "一张图配文字说明，图文并排", example: "左图：供应链架构示意图，右文：4个核心特征说明" },
    { trigger: "案例图解：有实物图+解释", example: "右图：某工厂现场，左文：问题描述和改进措施" },
    { trigger: "产品/方案演示，图比文更说明问题时", example: "有图就用imageText，纯文字场景不用" },
  ],
  moduleOverview: [
    { trigger: "章节封面页，介绍本章内容", example: "第03章概览：带模块编号+总述段落+3-4个子主题卡片" },
    { trigger: "比sectionSlide更需要内容预览时", example: "章节有3个以上子模块，需要一页预览全部内容" },
  ],

  // ── 分析/诊断型 ──────────────────────────────────────────────
  fishbone: [
    { trigger: "5M1E根因分析（人机料法环管）", example: "为什么交货延误？鱼骨图展示6个维度的根因" },
    { trigger: "质量问题、故障原因分析", example: "产品不良率高的原因：设备/原料/工艺/人员多角度分析" },
    { trigger: "比causalChain更需要多维度发散时", example: "causalChain是纵向因果链，fishbone是多维度放射状分析" },
  ],
  funnel: [
    { trigger: "销售漏斗、转化率分析", example: "线索1000→意向300→商机100→成交30，展示各阶段转化" },
    { trigger: "用户行为路径的层层筛选", example: "注册→激活→留存→付费→推荐——用户成长漏斗" },
    { trigger: "流程中的层层审批、过滤", example: "500份简历→100面试→30录用→10入职——招聘漏斗" },
  ],

  // ── 今天新增的3个ISC模板 ──────────────────────────────────────
  sidebarLabel: [
    { trigger: "执行摘要页，左侧需要大字标注主题", example: "左侧'执行摘要'大字，右侧3张'立即做/重点投入/避免陷阱'卡片" },
    { trigger: "分层说明，每层有独立卡片", example: "左侧'核心建议'，右侧按01/02/03排列的行动建议卡片" },
  ],
  causalChain: [
    { trigger: "根因诊断的层次因果链", example: "战略层→组织层→流程层→结果，每层橙色标签+内容，向下箭头连接" },
    { trigger: "比causalChain更有分类标签感时", example: "与fishbone的区别：垂直顺序因果，各步有明确分类标签" },
    { trigger: "诊断结论逻辑链", example: "问题描述→根本原因→直接影响→最终结果，逐层递进" },
  ],
  insightBanner: [
    { trigger: "需要在页面底部加核心结论", example: "任何内容页底部加一条'深蓝背景白字'的核心洞察强调" },
    { trigger: "比engagementQuestion更正式的总结条", example: "咨询汇报风格，每页底部固定有结论条，不是互动问题" },
  ],
};

// ── 主逻辑：给每个模板文件注入 scenarios ──────────────────────────
let updated = 0, skipped = 0;

for (const [templateName, scenarios] of Object.entries(SCENARIOS)) {
  // 找到对应的 .js 文件（模板名转文件名）
  const fileName = templateName
    .replace(/([A-Z])/g, '-$1').toLowerCase()
    .replace(/^-/, '') + '.js';
  const filePath = path.join(TPLS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] ${templateName} → ${fileName} 不存在`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 检查是否已有 scenarios
  if (content.includes('scenarios:')) {
    console.log(`[SKIP] ${templateName} 已有 scenarios`);
    skipped++;
    continue;
  }

  // 在 usage 对象里加 scenarios 字段（在 typicalHeight 前，或在 } 结束前）
  const scenariosJson = JSON.stringify(scenarios, null, 6)
    .replace(/\n/g, '\n    ');  // 对齐缩进

  // 匹配 usage: { ... } 块，在结束 } 前插入
  const insertBefore = /(\s+typicalHeight:)/;
  const insertAtEnd  = /(,?\s*\},\s*\n\s*get selfLearning)/;

  if (insertBefore.test(content)) {
    content = content.replace(insertBefore, `\n    scenarios: ${scenariosJson},\n$1`);
  } else if (insertAtEnd.test(content)) {
    content = content.replace(insertAtEnd, `,\n    scenarios: ${scenariosJson},\n$1`);
  } else {
    // fallback: 在 notWhen 后面加
    content = content.replace(
      /(notWhen:\s*'[^']*',)/,
      `$1\n    scenarios: ${scenariosJson},`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${templateName} → 注入 ${scenarios.length} 个 scenarios`);
  updated++;
}

console.log(`\n完成：更新 ${updated} 个，跳过 ${skipped} 个`);

// ── 高频模板补充 scenarios ──────────────────────────────────────
const HIGH_FREQ_SCENARIOS = {
  twoColumnCards: [
    { trigger: "两个概念并排介绍，篇幅相当", example: "效率 vs 弹性、传统供应链 vs 数字化供应链——两栏对等展示" },
    { trigger: "左右对比但不是优劣，而是两种路径", example: "两种战略路径的分析，无对错之分，各有侧重" },
  ],
  iconList: [
    { trigger: "3-5个并列要点，需要图标辅助记忆", example: "五大核心能力：速度/质量/成本/服务/创新，每点配图标" },
    { trigger: "特点、优势、建议的列举", example: "数字化转型的4个关键成功因素，每条有标题和说明" },
  ],
  styledTable: [
    { trigger: "多行多列的对比数据，需要表格呈现", example: "ISC成熟度对标：5维度×3阶段，蓝色表头，底部有结论条" },
    { trigger: "评估矩阵、现状vs目标对比", example: "当前状态/行业标杆/差距程度三列，清晰展示现状" },
    { trigger: "比analysisMatrix数据更文字化时", example: "内容以文字描述为主，而非评分/颜色，用styledTable" },
  ],
  threeColumn: [
    { trigger: "三个并列概念/维度/阶段", example: "成功变革三要素：领导力/愿景/能力——三列等宽展示" },
    { trigger: "三阶段或三个选择的展示", example: "快赢/中期/长期三个层次的解决方案" },
  ],
  comparison: [
    { trigger: "左右两方的优缺点、差异对比", example: "变革前 vs 变革后、问题清单 vs 解法清单" },
    { trigger: "两种方案/观点的全面对比", example: "传统模式 vs 数字化模式：各列5-8个对比条目" },
    { trigger: "注意：items必须是string[]，不能是对象", example: "正确：['条目文字', '条目文字']，错误：[{text:'...'}]" },
  ],
  cardGrid: [
    { trigger: "4-6个并列模块，需要网格布局", example: "六大能力模块、四大战略支柱——卡片式网格，有标题和描述" },
    { trigger: "比threeColumn需要更多卡片时（4-8个）", example: "超过3列用cardGrid，指定columns=2或3" },
  ],
  processFlow: [
    { trigger: "3-6个有顺序的执行步骤", example: "变革推进五步：点火→联盟→激活→扩散→固化" },
    { trigger: "工作流程、标准流程说明", example: "数字化预警四步流：采集→识别→预警→响应" },
    { trigger: "与causalChain的区别：步骤平行执行，无因果分类标签", example: "processFlow用于执行步骤，causalChain用于因果诊断" },
  ],
  stepList: [
    { trigger: "3-5个步骤，每步需要详细说明", example: "实施5步法，每步有标题和2-3行说明文字" },
    { trigger: "比processFlow需要更多文字时", example: "processFlow适合短标题，stepList适合每步要详述" },
  ],
  dataHighlight: [
    { trigger: "2-4个关键数字需要醒目展示", example: "94%失败率、$4T损失、3.7x成本涨幅——大字数字配说明" },
    { trigger: "开篇震撼数据页", example: "用大数字建立问题严重性认知，引出后续解决方案" },
  ],
  phaseDiagram: [
    { trigger: "3-4个阶段的实施路线图", example: "18个月四阶段：基础夯实/能力建设/规模推广/持续优化" },
    { trigger: "比ganttChart更概括，不需要精确时间", example: "展示阶段名+周期+关键任务，不需要具体日期" },
  ],
  beforeAfter: [
    { trigger: "变革前后的对比，强调改变", example: "零库存→分层安全库存、统一政策→差异化策略" },
    { trigger: "改进措施的效果展示", example: "每对比项有旧方式和新方式，底部有总结条" },
  ],
  timeline: [
    { trigger: "关键历史节点或里程碑时间线", example: "公司发展史：2015创立→2018融资→2021上市→2024转型" },
    { trigger: "项目关键节点展示", example: "不需要精确时间条的节点式时间轴，适合里程碑汇报" },
  ],
  quoteBanner: [
    { trigger: "一句话引用，配作者/来源", example: "'没有感知的管理是伪管理' — Peter Drucker" },
    { trigger: "页面中间插入金句，节奏停顿", example: "正文讲完后插入一条相关名言，增加说服力" },
  ],
  staircase: [
    { trigger: "3-5个阶梯式递进的阶段或层次", example: "能力成熟度阶梯：初级→规范→优化→智能→领先" },
    { trigger: "从左下到右上的递进成长感", example: "比processFlow更强调层层上升的视觉感" },
  ],
  caseBox: [
    { trigger: "侧边强调框，案例补充说明", example: "正文右侧或下方的辅助案例框，左边有强调竖条" },
    { trigger: "注意：不适合作为全页主内容", example: "caseBox高度默认1.2英寸，全页用会大量留白，改用iconList" },
  ],
  checklist: [
    { trigger: "任务清单、核查项、行动清单", example: "变革进度追踪：8个检查点，标注完成/未完成状态" },
    { trigger: "行动建议列表，需要勾选感", example: "本周必做清单，强调可执行性和可追踪性" },
  ],
  layeredList: [
    { trigger: "分层级的列表，有主次关系", example: "战略层→执行层→操作层，每层有标签和具体条目" },
    { trigger: "有分类汇总的结构化清单", example: "三类风险：各类有标签，展开后有具体项目" },
  ],
  swotGrid: [
    { trigger: "SWOT分析：优势/劣势/机会/威胁", example: "企业战略SWOT，四象限各列3-5个要点" },
    { trigger: "2×2战略分析框架", example: "不只是SWOT，任何2×2框架都可以用（如机会×可行性矩阵）" },
  ],
  colorMatrix: [
    { trigger: "彩色2×2象限，比swotGrid更强视觉", example: "高优先级/低优先级 × 高影响/低影响，用色块区分" },
    { trigger: "BCG矩阵、优先级矩阵等管理框架", example: "明星/问题/现金牛/瘦狗四象限，颜色区分各类别" },
  ],
  quadrantMatrix: [
    { trigger: "2×2矩阵，有X轴Y轴说明", example: "利益相关方分析：影响力×支持度四象限" },
    { trigger: "比colorMatrix更需要轴标签时", example: "需要标注X/Y轴含义（如影响力、支持度）来帮助读者理解坐标意义" },
  ],
  tocPage: [
    { trigger: "目录页，列出PPT章节结构", example: "4-5个章节的目录，带编号圆圈和章节说明" },
    { trigger: "注意：作为顶层页面，type必须是'toc'，不能是content+layout:tocPage", example: "正确：{type:'toc', items:[...]}，错误：{type:'content', layouts:[{type:'tocPage'}]}" },
  ],
  problemSolution: [
    { trigger: "问题-解决方案的左右并列", example: "左侧列出3个核心问题，右侧对应3个解决方案" },
    { trigger: "比comparison更聚焦在问题→方案关系时", example: "有明确对应关系的问题和解法，不只是两方对比" },
  ],
};

// 运行高频模板补充
console.log('\n=== 补充高频模板 scenarios ===');
for (const [templateName, scenarios] of Object.entries(HIGH_FREQ_SCENARIOS)) {
  const fileName = templateName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') + '.js';
  const filePath = path.join(TPLS_DIR, fileName);
  if (!fs.existsSync(filePath)) { console.log(`[SKIP] ${templateName} 文件不存在`); continue; }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('scenarios:')) { console.log(`[SKIP] ${templateName} 已有 scenarios`); continue; }
  const scenariosJson = JSON.stringify(scenarios, null, 6).replace(/\n/g, '\n    ');
  const insertBefore = /(\s+typicalHeight:)/;
  const insertAtEnd  = /(,?\s*\},\s*\n\s*get selfLearning)/;
  if (insertBefore.test(content)) {
    content = content.replace(insertBefore, `\n    scenarios: ${scenariosJson},\n$1`);
  } else if (insertAtEnd.test(content)) {
    content = content.replace(insertAtEnd, `,\n    scenarios: ${scenariosJson},\n$1`);
  } else {
    content = content.replace(/(notWhen:\s*'[^']*',)/, `$1\n    scenarios: ${scenariosJson},`);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${templateName} → 注入 ${scenarios.length} 个 scenarios`);
}
