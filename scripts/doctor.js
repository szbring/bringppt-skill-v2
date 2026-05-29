#!/usr/bin/env node
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const requireVisual = args.has("--visual") || process.env.BRINGPPT_VISUAL_REQUIRED === "1";

function ok(msg) { console.log(`OK   ${msg}`); }
function warn(msg) { console.warn(`WARN ${msg}`); }
function fail(msg) { console.error(`FAIL ${msg}`); failures++; }
let failures = 0;

function parseNode(v) { return v.replace(/^v/, "").split(".").map(n => parseInt(n, 10)); }
function atLeast(actual, expected) {
  for (let i = 0; i < expected.length; i++) {
    if ((actual[i] || 0) > expected[i]) return true;
    if ((actual[i] || 0) < expected[i]) return false;
  }
  return true;
}

const nodeVersion = parseNode(process.version);
if (atLeast(nodeVersion, [18, 17, 0])) ok(`Node ${process.version}`);
else fail(`Node ${process.version}; required >=18.17.0`);

for (const mod of ["pptxgenjs", "jszip"]) {
  try { require.resolve(mod, { paths: [root] }); ok(`module ${mod}`); }
  catch { fail(`missing module ${mod}; run npm install --omit=dev --registry=https://registry.npmjs.org/ in ${root}`); }
}

for (const f of ["SKILL.md", "bring-core.js", "validate-slides.js", "assets/bring_logo.png"]) {
  if (fs.existsSync(path.join(root, f))) ok(f);
  else fail(`missing ${f}`);
}

function hasCmd(cmd) {
  if (process.platform === "win32") {
    return spawnSync("where", [cmd], { stdio: "ignore" }).status === 0;
  }
  return spawnSync("sh", ["-lc", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}
if (hasCmd("unzip")) ok("unzip"); else warn("unzip not found; PPTX package checks use jszip fallback");
if (hasCmd("zip")) ok("zip"); else warn("zip not found; PPTX note stripping uses jszip fallback");
const hasSoffice = hasCmd("soffice");
const hasPdftoppm = hasCmd("pdftoppm");
if (hasSoffice) ok("soffice / LibreOffice"); else (requireVisual ? fail : warn)("soffice not found; PDF visual QA will be unavailable");
if (hasPdftoppm) ok("pdftoppm"); else (requireVisual ? fail : warn)("pdftoppm not found; slide image extraction will be unavailable");

async function visualSmokeTest() {
  if (!hasSoffice || !hasPdftoppm) return;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "bringppt-doctor-"));
  const pptxPath = path.join(work, "smoke.pptx");
  try {
    const pptxgen = require("pptxgenjs");
    const pres = new pptxgen();
    pres.layout = "LAYOUT_16x9";
    const slide = pres.addSlide();
    slide.addText("BRINGPPT visual smoke", { x: 0.5, y: 0.5, w: 5.0, h: 0.5, fontSize: 18 });
    await pres.writeFile({ fileName: pptxPath });
    const vh = require(path.join(root, "lib", "visual-hash"));
    const hashes = await vh.hashPptx(pptxPath);
    if (!Array.isArray(hashes) || hashes.length !== 1 || !hashes[0].hash) {
      throw new Error("visual hash returned no page hash");
    }
    ok("visual smoke test (pptx -> pdf -> 9x8 hash)");
  } catch (e) {
    const msg = `visual smoke test failed: ${e.message}`;
    if (requireVisual) fail(msg);
    else warn(`${msg}; run npm run doctor:visual before relying on visual regression`);
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
  }
}

try {
  const store = require(path.join(root, "lib", "learning-store"));
  const info = store.info();
  if (info.disabled) warn("learning writes disabled by BRINGPPT_LEARNING_DISABLED");
  else ok(`learning runtime dir: ${info.runtimeDir}`);
} catch (e) { warn(`learning-store check failed: ${e.message}`); }

visualSmokeTest().then(() => {
  if (!requireVisual) {
    warn("visual smoke is advisory in default doctor; use npm run doctor:visual to make it a hard gate");
  }
  if (failures > 0) {
    console.error(`\nBRINGPPT doctor failed: ${failures} issue(s).`);
    process.exit(1);
  }
  console.log("\nBRINGPPT doctor passed.");
}).catch((e) => {
  fail(`doctor crashed: ${e.message}`);
  console.error(`\nBRINGPPT doctor failed: ${failures} issue(s).`);
  process.exit(1);
});
