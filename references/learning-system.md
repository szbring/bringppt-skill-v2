# 自学习系统说明

> 从 SKILL.md 拆出。当需要调试学习数据、查看陷阱命中或排查重复踩坑时阅读。

BRINGPPT 会从每次生成中学习，持续提升质量。随 skill 打包的是默认学习数据；运行态写入 `BRINGPPT_LEARNING_DIR` 或 `~/.bringppt/learning`。

## 生成前（读取学习数据）

1. 读取 `~/.bringppt/learning/templates/*.json`（runtime-first，缺失时回退 skill 内置默认值）→ 注入子代理 Prompt 的"已知陷阱清单"
2. 读取 `~/.bringppt/learning/user/preferences.json` → 调整模板选择偏好
3. 读取 `~/.bringppt/learning/global/generation-stats.json` → 对低使用率模板增加权重
4. `bring-core.js` 自动加载 `~/.bringppt/learning/global/smartfit-calibration.json` 校准字符宽度

## 生成后（QA 环节记录）

```bash
# 更新生成统计（pipeline 成功后会自动调用）
node record-learning.js --stats slides-data.json

# 记录 QA 发现的错误模式
node record-learning.js --error '{"errorType":"text_overflow","template":"twoColumnCards","condition":"content含3个换行符","fix":"精简到2个换行符"}'

# 记录 SmartFit 校准（文字溢出时）
node record-learning.js --calibrate '{"template":"quoteBanner","text":"48字文本","boxW":8.5,"boxH":0.6,"calculatedFontSize":17,"adjustedFontSize":14}'
```

## 用户反馈时

```bash
# 记录模板修正
node record-learning.js --preference '{"correction":{"original":"stepList","correctedTo":"iconList","reason":"非流程内容"}}'

# 查看学习摘要
node record-learning.js --summary
```

## 校准机制

- SmartFit 字符宽度乘数初始值：CJK=1.0, ASCII=0.55
- 溢出记录 ≥5 条时自动微调（CJK+0.02, ASCII+0.01）
- `bring-core.js` 启动时自动加载校准后的乘数

## 周期性自检

```bash
node weekly-checkup.js              # 正式执行（产周报）
node weekly-checkup.js --dry-run    # 只预览，不改任何东西
node weekly-checkup.js --silent     # 正式执行但不打印控制台（CI 用）
```

周报输出位置：运行态学习目录下的 `global/weekly-reports/YYYY-Www.md` 与 `YYYY-Www.json`（数据快照）。

周报包含 7 节：

1. 本周关键指标（AI 调用次数 / 重复踩坑次数 / 本周新增陷阱 / open 陷阱总数）
2. 学习效果（本周顽固陷阱 Top 5）
3. 模板健康（陷阱状态分布 + QA 通过率 < 90% 的模板）
4. 本周新发现的陷阱（相对上周 JSON 基准对比）
5. 本周自动清理动作（合并/归档数字）
6. 建议动作清单（分 🔴HIGH / 🟡MEDIUM / 🔵LOW / INFO）
7. 用户偏好快照

## 闸门机制

- **闸门 1**：`gen_ppt_template.js` 强制调用 `learning-context`；失败则 `exit 3`（除非 `--skip-learning`）
- **闸门 1b**：`ppt-pipeline.js` 在 storyboard 转换前调用 `learning-context` 并记录访问；失败则拒绝生成（除非 `--skip-learning`）
- **闸门 2**：`validate-slides.js --strict-learning` 命中已知陷阱时 `exit 2`，让 CI 中断
- 设计目标：让"系统是否学到东西"这件事可观测、可拦截


## 运行态数据目录（v3.3.0）

学习数据默认不写回 skill 包内，而写入 `~/.bringppt/learning`。可设置 `BRINGPPT_LEARNING_DIR=/path/to/project-learning` 实现项目隔离；可设置 `BRINGPPT_LEARNING_DISABLED=1` 禁用写入，仅读取随 skill 打包的默认学习数据。
