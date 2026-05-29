'use strict';

const { spawnSync } = require('child_process');

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error(`[upload-adapter] ${label} 不是有效 JSON: ${e.message}`);
    err.error_code = 'UPLOAD_FAILED';
    throw err;
  }
}

/**
 * Execute a real upload adapter supplied by environment.
 *
 * Supported adapter forms:
 * - BRINGPPT_UPLOAD_COMMAND="my-uploader --stdin-json"
 *   The process receives the request JSON on stdin and must write response JSON on stdout.
 *
 * Expected success response:
 * {
 *   fileId, title, mimeType, url, parent_ids, parent_names, destination_verified
 * }
 */
function uploadFileToDrive(request, opts = {}) {
  const command = (process.env.BRINGPPT_UPLOAD_COMMAND || '').trim();
  if (!command) {
    const err = new Error(
      '[upload-adapter] 未配置真实上传器。请设置 BRINGPPT_UPLOAD_COMMAND，或继续只使用 uploadRequest 契约输出。'
    );
    err.error_code = 'UPLOAD_FAILED';
    throw err;
  }

  const [bin, ...args] = command.split(/\s+/);
  const child = spawnSync(bin, args, {
    input: JSON.stringify(request, null, 2),
    encoding: 'utf-8',
    maxBuffer: opts.maxBuffer || 10 * 1024 * 1024,
  });

  if (child.error) {
    const err = new Error(`[upload-adapter] 调用上传器失败: ${child.error.message}`);
    err.error_code = 'UPLOAD_FAILED';
    throw err;
  }
  if (child.status !== 0) {
    const err = new Error(
      `[upload-adapter] 上传器退出码 ${child.status}: ${(child.stderr || child.stdout || '').trim().slice(0, 1000)}`
    );
    err.error_code = 'UPLOAD_FAILED';
    throw err;
  }

  const response = parseJson(child.stdout || '', '上传器响应');
  if (!response || response.destination_verified !== true || !Array.isArray(response.parent_ids) || !response.parent_ids.length) {
    const err = new Error('[upload-adapter] 上传器响应缺少 destination_verified 或 parent_ids');
    err.error_code = 'DESTINATION_VERIFICATION_FAILED';
    err.response = response;
    throw err;
  }

  return response;
}

module.exports = {
  uploadFileToDrive,
};
