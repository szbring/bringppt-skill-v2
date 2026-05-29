# BRINGPPT 移交文档（HANDOVER）

> v3.7.39 · 薄云咨询 PPT 生成 Skill · 交接给下一位维护者

本文档是接手 bringppt 后第一份要读的文档。读完它，你应该能：

1. 理解整体架构与数据流；
2. 自己跑通一遍 pipeline；
3. 在不破坏已有 PPT 的前提下新增/修改一个模板；
4. 知道质量门禁怎么用、出 bug 时从哪里查。

---

## 一、架构总览

### 1.1 一句话定位

bringppt 不是"PPT 单页设计器"，而是 **"批量 PPT 生成器 + 模板库 + 质量门禁"**。
输入是 storyboard（分镜脚本 JSON），输出是符合薄云品牌的 .pptx。

```
                            ┌─────────────────┐
markdown / outline ────▶    │ outline-to-      │
                            │ storyboard       │
                            └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
storyboard.json ───────▶    │ storyboard-      │ ──┐
                            │ converter        │   │ uses
                            └─────────────────┘   ▼
                                     │       ┌──────────────┐
                                     │       │ template-    │
                                     │       │ selector     │
                                     │       └──────────────┘
                                     │              │
                                     ▼              ▼
                            ┌─────────────────┐ ┌────────────┐
slides-data.json ──────▶    │ bring-core       │ │ registry   │
                            │ (renderer)       │◀│ 104 模板   │
                            └─────────────────┘ └────────────┘
                                     │
                                     ▼
                              output.pptx
```

### 1.2 关键模块（按调用顺序）

| 模块 | 文件 | 职责 |
|---|---|---|
| **outline 转换器** | `scripts/outline-to-storyboard.js` | markdown 大纲 → storyboard.json（可选） |
| **pipeline 入口** | `ppt-pipeline.js` | 总编排：读 storyboard → 转 slides-data → 调 renderer → 写 .pptx |
| **storyboard 转换器** | `storyboard-converter.js` | 每页选择最适合的版式 + 构造 layout data |
| **三层 selector** | `template-selector.js` | L1 notWhen 排除 / L2 schema 校验 / L3 trap 学习 |
| **模板注册表** | `registry.js` | 自动加载 `templates/*.js`，提供按 name 查询 |
| **渲染器** | `bring-core.js` + `gen_ppt_template.js` | 调 pptxgenjs，把 slide-data 渲染成 .pptx |
| **共享基础设施** | `lib/` | colors / fonts / shapes / adapter-helpers / keypoints-helpers |
| **模板库** | `templates/*.js` | 104 个模板，每个 = schema + usage + fromKeyPoints + render |

### 1.3 数据流的三种 JSON

| 类型 | 谁写 | 长什么样 | 作用 |
|---|---|---|---|
| **storyboard.json** | 内容作者 / outline 转换器 | `{ meta, sections: [{ sectionTitle, pages: [{ title, keyPoints, suggestedLayout? }] }] }` | 分镜：每章有哪些页、每页核心要点 |
| **slides-data.json** | storyboard-converter 自动生成 | `{ meta, slides: [{ id, type, title, layouts: [{ type, data }] }] }` | 渲染前的"机器可读 PPT"，含已选定版式与字段 |
| **学习态 json** | 运行时 record-learning 写入 | `learning/templates/<name>.json` | 错误模式 / 修正记录，喂给 L3 trap |

**核心约定：storyboard.json 是源代码，.pptx 是产物。** 永远只在 storyboard 上手写，不要直接改 .pptx。

---

## 二、如何新增一个模板（实操指南）

最高频的维护任务。按下面 5 步走，约 30-60 分钟可以加一个新模板。

### 2.1 用脚手架创建文件

```bash
node scripts/new-template.js myAwesomeLayout
```

会自动生成 `templates/my-awesome-layout.js`，含完整骨架。

### 2.2 写模块元信息（schema / usage）

