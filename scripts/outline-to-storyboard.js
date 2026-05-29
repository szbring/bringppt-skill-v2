#!/usr/bin/env node
'use strict';
/**
 * scripts/outline-to-storyboard.js — 大纲 → storyboard.json 自动转换
 *
 * 输入支持：
 *   - Markdown 文件（# / ## / ### 解析为章节层级）
 *   - 缩进文本（每级 2 或 4 空格）
 *   - 编号文本（1. / 1.1 / 1.1.1）
 *
 * 输出：storyboard.json 草稿，含：
 *   - meta（默认 BRING 品牌）
 *   - chapters[]：每章 sectionTitle + sectionSubtitle + pages
 *   - pages[]：title + keyPoints + suggestedLayout（按内容启发式选）
 *
 * 用法：
 *   node scripts/outline-to-storyboard.js --input outline.md
 *   node scripts/outline-to-storyboard.js --input outline.md --output story.json --title "项目汇报"
 *
 * 启发式版式选择规则（按命中优先级）：
 *   1. 含数字 + % → dataHighlight / kpiDashboard
 *   2. 含 "对比/vs/before-after" → comparison / beforeAfter
 *   3. 含 "流程/步骤/阶段" → stepList / snakeFlow
 *   4. 含 "矩阵/四象限" → quadrantMatrix
 *   5. 含 "三层/层级" → pyramid / layeredList
 *   6. 含 "时间线/timeline/路线图" → timeline / ganttChart
 *   7. 含 "因果/原因" → fishbone / issueTree
 *   8. 含 "金句/引言" → quoteBanner / quoteEmphasis
 *   9. 默认按 keyPoint 数量：≤3 threeColumn, ≤5 iconList, 6+ cardGrid
 */

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}

const inputPath  = arg('--input');
const outputPath = arg('--output');
const title      = arg('--title');
const author     = arg('--author', '薄云咨询 BRING');

