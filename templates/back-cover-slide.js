'use strict';
// templates/back-cover-slide.js
// Source: bring-core.js L455-507
const path = require('path');
const fs   = require('fs');

// v3.6.1 — 薄云咨询默认联系方式
// 注意：不在 contact 里放 website（避免与顶层 website 字段重复展示）
// 调用方不传 contact 时自动使用此值
const BRING_DEFAULT_CONTACT = {
  phone:   '0755-2696-2497',
  email:   'BCIC-marketing@szbring.com',
};
const BRING_DEFAULT_WEBSITE = 'www.szbring.com';

// v3.6.1 — 默认二维码路径（skill 自带 assets/qrcode.jpg）
const DEFAULT_QR_PATH = path.join(__dirname, '..', 'assets', 'qrcode.jpg');

module.exports = {
  name:           'backCoverSlide',
  version:        '1.0.0',
  category:       '页面模板',
  description:    '结束封底页，蓝色背景，带感谢语、讲师信息、日期和网址',
  isPageTemplate: true,

  schema: {
    text:       { type: 'string', required: false, description: '主文字，默认"谢谢各位"' },
    subtitle:   { type: 'string', required: false, description: '副标题（金句），warn 30 字 error 50 字' },
    instructor: { type: 'string', required: false, description: '讲师姓名/机构' },
    dateLine:   { type: 'string', required: false, description: '日期信息' },
    website:    { type: 'string', required: false, description: '网站地址，默认 www.szbring.com' },
    style:      { type: 'string', required: false, description: '"default"（蓝底极简稳重）/ "speechBubble"（对话气泡）/ "minimal"（极简白底）' },
    qrCode:     { type: 'string', required: false, description: '二维码图片路径（默认自动使用 assets/qrcode.jpg；传 null 关闭）' },
    contact:    { type: 'object', required: false, description: '联系方式对象 { phone, email, address, wechat }；默认自动注入薄云联系方式（电话/邮箱/官网）；传 null 关闭' },
  },

  usage: {
    when:    '演示文稿最后一页，作为结束感谢页',
    notWhen: '封面页或中间页面不使用',
    scenarios: [
          {
                "trigger": "PPT最后一页结束页",
                "example": "谢谢+团队信息+公司+日期+网址——所有PPT的封底页"
          }
    ],

    typicalHeight: 'full-page',
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/back-cover-slide.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.10: keyPoints 适配器（补齐 89/89 覆盖）
  fromKeyPoints(keyPoints, page) {
    return {
      text:     (page && page.text) || '谢谢各位',
      subtitle: (page && page.subtitle) || ((keyPoints || [])[0]) || '',
      contact:  (page && page.contact) || {},
    };
  },



  render(pres, data, infra) {
    const { C, FONTS } = infra;
    // v3.6.1 — 薄云默认值：调用方传则用其值，否则使用默认；可显式传 contact=null 关闭
    const _contact = data.contact === undefined ? BRING_DEFAULT_CONTACT : data.contact;
    const _qrCode  = data.qrCode  === undefined ? (fs.existsSync(DEFAULT_QR_PATH) ? DEFAULT_QR_PATH : null) : data.qrCode;
    const {
      text = '谢谢各位', subtitle, instructor, dateLine,
      website = BRING_DEFAULT_WEBSITE, style = 'default',
    } = data;
    const qrCode  = _qrCode;
    const contact = _contact;

    const slide = pres.addSlide();

    // v3.6 — 共用辅助函数：渲染右下角二维码
    function renderQRCode(slide, opts = {}) {
      if (!qrCode) return;
      const { x = 8.0, y = 4.0, size = 1.2, label, labelColor } = opts;
      slide.addImage({ path: qrCode, x, y, w: size, h: size });
      if (label) {
        slide.addText(label, {
          x: x - 0.2, y: y + size + 0.05, w: size + 0.4, h: 0.25,
          fontSize: 9, fontFace: FONTS.primary,
          color: labelColor || C.TEXT_LIGHT,
          align: 'center', valign: 'middle', margin: 0,
        });
      }
    }

    // v3.6 — 共用辅助函数：渲染联系方式信息行（支持电话/邮箱/官网/地址/微信）
    function renderContactRow(slide, opts = {}) {
      if (!contact) return;
      const { x = 1.0, y = 4.85, w = 6.5, color = C.WHITE, opacity = 25, align = 'left' } = opts;
      const items = [];
      if (contact.phone)   items.push('☎ ' + contact.phone);
      if (contact.email)   items.push('✉ '  + contact.email);
      if (contact.website) items.push('🌐 ' + contact.website);
      if (contact.address) items.push('📍 ' + contact.address);
      if (contact.wechat)  items.push('微信：' + contact.wechat);
      if (items.length === 0) return;
      slide.addText(items.join('   ·   '), {
        x, y, w, h: 0.3,
        fontSize: 11, fontFace: FONTS.primary,
        color, transparency: opacity,
        align, valign: 'middle', margin: 0,
      });
    }

    // ─── style: speechBubble — 灰底 + 蓝色对话气泡（顶咨模板风）──────
    if (style === 'speechBubble') {
      slide.background = { color: C.BG_PANEL };

      // 主气泡矩形（左上 1.0", 1.0"；宽 8"，高 3.5"）
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 1.0, y: 1.0, w: 8.0, h: 3.5,
        fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      });
      // 气泡下方的小三角"嘴"（用 ISOSCELES_TRIANGLE 倒立）
      slide.addShape(pres.shapes.ISOSCELES_TRIANGLE, {
        x: 1.8, y: 4.5, w: 0.5, h: 0.5,
        fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
        flipV: true,
      });

      // 主文字（巨号 THANK YOU 风格）
      slide.addText(text === '谢谢各位' ? 'THANK YOU' : text, {
        x: 1.0, y: 1.5, w: 8.0, h: 1.0,
        fontSize: 60, fontFace: FONTS.numeric, bold: true,
        color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
        charSpacing: 8,
      });

      // 中文副标题（v3.6 升级：14pt → 22pt，承载金句更有分量）
      if (subtitle) {
        slide.addText(subtitle, {
          x: 1.2, y: 2.65, w: 7.6, h: 0.6,
          fontSize: 22, fontFace: FONTS.primary,
          color: C.WHITE, transparency: 10, italic: true,
          align: 'center', valign: 'middle', margin: 0,
        });
      }

      // 讲师/日期组合行
      const lines = [];
      if (instructor) lines.push('汇报人：' + instructor);
      if (dateLine)   lines.push('日期：' + dateLine);
      if (lines.length) {
        slide.addText(lines.join('     '), {
          x: 1.0, y: 3.7, w: qrCode ? 6.5 : 8.0, h: 0.4,
          fontSize: 14, fontFace: FONTS.primary,
          color: C.WHITE, transparency: 20,
          align: 'center', valign: 'middle', margin: 0,
        });
      }

      // v3.6：联系方式（避开右下二维码区域）
      renderContactRow(slide, { x: 1.2, y: 4.15, w: qrCode ? 6.0 : 7.6, color: C.WHITE, opacity: 25, align: qrCode ? 'left' : 'center' });
      // 二维码放气泡内右下角，不要与 THANK YOU 主标题冲突
      renderQRCode(slide, { x: 7.5, y: 3.4, size: 1.1, label: '扫码联系', labelColor: C.WHITE });

      return slide;
    }

    // ─── style: minimal — 极简白底 + 蓝色横条 + 大字 THANK YOU ────────
    if (style === 'minimal') {
      slide.background = { color: C.WHITE };

      // 顶部蓝色细条
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 10, h: 0.15, fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      });
      // 底部蓝色细条
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 5.475, w: 10, h: 0.15, fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      });

      slide.addText(text === '谢谢各位' ? 'THANK YOU' : text, {
        x: 0.5, y: 1.7, w: 9.0, h: 1.4,
        fontSize: 72, fontFace: FONTS.numeric, bold: true,
        color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
        charSpacing: 10,
      });

      // 中央短金线
      slide.addShape(pres.shapes.LINE, {
        x: 4.4, y: 3.2, w: 1.2, h: 0,
        line: { color: C.SECONDARY, width: 2 },
      });

      if (subtitle) {
        slide.addText(subtitle, {
          x: 1.0, y: 3.4, w: 8.0, h: 0.5,
          fontSize: 16, fontFace: FONTS.primary,
          color: C.TEXT, align: 'center', valign: 'middle', margin: 0,
        });
      }
      if (instructor || dateLine) {
        const ldetails = [instructor, dateLine].filter(Boolean).join('  ·  ');
        slide.addText(ldetails, {
          x: 1.0, y: 4.0, w: qrCode ? 6.0 : 8.0, h: 0.4,
          fontSize: 12, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, align: qrCode ? 'left' : 'center', valign: 'middle', margin: 0,
        });
      }
      slide.addText(website, {
        x: 1.0, y: 4.7, w: qrCode ? 6.0 : 8.0, h: 0.4,
        fontSize: 11, fontFace: FONTS.enSmall,
        color: C.TEXT_SUB, align: qrCode ? 'left' : 'center', valign: 'middle', margin: 0,
      });

      // v3.6：联系方式 + 二维码
      renderContactRow(slide, { x: 1.0, y: 4.4, w: qrCode ? 6.0 : 8.0, color: C.TEXT_LIGHT, opacity: 0 });
      renderQRCode(slide, { x: 7.5, y: 3.5, size: 1.3, label: '扫码联系', labelColor: C.TEXT_LIGHT });

      return slide;
    }

    // ─── 默认（v3.7.3）：仿 "01高级商务蓝配色PPT模板" 第 157 页 ───────────
    //   左半建筑物照片 · 右半白底 · 中央深蓝色 THANK YOU 面板悬浮 · 右上 LOGO · 右下汇报时间 + 联系方式（居中于面板内）
    slide.background = { color: C.WHITE };

    const BUILDING_PATH = path.join(__dirname, '..', 'assets', 'cover-building.jpg');
    const buildingImg = data.buildingImage !== undefined
      ? data.buildingImage
      : (fs.existsSync(BUILDING_PATH) ? BUILDING_PATH : null);

    // 左半建筑照片
    if (buildingImg) {
      slide.addImage({ path: buildingImg, x: 0, y: 0, w: 4.5, h: 5.625, sizing: { type: 'cover', w: 4.5, h: 5.625 } });
    } else {
      // 无图回退：左半色块
      slide.addShape(pres.shapes.RECTANGLE, {
        x: 0, y: 0, w: 4.5, h: 5.625, fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
      });
    }

    // 右上 LOGO（薄云）
    const _logoPath = data.logoPath !== undefined ? data.logoPath : (infra.LOGO_PATH || null);
    if (_logoPath) {
      slide.addImage({ path: _logoPath, x: 7.9, y: 0.35, w: 1.7, h: 0.5 });
    } else {
      slide.addText('LOGO', {
        x: 8.0, y: 0.35, w: 1.5, h: 0.5,
        fontSize: 22, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'right', valign: 'middle', margin: 0,
      });
    }

    // 中央深蓝色 THANK YOU 面板（悬浮于建筑右边缘之上）
    const panelX = 4.0, panelY = 1.55, panelW = 5.7, panelH = 2.8;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: panelX, y: panelY, w: panelW, h: panelH,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
    });

    // THANK YOU 巨号白字（保留 text 替换为'谢谢各位'时则用中文）
    const mainText = (text === '谢谢各位') ? 'THANK YOU' : text;
    const mtLen = (mainText || '').length;
    const mtFontSize = mtLen <= 9 ? 52 : mtLen <= 14 ? 40 : 32;
    slide.addText(mainText, {
      x: panelX + 0.3, y: panelY + 0.35, w: panelW - 0.6, h: 1.0,
      fontSize: mtFontSize, fontFace: FONTS.primary, bold: true,
      color: C.WHITE, align: 'center', valign: 'middle', margin: 0,
    });

    // 描述/金句 — 白色小字居中
    if (subtitle) {
      slide.addText(subtitle, {
        x: panelX + 0.3, y: panelY + 1.4, w: panelW - 0.6, h: 0.55,
        fontSize: 12, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 10,
        align: 'center', valign: 'middle', lineSpacingMultiple: 1.4, margin: 0,
      });
    }

    // 联系方式行 — 居中显示在面板内（白色，半透明）
    renderContactRow(slide, {
      x: panelX + 0.3, y: panelY + 2.0, w: panelW - 0.6,
      color: C.WHITE, opacity: 15, align: 'center',
    });

    // 汇报人 + 汇报时间 — 面板底部居中
    const reportLineParts = [];
    if (instructor) reportLineParts.push('汇报人：' + instructor);
    if (dateLine)   reportLineParts.push('汇报时间：' + dateLine);
    if (reportLineParts.length) {
      slide.addText(reportLineParts.join('    '), {
        x: panelX + 0.3, y: panelY + panelH - 0.4, w: panelW - 0.6, h: 0.3,
        fontSize: 11, fontFace: FONTS.primary,
        color: C.WHITE, transparency: 25,
        align: 'center', valign: 'middle', margin: 0,
      });
    }

    // 右下：官网（深蓝色，仿 P157 底部"汇报时间"位置）
    slide.addText(website, {
      x: 6.0, y: 4.95, w: 3.6, h: 0.4,
      fontSize: 13, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'right', valign: 'middle', margin: 0,
    });

    // 二维码：左下白底区，避免与建筑照片冲突（小尺寸）
    renderQRCode(slide, { x: 4.65, y: 4.55, size: 0.85, label: '扫码联系', labelColor: C.TEXT_LIGHT });

    // v3.9.3: 移除底部金色短装饰线（用户反馈二维码下不要横线）

    return slide;
  },
};
