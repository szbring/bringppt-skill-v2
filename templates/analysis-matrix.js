'use strict';
// templates/analysis-matrix.js
// Source: bring-core.js L4327-4435
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'analysisMatrix',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '分析矩阵表格，带行列标题的彩色格子矩阵，适合框架分析',

  schema: {
    rowHeaders: { type: 'array', description: '行标题数组，最多8行' },
    colHeaders: { type: 'array', description: '列标题数组，最多6列' },
    cells:      { type: 'array', description: '二维数组，cells[row][col] 可为字符串或字符串数组' },
    title:      { type: 'string', description: '可选矩阵标题' },
    startY:     { type: 'number', description: '起始Y坐标（英寸）' },
  },

  usage: {
    when:          '展示SWOT、竞品对比、多维度分析框架',
    notWhen:       '行超过8或列超过6时',
    scenarios: [
          {
                "trigger": "能力评估、维度打分、对标分析",
                "example": "竞争对手能力矩阵：5家公司×8个维度，彩色格子直观对比"
          },
          {
                "trigger": "用户旅程地图、客户体验评估",
                "example": "5个旅程阶段×6个接触点，标注好/中/差体验"
          },
          {
                "trigger": "比styledTable更强调视觉对比时",
                "example": "有明显高/中/低分层的数据，用颜色深浅区分"
          }
    ],

    typicalHeight: '约3.5英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/analysis-matrix.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = keyPoints || [];
    const title = (page && page.title) || '';
    return {
            rowHeaders: kps.slice(0, 3).map(kp => splitTitleDesc(kp).title),
            colHeaders: ['指标一', '指标二', '指标三'],
            cells:      kps.slice(0, 3).map(() => ['', '', '']),
            title,
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    const { rowHeaders = [], colHeaders = [], cells = [[]], title: matrixTitle = "", startY: explicitStartY } = data;
  const startY = resolveStartY(slide, explicitStartY, 1.0);
  const maxBottom = slide._contentMaxBottom || 4.85;
  const totalW = 8.5, baseX = (10 - totalW) / 2;
  const availH = maxBottom - startY;

  const rowCount = Math.min(rowHeaders.length, 8);
  const colCount = Math.min(colHeaders.length, 6);
  if (rowCount < 1 || colCount < 1) return;

  let contentY = startY;

  // Optional title
  if (matrixTitle) {
    const titleFs = calcFitFontSize(matrixTitle, totalW, 0.35, 15, { minFontSize: 11 });
    slide.addText(matrixTitle, {
      x: baseX, y: contentY, w: totalW, h: 0.35,
      fontSize: titleFs, fontFace: FONTS.primary,
      color: C.PRIMARY, bold: true, align: "left", valign: "middle", margin: 0
    });
    contentY += 0.4;
  }

  const gridAvailH = maxBottom - contentY;
  const rowHeaderW = Math.min(1.5, totalW * 0.18);
  const colAreaW = totalW - rowHeaderW;
  const cellW = colAreaW / colCount;
  const headerRowH = 0.4;
  const cellH = Math.min(1.2, (gridAvailH - headerRowH) / rowCount);

  // Column headers (top row)
  colHeaders.slice(0, colCount).forEach((ch, ci) => {
    const cx = baseX + rowHeaderW + ci * cellW;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: contentY, w: cellW, h: headerRowH,
      fill: { color: C.PRIMARY },
      line: { color: C.WHITE, width: 1 }
    });
    const chFs = calcFitFontSize(ch, cellW - 0.1, headerRowH, 12, { minFontSize: 8 });
    slide.addText(ch, {
      x: cx + 0.05, y: contentY, w: cellW - 0.1, h: headerRowH,
      fontSize: chFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });
  });

  // Top-left corner cell
  slide.addShape(pres.shapes.RECTANGLE, {
    x: baseX, y: contentY, w: rowHeaderW, h: headerRowH,
    fill: { color: C.PRIMARY },
    line: { color: C.WHITE, width: 1 }
  });

  // Rows
  rowHeaders.slice(0, rowCount).forEach((rh, ri) => {
    const ry = contentY + headerRowH + ri * cellH;

    // Row header
    slide.addShape(pres.shapes.RECTANGLE, {
      x: baseX, y: ry, w: rowHeaderW, h: cellH,
      fill: { color: C.SECONDARY },
      line: { color: C.WHITE, width: 1 }
    });
    const rhFs = calcFitFontSize(rh, rowHeaderW - 0.1, cellH, 11, { minFontSize: 8 });
    slide.addText(rh, {
      x: baseX + 0.05, y: ry, w: rowHeaderW - 0.1, h: cellH,
      fontSize: rhFs, fontFace: FONTS.primary,
      color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
    });

    // Data cells
    const rowCells = cells[ri] || [];
    colHeaders.slice(0, colCount).forEach((_, ci) => {
      const cx = baseX + rowHeaderW + ci * cellW;
      const bgColor = (ri + ci) % 2 === 0 ? C.BG_LIGHT : C.WHITE;
      slide.addShape(pres.shapes.RECTANGLE, {
        x: cx, y: ry, w: cellW, h: cellH,
        fill: { color: bgColor },
        line: { color: C.BORDER, width: 1.2 }
      });

      const cellData = rowCells[ci];
      let cellText = "";
      if (Array.isArray(cellData)) {
        cellText = cellData.map(t => "•  " + t).join("\n");
      } else {
        cellText = String(cellData || "");
      }

      if (cellText) {
        const cellFs = calcFitFontSize(cellText, cellW - 0.15, cellH - 0.08, 10, { minFontSize: 7 });
        slide.addText(cellText, {
          x: cx + 0.08, y: ry + 0.04, w: cellW - 0.15, h: cellH - 0.08,
          fontSize: cellFs, fontFace: FONTS.primary,
          color: C.TEXT, lineSpacingMultiple: 1.2, valign: "middle", margin: 0
        });
      }
    });
  });

  const bottomY = contentY + headerRowH + rowCount * cellH;
  validateBounds(slide, bottomY);
  },
};