if (!inputPath) {
  console.error('用法: node scripts/outline-to-storyboard.js --input outline.md [--output story.json] [--title "项目汇报"]');
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf-8');

// ── 解析：识别每行的"深度"和"标题" ────────────────────────────
function parseOutline(text) {
  const lines = text.split('\n');
  const nodes = []; // {depth, text}
  let lastHeadingDepth = 0;  // 跟踪最近的 heading 深度
  for (let line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith('---')) continue;
    let depth, content;

    // Markdown #（确定 heading 深度，作为后续 bullet 的锚）
    const md = line.match(/^(#{1,4})\s+(.+)$/);
    if (md) {
      depth = md[1].length;
      content = md[2].trim();
      nodes.push({ depth, text: content });
      lastHeadingDepth = depth;
      continue;
    }

    // 编号 "1." / "1.1" / "1.1.1"
    const num = line.match(/^\s*(\d+(?:\.\d+)*)[\.\s\-、:：]\s*(.+)$/);
    if (num) {
      depth = num[1].split('.').length;
      content = num[2].trim();
      nodes.push({ depth, text: content });
      lastHeadingDepth = depth;
      continue;
    }

    // 项目符号 — depth = 最近 heading depth + 1 + 缩进嵌套
    const bul = line.match(/^(\s*)[•\-*]\s+(.+)$/);
    if (bul) {
      const indent = bul[1].length;
      const nestExtra = Math.floor(indent / 2);
      depth = (lastHeadingDepth || 1) + 1 + nestExtra;
      content = bul[2].trim();
      nodes.push({ depth, text: content });
      continue;
    }

    // 纯文本（被视为前一节点的描述追加）
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (nodes.length) {
        const prev = nodes[nodes.length - 1];
        prev.text = prev.text.replace(/[:：]?$/, '') + ': ' + line.trim();
      }
    }
  }
  return nodes;
}

// ── 把扁平 nodes 构造成 chapters → pages → keyPoints 树 ────────
function buildChapters(nodes) {
  if (nodes.length === 0) return [];
  // 找根 depth（最浅）
  const rootDepth = Math.min(...nodes.map(n => n.depth));
  // 如果根层只有 1 个节点（典型情况：文档标题），把它当作 meta.title，
  // 把根+1 当作章节层
  const rootNodes = nodes.filter(n => n.depth === rootDepth);
  let chapterDepth = rootDepth;
  let documentTitle = null;
  if (rootNodes.length === 1) {
    documentTitle = rootNodes[0].text;
    chapterDepth = rootDepth + 1;
  }

  const chapters = [];
  let currentChapter = null;
  let currentPage    = null;

  for (const n of nodes) {
    if (n.depth < chapterDepth) continue;  // 跳过文档标题层
    const rel = n.depth - chapterDepth;
    if (rel === 0) {
      currentChapter = { sectionTitle: n.text, pages: [] };
      chapters.push(currentChapter);
      currentPage = null;
    } else if (rel === 1) {
      // 一级子项 = page
      if (!currentChapter) {
        currentChapter = { sectionTitle: '主体内容', pages: [] };
        chapters.push(currentChapter);
      }
      currentPage = { title: n.text, keyPoints: [] };
      currentChapter.pages.push(currentPage);
    } else {
      // 二级及更深 = page 的 keyPoint
      if (!currentPage) {
        // 跳过——孤立的二级项无所属 page
        continue;
      }
      currentPage.keyPoints.push(n.text);
    }
  }

  // 若 chapter 只有 sectionTitle 没有 pages，添加一个默认 page
  chapters.forEach(c => {
    if (c.pages.length === 0) {
      c.pages.push({ title: c.sectionTitle, keyPoints: [] });
    }
  });

  return { chapters, documentTitle };
}

// ── 启发式版式选择 ───────────────────────────────────────────
function suggestLayout(page) {
  const title = page.title || '';
  const text  = [title, ...page.keyPoints].join(' ');
  const n     = page.keyPoints.length;

  // 显式提示：[layout: xxx] 或 [模板: xxx]
  const hint = title.match(/\[(?:layout|模板)\s*[:：]\s*([A-Za-z]+)\s*\]/);
  if (hint) {
    page.title = title.replace(/\s*\[(?:layout|模板)[^\]]*\]/, '').trim();
    return hint[1];
  }

  // 优先匹配关键词信号
  if (/(\d+%|\d+ ?%)/.test(text) && n <= 4) return 'dataHighlight';
  if (/(KPI|指标|关键数字)/.test(text) && n <= 4) return 'kpiDashboard';
  if (/(vs|对比|比较|前后)/.test(text)) {
    if (n <= 2) return 'beforeAfter';
    return 'comparison';
  }
  // 专有咨询框架——最高优先级，避免被通用关键词误匹配
  if (/(PESTEL|pestel)/.test(text)) return 'pestelAnalysis';
  if (/(SWOT|swot)/.test(text)) return 'swotGrid';
  if (/(波特|五力)/.test(text)) return 'porterFiveForces';
  if (/(BCG|波士顿矩阵)/.test(text)) return 'bcgMatrix';
  if (/(SCQA|叙事|讲故事)/.test(text)) return 'scqaNarrative';
  if (/(安索夫|Ansoff)/.test(text)) return 'ansoffMatrix';
  if (/(蛇形|10 ?步|流程|步骤)/.test(text) && n >= 6) return 'snakeFlow';
  if (/(流程|步骤|阶段)/.test(text) && n <= 5) return 'stepList';
  if (/(因果链|因果)/.test(text)) return 'causalChain';
  if (/(箭头链)/.test(text)) return 'arrowChain';
  if (/(四象限|矩阵|2x2)/.test(text)) return 'quadrantMatrix';
  if (/(金字塔|三层|层级)/.test(text)) {
    if (n === 3) return 'pyramid';
    return 'layeredList';
  }
  if (/(时间线|timeline|路线图)/.test(text)) {
    if (/(甘特|gantt)/i.test(text)) return 'ganttChart';
    return 'timeline';
  }
  if (/(鱼骨|根因|分析)/.test(text) && n >= 4) return 'fishbone';
  if (/(问题树|issue tree)/i.test(text)) return 'issueTree';
  if (/(决策树|decision)/i.test(text)) return 'decisionTree';
  if (/(漏斗|funnel|转化)/.test(text)) return 'funnel';
  if (/(气泡图|bubble)/i.test(text)) return 'chartBubble';
  if (/(雷达图|radar)/i.test(text)) return 'chartRadar';
  if (/(散点图|scatter)/i.test(text)) return 'chartScatter';
  if (/(3D 柱|3d bar|bar3d)/i.test(text)) return 'chartBar3D';
  if (/(柱状图|柱形图|bar chart)/i.test(text)) return 'chartBar';
  if (/(折线图|趋势图|line chart)/i.test(text)) return 'chartLine';
  if (/(饼图|占比图|pie chart)/i.test(text)) return 'chartPie';
  if (/(面积图|area chart)/i.test(text)) return 'chartArea';
  if (/(组合图|双轴图|combo chart)/i.test(text)) return 'chartCombo';
  if (/(组织|架构)/.test(text)) return 'orgChart';
  if (/(利益相关|stakeholder)/i.test(text)) return 'stakeholderMap';
  if (/(价值链)/.test(text)) return 'valueChain';
  if (/(金句|引述|引言)/.test(text)) return 'quoteEmphasis';
  if (/(关键词云|词云)/.test(text)) return 'cloudConcept';
  if (/(关键词)/.test(text) && n >= 6) return 'keywordHighlight';
  if (/(花瓣|多维分解)/.test(text) && n === 4) return 'flowerPetal';
  if (/(蜂巢|六边形)/.test(text)) return 'hexagonHive';
  if (/(辐射图|辐射中心)/.test(text)) return 'radialHub';
  if (/(辐射导航|径向导航)/.test(text)) return 'radialNav';
  if (/(进度条|百分比进度)/.test(text) && n >= 3) return 'progressList';
  if (/(检查清单|checklist)/i.test(text)) return 'checklist';
  if (/(季度计划|quarterly)/i.test(text)) return 'quarterlyPlan';
  if (/(分段甘特|phased gantt)/i.test(text)) return 'phasedGantt';
  if (/(甘特|gantt)/i.test(text)) return 'ganttChart';
  if (/(多项目|项目组合卡片)/i.test(text)) return 'multiProjectCards';
  if (/(双轨|双线时间)/i.test(text)) return 'dualTrackTimeline';
  if (/(波浪|波形|wave)/i.test(text)) return 'waveProgression';
  if (/(阶梯|staircase)/i.test(text)) return 'staircase';
  if (/(韦恩图|交集|venn)/i.test(text)) return 'vennDiagram';
  if (/(色块矩阵|color matrix)/i.test(text)) return 'colorMatrix';
  if (/(堆叠|堆栈|cube)/i.test(text)) return 'cubeStack';
  if (/(分析矩阵)/.test(text)) return 'analysisMatrix';
  if (/(括号分组|前中后端)/.test(text)) return 'bracketGroup';
  if (/(样式表|比对表|styled table)/i.test(text)) return 'styledTable';
  // v4.1.5: calloutAnnotation 已软删除 — 标注气泡场景改用 freeform 或 imageText
  // if (/(标注式|标注要点|callout)/i.test(text)) return 'calloutAnnotation';
  if (/(双栏|dual panel)/i.test(text)) return 'dualPanel';
  if (/(模块概览|module overview)/i.test(text)) return 'moduleOverview';
  if (/(侧边标签|sidebar)/i.test(text)) return 'sidebarLabel';
  if (/(图片画廊|image gallery)/i.test(text)) return 'imageGallery';
  if (/(图文混排|image text)/i.test(text)) return 'imageText';
  if (/(链接列表|资源链接|link list)/i.test(text)) return 'linkList';
  if (/(案例盒|case box)/i.test(text)) return 'caseBox';
  if (/(提问.*答案|impact question)/i.test(text)) return 'impactQuestion';
  if (/(洞察横幅|insight banner)/i.test(text)) return 'insightBanner';
  if (/(引述横幅|quote banner)/i.test(text)) return 'quoteBanner';
  if (/(问题方案|problem solution)/i.test(text)) return 'problemSolution';
  if (/(成就|achievement)/i.test(text) && n <= 4) return 'achievement';
  if (/(KPI 总览|KPI 仪表盘)/.test(text)) return 'kpiDashboard';
  // fullQuote 已移除 (v3.7.32) — 用 quoteEmphasis / closingQuote 替代
  // caseDivider 已移除 (v3.7.30) — 改用 sectionSlide 表达章节过渡

  // 默认：按数量
  if (n === 0) return null;     // 让 pipeline 自己挑
  if (n === 1) return 'bigNumber';
  if (n <= 2) return 'twoColumnCards';
  if (n === 3) return 'threeColumn';
  if (n <= 5) return 'iconList';
  return 'cardGrid';
}

