# BRINGPPT 子代理 Prompt 约束

用于让子代理生成 `slides-data.json`。本 skill 已移除每页 PPT 备注，且不包含外部发送逻辑。

## 必须遵守

1. 输出 JSON 数据结构，不输出可执行 `slides-data.js`。
2. 不生成 `notes` 字段，不写 speaker notes / PPT 备注。
3. 页面数量、标题和正文必须忠实于源文档；不得凭空新增页面或事实。
4. 版式无法承载内容时，优先换更高容量版式、组合版式或拆分页面，不得把正文移入 notes。
5. 每个 layout 的字段名必须与 `docs/bring-templates.md` 完全一致。
6. 生成后必须运行：

```bash
npm run validate:all -- _temp/slides-data.json
```

## 高频字段错误

- comparison 使用 `left.items` / `right.items`，不是 `bullets`。
- twoColumnCards 使用 `cards[].content` 字符串，不是数组。
- stepList / layeredList / iconList 的描述字段使用 `desc`。
- threeColumn 只能用于 3 个卡片；2 个并列概念优先使用 twoColumnCards。

## 空间规则

- 同页多个 B 类版式必须先做空间预算。
- 文字超框时按顺序处理：扩大文本框 → 缩小字体 → 拆分页面。
- 不得为了适应版式直接删除源文档信息。
