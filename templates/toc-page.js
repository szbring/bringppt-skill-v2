'use strict';
// templates/toc-page.js
// Source: bring-core.js L2922-3055
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:           'tocPage',
  version:        '1.0.0',
  category:       '页面模板',
  description:    '目录页，支持列表式（list）和网格式（grid）两种布局，带编号圆圈和章节标题',
  isPageTemplate: true,

  schema: {
    title:    { type: 'string', required: false, description: '目录标题，默认"目录"' },
    items:    { type: 'array',  required: true,  description: '目录项数组，每项含 { title, subtitle?, number?, targetSlide? }；targetSlide 为目标 slide 索引（从 1 开始），存在时该项可点击跳转' },
    style:    { type: 'string', required: false, description: '布局风格：list（默认）/ grid（两列网格）/ sidebar（左色块 + 右两列编号列表，高级商务风）' },
    titleEn:  { type: 'string', required: false, description: '英文副标题（仅 sidebar 风格使用，如 "Contents"）' },
  },

  usage: {
    when:    '演示文稿目录页，列出各章节或模块，通常放在封面页之后',
    notWhen: '内容页、章节页不使用',
    scenarios: [
          {
                "trigger": "目录页，列出PPT章节结构",
                "example": "4-5个章节的目录，带编号圆圈和章节说明"
          },
          {
                "trigger": "注意：作为顶层页面，type必须是'toc'，不能是content+layout:tocPage",
                "example": "正确：{type:'toc', items:[...]}，错误：{type:'content', layouts:[{type:'tocPage'}]}"
          }
    ],

    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/toc-page.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const items = (keyPoints || []).slice(0, 12).map((kp, i) => {
      const { title, desc } = splitTitleDesc(kp);
      return { number: String(i + 1).padStart(2, '0'), title: title || kp, subtitle: desc || '' };
    });
    return { items, title: (page && page.title) || '目录' };
  },



  render(pres, data, infra) {
    const { C, STEP_COLORS, shadow, ensureBrandMasters, FONTS } = infra;
    // v3.7.19: 默认风格 'classic' 仿 01 模板 P6（顶部中英文标题 + 大字编号行 + 右下 CONTENTS 装饰）
    const { title = '目录', titleEn = 'Contents', items = [], style = 'classic' } = data;

    ensureBrandMasters(pres);
    const slide = pres.addSlide({ masterName: 'BRING_LIGHT' });
    slide._fromMaster = true;

    const count = items.length;

    // ─── classic 风格（v3.7.20，仿 01 P6，左编号列表 + 右建筑图）─────
    if (style === 'classic') {
      // 顶部："目录｜Contents"
      slide.addText([
        { text: title, options: { fontSize: 32, fontFace: FONTS.primary, bold: true, color: C.PRIMARY } },
        { text: '｜', options: { fontSize: 32, fontFace: FONTS.primary, color: C.BLUE_LIGHT } },
        { text: titleEn, options: { fontSize: 22, fontFace: FONTS.enSmall, color: C.TEXT_LIGHT } },
      ], { x: 0.6, y: 0.45, w: 9.0, h: 0.6, margin: 0 });

      // 底部蓝线分隔
      slide.addShape(pres.shapes.LINE, {
        x: 0.6, y: 1.15, w: 1.5, h: 0,
        line: { color: C.PRIMARY, width: 2.5 },
      });

      // 右侧：建筑图（仿 01 P6 风格）─ 占右半页，圆角
      const buildingImg = path.join(__dirname, '../assets/cover-building.jpg');
      if (fs.existsSync(buildingImg)) {
        // 右侧蓝色阴影底块作为图片衬底
        slide.addShape(pres.shapes.RECTANGLE, {
          x: 5.45, y: 1.45, w: 4.1, h: 3.65,
          fill: { color: C.PRIMARY },
          line: { type: 'none' },
        });
        slide.addImage({
          path:    buildingImg,
          x:       5.4, y: 1.4, w: 4.1, h: 3.65,
          // 不加 sizing，让图片完整填充指定区域
        });
        // 蓝色半透明覆盖增强商务感
        slide.addShape(pres.shapes.RECTANGLE, {
          x: 5.4, y: 1.4, w: 4.1, h: 3.65,
          fill: { color: C.PRIMARY, transparency: 70 },
          line: { type: 'none' },
        });
      }

      // 右下大字装饰 "CONTENTS"（放在图片上方，半透明）
      // v4.1.7 (修 P1-5): LibreOffice 下 charSpacing 把字母推出 box 右边缘 → "S" 被切。
      //   彻底去 charSpacing + 缩字号 28，wrap:false + align:'center' 居中显示。
      slide.addText('CONTENTS', {
        x: 5.4, y: 4.5, w: 4.0, h: 0.5,
        fontSize: 28, fontFace: FONTS.enSmall, bold: true,
        color: C.WHITE, transparency: 30,
        align: 'center', valign: 'middle', margin: 0,
        wrap: false,
      });

      if (count === 0) return slide;

      // v3.7.38: 一页内自适应展示所有 items（用户反馈 "目录内容1页放不下，缩小文字、紧缩布局，在一页内展示所有目录内容"）
      // 根据 count 自动选择密度档：≤4 大字疏排，5-6 中字，7-10 小字密排
      // v4.1.1 (修 Mi-4): 11-16 章超密排（双列），≥17 改为左侧单列只显示 12 项 + 备注
      const visible = items.slice(0, Math.min(count, 16));
      const n = visible.length;
      const dense = n > 4;
      const verydense = n > 6;
      const ultradense = n > 10;   // v4.1.1: 11-16 章触发双列

      const startY = dense ? 1.3 : 1.6;
      const rowGap = ultradense ? 0.03 : (verydense ? 0.05 : (dense ? 0.10 : 0.15));
      const availH = ultradense ? 3.6 : (verydense ? 3.5 : 3.7);
      // ultradense 用双列：每列最多 8 行
      const rowsPerCol = ultradense ? Math.ceil(n / 2) : n;
      const rowH   = Math.min(0.75, (availH - (rowsPerCol - 1) * rowGap) / rowsPerCol);
      const listW  = ultradense ? 2.3 : 4.5;

      const numFs   = ultradense ? 18 : (verydense ? 24 : (dense ? 32 : 40));
      const titleFs = ultradense ? 11 : (verydense ? 13 : (dense ? 15 : 16));
      const subFs   = ultradense ? 8  : (verydense ? 9  : 10);
      const numW    = ultradense ? 0.7 : (verydense ? 1.0 : (dense ? 1.15 : 1.3));
      const textX   = 0.6 + numW + 0.1;

      visible.forEach((item, i) => {
        // v4.1.1 (修 Mi-4): ultradense 双列布局
        let rowIndex = i, colOffsetX = 0;
        if (ultradense) {
          colOffsetX = (i >= rowsPerCol) ? 2.7 : 0;
          rowIndex = i % rowsPerCol;
        }
        const y = startY + rowIndex * (rowH + rowGap);
        const numStr = item.number || String(i + 1).padStart(2, '0');

        // 大字编号
        slide.addText(numStr + '-', {
          x: 0.6 + colOffsetX, y, w: numW, h: rowH,
          fontSize: numFs, fontFace: FONTS.numeric, bold: true,
          color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
        });

        // 中文标题
        const titleOpts = {
          x: textX + colOffsetX, y, w: listW - (textX - 0.6), h: item.subtitle ? rowH * 0.6 : rowH,
          fontSize: titleFs, fontFace: FONTS.primary, bold: true,
          color: C.TEXT, valign: item.subtitle ? 'bottom' : 'middle', margin: 0,
        };
        if (item.targetSlide) {
          titleOpts.hyperlink = { slide: item.targetSlide, tooltip: '跳转到：' + item.title };
        }
        slide.addText(item.title, titleOpts);

        // 英文/副标题（仅疏排或中密时显示，避免溢出）
        if (item.subtitle && !verydense) {
          slide.addText(item.subtitle, {
            x: textX + colOffsetX, y: y + rowH * 0.6, w: listW - (textX - 0.6), h: rowH * 0.4,
            fontSize: subFs, fontFace: FONTS.enSmall,
            color: C.TEXT_LIGHT, valign: 'top', margin: 0,
          });
        }
      });

      // v4.1.1: 超过 16 项才提示（11-16 已用双列承载）
      if (count > 16) {
        slide.addText(`+ 还有 ${count - 16} 项（共 ${count} 章）`, {
          x: textX, y: startY + rowsPerCol * (rowH + rowGap), w: 3.2, h: 0.3,
          fontSize: 10, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, italic: true, margin: 0,
        });
      }
      return slide;
    }

    // ─── sidebar 风格：左色块 / 右两列编号（顶咨商务模板风）──────
    if (style === 'sidebar') {
      // 左色块（覆盖 0-3.5"）
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 3.5, h: 5.63, fill: { color: C.PRIMARY },
      });
      // 标题在左色块顶部
      slide.addText(title, {
        x: 0.3, y: 1.8, w: 3.0, h: 0.7,
        fontSize: 36, fontFace: FONTS.primary, bold: true,
        color: C.WHITE, valign: 'middle', margin: 0,
      });
      slide.addShape(pres.shapes.LINE, {
        x: 0.3, y: 2.6, w: 0.8, h: 0,
        line: { color: C.WHITE, width: 1.5 },
      });
      slide.addText(titleEn, {
        x: 0.3, y: 2.7, w: 3.0, h: 0.5,
        fontSize: 22, fontFace: FONTS.enSmall, bold: true,
        color: C.WHITE, transparency: 25, valign: 'middle', margin: 0,
      });

      if (count === 0) return slide;

      // 右侧两列编号（最多 6 项）
      const rightStartX = 4.0;
      const colW = 2.8;
      const colGap = 0.2;
      const rowH = Math.min(0.85, 4.5 / Math.ceil(count / 2));
      items.slice(0, 6).forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = rightStartX + col * (colW + colGap);
        const y = 0.6 + row * (rowH + 0.3);
        const numStr = item.number || String(i + 1).padStart(2, '0');

        // 大编号
        slide.addText(numStr + '-', {
          x, y, w: 0.9, h: rowH,
          fontSize: 32, fontFace: FONTS.numeric, bold: true,
          color: C.PRIMARY, valign: 'middle', margin: 0,
        });

        // 中文标题
        const titleOpts = {
          x: x + 0.9, y, w: colW - 0.9, h: rowH * 0.55,
          fontSize: 14, fontFace: FONTS.primary, bold: true,
          color: C.TEXT, valign: 'bottom', margin: 0,
        };
        if (item.targetSlide) {
          titleOpts.hyperlink = { slide: item.targetSlide, tooltip: '跳转到：' + item.title };
        }
        slide.addText(item.title, titleOpts);

        // 英文副标题（若有）
        if (item.subtitle) {
          slide.addText(item.subtitle, {
            x: x + 0.9, y: y + rowH * 0.55, w: colW - 0.9, h: rowH * 0.4,
            fontSize: 10, fontFace: FONTS.enSmall,
            color: C.TEXT_LIGHT, valign: 'top', margin: 0,
          });
        }
      });
      return slide;
    }

    // Left blue vertical bar decoration（list / grid 风格共用）
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 0.4, h: 5.63, fill: { color: C.SECONDARY }
    });

    // Title area
    slide.addText([
      { text: title, options: { fontSize: 28, fontFace: FONTS.primary, bold: true, color: C.PRIMARY } },
      { text: " | " + titleEn, options: { fontSize: 18, fontFace: FONTS.primary, color: C.TEXT_LIGHT } }
    ], { x: 0.75, y: 0.3, w: 8.5, h: 0.6, margin: 0 });



    if (count === 0) { return slide; }  // footer 由母版提供

    if (style === "grid") {
      // 2-column grid layout
      const columns = 2;
      const rows = Math.ceil(count / columns);
      const colW = 3.8, gap = 0.3;
      const startX = 0.75;
      const startY = 1.3;
      const availH = 3.5;
      const rowH = Math.min(0.7, (availH - (rows - 1) * 0.15) / rows);
      const circleD = Math.min(0.5, rowH - 0.1);

      items.forEach((item, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = startX + col * (colW + gap);
        const y = startY + row * (rowH + 0.15);
        const color = STEP_COLORS[i % STEP_COLORS.length];

        // Numbered circle
        slide.addShape(pres.shapes.OVAL, {
          x, y: y + (rowH - circleD) / 2, w: circleD, h: circleD,
          fill: { color }, shadow: shadow()
        });
        slide.addText(item.number || String(i + 1).padStart(2, "0"), {
          x, y: y + (rowH - circleD) / 2, w: circleD, h: circleD,
          fontSize: 16, fontFace: FONTS.primary,
          color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
        });

        // Title text（如有 targetSlide 则带超链接）
        const textX = x + circleD + 0.15;
        const textW = colW - circleD - 0.15;
        const titleOpts = {
          x: textX, y, w: textW, h: item.subtitle ? rowH * 0.6 : rowH,
          fontSize: 15, fontFace: FONTS.primary,
          color: C.TEXT, bold: true, valign: item.subtitle ? "bottom" : "middle", margin: 0
        };
        if (item.targetSlide) {
          titleOpts.hyperlink = { slide: item.targetSlide, tooltip: '跳转到：' + item.title };
        }
        slide.addText(item.title, titleOpts);
        if (item.subtitle) {
          slide.addText(item.subtitle, {
            x: textX, y: y + rowH * 0.55, w: textW, h: rowH * 0.45,
            fontSize: 11, fontFace: FONTS.primary,
            color: C.TEXT_LIGHT, valign: "top", margin: 0
          });
        }
      });
    } else {
      // Vertical list layout (default)
      const startY = 1.3;
      const availH = 3.6;
      const rowH = Math.min(0.65, (availH - (count - 1) * 0.12) / count);
      const circleD = Math.min(0.52, rowH - 0.08);
      const startX = 1.2;
      const totalW = 7.5;

      items.forEach((item, i) => {
        const y = startY + i * (rowH + 0.12);
        const color = STEP_COLORS[i % STEP_COLORS.length];

        // Subtle background row highlight on hover
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
          x: startX - 0.1, y, w: totalW + 0.2, h: rowH,
          rectRadius: 0.06, fill: { color: C.BG_LIGHT }
        });

        // Numbered circle
        slide.addShape(pres.shapes.OVAL, {
          x: startX, y: y + (rowH - circleD) / 2, w: circleD, h: circleD,
          fill: { color }, shadow: shadow()
        });
        slide.addText(item.number || String(i + 1).padStart(2, "0"), {
          x: startX, y: y + (rowH - circleD) / 2, w: circleD, h: circleD,
          fontSize: 18, fontFace: FONTS.primary,
          color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
        });

        // Title（如有 targetSlide 则带超链接）
        const textX = startX + circleD + 0.25;
        const textW = totalW - circleD - 0.25;
        const titleOpts = {
          x: textX, y, w: textW, h: item.subtitle ? rowH * 0.6 : rowH,
          fontSize: 18, fontFace: FONTS.primary,
          color: C.TEXT, bold: true, valign: item.subtitle ? "bottom" : "middle", margin: 0
        };
        if (item.targetSlide) {
          titleOpts.hyperlink = { slide: item.targetSlide, tooltip: '跳转到：' + item.title };
        }
        slide.addText(item.title, titleOpts);
        if (item.subtitle) {
          slide.addText(item.subtitle, {
            x: textX, y: y + rowH * 0.55, w: textW, h: rowH * 0.45,
            fontSize: 12, fontFace: FONTS.primary,
            color: C.TEXT_LIGHT, valign: "top", margin: 0
          });
        }

        // Connecting line to next item
        if (i < count - 1) {
          const lineX = startX + circleD / 2;
          slide.addShape(pres.shapes.LINE, {
            x: lineX, y: y + rowH, w: 0, h: 0.12,
            line: { color: C.BORDER, width: 1.5, dashType: "dash" }
          });
        }
      });
    }

    // footer 由 BRING_LIGHT 母版提供
    return slide;
  },
};
