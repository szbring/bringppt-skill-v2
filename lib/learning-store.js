'use strict';
/**
 * lib/learning-store.js — runtime-safe storage for BRINGPPT learning data.
 *
 * Packaged files under <skill>/learning are read-only defaults.
 * Runtime writes go to BRINGPPT_LEARNING_DIR or ~/.bringppt/learning.
 * Set BRINGPPT_LEARNING_DISABLED=1 to suppress runtime writes and use defaults only.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const DEFAULT_LEARNING_DIR = path.join(SKILL_DIR, 'learning');
const LEARNING_DISABLED = /^(1|true|yes|on)$/i.test(String(process.env.BRINGPPT_LEARNING_DISABLED || '').trim());
const RUNTIME_LEARNING_DIR = LEARNING_DISABLED
  ? null
  : path.resolve(process.env.BRINGPPT_LEARNING_DIR || path.join(os.homedir() || os.tmpdir(), '.bringppt', 'learning'));

function joinMaybe(base, ...parts) {
  return base ? path.join(base, ...parts) : null;
}

const paths = {
  skillDir: SKILL_DIR,
  disabled: LEARNING_DISABLED,
  runtimeDir: RUNTIME_LEARNING_DIR,
  defaultDir: DEFAULT_LEARNING_DIR,
  globalDir: joinMaybe(RUNTIME_LEARNING_DIR, 'global'),
  templatesDir: joinMaybe(RUNTIME_LEARNING_DIR, 'templates'),
  userDir: joinMaybe(RUNTIME_LEARNING_DIR, 'user'),
  defaultGlobalDir: path.join(DEFAULT_LEARNING_DIR, 'global'),
  defaultTemplatesDir: path.join(DEFAULT_LEARNING_DIR, 'templates'),
  defaultUserDir: path.join(DEFAULT_LEARNING_DIR, 'user'),
};

function isLearningDisabled() {
  return LEARNING_DISABLED;
}

function runtimePath(...parts) {
  return joinMaybe(RUNTIME_LEARNING_DIR, ...parts);
}

function defaultPath(...parts) {
  return path.join(DEFAULT_LEARNING_DIR, ...parts);
}

function legacyDefaultPath(name) {
  return path.join(DEFAULT_LEARNING_DIR, name);
}

function ensureDir(dirPath) {
  if (LEARNING_DISABLED || !dirPath) return false;
  fs.mkdirSync(dirPath, { recursive: true });
  return true;
}

function ensureRuntimeDirs() {
  if (LEARNING_DISABLED) return false;
  ['global', 'templates', 'user'].forEach((d) => ensureDir(runtimePath(d)));
  return true;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readJson(filePath, defaultVal = null) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return clone(defaultVal);
}

const loadJson = readJson;

function loadFirstJson(candidates, defaultVal = null) {
  for (const p of candidates || []) {
    const data = readJson(p, null);
    if (data !== null && data !== undefined) return data;
  }
  return clone(defaultVal);
}

function readJsonRuntimeFirst(runtimeFile, defaultFile, defaultVal = null) {
  return loadFirstJson([runtimeFile, defaultFile], defaultVal);
}

function normalizeRelParts(relPath) {
  if (Array.isArray(relPath)) return relPath;
  return String(relPath).split(/[\\/]+/).filter(Boolean);
}

function loadLayeredJson(relPath, defaultVal = null) {
  const parts = normalizeRelParts(relPath);
  return readJsonRuntimeFirst(runtimePath(...parts), defaultPath(...parts), defaultVal);
}

function writeJsonAtomic(filePath, data) {
  if (LEARNING_DISABLED || !filePath) return false;
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return true;
}

const saveJson = writeJsonAtomic;

function saveRuntimeJson(relPath, data) {
  const parts = normalizeRelParts(relPath);
  return writeJsonAtomic(runtimePath(...parts), data);
}

function listJsonFilesIn(dirPath) {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

function listJsonFiles(runtimeDir, defaultDir) {
  const names = new Set();
  for (const f of listJsonFilesIn(defaultDir)) names.add(f);
  for (const f of listJsonFilesIn(runtimeDir)) names.add(f);
  return Array.from(names).sort();
}

function listTemplateJsonFiles() {
  return listJsonFiles(paths.templatesDir, paths.defaultTemplatesDir);
}

function normalizeTemplateKey(name) {
  return String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function templateLearningAliases(templateName) {
  const aliases = {
    coverSlide:     ['cover'],
    sectionSlide:   ['section'],
    backCoverSlide: ['backCover'],
    contentSlide:   ['content'],
  };
  return [templateName, ...(aliases[templateName] || [])].filter(Boolean);
}

function resolveTemplateLearningFile(templateName) {
  const wanted = new Set(templateLearningAliases(templateName).map(normalizeTemplateKey));
  for (const file of listTemplateJsonFiles()) {
    const base = file.replace(/\.json$/i, '');
    if (wanted.has(normalizeTemplateKey(base))) return file;
  }
  return null;
}

function mergeArraysById(base = [], overlay = []) {
  const out = [];
  const seen = new Set();
  for (const item of [...base, ...overlay]) {
    const key = item && (item.id || item.trapId || JSON.stringify(item).slice(0, 160));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mergeTemplateData(base, overlay) {
  const result = Object.assign({}, clone(base || {}), clone(overlay || {}));
  result.errorPatterns = mergeArraysById((base && base.errorPatterns) || [], (overlay && overlay.errorPatterns) || []);
  result.corrections = mergeArraysById((base && base.corrections) || [], (overlay && overlay.corrections) || []);
  if ((base && base.archived) || (overlay && overlay.archived)) {
    result.archived = mergeArraysById((base && base.archived) || [], (overlay && overlay.archived) || []);
  }
  return result;
}

function loadLayeredTemplate(filename, defaultVal = null) {
  const base = readJson(defaultPath('templates', filename), defaultVal || { errorPatterns: [], corrections: [] });
  const overlay = LEARNING_DISABLED ? null : readJson(runtimePath('templates', filename), null);
  return mergeTemplateData(base, overlay);
}

function loadTemplateLearning(templateName, defaultVal = null) {
  const file = resolveTemplateLearningFile(templateName);
  if (!file) return clone(defaultVal || { errorPatterns: [], corrections: [] });
  return loadLayeredTemplate(file, defaultVal);
}

function readTemplateFile(fileName, defaultVal = null) {
  return loadLayeredTemplate(fileName, defaultVal);
}

function templateWritePath(templateName) {
  return LEARNING_DISABLED ? null : runtimePath('templates', `${templateName}.json`);
}

function globalRead(name, defaultVal = null) {
  return loadLayeredJson(['global', name], defaultVal);
}

function globalWritePath(name) {
  return LEARNING_DISABLED ? null : runtimePath('global', name);
}

function sanitizeUserPreferences(prefs) {
  const data = Object.assign({ preferredTemplates: [], avoidedTemplates: [], corrections: [], stylePreferences: {} }, prefs || {});
  const preferred = Array.from(new Set(data.preferredTemplates || [])).filter(Boolean);
  const preferredSet = new Set(preferred);
  const avoided = Array.from(new Set(data.avoidedTemplates || [])).filter(Boolean).filter((name) => !preferredSet.has(name));
  return Object.assign({}, data, { preferredTemplates: preferred, avoidedTemplates: avoided });
}

function userRead(name, defaultVal = null) {
  return sanitizeUserPreferences(loadLayeredJson(['user', name], defaultVal));
}

function userWritePath(name) {
  return LEARNING_DISABLED ? null : runtimePath('user', name);
}

function describeStore() {
  return {
    skillDir: SKILL_DIR,
    defaultsDir: DEFAULT_LEARNING_DIR,
    runtimeDir: RUNTIME_LEARNING_DIR,
    disabled: LEARNING_DISABLED,
  };
}

const info = describeStore;

module.exports = {
  SKILL_DIR,
  DEFAULT_LEARNING_DIR,
  RUNTIME_LEARNING_DIR,
  paths,
  info,
  describeStore,
  isLearningDisabled,
  runtimePath,
  defaultPath,
  legacyDefaultPath,
  ensureDir,
  ensureRuntimeDirs,
  readJson,
  loadJson,
  loadFirstJson,
  readJsonRuntimeFirst,
  loadLayeredJson,
  writeJsonAtomic,
  saveJson,
  saveRuntimeJson,
  listJsonFiles,
  listTemplateJsonFiles,
  resolveTemplateLearningFile,
  loadTemplateLearning,
  loadLayeredTemplate,
  readTemplateFile,
  templateWritePath,
  globalRead,
  globalWritePath,
  userRead,
  userWritePath,
  sanitizeUserPreferences,
};
