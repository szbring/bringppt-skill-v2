#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const JSZip = require("jszip");

const root = path.resolve(__dirname, "..");
const rawArgs = process.argv.slice(2);
const flags = rawArgs.filter((arg) => arg.startsWith("--"));
const positional = rawArgs.filter((arg) => !arg.startsWith("--"));

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const defaultZip = path.join(root, "dist", `bringppt-v${pkg.version}-chatgpt-skill.zip`);
const outZip = path.resolve(positional[0] || defaultZip);

async function addDirectory(zip, dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirectory(zip, abs, rel);
      continue;
    }
    if (entry.isFile()) {
      zip.file(rel, fs.readFileSync(abs));
    }
  }
}

async function main() {
  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "bringppt-package-"));
  try {
    const prepackArgs = ["scripts/prepack-skill.js", stageDir, ...flags];
    const prepack = spawnSync(process.execPath, prepackArgs, {
      cwd: root,
      stdio: "inherit",
    });
    if (prepack.status !== 0) {
      process.exit(prepack.status || 1);
    }

    const zip = new JSZip();
    await addDirectory(zip, stageDir);
    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    fs.mkdirSync(path.dirname(outZip), { recursive: true });
    fs.writeFileSync(outZip, buffer);
    console.log(`packaged skill zip at ${outZip}`);
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
