'use strict';
/**
 * validators/content.js — 内容密度校验（v3.7.9 抽取）
 *
 * 检查 desc/content 最小字数 + 必填 enrichment 字段。纯函数。
 * 依赖：validators/text-utils.textLen
 */

const { textLen } = require('./text-utils');

const CONTENT_MIN = {
  desc: {
    "stepList.steps[].desc": 15,
    "layeredList.layers[].desc": 15,
    "iconList.items[].desc": 15,
    "comparison.items[]": 12,
    "twoColumnCards.cards[].content": 12,
  },
  requiredFields: {
    stepList: ["summary"],
    layeredList: ["summary"],
    comparison: ["bottomText"],
  },
};

function validateContentDensity(slide, index) {
  const sid = slide.id || `slide[${index}]`;
  const contentIssues = [];

  function cError(msg) { contentIssues.push({ level: "ERROR", slideId: sid, msg }); }
  function cWarn(msg) { contentIssues.push({ level: "WARN", slideId: sid, msg }); }

  // 1. Desc/content field minimum length check (content pages with layouts)
  if (slide.type === "content" && slide.layouts) {
    for (const lay of slide.layouts) {
      if (!lay.type || !lay.data) continue;
      const d = lay.data;
      const lt = lay.type;

      // Check desc minimums
      if (lt === "stepList" && Array.isArray(d.steps)) {
        for (let i = 0; i < d.steps.length; i++) {
          const len = textLen(d.steps[i].desc);
          if (len < 15) cWarn(`${lt}.steps[${i}].desc length ${len} < minimum 15`);
        }
      }
      if (lt === "layeredList" && Array.isArray(d.layers)) {
        for (let i = 0; i < d.layers.length; i++) {
          const len = textLen(d.layers[i].desc);
          if (len < 15) cWarn(`${lt}.layers[${i}].desc length ${len} < minimum 15`);
        }
      }
      if (lt === "iconList" && Array.isArray(d.items)) {
        for (let i = 0; i < d.items.length; i++) {
          const len = textLen(d.items[i].desc);
          if (len < 15) cWarn(`${lt}.items[${i}].desc length ${len} < minimum 15`);
        }
      }
      if (lt === "comparison") {
        for (const side of ["left", "right"]) {
          if (d[side] && Array.isArray(d[side].items)) {
            for (let i = 0; i < d[side].items.length; i++) {
              const len = textLen(d[side].items[i]);
              if (len < 12) cWarn(`${lt}.${side}.items[${i}] length ${len} < minimum 12`);
            }
          }
        }
      }
      if (lt === "twoColumnCards" && Array.isArray(d.cards)) {
        for (let ci = 0; ci < d.cards.length; ci++) {
          if (typeof d.cards[ci].content === "string") {
            const len = textLen(d.cards[ci].content);
            if (len < 12) cWarn(`${lt}.cards[${ci}].content length ${len} < minimum 12`);
          }
        }
      }

      // v4.0.4: enrichment 字段降为 WARN（与 stats.js 同步：summary/bottomText 等都是 optional）
      const reqFields = CONTENT_MIN.requiredFields[lt];
      if (reqFields) {
        for (const f of reqFields) {
          if (!d[f] || (typeof d[f] === "string" && d[f].trim() === "")) {
            cWarn(`${lt} missing recommended enrichment field "${f}"`);
          } else if (typeof d[f] === "string" && textLen(d[f]) < 15) {
            cWarn(`${lt}.${f} length ${textLen(d[f])} is short (recommend ≥15)`);
          }
        }
      }
    }
  }

  return contentIssues;
}

module.exports = { validateContentDensity, CONTENT_MIN };
