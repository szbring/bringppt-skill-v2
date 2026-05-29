# BRINGPPT 模板 API 速查卡

> **本文件是模板接口速查，不含实现代码。**
> 实现代码的真实源是 `templates/` + `registry.js` + `bring-core.js`。模板数量、类别和字段约束以 registry 运行结果为准。

```javascript
const bring = require("{SKILL_DIR}/bring-core");  // {SKILL_DIR} = skill 实际安装目录
// bring.addCoverSlide, bring.C, bring.shadow, ...
console.log(bring.registry.size());  // 当前应为 91
```

当前 registry：6 个 A 类页面模板 + 85 个 B 类布局模板。新增模板不需要修改手工 dispatcher，A/B 类分发分别由 `lib/page-template-map.js` 和 `lib/layout-map.js` 从 registry 自动生成。

---

## SmartFit 文字自适应机制

> **SmartFit v2 引擎**：`calcFitFontSize` 使用 Unicode 感知的混合宽度字符计算（CJK全角=1.0×、ASCII字母=0.55×、ASCII标点=0.35×），精确计算中英文混排文本的换行和字号。
> 同时所有高风险文本框均启用了 pptxgenjs `autoFit: true` 作为渲染端的安全兜底。
>
> **受保护的文本框（共 12 个）：**
> quoteBanner 引言、twoColumnCards 卡片内容、threeColumn 总结栏、stepList 总结栏、
> comparison 底部文本、impactQuestion 问题、styledTable 总结栏、caseBox 内容、
> layeredList 总结栏、cardGrid 总结栏、beforeAfter 总结栏。
>
> 下方各模板标注的字符约束仍需遵守——SmartFit 是安全网，不是放纵许可证。

---

## Y 坐标协调机制（Auto-Layout v2）

- **`slide._contentMaxBottom`**：内容区最大底部 Y 坐标。`addContentSlide` 默认设置为 `4.8"`，有 `engagementQuestion` 时设置为 `4.55"`。所有 B 类模板据此计算可用空间。
- **`slide._bottomY`**：每个 B 类模板渲染完成后通过 `validateBounds()` 自动记录实际底部 Y 坐标。
- **自动衔接（B 类布局模板）**：所有支持自动布局的 B 类模板均通过 `resolveStartY()` 衔接。未指定 `startY` 时，自动读取 `slide._bottomY + 0.25` 作为起始位置；无 `_bottomY` 则使用模板默认值。
- **越界检测**：`validateBounds()` 在内容超出 `_contentMaxBottom` 时输出 `console.warn`；基线测试会把高危 warning 视为失败。
- 示例：`threeColumn` 渲染后 `slide._bottomY = 3.55`，下一个 `quoteBanner` 不设 startY 即可自动定位到 `3.8`。

---

## 文本溢出处理原则（总体原则）

> **当文本框不足以容纳文字时，优先级如下：**
> 1. **调整文本框大小与位置**（首选）—— 扩大文本框、调整 startY/maxCardH 等参数
> 2. **调整字体大小**（次选）—— SmartFit 引擎自动缩小，或手动设置更小的 fontSize
> 3. **精简文本内容**（末选）—— 仅在前两种方案都无法解决时才删减文字
>
> 此原则适用于所有 PPT 生成场景，是 BRINGPPT SKILL 的核心设计约束。

---

## A类：页面模板（8个，独立成页）

### A1 addCoverSlide
```
bring.addCoverSlide(pres, { title, subtitle?, keywords?[], seriesLabel?, location?, logoPath? })
→ 返回 slide
```
| 参数 | 必填 | 类型 | 默认值 | 约束 |
|------|------|------|--------|------|
| title | ✅ | string 或 {text,color}[] | — | warn≤20字, error≤30字 |

**title 数组格式：** `[{ text: "前半", color: "WHITE" }, { text: "后半", color: "ACCENT" }]`。color 支持颜色常量名（WHITE/ACCENT/PRIMARY等）或6位hex。函数自动应用28pt加粗微软雅黑默认样式。
| subtitle | — | string | — | — |
| keywords | — | string[] | [] | — |
| seriesLabel | — | string | — | 显示在标题上方 |
| location | — | string | "中国·深圳" | 竖排显示在右侧 |

**视觉：** 深蓝大色块 + 椭圆(rotate:27°) + 四角星(rotate:30°,0.32") + 竖线 + 竖排地点 + 文本框(x:1.19")

---

### A2 addContentSlide
```
bring.addContentSlide(pres, { title, sectionTag?, engagementQuestion?, sourceRef?, logoPath? })
→ 返回 slide（需搭配B类布局模板使用）
```
| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| title | ✅ | string | 24pt 蓝色标题 |
| sectionTag | — | {text, color?} 或 string | 右上角章节标签 |
| engagementQuestion | — | string | 底部互动提问（橙色斜体） |
| sourceRef | — | string | 底部数据来源（9pt灰色） |

