#!/usr/bin/env bash
# scripts/cleanup-workspace.sh — 清掉历史遗留垃圾
#
# 这些文件 .gitignore 已经覆盖（不会进 git），但仍在 working tree 里碍眼。
# 沙箱无法删除 iCloud 挂载路径的文件，所以放到这里给本机跑。

set -e
cd "$(dirname "$0")/.."

echo "[cleanup] 删除 .bak 备份文件"
rm -f templates/*.bak

echo "[cleanup] 删除根目录测试产物"
rm -f test-all-templates.pptx test-charts.pptx test-frameworks.pptx \
      test-new-templates.pptx test-remaining-templates.pptx test-v3.pptx

echo "[cleanup] 删除可能的 *.bak / *.tmp / .DS_Store"
find . -name ".DS_Store" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "*.tmp" -not -path "./node_modules/*" -delete 2>/dev/null || true

echo "[cleanup] 完成。git status 查看："
git status --short
