'use strict';
/**
 * lib/webhook-sender.js — 周报 / 告警 webhook 推送
 *
 * 支持四种 webhook 格式：
 *   slack    — Slack Incoming Webhook（payload: {text} / blocks）
 *   dingtalk — 钉钉机器人（payload: {msgtype:'markdown', markdown:{title, text}}）
 *   feishu   — 飞书机器人（payload: {msg_type:'text', content:{text}}）
 *   generic  — 通用 JSON POST（payload: summary 对象本身）
 *
 * 用法：
 *   const { sendDigest } = require('./lib/webhook-sender');
 *   await sendDigest('https://...', { week, highRecs, ... }, { type: 'slack' });
 *
 * 告警接口：
 *   sendAlert(url, { template, kind, message }, opts) — 给 regression 实时告警用
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

function buildPayload(type, kind, data) {
  // kind: 'digest' (周报) | 'alert' (告警)
  if (kind === 'digest') {
    const title = `BRINGPPT 周报 · ${data.week}`;
    const lines = [
      `🔴 高优建议 ${data.highRecs} · 🟡 中优 ${data.medRecs} · 🔵 低优 ${data.lowRecs}`,
      data.diffSummary ? `📈 本周变化：${data.diffSummary}` : '',
      `📄 完整报告：${data.mdRelPath}`,
    ].filter(Boolean);
    const text = `${title}\n${lines.join('\n')}`;

    switch (type) {
      case 'slack':    return { text };
      case 'dingtalk': return { msgtype: 'markdown', markdown: { title, text } };
      case 'feishu':   return { msg_type: 'text', content: { text } };
      default:         return { kind: 'digest', ...data };
    }
  }

  if (kind === 'alert') {
    const title = `⚠ BRINGPPT 告警 · ${data.template || 'unknown'}`;
    const text  = `${title}\n${data.kind}: ${data.message}`;
    switch (type) {
      case 'slack':    return { text };
      case 'dingtalk': return { msgtype: 'markdown', markdown: { title, text } };
      case 'feishu':   return { msg_type: 'text', content: { text } };
      default:         return { kind: 'alert', ...data };
    }
  }

  return { ...data };
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('invalid webhook URL: ' + e.message)); }
    const body = JSON.stringify(payload);
    const lib  = u.protocol === 'http:' ? http : https;
    const req  = lib.request({
      method: 'POST',
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'http:' ? 80 : 443),
      path:     u.pathname + u.search,
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ status: res.statusCode, body: data });
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('webhook 请求超时（8s）')));
    req.write(body);
    req.end();
  });
}

async function sendDigest(url, summary, opts = {}) {
  const { type = 'generic', dryRun = false } = opts;
  const payload = buildPayload(type, 'digest', summary);
  if (dryRun) {
    console.log('[webhook-sender] DRY_RUN payload:', JSON.stringify(payload, null, 2));
    return { dryRun: true };
  }
  return postJson(url, payload);
}

async function sendAlert(url, info, opts = {}) {
  const { type = 'generic', dryRun = false } = opts;
  const payload = buildPayload(type, 'alert', info);
  if (dryRun) {
    console.log('[webhook-sender] DRY_RUN alert:', JSON.stringify(payload, null, 2));
    return { dryRun: true };
  }
  return postJson(url, payload);
}

module.exports = { sendDigest, sendAlert, buildPayload };
