# BRINGPPT 版式选择指南

> 从 SKILL.md 拆出。需要为某一页选模板时阅读本文件。
> 所有版式的函数签名、字段约束、字符限制见 `docs/bring-templates.md`。

**选模板的唯一标准是内容与模板的适配度，使用频率不是参考依据。**

## 选模板流程（两步）

**第一步：确定内容结构类型**（并列 / 流程 / 对比 / 数据 / 分析 / 矩阵 / 叙事 / 图文 / 项目管理）

**第二步：在该类型的候选池中，按适配度最优选择**

- 候选池中所有模板机会均等，不得因"高频/低频"跳过任何候选
- 判断标准：① 内容量是否在模板安全范围内；② scenarios 是否与当前页内容匹配；③ 视觉表达是否比其他候选更准确

---

## 并列型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 2个概念，各含1段描述 | **twoColumnCards** / **hourglass**（有聚合感时） | twoColumnCards每卡≤120字 |
| 3个概念，各含标题+描述 | **threeColumn** / **iconList**（需图标时） / **cardGrid**（desc短时） | threeColumn desc≤60字 |
| 3-5个要素，图标/编号区分 | **iconList** / **stepList**（需详述时） / **radialHub**（围绕核心时） | iconList desc≤40字 |
| 4个要素，展示关联/交叉 | **flowerPetal** / **vennDiagram**（有交集时） / **radialHub** | flowerPetal需4项 |
| 4-8个要素，短标题+简述 | **cardGrid** / **threeColumn**（≤3项时） / **iconList** | cardGrid title≤12字+desc≤25字 |
| 核心概念+4-6个辐射分支 | **radialHub** / **flowerPetal**（4项时） / **iconList** | radialHub辐射≤6项 |
| 4-6 个核心能力/生态要素（蜂窝感） | **hexagonHive** / **radialHub**（围绕核心时） / **cardGrid** | hexagonHive 4-6 项，cluster 或 line 两种排布 |

## 流程/步骤型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 3-5步，需详细描述 | **stepList** / **processFlow**（desc短时） / **phaseDiagram**（有工作项时） | stepList desc≤60字 |
| 3-5步，强调步骤间传递关系 | **processFlow** / **chainFlow**（链条感强时） / **stepList** | processFlow desc≤20字 |
| 3-6步强调链条连续性 | **chainFlow** / **processFlow** / **snakeFlow**（≥6步时） | — |
| 6-10步，多步紧凑排列 | **snakeFlow** / **stepList**（≤6步时） | snakeFlow多行折返 |
| 4-6步闭环/循环（PDCA等） | **cycleDiagram** / **processFlow** | 环形顺时针排列 |
| 3-5步递进/成长路径 | **waveProgression** / **staircase** / **processFlow** | waveProgression有上升感 |
| 3-6级成长/层级递进 | **staircase** / **pyramid**（层级关系时） / **waveProgression** | staircase label≤4字 |
| 时间线/里程碑节点 | **timeline** / **dualTrackTimeline**（双线时） / **phaseDiagram** | timeline 3-5项 |
| 两条并行时间线 | **dualTrackTimeline** / **timeline** | 上下双轨 |
| 3-5阶段路线图，含工作项 | **phaseDiagram** / **processFlow** / **ganttChart**（需精确时间时） | 每阶段3-4项 |

## 对比型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 正反/优劣/两方对比 | **comparison** / **twoColumnCards**（篇幅对等时） / **hourglass**（问题→方案时） | comparison每侧≤25字/条 |
| 变革前→后，强调改变 | **beforeAfter** / **comparison** / **dualPanel**（需右侧行动步骤时） | beforeAfter before≤10字 |
| 问题聚焦→方案发散 | **hourglass** / **comparison** / **problemSolution** | hourglass每侧≤5条 |
| 问题→解决方案对照 | **problemSolution** / **comparison** / **hourglass** | 3-5对 |
| 变革前后+执行步骤同页 | **dualPanel** / **beforeAfter** | 左侧映射+右侧列表 |

## 数据/指标型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 2-4个核心大数字（震撼感） | **dataHighlight** / **achievement**（有完成率时） / **kpiDashboard**（有目标值时） | number≤8字 |
| 2-4个成果指标+完成率 | **achievement** / **dataHighlight** / **kpiDashboard** | value≤5字 |
| 2-4个KPI+趋势+目标值 | **kpiDashboard** / **dataHighlight** / **achievement** | 含趋势箭头 |
| 分类对比数据（柱/条形） | **chartBar** / **styledTable**（文字多时） | 支持多系列、堆叠 |
| 分类对比，需视觉冲击 | **chartBar3D** / **chartBar** | 3D 立体柱，营销/封面页 |
| 时间序列趋势 | **chartLine** / **chartBar** | 支持多系列 |
| 累积构成/占比演变 | **chartArea** / **chartLine** | 支持堆叠面积 |
| 占比/分布数据 | **chartPie** / **chartBar** | 支持环形图 |
| 量+率双轴组合 | **chartCombo** | 柱状+折线双轴 |

