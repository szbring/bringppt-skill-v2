# BRINGPPT 模板字段速查表

> 自动从 bringppt registry 抽取，共 **91 个模板**（v4.1.5 软删 calloutAnnotation）。
> 生成命令：`node scripts/build-field-cheatsheet.js` (npm script: `npm run cheatsheet`)
> v4.1.0 之后 schema 已统一为单一标准 form：`{ type, required?, description?, warn?, error?, min?, max?, item? }`

## Schema 写法约定

每个字段定义：

```js
{
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'function' | 'any',
  required: true,           // 默认 false（不写就是可选）
  description: '中文描述',
  warn: 20,                 // 字符串长度软警告
  error: 35,                // 字符串长度硬错误（仅 type:string）
  min: 2,                   // 数组长度最小（仅 type:array）
  max: 4,
  item: { ...nestedSchema } // 数组单元素 schema（单数 item）
}
```

嵌套对象字段直接写成 `{ child1: {...spec}, child2: {...spec} }`（不需要 type:object 包裹）。

---

## Drive 上传相关 meta 字段（v4.1.9）

> bringppt 不实现上传，但生成 `.pptx` 后会输出符合 OpenAPI `UploadFileToDriveRequest` 规格的调用 JSON，让代理可直接喂给 `upload_file_to_drive` 工具。规格来源：`google-drive-upload-openapi.yaml` / `google-drive-upload-interface-spec.md`。

### 可选 meta 字段

| 字段 | 类型 | 默认 | 对应 OpenAPI 字段 | 说明 |
|---|---|---|---|---|
| `destinationFolderId` | string | `10cQkBoa86WdwdlUSEZsebQao1wh_gz2O` | `destination_folder_id` | 目标 Drive 文件夹 ID。优先级最高 |
| `destinationFolderUrl` | string | — | `destination_folder_url` | 形如 `https://drive.google.com/drive/folders/<ID>` |
| `onConflict` | string | `keep_both` | `on_conflict` | 枚举：`keep_both` / `replace` / `fail` |

### 目录优先级

```
CLI --destination-folder-id
  > CLI --destination-folder-url
  > env BRINGPPT_DEFAULT_FOLDER_ID
  > meta.destinationFolderId
  > meta.destinationFolderUrl
  > Agent 默认 10cQkBoa86WdwdlUSEZsebQao1wh_gz2O
  > My Drive（由 upload_file_to_drive 工具自行兜底）
```

### 示例：storyboard 显式指定 Drive 输出位置

```json
{
  "meta": {
    "title": "客户提案",
    "author": "薄云咨询",
    "destinationFolderId": "1AbcDefXYZ",
    "onConflict": "replace"
  },
  "chapters": [ ... ]
}
```

### 示例：CLI 指定（推荐）

```bash
node ppt-pipeline.js --input storyboard.json \
  --destination-folder-id 1AbcDefXYZ \
  --on-conflict replace
```

### pipeline 输出的请求 JSON（严格符合 OpenAPI schema）

```json
{
  "source_file":           "/abs/path/to/output.pptx",
  "title":                 "客户提案-2026-05-18.pptx",
  "destination_folder_id": "1AbcDefXYZ",
  "mime_type":             "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "on_conflict":           "replace"
}
```

### 错误代码集（OpenAPI `DriveUploadError.error_code` enum）

`SOURCE_FILE_NOT_FOUND` / `INVALID_DESTINATION_FOLDER` / `DESTINATION_ACCESS_DENIED` / `UPLOAD_FAILED` / `FILE_CONFLICT` / `DESTINATION_VERIFICATION_FAILED`

bringppt 仅在 `destination_folder_url` 解析失败时本地抛 `INVALID_DESTINATION_FOLDER`，其余错误由 `upload_file_to_drive` 工具返回。

---

## Top 8 易错模板字段速查（v4.1.1 新增）

> 基于 v4.1.0 usage-dashboard 数据，以下 8 个最常用模板错误率 25-50%。每个模板列必填字段 + 1 个正确示例 + 1 个错误示例。

### 1. `stepList` — 步骤型流程

- **必填**：`steps: [{ title, desc?, status? }]`，3-7 项
- **正例**：
  ```json
  { "steps": [
    { "title": "诊断", "desc": "梳理现状" },
    { "title": "设计", "desc": "方案制定" },
    { "title": "落地", "desc": "实施推进" }
  ]}
  ```
- **误写**：`{ "items": [...] }` ✗（字段名错），`{ "steps": ["诊断","设计"] }` ✗（应为对象数组）

### 2. `comparison` — 对比型

- **必填**：`leftTitle`, `rightTitle`, `leftItems: [string]`, `rightItems: [string]`
- **正例**：`{ "leftTitle":"现状", "rightTitle":"未来", "leftItems":["人工"], "rightItems":["自动化"] }`
- **误写**：`{ "left":{...}, "right":{...} }` ✗（字段名应分开，不要嵌套），`{ "items":[{left:...,right:...}] }` ✗

### 3. `iconList` — 图标列表

- **必填**：`items: [{ icon?, title, desc? }]`，3-5 项
- **正例**：`{ "items":[{"icon":"target","title":"目标","desc":"明确"},{"icon":"users","title":"团队","desc":"协同"},{"icon":"trending-up","title":"增长","desc":"持续"}] }`
- **误写**：`desc` 字段超 50 字会触发自动截断（v4.1.1 修 C-4 已自适应字号）；`items` 少于 3 个会触发错误

### 4. `layeredList` — 分层列表

- **必填**：`layers: [{ label, items: [string] }]`，2-5 层
- **正例**：`{ "layers":[{"label":"战略层","items":["愿景","目标"]},{"label":"执行层","items":["计划","行动"]}] }`
- **误写**：`{ "items":[...] }` ✗（应为 layers），`{ "layers":["a","b"] }` ✗（必须含 label+items）

### 5. `dataHighlight` — 数据强调

- **必填**：`stats: [{ number, label, desc? }]`，1-4 项；**number 必须含数字**
- **正例**：`{ "stats":[{"number":"95%","label":"覆盖率"},{"number":"3.2亿","label":"营收"}] }`
- **误写**：`{ "stats":[{"number":"高","label":"满意度"}] }` ✗（无数字，v4.1.1 修 Mi-5 会 WARN），`{ "items":[...] }` ✗

### 6. `styledTable` — 美化表格

- **必填**：`headers: [string]`, `rows: [[string]]`
- **正例**：`{ "headers":["阶段","时间","负责人"], "rows":[["设计","6 月","张三"],["开发","7 月","李四"]] }`
- **误写**：`{ "rows":[{a:1,b:2}] }` ✗（应为二维数组），`{ "columns":[...] }` ✗（字段名错）

### 7. `processFlow` — 流程图

- **必填**：`steps: [{ title, desc? }]`，3-8 项
- **正例**：`{ "steps":[{"title":"输入","desc":"原始数据"},{"title":"处理","desc":"清洗"},{"title":"输出","desc":"洞察"}] }`
- **误写**：`{ "items":[...] }` ✗，`{ "steps":[{"name":"a"}] }` ✗（字段是 `title` 不是 `name`）

### 8. `twoColumnCards` — 双列卡片

- **必填**：`leftTitle`, `rightTitle`, `leftItems: [{title,desc?}]`, `rightItems: [{title,desc?}]`
- **正例**：`{ "leftTitle":"优势","rightTitle":"挑战","leftItems":[{"title":"快","desc":"24h"}],"rightItems":[{"title":"贵","desc":"成本高"}] }`
- **误写**：`{ "cards":[...] }` ✗（应分 left/right），`leftItems:["a","b"]` ✗（应为对象数组）

> **修复建议**：以上 8 个模板若 WARN/ERROR，先核对字段名拼写，再核对必填项是否齐全。**字段名严格区分大小写**。

---

## 实验性模板（v4.1.4 标注）

以下 39 个模板在 v4.1.3 usage-dashboard 中累计使用 0 次（注册表存在但从未被生成日志记录）。这些模板**仍可调用**，但属于实验性状态：

- 不在主路径推荐链（CANDIDATE_CHAINS）中
- 字段稳定性、视觉一致性、错误处理可能弱于热门模板
- **下一个 major 版本（v5.0.0）可能软删除（`module.exports = null`）**
- 如有重度依赖某个，请在 issue 中说明使用场景，将提升为正式

实验性模板清单：

`actionTitleSlide` · `ansoffMatrix` · `arrowChain` · `bracketGroup` · `calloutAnnotation` · `chartBubble` · `chartRadar` · `chartScatter` · `cloudConcept` · `compositeLayout` · `constraintCheck` · `cubeStack` · `customerSegmentation` · `decisionTree` · `executiveSummary` · `gauge` · `heroClosing` · `heroQuote` · `heroStat` · `hexagonHive` · `issueTree` · `keywordHighlight` · `lineupCompare` · `maturityModel` · `meceLayout` · `phasedGantt` · `productMatrix` · `progressBar` · `progressRing` · `radialNav` · `riskMatrix` · `sankeyDiagram` · `scqaNarrative` · `serviceBlueprint` · `stakeholderMap` · `threeHorizons` · `timelineWithMetrics` · `tornadoChart` · `valueDriverTree`

> v4.1.4 这次只标注，不软删；v4.1.5 起 weekly-checkup 会扫描连续 N 周仍 0 使用的项，自动提议进入软删除流程。

---

## 索引

