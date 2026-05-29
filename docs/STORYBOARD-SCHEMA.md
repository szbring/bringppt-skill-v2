# Storyboard JSON Schema

> `npm run pipeline -- --input <storyboard.json>` 接收的输入格式。
> 注意：本文件描述的 **storyboard** 是 pipeline 的输入；`_temp/slides-data.json` 是 pipeline 内部产物（由 `storyboard-converter.js` 自动生成），两者结构完全不同，详见 `SKILL.md` "数据层规则" 节。

## 顶层结构

```json
{
  "meta": { ... },
  "chapters": [ ... ]
}
```

兼容包装格式：`{ "stage2_storyboard": { "meta": {...}, "chapters": [...] } }`（pipeline 会自动解包）。

`meta` 与 `chapters` 二者均必填，缺一即 `exit 1`。

---

## meta 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | ❌（默认"演示文稿"） | PPT 标题，用于封面/封底 |
| `titleEn` | string | ❌ | 英文副标题，注入 heroCover 的右下角小字（v4.0.0 起） |
| `subtitle` | string | ❌ | 副标题 |
| `author` | string | ❌（默认"薄云咨询"） | 作者，PPTX 文件元数据 |
| `audience` | string | ❌ | 受众标签（如"高管层"），将作为 keywords 注入封面 |
| `clientName` | string | ❌ | 客户名称，显式注入 heroCover 的"提案受方"位（v4.0.0 起；不填则回退到 `audience`） |
| `date` | string | ❌ | 提案日期，注入 heroCover（v4.0.0 起） |
| `reporter` | string | ❌（默认 `author`） | 汇报人/讲师，注入 heroCover（v4.0.0 起） |
| `coverImage` | string \| null | ❌ | heroCover 右侧大图路径；不填走默认建筑图；传 `null` 回退到抽象面板（v4.0.0 起） |
| `includeToc` | boolean | ❌（默认 false） | true 且 `chapters.length ≥ 2` 时自动生成目录页 |
| `outputPath` | string | ❌ | 输出路径；CLI `--output` 优先级更高 |
| `layout` | string | ❌（默认 `"LAYOUT_16x9"`） | `LAYOUT_16x9` / `LAYOUT_WIDE` / `LAYOUT_16x10` |
| `closingQuote` | object | ❌ | v3.7.12 起，封底默认为两页：倒数第二页是金句页。可传 `{ quote, author, source, label, labelEn }` 自定义；不传则用 `meta.subtitle` 或默认金句 |
| `disableClosingQuote` | boolean | ❌（默认 false） | 设为 true 时跳过金句页，退回单页封底（兼容老项目） |
| `backCover` | object | ❌ | 自定义封底页：`{ text, subtitle, instructor, dateLine }`；contact/qrCode 由 backCover 模板默认注入薄云联系方式 |
| `destinationFolderId` | string | ❌（默认走 BRINGPPT_DEFAULT_FOLDER_ID 或 Agent 默认 `10cQkBoa86WdwdlUSEZsebQao1wh_gz2O`） | v4.1.9 起，pipeline 生成后输出符合 OpenAPI 规格的 `upload_file_to_drive` 调用 JSON，本字段对应 `destination_folder_id`。CLI `--destination-folder-id` 优先级高于本字段 |
| `destinationFolderUrl` | string | ❌ | v4.1.9 起，对应 OpenAPI `destination_folder_url`（如 `https://drive.google.com/drive/folders/<ID>`）；插件内部解析为 folder id。仅在 `destinationFolderId` 未提供时生效 |
| `onConflict` | string | ❌（默认 `keep_both`） | v4.1.9 起，对应 OpenAPI `on_conflict`，可选值：`keep_both` / `replace` / `fail` |

---

## chapters[] 字段

每个 chapter 是一章：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `sectionTitle` | string | ✅ | 章节标题，分隔页主标题 |
| `sectionTitleEn` | string | ❌ | 章节英文小标题，显示在 heroSection 大字标题下方（v4.0.0 起） |
| `sectionNumber` | number / string | ✅ | 章节编号，进入分隔页与 id |
| `sectionSubtitle` | string | ❌ | 分隔页副标题 |
| `accent` | string | ❌ | 章节强调色（如 `"#C8102E"`），用于 heroSection 的章节号着色（v4.0.0 起；不填走默认 BRAND.PRIMARY） |
| `pages` | array | ✅ | 该章节内的页面列表（见下） |

---

## chapters[].pages[] 字段

每个 page 描述一张内容页：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ❌ | 页面唯一 id（未给则自动 `slide-N`） |
| `title` | string | ✅（除 `fullQuote`） | 内容页大标题 |
| `type` | string | ❌（默认 `"content"`） | 见下表"特殊 type" |
| `keyPoints` | string[] | ✅（type=content 时） | 该页核心要点；转换器会按要点条数自动选版式 |
| `suggestedLayout` | string | ❌ | 给三层稳定性机制的初选提示（如 `"stepList"`、`"twoColumnCards"`），会被 schema 校验和 trap 检测覆盖 |
| `contentType` / `sceneType` | string | ❌ | 内容/场景分类（`data` / `process` / `comparison` / `concept` / `case` / `action` …），用于 fallback 链 |