## 分析/诊断型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 多维度根因分析（5M1E等） | **fishbone** / **causalChain**（纵向因果时） | fishbone 4分类×2-3项 |
| 纵向因果链（层层递进） | **causalChain** / **fishbone**（多维时） / **layeredList** | 每层有标签 |
| 问题→解决方案 | **problemSolution** / **comparison** / **hourglass** | 3-5对 |
| 转化漏斗/层层筛选 | **funnel** / **stepList** | 4-5层 |
| 多维度能力评估 / 对标 | **chartRadar** / **analysisMatrix**（文字主导时） | 3-8 维度，雷达填充式 |
| 价值-可行性精确矩阵 | **chartScatter** / **quadrantMatrix**（粗分类时） | scatter 支持任意点数 |
| 三维数据评估（值×可行×投入） | **chartBubble** / **chartScatter**（不含第三维时） | 气泡大小 = 第三维 |

## 矩阵/框架型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 2×2分析框架（线框风格） | **quadrantMatrix** / **colorMatrix**（需彩色区分时） | content≤40字/格 |
| 2×2分析框架（彩色填充） | **colorMatrix** / **quadrantMatrix**（需坐标轴时） | content≤40字/格 |
| SWOT/PEST等经典四格 | **swotGrid** / **colorMatrix** | 4格各含要点列表 |
| 2-3个概念交集/重叠 | **vennDiagram** / **flowerPetal**（4项时） | 半透明圆交叉 |
| 层级/金字塔（3-5层） | **pyramid** / **layeredList**（需标签时） / **staircase** | desc≤25字/层 |
| 递进概念，需分类标签 | **layeredList** / **pyramid** / **causalChain** | desc≤40字，tag≤8字 |
| 多行多列评估矩阵 | **analysisMatrix** / **styledTable**（文字主导时） | 最多8行×6列 |
| 组织架构/层级树状 | **orgChart** / **styledTable** | 最多3层深度 |
| 表格/多维度数据 | **styledTable** / **analysisMatrix**（有视觉对比时） | 列≤6，行≤8 |
| 多因子归一/一对多映射 | **bracketGroup** / **fishbone**（多维归因时） | 左侧 3-6 项 → 右侧 1 个汇总 |
| 3D 立体层级架构 | **cubeStack** / **pyramid**（不需立体感时） / **layeredList** | 3-5 层，由下到上 |

## 叙事/引用型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 核心金句，整页冲击力 | **fullQuote** / **impactQuestion**（问句形式时） | quote≤60字 |
| 嵌入式引言+其他内容 | **quoteBanner** / **quoteEmphasis**（需警示强调时） | quote≤50字 |
| 大字冲击提问+答案 | **impactQuestion** / **fullQuote** | question≤30字 |
| 引言+红色警示强调 | **quoteEmphasis** / **quoteBanner** | emphasis≤40字 |
| 段落+关键词高亮（黄色底/描边） | **keywordHighlight** / **quoteEmphasis** | 段落含 2-4 个关键词 |
| 未来趋势/灵感发散关键词 | **cloudConcept** / **flowerPetal**（4 项时） | 3-5 朵云形 |
| 案例/故事，轻量嵌入 | **caseBox** / **sidebarLabel**（需大字分类标注时） | content≤100字 |
| 案例/故事，独立分隔页 | **caseDivider** | 后跟内容页 |
| 核心洞察横条强调 | **insightBanner**（嵌入其他版式底部） | text≤40字 |

## 图文/复合型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 图片+文字说明 | **imageText** / **dualPanel**（有映射关系时） | 左图右文或反向 |
| 2-4张图片网格 | **imageGallery** / **imageText**（单图时） | 自动布局 |
| 截图/UI/流程节点标注（带指引线） | **imageText** / **freeform** | v4.1.5 起 calloutAnnotation 已软删除（孤立气泡无图像意义）；标注场景改用 imageText / freeform |
| 目录/大纲导航页 | **toc**（独立页） | 编号列表或2列网格；items[].targetSlide 实现点击跳转 |
| 资源/参考链接清单（可点击跳转） | **linkList** / **toc**（章节跳转时） | items[].url 或 .slide |
| 章节模块总览/预览 | **moduleOverview** / **sectionSlide** | 含子主题列表 |
| 左侧分类标注+右侧卡片 | **sidebarLabel** / **layeredList** | 执行摘要、分层建议 |

## 项目管理型 — 候选池

| 内容特征 | 候选模板（按适配度选，无优先级） | 约束 |
|---------|--------------------------------|------|
| 项目计划，有明确时间节点 | **ganttChart** / **phaseDiagram**（不需精确时间时） | 4-8任务×4-6月 |
| Q1-Q4季度计划 | **quarterlyPlan** / **cardGrid** | 每季度3-4项 |
| 多任务进度/完成率 | **progressList** / **checklist**（勾选感时） / **styledTable** | 4-6项 |
| 3-5个并行项目状态 | **multiProjectCards** / **cardGrid** | 含进度百分比 |
| 任务清单/行动计划 | **checklist** / **progressList**（需百分比时） | 带✓/○标记 |

---

## 反模式（禁止）

- stepList 只用于流程步骤，不用于案例/数据故事
- processFlow 不用于 before/after 对比（用 beforeAfter）
- pyramid 只用于层级结构，不用于并列概念
- timeline 不超过5项（>6项用 cardGrid）
- 单个 stepList 不超过5项（>5项用 cardGrid/styledTable）
- 不要连续两页使用相同版式

## 组合规则

- 所有B类模板需先 `addContentSlide` 再叠加
- 同一页可叠加多个B类模板（如 threeColumn + quoteBanner），后续模板自动读取 `slide._bottomY` 衔接
- 独立页面（fullQuote/sectionSlide/caseDivider/toc）不需要 addContentSlide 包裹
- quoteBanner 和 caseBox 最适合做"叠加组件"，搭配主版式使用
