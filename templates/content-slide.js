'use strict';
// templates/content-slide.js
// Source: bring-core.js L274-320
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:           'contentSlide',
  version:        '1.0.0',
  category:       '页面模板',
  description:    '标准内容页，带标题、章节标签、互动问题和来源引用，作为其他布局的底座页面',
  isPageTemplate: true,

  schema: {
    title:              { type: 'string', required: true,  description: '页面主标题（中文）' },
    titleEn:            { type: 'string', required: false, description: '页面英文副标题（如 "Work Arrangement"），高级商务风' },
    sectionTag:         { type: 'string|object', required: false, description: '章节标签，字符串或 { text, color }' },
    engagementQuestion: { type: 'string', required: false, description: '互动思考题，显示在页面底部' },
    sourceRef:          { type: 'string', required: false, description: '数据来源引用，右对齐显示在底部' },
    takeaway:           { type: 'string', required: false, description: 'v4.0.5: 一句话告诉客户本页要做什么决定，14pt 灰字显示在标题下方' },
    chapterInfo:        { type: 'object', required: false, description: 'v4.0.5: 章节脚标信息 {number, title, pageInChapter, pagesInChapter}（由 converter 自动注入）' },
    variant:            { type: 'string', required: false, description: 'v4.0.5: internal (默认) / proposal — proposal 模式使用 serif 字体与暖纸底' },
  },

  usage: {
    when:    '所有标准内容页，作为图表、列表、卡片等布局的底座；需要标题+内容区域时使用',
    notWhen: '封面页、章节页、引语页等特殊页面不使用',
    scenarios: [
          {
                "trigger": "标准内容页的底座（不单独使用）",
                "example": "内部工具，gen_ppt自动调用，不需要AI直接指定"
          }
    ],

    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/content-slide.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    return {
      title:              (page && page.title) || '',
      sectionTag:         (page && page.sectionTag) || '',
      engagementQuestion: (page && page.engagementQuestion) || '',
      sourceRef:          (page && page.sourceRef) || '',
    };
  },



  render(pres, data, infra) {
    const { C, ensureBrandMasters, FONTS, calcFitFontSize, LOGO_PATH, setLayoutBottom } = infra;
    const { title, titleEn, sectionTag, engagementQuestion, sourceRef,
            takeaway, chapterInfo, variant } = data;
    const isProposal = variant === 'proposal';
    const titleFontFace = isProposal ? FONTS.SERIF : FONTS.primary;

    ensureBrandMasters(pres);
    const slide = pres.addSlide({ masterName: 'BRING_LIGHT' });
    slide._fromMaster = true;
    // background + logo + slideNumber 由 BRING_LIGHT 母版提供，无需重复

    // v3.7.29 标题区拉到顶咨级权重：fontSize 24→28pt, height 0.55→0.75，下方蓝色装饰线
    // v4.0.2: 标题宽度动态收缩避开 sectionTag chip（之前固定 w=9.0 与 chip 区 [8.32,9.7] 重叠）
    let titleW = 9.0;
    if (sectionTag) {
      const tagText = typeof sectionTag === "string" ? sectionTag : (sectionTag.text || '');
      const tagW = tagText.length * 0.22 + 0.5;
      titleW = Math.max(5.0, 9.5 - tagW - 0.4);  // chip 左缘 - 0.1" 间距
    }
    // v4.0.2: 标题字号自动缩小保持单行（避免 wrap 后撞下方 layout 起点 y=1.0）
    // v4.1.8 (修 P2-C): 极端长 title 允许下探到 14pt（之前 18pt 撑不下时 wrap 撞装饰带）
    const titleFs = calcFitFontSize(title, titleW, 0.55, 28, { minFontSize: 14, lineSpacing: 1.1 });
    // v4.0.5: proposal 变体下背景换暖纸底（先画背景再画标题）
    // v4.0.6: 暖纸底全屏矩形画完后 re-add master logo（否则被覆盖）
    if (isProposal && C.BG_PAPER) {
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 10, h: 5.625,
        fill: { color: C.BG_PAPER }, line: { color: C.BG_PAPER, width: 0 },
      });
      // 重新画 logo，因为暖纸底矩形把 master image 盖了
      try {
        slide.addImage({ path: LOGO_PATH, x: 0.4, y: 4.95, w: 1.1, h: 0.33 });
      } catch (e) { /* logo 加载失败不影响主流程 */ }
    }
    if (titleEn) {
      const titleEnFs = Math.max(14, Math.round(titleFs * 0.65));
      slide.addText([
        { text: title, options: { fontSize: titleFs, fontFace: titleFontFace, bold: true, color: C.TITLE_BLUE } },
        { text: '  ' + titleEn, options: { fontSize: titleEnFs, fontFace: FONTS.numeric, bold: false, color: C.TEXT_LIGHT } },
      ], {
        x: 0.5, y: 0.30, w: titleW, h: 0.65,
        margin: 0, valign: 'middle',
      });
    } else {
      slide.addText(title, {
        x: 0.5, y: 0.30, w: titleW, h: 0.65,
        fontSize: titleFs, fontFace: titleFontFace,
        color: C.TITLE_BLUE, bold: true, margin: 0,
      });
    }
    // v4.1.1 (修 Mi-6): 标记页面已有标题，下游 layout（如 chartBar）跳过自己的小标题避免重复
    slide._hasContentTitle = true;
    // v4.0.5 (P2-6): takeaway 一句话——告诉客户本页要做的决定
    //   字号自适应保持单行（避免 wrap 后撞下方 layout 起始 y=1.1）
    // v4.0.6: 设置 slide._bottomY 让下方 layout 自动接力到 startY=1.35（隔 0.25" 间距）
    // v4.1.5 (修 Fix-1): _bottomY 从 1.05 → 1.20，下游 layout 接力到 startY ≥ 1.45，
    //   与 takeaway 底部 (1.05) 间距 ≥ 0.40"，视觉舒朗（避免 takeaway 与 layout 紧贴）
    if (takeaway) {
      const takeawayFs = calcFitFontSize(takeaway, titleW, 0.22, 13, { minFontSize: 9, lineSpacing: 1.0 });
      slide.addText(takeaway, {
        x: 0.5, y: 0.83, w: titleW, h: 0.22,
        fontSize: takeawayFs, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_LIGHT, margin: 0, valign: 'top',
      });
      // v4.1.5: 让下方 layout 从 1.45 开始（takeaway 底部 1.05 + 0.40 间距）
      slide._bottomY = 1.20;
    }
    // v3.7.36: 移除标题下短横线（用户偏好——保持顶部干净）
    if (sectionTag) {
      const tagText = typeof sectionTag === "string" ? sectionTag : sectionTag.text;
      const tagColor = (typeof sectionTag === "object" && sectionTag.color) || C.ACCENT;
      const tagW = tagText.length * 0.22 + 0.5;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: 10 - tagW - 0.3, y: 0.15, w: tagW, h: 0.35,
        rectRadius: 0.16, fill: { color: tagColor }
      });
      slide.addText(tagText, {
        x: 10 - tagW - 0.3, y: 0.15, w: tagW, h: 0.35,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
    }
    if (engagementQuestion) {
      slide.addText(engagementQuestion, {
        x: 1.5, y: 4.65, w: 7.0, h: 0.35,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.ACCENT, italic: true, margin: 0
      });
      // v4.1.8 (修 P3-C): 同步设置 _layoutBottom 避免字段漂移
      if (setLayoutBottom) setLayoutBottom(slide, 4.55);
      else { slide._contentMaxBottom = 4.55; slide._layoutBottom = 4.55; }
    }
    if (sourceRef) {
      // v4.0.6: 与 section footer 同 y/h，valign middle → 与 logo 中线对齐
      slide.addText(sourceRef, {
        x: 1.5, y: 4.97, w: 7.0, h: 0.33,
        fontSize: 9, fontFace: FONTS.primary, italic: true,
        color: C.TEXT_LIGHT, align: "right", valign: 'middle', margin: 0
      });
    }
    // v4.0.5 (P1-3): section footer 章节脚标（底部左侧）
    //   格式："02  章节标题  |  3/5"
    if (chapterInfo && chapterInfo.number) {
      const num = String(chapterInfo.number).padStart(2, '0');
      const titleAbbr = (chapterInfo.title || '').slice(0, 14);
      const pagePos = chapterInfo.pageInChapter && chapterInfo.pagesInChapter
        ? `   |   ${chapterInfo.pageInChapter}/${chapterInfo.pagesInChapter}`
        : '';
      // v4.0.6: y=5.05 + valign=middle h=0.33 → 与 logo (y=4.95/5.0 + h=0.33) 中线对齐
      slide.addText([
        { text: num,          options: { fontSize: 9, fontFace: FONTS.numeric, bold: true, color: C.ACCENT } },
        { text: '  ',         options: { fontSize: 9 } },
        { text: titleAbbr,    options: { fontSize: 9, fontFace: isProposal ? FONTS.SERIF : FONTS.primary, color: C.TEXT_LIGHT } },
        { text: pagePos,      options: { fontSize: 9, fontFace: FONTS.enSmall, color: C.TEXT_SUB } },
      ], {
        x: 1.5, y: 4.97, w: 6.0, h: 0.33,
        valign: 'middle', align: 'left', margin: 0,
      });
    }
    // v4.1.5 (修 Fix-2): 4.8 → 4.85 — logo 上沿 4.95 减 0.10" 视觉缓冲
    if (!slide._contentMaxBottom) {
      // v4.1.8 (修 P3-C): 同步两个字段
      if (setLayoutBottom) setLayoutBottom(slide, 4.85);
      else { slide._contentMaxBottom = 4.85; slide._layoutBottom = 4.85; }
    }
    return slide;
  },
};