- **数据/指标型** (8): [`achievement`](#achievement) · [`chartBar`](#chartbar) · [`dataHighlight`](#datahighlight) · [`gauge`](#gauge) · [`heroStat`](#herostat) · [`kpiDashboard`](#kpidashboard) · [`progressBar`](#progressbar) · [`progressRing`](#progressring)
- **并列型** (6): [`cardGrid`](#cardgrid) · [`flowerPetal`](#flowerpetal) · [`hexagonHive`](#hexagonhive) · [`iconList`](#iconlist) · [`threeColumn`](#threecolumn) · [`twoColumnCards`](#twocolumncards)
- **流程/步骤型** (10): [`arrowChain`](#arrowchain) · [`chainFlow`](#chainflow) · [`dualTrackTimeline`](#dualtracktimeline) · [`phaseDiagram`](#phasediagram) · [`processFlow`](#processflow) · [`snakeFlow`](#snakeflow) · [`staircase`](#staircase) · [`stepList`](#steplist) · [`timeline`](#timeline) · [`waveProgression`](#waveprogression)
- **流程/序列型** (1): [`timelineWithMetrics`](#timelinewithmetrics)
- **对比型** (5): [`beforeAfter`](#beforeafter) · [`comparison`](#comparison) · [`hourglass`](#hourglass) · [`lineupCompare`](#lineupcompare) · [`productMatrix`](#productmatrix)
- **矩阵/框架型** (15): [`analysisMatrix`](#analysismatrix) · [`bracketGroup`](#bracketgroup) · [`colorMatrix`](#colormatrix) · [`constraintCheck`](#constraintcheck) · [`cubeStack`](#cubestack) · [`layeredList`](#layeredlist) · [`meceLayout`](#mecelayout) · [`orgChart`](#orgchart) · [`pyramid`](#pyramid) · [`quadrantMatrix`](#quadrantmatrix) · [`radialNav`](#radialnav) · [`serviceBlueprint`](#serviceblueprint) · [`styledTable`](#styledtable) · [`swotGrid`](#swotgrid) · [`vennDiagram`](#venndiagram)
- **分析/诊断型** (9): [`chartBubble`](#chartbubble) · [`chartRadar`](#chartradar) · [`chartScatter`](#chartscatter) · [`fishbone`](#fishbone) · [`funnel`](#funnel) · [`maturityModel`](#maturitymodel) · [`problemSolution`](#problemsolution) · [`sankeyDiagram`](#sankeydiagram) · [`tornadoChart`](#tornadochart)
- **咨询框架** (9): [`ansoffMatrix`](#ansoffmatrix) · [`customerSegmentation`](#customersegmentation) · [`decisionTree`](#decisiontree) · [`issueTree`](#issuetree) · [`riskMatrix`](#riskmatrix) · [`scqaNarrative`](#scqanarrative) · [`stakeholderMap`](#stakeholdermap) · [`threeHorizons`](#threehorizons) · [`valueDriverTree`](#valuedrivertree)
- **项目管理型** (6): [`checklist`](#checklist) · [`ganttChart`](#ganttchart) · [`multiProjectCards`](#multiprojectcards) · [`phasedGantt`](#phasedgantt) · [`progressList`](#progresslist) · [`quarterlyPlan`](#quarterlyplan)
- **叙事/引用型** (11): [`actionTitleSlide`](#actiontitleslide) · [`caseBox`](#casebox) · [`cloudConcept`](#cloudconcept) · [`executiveSummary`](#executivesummary) · [`heroClosing`](#heroclosing) · [`heroQuote`](#heroquote) · [`impactQuestion`](#impactquestion) · [`insightBanner`](#insightbanner) · [`keywordHighlight`](#keywordhighlight) · [`quoteBanner`](#quotebanner) · [`quoteEmphasis`](#quoteemphasis)
- **图文/复合型** (3): [`dualPanel`](#dualpanel) · [`moduleOverview`](#moduleoverview) · [`sidebarLabel`](#sidebarlabel)  *(v4.1.5 软删 calloutAnnotation)*
- **其他** (1): [`compositeLayout`](#compositelayout)
- **逃生舱** (1): [`freeform`](#freeform)
- **页面模板** (6): [`backCoverSlide`](#backcoverslide) · [`closingQuote`](#closingquote) · [`contentSlide`](#contentslide) · [`heroCover`](#herocover) · [`heroSection`](#herosection) · [`tocPage`](#tocpage)

---

## 数据/指标型

### `achievement`

**说明**：成就/指标展示卡片，1-4个指标，带圆形进度环视觉
**何时用**：展示KPI、成果数据、关键指标
**不要用**：超过4个指标时建议改用table
**典型高度**：约3.0英寸

**字段**：

- `metrics`: array · optional · — [{ value, label, desc? }]，最多4个
- `title`: string · optional · — 可选标题
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 展示成绩、里程碑、项目成果 — `项目完成率92%、客户满意度4.8分——用圆形进度环强调数值`
- 季度/年度复盘汇报的亮点数据 — `年度营收增长35%、新增客户120家——2-4个核心成就并排展示`
- 比 dataHighlight 更需要进度感时 — `有目标值和完成率的指标，如KPI完成度70%→100%`

---

### `chartBar`

**说明**：柱形图/条形图，支持水平、堆叠模式
**何时用**：展示分类数据对比，如销售额、数量对比
**不要用**：数据类别极多（>10）或需要展示趋势时
**典型高度**：3.2~3.6英寸

**字段**：

- `data`: array · optional · — 图表数据系列
- `title`: string · optional · — 图表标题
- `horizontal`: boolean · optional · 默认=false · — 是否水平方向
- `stacked`: boolean · optional · 默认=false · — 是否堆叠
- `showValue`: boolean · optional · 默认=false · — 是否显示数值
- `startY`: number · optional · — 起始Y坐标
- `chartH`: number · optional · 默认=3.2 · — 图表高度

**典型场景**：
- 各类别数据量的横向比较 — `五家竞争对手的市场份额对比——柱状图最直观`
- 同一指标在不同时间段的对比 — `Q1-Q4营收对比，或今年vs去年同期`
- 与chartLine的区别：比较离散类别，而非趋势 — `比较多个项目/部门/产品时用chartBar，看时间走势用chartLine`

---

### `dataHighlight`

**说明**：2-4个核心大数字/指标醒目展示
**何时用**：页面有2-4个关键数字、百分比、金额需要视觉突出
**不要用**：数字超过4个；数字不是核心内容
**典型高度**：1.5-2.0"

**字段**：

- `items`: array · optional · 长度 2–4
  - `number`: string · optional · 长度 warn=8 / error=12
  - `label`: string · optional · 长度 warn=12 / error=20
  - `unit`: string · optional
  - `desc`: string · optional · 长度 warn=60 / error=120
- `startY`: number · optional
- `fontSize`: number · optional

**典型场景**：
- 2-4个关键数字需要醒目展示 — `94%失败率、$4T损失、3.7x成本涨幅——大字数字配说明`
- 开篇震撼数据页 — `用大数字建立问题严重性认知，引出后续解决方案`

---

### `gauge`

**说明**：半圆仪表盘：1-3 个 半圆指针 + 中心大数字，适合"风险/状态/性能"级别展示
**何时用**：风险/状态/性能等级（红橙黄绿四色区域）的可视化
**不要用**：简单百分比用 progressRing；多 KPI 用 dataHighlight

**字段**：

- `gauges`: array · **required** · 长度 1–3
  - `label`: string · optional · 长度 warn=12 / error=20
  - `value`: number · **required**
  - `unit`: string · optional
  - `zones`: array · optional
- `startY`: number · optional

**典型场景**：
- PUE 能效仪表 — `PUE 1.15 (target ≤ 1.2)`

---

### `heroStat`

**说明**：杂志式 hero 大数字：占满整页的超大字号 + 上下文解释 + 来源
**何时用**：需要一页一个数字震撼客户：客户管理层第一眼必看的核心 KPI
**不要用**：多个并列数字（用 dataHighlight）；常规 KPI 仪表（kpiDashboard）
**典型高度**：full-page

**字段**：

- `statValue`: string · **required** · 长度 warn=8 / error=12 · — 核心数字（如 95%）
- `statLabel`: string · **required** · 长度 warn=20 / error=35 · — 数字标签
- `context`: string · optional · 长度 warn=50 / error=80 · — 上下文（一句话解释）
- `comparison`: string · optional · — 对照值（如 "vs 行业 75%"）
- `sourceRef`: string · optional · — 数据来源

**典型场景**：
- 提案核心承诺 — `"95%: 12 个月需求自动化覆盖率"`

---

### `kpiDashboard`

**说明**：KPI仪表盘，展示2-4个关键指标卡片
**何时用**：展示核心业务指标，如销售额、增长率
**不要用**：指标超过4个或需要详细图表分析时
**典型高度**：2.0~2.5英寸

**字段**：

- `kpis`: array · optional · — KPI列表 [{ label, value, unit?, trend?, trendLabel?, color? }]，最多4项
- `title`: string · optional · — 标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 月度/季度运营数据总览 — `GMV、DAU、转化率、毛利率4个核心指标卡片式展示`
- 业务健康度快速一览 — `比dataHighlight更适合：有目标值、实际值、环比变化三要素时`
- 给高管看的数据摘要页 — `不需要图表，只看关键数字，配色区分好坏状态`

---

### `progressBar`

**说明**：水平进度条：N 行 label + 进度条 + 数值，适合利用率/完成度/达成率
**何时用**：展示多个并列的"利用率/达成率/进度"型数据
**不要用**：单一大数字用 dataHighlight；多维度散点用 chartScatter
**典型高度**：2.5-3.5"

**字段**：

- `bars`: array · **required** · 长度 2–8
  - `label`: string · optional · 长度 warn=15 / error=25
  - `value`: number · **required**
  - `max`: number · optional
  - `unit`: string · optional
  - `color`: string · optional
  - `note`: string · optional · 长度 warn=20 / error=35
- `startY`: number · optional
- `barHeight`: number · optional

**典型场景**：
- 空间/电力/冷却利用率 — `Space 72/84U · Power 82/88kW · Cool 66/80kW`
- OKR 达成率展示 — `O1 85% · O2 60% · O3 95%`

---

### `progressRing`

**说明**：环形进度图：N 个 圆环 + 中心大字百分比 + 下方 label，适合 KPI/达成率展示
**何时用**：1-4 个 KPI 的达成率/利用率/百分比可视化
**不要用**：超过 4 个 KPI 用 dataHighlight；非百分比数据用 chartBar
**典型高度**：2.5-3.5"

**字段**：

- `rings`: array · **required** · 长度 1–4
  - `label`: string · optional · 长度 warn=12 / error=20
  - `value`: number · **required**
  - `sublabel`: string · optional · 长度 warn=25 / error=40
  - `color`: string · optional
- `startY`: number · optional

**典型场景**：
- 4 大 KPI 完成率 — `空间 100% · 电力 94% · 冷却 83% · 网络 88%`

---

## 并列型

### `cardGrid`

**说明**：卡片网格：多列卡片布局，支持组标签、描述文字和汇总栏
**何时用**：能力矩阵、功能列表、多项并列内容展示
**不要用**：流程说明、时间线、引用类内容
**典型高度**：2.0~3.5英寸

**字段**：

- `cards`: array · **required** · — 卡片列表 [{title, desc, bgColor}]
  - `title`: string · optional · 长度 warn=15 / error=25
  - `desc`: string · optional · 长度 warn=30 / error=50
- `columns`: number · optional · — 列数（默认4）
- `groupLabels`: array · optional · — 分组标签 [{text, span, color}]（可选）
- `summary`: string · optional · 长度 warn=50 / error=80 · — 底部汇总文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 4-6个并列模块，需要网格布局 — `六大能力模块、四大战略支柱——卡片式网格，有标题和描述`
- 比threeColumn需要更多卡片时（4-8个） — `超过3列用cardGrid，指定columns=2或3`

---

### `flowerPetal`

**说明**：花瓣/四叶草图，4个半透明圆形交叉，中心有核心标签
**何时用**：展示4个相互关联的核心要素
**不要用**：要素不是4个时
**典型高度**：约3.8英寸

**字段**：

- `center`: string · optional · — 中心标签文字
- `petals`: array · optional · — [{ title, desc?, color? }]，恰好4个
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 4个并列要素围绕一个核心 — `以客户为中心的4个服务维度：速度/质量/价格/体验`
- 比radialHub更需要交叉感、整体感时 — `4个要素既独立又相互支撑，半透明交叉视觉强调整体性`

---

### `hexagonHive`

**说明**：六边形蜂窝排布，承载 6 或 7 个并列要素；中央可放核心概念，外围 6 边形辐射
**何时用**：展示 4-6 个并列的核心能力、生态系统组成、技术栈层级
**不要用**：需要严格顺序时（用 stepList / processFlow）；要素数 > 6 时（视觉拥挤）
**典型高度**：2.8~3.4 英寸

**字段**：

- `items`: array · **required** · — 蜂窝要素数组（6 项 = 中心 + 周围 6 个？不，简化为 6 个独立六边形）：{ title, desc? }
- `title`: string · optional · — 小标题
- `layout`: string · optional · 默认="cluster" · — cluster（紧凑蜂窝）| line（横向单排）
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 咨询团队 6 大核心能力 — `战略 / 运营 / 品牌 / 数字化 / 组织 / 人才——6 块六边形`
- 产品生态构成 — `"开发者 / 合作伙伴 / 客户 / 服务商 / 资本 / 政府" 六维生态`
- 技术栈分层（非顺序） — `基础设施 / 数据 / AI / 应用 / 用户 / 监控 6 个模块`

---

### `iconList`

**说明**：3-5个要素配图标/编号，适合并列要点展示
**何时用**：内容是3-5个并列要点，需要图标或编号区分
**不要用**：要点有先后顺序（用stepList）；超过5个要点
**典型高度**：2.0-3.2"

**字段**：

- `items`: array · optional · 长度 3–5
  - `icon`: any · optional
  - `title`: string · optional · 长度 warn=12 / error=20
  - `desc`: string · optional · 长度 warn=30 / error=50
- `startY`: number · optional
- `numbered`: boolean · optional
- `gradientColors`: boolean · optional

**典型场景**：
- 3-5个并列要点，需要图标辅助记忆 — `五大核心能力：速度/质量/成本/服务/创新，每点配图标`
- 特点、优势、建议的列举 — `数字化转型的4个关键成功因素，每条有标题和说明`

---

### `threeColumn`

**说明**：三列卡片并列布局，支持编号圆圈、标题、描述及底部总结栏
**何时用**：需要并排展示3个独立要点、步骤或优势，需要编号圆圈区分
**不要用**：超过3列或内容差异很大时
**典型高度**：约 2.8~3.5 英寸（含summary）

**字段**：

- `cards`: array · **required** · 长度 3–3 · — 3个卡片对象，每个含 title、desc、number?、color?
  - `title`: string · optional · 长度 warn=10 / error=18
  - `desc`: string · optional · 长度 warn=25 / error=40
- `summary`: string|object · optional · — 底部总结文字或 {text, bgColor}
- `startY`: number · optional
- `maxCardH`: number · optional

**典型场景**：
- 三个并列概念/维度/阶段 — `成功变革三要素：领导力/愿景/能力——三列等宽展示`
- 三阶段或三个选择的展示 — `快赢/中期/长期三个层次的解决方案`

---

### `twoColumnCards`

**说明**：2个概念并列展示，每个含标题+描述文字
**何时用**：内容是2个需要对比或并列展示的概念，各含一段描述
**不要用**：内容超过2个概念；描述文字极短（用threeColumn更好）
**典型高度**：1.5-2.5"

**字段**：

- `cards`: array · optional · 长度 2–2
  - `title`: string · optional · 长度 warn=12 / error=20
  - `content`: string · optional · 长度 warn=80 / error=120
- `startY`: number · optional

**典型场景**：
- 两个概念并排介绍，篇幅相当 — `效率 vs 弹性、传统供应链 vs 数字化供应链——两栏对等展示`
- 左右对比但不是优劣，而是两种路径 — `两种战略路径的分析，无对错之分，各有侧重`

---

## 流程/步骤型

### `arrowChain`

**说明**：商务级 5 段箭头链：每段箭头形 + 顶部标签 + 底部说明，比 chainFlow 更精致
**何时用**：展示阶段性项目路径、咨询服务流程、产品演化路线；强调"顺序 + 阶段性"
**不要用**：项数 < 3 或 > 6（用 stepList）；非顺序关系（用 cardGrid）
**典型高度**：2.0~2.8 英寸

**字段**：

- `items`: array · **required** · — 箭头节点（3-6 项），每项 { title, subtitle?, date? }
- `title`: string · optional · — 小标题
- `subtitle`: string · optional · — 底部一句话总结
- `showHighlight`: number · optional · — 高亮第 N 段（0-based 索引；可选）
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 项目五阶段路径 — `"诊断 → 设计 → 试点 → 推广 → 持续优化"，可标记当前所在阶段`
- 咨询服务流程 — `"立项 → 调研 → 分析 → 方案 → 交付"`
- 产品演化时间线（非精确时间） — `"v1.0 → v2.0 → v3.0 → v4.0"，可附年份`

---

### `chainFlow`

**说明**：链式流程图，3-6个椭圆形节点互相衔接形成链条
**何时用**：展示环环相扣的流程、供应链、价值链
**不要用**：节点超过6个时
**典型高度**：约3.0英寸

**字段**：

- `links`: array · optional · — [{ title, desc? }]，3-6个
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 环环相扣的价值链、供应链 — `采购→生产→仓储→分销→零售——椭圆形节点互相衔接`
- 比processFlow更强调链条连续性时 — `步骤之间有明显的传递关系，不只是顺序执行`

---

### `dualTrackTimeline`

**说明**：双轨时间轴，中央横向时间线，上方轨道A下方轨道B
**何时用**：展示两条并行进行的项目时间线，如开发线与运营线对比
**不要用**：单一时间线，或超过8个时间节点
**典型高度**：3.5英寸

**字段**：

- `trackA`: object
  - `label`: string · optional
  - `events`: array · **required**
- `trackB`: object
  - `label`: string · optional
  - `events`: array · **required**
- `nodes`: array · optional · — 时间轴节点标签（如月份）
  - 元素: `string`
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 两条并行推进的时间轴 — `A团队做技术，B团队做业务，同时推进的双轨项目计划`
- 内部视角 vs 外部视角的时间线 — `上轨：公司内部里程碑，下轨：客户侧感知节点`
- 理论与实践并行的课程设计 — `上轨：理论课程，下轨：实践项目，同步推进`

---

### `phaseDiagram`

**说明**：阶段图/路线图，横向展示多阶段内容
**何时用**：展示项目路线图、多阶段实施计划
**不要用**：阶段超过5个或需要时间轴精度时
**典型高度**：3.0~3.5英寸

**字段**：

- `phases`: array · optional · — 阶段列表 [{ name, items: string[], color? }]，3-5个阶段
- `title`: string · optional · — 标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 3-4个阶段的实施路线图 — `18个月四阶段：基础夯实/能力建设/规模推广/持续优化`
- 比ganttChart更概括，不需要精确时间 — `展示阶段名+周期+关键任务，不需要具体日期`

---

### `processFlow`

**说明**：流程卡片横向排列，带编号、图标、标题、描述和箭头连接
**何时用**：展示线性流程、操作步骤、工作流程时，3~6个步骤最佳
**不要用**：步骤超过6个或步骤间有分支时
**典型高度**：约 2.2 英寸

**字段**：

- `steps`: array · **required** · — 步骤数组，每项含 title、desc?、iconData?
  - `title`: string · optional · 长度 warn=10 / error=18
  - `desc`: string · optional · 长度 warn=30 / error=50
- `startY`: number · optional

**典型场景**：
- 3-6个有顺序的执行步骤 — `变革推进五步：点火→联盟→激活→扩散→固化`
- 工作流程、标准流程说明 — `数字化预警四步流：采集→识别→预警→响应`
- 与causalChain的区别：步骤平行执行，无因果分类标签 — `processFlow用于执行步骤，causalChain用于因果诊断`

---

### `snakeFlow`

**说明**：蛇形/折线流程，6-10步按Z字形排列
**何时用**：展示6-10个步骤的流程，内容较多需要折行显示
**不要用**：步骤少于4个（用processFlow更合适），或不需要编号顺序
**典型高度**：3.5英寸

**字段**：

- `steps`: array · optional · — 步骤列表（6-10个）
  - `title`: string · **required**
  - `desc`: string · optional
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 6-10个步骤的复杂流程 — `供应链全流程10步：需求→计划→采购→入库→生产→质检→出库→配送→签收→结算`
- processFlow放不下时的替代 — `步骤超过6个时用snakeFlow折行排列，比横向挤压更清晰`

---

### `staircase`

**说明**：阶梯递进图，3-6个步骤从左下到右上递进排列
**何时用**：展示成长、进阶、递进过程
**不要用**：步骤超过6个时
**典型高度**：约3.5英寸

**字段**：

- `steps`: array · optional · — [{ label, desc? }]，3-6个步骤
- `title`: string · optional · — 可选标题
- `startY`: number · optional · — 起始Y坐标（英寸）
- `h`: number · optional · — 可选：指定总高度

**典型场景**：
- 3-5个阶梯式递进的阶段或层次 — `能力成熟度阶梯：初级→规范→优化→智能→领先`
- 从左下到右上的递进成长感 — `比processFlow更强调层层上升的视觉感`

---

### `stepList`

**说明**：3-5个有序步骤，每步含标题+详细描述
**何时用**：内容是有先后顺序的3-5个步骤，需要详细描述每步
**不要用**：内容是并列概念或案例；步骤超过5个
**典型高度**：2.0-3.0"

**字段**：

- `steps`: array · optional · 长度 2–5
  - `title`: string · optional · 长度 warn=15 / error=25
  - `desc`: string · **required** · 长度 warn=40 / error=60
- `summary`: string · optional · 长度 warn=50 / error=80
- `startY`: number · optional

**典型场景**：
- 3-5个步骤，每步需要详细说明 — `实施5步法，每步有标题和2-3行说明文字`
- 比processFlow需要更多文字时 — `processFlow适合短标题，stepList适合每步要详述`

---

### `timeline`

**说明**：时间轴布局，横向排列事件节点，带连接线、年份标签和描述
**何时用**：展示历史沿革、发展里程碑、时间顺序事件时
**不要用**：事件超过6个或需要详细内容时
**典型高度**：约 2.4 英寸

**字段**：

- `events`: array · **required** · — 事件数组，每项含 year、title、desc?
  - `title`: string · optional · 长度 warn=12 / error=20
  - `desc`: string · optional · 长度 warn=25 / error=40
- `startY`: number · optional

**典型场景**：
- 关键历史节点或里程碑时间线 — `公司发展史：2015创立→2018融资→2021上市→2024转型`
- 项目关键节点展示 — `不需要精确时间条的节点式时间轴，适合里程碑汇报`

---

### `waveProgression`

**说明**：波浪递进图，3-5个步骤从左下到右上波浪形排列
**何时用**：展示递进发展、阶段升级过程
**不要用**：步骤超过5个时
**典型高度**：约3.5英寸

**字段**：

- `waves`: array · optional · — [{ title, desc? }]，3-5个
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 3-5个阶段的递进成长过程 — `从初级→中级→高级→专家的能力成长路径，波浪形上升感`
- 比staircase更流畅柔和的递进 — `转型阶段的曲线发展，不是硬台阶式跳跃`

---

## 流程/序列型

### `timelineWithMetrics`

**说明**：时间线 + 指标卡：顶部 3-6 个时间阶段，底部 3-4 个量化指标卡，适合"X 周交付"类计划页
**何时用**："X 周/月内完成"类计划页：顶部分阶段进度 + 底部量化承诺指标
**不要用**：纯流程用 stepList；纯时间事件用 timeline
**典型高度**：4.0"

**字段**：

- `phases`: array · **required** · 长度 3–6
  - `period`: string · **required** · 长度 warn=10 / error=18
  - `title`: string · **required** · 长度 warn=15 / error=28
  - `titleCN`: string · optional
  - `notes`: string · optional · 长度 warn=35 / error=60
- `metrics`: array · optional
  - `value`: string · **required** · 长度 warn=8 / error=12
  - `label`: string · optional · 长度 warn=18 / error=30
  - `labelCN`: string · optional
- `startY`: number · optional

**典型场景**：
- 8 周交付计划 — `5 个 Wk 阶段 + 4 个指标卡（0 days / 100%）`

---

## 对比型

### `beforeAfter`

**说明**：变革前后对比：每列展示变革前（灰色）→ 变革后（彩色），支持汇总栏
**何时用**：变革前后对比、改革效果展示、转型前后状态说明
**不要用**：单一内容、流程图、数据图表
**典型高度**：3.0~4.0英寸

**字段**：

- `pairs`: array · **required** · — 对比项列表 [{before, after, afterDesc, color}]
  - `before`: string · optional · 长度 warn=10 / error=20
  - `after`: string · optional · 长度 warn=10 / error=20
  - `afterDesc`: string · optional · 长度 warn=25 / error=40
- `summary`: string · optional · 长度 warn=50 / error=80 · — 底部汇总文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 变革前后的对比，强调改变 — `零库存→分层安全库存、统一政策→差异化策略`
- 改进措施的效果展示 — `每对比项有旧方式和新方式，底部有总结条`

---

### `comparison`

**说明**：左右两栏对比，适合正反/优劣/两方对比
**何时用**：内容是两方面的对比，如优/劣、前/后、方案A/B
**不要用**：超过2个维度的比较；内容不是对立关系
**典型高度**：1.8-2.5"

**字段**：

- `left`: object
  - `title`: string · optional · 长度 warn=10 / error=20
  - `items`: array · optional
    - 元素: `string` (warn=30 / error=50)
- `right`: object
  - `title`: string · optional · 长度 warn=10 / error=20
  - `items`: array · optional
    - 元素: `string` (warn=30 / error=50)
- `showVS`: boolean · optional
- `bottomText`: string · optional · 长度 warn=50 / error=80
- `startY`: number · optional

**典型场景**：
- 左右两方的优缺点、差异对比 — `变革前 vs 变革后、问题清单 vs 解法清单`
- 两种方案/观点的全面对比 — `传统模式 vs 数字化模式：各列5-8个对比条目`
- 注意：items必须是string[]，不能是对象 — `正确：['条目文字', '条目文字']，错误：[{text:'...'}]`

---

### `hourglass`

**说明**：沙漏/蝴蝶结对比图，左右两侧列表通过中心漏斗形聚合
**何时用**：展示问题→解决方案、现状→目标的对比转化
**不要用**：每侧超过5个条目时
**典型高度**：约3.5英寸

**字段**：

- `left`: object · optional · — { label?, items: [{ title, desc? }] }，最多5项
- `right`: object · optional · — { label?, items: [{ title, desc? }] }，最多5项
- `centerLabel`: string · optional · — 中心标签文字
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 问题聚焦→解决方案发散的沙漏结构 — `左侧列出5个痛点，中间漏斗汇聚，右侧展开5个解法`
- 现状挑战 vs 目标状态的对比 — `左侧现状问题清单，右侧目标愿景清单，中间是变革`
- 比comparison更强调'收敛-发散'结构时 — `两侧条目通过中心视觉上有聚合感的对比`

---

### `lineupCompare`

**说明**：2 档产品横向对比：每侧 SKU 标题 + 4 个 GPU/配置选项 + 底部 3 个 利用率条，用于 SKU 深度对比
**何时用**：2 个 SKU/方案的深度对比，每个 SKU 有多个配置选项 + 利用率指标
**不要用**：3+ 档产品矩阵用 productMatrix；纯文字对比用 twoColumnCards
**典型高度**：4.0"

**字段**：

- `columns`: array · **required** · 长度 2–2
  - `sku`: string · **required** · 长度 warn=8 / error=15
  - `tagline`: string · optional · 长度 warn=18 / error=30
  - `tagCN`: string · optional
  - `options`: array · **required** · 长度 2–5
    - `spec`: string · **required** · 长度 warn=18 / error=30
    - `metric`: string · optional
    - `badge`: string · optional
  - `utilizations`: array · optional
    - `label`: string · optional
    - `value`: number · optional
    - `max`: number · optional
    - `unit`: string · optional
    - `note`: string · optional
- `startY`: number · optional

**典型场景**：
- 2 档算力箱对比 — `LE-88 vs LE-200，4 个 GPU 选项 + 利用率条`

---

### `productMatrix`

**说明**：产品矩阵：2-4 档产品横向并列展示，每档结构化字段（spec/价格/适用），用于硬件方案与 SKU 对比
**何时用**：2-4 档产品并列展示，每档有相同结构字段（规格 / 容量 / 价格 / 适用场景）
**不要用**：简单 2 列对比用 twoColumnCards；非产品矩阵用 cardGrid
**典型高度**：4.0"

**字段**：

- `products`: array · **required** · 长度 2–4
  - `sku`: string · **required** · 长度 warn=8 / error=15
  - `tagline`: string · optional · 长度 warn=15 / error=28
  - `tagCN`: string · optional
  - `badge`: string · optional
  - `fields`: array · **required**
    - `label`: string · optional · 长度 warn=10 / error=18
    - `value`: string · optional · 长度 warn=30 / error=45
    - `sublabel`: string · optional
  - `idealFor`: string · optional · 长度 warn=25 / error=40
  - `idealForCN`: string · optional
- `startY`: number · optional

**典型场景**：
- 硬件产品 3 档矩阵 — `LE-44 / LE-88 / LE-200 三档算力箱`
- SaaS 套餐对比 — `Starter / Pro / Enterprise 三档`

---

## 矩阵/框架型

### `analysisMatrix`

**说明**：分析矩阵表格，带行列标题的彩色格子矩阵，适合框架分析
**何时用**：展示SWOT、竞品对比、多维度分析框架
**不要用**：行超过8或列超过6时
**典型高度**：约3.5英寸

**字段**：

- `rowHeaders`: array · optional · — 行标题数组，最多8行
- `colHeaders`: array · optional · — 列标题数组，最多6列
- `cells`: array · optional · — 二维数组，cells[row][col] 可为字符串或字符串数组
- `title`: string · optional · — 可选矩阵标题
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 能力评估、维度打分、对标分析 — `竞争对手能力矩阵：5家公司×8个维度，彩色格子直观对比`
- 用户旅程地图、客户体验评估 — `5个旅程阶段×6个接触点，标注好/中/差体验`
- 比styledTable更强调视觉对比时 — `有明显高/中/低分层的数据，用颜色深浅区分`

---

### `bracketGroup`

**说明**：左侧多个并列项用大括号汇聚到右侧一个总结概念；展示"多个细项 → 一个总论"或反之的逻辑关系
**何时用**：多个并列因子归类为一个核心结论；或一个核心分解为多个子项
**不要用**：需要展示因果或时序时（用 causalChain / stepList）
**典型高度**：2.5~3.2 英寸

**字段**：

- `items`: array · **required** · — 左侧的并列项数组（3-6 项）：[string] 或 [{ title, desc? }]
- `summary`: string · **required** · — 右侧汇总词或结论（≤ 12 字）
- `summaryDesc`: string · optional · — 右侧汇总的二级说明（可选）
- `title`: string · optional · — 小标题
- `direction`: string · optional · 默认="rightSummary" · — rightSummary（默认，左项→右汇总）| leftSummary（右项→左汇总）
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 多个症状归一个根因 — `"客户流失 / 团队倦怠 / NPS 下降 / 增长停滞" → "缺乏战略聚焦"`
- 多个解决方案归一个战略 — `"流程重构 / 系统改造 / 团队培训 / 激励调整" → "数字化转型"`
- 一个核心拆分为多个支柱 — `"AI 落地" → 智能调研 / 知识引擎 / 可视化交付（leftSummary 方向）`

---

### `colorMatrix`

**说明**：彩色矩阵：2x2象限分析，支持轴标签、中心标签和脚注
**何时用**：波士顿矩阵、SWOT分析、优先级四象限、竞争力评估
**不要用**：流程说明、时间线、列表展示
**典型高度**：3.5~4.0英寸

**字段**：

- `quadrants`: array · **required** · — 象限列表（最多4项）[{title, content, color}]
  - `title`: string · optional · 长度 warn=10 / error=18
  - `content`: string · optional · 长度 warn=40 / error=60
- `axisLabels`: object · optional · — 轴标签 {left: "高/低", bottom: "弱/强"}（可选）
- `centerLabel`: string · optional · — 中心标签文本（可选）
- `footnote`: string · optional · — 脚注文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 彩色2×2象限，比swotGrid更强视觉 — `高优先级/低优先级 × 高影响/低影响，用色块区分`
- BCG矩阵、优先级矩阵等管理框架 — `明星/问题/现金牛/瘦狗四象限，颜色区分各类别`

---

### `constraintCheck`

**说明**：约束 × 产品的 cross-table 校核：每格"实际/预算 + 利用率"，用于工程约束验证类页面
**何时用**："多约束 × 多产品/方案"的可视化校核
**不要用**：简单 SWOT 用 twoColumnCards；产品参数对比用 productMatrix
**典型高度**：3.5"

**字段**：

- `constraints`: array · **required** · 长度 2–5
  - `label`: string · optional · 长度 warn=10 / error=18
  - `labelEn`: string · optional
  - `unit`: string · optional
  - `budget`: number · optional
- `products`: array · **required** · 长度 1–4
  - `sku`: string · **required** · 长度 warn=8 / error=-
- `cells`: array · **required**
  - `constraint`: string · **required**
  - `product`: string · **required**
  - `value`: number · **required**
  - `budget`: number · optional
  - `status`: string · optional
- `startY`: number · optional

**典型场景**：
- 工程约束校核 — `空间/电力/冷却 × 3 档算力箱`

---

### `cubeStack`

**说明**：3-5 层立体方块从下往上堆叠，每层一个概念；表达"层级架构"或"由下而上的演进"
**何时用**：技术栈/资产/数据架构等"层级堆叠"结构的可视化；强调"基础 → 应用"的支撑关系
**不要用**：层数 > 5 时（视觉拥挤，改用 layeredList）；非层级关系不要硬套（用 cardGrid）
**典型高度**：2.8~3.4 英寸

**字段**：

- `layers`: array · **required** · — 层级数组（3-5 项，由下到上）：{ title, desc? }
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- AI 平台技术栈 — `"基础设施 / 数据 / 模型 / 应用 / 用户"五层立方堆叠`
- 咨询服务体系层级 — `"研究方法 / 工具 / 项目实施 / 客户价值"四层架构`
- 数据资产分类 — `"原始数据 / 清洗数据 / 主数据 / 分析数据 / 数据产品"五层`

---

### `layeredList`

**说明**：分层列表：带标签的层级结构，含箭头连接和汇总栏
**何时用**：流程分层、战略层级、架构层次说明
**不要用**：数据对比、时间线、图片展示
**典型高度**：2.5~4.0英寸

**字段**：

- `banner`: object · optional · — 顶部横幅 {text, bgColor}（可选）
- `layers`: array · **required** · — 层级列表 [{tag, tagColor, title, desc}]
  - `title`: string · optional · 长度 warn=15 / error=22
  - `desc`: string · optional · 长度 warn=40 / error=60
- `summary`: string · optional · 长度 warn=50 / error=80 · — 底部汇总文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 分层级的列表，有主次关系 — `战略层→执行层→操作层，每层有标签和具体条目`
- 有分类汇总的结构化清单 — `三类风险：各类有标签，展开后有具体项目`

---

### `meceLayout`

**说明**：麦肯锡式 MECE 横版：左侧主标题 + 右侧 3-4 个互斥穷尽子项 + 每项带数据点
**何时用**：主结论 + MECE 拆解 3-6 个互斥维度，每个维度可量化
**不要用**：维度超过 6 个；或维度之间非互斥
**典型高度**：3.5"

**字段**：

- `mainTitle`: string · **required** · 长度 warn=15 / error=25
- `mainSubtitle`: string · optional · 长度 warn=40 / error=60
- `items`: array · **required** · 长度 3–6
  - `title`: string · **required** · 长度 warn=12 / error=20
  - `desc`: string · optional · 长度 warn=30 / error=50
  - `metric`: string · optional · 长度 warn=12 / error=20

---

### `orgChart`

**说明**：组织架构图，树形层级结构，最多3层
**何时用**：展示组织结构、汇报关系、层级体系
**不要用**：超过3层或节点过多时
**典型高度**：约3.5英寸

**字段**：

- `root`: object · optional · — { title, role?, children?: [{ title, role?, children?: [] }] }
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 展示组织架构、汇报关系 — `新供应链中心架构设计：COO→供应链VP→3个部门长`
- 变革后的新组织设计方案 — `改革前后组织架构对比，用两页orgChart说明变化`
- 利益相关方层级关系 — `项目治理结构：委员会→项目组→工作流`

---

### `pyramid`

**说明**：金字塔层级结构，从顶到底宽度递增，适合展示层次关系或优先级
**何时用**：展示层次结构、优先级金字塔、组织架构等有上下级关系的内容
**不要用**：层级超过6层或各层内容差异很大时
**典型高度**：约 3.6 英寸

**字段**：

- `levels`: array · **required** · — 层级数组，从顶到底，每项含 title、desc?
  - `title`: string · optional · 长度 warn=12 / error=20
  - `desc`: string · optional · 长度 warn=30 / error=50
- `startY`: number · optional

**典型场景**：
- 需求层次、价值层级、优先级金字塔 — `马斯洛需求层次、产品价值金字塔（基础→核心→差异化）`
- 重要性从底到顶递增的层级结构 — `战略执行金字塔：操作→流程→能力→战略`
- 比layeredList更强调层级视觉感时 — `底宽顶窄的层次关系，强调越往上越少越重要`

---

### `quadrantMatrix`

**说明**：四象限矩阵布局，支持轴标签，适合2x2战略分析框架
**何时用**：展示2x2分析框架，如波士顿矩阵、优先级象限、SWOT等
**不要用**：超过4个维度或需要详细文字时
**典型高度**：约 3.4~3.8 英寸（含轴标签）

**字段**：

- `quadrants`: array · **required** · — 4个象限对象，每项含 title、content、color?
  - `title`: string · optional · 长度 warn=10 / error=18
  - `content`: string · optional · 长度 warn=40 / error=60
- `axisLabels`: object · optional · — 轴标签 {top?, bottom?, left?, right?}
- `startY`: number · optional

**典型场景**：
- 2×2矩阵，有X轴Y轴说明 — `利益相关方分析：影响力×支持度四象限`
- 比colorMatrix更需要轴标签时 — `需要标注X/Y轴含义（如影响力、支持度）来帮助读者理解坐标意义`

---

### `radialNav`

**说明**：左侧半环形 4-5 段 + 中央圆形概念 + 右侧编号列表；展示"核心概念 + 多支柱"的咨询框架
**何时用**：展示"一个核心 + 4-5 个支柱"的咨询框架；价值主张拆解、能力图谱、战略支柱
**不要用**：支柱 < 3 或 > 6（用 cardGrid）；纯流程顺序（用 stepList）
**典型高度**：3.0~3.5 英寸

**字段**：

- `core`: string · **required** · — 中央圆形的核心概念（中文，建议 ≤ 6 字）
- `coreEn`: string · optional · — 核心概念英文（如 "BRAND DECISION"）
- `items`: array · **required** · — 支柱数组（4-5 项），每项 { title, desc? }
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 战略 4 大支柱 — `"客户成功"为核心，4 个支柱（产品/服务/品牌/生态）`
- 咨询能力图谱 — `"AI 落地"为核心，5 个能力支柱`
- 价值主张拆解 — `"为什么选我们"为核心，4 个差异化能力`

---

### `serviceBlueprint`

**说明**：服务蓝图：横向阶段 × 纵向 3 层（前台 / 后台 / 支撑系统）触点矩阵
**何时用**：服务设计 / 业务流程梳理需要分层（用户可见 / 内部 / 系统）
**不要用**：单纯流程用 stepList；用户视角用 journeyMap
**典型高度**：3.8"

**字段**：

- `stages`: array · **required** · 长度 3–6
  - `name`: string · **required** · 长度 warn=10 / error=18
  - `frontstage`: string · optional · 长度 warn=25 / error=40
  - `backstage`: string · optional · 长度 warn=25 / error=40
  - `system`: string · optional · 长度 warn=25 / error=40

---

### `styledTable`

**说明**：带样式的数据表格，支持斑马纹、高亮单元格、行颜色标记和底部总结
**何时用**：需要对比展示多行多列数据、特性对比、评估矩阵时
**不要用**：数据量很少（2行以内）时，用其他布局更清晰
**典型高度**：约 1.5~3.5 英寸，取决于行数

**字段**：

- `headers`: array · **required** · — 表头数组
- `rows`: array · **required** · — 数据行二维数组，支持字符串或 {text, highlight?, color?}
- `summary`: string|object · optional · — 底部总结文字或 {text, bgColor}
- `rowAccentColors`: array · optional · — 每行的左侧强调色数组
- `startX`: number · optional · — 左起点，默认 0.75
- `startY`: number · optional
- `w`: number · optional · — 表格宽度，默认 8.5
- `colWidths`: array · optional · — v4.0.2: 每列宽度数组（数字代表英寸），总和须等于 w；不传则按列数均分

**典型场景**：
- 多行多列的对比数据，需要表格呈现 — `ISC成熟度对标：5维度×3阶段，蓝色表头，底部有结论条`
- 评估矩阵、现状vs目标对比 — `当前状态/行业标杆/差距程度三列，清晰展示现状`
- 比analysisMatrix数据更文字化时 — `内容以文字描述为主，而非评分/颜色，用styledTable`

---

### `swotGrid`

**说明**：SWOT/四象限分析矩阵，2x2格局
**何时用**：SWOT分析、四象限优先级矩阵、2x2框架分析
**不要用**：超过4个象限，或需要3列以上的矩阵
**典型高度**：3.5英寸

**字段**：

- `quadrants`: array · optional · — 四个象限（恰好4个）
  - `label`: string · optional
  - `title`: string · **required**
  - `items`: array · **required**
    - 元素: `string`
  - `color`: string · optional
- `summary`: string · optional · 默认="" · — 底部摘要栏（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- SWOT分析：优势/劣势/机会/威胁 — `企业战略SWOT，四象限各列3-5个要点`
- 2×2战略分析框架 — `不只是SWOT，任何2×2框架都可以用（如机会×可行性矩阵）`

---

### `vennDiagram`

**说明**：韦恩图，2或3个交叉圆，展示共同与差异部分
**何时用**：展示2-3个集合的共同点与差异，如产品对比、受众重叠
**不要用**：超过3个集合，或需要精确数量关系
**典型高度**：3.5英寸

**字段**：

- `circles`: array · optional · — 圆圈列表（2或3个）
  - `title`: string · **required**
  - `items`: array · optional
    - 元素: `string`
  - `color`: string · optional
- `intersection`: string · optional · 默认="" · — 交叉区域标签
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 两个概念的共同点与差异 — `效率 vs 效果的维恩图，中间是两者都关注的部分`
- 产品差异化定位，找独特交叉点 — `客户需求 ∩ 技术能力 ∩ 竞争空白 = 差异化机会`
- 受众重叠分析、用户画像交叉 — `两个用户群体的特征重叠，指导产品/营销设计`

---

## 分析/诊断型

### `chartBubble`

**说明**：气泡图，在散点基础上增加"大小"维度，可同时呈现三个数值
**何时用**：三维数据可视化：两个连续变量 + 一个表示量级/重要性的"大小"维度
**不要用**：维度数 = 2 用 chartScatter；维度数 ≥ 4 改用 analysisMatrix 或拆图
**典型高度**：3.4~3.8 英寸

**字段**：

- `data`: array · **required** · — 气泡数据：第 1 项 { name: "X-Axis", values: [..] }；后续每个系列 { name: "<系列名>", values: [Y 值...], sizes: [气泡大小...] }；sizes 与 values 长度一致
- `title`: string · optional · — 图表标题
- `xAxisTitle`: string · optional · — X 轴标题
- `yAxisTitle`: string · optional · — Y 轴标题
- `startY`: number · optional · — 起始 Y 坐标
- `chartH`: number · optional · 默认=3.4 · — 图表高度

**典型场景**：
- 战略选择评估：价值 × 难度 × 投资额 — `10 个 AI 项目按价值-难度散点，气泡大小代表投资金额`
- 市场分析：增长率 × 利润率 × 营收规模 — `若干业务线在两维度散点，气泡大小代表营收量`
- 客户分级：购买力 × 活跃度 × 累计 GMV — `VIP 识别中加入累计金额作为气泡大小`

---

### `chartRadar`

**说明**：雷达图，展示同一对象的多维度评分或多对象的同维度对比
**何时用**：多维度能力评估、品牌打分、SWOT 量化、产品功能对比
**不要用**：维度数 <3（无法形成雷达形状）；维度数 >8（图形过密看不清）
**典型高度**：3.4~3.8 英寸

**字段**：

- `data`: array · **required** · — [{ name, labels: [维度1, 维度2, ...], values: [...] }]；多系列时 labels 必须一致
- `title`: string · optional · — 图表标题
- `radarStyle`: string · optional · 默认="standard" · — standard | filled | marker；filled = 填充式（推荐做"能力轮廓"）
- `startY`: number · optional · — 起始 Y 坐标
- `chartH`: number · optional · 默认=3.4 · — 图表高度（雷达图建议 ≥ 3.2"）

**典型场景**：
- 咨询能力评估 / 品牌打分 — `从战略、运营、品牌、技术、组织、人才 6 维度评估客户能力`
- 产品对标 — `我司 vs 竞品 A vs 竞品 B 在 5 维度的对比`
- 员工能力盘点 — `高潜人才在领导力/专业度/创新/沟通/执行 5 维度评分`

---

### `chartScatter`

**说明**：散点图，展示两个连续变量的相关性或对象在二维空间中的精确位置
**何时用**：需要精确反映对象在二维空间中位置，如价值-可行性矩阵、客户细分、相关性分析
**不要用**：只需"四象限粗分类"用 quadrantMatrix；数据是分类型的用 chartBar
**典型高度**：3.4~3.8 英寸

**字段**：

- `data`: array · **required** · — 散点数据：第 1 项必须是 X 轴值列表 { name: "X", values: [..] }，后续每项是一个系列 { name, values: [..] }（与 X 长度一致，按位置配对）
- `title`: string · optional · — 图表标题
- `xAxisTitle`: string · optional · — X 轴标题（如"可行性"）
- `yAxisTitle`: string · optional · — Y 轴标题（如"价值"）
- `startY`: number · optional · — 起始 Y 坐标
- `chartH`: number · optional · 默认=3.4 · — 图表高度

**典型场景**：
- 战略举措的价值-可行性矩阵（精确位置） — `10 个 AI 落地项目按"价值"和"可行性"散点分布`
- 客户细分（购买力 vs 活跃度） — `将 200 个客户按两维度散点定位，识别 VIP/休眠/潜力客户`
- 与 quadrantMatrix 的区别：散点更精确、可承载更多点 — `> 6 个点用散点；4 个固定象限用 quadrantMatrix`

---

### `fishbone`

**说明**：鱼骨图/因果分析图，展示问题根因
**何时用**：根因分析、问题诊断，找出导致问题的多维度原因
**不要用**：原因少于3个或需要量化展示时
**典型高度**：3.0~4.0英寸

**字段**：

- `problem`: string · optional · — 核心问题
- `causes`: array · optional · — 原因分类 [{ category, items: string[] }]，3-6个分类
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 5M1E根因分析（人机料法环管） — `为什么交货延误？鱼骨图展示6个维度的根因`
- 质量问题、故障原因分析 — `产品不良率高的原因：设备/原料/工艺/人员多角度分析`
- 比causalChain更需要多维度发散时 — `causalChain是纵向因果链，fishbone是多维度放射状分析`

---

### `funnel`

**说明**：漏斗图，展示各阶段转化流程
**何时用**：展示销售漏斗、用户转化率等逐层递减的流程
**不要用**：阶段数超过5个或不存在递减关系时
**典型高度**：3.0~3.5英寸

**字段**：

- `stages`: array · optional · — 阶段列表 [{ label, value?, desc? }]，3-5个阶段
- `title`: string · optional · — 标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 销售漏斗、转化率分析 — `线索1000→意向300→商机100→成交30，展示各阶段转化`
- 用户行为路径的层层筛选 — `注册→激活→留存→付费→推荐——用户成长漏斗`
- 流程中的层层审批、过滤 — `500份简历→100面试→30录用→10入职——招聘漏斗`

---

### `maturityModel`

**说明**：5-8 个能力维度 × 3 档成熟度（当前 / 行业 / 目标）水平条形对比
**何时用**：尽职调查能力评估 / 数字化成熟度诊断
**不要用**：单一评分用 chartRadar；非分档对比
**典型高度**：3.5"

**字段**：

- `dimensions`: array · **required** · 长度 3–8
  - `name`: string · **required** · 长度 warn=12 / error=20
  - `current`: number · optional · — 当前评分 1-5
  - `industry`: number · optional · — 行业先进 1-5
  - `target`: number · optional · — 目标 1-5

---

### `problemSolution`

**说明**：问题-解决方案左右分栏对比
**何时用**：展示问题与对应解决方案，突出改进前后对比
**不要用**：问题与方案没有对应关系或只需单列展示时
**典型高度**：2.5~3.5英寸

**字段**：

- `problems`: array · optional · — 问题列表 string[]
- `solutions`: array · optional · — 解决方案列表 string[]
- `leftTitle`: string · optional · — 左侧标题（默认"问题"）
- `rightTitle`: string · optional · — 右侧标题（默认"解决方案"）
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 问题-解决方案的左右并列 — `左侧列出3个核心问题，右侧对应3个解决方案`
- 比comparison更聚焦在问题→方案关系时 — `有明确对应关系的问题和解法，不只是两方对比`

---

### `sankeyDiagram`

**说明**：简化桑基：左侧 2-4 个源节点 + 右侧 2-4 个汇节点，中间宽度按流量
**何时用**：资金流 / 用户流向 / 多源多汇转化
**不要用**：单线流程用 funnel；分类用 chartPie
**典型高度**：3.5"

**字段**：

- `sources`: array · **required** · 长度 2–4
  - `name`: string · **required** · 长度 warn=12 / error=20
  - `value`: number · **required**
- `targets`: array · **required** · 长度 2–4
  - `name`: string · **required** · 长度 warn=12 / error=20
  - `value`: number · **required**
- `flows`: array · optional · — 可选：明确指定 source → target 流量
  - `from`: string · **required**
  - `to`: string · **required**
  - `value`: number · **required**

---

### `tornadoChart`

**说明**：敏感性分析：各因素对基线的正负偏离，按绝对值降序排列形成"龙卷风"形
**何时用**：财务建模 / 估值 / 投资决策的敏感性
**不要用**：非连续变量；分类对比用 chartBar
**典型高度**：3.5"

**字段**：

- `baseline`: number · **required** · — 基线值
- `factors`: array · **required** · 长度 3–8
  - `name`: string · **required** · 长度 warn=12 / error=20
  - `low`: number · **required**
  - `high`: number · **required**

---

## 咨询框架

### `ansoffMatrix`

**说明**：Ansoff 增长矩阵（产品 × 市场 4 象限）：增长战略的经典框架
**何时用**：增长战略制定：判断走哪条增长路径；评估每条路径的具体举措
**不要用**：业务组合分析（用 bcgMatrix）；竞争策略（用 porterFiveForces）
**典型高度**：3.8~4.2 英寸

**字段**：

- `initiatives`: object · optional · — 4 象限的增长举措对象 { penetration: [..], productDev: [..], marketDev: [..], diversify: [..] }
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 增长战略 4 选项对比 — `判断公司主推哪种增长路径`
- 产品-市场扩张计划 — `为 4 象限分别列出具体举措`
- 新业务进入路径决策 — `评估"市场渗透 vs 多元化"的风险收益`

---

### `customerSegmentation`

**说明**：客户/产品分层：高价值 / 高增长 / 低粘性 / 待开发 四类分群可视化
**何时用**：客户/产品/市场分层 4 群分类策略
**不要用**：维度数不是 4；连续分布用 chartScatter
**典型高度**：3.8"

**字段**：

- `segments`: array · **required** · 长度 4–4
  - `name`: string · **required** · 长度 warn=10 / error=18
  - `size`: string · optional · 长度 warn=12 / error=18 · — 占比/规模
  - `value`: string · optional · 长度 warn=12 / error=18 · — 价值贡献
  - `strategy`: string · optional · 长度 warn=30 / error=50
- `xAxis`: string · optional · — X 轴标签
- `yAxis`: string · optional · — Y 轴标签

---

### `decisionTree`

**说明**：决策树：起始问题 → 分支条件 → 终点结论；适合"如果-则"型战略选择展示
**何时用**：战略选择、路径决策、风险分支评估；表达"如果 X 则 Y"的判断逻辑
**不要用**：纯并列问题分解（用 issueTree）；流程步骤（用 stepList）
**典型高度**：3.5~4.0 英寸

**字段**：

- `root`: string · **required** · — 起始决策点文字（如"是否进入海外市场？"），≤ 20 字
- `branches`: array · **required** · — 一级分支 2-3 个 [{ condition, outcome, sub: [{condition, outcome}] }]；condition 是判断条件（≤ 12 字），outcome 是结论（≤ 20 字），sub 可选
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 战略选择决策 — `"是否进入海外市场" → "市场规模 ≥ X" → "本地化能力够" → "进入"`
- 产品路径决策 — `"主推 SaaS 还是定制" 的 if-then 选择`
- 投资判断逻辑 — `"基于 3 个条件判断是否值得投资"`

---

### `issueTree`

**说明**：Issue Tree / MECE 问题树：左侧根问题 → 中间 2-3 个子问题 → 右侧细分问题，层层 MECE 分解
**何时用**：将复杂问题逐层 MECE 分解；战略诊断、根因分析、方案设计中证明"穷尽且不重叠"
**不要用**：简单线性流程（用 stepList）；纯并列要素（用 cardGrid）
**典型高度**：3.5~4.0 英寸

**字段**：

- `root`: string · **required** · — 根问题（中央 / 主标题，建议 ≤ 20 字）
- `branches`: array · **required** · — 一级分支 2-3 个 [{ title, items: [二级要点] }]；二级最多 4 项
- `title`: string · optional · — 小标题
- `rootEn`: string · optional · — 根问题英文（可选）
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- "如何提升业绩"的 MECE 拆解 — `根=业绩提升 → 收入侧/成本侧 → 客单价/客户数/留存率`
- "客户流失"根因分析 — `根=流失 → 产品/服务/价格 → 各 2-3 个具体原因`
- 战略方案的 MECE 论证 — `根=战略 → 业务/组织/数字化 → 各 2-3 项具体动作`

---

### `riskMatrix`

**说明**：风险矩阵（5×5 概率 × 影响）：将风险按发生概率与影响程度分类，标识优先级
**何时用**：项目风险评估、变革管理、新业务进入风险扫描；视觉化优先级排序
**不要用**：机会评估（用 ansoffMatrix 或 bcgMatrix）；定性宏观分析（用 pestel）
**典型高度**：3.8~4.2 英寸

**字段**：

- `risks`: array · optional · — 风险数组 [{ name, probability: 1-5, impact: 1-5, category? }]；按 probability/impact 坐标定位到矩阵格
- `title`: string · optional · — 小标题
- `size`: string · optional · — "3x3"（粗分类） / "5x5"（默认精细）
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 咨询项目风险登记册 — `识别 10-15 个项目风险，按概率×影响定位`
- 新业务进入风险扫描 — `"市场风险 / 运营风险 / 合规风险"分类`
- 战略实施风险评估 — `识别可能影响战略落地的关键风险点`

---

### `scqaNarrative`

**说明**：SCQA 开场叙事框架（情境-冲突-疑问-回答）：金字塔原理的标准开篇结构
**何时用**：咨询提案/报告的开场页；将复杂背景浓缩为"读者-为什么应该听-我们说什么"四步引入
**不要用**：内容已展开后的中段（用 stepList / iconList）；纯数据展示（用 dataHighlight）
**典型高度**：4.0~4.5 英寸

**字段**：

- `situation`: string · **required** · — 情境（读者熟悉的背景，建议 30-80 字）
- `complication`: string · **required** · — 冲突（打破现状的变化或挑战，30-80 字）
- `question`: string · **required** · — 疑问（核心问题，20-50 字）
- `answer`: string · **required** · — 回答（核心论点，30-80 字）
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 战略提案开篇引入 — `S：行业进入存量市场 → C：传统增长失效 → Q：新增长来自哪里 → A：AI 工作流再造交付能力`
- 咨询报告执行摘要 — `S：业务规模 / C：风险 / Q：核心问题 / A：3 步走方案`
- 内部汇报背景说明 — `S：季度目标 / C：偏离度 / Q：根本原因 / A：纠偏措施`

---

### `stakeholderMap`

**说明**：利益相关方地图（Power × Interest 2×2 矩阵）：项目/变革管理的标准工具
**何时用**：项目启动 / 变革管理时识别关键利益方；判断应该跟谁沟通到什么深度
**不要用**：内部组织诊断（用 mckinsey7S）；定量评估（用 chartScatter）
**典型高度**：3.8~4.2 英寸

**字段**：

- `stakeholders`: object · optional · — 4 象限的利益相关方对象：{ manage: [姓名/角色...], satisfy: [], inform: [], monitor: [] }
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 咨询项目启动会 — `识别"应该深度访谈谁，定期汇报谁"`
- 组织变革管理 — `"谁是改革推动者，谁是抵制者"`
- 客户提案前的关系梳理 — `"客户内部哪些角色需要单独沟通"`

---

### `threeHorizons`

**说明**：三视野：H1 现在守业 / H2 中期增长 / H3 长期创新，曲线递进
**何时用**：战略规划 / 公司转型，分三档时间视野
**不要用**：时间不是关键维度；多于 3 个阶段用 timeline
**典型高度**：3.0"

**字段**：

- `horizons`: array · **required** · 长度 3–3
  - `name`: string · **required** · 长度 warn=12 / error=20
  - `timeframe`: string · optional · 长度 warn=12 / error=20
  - `focus`: string · optional · 长度 warn=30 / error=50

---

### `valueDriverTree`

**说明**：左侧顶层指标，右侧逐层分解到 2-3 层驱动因素，每节点含数值与算子
**何时用**：财务指标拆解到驱动因素：营收 = 客户数 × 客单价 = ...
**不要用**：非可拆解指标；纯并列概念用 threeColumn
**典型高度**：3.5"

**字段**：

- `root`: object
  - `label`: string · **required**
  - `value`: string · **required**
  - `unit`: string · optional
- `drivers`: array · **required** · 长度 2–4
  - `label`: string · **required** · 长度 warn=12 / error=20
  - `value`: string · optional · 长度 warn=10 / error=15
  - `op`: string · optional · — "+","-","×","÷"
  - `children`: array · optional

---

## 项目管理型

### `checklist`

**说明**：任务清单，支持1-2列布局，每项含完成状态、标题和描述
**何时用**：展示任务进度、待办清单、检查项
**不要用**：需要复杂甘特图时
**典型高度**：约3.5英寸

**字段**：

- `items`: array · optional · — [{ title, desc?, done? }]，最多16个
- `columns`: number · optional · — 列数：1或2，默认1
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 任务清单、核查项、行动清单 — `变革进度追踪：8个检查点，标注完成/未完成状态`
- 行动建议列表，需要勾选感 — `本周必做清单，强调可执行性和可追踪性`

---

### `ganttChart`

**说明**：甘特图/项目计划，展示任务时间线和进度
**何时用**：项目进度展示，多任务并行时间规划
**不要用**：任务超过8个或时间粒度需要精确到天时
**典型高度**：3.0~4.0英寸

**字段**：

- `tasks`: array · optional · — 任务列表 [{ name, start, duration, color?, milestone?, progress? }]，start/duration单位为月
- `startMonth`: number · optional · — 起始月份编号
- `months`: number · optional · 默认=6 · — 显示月数
- `title`: string · optional · — 图表标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 项目实施计划，有明确时间和责任人 — `6个工作包×12个月，标注开始/结束时间和负责团队`
- 比phaseDiagram更需要精确时间节点时 — `任务有具体周数/月份，需要看并行情况和关键路径`
- 实施路线图汇报 — `向客户展示完整项目时间表，显示咨询团队的专业规划能力`

---

### `multiProjectCards`

**说明**：多项目状态卡片，3-5个项目并排展示，含进度条
**何时用**：展示多个并行项目的状态和进度
**不要用**：项目超过5个时
**典型高度**：约3.8英寸

**字段**：

- `projects`: array · optional · — [{ name, status?, items?: [], progress?: number }]，3-5个
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 3-5个并行项目的状态总览 — `Q2在跑的5个项目：各自进度条+状态标签+负责人`
- 项目集管理、Portfolio汇报 — `给PMO或高管看的项目群全景图，一页看清所有在途项目`

---

### `phasedGantt`

**说明**：双层项目计划：上层箭头链概括阶段顺序，下层甘特表给精确时间窗口
**何时用**：项目计划 + 阶段路径双重表达；既要"阶段顺序"又要"精确时间"时
**不要用**：只有阶段无精确时间（用 arrowChain）；只有时间无阶段（用 ganttChart）
**典型高度**：3.2~3.8 英寸

**字段**：

- `phases`: array · **required** · — 阶段数组（3-6 项），每项 { name, startMonth?, endMonth? }；其中 month 是 1-based 索引（对齐到下方甘特表的列）
- `months`: array · **required** · — 月份标签数组（如 ["Apr","May","Jun","Jul","Aug","Sep","Oct"]）
- `tasks`: array · optional · — 甘特任务（可选；不提供则只画顶部箭头链），每项 { name, startCol, span, color? }
- `title`: string · optional · — 小标题
- `subtitle`: string · optional · — 底部一句话总结
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 项目计划顶部 + 月份甘特 — `5 阶段项目 × 6 个月时间窗`
- 咨询服务路径 + 时间承诺 — `"诊断 1 月 / 设计 2 月 / 试点 2 月 / 推广 3 月 / 优化持续"`

---

### `progressList`

**说明**：进度条列表，展示多项任务完成百分比
**何时用**：展示多个任务/指标的完成进度
**不要用**：任务超过8个或需要展示绝对数值时
**典型高度**：2.5~3.5英寸

**字段**：

- `items`: array · optional · — 进度项列表 [{ name, percent, desc? }]，最多8项
- `title`: string · optional · — 标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- 多个任务/目标的完成进度 — `6个战略目标的完成率：进度条显示50%/80%/100%等`
- 比checklist更需要展示百分比时 — `不只是完成/未完成，而是0-100%的连续进度`

---

### `quarterlyPlan`

**说明**：季度计划，4列卡片展示Q1-Q4目标和任务
**何时用**：年度/季度计划展示，按Q1-Q4划分目标和行动项
**不要用**：非季度周期或任务数量极少时
**典型高度**：3.0~3.5英寸

**字段**：

- `quarters`: array · optional · — 季度计划 [{ label, focus, items: string[] }]，共4项
- `title`: string · optional · — 标题
- `startY`: number · optional · — 起始Y坐标

**典型场景**：
- Q1-Q4季度目标和任务分配 — `年度计划分解：4列卡片分别展示每季度的核心目标和关键任务`
- 年度规划汇报 — `战略落地四季度节奏：Q1夯实基础、Q2快赢、Q3规模化、Q4固化`

---

## 叙事/引用型

### `actionTitleSlide`

**说明**：顶咨标准结论标题页：35-40pt 加粗结论 + 副结论 + 3 个紧凑论据
**何时用**：需要让标题本身就传达完整结论（金字塔原理），客户翻一页就知道核心观点
**不要用**：内容偏过程描述不是结论；KPI 多需要图表
**典型高度**：full-page

**字段**：

- `actionTitle`: string · **required** · 长度 warn=50 / error=80 · — 主结论句（30-60 字）
- `subConclusion`: string · optional · 长度 warn=30 / error=50 · — 副结论（15-30 字）
- `supports`: array · optional · 长度 2–4
  - `title`: string · **required** · 长度 warn=15 / error=25
  - `desc`: string · optional · 长度 warn=30 / error=50
- `sourceRef`: string · optional · — 底部来源说明

**典型场景**：
- Executive summary 单页 — `"建议聚焦头部 3 区域 18 月 EBITDA 提升 4.2pp"`
- 每个章节首页结论页 — `"DFX 校验前置使返工率从 30% 降到 8%"`

---

### `caseBox`

**说明**：案例框，左侧强调色竖条，含标题和内容，适合展示案例或补充说明
**何时用**：需要展示典型案例、补充说明或注意事项时
**不要用**：作为主要内容区域使用时，适合作为辅助说明框
**典型高度**：约 1.2~2.0 英寸

**字段**：

- `title`: string · **required** · 长度 warn=15 / error=25 · — 案例标题
- `content`: string · **required** · 长度 warn=100 / error=150 · — 案例内容
- `startX`: number · optional · — 左起点，默认 0.75
- `startY`: number · optional
- `w`: number · optional · — 宽度，默认 8.5
- `h`: number · optional · — 高度，默认 1.2

**典型场景**：
- 侧边强调框，案例补充说明 — `正文右侧或下方的辅助案例框，左边有强调竖条`
- 注意：不适合作为全页主内容 — `caseBox高度默认1.2英寸，全页用会大量留白，改用iconList`

---

### `cloudConcept`

**说明**：3-5 个云朵形状，每朵承载一个开放性概念或趋势词；适合战略愿景、未来畅想、灵感发散页
**何时用**：战略愿景、未来畅想、概念发散；"想象一下"的场景
**不要用**：需要精确数据或结构化对比时（用 dataHighlight / comparison）
**典型高度**：2.8~3.4 英寸

**字段**：

- `clouds`: array · **required** · — 云朵数组（3-5 项）：{ keyword, desc? }
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标

**典型场景**：
- 战略畅想：未来 3 年的可能方向 — `"AI 原生 / 数据驱动 / 全场景 / 生态化" 四朵云排开`
- 行业关键词云图 — `梳理"行业趋势"的 4-5 个关键词，云形承载`
- 价值主张的几个支柱 — `"创新 / 协同 / 可信 / 可持续" 作为公司核心理念展示`

---

### `executiveSummary`

**说明**：一页纸高密度摘要：核心结论 + 3-5 findings + KPI 仪表 + 下一步
**何时用**：客户高管第一眼翻的页；项目阶段结论 / 提案首页
**不要用**：深度分析需要专门版式；纯数据展示用 kpiDashboard
**典型高度**：full-page

**字段**：

- `headline`: string · **required** · 长度 warn=50 / error=80 · — 一句话总结
- `findings`: array · optional · 长度 2–5
  - `title`: string · **required** · 长度 warn=15 / error=25
  - `desc`: string · optional · 长度 warn=30 / error=60
  - `priority`: string · optional · — high/medium/low
- `kpis`: array · optional · 长度 0–4
  - `label`: string · optional · 长度 warn=12 / error=20
  - `value`: string · optional · 长度 warn=10 / error=15
- `nextSteps`: array · optional · 长度 0–4
  - 元素: `string` (warn=25 / error=40)

---

### `heroClosing`

**说明**：戏剧化结尾页：上下两层呼吁——核心结论横幅 + 下一步行动 + 联系方式
**何时用**：提案最后一页 / 关键章节结尾，需要客户做明确行动决策
**不要用**：常规收尾用 closingQuote
**典型高度**：full-page

**字段**：

- `headline`: string · **required** · 长度 warn=30 / error=60
- `subline`: string · optional · 长度 warn=50 / error=100
- `cta`: array · optional · 长度 0–3
  - 元素: `string` (warn=25 / error=40)
- `contact`: string · optional · 长度 warn=30 / error=50

**典型场景**：
- 客户提案要明确下一步 — `"立即启动 P1 试点：本周内确认 3 家试点门店"`

---

### `heroQuote`

**说明**：杂志式 hero 引言：满版深色背景 + 大字金句 + 巨型引号装饰 + 署名
**何时用**：提案章节首页或转折点的金句页，需要给客户「停下来思考」的节奏
**不要用**：常规引言用 quoteEmphasis / quoteBanner；封底前用 closingQuote
**典型高度**：full-page

**字段**：

- `quote`: string · **required** · 长度 warn=60 / error=120
- `author`: string · optional · 长度 warn=20 / error=35
- `source`: string · optional

**典型场景**：
- 章节转折金句 — `"我们不是在解决问题，我们在重塑可能"`

---

### `impactQuestion`

**说明**：冲击提问：大字问题 + 答案框，支持高亮答案
**何时用**：引发思考、问题导入、关键洞察揭示
**不要用**：数据展示、流程说明、多项并列内容
**典型高度**：2.5~3.0英寸

**字段**：

- `question`: string · **required** · 长度 warn=30 / error=50 · — 问题文本
- `answer`: string · **required** · 长度 warn=60 / error=100 · — 回答文本
- `answerHighlight`: string · optional · — 高亮补充答案（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 用反问句引发思考、开启讨论 — `'如果供应链明天断了，你还有几天的库存？'——先问题后答案`
- 演讲者想停顿让观众思考时 — `大字问题配小字答案，节奏感强，适合现场演讲`
- 比engagementQuestion更需要整页强调时 — `独立一页强调一个颠覆性问题，不是放在内容页底部`

---

### `insightBanner`

**说明**：全宽底部核心洞察条：深蓝背景+白字，左侧橙色竖线，用于每页底部的核心结论/诊断要点强调
**何时用**：需要在页面底部强调核心结论、诊断要点、关键洞察时；咨询汇报类PPT每页底部使用
**不要用**：已有 engagementQuestion 时（二者位置相同）；封面/章节页
**典型高度**：约0.52英寸

**字段**：

- `insight`: string · **required** · — 核心洞察/结论文字（建议20-60字）
- `label`: string · optional · — 左侧小标签（如"核心洞察""诊断结论"）
- `style`: string · optional · — "blue"（默认）| "orange" | "dark" | "gold" | "brick" | "minimal"（v4.0.5）
- `accent`: string · optional · — v4.0.5: "gold" | "brick" — minimal 样式下的左侧竖线颜色
- `startY`: number · optional · — 起始Y坐标（英寸），默认贴内容底部

**典型场景**：
- 需要在页面底部加核心结论 — `任何内容页底部加一条'深蓝背景白字'的核心洞察强调`
- 比engagementQuestion更正式的总结条 — `咨询汇报风格，每页底部固定有结论条，不是互动问题`

---

### `keywordHighlight`

**说明**：段落文字，对关键词应用底色高亮和/或描边，强调重要术语、警示或核心观点
**何时用**：需要强调段落中的关键词、术语或警示语；让读者一眼看到重点
**不要用**：通篇都需要"重点"——会失去强调效果；超过 30% 文字带高亮时
**典型高度**：2.0~2.8 英寸

**字段**：

- `text`: array · **required** · — 文本片段数组：每项 { content: string, highlight?: hex, outline?: { color, size }, bold?: bool, color?: hex }；普通片段只填 content
- `title`: string · optional · — 小标题
- `startY`: number · optional · — 起始 Y 坐标
- `fontSize`: number · optional · 默认=18 · — 正文字号
- `align`: string · optional · 默认="left" · — left | center | right
- `paragraphHeight`: number · optional · 默认=2 · — 段落区域高度

**典型场景**：
- 核心结论段落，强调 2-3 个关键词 — `"在 6 个月内将 AI 落地率从 12% 提升到 65%——这背后的关键是 流程重构 + 知识沉淀。"（"流程重构"+"知识沉淀"高亮）`
- 术语解释段落，加粗 + 高亮专有名词 — `介绍新概念时，专有名词背景高亮 黄色 / 描边强调`
- 风险警示段落，关键词红色描边 — `"以下三点 严禁 触碰：..."（"严禁"加红色描边）`

---

### `quoteBanner`

**说明**：引用横幅，圆角矩形背景，支持引用文字和署名
**何时用**：需要突出展示一段重要引用、核心观点或名言时
**不要用**：内容是列表或数据时
**典型高度**：约 0.8~1.4 英寸

**字段**：

- `quote`: string · **required** · 长度 warn=50 / error=80 · — 引用文字
- `author`: string · optional · — 作者/署名
- `startY`: number · optional
- `h`: number · optional · — 横幅高度，默认根据是否有作者自动计算
- `bgColor`: string · optional · — 背景色，默认 C.SECONDARY

**典型场景**：
- 一句话引用，配作者/来源 — `'没有感知的管理是伪管理' — Peter Drucker`
- 页面中间插入金句，节奏停顿 — `正文讲完后插入一条相关名言，增加说服力`

---

### `quoteEmphasis`

**说明**：引言强调：大引用块 + 强调要点框，支持作者署名和汇总
**何时用**：名人名言引用、重要结论强调、政策宣言类内容
**不要用**：数据展示、流程说明、对比分析
**典型高度**：2.5~3.5英寸

**字段**：

- `quote`: string · **required** · 长度 warn=50 / error=80 · — 引用文本
- `author`: string · optional · — 作者/来源（可选）
- `emphasis`: string · **required** · 长度 warn=40 / error=65 · — 强调内容
- `emphasisSub`: string · optional · 长度 warn=50 / error=80 · — 强调补充内容（可选）
- `summary`: string · optional · — 底部汇总文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 重要观点引用+补充解释 — `大块引用框+下方强调要点，适合学术/研究型报告`
- 客户证言+关键结论提炼 — `'薄云咨询帮我们节省了30%的成本'——客户原话+量化结论`

---

## 图文/复合型

### `calloutAnnotation`（**v4.1.5 已软删除**）

**状态**：v4.1.5 起 `module.exports = null`，registry 静默跳过。

**软删理由**：标注气泡设计需要底图（产品 UI 截图 / 流程图 / 图表）才能发挥"指向 + 解释"
的语义，但 LLM 子代理常常孤立调用本模板，只剩 3 个气泡水平排开 — 视觉上无意义，
容易被误用为"卡片"。

**替代方案**：
- 真有底图需要标注 → `imageText` 或 `freeform`（带 image + 文字标注）
- 只想要"卡片"效果 → `cardGrid` / `threeColumn`
- 列表型节点说明 → `stepList`

---

### `dualPanel`

**说明**：双面板：左侧对比转换项目 + 右侧编号卡片，支持汇总栏
**何时用**：转变对比 + 执行步骤并排展示、改革前后行动方案
**不要用**：单一内容展示、时间线、图片画廊
**典型高度**：3.0~4.0英寸

**字段**：

- `leftTitle`: string · **required** · — 左侧面板标题
- `leftItems`: array · **required** · — 左侧对比项 [{from, to}]
  - `from`: string · optional · 长度 warn=25 / error=40
  - `to`: string · optional · 长度 warn=25 / error=40
- `rightTitle`: string · **required** · — 右侧面板标题
- `rightItems`: array · **required** · — 右侧卡片项 [{number, title, desc}]
  - `title`: string · optional · 长度 warn=25 / error=40
  - `desc`: string · optional · 长度 warn=25 / error=40
- `summary`: string · optional · 长度 warn=50 / error=80 · — 底部汇总文本（可选）
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 左侧旧→新对比条目，右侧具体行动步骤 — `左：从功能型到集成型供应链的转变（6项变化），右：具体实施步骤`
- 变革前后+执行方案同一页呈现 — `比beforeAfter更适合：需要在对比后紧接行动清单的场合`

---

### `moduleOverview`

**说明**：模块概览：带模块编号、标题、概述和主题卡片的章节封面
**何时用**：课程模块封面、章节概览、培训内容导览
**不要用**：数据展示、流程图、对比分析
**典型高度**：2.5~3.5英寸

**字段**：

- `moduleNumber`: number · optional · — 模块编号（可选）
- `moduleTitle`: string · **required** · — 模块标题
- `moduleSubtitle`: string · optional · 长度 warn=12 / error=20 · — 副标题（可选）
- `overview`: string · optional · 长度 warn=60 / error=100 · — 概述文本（可选）
- `topics`: array · optional · — 主题卡片列表 [{number, title, desc}]（可选）
  - `title`: string · optional · 长度 warn=12 / error=20
  - `desc`: string · optional · 长度 warn=30 / error=50
- `startY`: number · optional · — 起始Y坐标（可选）

**典型场景**：
- 章节封面页，介绍本章内容 — `第03章概览：带模块编号+总述段落+3-4个子主题卡片`
- 比sectionSlide更需要内容预览时 — `章节有3个以上子模块，需要一页预览全部内容`

---

### `sidebarLabel`

**说明**：左侧大字竖排标签（如"执行摘要"）+ 右侧2-4个内容卡片，适合摘要页和分层说明页
**何时用**：执行摘要页、分层内容、三阶段建议，左侧需要大字标签强调主题时
**不要用**：卡片超过4张时；内容无主题标签时
**典型高度**：约3.5英寸

**字段**：

- `label`: string · **required** · — 左侧大字标签（2-6字）
- `cards`: array · **required** · — [{ title, content, color? }]，2-4张
- `summary`: string · optional · — 底部总结条文字
- `startY`: number · optional · — 起始Y坐标（英寸）

**典型场景**：
- 执行摘要页，左侧需要大字标注主题 — `左侧'执行摘要'大字，右侧3张'立即做/重点投入/避免陷阱'卡片`
- 分层说明，每层有独立卡片 — `左侧'核心建议'，右侧按01/02/03排列的行动建议卡片`

---

## 其他

### `compositeLayout`

**说明**：复合页：一页 2-4 个内容块按 grid 预设布局，每块独立标题 + 文字/bullets/数据，适合信息密度高的页面
**何时用**：一页要表达 2-4 个并列信息块，每块结构不同（如主图 + 侧 panel + 4 数据卡）
**不要用**：所有块结构相同用 cardGrid；纯并列文字用 threeColumn
**典型高度**：3.6"

**字段**：

- `grid`: string · **required**
- `blocks`: array · **required** · 长度 2–4
  - `title`: string · optional · 长度 warn=18 / error=32
  - `body`: string · optional · 长度 warn=100 / error=200
  - `bullets`: array · optional
  - `bigNumber`: string · optional
  - `bigLabel`: string · optional
  - `accentColor`: string · optional
- `startY`: number · optional

**典型场景**：
- 主图 + 侧栏说明 + 数据卡组合 — `产品定位象限 + 4 个 reason 卡`
- 左侧大块 + 右侧 2 个上下细化 — `战略 + 关键举措 + 衡量指标`

---

## 逃生舱

### `freeform`

**说明**：v4.0.0 逃生舱：允许直接执行 pptxgenjs 代码绕过模板系统，用于罕见/一次性视觉需求
**何时用**：现有 103 模板都无法承载的一次性自定义视觉；子代理直接生成画法比挑模板更精准
**不要用**：能用 productMatrix / quadrantMap / compositeLayout / cardGrid 等已有模板时，禁止退化为 freeform
**典型高度**：auto

**字段**：

- `renderFn`: function · optional · — 直接传入渲染函数 (pres,slide,data,infra)=>void
- `renderCode`: string · optional · — JS 函数体字符串，沙箱执行，只能访问 pres/slide/data/infra + 安全全局
- `data`: object · optional
- `fallback`: object · optional · — { type, data } — renderCode 抛错时降级到此模板
- `apis`: array · optional
- `prompt`: string · optional

**典型场景**：
- 极特殊版式 — `决策树 / 桑基图 / 自定义信息图`
- 一次性嵌入 — `某页要画一个特定形状的 logo 演化时间轴`

---

## 页面模板

### `backCoverSlide`

**说明**：结束封底页，蓝色背景，带感谢语、讲师信息、日期和网址
**何时用**：演示文稿最后一页，作为结束感谢页
**不要用**：封面页或中间页面不使用
**典型高度**：full-page

**字段**：

- `text`: string · optional · — 主文字，默认"谢谢各位"
- `subtitle`: string · optional · — 副标题（金句），warn 30 字 error 50 字
- `instructor`: string · optional · — 讲师姓名/机构
- `dateLine`: string · optional · — 日期信息
- `website`: string · optional · — 网站地址，默认 www.szbring.com
- `style`: string · optional · — "default"（蓝底极简稳重）/ "speechBubble"（对话气泡）/ "minimal"（极简白底）
- `qrCode`: string · optional · — 二维码图片路径（默认自动使用 assets/qrcode.jpg；传 null 关闭）
- `contact`: object · optional · — 联系方式对象 { phone, email, address, wechat }；默认自动注入薄云联系方式（电话/邮箱/官网）；传 null 关闭

**典型场景**：
- PPT最后一页结束页 — `谢谢+团队信息+公司+日期+网址——所有PPT的封底页`

---

### `closingQuote`

**说明**：收尾金句页（封底前一页）：大字金句 + 小字署名/出处，构成 "金句 + THANK YOU" 两页式专业封底
**何时用**：演示结尾的金句页，配合后续 backCoverSlide 形成两页式封底；适用于提案、咨询报告、培训课件
**不要用**：内容页或中间引用（用 quoteEmphasis / quoteBanner）；只有一页封底（直接用 backCoverSlide）
**典型高度**：full-page

**字段**：

- `quote`: string · **required** · — 金句正文（建议 20-60 字）
- `author`: string · optional · — 署名/作者（如 "—— 彼得·德鲁克"）
- `source`: string · optional · — 出处/补充（如 "《管理实践》, 1954"）
- `label`: string · optional · — 左上角小标签（如 "结语"、"核心洞察"、"留给客户一句话"）
- `labelEn`: string · optional · — 左上角英文标签（如 "CLOSING THOUGHT"）
- `style`: string · optional · — "darkBlue"（默认深蓝大字）/ "lightCard"（浅灰背景 + 蓝字卡）

**典型场景**：
- PPT 收尾留给客户一句话 — `"AI 不是替代顾问，而是让每位顾问拥有 10 倍杠杆"`
- 汇报结束前的核心洞察 — `"未来的竞争，不是公司之间，而是生态之间"`
- 名人金句结尾增信 — `"做正确的事比正确地做事更重要——彼得·德鲁克"`

---

### `contentSlide`

**说明**：标准内容页，带标题、章节标签、互动问题和来源引用，作为其他布局的底座页面
**何时用**：所有标准内容页，作为图表、列表、卡片等布局的底座；需要标题+内容区域时使用
**不要用**：封面页、章节页、引语页等特殊页面不使用
**典型高度**：full-page

**字段**：

- `title`: string · **required** · — 页面主标题（中文）
- `titleEn`: string · optional · — 页面英文副标题（如 "Work Arrangement"），高级商务风
- `sectionTag`: string|object · optional · — 章节标签，字符串或 { text, color }
- `engagementQuestion`: string · optional · — 互动思考题，显示在页面底部
- `sourceRef`: string · optional · — 数据来源引用，右对齐显示在底部
- `takeaway`: string · optional · — v4.0.5: 一句话告诉客户本页要做什么决定，14pt 灰字显示在标题下方
- `chapterInfo`: object · optional · — v4.0.5: 章节脚标信息 {number, title, pageInChapter, pagesInChapter}（由 converter 自动注入）
- `variant`: string · optional · — v4.0.5: internal (默认) / proposal — proposal 模式使用 serif 字体与暖纸底

**典型场景**：
- 标准内容页的底座（不单独使用） — `内部工具，gen_ppt自动调用，不需要AI直接指定`

---

### `heroCover`

**说明**：Hero 封面：左侧深色色块（标题区）+ 右侧大图建筑 + 金色 accent + 客户/日期/讲师条
**何时用**：提案封面 / 客户级首页，需要顶咨级第一印象
**不要用**：内部 / 中性场景用 coverSlide
**典型高度**：full-page

**字段**：

- `title`: string · **required** · 长度 warn=20 / error=35
- `titleEn`: string · optional · 长度 warn=30 / error=50
- `subtitle`: string · optional · 长度 warn=40 / error=60
- `clientName`: string · optional · 长度 warn=20 / error=30
- `date`: string · optional
- `reporter`: string · optional · 长度 warn=25 / error=40
- `image`: string · optional · — 右侧图路径，默认走 assets/cover-building.jpg

---

### `heroSection`

**说明**：戏剧化章节过渡页：左侧深色色块 + 超大字章节号 + 右侧标题与一句话
**何时用**：客户提案核心章节过渡页，需要给视觉冲击与节奏停顿
**不要用**：常规中性章节用 sectionSlide；非关键章节
**典型高度**：full-page

**字段**：

- `sectionNumber`: number · **required**
- `sectionTitle`: string · **required** · 长度 warn=18 / error=30
- `sectionTitleEn`: string · optional · — 英文副标题（可选）
- `sectionSubtitle`: string · optional · 长度 warn=40 / error=60
- `accent`: string · optional · — 强调金色 hex（可选）

**典型场景**：
- 提案章节首页 — `"模块二 · 解决方案设计"`

---

### `tocPage`

**说明**：目录页，支持列表式（list）和网格式（grid）两种布局，带编号圆圈和章节标题
**何时用**：演示文稿目录页，列出各章节或模块，通常放在封面页之后
**不要用**：内容页、章节页不使用
**典型高度**：full-page

**字段**：

- `title`: string · optional · — 目录标题，默认"目录"
- `items`: array · **required** · — 目录项数组，每项含 { title, subtitle?, number?, targetSlide? }；targetSlide 为目标 slide 索引（从 1 开始），存在时该项可点击跳转
- `style`: string · optional · — 布局风格：list（默认）/ grid（两列网格）/ sidebar（左色块 + 右两列编号列表，高级商务风）
- `titleEn`: string · optional · — 英文副标题（仅 sidebar 风格使用，如 "Contents"）

**典型场景**：
- 目录页，列出PPT章节结构 — `4-5个章节的目录，带编号圆圈和章节说明`
- 注意：作为顶层页面，type必须是'toc'，不能是content+layout:tocPage — `正确：{type:'toc', items:[...]}，错误：{type:'content', layouts:[{type:'tocPage'}]}`

---
