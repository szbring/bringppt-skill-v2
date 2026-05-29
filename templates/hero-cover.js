'use strict';
// templates/hero-cover.js — 满版 hero 封面（左色块 + 右建筑图 + 金色 accent）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:           'heroCover',
  version:        '1.0.0',
  category:       '页面模板',
  description:    'Hero 封面：左侧深色色块（标题区）+ 右侧大图建筑 + 金色 accent + 客户/日期/讲师条',
  isPageTemplate: true,

  schema: {
    title:     { type: 'string', required: true, warn: 20, error: 35 },
    titleEn:   { type: 'string', warn: 30, error: 50 },
    subtitle:  { type: 'string', warn: 40, error: 60 },
    clientName:{ type: 'string', warn: 20, error: 30 },
    date:      { type: 'string' },
    reporter:  { type: 'string', warn: 25, error: 40 },
    image:     { type: 'string', description: '右侧图路径，默认走 assets/cover-building.jpg' },
  },

  usage: {
    when:    '提案封面 / 客户级首页，需要顶咨级第一印象',
    notWhen: '内部 / 中性场景用 coverSlide',
    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hero-cover.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    return {
      title:     (page && page.title) || '提案标题',
      titleEn:   page && page.titleEn,
      subtitle:  page && page.subtitle,
      clientName:page && page.clientName,
      date:      page && page.date,
      reporter:  page && page.reporter,
    };
  },

  render(pres, data, infra) {
    const { C, FONTS, calcFitFontSize, LOGO_PATH } = infra;
    const { title, titleEn, subtitle, clientName, date, reporter, image } = data;

    const slide = pres.addSlide();

    // 左侧 5.5" 深色色块
    const leftW = 5.5;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: leftW, h: 5.63, fill: { color: C.PRIMARY },
    });

    // 右侧建筑图
    const imgPath = image || path.join(__dirname, '../assets/cover-building.jpg');
    try {
      const fs2 = require('fs');
      if (fs2.existsSync(imgPath)) {
        slide.addImage({
          path: imgPath,
          x: leftW, y: 0, w: 10 - leftW, h: 5.63,
        });
        // 右侧蓝色半透明叠加（统一色调）
        slide.addShape(pres.shapes.RECTANGLE, {
          x: leftW, y: 0, w: 10 - leftW, h: 5.63,
          fill: { color: C.PRIMARY, transparency: 70 },
        });
      }
    } catch {}

    // v4.0.9: 删除 PROPOSAL 金线 + 标签（用户反馈：封面去掉 PROPOSAL 字样）
    // v4.0.9: BRING 白色 logo 从左上移到左下（顶咨封面"页脚品牌位"标准做法）

    // 中央主标题（v4.0.9: 删除 PROPOSAL 后上移补空间，y 1.9→1.2）
    const titleFs = calcFitFontSize(title, leftW - 1.0, 1.5, 40, { minFontSize: 26 });
    slide.addText(title, {
      x: 0.5, y: 1.2, w: leftW - 0.8, h: 1.6,
      fontSize: titleFs, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, valign: 'middle', lineSpacingMultiple: 1.2, margin: 0,
    });

    // 英文副标题
    if (titleEn) {
      slide.addText(titleEn, {
        x: 0.5, y: 2.9, w: leftW - 0.8, h: 0.5,
        fontSize: 16, fontFace: FONTS.enSmall, italic: true,
        color: C.WHITE, transparency: 35, margin: 0,
      });
    }

    // 装饰金线
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 3.55, w: 0.6, h: 0.04, fill: { color: C.ACCENT },
    });

    // 副标题/一句话
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5, y: 3.7, w: leftW - 0.8, h: 0.5,
        fontSize: 14, fontFace: FONTS.primary, italic: true,
        color: C.WHITE, transparency: 25, lineSpacingMultiple: 1.4, margin: 0,
      });
    }

    // 底部信息条（客户 · 日期 · 讲师）—— v4.0.9 上移给 logo 让位
    const bottomParts = [];
    if (clientName) bottomParts.push(clientName);
    if (date) bottomParts.push(date);
    if (reporter) bottomParts.push(reporter);
    if (bottomParts.length) {
      slide.addText(bottomParts.join('  ·  '), {
        x: 0.5, y: 4.55, w: leftW - 0.8, h: 0.35,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 25, margin: 0,
      });
    }

    // v4.0.9: BRING 白色 logo 放左下页脚位（与正文页母版 logo 位置 y=4.95 对齐）
    try {
      const fsLogo = require('fs');
      const whiteLogoPath = path.join(__dirname, '../assets/bring_logo_white.png');
      const useLogoPath = fsLogo.existsSync(whiteLogoPath) ? whiteLogoPath : LOGO_PATH;
      slide.addImage({ path: useLogoPath, x: 0.5, y: 5.05, w: 1.1, h: 0.33 });
    } catch { /* logo 加载失败不影响主流程 */ }

    // 底部薄金色边
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 5.59, w: 10, h: 0.04, fill: { color: C.ACCENT },
    });

    return slide;
  },
};