// ── 主转换 ───────────────────────────────────────────────────
const nodes = parseOutline(raw);
const { chapters, documentTitle } = buildChapters(nodes);

let pageCounter = 0;
const enrichedChapters = chapters.map((c, ci) => {
  const subtitle = c.pages.length > 0 ? `${c.pages.length} 个要点` : '';
  return {
    sectionTitle:    c.sectionTitle,
    sectionNumber:   ci + 1,
    sectionSubtitle: subtitle,
    pages: c.pages.map((p, pi) => {
      pageCounter++;
      return {
        id:              `p-${ci + 1}-${pi + 1}`,
        title:           p.title,
        keyPoints:       p.keyPoints,
        suggestedLayout: suggestLayout(p),
      };
    }),
  };
});

const storyboard = {
  meta: {
    title:    title || documentTitle || (chapters[0] && chapters[0].sectionTitle) || '汇报文档',
    author,
    date:     new Date().toISOString().slice(0, 10),
    includeToc: true,
    closingQuote: {
      quote: '感谢聆听，期待合作。',
      author: author,
      label:  '结语', labelEn: 'CLOSING',
    },
    backCover: { text: '谢谢聆听', instructor: author },
  },
  chapters: enrichedChapters,
};

const finalOut = outputPath || inputPath.replace(/\.(md|txt)$/i, '') + '-storyboard.json';
fs.writeFileSync(finalOut, JSON.stringify(storyboard, null, 2) + '\n', 'utf-8');

const totalPages = enrichedChapters.reduce((s, c) => s + c.pages.length, 0);
const layoutDist = {};
enrichedChapters.forEach(c => c.pages.forEach(p => {
  const l = p.suggestedLayout || '(auto)';
  layoutDist[l] = (layoutDist[l] || 0) + 1;
}));

console.log(`✅ ${path.relative(process.cwd(), finalOut)} 已生成`);
console.log(`   ${enrichedChapters.length} 章 · ${totalPages} 页内容`);
console.log(`   版式分布：`);
Object.entries(layoutDist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`     ${k.padEnd(20)} ${v}`);
});
console.log(`\n下一步：`);
console.log(`  人工审阅 ${path.basename(finalOut)} 后跑：`);
console.log(`  npm run pipeline -- --input ${path.relative(process.cwd(), finalOut)} --output 输出.pptx`);
