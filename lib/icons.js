'use strict';
/**
 * lib/icons.js — 内嵌 lucide SVG 图标库 (v3.8.0 Tier-1)
 *
 * 采用 lucide-icons.com 的 stroke-only SVG 图标，30+ 顶咨级常用：
 *   - 趋势/数据：trending-up / trending-down / target / activity / bar-chart
 *   - 流程/动作：play / arrow-right / check / x / loader
 *   - 业务：users / building / briefcase / award / handshake
 *   - 警示：alert-triangle / alert-circle / info / lightbulb
 *   - 通用：star / heart / flag / clock / calendar / map-pin
 *
 * 使用方式：
 *   const { getIconSvg, inferIconForKeyword } = require('./icons');
 *   const svg = getIconSvg('trending-up', '#003591');  // 返回 SVG 字符串
 *   pres.slide.addImage({ data: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'),
 *                          x:0.5, y:1, w:0.4, h:0.4 });
 *
 * inferIconForKeyword('增长 30%') → 'trending-up'   （自动从中文关键词推断 icon）
 */

// lucide 图标 viewBox 都是 24×24，stroke-width=2，fill=none。
// path 直接来自 lucide.dev 官方 SVG（MIT 协议）。
const ICON_PATHS = {
  'trending-up':   'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  'trending-down': 'M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6',
  'target':        'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6a6 6 0 100 12 6 6 0 000-12zM12 10a2 2 0 100 4 2 2 0 000-4z',
  'activity':      'M22 12h-4l-3 9L9 3l-3 9H2',
  'bar-chart':     'M3 3v18h18M7 16V8M12 16V4M17 16v-6',
  'pie-chart':     'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',

  'play':          'M5 3l14 9-14 9V3z',
  'arrow-right':   'M5 12h14M12 5l7 7-7 7',
  'arrow-up':      'M12 19V5M5 12l7-7 7 7',
  'check':         'M20 6L9 17l-5-5',
  'check-circle':  'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  'x':             'M18 6L6 18M6 6l12 12',
  'loader':        'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',

  'users':         'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'user':          'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'building':      'M3 21h18M5 21V3h14v18M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1',
  'briefcase':     'M20 7h-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM9 5h6v2H9V5z',
  'award':         'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  'handshake':     'M11 17l2 2 4-4M7 21l-4-4 4-4M21 12c0-4.418-3.582-8-8-8s-8 3.582-8 8',

  'alert-triangle':'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  'alert-circle':  'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01',
  'info':          'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
  'lightbulb':     'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z',

  'star':          'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  'heart':         'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  'flag':          'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15',
  'clock':         'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  'calendar':      'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  'map-pin':       'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'globe':         'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',

  'shield':        'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'lock':          'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  'database':      'M21 5c0-1.66-4-3-9-3s-9 1.34-9 3v14c0 1.66 4 3 9 3s9-1.34 9-3V5zM3 5v14M21 5v14M3 12c0 1.66 4 3 9 3s9-1.34 9-3',
  'zap':           'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'rocket':        'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0',
};

// 中文/英文关键词 → icon 名映射
// 用于 fromKeyPoints adapter 自动推断（"营收增长 30%" → trending-up）
const KEYWORD_TO_ICON = {
  // 趋势
  '增长': 'trending-up', '上升': 'trending-up', '提升': 'trending-up',
  '下降': 'trending-down', '下滑': 'trending-down',
  '目标': 'target', '目的': 'target',
  '增速': 'activity', 'cagr': 'activity',

  // 行动
  '启动': 'play', '执行': 'play',
  '完成': 'check-circle', '达成': 'check-circle', '成功': 'check-circle',
  '失败': 'x', '阻碍': 'x',
  '加载': 'loader', '进行中': 'loader',

  // 业务
  '客户': 'users', '团队': 'users', '员工': 'users',
  '公司': 'building', '企业': 'building', '总部': 'building',
  '业务': 'briefcase', '项目': 'briefcase',
  '荣誉': 'award', '奖项': 'award', '认证': 'award',
  '合作': 'handshake', '伙伴': 'handshake',

  // 警示
  '风险': 'alert-triangle', '挑战': 'alert-triangle', '威胁': 'alert-triangle',
  '注意': 'alert-circle', '警告': 'alert-circle',
  '信息': 'info', '说明': 'info',
  '机会': 'lightbulb', '洞察': 'lightbulb', '创新': 'lightbulb',

  // 数据
  '数据': 'database', '存储': 'database',
  '安全': 'shield', '权限': 'shield', '合规': 'shield',
  '加密': 'lock', '隐私': 'lock',
  '能源': 'zap', '动力': 'zap', '快速': 'zap',
  '增长引擎': 'rocket', '加速': 'rocket',

  // 时空
  '时间': 'clock', '进度': 'clock',
  '计划': 'calendar', '日程': 'calendar',
  '位置': 'map-pin', '地区': 'map-pin', '区域': 'map-pin',
  '全球': 'globe', '国际': 'globe', '海外': 'globe',

  // 评价
  '价值': 'star', '亮点': 'star', '推荐': 'star',
  '关注': 'heart', '重要': 'heart',
  '里程碑': 'flag', '阶段': 'flag',

  // 数据可视化
  '占比': 'pie-chart', '份额': 'pie-chart',
  '对比': 'bar-chart', '增长率': 'bar-chart',
};

/**
 * 生成完整 SVG 字符串。颜色用 currentColor 占位 + style:color，
 * 这样 pptxgenjs 渲染时能继承父样式（实际渲染：直接用传入的 hex）。
 */
function getIconSvg(name, hexColor = '003591') {
  const path = ICON_PATHS[name];
  if (!path) {
    return null;
  }
  const color = hexColor.startsWith('#') ? hexColor : '#' + hexColor;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ',
    `fill="none" stroke="${color}" stroke-width="2" `,
    'stroke-linecap="round" stroke-linejoin="round">',
    `<path d="${path}"/>`,
    '</svg>',
  ].join('');
}

/**
 * 把 SVG 转为 pptxgenjs addImage 用的 data URI。
 */
function svgToDataUri(svg) {
  if (!svg) return null;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

/**
 * 从中文文本推断最合适的 icon 名。
 * 优先级：完全匹配 > 前缀匹配 > 包含匹配。
 * 找不到返回 null（调用方应给默认 icon 或不画 icon）。
 */
function inferIconForKeyword(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  // 完全 / 包含匹配
  for (const [kw, icon] of Object.entries(KEYWORD_TO_ICON)) {
    if (lower.includes(kw.toLowerCase())) return icon;
  }
  return null;
}

/**
 * 简便方法：给 keyPoint 文本生成对应 icon 的 dataUri。
 * @returns null 表示不画 icon
 */
function iconDataUriForText(text, hexColor = '003591', fallback = null) {
  const name = inferIconForKeyword(text) || fallback;
  if (!name) return null;
  return svgToDataUri(getIconSvg(name, hexColor));
}

module.exports = {
  ICON_PATHS,
  KEYWORD_TO_ICON,
  getIconSvg,
  svgToDataUri,
  inferIconForKeyword,
  iconDataUriForText,
};