### 特殊 page.type

| type | 用途 | 关键额外字段 |
|---|---|---|
| `content` | 默认；内容页+B类版式自动装配 | `keyPoints[]` |
| `fullQuote` | 整页大字引言 | `quote`、`author` |
| `caseDivider` | 案例分割页 | `caseTitle` |
| `heroCover` | 整页大字封面（v4.0.0 起取代 `cover`） | `title`、`titleEn`、`subtitle`、`clientName`、`date`、`reporter`、`image` |
| `heroSection` | 整页章节首页（v4.0.0 起取代 `section`） | `sectionNumber`、`sectionTitle`、`sectionTitleEn`、`sectionSubtitle`、`accent` |
| `freeform` | 逃生舱：直出 pptxgenjs 代码（v4.0.0 起） | `renderCode`（字符串）、`data`、`fallback`（推荐）；详见下方"逃生舱用法" |

> **向后兼容**：仍可用旧版 `type:'cover'` / `type:'section'`，converter 会自动重映射到 hero 版。

### 逃生舱：`type:'freeform'` 用法（v4.0.0 起）

适用场景：现有 ~80 个模板都不合适、需要一次性自定义视觉，或子代理直接写 pptxgenjs 代码比挑模板更准确。

```json
{
  "id": "p-freeform",
  "type": "content",
  "title": "自定义视觉",
  "layouts": [{
    "type": "freeform",
    "data": {
      "renderCode": "slide.addText('自定义画法', { x:1, y:2, w:8, h:1, fontSize:36, color:infra.C.PRIMARY });",
      "fallback": { "type": "twoColumnCards", "data": { "cards": [{"title":"A","content":"兜底文案"}, {"title":"B","content":"渲染失败时显示"}] } }
    }
  }]
}
```

约束：
- `renderCode` 在沙箱中执行，**只能访问** `pres / slide / data / infra` 以及 `Math/Number/String/Array/Object/Boolean/JSON/Date/parseInt/parseFloat/isNaN/isFinite`
- **禁止访问** `require / process / global / globalThis / eval / Function / setTimeout`
- **强烈建议提供 `fallback`**：renderCode 抛错时降级到指定模板，避免页面空白
- `data` 字段会作为第 3 个参数传给 renderCode，用于存放业务数据

---

## 完整示例

### 短演讲（15 分钟，2 章）

```json
{
  "meta": {
    "title": "数字化供应链的三个杠杆",
    "author": "薄云咨询",
    "audience": "供应链高管",
    "includeToc": true
  },
  "chapters": [
    {
      "sectionTitle": "为什么现在",
      "sectionNumber": 1,
      "pages": [
        {
          "id": "p1-1",
          "title": "全球供应链承压的三个信号",
          "keyPoints": [
            "海运运价同比上涨 38%",
            "原材料交期从 14 天拉长到 42 天",
            "客户库存周转率下降 22%"
          ]
        },
        {
          "id": "p1-2",
          "title": "数字化能力差距",
          "keyPoints": [
            "数据可见性: 仅 31% 企业实现端到端追踪",
            "预测精度: AI 驱动预测准确率比传统高 18pp",
            "响应速度: 数字化企业平均响应快 2.3 倍"
          ],
          "suggestedLayout": "threeColumn"
        }
      ]
    },
    {
      "sectionTitle": "三个杠杆",
      "sectionNumber": 2,
      "pages": [
        {
          "id": "p2-1",
          "title": "杠杆一：智能预测",
          "keyPoints": ["AI 需求预测", "异常波动预警", "情景仿真"]
        },
        {
          "id": "p2-quote",
          "type": "fullQuote",
          "quote": "数字化的本质不是工具，而是把决策从经验驱动转为数据驱动。",
          "author": "麦肯锡《2024 供应链数字化报告》"
        }
      ]
    }
  ]
}
```

### caseDivider 用法

```json
{
  "id": "case-1",
  "type": "caseDivider",
  "caseTitle": "案例：某零售龙头的供应链重塑"
}
```

---

## 何时手写 slides-data.json（绕过 storyboard）

仅在你**已经完全清楚要用哪个版式 + 字段结构**时，可以跳过 storyboard 这一层，直接手写 `_temp/slides-data.json` 然后用 `node gen_ppt_template.js` 渲染。常见场景：

- 复用历史 PPT 的精确版式
- 由其他系统（API、Sheet 数据）生成

slides-data 的字段定义见 `SKILL.md` "数据层规则" 节与 `docs/bring-templates.md` 的各模板 schema。

---

## 校验

```bash
# 1. storyboard 转换 + slides-data 校验 + 生成 PPT 一条龙
npm run pipeline -- --input storyboard.json --output out.pptx --verbose

# 2. 只校验已有 slides-data（不生成 PPT）
npm run validate:all -- _temp/slides-data.json
```

错误示例与修复见 `docs/common-errors.md`。
