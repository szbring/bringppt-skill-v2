'use strict';
// templates/hero-section.js — 戏剧化章节首页（顶咨级 hero / 明星模板）
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:           'heroSection',
  version:        '1.0.0',
  category:       '页面模板',
  description:    '戏剧化章节过渡页：左侧深色色块 + 超大字章节号 + 右侧标题与一句话',
  isPageTemplate: true,

  schema: {
    sectionNumber: { type: 'number', required: true },
    sectionTitle:  { type: 'string', required: true, warn: 18, error: 30 },
    sectionTitleEn:{ type: 'string', description: '英文副标题（可选）' },
    sectionSubtitle:{ type: 'string', warn: 40, error: 60 },
    accent:        { type: 'string', description: '强调金色 hex（可选）' },
  },

  usage: {
    when:    '客户提案核心章节过渡页，需要给视觉冲击与节奏停顿',
    notWhen: '常规中性章节用 sectionSlide；非关键章节',
    typicalHeight: 'full-page',
    scenarios: [
      { trigger: '提案章节首页', example: '"模块二 · 解决方案设计"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/hero-section.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  fromKeyPoints(keyPoints, page) {
    return {
      sectionNumber: (page && page.sectionNumber) || 1,
      sectionTitle:  (page && (page.sectionTitle || page.title)) || '章节',
      sectionTitleEn:(page && page.sectionTitleEn),
      sectionSubtitle:(page && (page.sectionSubtitle || page.subtitle)) || (keyPoints && keyPoints[0]) || '',
    };
  },

  render(pres, data, infra) {
    const { C, FONTS, shadow, ensureBrandMasters, calcFitFontSize, LOGO_PATH } = infra;
    const { sectionNumber, sectionTitle, sectionTitleEn, sectionSubtitle, accent } = data;
    ensureBrandMasters(pres);
    const slide = pres.addSlide({ masterName: 'BRING_LIGHT' });
    slide._fromMaster = true;

    const accentColor = accent || C.ACCENT;

    // 左侧 40% 深蓝色块（满高）
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 4.0, h: 5.63, fill: { color: C.PRIMARY },
    });
    // 左侧色块右边缘金色细线
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.0, y: 0, w: 0.04, h: 5.63, fill: { color: accentColor },
    });

    // v3.7.38: 章节号字号 220 → 160（避免在 3.5" 宽容器内竖排/换行/超框）
    slide.addText(String(sectionNumber).padStart(2, '0'), {
      x: 0.1, y: 1.3, w: 3.9, h: 2.6,
      fontSize: 160, fontFace: FONTS.numeric, bold: true,
      color: C.WHITE, transparency: 30,
      align: 'center', valign: 'middle', margin: 0,
    });

    // 左侧顶部小字 "CHAPTER"
    slide.addText('CHAPTER', {
      x: 0.3, y: 0.5, w: 3.5, h: 0.4,
      fontSize: 14, fontFace: FONTS.enSmall, bold: true,
      color: accentColor, charSpacing: 6,
      align: 'center', valign: 'middle', margin: 0,
    });

    // v4.1.1: 左侧底部 "MODULE NN"（上移避让 logo）
    // v4.1.4 (修 P1-6): 之前 charSpacing:4 + padStart 在 LibreOffice 渲染时 "01" 部分被
    //   误裁切（box 太窄 + 居中 align 让数字段落到右边缘外）。
    // v4.1.7 (修 P0-1): align:'center' + charSpacing:2 在 LibreOffice 下"01"被推出
    //   右边缘 → 数字被替换为 "(" / ":" 等相邻 ASCII 字形。
    //   解决：拆成两个 text box（"MODULE" + "NN"）各自定位，align:'left'
    //   完全消除字间距撑爆的可能。两段视觉间距用坐标精确控制。
    const modLabel = 'MODULE';
    const modNum   = String(sectionNumber).padStart(2, '0');
    // v4.1.7: 完全去掉 charSpacing，单一 text box 写完整 "MODULE 06"，box 足够宽（2.9"）
    slide.addText(`${modLabel} ${modNum}`, {
      x: 0.55, y: 4.5, w: 2.90, h: 0.4,
      fontSize: 12, fontFace: FONTS.enSmall, bold: true,
      color: C.WHITE, transparency: 50,
      align: 'center', valign: 'middle', margin: 0, wrap: false,
    });

    // v4.1.1: 左下白 BRING logo（左侧深色色块上的品牌标识，与正文页 BRING_LIGHT 母版 logo 位置对齐）
    try {
      const fsLogo = require('fs');
      const whiteLogoPath = path.join(__dirname, '../assets/bring_logo_white.png');
      const useLogoPath = fsLogo.existsSync(whiteLogoPath) ? whiteLogoPath : LOGO_PATH;
      slide.addImage({ path: useLogoPath, x: 1.45, y: 5.05, w: 1.1, h: 0.33 });
    } catch { /* logo 加载失败不影响主流程 */ }

    // 右侧：标题
    // v4.1.1: 字号 calcFitFontSize 自适应
    // v4.1.3 (修 N-5): 14-30 字超长标题在 v4.1.1 配置下 wrap 3 行越界。改进：
    //   1. h 由 1.45 → 1.7 (给 wrap 留充足空间)
    //   2. minFontSize 28 → 24 (长标题更激进缩字)
    //   3. 下方元素 y 改为基于 titleBottom 动态计算，不再写死
    const titleY = 1.7;
    const titleH = 1.7;
    const titleFs = calcFitFontSize(sectionTitle, 5.4, titleH, 48, { minFontSize: 24, lineSpacing: 1.15 });
    slide.addText(sectionTitle, {
      x: 4.4, y: titleY, w: 5.4, h: titleH,
      fontSize: titleFs, fontFace: FONTS.SERIF, bold: true,
      color: C.PRIMARY, valign: 'top', lineSpacingMultiple: 1.15, margin: 0,
    });
    // titleBottom 估算（保守取 titleY + titleH）
    // v4.1.4 (修 P1-6): 长标题 wrap 后 titleBottom 与英文副标题间距不足，
    //   视觉上副标题"粘"在标题底部。+0.12 缓冲让出呼吸空间。
    let curY = titleY + titleH + 0.12;

    // 英文副标题（v4.1.3: 紧跟 titleBottom）
    if (sectionTitleEn) {
      slide.addText(sectionTitleEn, {
        x: 4.4, y: curY, w: 5.4, h: 0.35,
        fontSize: 14, fontFace: FONTS.enSmall, italic: true,
        color: C.TEXT_LIGHT, charSpacing: 2, margin: 0,
      });
      curY += 0.4;
    }

    // 装饰金色短线（v4.1.3: 跟随上方 box 下沿）
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.4, y: curY, w: 0.5, h: 0.06, fill: { color: accentColor },
    });
    curY += 0.18;

    // 一句话副标题（v4.1.3: 限底部不越 logo 区 5.0）
    if (sectionSubtitle) {
      const subH = Math.max(0.5, Math.min(1.2, 5.0 - curY));
      slide.addText(sectionSubtitle, {
        x: 4.4, y: curY, w: 5.4, h: subH,
        fontSize: 16, fontFace: FONTS.primary, italic: true,
        color: C.TEXT, lineSpacingMultiple: 1.5, valign: 'top', margin: 0,
      });
    }

    return slide;
  },
};
