# 每周自检任务调度配置

`weekly-checkup.js` 需要**定时触发器**才能"每周一自动跑"。本文档提供 3 种配置方式，按你的环境选一个。

---

## 方式 A：Windows 任务计划（推荐给 Windows 用户）

### 一次性配置步骤

1. **按 `Win + R`**，输入 `taskschd.msc` 回车，打开"任务计划程序"

2. 右边栏点 **"创建基本任务..."**

3. **名称**填：`BRINGPPT Weekly Checkup`
   **描述**：每周一早上自动生成 bringppt 自学习周报

4. **触发器**：选"每周"
   - 开始时间：周一 09:00
   - 每隔 `1` 周
   - 勾选 `星期一`

5. **操作**：选"启动程序"
   - 程序或脚本：`node`
   - 添加参数：`weekly-checkup.js`
   - 起始于：`D:\AI work\bringppt\bringppt`（注意换成你的实际路径）

6. 点完成

### 验证

- 在任务计划程序的"任务计划程序库"里找到刚创建的任务
- 右键 → **运行**
- 去 `D:\AI work\bringppt\bringppt\learning\global\weekly-reports\` 看看有没有新 .md 文件

### 输出查看

周报生成后没有弹窗通知——这是故意的，避免打扰。每周一上班打开 `learning/global/weekly-reports/` 文件夹，按修改时间倒序看最新那份即可。

---

## 方式 B：手动周一自己跑（最省事）

如果懒得配任务计划，每周一打开终端，跑一条命令即可：

```bash
cd "D:\AI work\bringppt\bringppt"
node weekly-checkup.js
```

适合：人数少、PPT 生成频率低、对"自动化"没硬需求的场景。

---



```bash
node weekly-checkup.js --silent
```

`--silent` 模式不输出控制台日志，只写文件——适合无人值守环境。

---

## 所有可用参数

| 参数 | 作用 |
|------|------|
| （无） | 正式执行：清理 + 生成报告 |
| `--dry-run` | 只预览周报内容，不清理、不写文件 |
| `--silent` | 正式执行但不打印控制台（CI 用） |

---

## 故障排查

### 报错："Cannot find module 'record-learning'"
检查 `weekly-checkup.js` 是否和 `record-learning.js` 在同一目录。两者必须同级。

### 报错："ENOENT: no such file or directory learning/global/"
第一次运行时如果 `learning/` 目录还没初始化，这是正常的——跑一次 PPT 生成（或跑一次 `node learning-context.js`）会自动创建。

### 周报里重复踩坑数一直是 0
这不是 bug——说明你**没有实际跑过 PPT 生成或 validate**，所以系统没数据可用。
开始真实使用后，数据会自然攒起来。

### 想让失败时邮件通知我
`weekly-checkup.js` 失败时会在 `learning/global/weekly-reports/` 下写一份 `-FALLBACK.md` 文件。
