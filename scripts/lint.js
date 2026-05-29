#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const excludeDirs = new Set(["node_modules", ".git", "dist", "tmp", ".tmp", "_temp"]);
const files = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (excludeDirs.has(name)) continue;
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp);
    else if (st.isFile() && name.endsWith(".js")) files.push(fp);
  }
}
walk(root);
let failed = 0;
for (const fp of files) {
  const rel = path.relative(root, fp).replace(/\\/g, "/");
  try {
    const code = fs.readFileSync(fp, "utf-8");
    new vm.Script(code, { filename: rel });
  } catch (e) {
    failed++;
    console.error(`FAIL ${rel}`);
    console.error(e.message);
  }
}
if (failed) {
  console.error(`\nSyntax check failed: ${failed}/${files.length} file(s).`);
  process.exit(1);
}
console.log(`Syntax check passed: ${files.length} JS file(s).`);
