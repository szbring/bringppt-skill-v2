'use strict';
// templates/styled-table.js
// Source: bring-core.js L937-1014
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'styledTable',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '带样式的数据表格，支持斑马纹、高亮单元格、行颜色标记和底部总结',

  schema: {
    headers:         { type: 'array',  required: true,  description: '表头数组' },
    rows:            { type: 'array',  required: true,  description: '数据行二维数组，支持字符串或 {text, highlight?, color?}' },
    summary:         { type: 'string|object', required: false, description: '底部总结文字或 {text, bgColor}', warn: 30, error: 50 },
    rowAccentColors: { type: 'array',  required: false, description: '每行的左侧强调色数组' },
    startX:          { type: 'number', required: false, description: '左起点，默认 0.75' },
    startY:          { type: 'number', required: false },
    w:               { type: 'number', required: false, description: '表格宽度，默认 8.5' },
    colWidths:       { type: 'array',  required: false, description: 'v4.0.2: 每列宽度数组（数字代表英寸），总和须等于 w；不传则按列数均分' },
  },

  usage: {
    when:          '需要对比展示多行多列数据、特性对比、评估矩阵时',
    notWhen:       '数据量很少（2行以内）时，用其他布局更清晰',
    scenarios: [
          {
                "trigger": "多行多列的对比数据，需要表格呈现",
                "example": "ISC成熟度对标：5维度×3阶段，蓝色表头，底部有结论条"
          },
          {
                "trigger": "评估矩阵、现状vs目标对比",
                "example": "当前状态/行业标杆/差距程度三列，清晰展示现状"
          },
          {
                "trigger": "比analysisMatrix数据更文字化时",
                "example": "内容以文字描述为主，而非评分/颜色，用styledTable"
          }
    ],

    typicalHeight: '约 1.5~3.5 英寸，取决于行数',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/styled-table.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.7: keyPoints 适配器
  // v3.7.24: 默认补 summary 提升 enrichment 命中（之前 styledTable.summary 使用率 0%）
  //          schema 移除 title 字段以避免「未知字段 title」warning
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const rows = (keyPoints || []).slice(0, 8).map(kp => {
      const { title: t, desc: d } = splitTitleDesc(kp);
      return [t || kp, d || ''];
    });
    const pageTitle = (page && page.title) || '';
    const summary = pageTitle ? `共 ${rows.length} 项要点：${pageTitle}` : `共 ${rows.length} 项关键要点汇总`;
    return { headers: ['项目', '说明'], rows, summary };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    let { headers, rows, summary, rowAccentColors, startX = 0.75, startY: explicitStartY, w = 8.5, colWidths } = data;

    // v4.1.8 (修 P3-A): alias — data / table / cells 等等扁平输入；
    //   若用户只传了 rows 而无 headers，从 rows[0] 推断；
    //   若传了二维 data，按 [0]=header, [1..]=rows 拆解
    if ((!Array.isArray(headers) || !headers.length) && (!Array.isArray(rows) || !rows.length)) {
      const flat = data.data || data.table || data.cells;
      if (Array.isArray(flat) && flat.length >= 2 && Array.isArray(flat[0])) {
        headers = flat[0];
        rows = flat.slice(1);
      }
    }
    if (!Array.isArray(headers) || !headers.length) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'styledTable', missingField: 'headers[] + rows[][]', hint: '需要 headers 数组和 rows 二维数组', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }
    if (!Array.isArray(rows) || !rows.length) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'styledTable', missingField: 'rows[][]', hint: '需要至少 1 行数据', startY: resolveStartY(slide, explicitStartY, 1.0) });
    }

    // v4.1.4 (修 P2-3): 行数 > 8 真溢出（rowH 压到 0.25 下限仍越界 4.8）
    //   v4.2.0 之前不做真拆页（需 pipeline 级协调），先用截断 + 备注：
    //   保留前 7 行原文，第 8 行替换为 "（共 N 行，仅展示前 7 行，完整数据见附录）"
    const MAX_ROWS_PER_PAGE = 8;
    if (Array.isArray(rows) && rows.length > MAX_ROWS_PER_PAGE) {
      const totalRows = rows.length;
      const overflowNote = `（共 ${totalRows} 行，仅展示前 7 行，完整数据见附录）`;
      const noteRow = headers.map((_, i) => i === 0 ? overflowNote : '');
      rows = rows.slice(0, 7).concat([noteRow]);
      console.warn(`[BRINGPPT] styledTable rows (${totalRows}) > ${MAX_ROWS_PER_PAGE}, 自动截断到 7 行 + 备注（完整数据见附录）`);
      // 同步 rowAccentColors 长度
      if (Array.isArray(rowAccentColors) && rowAccentColors.length > 8) {
        rowAccentColors = rowAccentColors.slice(0, 7).concat([null]);
      }
    }

    // v4.1.6: 守护框
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;

    // v4.0.2: 支持自定义列宽 colWidths；不传则均分
    let colWArr;
    if (Array.isArray(colWidths) && colWidths.length === headers.length) {
      const sum = colWidths.reduce((a, b) => a + b, 0);
      // 若用户传入的宽度总和与 w 不等，按比例归一化到 w
      colWArr = colWidths.map(c => c * (w / sum));
    } else {
      colWArr = Array(headers.length).fill(w / headers.length);
    }
    // 用最窄列决定字号（防止某列太挤）
    const minColW = Math.min(...colWArr);

    // v4.0.2: 列数多/列宽窄时自动缩字号，防止 cell 内容 4+ 行 wrap 后溢出
    // 最窄列 ≥ 1.5" → 13pt, 1.2-1.5" → 12pt, 1.0-1.2" → 11pt, <1.0" → 10pt
    const cellFs    = minColW >= 1.5 ? 13 : (minColW >= 1.2 ? 12 : (minColW >= 1.0 ? 11 : 10));
    const headerFs  = Math.max(11, cellFs + 1);
    const lineH     = cellFs <= 11 ? 0.20 : 0.22;
    const minRowH   = cellFs <= 11 ? 0.32 : 0.35;

    const headerRow = headers.map(h => ({
      text: h,
      options: {
        fill: { color: C.PRIMARY },
        color: C.WHITE, bold: true,
        fontSize: headerFs, fontFace: FONTS.primary,
        align: "center", valign: "middle"
      }
    }));
    const dataRows = rows.map((row, ri) =>
      row.map(cell => {
        const isObj = typeof cell === "object" && cell !== null;
        const text = isObj ? cell.text : cell;
        const hl = isObj && cell.highlight;
        const customColor = isObj ? cell.color : undefined;
        return {
          text,
          options: {
            fill: { color: ri % 2 === 0 ? C.WHITE : C.BG_LIGHT },
            color: hl ? C.ACCENT : customColor || C.TEXT,
            bold: !!hl,
            fontSize: cellFs, fontFace: FONTS.primary,
            valign: "middle"
          }
        };
      })
    );
    const headerH = 0.42;
    // v4.1.6: maxBottom 走守护框
    const maxBottom    = box.bottom;
    const summaryBlock = summary ? 0.57 : 0;
    const maxAvailH    = maxBottom - top - headerH - summaryBlock;

    let rowHeights = rows.map(row => {
      let maxLines = 1;
      row.forEach((cell, ci) => {
        const text = (typeof cell === "object" && cell !== null) ? cell.text : cell;
        if (!text) return;
        // v4.0.2: 用每列实际宽度 + cellFs 计算每行容纳字数（之前误用均分 colW）
        const cw = colWArr[ci] || (w / headers.length);
        const charsPerLine = Math.max(1, Math.floor(cw * 72 / cellFs * 0.8));
        const lines = String(text).split("\n").reduce((sum, seg) => sum + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0);
        if (lines > maxLines) maxLines = lines;
      });
      return Math.max(minRowH, maxLines * lineH + 0.10);
    });

    const totalRowH = rowHeights.reduce((a, b) => a + b, 0);
    if (totalRowH > maxAvailH) {
      const scale = maxAvailH / totalRowH;
      rowHeights = rowHeights.map(h => Math.max(0.25, h * scale));
      const newTotal = rowHeights.reduce((a, b) => a + b, 0);
      if (newTotal > maxAvailH) {
        console.warn(
          `[BRINGPPT] styledTable rows (${rows.length}) 超出可用高度 ${maxAvailH.toFixed(2)}" ` +
          `(已压缩到 rowH 下限 0.25"，建议拆页或减少行数)`
        );
      }
    }
    // v4.1.6: 纵向居中 — 总高 = headerH + sum(rowHeights) + summaryBlock
    const tableTotalH = headerH + rowHeights.reduce((a, b) => a + b, 0) + summaryBlock;
    const startY = top + Math.max(0, (maxBottom - top - tableTotalH) / 2);
    slide.addTable([headerRow, ...dataRows], {
      x: startX, y: startY, w,
      colW: colWArr,
      border: { pt: 0.5, color: C.BORDER },
      rowH: [headerH, ...rowHeights]
    });
    if (rowAccentColors && rowAccentColors.length > 0) {
      rowAccentColors.forEach((color, i) => {
        if (!color) return;
        const y = startY + headerH + rowHeights.slice(0, i).reduce((a, b) => a + b, 0);
        slide.addShape(pres.shapes.RECTANGLE, {
          x: startX, y, w: 0.06, h: rowHeights[i], fill: { color }
        });
      });
    }
    if (summary) {
      const tableBottom = startY + headerH + rowHeights.reduce((a, b) => a + b, 0);
      const sumY = tableBottom + 0.15;
      const sumText = typeof summary === "string" ? summary : summary.text;
      const sumColor = (typeof summary === "object" && summary.bgColor) || C.PRIMARY;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: startX, y: sumY, w, h: 0.42, rectRadius: 0.06, fill: { color: sumColor }
      });
      const tblSumFs = calcFitFontSize(sumText, w, 0.42, 14, { minFontSize: 11 });
      slide.addText(sumText, {
        x: startX, y: sumY, w, h: 0.42,
        fontSize: tblSumFs, fontFace: FONTS.primary, color: C.WHITE, bold: true,
        align: "center", valign: "middle", margin: 0, autoFit: true
      });
      const finalBottom = Math.min(sumY + 0.42, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'styledTable');
    } else {
      const finalBottom = Math.min(startY + headerH + rowHeights.reduce((a, b) => a + b, 0), maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'styledTable');
    }
  },
};
