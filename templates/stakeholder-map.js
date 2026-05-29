'use strict';
// templates/stakeholder-map.js
// v3.7.0 — 利益相关方地图（公开方法论：Mendelow 1991 power-interest 矩阵）

const path = require('path');
const fs   = require('fs');

const QUADRANTS = [
  // x: low/high (Interest), y: low/high (Power)
  { key: 'manage',    name: '重点管理',     en: 'Manage Closely',  desc: '高权力·高兴趣，深度沟通' },
  { key: 'satisfy',   name: '保持满意',     en: 'Keep Satisfied',  desc: '高权力·低兴趣，定期通报' },
  { key: 'inform',    name: '保持告知',     en: 'Keep Informed',   desc: '低权力·高兴趣，及时同步' },
  { key: 'monitor',   name: '监控即可',     en: 'Monitor',         desc: '低权力·低兴趣，最少投入' },
];

module.exports = {
  name:        'stakeholderMap',
  version:     '1.0.0',
  category:    '咨询框架',
  description: '利益相关方地图（Power × Interest 2×2 矩阵）：项目/变革管理的标准工具',

  schema: {
    stakeholders: {
      type: 'object', required: false,
      description: '两种形式：(1) 4 象限对象 { manage:[名字...], satisfy:[], inform:[], monitor:[] }（v3.7.0+）；(2) v4.1.3 起也支持数组形 [{ name, power:"high"|"low"|1-5, interest:"high"|"low"|1-5 }]，按 power×interest 自动映射到象限',
    },
    title:    { type: 'string', required: false, description: '小标题' },
    startY:   { type: 'number', required: false, description: '起始 Y 坐标' },
  },

  usage: {
    when:    '项目启动 / 变革管理时识别关键利益方；判断应该跟谁沟通到什么深度',
    notWhen: '内部组织诊断（用 mckinsey7S）；定量评估（用 chartScatter）',
    typicalHeight: '3.8~4.2 英寸',
    scenarios: [
      { trigger: '咨询项目启动会', example: '识别"应该深度访谈谁，定期汇报谁"' },
      { trigger: '组织变革管理', example: '"谁是改革推动者，谁是抵制者"' },
      { trigger: '客户提案前的关系梳理', example: '"客户内部哪些角色需要单独沟通"' },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/stakeholder-map.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // v3.7.14: 每象限 ≤ 3 项 + 截短到 10 字，避免单条长文字溢出邻格
  // v4.1.3 (修 N-9): 若 page.stakeholders 已存在（用户显式传入），优先透传；render 中会做归一化
  fromKeyPoints(keyPoints, page) {
    if (page && page.stakeholders) {
      // 用户显式给了 stakeholders（数组或 4 象限对象）— 直接透传，render 归一化
      return {
        stakeholders: page.stakeholders,
        title: page.title || '',
      };
    }
    const { splitTitleDesc } = require('../lib/keypoints-helpers');
    const kps = (keyPoints || []).slice(0, 12);
    const t = arr => arr.map(s => splitTitleDesc(s).title || s)
                        .map(s => s.length > 10 ? s.slice(0, 10) : s);
    const n = Math.min(3, Math.ceil(kps.length / 4) || 1);
    return {
      stakeholders: {
        manage:  t(kps.slice(0, n)),
        satisfy: t(kps.slice(n, 2 * n)),
        inform:  t(kps.slice(2 * n, 3 * n)),
        monitor: t(kps.slice(3 * n, 4 * n)),
      },
      title: (page && page.title) || '',
    };
  },



  render(pres, slide, data, infra) {
    const { C, shadow, resolveStartY, validateBounds, FONTS } = infra;
    let { stakeholders = {}, title, startY } = data;

    // v4.1.3 (修 N-9): 数组形 stakeholders = [{name, power, interest}] 归一化为 4 象限对象。
    //   power/interest 支持 "high"/"low" 或 1-5 数字（≥3 视为 high）。
    if (Array.isArray(stakeholders)) {
      const norm = { manage: [], satisfy: [], inform: [], monitor: [] };
      const isHigh = v => {
        if (typeof v === 'number') return v >= 3;
        const s = String(v || '').toLowerCase().trim();
        if (['high', 'h', '高', '强', 'strong'].includes(s)) return true;
        if (['low', 'l', '低', '弱', 'weak'].includes(s))   return false;
        const n = parseFloat(s);
        return !isNaN(n) && n >= 3;
      };
      stakeholders.forEach(sk => {
        if (!sk) return;
        const nm = String(sk.name || sk.title || sk.label || '').trim();
        if (!nm) return;
        const p = isHigh(sk.power);
        const i = isHigh(sk.interest);
        if (p && i)         norm.manage.push(nm);
        else if (p && !i)   norm.satisfy.push(nm);
        else if (!p && i)   norm.inform.push(nm);
        else                norm.monitor.push(nm);
      });
      stakeholders = norm;
    }

    const sy = resolveStartY(slide, startY, 1.0);
    let curY = sy;

    // v4.1.2 (修 Mi-6 同类): 若页面已有 contentSlide 标题，跳过自画 title 避免重复
    const skipOwnTitle = !!slide._hasContentTitle && !data.forceTitle;
    if (title && !skipOwnTitle) {
      slide.addText(title, {
        x: 0.5, y: sy, w: 9.0, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, align: 'left', valign: 'middle', margin: 0,
      });
      curY = sy + 0.45;
    }

    // 2×2 矩阵布局（外加坐标轴标签）
    // v3.7.1：mh 3.5→3.0 收紧整体竖向占用，确保 validate Y ≤ 4.8
    // v4.1.0: _contentMaxBottom 感知 — banner 模式下自动收缩高度
    const maxBottom = slide._contentMaxBottom || 4.85;
    const mx = 1.4, my = curY + 0.1;
    const mw = 7.6, mh = Math.min(3.0, maxBottom - my - 0.65);
    const cellW = mw / 2;
    const cellH = (mh - 0.5) / 2;  // 留 0.5 给 x 轴标签

    // Y 轴标签（左侧竖直）— v3.7.1 调整 y 偏移以匹配新 mh
    slide.addText('权力\nPower', {
      x: 0.3, y: my + cellH - 0.5, w: 1.0, h: 1.0,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'right', valign: 'middle', margin: 0,
    });
    // Y 轴方向箭头（往下挪 0.25"，让出顶部空间给 High 标签）
    slide.addShape(pres.shapes.UP_ARROW, {
      x: 1.05, y: my + 0.35, w: 0.15, h: 0.3,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
    });
    // v3.9.3: High/Low 移到矩阵左侧（之前 x=1.25 覆盖了 mx=1.4 的矩阵）
    // v4.1.2 (修 P29 High 与箭头重叠): High 标签往左挪到 0.55 列，避免与箭头 x=1.05 重叠
    slide.addText('High', {
      x: 0.55, y: my + 0.05, w: 0.55, h: 0.3,
      fontSize: 9, fontFace: FONTS.enSmall, color: C.TEXT_LIGHT, align: 'right', valign: 'middle', margin: 0,
    });
    slide.addText('Low', {
      x: 0.55, y: my + cellH * 2 - 0.3, w: 0.55, h: 0.3,
      fontSize: 9, fontFace: FONTS.enSmall, color: C.TEXT_LIGHT, align: 'right', valign: 'middle', margin: 0,
    });

    // 4 象限位置（按矩阵习惯：左上=高权力低兴趣，右上=高权力高兴趣...）
    const cells = [
      // 左上：高权力 低兴趣 = satisfy
      { def: QUADRANTS[1], x: mx, y: my, w: cellW, h: cellH },
      // 右上：高权力 高兴趣 = manage
      { def: QUADRANTS[0], x: mx + cellW, y: my, w: cellW, h: cellH },
      // 左下：低权力 低兴趣 = monitor
      { def: QUADRANTS[3], x: mx, y: my + cellH, w: cellW, h: cellH },
      // 右下：低权力 高兴趣 = inform
      { def: QUADRANTS[2], x: mx + cellW, y: my + cellH, w: cellW, h: cellH },
    ];

    cells.forEach(c => {
      const isManage = c.def.key === 'manage';
      const bg = isManage ? C.PRIMARY : (c.def.key === 'monitor' ? C.BG_LIGHT : C.BG_PANEL);
      const textColor = isManage ? C.WHITE : C.PRIMARY;
      const borderColor = isManage ? C.PRIMARY : C.BLUE_PALE;

      slide.addShape(pres.shapes.RECTANGLE, {
        x: c.x, y: c.y, w: c.w, h: c.h,
        fill: { color: bg }, line: { color: borderColor, width: 0.5 },
      });

      // 象限标签（左上角，中英合并一行节省纵向空间）
      slide.addText([
        { text: c.def.name, options: { fontSize: 13, bold: true } },
        { text: '  ' + c.def.en, options: { fontSize: 9, transparency: 25 } },
      ], {
        x: c.x + 0.15, y: c.y + 0.08, w: c.w - 0.3, h: 0.3,
        fontFace: FONTS.primary,
        color: textColor, valign: 'middle', margin: 0,
      });
      slide.addText(c.def.desc, {
        x: c.x + 0.15, y: c.y + 0.38, w: c.w - 0.3, h: 0.24,
        fontSize: 8.5, fontFace: FONTS.primary,
        color: textColor, transparency: isManage ? 25 : 35,
        italic: true, valign: 'top', margin: 0,
      });

      // 利益方列表（v3.7.1：避免溢出邻格，字号 9pt + 限制 3 条 + 紧凑行距）
      const list = stakeholders[c.def.key] || [];
      if (list.length > 0) {
        const maxItems = 3;
        const items = list.slice(0, maxItems);
        const overflowFlag = list.length > maxItems ? `  +${list.length - maxItems} …` : '';
        const bulletText = items.map(s => '• ' + s).join('\n');
        slide.addText(bulletText + overflowFlag, {
          x: c.x + 0.18, y: c.y + 0.66, w: c.w - 0.36, h: c.h - 0.7,
          fontSize: 9, fontFace: FONTS.primary,
          color: textColor, lineSpacingMultiple: 1.2, valign: 'top', margin: 0,
        });
      }
    });

    // X 轴标签（底部横向）
    const xAxisY = my + 2 * cellH + 0.05;
    slide.addText('Low', {
      x: mx, y: xAxisY, w: cellW, h: 0.3,
      fontSize: 9, fontFace: FONTS.enSmall,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addText('High', {
      x: mx + cellW, y: xAxisY, w: cellW, h: 0.3,
      fontSize: 9, fontFace: FONTS.enSmall,
      color: C.TEXT_LIGHT, align: 'center', valign: 'middle', margin: 0,
    });
    slide.addShape(pres.shapes.RIGHT_ARROW, {
      x: mx + mw - 0.05, y: xAxisY + 0.05, w: 0.3, h: 0.15,
      fill: { color: C.PRIMARY }, line: { color: C.PRIMARY, width: 0 },
    });
    slide.addText('兴趣 Interest', {
      x: mx, y: xAxisY + 0.3, w: mw, h: 0.3,
      fontSize: 11, fontFace: FONTS.primary, bold: true,
      color: C.PRIMARY, align: 'center', valign: 'middle', margin: 0,
    });

    // v4.1.0: 接力契约 — 让下方 layout 从这里起步
    slide._bottomY = xAxisY + 0.65;
    validateBounds(slide, xAxisY + 0.65, 'stakeholderMap');
  },
};
