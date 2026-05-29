#!/usr/bin/env node
'use strict';
/**
 * scripts/bump.js - update version facts in package, lockfile, and skill entry doc.
 *
 * Usage:
 *   npm run bump -- 3.7.6
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const next = process.argv[2];

if (!next || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(next)) {
  console.error('Usage: node scripts/bump.js <semver>');
  process.exit(1);
}

function writeJson(rel, updater) {
  const p = path.join(root, rel);
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  updater(data);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function replace(rel, re, value) {
  const p = path.join(root, rel);
  const src = fs.readFileSync(p, 'utf-8');
  const out = src.replace(re, value);
  if (out === src) throw new Error(`${rel}: pattern not found`);
  fs.writeFileSync(p, out, 'utf-8');
}

writeJson('package.json', (pkg) => { pkg.version = next; });

const lockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  writeJson('package-lock.json', (lock) => {
    lock.version = next;
    if (lock.packages && lock.packages['']) lock.packages[''].version = next;
  });
}

replace('SKILL.md', /^\*\*版本\*\*：v\d+\.\d+\.\d+.*$/m, `**版本**：v${next} (${new Date().toISOString().slice(0, 10)})`);

console.log(`Version bumped to v${next}. Add CHANGELOG entry, commit, then tag v${next}.`);