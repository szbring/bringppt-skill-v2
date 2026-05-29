'use strict';
// templates/layered-list.js
// Source: bring-core.js L1335-1415
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        'layeredList',
  version:     '1.0.0',
  category:    '矩阵/框架型',
  description: '分层列表：带标签的层级结构，含箭头连接和汇总栏',

  schema: {
    banner:   { type: 'object',  description: '顶部横幅 {text, bgColor}（可选）' },
    layers:   { type: 'array',   required: true, description: '层级列表 [{tag, tagColor, title, desc}]', item: { title: { type: 'string', warn: 15, error: 22 }, desc: { type: 'string', warn: 40, error: 60 } } },
    summary:  { type: 'string',  warn: 50, error: 80, description: '底部汇总文本（可选）' },
    startY:   { type: 'number',  description: '起始Y坐标（可选）' },
  },

  usage: {
    when:          '流程分层、战略层级、架构层次说明',
    notWhen:       '数据对比、时间线、图片展示',
    scenarios: [
          {
                "trigger": "分层级的列表，有主次关系",
                "example": "战略层→执行层→操作层，每层有标签和具体条目"
          },
          {
                "trigger": "有分类汇总的结构化清单",
                "example": "三类风险：各类有标签，展开后有具体项目"
          }
    ],

    typicalHeight: '2.5~4.0英寸',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/layered-list.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.9: keyPoints 适配器（从 storyboard-converter 自动迁移）
  // v3.7.24/v3.7.29: 默认开启 banner + 短描述自动扩展到 ≥15 字
  // v4.1.4 (修 P1-2): 入口处宽容解析 LLM 常见错写：
  //   - page.layers / page.levels / page.tiers 字段直传
  //   - 对象 layers: [{tag, title, desc}] / [{label, text}]
  //   - banner 字符串或对象
  fromKeyPoints(keyPoints, page) {
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const { padShortDesc } = require('../lib/adapter-helpers');
    // v4.1.4 宽容解析：page 上常见 alias 字段
    if (page) {
      const altSource = page.layers || page.levels || page.tiers;
      if (Array.isArray(altSource) && altSource.length) {
        const layers = altSource.slice(0, 4).map((l, i) => {
          if (typeof l === 'string') {
            const { title, desc } = splitTitleDesc(l);
            return { tag: `L${i+1}`, title: title || l, desc: padShortDesc(title || l, desc, 15) };
          }
          if (l && typeof l === 'object') {
            const title = String(l.title || l.name || l.heading || l.label || `层级 ${i+1}`).trim();
            const desc  = String(l.desc || l.description || l.text || l.content || l.detail || '').trim();
            return {
              tag:   String(l.tag || `L${i+1}`),
              tagColor: l.tagColor,
              title,
              desc:  padShortDesc(title, desc, 15),
            };
          }
          return { tag: `L${i+1}`, title: `层级 ${i+1}`, desc: String(l || '') };
        });
        let banner = page.banner;
        if (!banner) banner = { text: page.title || '层级分解' };
        return {
          banner,
          layers,
          summary: page.summary || `按 ${layers.length} 个层级从上至下展开`,
        };
      }
    }
    const kps = keyPoints || [];
    const title = (page && page.title) || '层级分解';
    const layers = kps.slice(0, 4).map((kp, i) => {
            const { title: t, desc: d } = splitTitleDesc(kp);
            const finalTitle = t || kp;
            return {
              tag:   `L${i + 1}`,
              title: finalTitle,
              desc:  padShortDesc(finalTitle, d, 15),
            };
          });
          return {
            banner:  { text: title, bgColor: undefined },
            layers,
            summary: `按 ${layers.length} 个层级从上至下展开`,
          };
  },



  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, measureCharWidth,
            resolveStartY, validateBounds,
            renderIconSvg, iconToBase64Png, FONTS } = infra;
    // v4.0.4: 空值守卫
    // v4.1.8 (修 P3-A): 接受 5 种 alias — layers / levels / tiers / strata / hierarchy
    let { banner, layers, summary, startY: explicitStartY } = data;
    if (!Array.isArray(layers) || layers.length === 0) {
      const altSrc = data.levels || data.tiers || data.strata || data.hierarchy || [];
      layers = altSrc.map((l, i) => {
        if (typeof l === 'string') return { tag: `L${i+1}`, title: l.slice(0, 22), desc: l };
        if (l && typeof l === 'object') return {
          tag:   String(l.tag || `L${i+1}`),
          tagColor: l.tagColor,
          title: String(l.title || l.name || l.heading || l.label || `层级 ${i+1}`),
          desc:  String(l.desc || l.description || l.text || l.content || ''),
        };
        return { tag: `L${i+1}`, title: `层级 ${i+1}`, desc: String(l || '') };
      });
    }

    // v4.1.6: 守护框 + 居中
    const box = infra.getLayoutBox ? infra.getLayoutBox(slide) : { top: 1.20, bottom: slide._contentMaxBottom || 4.85, available: (slide._contentMaxBottom || 4.85) - 1.20 };
    const top = (explicitStartY != null) ? explicitStartY : box.top;
    if (!Array.isArray(layers) || layers.length === 0) {
      const { renderEmptyState } = require('../lib/render-empty-state');
      return renderEmptyState(slide, infra, { template: 'layeredList', missingField: 'layers[]', hint: '需要 2-5 个 {title, desc} 层级对象', startY: top });
    }
    const maxBottom = box.bottom;
    const lW = 8.5, lX = (10 - lW) / 2;
    const n = layers.length;
    const bannerSpace = banner ? 0.7 : 0;
    const summarySpace = summary ? 0.57 : 0;
    const arrowGap = 0.28;
    const arrowTotal = (n - 1) * arrowGap;
    const availH = maxBottom - top - bannerSpace - summarySpace - arrowTotal;
    const lH = Math.min(0.88, availH / n);
    // 纵向居中
    const totalH = bannerSpace + n * lH + arrowTotal + summarySpace;
    const startY = top + Math.max(0, (maxBottom - top - totalH) / 2);

    let curY = startY;
    if (banner) {
      // v4.0.5: banner 字段 alias — 接受字符串或 {text, bgColor}
      const bannerText  = typeof banner === 'string' ? banner : (banner.text || '');
      const bannerColor = (typeof banner === 'object' && banner.bgColor) || C.PRIMARY;
      const bX = lX;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: bX, y: curY, w: lW, h: 0.5, rectRadius: 0.06, fill: { color: bannerColor }
      });
      slide.addText(bannerText, {
        x: bX + 0.3, y: curY, w: lW - 0.6, h: 0.5,
        fontSize: 15, fontFace: FONTS.primary, color: C.WHITE, bold: true, valign: "middle", margin: 0
      });
      curY += 0.7;
    }
    const tagColors = [C.ACCENT, C.SECONDARY, C.SUCCESS, C.PRIMARY];
    const titleFs = lH < 0.7 ? 13 : 18;
    const descFs = lH < 0.7 ? 10 : 13;
    const tagH = lH < 0.7 ? 0.26 : 0.32;
    const tagPad = lH < 0.7 ? 0.06 : 0.12;
    const titleRowH = tagPad + tagH + 0.04;
    layers.forEach((layer, i) => {
      const tc = layer.tagColor || tagColors[i % tagColors.length];
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX, y: curY, w: lW, h: lH, rectRadius: 0.06, fill: { color: C.BG_LIGHT }
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x: lX, y: curY, w: 0.07, h: lH, fill: { color: C.SECONDARY }
      });
      // v4.0.4: tag 字段缺失时用序号 L1/L2/... 兜底
      const tagText = layer.tag || ('L' + (i + 1));
      const tagW = tagText.length * 0.22 + 0.4;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX + 0.25, y: curY + tagPad, w: tagW, h: tagH, rectRadius: 0.16, fill: { color: tc }
      });
      slide.addText(tagText, {
        x: lX + 0.25, y: curY + tagPad, w: tagW, h: tagH,
        fontSize: 11, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0
      });
      slide.addText(layer.title, {
        x: lX + 0.25 + tagW + 0.15, y: curY + tagPad - 0.04, w: lW - tagW - 0.7, h: tagH + 0.08,
        fontSize: titleFs, fontFace: FONTS.primary, color: C.PRIMARY, bold: true, valign: "middle", margin: 0
      });
      const descH = lH - titleRowH - 0.08;
      if (layer.desc && descH > 0.15) {
        slide.addText(layer.desc, {
          x: lX + 0.25, y: curY + titleRowH, w: lW - 0.5, h: descH,
          fontSize: descFs, fontFace: FONTS.primary, color: C.TEXT, lineSpacingMultiple: 1.3, margin: 0
        });
      }
      curY += lH;
      if (i < layers.length - 1) {
        slide.addShape(pres.shapes.DOWN_ARROW, {
          x: lX + lW / 2 - 0.12, y: curY + 0.02, w: 0.24, h: 0.2, fill: { color: C.SECONDARY }
        });
        curY += arrowGap;
      }
    });
    if (summary) {
      curY += 0.15;
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x: lX, y: curY, w: lW, h: 0.42, rectRadius: 0.06, fill: { color: C.PRIMARY }
      });
      const llSumFs = calcFitFontSize(summary, lW, 0.42, 14, { minFontSize: 11 });
      slide.addText(summary, {
        x: lX, y: curY, w: lW, h: 0.42,
        fontSize: llSumFs, fontFace: FONTS.primary, color: C.WHITE, bold: true, align: "center", valign: "middle", margin: 0, autoFit: true
      });
      const finalBottom = Math.min(curY + 0.42, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'layeredList');
    } else {
      const finalBottom = Math.min(curY, maxBottom);
      slide._bottomY = finalBottom;
      validateBounds(slide, finalBottom, 'layeredList');
    }
  },
};
