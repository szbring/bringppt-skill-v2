#!/usr/bin/env node
'use strict';
/**
 * scripts/check-release.js - release consistency gate.
 *
 * Checks the core facts that must stay aligned before a team release:
 * package/SKILL versions, changelog, package-lock reproducibility, and
 * runtime packaging boundaries.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const skipTag = args.has('--skip-tag');
const allowDirty = args.has('--allow-dirty');

let failures = 0;
function ok(msg) { console.log(`OK   ${msg}`); }
function fail(msg) { failures++; console.error(`FAIL ${msg}`); }

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

function json(rel) {
  return JSON.parse(read(rel));
}

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
}

const pkg = json('package.json');
const version = pkg.version;
const tagName = `v${version}`;

// Version alignment
const skill = read('SKILL.md');
const changelog = read('CHANGELOG.md');
const agent = read('agents/openai.yaml');
if (skill.includes(`**鐗堟湰**锛歷${version}`)) ok(`SKILL.md version v${version}`); else fail(`SKILL.md missing version v${version}`);
if (changelog.includes(`## v${version}`)) ok(`CHANGELOG.md contains v${version}`); else fail(`CHANGELOG.md missing v${version}`);
if (agent.includes('Bring PPT')) ok('agents/openai.yaml uses the current agent name'); else fail('agents/openai.yaml missing agent name');

// Baseline smoke files
try {
  const baseline = json('tests/baseline.json');
  const missingFiles = Object.keys(baseline)
    .map(name => path.join(root, 'tests', `${name}.js`))
    .filter(fp => !fs.existsSync(fp));
  if (missingFiles.length === 0) ok(`baseline smoke files exist (${Object.keys(baseline).length})`);
  else fail(`baseline references missing test files: ${missingFiles.map(fp => path.relative(root, fp)).join(', ')}`);
} catch (e) {
  fail(`baseline smoke check failed: ${e.message}`);
}

// package-lock reproducibility
const lockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = json('package-lock.json');
  const rootPkg = lock.packages && lock.packages[''];
  if (lock.version === version && rootPkg && rootPkg.version === version) ok('package-lock version matches package.json');
  else fail('package-lock root version mismatch');
  if (rootPkg && rootPkg.dependencies && rootPkg.dependencies.pptxgenjs === pkg.dependencies.pptxgenjs) ok('package-lock dependency spec matches package.json');
  else fail('package-lock dependency spec mismatch');
} else {
  fail('package-lock.json missing');
}

// Script targets
for (const [name, script] of Object.entries(pkg.scripts || {})) {
  const m = script.match(/^(?:node|python3?)\s+([^\s]+)/);
  if (!m) continue;
  const target = path.join(root, m[1]);
  if (fs.existsSync(target)) ok(`npm script "${name}" target exists`);
  else fail(`npm script "${name}" target missing: ${m[1]}`);
}

// Runtime skill package boundary
let prepackStage = null;
try {
  prepackStage = fs.mkdtempSync(path.join(os.tmpdir(), 'bringppt-prepack-check-'));
  const r = spawnSync('node', ['scripts/prepack-skill.js', prepackStage, '--no-node-modules'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (r.status !== 0) {
    fail(`runtime prepack failed: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  } else {
    const forbidden = ['tests', 'test-batch', 'CHANGELOG.md', 'docs/catalog', 'scripts/archive'];
    const leaked = forbidden.filter(rel => fs.existsSync(path.join(prepackStage, rel)));
    if (leaked.length) fail(`runtime prepack leaked dev assets: ${leaked.join(', ')}`);
    else ok('runtime prepack excludes dev/test assets');
    const hidden = [];
    const scanHidden = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = path.relative(prepackStage, path.join(dir, ent.name));
        if (ent.name === '.DS_Store' || ent.name.startsWith('._') || ent.name === '__MACOSX') hidden.push(rel);
        if (ent.isDirectory()) scanHidden(path.join(dir, ent.name));
      }
    };
    scanHidden(prepackStage);
    if (hidden.length) fail(`runtime prepack contains hidden macOS metadata: ${hidden.slice(0, 5).join(', ')}`);
    else ok('runtime prepack excludes macOS metadata');
    if (fs.existsSync(path.join(prepackStage, 'lib', 'visual-hash.js'))) ok('runtime prepack keeps visual hash support');
    else fail('runtime prepack missing lib/visual-hash.js');
    if (fs.existsSync(path.join(prepackStage, 'validators', 'stats.js'))) ok('runtime prepack keeps validators');
    else fail('runtime prepack missing validators/stats.js');
    const validateSmoke = spawnSync('node', ['validate-slides.js'], {
      cwd: prepackStage,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (validateSmoke.status === 0) ok('runtime validate-slides dependency smoke passed');
    else fail(`runtime validate-slides dependency smoke failed: ${(validateSmoke.stderr || validateSmoke.stdout || '').slice(0, 400)}`);
    const stagedPkg = JSON.parse(fs.readFileSync(path.join(prepackStage, 'package.json'), 'utf-8'));
    const stagedScripts = Object.keys(stagedPkg.scripts || {});
    const devScripts = stagedScripts.filter(name => /^(test|release:check|bump|prepack:skill)/.test(name));
    if (devScripts.length) fail(`runtime package still exposes dev scripts: ${devScripts.join(', ')}`);
    else ok('runtime package scripts are deployment-oriented');
  }
} catch (e) {
  fail(`runtime prepack check crashed: ${e.message}`);
} finally {
  if (prepackStage) fs.rmSync(prepackStage, { recursive: true, force: true });
}

// Git tag completeness for tracked changelog versions
const FIRST_GIT_TRACKED = '3.7.4';
function semverGte(a, b) {
  const ax = a.split('.').map(Number);
  const bx = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((ax[i] || 0) > ((bx[i] || 0))) return true;
    if ((ax[i] || 0) < ((bx[i] || 0))) return false;
  }
  return true;
}
try {
  if (skipTag) {
    ok('CHANGELOG -> tag check skipped by --skip-tag');
  } else {
    const versionsInChangelog = [...changelog.matchAll(/^## v(\d+\.\d+\.\d+)/gm)].map(m => m[1]);
    const tagListResult = git(['for-each-ref', '--format=%(refname:short)', 'refs/tags']);
    const tagsExisting = new Set(
      tagListResult.status === 0
        ? tagListResult.stdout.split('\n').filter(Boolean).map(t => t.replace(/^v/, ''))
        : []
    );
    const tracked = versionsInChangelog.filter(v => semverGte(v, FIRST_GIT_TRACKED));
    const missing = tracked.filter(v => !tagsExisting.has(v));
    if (missing.length === 0) ok(`CHANGELOG >= v${FIRST_GIT_TRACKED} all have git tags (${tracked.length} entries)`);
    else fail(`CHANGELOG has missing git tags: ${missing.map(v => 'v' + v).join(', ')}`);
  }
} catch (e) {
  fail(`CHANGELOG -> tag check failed: ${e.message}`);
}

// Git release checks
const inside = git(['rev-parse', '--is-inside-work-tree']);
if (inside.status === 0 && inside.stdout.trim() === 'true') {
  const status = git(['status', '--porcelain']);
  if (status.status === 0) {
    const dirty = status.stdout.split('\n').filter(Boolean).filter(line => !/^(?:\?\?| M )/.test(line));
    if (dirty.length === 0) ok('git working tree clean');
    else if (allowDirty) ok(`git working tree dirty but allowed (${dirty.length} entries)`);
    else fail(`git working tree dirty (${dirty.length} entries)`);
  } else {
    fail(`git status failed: ${status.stderr || status.stdout}`);
  }

  const head = git(['rev-parse', 'HEAD']);
  const tag = git(['rev-list', '-n', '1', tagName]);
  if (head.status === 0 && tag.status === 0) {
    if (head.stdout.trim() === tag.stdout.trim()) ok(`HEAD matches ${tagName}`);
    else fail(`${tagName} does not point at HEAD`);
  } else {
    fail(`git revision lookup failed for ${tagName}`);
  }
} else {
  ok('git checks skipped (not inside a work tree)');
}

if (failures) {
  console.error(`Release checks failed (${failures})`);
  process.exit(1);
}
console.log('Release checks passed');