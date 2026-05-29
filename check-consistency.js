// check-consistency.js — 跨文档一致性检查工具
// 用法：node check-consistency.js [path/to/consistency.json]
// 默认读取当前目录下的 consistency.json
//
// consistency.json 格式见 README 或项目示例
// 输出：PASS（所有文件包含锚点文本）/ WARN（变体存在）/ FAIL（缺失）
const fs = require("fs");
const path = require("path");

// 简易 glob：支持 * 和 ** 通配符
function globSync(pattern, base) {
  const results = [];
  const parts = pattern.replace(/\\/g, "/").split("/");

  function walk(dir, partIdx) {
    if (partIdx >= parts.length) return;
    const part = parts[partIdx];
    const isLast = partIdx === parts.length - 1;

    if (part === "**") {
      // Match current dir and recurse
      walk(dir, partIdx + 1);
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "_temp") {
            walk(path.join(dir, entry.name), partIdx);
          }
        }
      } catch (e) { /* skip unreadable dirs */ }
      return;
    }

    // Convert glob part to regex
    const re = new RegExp("^" + part.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (re.test(entry.name)) {
          const full = path.join(dir, entry.name);
          if (isLast) {
            if (entry.isFile()) results.push(full);
          } else if (entry.isDirectory()) {
            walk(full, partIdx + 1);
          }
        }
      }
    } catch (e) { /* skip unreadable dirs */ }
  }

  walk(base, 0);
  return results;
}

function main() {
  const configPath = process.argv[2] || "consistency.json";
  if (!fs.existsSync(configPath)) {
    console.error(`Config not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const basePath = config.basePath || path.dirname(path.resolve(configPath));

  let passCount = 0, warnCount = 0, failCount = 0;

  console.log(`\n  Consistency Check: ${basePath}\n`);

  for (const anchor of config.anchors) {
    const files = [];
    for (const pattern of anchor.files) {
      files.push(...globSync(pattern, basePath));
    }
    const unique = [...new Set(files.map(f => f.replace(/\\/g, "/")))];

    if (unique.length === 0) {
      console.log(`  SKIP  [${anchor.id}] "${anchor.text}" — no matching files for patterns`);
      continue;
    }

    const found = [];
    const missing = [];
    for (const f of unique) {
      const content = fs.readFileSync(f, "utf8");
      if (content.includes(anchor.text)) {
        found.push(f);
      } else {
        missing.push(f);
      }
    }

    const relPath = f => path.relative(basePath, f).replace(/\\/g, "/");

    if (missing.length === 0) {
      console.log(`  PASS  [${anchor.id}] "${anchor.text}" — found in ${found.length}/${unique.length} files`);
      passCount++;
    } else if (found.length > 0) {
      console.log(`  WARN  [${anchor.id}] "${anchor.text}" — missing in ${missing.length}/${unique.length} files:`);
      missing.forEach(f => console.log(`        - ${relPath(f)}`));
      warnCount++;
    } else {
      console.log(`  FAIL  [${anchor.id}] "${anchor.text}" — not found in any of ${unique.length} files`);
      unique.forEach(f => console.log(`        - ${relPath(f)}`));
      failCount++;
    }
  }

  console.log(`\n  Summary: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL\n`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