```js
module.exports = {
  name:        'myAwesomeLayout',        // 必须与文件名 camelCase 对应
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '一句话说明：这个模板长什么样、解决什么问题',

  schema: {
    title:  { type: 'string', required: true, warn: 15, error: 25 },
    items:  { type: 'array', min: 3, max: 6, required: true,
              item: { title: { type: 'string', warn: 10, error: 18 },
                      desc:  { type: 'string', warn: 30, error: 50 } } },
  },

  usage: {
    when:    '主结论 + 3-6 个并列要点',      // L2 selector 会展示
    notWhen: '维度超过 6 个；只有 1-2 项',   // ⚠️ L1 selector 会解析这里的 "超过 N"
    typicalHeight: '3.5"',
    scenarios: [
      { trigger: '什么时候选这个版式', example: '"举一个真实例子"' },
    ],
  },
```

**⚠️ 三个高频坑：**

1. `usage.notWhen` 字符串里的 **"超过 N 个"**会被 selector 解析为 `max: N` 规则，直接影响版式选择。曾因 mece-layout 写"超过 4 个"被自动跳过（v3.7.39 修）。改 `schema.items.max` 时必须同步改 notWhen。
2. `schema.items.max` 与 `template-selector.js` 顶部的 `CAPACITY_LIMITS` 两处都要同步，否则 storyboard 转换会抛错。
3. `description` 不要太宽泛——L1 selector 用它做语义匹配。

### 2.3 写 fromKeyPoints 适配器

storyboard 的 `keyPoints` 是字符串数组，模板要从中构造 schema 数据：

```js
fromKeyPoints(keyPoints, page) {
  const { mapKpsToItems } = require('../lib/adapter-helpers');
  return {
    title: (page && page.title) || '默认标题',
    items: mapKpsToItems(keyPoints, {
      max: 6,
      descMinLen: 15,   // < 15 字会自动 padShortDesc 补齐，避免 schema 校验 warn
    }),
  };
}
```

`lib/adapter-helpers.js` 有 `mapKpsToItems / mapKps / bisectKps / extractNumber / padShortDesc` 几个高频工具，**强烈优先用这些而不是自己写解析**——能蹭到统一的修正逻辑。

### 2.4 写 render

`render(pres, slide, data, infra)` 是核心。`infra` 是渲染基础设施容器，给你 `C` (色板) / `FONTS` / `STEP_COLORS` / `shadow()` / `resolveStartY()` / `validateBounds()` 等。

```js
render(pres, slide, data, infra) {
  const { C, FONTS, STEP_COLORS, shadow, resolveStartY } = infra;
  const { title, items = [], startY } = data;
  const sy = resolveStartY(slide, startY, 1.3);
  // 用 slide.addShape / slide.addText 绘制
}
```

**布局边界约定（10" × 5.63" 16:9）：**

- y < 1.0：留给 contentSlide 页头
- y > 5.2：留给母版 footer（BRING logo + 页码）
- 内容区典型：1.3 ~ 4.8（高度 3.5"）

**字号约定**：`FONTS.primary` (Microsoft YaHei 中文) / `FONTS.numeric` (Calibri 数字) / `FONTS.enSmall` (英文小字)。永远从 `FONTS.*` 取，不要硬编码。

### 2.5 跑测试

```bash
npm run validate -- _temp/test.json    # 模板 schema + visual 校验
npm test                                 # baseline + visual hash
npm run test:contract                   # 契约测试（fromKeyPoints 完整性）
npm run test:visual:88                  # 88 模板视觉回归
```

**新模板必须过 contract + visual。** baseline.json 第一次跑用 `npm run test:visual:88 -- --update` 写一次基线哈希。

---

## 三、六层质量门禁清单

按"触发时机 / 命令 / 失败信号 / 排查方式"四列对照。

