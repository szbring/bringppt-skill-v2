# BRINGPPT 协作与升级流程

> 从 CHANGELOG.md 抽出。本文件描述如何安全地修改与发布 SKILL；具体版本变更内容仍记录在 CHANGELOG.md。

## 升级流程

1. **明确需求** — 用户/QA 提出修改点，或审查报告标出问题
2. **新建 Git 分支** — 不再靠复制目录备份；必要时用 tag 回滚
3. **修改 + 测试**
   - `npm run lint`：本地 lint 必须通过
   - `npm run test`：基线必须不退化（页数一致，且无高危 warning）
   - `npm run test:full`：跨模块全量验证
   - `npm run validate -- <数据文件>`：内容/视觉双重检查
4. **用户确认** — 影响视觉的改动需用户验收
5. **更新版本号**
   - `npm run bump -- <new-version>` 更新 `package.json`、`package-lock.json`、`SKILL.md`、`README.md`
   - `CHANGELOG.md` 顶部新增对应章节
6. **发布前检查**
   - `npm run release:check -- --allow-dirty --skip-tag`：本地改动中诊断
   - 提交后运行 `npm run release:check`，确保 tag 指向 HEAD
7. **更新基线**（如新增/删除测试）：`npm run test:update`

## 加新模板的步骤

1. 在 `templates/` 下新建 `xxx-yyy.js`，遵循 `docs/TEMPLATE-SPEC.md` 的字段规范
2. 添加 `name` / `version` / `category` / `description` / `schema` / `render` / `usage.scenarios` 等必填字段
3. **不需要** 修改任何 dispatcher — B 类由 `lib/layout-map.js` 自动分发；A 类设置 `isPageTemplate: true` 后由 `lib/page-template-map.js` 自动分发
4. 在 `docs/bring-templates.md` 补充 API 文档
5. 在 `tests/` 中补一个可进入 baseline 的示例页
6. 运行 `npm run test` 和 `npm run test:full` 验证三层稳定性机制正确处理

## 文件锁定（可选）

如需防止他人误改 skill 文件：

- macOS / Linux：`chmod -w *.js`（解锁 `chmod +w *.js`）
- Windows：右键 → 属性 → 只读

不强制要求；优先依赖 git 提交评审来保证质量。

## 发布到分发渠道

- **本地复制**：将整个 `bringppt/` 目录复制到 `~/.claude/skills/`，运行 `npm install`
- **.skill 打包**：见 `README.md`
