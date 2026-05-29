#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter(a => a.startsWith("--")));
const positional = rawArgs.filter(a => !a.startsWith("--"));
const withDev = flags.has("--with-dev");
const noNodeModules = flags.has("--no-node-modules");
const out = path.resolve(positional[0] || path.join(process.cwd(), "bringppt-staging"));

const runtimeTop = new Set([
  ".codex-plugin",
  "CHANGELOG.md",
  "SKILL.md", "agents", "assets", "docs", "references", "templates", "lib", "learning",
  "README.md",
  "bring-core.js", "check-consistency.js", "gen_ppt_template.js",
  "learning-context.js", "package.json", "package-lock.json", "ppt-pipeline.js",
  "record-learning.js", "registry.js", "scripts", "storyboard-converter.js",
  "template-selector.js", "validate-slides.js", "validators", "weekly-checkup.js",
]);
const devTop = new Set([
  ".codex-plugin",
  ".eslintrc.json", ".gitignore", "CHANGELOG.md", "SKILL.md",
  "agents", "assets", "docs", "references", "templates", "lib", "learning",
  "bring-core.js", "bring-example.js", "check-consistency.js", "gen_ppt_template.js",
  "learning-context.js", "package.json", "package-lock.json", "ppt-pipeline.js",
  "record-learning.js", "registry.js", "scripts", "storyboard-converter.js",
  "template-selector.js", "tests", "test-batch", "validate-slides.js", "validators", "weekly-checkup.js",
]);
const includeTop = withDev ? devTop : runtimeTop;
const runtimeScriptNames = new Set([
  "validate", "validate:all", "learning", "pipeline", "checkup", "checkup:dry",
  "pdf", "outline", "recommend", "regen", "preview", "catalog", "new:template",
  "lint", "lint:fonts", "lint:zorder", "learning:report", "promote:traps",
  "weights:reset", "weights:reset:dry", "backfill:failures", "learning:triage",
  "doctor", "doctor:visual", "clean", "cleanup",
]);
const exclude = [
  /\.pptx$/i,
  /\.pdf$/i,
  /\.DS_Store$/i,
  /^__MACOSX(\/|$)/,
  /(^|\/)\._[^/]+$/,
  /^dist(\/|$)/,
  /^tmp(\/|$)/,
  /^_temp(\/|$)/,
  /^_dist_smoke(\/|$)/,
  /^\.tmp(\/|$)/,
  /(^|\/)learning\/global\/context-access-log\.json$/,
  /(^|\/)learning\/global\/weekly-reports(\/|$)/,
  /^docs\/catalog(\/|$)/,
  /^docs\/superpowers(\/|$)/,
  ...(withDev ? [] : [
    /^scripts\/archive(\/|$)/,
  ]),
];
function shouldExclude(rel) { return exclude.some(rx => rx.test(rel)); }

function rewriteRuntimePackageJson() {
  if (withDev) return;
  const pkgPath = path.join(out, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const scripts = {};
  for (const name of runtimeScriptNames) {
    if (pkg.scripts && pkg.scripts[name]) scripts[name] = pkg.scripts[name];
  }
  pkg.scripts = scripts;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function copyRuntimeNodeModules() {
  const lockPath = path.join(root, "package-lock.json");
  const nmRoot = path.join(root, "node_modules");
  if (!fs.existsSync(lockPath) || !fs.existsSync(nmRoot)) {
    console.warn("WARN runtime node_modules not found; run npm install --omit=dev before staging if direct-run packaging is required");
    return;
  }
  let lock;
  try { lock = JSON.parse(fs.readFileSync(lockPath, "utf-8")); }
  catch (e) { console.warn(`WARN cannot parse package-lock.json: ${e.message}`); return; }
  const packages = Object.keys(lock.packages || {})
    .filter(k => k.startsWith("node_modules/"))
    .map(k => k.replace(/^node_modules\//, ""));
  if (!packages.length) return;
  for (const pkg of packages) {
    const src = path.join(nmRoot, pkg);
    if (!fs.existsSync(src)) {
      console.warn(`WARN missing runtime package ${pkg}; packaged skill may require npm install`);
      continue;
    }
    copy(src, path.join(out, "node_modules", pkg), path.join("node_modules", pkg));
  }
}

function copy(src, dst, rel = "") {
  if (shouldExclude(rel)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dst, name), rel ? `${rel}/${name}` : name);
  } else if (st.isFile()) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (!includeTop.has(name)) continue;
  copy(path.join(root, name), path.join(out, name), name);
}
rewriteRuntimePackageJson();
if (!noNodeModules) copyRuntimeNodeModules();
const du = spawnSync("du", ["-sh", out], { encoding: "utf-8" });
if (du.stdout) process.stdout.write(du.stdout);
console.log(`staged ${withDev ? "dev" : "runtime"} skill at ${out}`);