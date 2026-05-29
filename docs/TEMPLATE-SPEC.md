# BRINGPPT 模板接入规范 v1.0

> 每个新模板必须满足以下规范才能加入模板库。
> 来源：2026-04-20 自学习系统优化

---

## 必填字段清单

```javascript
module.exports = {
  name:        'camelCaseName',    // 必填：registry 唯一键
  version:     '1.0.0',            // 必填
  category:    '类别名',           // 必填：用于分组显示
  description: '一句话描述',       // 必填：≤50字

  schema: {
    fieldName: {
      type:        'string|number|array|boolean',
      required:    true,           // 必填字段明确标注
      description: '字段用途说明',
    },
  },

  usage: {
    when:    '适用场景描述',        // 必填：什么时候用这个模板
    notWhen: '不适用场景',          // 必填：什么时候不要用
    typicalHeight: '约 X.X 英寸',  // 建议填写

    // ⭐ 必填：scenarios 字段（AI 选模板的核心依据）
    scenarios: [
      {
        trigger: '用户说... / 内容特征关键词',  // 触发条件
        example: '具体用法说明（含示例数据）',   // 如何使用
      },
      // 建议 2-4 个 scenarios，覆盖不同典型使用场景
    ],
  },

  // ⭐ 必填：selfLearning（自学习数据接口）
  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/<name>.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  render(pres, slide, data, infra) {
    // 渲染逻辑
    // 末尾必须调用 validateBounds(slide, bottomY, 'templateName')
  },
};
```

---

## scenarios 编写规范

### ✅ 好的 scenarios
```javascript
scenarios: [
  {
    trigger: "5M1E根因分析（人机料法环管）",
    example: "为什么交货延误？鱼骨图展示6个维度的根因，比causalChain更适合多维发散分析"
  },
  {
    trigger: "质量问题、故障原因分析",
    example: "产品不良率高的原因：设备/原料/工艺/人员多角度分析，每个维度3-5个原因"
  },
]
```

### ❌ 不好的 scenarios
```javascript
scenarios: [
  {
    trigger: "需要分析",        // ❌ 太模糊
    example: "用于分析场景"     // ❌ 没有具体说明
  },
]
```

### 编写要点
1. **trigger** 应该是 AI 在读用户需求时能匹配到的关键词或情境
2. **example** 应该有具体的数据/主题示例，让 AI 知道怎么用
3. 最少2个，最多4个 scenarios
4. 其中至少有1个说明"与相似模板的区别"（如"比 X 更适合...时"）

---

## validate-slides.js 接入

新模板需要在 `validate-slides.js` 中添加：

### 1. REQUIRED_LAYOUT_FIELDS
```javascript
myNewTemplate: ["requiredField1", "requiredField2"],
```

### 2. CHAR_LIMITS（如有字符限制）
```javascript
myNewTemplate: {
  "field1": { warn: 20, error: 35 },
  "items[].title": { warn: 15, error: 25 },
},
```

### 3. ITEMS（如有数组长度限制）
```javascript
myNewTemplate: { field: "items", warnMin: 3, warnMax: 6, errorMin: 2, errorMax: 8 },
```

---

## bring-templates.md 接入

在 `bring-templates.md` 中按分类加入模板文档：

```markdown
### XY addMyTemplate — 模板名称
\`\`\`
{ field1, field2[], startY? }
\`\`\`
| 字段 | 约束 |
|------|------|
| field1 | 说明，warn≤X字, error≤Y字 |
| field2 | string[]，数组长度2-6 |

一句话用途说明。与同类模板的区别说明。
```

---

## 分发接入

不要手工修改 dispatcher。新增 B 类布局模板后，`lib/layout-map.js` 会从 registry 自动生成分发；新增 A 类页面模板后，设置 `isPageTemplate: true`，`lib/page-template-map.js` 会自动分发。

---

## 接入验证清单

- [ ] `registry.js` 自动加载（文件放在 templates/ 目录即可）
- [ ] `validate-slides.js` 加入字段约束
- [ ] `bring-templates.md` 文档更新
- [ ] A/B 类分类正确：页面模板设置 `isPageTemplate: true`，布局模板不设置
- [ ] `usage.scenarios` 字段已填写（≥2个）
- [ ] `selfLearning` getter 已实现
- [ ] 生成一个测试 PPT 验证渲染无报错
- [ ] `fromKeyPoints(keyPoints, page)` 适配器已实现（v3.7.11+ 要求）
- [ ] 大字号文字通过 `calcFitFontSize` 自适应宽高（v3.7.13+ 要求）
- [ ] 内部高度计算在 `maxBottom 4.8"` 安全底边内（v3.7.13+ 验证：跑 `node scripts/build-all-templates-demo.js` 看 `Layout overflow` warning）
- [ ] 跑 `npm run lint:zorder` 检查 z-order 没问题

---

## z-order（图层顺序）规范 — v3.7.13 新增

pptxgenjs 的 `slide.addShape / addText` 调用顺序就是渲染图层顺序：**后调用的盖在前调用的上面**。

### 原则

对**单个视觉组**（如一对 "卡片 + 连接到下一张卡片的箭头"），必须按以下顺序：

```
1. 背景装饰（线条 / 箭头）—— 让它作为底层
2. 卡片 / 形状（RECTANGLE / OVAL / DIAMOND）
3. 文字（addText）—— 永远最上层
```

### 反模式（会导致线被卡片遮挡）

```js
// ❌ 错误：先画两个卡片，再画连线，线穿过卡片中间会被卡片盖
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1, y: 1, w: 2, h: 1, fill: { color: C.PRIMARY } });
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5, y: 1, w: 2, h: 1, fill: { color: C.PRIMARY } });
slide.addShape(pres.shapes.LINE, { x: 3, y: 1.5, w: 2, h: 0, line: { color: C.BORDER, width: 1 } });
// 线条 (3,1.5) → (5,1.5) 中段被第二个卡片 (5,1) → (7,2) 盖住
```

### 正确模式

```js
// ✓ 正确：先画连线，再画卡片
slide.addShape(pres.shapes.LINE, { ... });
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { ... });
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { ... });
```

### 例外（链式结构）

如果连线两端都连卡片，且**线两端不会穿过任何其他卡片**（即"卡A → 线 → 卡B"，线段不重叠其他卡），按 A → 线 → B 顺序写没问题。

`scripts/scan-zorder.js`（`npm run lint:zorder`）会扫描所有模板，识别"第一个卡片之后才画线/箭头"的情况，作为人工 review 起点——并非所有命中都需要修，但都应该 review。