**注意：** 当有 engagementQuestion 时，会设置 `slide._contentMaxBottom = 4.55`，B类布局自动感知。

---

### A3 addSectionSlide
```
bring.addSectionSlide(pres, { sectionTitle, sectionNumber?, subtitle?, coreLogic?, cards?[], logoPath? })
→ 返回 slide
```
| 参数 | 必填 | 约束 |
|------|------|------|
| sectionTitle | ✅ | warn≤12字, error≤20字 |
| sectionNumber | — | 数字，显示为"MODULE 0X" |
| subtitle | — | — |
| coreLogic | — | string，橙色左边条框 |
| cards | — | [{title, desc}]，最多3张 |

---

### A4 addCaseDivider
```
bring.addCaseDivider(pres, { badge?, title, subtitle?, logoPath? })
→ 返回 slide
```
深灰底(`2D3748`) + 橙色徽章 + 白色大标题 + 橙色分隔线 + logo + 页码。badge 默认"案例"。

---

### A5 addFullQuote
```
bring.addFullQuote(pres, { quote, author?, source?, logoPath? })
→ 返回 slide
```
全页蓝底 + 大引号装饰 + 白色引言(24pt) + 作者署名 + logo + 页码。quote: warn≤60字。

---

### A6 addBackCoverSlide
```
bring.addBackCoverSlide(pres, { text?, subtitle?, instructor?, dateLine?, website? })
→ 返回 slide
```
深蓝底 + 四角四角星装饰(0.32", 75%透明) + "谢谢各位" + 橙色线 + 网站(18pt)。

---

## B类：布局模板（96个，叠加在 A2 ContentSlide 上）

> 所有 B 类函数签名：`bring.addXxx(pres, slide, { ...data })`
> 通用可选参数：`startY`（内容起始Y坐标，默认约1.0"）

### B01 addStepList — 步骤列表
```
{ steps[]{title, desc}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| steps | 必填3-5项 (errorMin:2, errorMax:7) |
| steps[].title | 4-15字 |
| steps[].desc | 15-40字 (error≤60) |
| summary | **必填**≥20字, warn≤40字, error≤60字 🛡️SmartFit |

---

### B02 addComparison — 左右对比
```
{ left{title, items[]}, right{title, items[]}, showVS?, bottomText?, startY? }
```
| 字段 | 约束 |
|------|------|
| left/right.items[] | ⚠️ **字段名是 items 不是 bullets** |
| items[] 每项 | 12-25字 (error≤40) |
| bottomText | **必填**≥15字, warn≤40字, error≤60字 🛡️SmartFit |
| showVS | bool，显示橙色VS圆 |

---

### B03 addTwoColumnCards — 双栏卡片
```
{ cards[]{title, content}, startY? }
```
| 字段 | 约束 |
|------|------|
| cards | 恰好2项 |
| cards[].content | ⚠️ **字符串（多行用\n），不是数组** |
| content | warn≤80字, error≤120字 🛡️SmartFit（动态字号+动态高度） |

---

### B04 addThreeColumnWithSummary — 三栏+总结
```
{ cards[]{number, title, desc}, summary?, maxCardH?, startY? }
```
cards 恰好3项。number 为数字编号。summary: warn≤40字, error≤60字 🛡️SmartFit。
`maxCardH`（可选）：限制卡片最大高度，用于为下方叠加的布局（如 quoteBanner）预留空间。

---

### B05 addDataHighlight — 大字数据
```
{ items[]{number, label, unit?, desc?}, startY?, fontSize? }
```
items: 2-4项。number: 2-8字。label: 4-12字。默认startY=1.5。

---

### B06 addTimeline — 时间线
```
{ events[]{year, title, desc}, startY? }
```
events: 3-5项。横向排列，五色节点。

---

### B07 addProcessFlow — 流程图
```
{ steps[]{title, desc}, startY? }
```
steps: 3-5项 (**errorMax=5**，6项会溢出)。横向卡片+箭头。

---

### B08 addStyledTable — 表格
```
{ headers[], rows[][], summary?, rowAccentColors?[], startX?, startY?, w? }
```
rows 单元格可为 string 或 `{text, highlight?, color?}`。rowAccentColors 为行级左侧色条。summary: warn≤40字, error≤60字 🛡️SmartFit。

---

### B09 addIconList — 图标列表
```
{ items[]{title, desc, iconData?}, numbered?, gradientColors?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| items | array | 3-5项，每项包含 title 和 desc |
| numbered | bool | 是否显示编号（1-5），默认 false |
| gradientColors | bool | 是否使用渐变色填充圆圈（蓝→橙），默认 false |
| iconData | string | base64 PNG 图标（与 numbered 互斥） |
| startY | number | 起始 Y 坐标 |

**视觉效果：**
- 默认：灰色圆圈 + 可选图标
- `numbered: true`：白色数字 1-5
- `gradientColors: true`：五种渐变色（PRIMARY → SECONDARY → SUCCESS → ACCENT → DANGER）

自动高度缩放防溢出。

---

### B10 addQuadrantMatrix — 四象限（线框）
```
{ quadrants[]{title, content, color?}, axisLabels?{top,bottom,left,right}, startY? }
```
| 字段 | 约束 |
|------|------|
| quadrants | 恰好4项 |
| content | ⚠️ **字符串，不是 items 数组** |
| content | 8-40字 |

有左右轴标签时自动缩窄(cellW=3.8)留边距。

---

### B11 addPyramid — 金字塔
```
{ levels[]{title, desc}, startY? }
```
levels: 3-5项。从窄到宽递增层。

---

### B12 addQuoteBanner — 引言横幅
```
{ quote, author?, startY?, h?, bgColor? }
```
全宽色块嵌入式引言。quote: 15-50字(warn≤60, error≤100) 🛡️SmartFit。可组合使用。
**startY 自动衔接**：未指定 startY 时，自动读取 `slide._bottomY + 0.25`；若无 `_bottomY` 则默认 `0.9`。

---

### B13 addCaseBox — 案例框
```
{ title, content, startY?, startX?, w?, h? }
```
橙色竖条 + 浅底。content: 20-100字 🛡️SmartFit。
**startY 自动衔接**：未指定 startY 时，自动读取 `slide._bottomY + 0.25`；若无 `_bottomY` 则默认 `3.5`。

---

### B14 addImageText — 图文混排
```
{ title, content?, bullets?[], imageData?, imagePath?, layout?, startY? }
```
layout: "left"（左图右文）或 "right"（左文右图）。

---

### B15 addModuleOverview — 模块总览
```
{ moduleNumber, moduleTitle, moduleSubtitle?, overview?, topics?[]{number, title, desc}, startY? }
```
内嵌蓝色模块面板 + 概述 + 子主题卡片。

---

### B16 addLayeredList — 分层列表
```
{ layers[]{tag, title, desc, tagColor?}, banner?{text, bgColor?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| layers | 必填2-4项 |
| layers[].tag | ⚠️ **必填**，2-8字 |
| layers[].desc | 15-40字 |
| summary | **必填**≥20字, warn≤40字, error≤60字 🛡️SmartFit |
| banner | 可选顶部横幅 |

---

### B17 addColorMatrix — 四象限（彩色填充）
```
{ quadrants[]{title, content, color?}, axisLabels?{left, bottom}, centerLabel?, footnote?, startY? }
```
quadrants 恰好4项。content 为字符串。与 B10 区别：彩色填充 vs 线框。

---

### B18 addDualPanel — 双面板
```
{ leftTitle, leftItems[]{from, to}, rightTitle, rightItems[]{number, title, desc?}, summary?, startY? }
```
⚠️ 左面板是关系映射(from→to)，右面板是编号列表。

---

### B19 addQuoteEmphasis — 引言+警示
```
{ quote, author?, emphasis, emphasisSub?, summary?, startY? }
```
引言块(左白竖线) + 浅红警示面板。quote: 15-50字, emphasis: 10-40字。

---

### B20 addImpactQuestion — 冲击提问
```
{ question, answer, answerHighlight?, startY? }
```
大号橙色居中问题 + 答案面板。question: 8-30字(error≤40字) 🛡️SmartFit, answer: 15-60字。

---

### B21 addBeforeAfter — 变革前后对比
```
{ pairs[]{before, after, afterDesc?, color?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| pairs | 必填2-5项 |
| before | 4-10字（灰色"变革前"卡片） |
| after | 4-12字（彩色"变革后"卡片） |
| afterDesc | 8-25字 |

上行灰卡 + 向下箭头 + 下行彩卡 + 横向箭头连接。summary: warn≤40字, error≤60字 🛡️SmartFit。

---

### B22 addCardGrid — 卡片网格
```
{ cards[]{title, desc?, bgColor?}, columns?, groupLabels?[]{text, span, color?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| cards | 必填≥4项 |
| columns | 默认4 |
| cards[].title | 4-12字 |
| cards[].desc | 8-25字 |

多行多列自动布局。适合 >6 项并列展示。summary: warn≤40字, error≤60字 🛡️SmartFit。

---

## C类：图表模板（4个，叠加在 A2 ContentSlide 上）

> 所有图表函数签名：`bring.addChartXxx(pres, slide, { ...data })`
> 统一数据格式：`[{ name: "系列名", labels: ["标签1","标签2",...], values: [数值1,数值2,...] }]`
> 统一薄云品牌配色：深蓝→辅助蓝→绿色→橙色→红色→天蓝→金色

### C01 addChartBar — 柱状/条形图
```
{ data[], title?, horizontal?, stacked?, showValue?, startY?, chartH? }
```
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| data | array | **必填** | `[{ name, labels[], values[] }]`，支持多系列 |
| title | string | — | 图表上方标题（14pt蓝色） |
| horizontal | bool | false | true=横向条形图，false=纵向柱状图 |
| stacked | bool | false | true=堆叠，false=并排 |
| showValue | bool | false | 是否显示数据标签 |
| chartH | number | 3.2 | 图表区域高度（英寸） |

---

### C02 addChartLine — 折线图
```
{ data[], title?, showMarker?, smooth?, showValue?, startY?, chartH? }
```
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| data | array | **必填** | 同上，支持多系列折线 |
| showMarker | bool | true | 是否显示数据点标记 |
| smooth | bool | false | 是否平滑曲线 |

---

### C03 addChartPie — 饼图/环形图
```
{ data[], title?, doughnut?, showPercent?, showLabel?, startY?, chartH? }
```
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| data | array | **必填** | 仅使用第一个系列 |
| doughnut | bool | false | true=环形图，false=饼图 |
| showPercent | bool | true | 是否显示百分比标签 |
| showLabel | bool | true | 是否显示类别标签 |

---

### C04 addChartCombo — 柱线组合图
```
{ barData[], lineData[], title?, showValue?, startY?, chartH? }
```
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| barData | array | **必填** | 柱状图数据（主轴） |
| lineData | array | **必填** | 折线图数据（副轴） |

柱状在主纵轴，折线在副纵轴，适合"量+率"的组合展示（如销售额+增长率）。

---

## D类：图片增强模板（1个）

### D01 addImageGallery — 图片网格
```
{ images[]{path?, data?, caption?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| images | array | 2-4张图片，每张包含 path（文件路径）或 data（base64） |
| images[].caption | string | 图片下方说明文字（11pt灰色） |
| title | string | 网格上方标题 |

布局：2张=1行2列，3张=1行3列，4张=2行2列。无图片时显示"Image"占位文字。

---

## A7 addTocPage — 目录页

> **V3.1新增** — A类页面模板，独立成页

```
bring.addTocPage(pres, { title?, items[], style?, logoPath? })
→ 返回 slide
```
| 参数 | 必填 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| title | — | string | "目录" | 页面标题 |
| items | ✅ | string[] | — | 目录条目列表 |
| style | — | "list"\|"grid" | "list" | list=竖排列表，grid=2列网格 |

**视觉：** 编号圆圈(深蓝) + 条目标题 + 左上蓝条装饰 + logo + 页码。

---

## E-class: V3.0 新模板（10个）

### E01 addGanttChart — 甘特图/项目计划
```
{ tasks[]{name, start, duration, color?, milestone?, progress?}, startMonth?, months?, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| tasks | array | 最多8个任务，start/duration以月为单位（0-based） |
| tasks[].milestone | bool | true时画菱形里程碑（无duration） |
| tasks[].progress | number | 0-1，显示进度条覆盖 |
| startMonth | number | 起始月份标签数字 |
| months | number | 月份列数（默认6） |
| **推荐内容量** | | 4-8个任务，4-6个月份 |

### E02 addKpiDashboard — KPI仪表盘
```
{ kpis[]{label, value, unit?, trend?, trendLabel?, color?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| kpis | array | 2-4个指标卡片 |
| kpis[].trend | string | "up"(绿箭头)/"down"(红箭头)/"flat"(灰) |
| kpis[].trendLabel | string | 趋势说明文字（如"+5.2pp"） |
| **推荐内容量** | | 3-4个KPI，value简短（≤6字符） |

### E03 addFishbone — 鱼骨图/因果分析
```
{ problem, causes[]{category, items[]}, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| problem | string | 中心问题（右侧红色框） |
| causes | array | 3-6个分类，交替分布在脊柱上下 |
| causes[].items | string[] | 每分类最多3个原因项 |
| **推荐内容量** | | 4个分类 × 2-3个原因项 |

### E04 addFunnel — 漏斗图
```
{ stages[]{label, value?, desc?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| stages | array | 3-5层递减漏斗 |
| stages[].value | string | 右侧大字数值 |
| stages[].desc | string | 右侧小字描述 |
| **推荐内容量** | | 4-5层，label≤8字 |

### E05 addPhaseDiagram — 阶段图/路线图
```
{ phases[]{name, items[], color?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| phases | array | 3-5个阶段，用chevron箭头连接 |
| phases[].items | string[] | 阶段内的工作项 |
| **推荐内容量** | | 3-4个阶段 × 3-4个工作项 |

### E06 addQuarterlyPlan — 季度计划
```
{ quarters[]{label, focus, items[]}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| quarters | array | 固定4个Q1-Q4卡片 |
| quarters[].focus | string | 季度焦点标题（加粗） |
| quarters[].items | string[] | 工作项列表 |
| **推荐内容量** | | 每季度3-4个工作项，focus≤6字 |

### E07 addProgressList — 进度条列表
```
{ items[]{name, percent, desc?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| items | array | 最多8个进度项 |
| items[].percent | number | 0-100，颜色自动适配（100=绿，≥60=蓝，<60=橙） |
| **推荐内容量** | | 4-6个进度项 |

### E08 addProblemSolution — 问题-解决方案
```
{ problems[], solutions[], leftTitle?, rightTitle?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| problems | string[] | 左侧红色区域，✕前缀 |
| solutions | string[] | 右侧绿色区域，✓前缀 |
| leftTitle | string | 左列标题（默认"问题"） |
| rightTitle | string | 右列标题（默认"解决方案"） |
| **推荐内容量** | | 3-5个问题/解决方案对 |

### E09 addAchievement — 成果展示
```
{ metrics[]{value, label, desc?}, title?, startY? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| metrics | array | 2-4个成果卡片（圆形数字+标签+描述） |
| metrics[].value | string | 大号数值（如"3.2亿"、"98%"） |
| **推荐内容量** | | 3-4个指标，value≤5字符 |

### E10 addStaircase — 阶梯递进
```
{ steps[]{label, desc?}, title?, startY?, h? }
```
| 参数 | 类型 | 说明 |
|------|------|------|
| steps | array | 3-6个递进台阶（左下→右上） |
| steps[].desc | string | 台阶描述文字（矮台阶会合并显示） |
| **推荐内容量** | | 4个台阶，label≤4字，desc≤8字 |

---

## 颜色常量速查

```javascript
const C = bring.C;
// 主色
C.PRIMARY    = "003591"   // 深邃商务蓝（标题、重点）
C.SECONDARY  = "5385C5"   // 中度蓝（竖条、次级）
C.BLUE_LIGHT = "80AACD"   // 浅蓝
C.BLUE_PALE  = "BBCEE5"   // 极浅蓝（背景层）
C.ACCENT     = "003591"   // 兼容旧键名，强调仍使用主蓝
C.WHITE      = "FFFFFF"
C.TEXT       = "383535"   // 正文深灰
C.TEXT_LIGHT = "7F7F7F"   // 辅助灰
// 兼容旧功能色键名，但值已映射到蓝灰体系
C.SUCCESS    = "5385C5"
C.DANGER     = "383535"
C.BG_LIGHT   = "F7F5F6"
C.GOLD       = "003591"
C.SKY        = "80AACD"
C.BG_CARD    = "BBCEE5"
C.BORDER     = "003591"
C.ATTR_GRAY  = "D9D9D9"   // 深色底署名
C.INFO_GRAY  = "A7A7A7"   // 深色底辅助
```

**五色步骤：** `bring.STEP_COLORS = ["003591", "5385C5", "80AACD", "BBCEE5", "A7A7A7"]`

---

## 工具函数

```javascript
bring.shadow()              // 标准卡片阴影
bring.renderIconSvg(Icon, color, size)  // React Icon → SVG string
bring.iconToBase64Png(svgStr, size)     // SVG → base64 PNG (用于 iconData)
bring.pptxgen               // pptxgenjs 模块引用
bring.LOGO_PATH             // logo 文件路径

// SmartFit 文字自适应（内部使用，无需手动调用）
// calcFitFontSize(text, boxW, boxH, baseFontSize, {lineSpacing?, minFontSize?})
// → 返回最优字号（≥minFontSize），自动估算CJK字符换行
```

---

## iconList 颜色使用指南 (v1.2+)

### 三种颜色模式

#### 1. 默认模式 - 统一灰色
```javascript
{
  type: `iconList`,
  data: {
    items: [
      { title: `标题`, desc: `说明` }
    ],
    numbered: true  // 灰色圆圈 + 白色数字
  }
}
```

#### 2. 渐变色模式 - 五种渐变色
```javascript
{
  type: `iconList`,
  data: {
    items: [
      { title: `要素1`, desc: `...` },  // 深蓝
      { title: `要素2`, desc: `...` },  // 辅助蓝
      { title: `要素3`, desc: `...` },  // 绿
      { title: `要素4`, desc: `...` },  // 橙
      { title: `要素5`, desc: `...` }   // 红
    ],
    gradientColors: true,  // 五种渐变色
    numbered: true
  }
}
```

#### 3. 自定义颜色模式 - 单项控制 (v1.2+)
```javascript
{
  type: `iconList`,
  data: {
    items: [
      { title: `流程1`, desc: `...`, circleColor: `999999` },  // 灰色（弱化）
      { title: `流程2`, desc: `...`, circleColor: `999999` },  // 灰色（弱化）
      { title: `流程3`, desc: `...`, circleColor: `2C5A8E` },  // 深蓝（高亮）
      { title: `流程4`, desc: `...`, circleColor: `2C5A8E` }   // 深蓝（高亮）
    ],
    numbered: true
  }
}
```

### 使用场景决策

**需要全部不同颜色（5项）？**
→ 使用 `gradientColors: true`

**需要部分高亮（如①②灰色、③④深蓝）？**
→ 使用 `circleColor` 字段

**需要统一样式？**
→ 只使用 `numbered: true`

### 优先级

`item.circleColor` > `gradientColors` > 默认灰色

### 常见错误

❌ 使用 `icon: '①'` 字段 → 不支持
❌ 使用 `color: 'xxx'` 字段 → 不支持
✅ 使用 `circleColor: '2C5A8E'` → 正确
✅ 使用 `gradientColors: true` → 正确

---

## F类：V3.1 新模板（14个B类布局）

> 所有 F 类函数签名：`bring.addXxx(pres, slide, { ...data })`
> 通用可选参数：`startY`（内容起始Y坐标）

### F01 addCycleDiagram — 环形循环流程
```
{ steps[]{title, desc}, centerTitle?, startY? }
```
| 字段 | 约束 |
|------|------|
| steps | 4-6项，顺时针弧形排列 |
| centerTitle | 中心圆文字 |

适合 PDCA、闭环管理流程。步骤间弧形箭头连接，STEP_COLORS着色。

---

### F02 addVennDiagram — 维恩图
```
{ circles[]{title, desc, color?}, intersection?, startY? }
```
| 字段 | 约束 |
|------|------|
| circles | 2-3个圆（半透明填充交叉） |
| intersection | 交集区域标注文字 |

适合要素关联分析、概念交集展示。

---

### F03 addRadialHub — 中心辐射图
```
{ center{title, subtitle?}, spokes[]{title, desc?}, startY? }
```
| 字段 | 约束 |
|------|------|
| center | 中心大圆标题 |
| spokes | 4-6个辐射卡片，等角分布 |

适合核心能力展示、要素辐射分析。

---

### F04 addSwotGrid — SWOT/四格分析
```
{ quadrants[]{label, title, items[], color?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| quadrants | 恰好4格（2x2网格） |
| quadrants[].items | string[]，每格要点列表 |
| summary | 底部总结条 |

适合 SWOT、PEST 等经典四格分析框架。默认色：蓝/橙/绿/红。

---

### F05 addSnakeFlow — 蛇形流程
```
{ steps[]{title, desc}, startY? }
```
| 字段 | 约束 |
|------|------|
| steps | 6-10项，多行蛇形排列 |

第一行左→右，第二行右→左，第三行左→右。紧凑展示多步流程。STEP_COLORS循环着色。

---

### F06 addDualTrackTimeline — 双轨时间线
```
{ trackA{label, events[]{title, desc}}, trackB{label, events[]{title, desc}}, nodes[]?, startY? }
```
| 字段 | 约束 |
|------|------|
| trackA | 上方轨道（标签+事件列表） |
| trackB | 下方轨道（标签+事件列表） |
| nodes | 时间轴节点标签（如["1月","2月",...]） |

适合"计划vs实际"、"线上vs线下"并行对比。

---

### F07 addChecklist — 清单核查
```
{ items[]{title, desc, done?}, columns?, startY? }
```
| 字段 | 约束 |
|------|------|
| items | 最多10项（单列）或16项（双列） |
| items[].done | bool，true=✓完成/false=○未完成 |
| columns | 1或2列布局 |

适合行动计划、任务核查列表。交替浅蓝背景条。

---

### F08 addWaveProgression — 波浪递进
```
{ waves[]{title, desc}, startY? }
```
| 字段 | 约束 |
|------|------|
| waves | 3-5步，波浪形箭头递进 |

从左下到右上递进，颜色从深到浅渐变。适合发展路径、成长阶段展示。

---

### F09 addChainFlow — 链环流程
```
{ links[]{title, desc}, startY? }
```
| 字段 | 约束 |
|------|------|
| links | 3-6个椭圆环相互穿插 |

链条状视觉效果，强调步骤间紧密关联。半透明填充。

---

### F10 addMultiProjectCards — 多项目卡片
```
{ projects[]{name, status, items[], progress}, startY? }
```
| 字段 | 约束 |
|------|------|
| projects | 3-5个等宽项目卡片横排 |
| progress | 0-100进度百分比 |
| items | string[]，项目概述要点 |

适合项目组合管理、多项目状态一览。

---

### F11 addHourglass — 沙漏对比
```
{ left{label, items[]{title, desc}}, right{label, items[]{title, desc}}, centerLabel?, startY? }
```
| 字段 | 约束 |
|------|------|
| left | 左侧（现状/问题），最多5项 |
| right | 右侧（目标/方案），最多5项 |
| centerLabel | 中心沙漏标注文字 |

适合"问题→方案"、"现状→目标"左右对称对比。

---

### F12 addFlowerPetal — 花瓣图
```
{ center, petals[]{title, desc, icon?}, startY? }
```
| 字段 | 约束 |
|------|------|
| center | string，中心核心概念 |
| petals | 恰好4瓣（2x2花瓣形状） |

4个重叠圆形成花瓣/四叶草，适合核心要素关系展示。

---

### F13 addAnalysisMatrix — 分析矩阵
```
{ rowHeaders[], colHeaders[], cells[[]], title?, startY? }
```
| 字段 | 约束 |
|------|------|
| rowHeaders | string[]，行标签（最多8行） |
| colHeaders | string[]，列标签（最多6列） |
| cells | 二维数组，单元格内容 |
| title | 矩阵标题 |

比styledTable更强调分析框架感。适合用户旅程图、能力矩阵。

---

### F14 addOrgChart — 组织架构
```
{ root{title, role?, children[]{title, role?, children?[]}}, startY? }
```
| 字段 | 约束 |
|------|------|
| root | 树状层级对象（最多3层） |
| root.role | 角色/职位描述 |
| children | 递归子节点数组 |

树状层级图，适合组织设计方案展示。竖线连接父子节点。


---

## G类：ISC汇报风格模板（3个，叠加在 A2 ContentSlide 上）

> 来源：薄云咨询ISC供应链汇报方案提炼（2026-04-20）
> 适用场景：咨询汇报、诊断报告、变革方案等专业咨询类PPT

### G01 addSidebarLabel — 左侧大字标签布局
```
{ label, cards[]{title, content, color?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| label | 左侧大字标签，2-6字，error≤10字 |
| cards | 2-4张，恰好2-4项（error） |
| cards[].title | warn≤10字, error≤18字 |
| cards[].content | 字符串（多行用\n），warn≤80字, error≤120字 |
| summary | 底部蓝色总结条，warn≤40字, error≤60字 🛡️SmartFit |

左侧竖排大字标签（深蓝背景）+ 右侧等宽卡片（顶部彩色条），适合执行摘要、三阶段建议、分层分析。

---

### G02 addCausalChain — 垂直因果链
```
{ steps[]{tag, content, detail?}, summary?, startY? }
```
| 字段 | 约束 |
|------|------|
| steps | 3-5步，error<2或>5 |
| steps[].tag | 橙色胶囊标签（分类/层级），warn≤8字, error≤15字 |
| steps[].content | 主要内容，warn≤30字, error≤50字 |
| steps[].detail | 补充说明（可选），warn≤40字, error≤60字 |
| summary | 底部蓝色总结条（核心结论），warn≤40字, error≤60字 |

橙色胶囊标签 + 蓝色内容块 + 向下箭头，适合根因分析、诊断层次（战略→组织→流程）。与processFlow的区别：有标签分类、更强因果语意。

---

### G03 addInsightBanner — 核心洞察条
```
{ insight, label?, style?, startY? }
```
| 字段 | 约束 |
|------|------|
| insight | 核心洞察/结论，warn≤50字, error≤80字 |
| label | 左侧小标签（如"核心洞察""诊断结论"），warn≤8字, error≤12字 |
| style | "blue"（默认）\| "orange" \| "dark" |

全宽底部深蓝色总结条，左侧橙色竖线装饰，可叠加在任意内容页底部。适合咨询报告每页底部的核心结论强调，比 engagementQuestion 更正式。

---

## H 类：v3.2.5/3.2.6 新增（图表 / 文字属性 / 形状）

### H01 addChartBar3D — 3D 柱形图
```
{ data, title?, horizontal?, stacked?, startY?, chartH? }
```
| 字段 | 约束 |
|------|------|
| data | [{ name, labels, values }]；与 chartBar 同结构 |
| horizontal | 默认 false（竖柱），true 为横向条形 |
| stacked | 默认 false，true 为堆叠 |

视觉冲击型，营销/封面/行业报告开篇页用；精确读数场景请用 chartBar。

### H02 addChartArea — 面积图
```
{ data, title?, stacked?, startY?, chartH? }
```
| 字段 | 约束 |
|------|------|
| data | [{ name, labels, values }]；多系列堆叠时 labels 必须一致 |
| stacked | 默认 false，true 为堆叠面积（多系列累积） |

适合"累积演变"或"占比构成随时间变化"。区别 chartLine：area 强调累积/构成，line 强调趋势走向。

### H03 addChartRadar — 雷达图
```
{ data, title?, radarStyle?, startY?, chartH? }
```
| 字段 | 约束 |
|------|------|
| data | [{ name, labels: [维度1..], values: [..] }]；多系列时 labels 必须一致；3-8 维度 |
| radarStyle | "standard"（默认）\| "filled"（推荐做能力轮廓）\| "marker" |
| chartH | 建议 ≥ 3.2"，雷达图近似正方形效果最好 |

咨询能力评估、产品对标、员工能力盘点等多维度评分场景。

### H04 addChartScatter — 散点图
```
{ data, title?, xAxisTitle?, yAxisTitle?, startY?, chartH? }
```
| 字段 | 约束 |
|------|------|
| data | 第 1 项必须是 X 轴：{ name: 'X', values: [..] }；后续每项是一个系列 { name, values: [..] }（与 X 长度配对） |

价值-可行性精确矩阵、客户细分、相关性分析；> 6 个点时用 scatter，精确表达每个对象位置。

### H05 addChartBubble — 气泡图
```
{ data, title?, xAxisTitle?, yAxisTitle?, startY?, chartH? }
```
| 字段 | 约束 |
|------|------|
| data | 第 1 项 X 轴 { name, values: [..] }；后续每个系列 { name, values: [Y..], sizes: [大小..] }；sizes 与 values 等长 |

三维数据可视化（X / Y / 气泡大小）；常用于"价值 × 可行性 × 投资额"评估。

### H06 addKeywordHighlight — 关键词高亮段落（文字 highlight + outline）
```
{ text: [{ content, highlight?, outline?, bold?, italic?, underline?, color? }, ...], title?, startY?, fontSize?, align?, paragraphHeight? }
```
| 字段 | 约束 |
|------|------|
| text[].highlight | 文字背景高亮 hex，如 `'FFFF00'` |
| text[].outline | 文字描边 `{ color: hex, size: 1 }` |

适合金句强调（关键动词加黄色高亮）、术语解释（专有名词加描边）、警示文本（红色描边）。

### H07 addLinkList — 超链接列表（文字 hyperlink）
```
{ items: [{ title, url?, slide?, desc? }, ...], title?, startY?, listHeight? }
```
| 字段 | 约束 |
|------|------|
| items[].url | 外部 URL |
| items[].slide | 内部 slide 编号（从 1 开始），优先于 url |

资源/参考链接清单、附录索引、内部页面导航。

### H08 addCalloutAnnotation — 标注气泡
```
{ callouts: [{ x, y, w, h, text, color?, tipX?, tipY? }, ...], title?, startY? }
```
| 字段 | 约束 |
|------|------|
| callouts | 2-4 项 |
| tipX/tipY | 指引线终点（可选），提供后会画一条线指向该点 |

截图/UI/流程节点标注；不建议 > 5 个标注。

### H09 addCloudConcept — 云形概念
```
{ clouds: [{ keyword, desc? }, ...], title?, startY? }
```
| 字段 | 约束 |
|------|------|
| clouds | 3-5 朵 |

未来趋势、灵感发散、关键词云。

### H10 addHexagonHive — 六边形蜂窝
```
{ items: [{ title, desc? }, ...], title?, layout?, startY? }
```
| 字段 | 约束 |
|------|------|
| items | 4-6 项 |
| layout | "cluster"（默认 2 行错位）\| "line"（横向单排） |

核心能力图谱、生态系统、技术栈分层（非顺序）。

### H11 addBracketGroup — 大括号分组
```
{ items: [...], summary, summaryDesc?, title?, direction?, startY? }
```
| 字段 | 约束 |
|------|------|
| items | 左侧 3-6 项（字符串或 { title, desc }） |
| summary | 右侧汇总词，warn≤12字 |
| direction | "rightSummary"（默认）\| "leftSummary" |

多因子归一、一对多映射；"多个症状→一个根因"或"一个核心→多个支柱"。

### H12 addCubeStack — 3D 立方堆叠
```
{ layers: [{ title, desc? }, ...], title?, startY? }
```
| 字段 | 约束 |
|------|------|
| layers | 3-5 层，**由下到上排列**（数组 [0] 在最底层） |
| layers[].title | 层级名称，warn≤8字 |

技术栈分层、资产分类、数据架构。区别 layeredList：cubeStack 有立体感、视觉冲击。
