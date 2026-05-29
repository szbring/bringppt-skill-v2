# bringppt

`bringppt` 是面向 `Codex` 和 `ChatGPT` 的 BRING 风格 PowerPoint 生成 skill。  
它可以把已确认的大纲、报告、storyboard JSON、slides-data JSON、Word 或 Markdown，转换成可编辑的 `.pptx` 文件，并保留生成、校验、修复、打包的完整流程。

这个仓库是 `bringppt` 的主源码仓库，维护、发布和调试都以这里为准。

## 30 秒开始

从 GitHub 直接安装到 `Codex`：

```powershell
npx skills add https://github.com/szbring/bringppt-skill-v2 --skill bringppt
```

以后需要更新时，重新执行同一条安装命令即可：

```powershell
npx skills add https://github.com/szbring/bringppt-skill-v2 --skill bringppt
```

安装完成后，在 `Codex` 里直接说：

```text
使用 bringppt，把这份已确认大纲生成 BRING 风格 PPTX，并完成 QA。
```

## 适合 / 不适合

✅ 适合

- 从大纲、报告、Word、Markdown 或 storyboard 生成 PPT
- 修复、校验或重新打包已有的 BRING 风格 PPT
- 需要走仓库内的模板、管线和校验流程，而不是通用 PPT 生成方式
- 需要给 `Codex` 或 `ChatGPT` 提供一个稳定入口

❌ 不适合

- 只是做纯文本脑暴，不需要实际 PPT 文件
- 已经有成品 `.pptx`，只想临时手工改一两处文字
- 不打算走仓库内的模板和校验流程

## 常见使用场景

| 任务 | 推荐方式 |
| --- | --- |
| 大纲转 PPT | 先确认结构，再直接生成 `.pptx` |
| 报告转 PPT | 先提炼章节和页级信息，再走生成管线 |
| storyboard 转 PPT | 直接用 `ppt-pipeline.js` 生成并校验 |
| 现有 PPT 修复 | 先校验，再按错误回到模板或内容层修复 |
| 交付前检查 | 运行 `validate:all` 做结构、内容和视觉校验 |

## 为什么用这个 skill

- 输入形式统一，适合从 storyboard、报告、Word、Markdown 进入同一条生成链路
- 生成结果是可编辑的 `.pptx`，方便后续人工微调
- 生成后可以接着做校验，减少“能打开但不能交付”的情况
- 整个流程保持 repo-native，便于维护和复用

## 主要能力

- 基于仓库内的 `ppt-pipeline.js` 生成 `.pptx`
- 通过模板注册表和选择器自动挑选合适版式
- 生成后执行 `validate-slides.js` 做质量校验
- 支持修复、重跑和重新打包
- 所有生成逻辑都保持 repo-native，不依赖通用 PPT 生成器

## 如何调用

### 在 ChatGPT 里

直接说下面这类话术即可：

- `使用 bringppt，把这份已确认大纲生成 BRING 风格 PPTX，并完成 QA。`
- `使用 bringppt，把这个 storyboard 转成可交付的 PPTX。`
- `调用 bringppt 检查并修复这份 BRING 风格 PPT 的生成问题。`

如果团队已经建了 `Bring PPT` Workspace Agent，也可以用：

- `@Bring PPT 使用 bringppt skill，把这份大纲生成 BRING 风格 PPTX，并完成 validate:all。`

### 在 Codex 里
- 第一次安装，直接用 `npx skills add` 从 GitHub 安装：

```powershell
npx skills add https://github.com/szbring/bringppt-skill-v2 --skill bringppt
```

- 如果以后 GitHub 上有新版本，重新执行同一条安装命令即可刷新本地副本：

```powershell
npx skills add https://github.com/szbring/bringppt-skill-v2 --skill bringppt
```

- 安装后直接对 Codex 说：

```text
使用 bringppt，把这份已确认大纲生成 BRING 风格 PPTX，并完成 QA。
```

- 如果团队已经建了 `Bring PPT` Workspace Agent，也可以直接用 `@Bring PPT` 调用

## 安装

### 1. 本地开发或 Codex 目录使用

如果你要本地调试，先用安装器把仓库装到本地 skill 目录，再进入安装目录安装依赖：

```powershell
npx skills add https://github.com/szbring/bringppt-skill-v2 --skill bringppt
cd $env:USERPROFILE\.agents\skills\bringppt
npm install
```

核心生成只需要 Node.js。做视觉 QA 时，再补 LibreOffice `soffice` 和 Poppler `pdftoppm`。
### 2. ChatGPT Business 上传

先在仓库根目录安装依赖并打包 skill：

```bash
npm install
npm run package:skill
```

然后在 ChatGPT Business 里：

1. 打开 `Skills`
2. 选择 `New skill`
3. 点击 `Upload from your computer`
4. 选择 `dist/` 里生成的 zip
5. 安装到工作区或个人账号

### 3. 团队共享建议

- 先由一个人维护 skill 仓库和打包产物
- 再通过 ChatGPT Business 的 Skill 上传或 Workspace Agent 共享给团队
- 团队成员尽量统一使用 `bringppt` 或 `@Bring PPT` 调用，减少误触发

## 推荐工作流

1. 先把输入内容整理成 storyboard / slides-data / 报告 / Word / Markdown
2. 用 `bringppt` 生成初版 PPT
3. 运行 `validate:all` 检查版式、溢出和一致性
4. 有问题就回到模板、输入或生成逻辑修复
5. 通过后再打包或上传

## 校验要求

- 交付前必须校验
- 生成的 deck 不要只“看起来能打开”，要能通过结构和视觉检查
- 如果视觉工具不可用，要明确说明，并使用能执行的最强校验路径
- 如果校验失败，先修复再继续，不要绕过

## 打包

- `npm run prepack:skill -- <staging-dir>`：准备运行时 skill 目录
- `npm run package:skill`：生成可上传的 zip，默认输出到 `dist/`

这个打包产物主要用于 ChatGPT Business 上传，以及其他兼容
Agent Skills 的环境。

## 目录结构

- `SKILL.md`：技能入口和执行契约
- `agents/openai.yaml`：ChatGPT / Codex 的入口元数据
- `ppt-pipeline.js`：主生成管线
- `storyboard-converter.js`：storyboard 到 slide-data 的转换
- `templates/`：页面和版式模板
- `validators/`：schema、视觉和内容校验规则
- `scripts/`：维护、打包和 QA 辅助脚本

## 相关文档

- `CHANGELOG.md`：版本变更记录
- `docs/STORYBOARD-SCHEMA.md`：storyboard 数据结构说明
- `docs/bring-templates.md`：模板目录和使用说明
- `docs/common-errors.md`：常见问题和修复方式
- `docs/HANDOVER.md`：交接、维护和版本背景
- `docs/CONTRIBUTING.md`：维护约定和协作方式

## 当前状态

这个仓库已经从测试包整理为 `bringppt` 的维护中源码仓库。  
当前重点是：

1. 保持技能入口稳定
2. 持续优化模板视觉效果
3. 保持打包、上传、校验流程一致

如果你是新接手的同事，建议先读：

1. `SKILL.md`
2. `docs/STORYBOARD-SCHEMA.md`
3. `docs/common-errors.md`