| # | 层 | 触发 | 命令 | 失败信号 | 排查 |
|---|---|---|---|---|---|
| 1 | **schema 严格化** | storyboard → slides-data | `node validate-slides.js` | `iconList desc length < 15` 类报错 | 检查模板 schema 与 fromKeyPoints adapter |
| 2 | **契约测试** | CI / release:check | `npm run test:contract` | `fromKeyPoints missing` / `selfLearning getter throws` | 该模板没写 fromKeyPoints，或 selflearning 路径错 |
| 3 | **视觉回归** | release:check | `npm run test:visual:88` | dHash 距离 > 阈值 | 模板渲染输出变了：要么改回去，要么 `--update` 接受新基线 |
| 4 | **跨页一致性** | pipeline 末尾 | `node check-consistency.js` | 同一项目两页色板/字号不同 | 模板硬编码了颜色而不走 `C.*` |
| 5 | **grounding check** | LLM 流程接入时 | `learning-context.js` | 渲染出的文本不在 source 里 | LLM 产生幻觉，回归 storyboard.keyPoints |
| 6 | **post-render text** | pptxgenjs 输出后 | `validate-slides.js` 内嵌 | 文本框空 / 越界 | y > 5.2 撞 footer / w 超 10 / h 为 0 |

**一键全量验收**：

```bash
npm run release:check
```

它会顺序跑 1/2/3 + version sanity + git status，全过才允许打 tag。

**学习态周报**：

```bash
npm run learning:report -- --triage
```

会汇总最近 N 次生成里"哪个模板出错最多 / 哪条 trap 该提升为硬校验"。

---

## 四、近期 release notes（v3.7.0 → v3.7.39）

v3.7.x 是从"功能完整但视觉粗糙"走向"顶咨级视觉 + 契约稳定"的迭代区间。挑关键节点：

### v3.7.0-v3.7.9 — 基础完善
- **v3.7.0** 收尾金句页 closingQuote + 两页式封底（金句页 + thank-you 页）
- **v3.7.6** 把 P0/P1 全部诊断问题清零，schema 强一致
- **v3.7.7** 视觉哈希三次取中位数（去抖动）；trap 衰减 bug 修复

### v3.7.10-v3.7.19 — 89/89 fromKeyPoints 覆盖
- **v3.7.10** 给所有 89 个模板补齐 `fromKeyPoints` 适配器
- **v3.7.15** closingQuote 去掉包裹的英文双引号（用户反馈）
- **v3.7.16** 金句页去掉左侧巨型引号装饰（用户反馈）
- **v3.7.19** tocPage classic 风格上线（仿 01 P6，左编号列表 + 右建筑图）

### v3.7.20-v3.7.29 — 88 模板视觉回归
- **v3.7.26** adapter-helpers.mapKpsToItems 批量重构 ~70 模板
- 88 模板全部上视觉回归基线
- styledTable 自动拆页 / dynamicRowH
- dataHighlight 大字字体自适应
- 连线模板 z-order 规范统一

### v3.7.30-v3.7.37 — 顶咨级精修 + 5 hero 明星模板
- **v3.7.35** 路径 1：精修 8 个高曝光模板视觉细节（titleBlue / subtleShadow / accent line）
- **v3.7.36** 路径 2：上 5 个 hero 明星模板（heroCover / heroSection / heroStat / heroQuote / heroClosing）
- 去掉每页标题下短横线（用户反馈）
- 删除 caseDivider / fullQuote 模板
- SKILL.md description 结构化触发条件（▸触发场景 / ▸不应触发）
- **v3.7.37** 打包 release（104 模板 = 8 A 类 + 96 B 类，含 13 顶咨级版式）

### v3.7.38 — SharePoint PRD 10 个视觉问题修复
- closingQuote 移除底部短线 + backCover 补金色短线
- heroClosing 移除底部 contact / 短线
- sectionSlide 移除短线 + MODULE NN 英文标签 + 水印缩到 96pt
- heroSection 章节号 220→160 避免竖排
- cardGrid 标题与色带间距加宽
- meceLayout 总高 3.4→3.7 + desc 占满
- heroStat 文字居中
- tocPage classic 自适应密度档（≤4 / 5-6 / 7-10），一页内展示所有目录
- storyboard-converter：用户提供 section/heroSection 时不再叠加自动生成

### v3.7.39 — meceLayout 6 项 + cardGrid 同步下移
- **meceLayout 支持 3-6 项**：schema/notWhen 同步从 4 改 6；selector L1 不再误排除
- **meceLayout 动态字号**：3-4 项 14pt / 5 项 13pt / 6 项 12pt
- **cardGrid 黑字同步**：descTop 改为 titleTop + titleH + 0.04，蓝字下移黑字也跟着移
- **cardGrid 溢出自动缩**：title 14→12→11 / desc 10→9→8.5，按 cardW × 长度估算

