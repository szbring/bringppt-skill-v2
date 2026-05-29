'use strict';
/**
 * lib/upload-folder.js — v4.1.9
 *
 * 生成符合 OpenAPI `UploadFileToDriveRequest` schema 的调用 JSON，
 * 让调用方可直接把本地 .pptx 通过 `upload_file_to_drive` 接口原样上传到
 * 指定 Google Drive 文件夹。bringppt 本身不实现上传，只负责产出契约。
 *
 * 来源：用户上传的接口规格
 *   - google-drive-upload-interface-spec.md
 *   - google-drive-upload-openapi.yaml
 *
 * OpenAPI 字段（严格按规格命名，不自创）：
 *   source_file              (必填，本地绝对路径)
 *   title                    (可选，目标文件名)
 *   destination_folder_id    (可选，文件夹 ID；优先级 > url)
 *   destination_folder_url   (可选，文件夹 URL；插件内部负责解析 id)
 *   mime_type                (可选，默认按扩展名推断)
 *   on_conflict              (可选，keep_both | replace | fail，默认 keep_both)
 *
 * 默认 PPT 输出文件夹（Agent 级配置）：
 *   default_ppt_output_folder_id   = '10cQkBoa86WdwdlUSEZsebQao1wh_gz2O'
 *   default_ppt_output_folder_name = 'Bring AI Workspace/AI Output/PPT'
 */

const fs   = require('fs');
const path = require('path');

// ── 默认 folder（Agent 级配置；可被 BRINGPPT_DEFAULT_FOLDER_ID 或 CLI 覆盖）─
const DEFAULT_PPT_OUTPUT_FOLDER_ID   = '10cQkBoa86WdwdlUSEZsebQao1wh_gz2O';
const DEFAULT_PPT_OUTPUT_FOLDER_NAME = 'Bring AI Workspace/AI Output/PPT';

// ── PPTX MIME type（OpenAPI examples 推荐值）──────────────────────
const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// ── on_conflict 合法值（OpenAPI enum）─────────────────────────────
const ON_CONFLICT_VALUES = ['keep_both', 'replace', 'fail'];

// ── 错误代码集（OpenAPI DriveUploadError.error_code enum）────────
const ERROR_CODES = Object.freeze({
  SOURCE_FILE_NOT_FOUND:         'SOURCE_FILE_NOT_FOUND',
  INVALID_DESTINATION_FOLDER:    'INVALID_DESTINATION_FOLDER',
  DESTINATION_ACCESS_DENIED:     'DESTINATION_ACCESS_DENIED',
  UPLOAD_FAILED:                 'UPLOAD_FAILED',
  FILE_CONFLICT:                 'FILE_CONFLICT',
  DESTINATION_VERIFICATION_FAILED:'DESTINATION_VERIFICATION_FAILED',
});

/**
 * 从 Google Drive 文件夹 URL 提取 folder id。
 *
 * 支持形态：
 *   https://drive.google.com/drive/folders/<ID>
 *   https://drive.google.com/drive/folders/<ID>?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/<ID>
 *
 * @param {string} url
 * @returns {string|null}
 */
function extractFolderIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * 按规格优先级解析最终 destination_folder_id。
 *
 * 优先级（高 → 低）：
 *   1. opts.destinationFolderId   （CLI / meta 显式 ID）
 *   2. opts.destinationFolderUrl  （CLI / meta 显式 URL）
 *   3. process.env.BRINGPPT_DEFAULT_FOLDER_ID   （全局环境变量）
 *   4. DEFAULT_PPT_OUTPUT_FOLDER_ID   （Agent 默认配置）
 *
 * @param {object} opts
 * @param {string} [opts.destinationFolderId]
 * @param {string} [opts.destinationFolderUrl]
 * @returns {{ folderId: string, source: string }}
 */
function resolveDestinationFolder(opts = {}) {
  if (opts.destinationFolderId) {
    return { folderId: String(opts.destinationFolderId).trim(), source: 'destination_folder_id' };
  }
  if (opts.destinationFolderUrl) {
    const id = extractFolderIdFromUrl(opts.destinationFolderUrl);
    if (id) return { folderId: id, source: 'destination_folder_url' };
    // 解析失败 → 不静默回退到默认，按规格抛 INVALID_DESTINATION_FOLDER
    const err = new Error(
      `[upload-folder] destination_folder_url 无法解析出 folder id: ${opts.destinationFolderUrl}`
    );
    err.error_code = ERROR_CODES.INVALID_DESTINATION_FOLDER;
    err.destination_folder_url = opts.destinationFolderUrl;
    throw err;
  }
  const envId = (process.env.BRINGPPT_DEFAULT_FOLDER_ID || '').trim();
  if (envId) return { folderId: envId, source: 'BRINGPPT_DEFAULT_FOLDER_ID' };
  return { folderId: DEFAULT_PPT_OUTPUT_FOLDER_ID, source: 'default_ppt_output_folder_id' };
}

