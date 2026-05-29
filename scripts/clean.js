#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const patterns = [/\.pptx$/i, /\.pdf$/i, /\.log$/i];
const dirs = ["_temp", "dist", ".tmp", "tmp"];
let removed = 0;
for (const name of fs.readdirSync(root)) {
  const fp = path.join(root, name);
  const st = fs.statSync(fp);
  if (st.isFile() && patterns.some(rx => rx.test(name))) { fs.rmSync(fp, { force: true }); removed++; }
  if (st.isDirectory() && dirs.includes(name)) { fs.rmSync(fp, { recursive: true, force: true }); removed++; }
}
console.log(`cleaned ${removed} generated artifact(s)`);
