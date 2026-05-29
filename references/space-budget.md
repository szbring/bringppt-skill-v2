# 空间预算与版式高度参考

> 从 SKILL.md Rule 11/12 拆出。多版式叠加时阅读本文件做空间预算。

## 基本公式

```
可用高度 = 安全底边(4.8") − 首个版式 startY(≈0.9") ≈ 3.9"
有 engagementQuestion 时 ≈ 3.65"
```

## 各版式典型高度

| 版式 | 典型高度 | 说明 |
|------|----------|------|
| comparison (3项) | 1.8-2.0" | 含 bottomText |
| comparison (4项) | 2.2-2.5" | 含 bottomText，接近单页极限 |
| twoColumnCards | 1.5-2.5" | 取决于 content 长度，长文本可达 2.5" |
| styledTable (4行) | 1.7-2.2" | 含 summary（v3.1.1行高优化） |
| styledTable (5行) | 2.0-2.7" | 含 summary |
| iconList (3项) | 2.0-2.5" | — |
| iconList (4项) | 2.5-3.2" | 接近单页极限 |
| stepList (3-5项) | 2.0-3.0" | 含 summary |
| dataHighlight (2项) | 1.5-1.9" | 含desc时高度增加 |
| dataHighlight (3项) | 1.5-2.0" | 含desc时高度增加 |
| dataHighlight (4项) | 1.2-1.5" | 不含desc，大字数据 |
| quoteBanner (无author) | 0.8" | 单行引言，支持 h 参数覆盖 |
| quoteBanner (含author) | 1.4" | 含署名，支持 h 参数覆盖 |
| staircase (5级) | 2.0-3.5" | 支持 h 参数限制高度 |
| caseBox | 0.7-1.0" | 取决于 content 长度 |
| layeredList (3层) | 2.0-2.5" | 含 summary |

## 安全组合规则

- 单页最多叠加 **2个** B 类版式（推荐）
- 叠加 3个 B 类版式时，总预估高度必须 ≤3.5"，且每个版式内容必须精简
- 预估总高度 > 可用高度时，**必须换版式或拆分**，禁止硬塞
- quoteBanner/caseBox 作为"附加组件"不计入主版式数量，但必须计入高度预算

## 预算计算示例

```
❌ comparison(3项,1.9") + caseBox(0.9") + quoteBanner(0.6") = 3.4" → 勉强可行但风险高
✅ twoColumnCards(1.8") + quoteBanner(0.6") = 2.4" → 安全
✅ comparison(3项,1.9") + quoteBanner(0.6") = 2.5" → 安全
```

## 版式选择必须匹配内容量（Rule 12 细则）

- twoColumnCards 的 content 超过 60 字时，卡片高度会显著增加，需预留更多空间
- comparison 超过 3 项时，不应再叠加其他 B 类版式
- dataHighlight 的大字数据需要与上方版式保持 ≥0.5" 间距，否则视觉上会重叠
- **dataHighlight 与 engagementQuestion 冲突**：dataHighlight 含 desc 字段时总高度约 2.25"，从 startY=3.2 开始会延伸到 5.45"，超出有 engagementQuestion 时的安全底边 4.55"。
  - **解决方案**：①移除 desc 字段，只保留 number+label(+unit)，高度降至 1.5"；②将 engagementQuestion 改为 sourceRef；③提高 startY 至 3.8 以上
- 当一页内容量大（如对比+案例+金句），优先考虑将案例/金句移到 页面正文 中，或使用 engagementQuestion 替代独立 caseBox