/**
 * 按 OpenAPI UploadFileToDriveRequest schema 构造调用 JSON。
 *
 * @param {string} localPath - 本地 .pptx 绝对路径
 * @param {object} [opts]
 * @param {string} [opts.title]                 - 目标文件名
 * @param {string} [opts.destinationFolderId]
 * @param {string} [opts.destinationFolderUrl]
 * @param {string} [opts.onConflict]            - keep_both | replace | fail
 * @param {string} [opts.mimeType]              - 默认 pptx mime
 * @returns {object} request - 严格符合 OpenAPI schema 的请求 JSON
 *                              { source_file, title?, destination_folder_id?, destination_folder_url?, mime_type, on_conflict }
 */
function buildUploadRequest(localPath, opts = {}) {
  if (!localPath) {
    const err = new Error('[upload-folder] buildUploadRequest 需要 localPath');
    err.error_code = ERROR_CODES.SOURCE_FILE_NOT_FOUND;
    throw err;
  }
  const sourceFile = path.resolve(localPath);

  // 校验 source_file 存在性（仅生成 hint 前自检，避免下游报 SOURCE_FILE_NOT_FOUND）
  // 注意：此处仅 warn，不阻断 — 调用方场景可能在 pptx 还在写盘时构造请求
  if (!fs.existsSync(sourceFile)) {
    // 静默：写盘后才会调用本函数；若仍不存在，让 upload_file_to_drive 返回 SOURCE_FILE_NOT_FOUND
  }

  const resolvedDestination = resolveDestinationFolder({
    destinationFolderId:  opts.destinationFolderId,
    destinationFolderUrl: opts.destinationFolderUrl,
  });

  const title = typeof opts.title === 'string' && opts.title.trim()
    ? opts.title.trim()
    : path.basename(sourceFile);

  const mimeType = opts.mimeType || PPTX_MIME_TYPE;

  const onConflict = ON_CONFLICT_VALUES.includes(opts.onConflict)
    ? opts.onConflict
    : 'keep_both';

  // 严格按 OpenAPI 字段命名（snake_case）
  return {
    source_file:           sourceFile,
    title:                 title,
    ...(opts.destinationFolderId ? { destination_folder_id: String(opts.destinationFolderId).trim() } : { destination_folder_id: resolvedDestination.folderId }),
    ...(opts.destinationFolderUrl ? { destination_folder_url: String(opts.destinationFolderUrl).trim() } : {}),
    mime_type:             mimeType,
    on_conflict:           onConflict,
  };
}

/**
 * 在 stdout 打印调用指令，引导代理直接喂给 upload_file_to_drive 工具。
 *
 * 输出形态：
 *   --- upload_file_to_drive ---
 *   接口：upload_file_to_drive
 *   规格：google-drive-upload-openapi.yaml
 *   请求 JSON：
 *   { ...buildUploadRequest output... }
 *   ---
 *
 * @param {object} uploadRequest - buildUploadRequest 的返回
 * @param {string} localPath     - 仅用于打印日志方便定位
 */
function printUploadHint(uploadRequest, localPath) {
  const lines = [];
  lines.push('');
  lines.push('=== upload_file_to_drive (Google Drive 原样上传) ===');
  lines.push(`  本地文件：${localPath || uploadRequest.source_file}`);
  lines.push(`  目标 folder：${uploadRequest.destination_folder_id}`);
  lines.push(`  规格：参见 google-drive-upload-openapi.yaml / google-drive-upload-interface-spec.md`);
  lines.push(`  💡 设 BRINGPPT_UPLOAD_COMMAND=$(pwd)/bin/upload-file-to-drive.js 可自动上传`);
  lines.push('  → 或把以下 JSON 喂给外部 upload_file_to_drive 工具：');
  lines.push(JSON.stringify(uploadRequest, null, 2));
  lines.push('===');
  lines.push('');
  console.log(lines.join('\n'));
}

module.exports = {
  DEFAULT_PPT_OUTPUT_FOLDER_ID,
  DEFAULT_PPT_OUTPUT_FOLDER_NAME,
  PPTX_MIME_TYPE,
  ON_CONFLICT_VALUES,
  ERROR_CODES,
  extractFolderIdFromUrl,
  resolveDestinationFolder,
  buildUploadRequest,
  printUploadHint,
};