完整逐版本 changelog 见 `CHANGELOG.md`。

---

## 五、入坑后的高频路径

### 5.1 "客户说某一页有问题"
1. 拿到对应 storyboard.json
2. `node ppt-pipeline.js --input storyboard.json --output _temp/x.pptx` 复现
3. 找到那一页的 layout type（在 slides-data 里能看到）
4. 改对应的 `templates/<layout>.js` 的 render
5. 改完跑 `npm run test:visual:88` 看其他模板有没有连带回归
6. `npm run release:check` 通过 → 升 version → commit + tag

### 5.2 "客户说要加一个新章节风格"
1. 先想清楚是新增模板 vs 改现有模板。原则：能复用就改 schema/usage，能差异化才新增。
2. 新增走 §二，改现有改完跑 §三 #3 视觉回归。

### 5.3 "selector 老选错版式"
1. 加 `--verbose` 跑 pipeline，看 `[selector]` 输出里 skippedLogs
2. 三个常见原因：
   - L1: `notWhen` 里 "超过 N 个" 被解析为 max N，N 不对
   - L2: schema 校验失败（item 字段缺 / 长度超）
   - L3: trap 学习到了"避坑模式"，去 `learning/templates/<name>.json` 看 errorPatterns
3. 改完 `npm run promote:traps` 重新评估稳定 trap

### 5.4 "渲染出来的 PPT 文字飘出去了"
99% 是模板里的 x/y/w/h 算错。布局边界见 §2.4。`infra.validateBounds(slide, maxY)` 加上后能自动告警。

---

## 六、目录速查

```
bringppt/
├── SKILL.md              ← 给 Claude 看的入口（触发条件 / 工作流 / 何时用本 skill）
├── README.md             ← 安装、调用与打包说明
├── CHANGELOG.md          ← 逐版本变更记录
├── package.json          ← v3.7.39，scripts 集成了所有验收命令
│
├── bring-core.js         ← pptx 渲染入口，被 ppt-pipeline 调用
├── ppt-pipeline.js       ← CLI 入口：storyboard → pptx
├── storyboard-converter.js ← storyboard → slides-data
├── template-selector.js  ← 三层稳定性 selector（L1/L2/L3）
├── registry.js           ← 自动加载 templates/*
├── validate-slides.js    ← 渲染前 schema + 渲染后 post-text 校验
├── learning-context.js   ← 学习态读写 / triage
├── record-learning.js    ← 写入 errorPatterns
├── check-consistency.js  ← 跨页一致性校验
│
├── templates/            ← 104 个模板（每个 = schema + usage + fromKeyPoints + render）
├── lib/                  ← 共享基础设施（colors / fonts / shapes / helpers）
├── scripts/              ← 全套维护脚本（new-template / lint / bump / promote-traps...）
├── learning/             ← 学习态（每模板一个 json，存 errorPatterns + corrections）
├── tests/                ← baseline / visual / contract / full-validate
├── docs/                 ← CONTRIBUTING / STORYBOARD-SCHEMA / TEMPLATE-SPEC / common-errors
├── assets/               ← 图片素材（cover-building.jpg 等）
└── references/           ← 参考资料（pptxgenjs 文档、范例 PDF）
```

---

## 七、接手第一周建议路径

1. **Day 1**：读完本文档 + SKILL.md + 一个简单模板（推荐 `card-grid.js`）。
2. **Day 2**：用 `_temp/sharepoint-storyboard.json` 跑一遍 pipeline，看出来的 PPT。
3. **Day 3**：故意改一个模板（比如把 heroCover 标题字号 +4），跑 `npm run test:visual:88` 看视觉回归怎么报错。
4. **Day 4**：用脚手架新增一个空模板（叫 helloWorld），按 §二跑通。
5. **Day 5**：跑 `npm run learning:report -- --triage`，理解学习数据怎么影响 selector。

接手过 5 天能独立处理客户视觉反馈基本就 OK 了。

---

如有问题，先查 `docs/common-errors.md`，再看 `CHANGELOG.md` 找最近改过的相关模块。祝交接顺利。
