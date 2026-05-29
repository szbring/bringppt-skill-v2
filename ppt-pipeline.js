'use strict';
/**
 * ppt-pipeline.js — storyboard → .pptx 一键流水线
 *
 * 功能：
 *   1. 读取分镜脚本 JSON（storyboard）
 *   2. 通过 storyboard-converter 转换为 slides-data
 *   3. 直接生成 .pptx 文件
 *   4. 返回输出路径（供调用方下载或分发）
 *
 * 用法（命令行）：
 *   node ppt-pipeline.js --input storyboard.json [--output ./output.pptx]
 *   node ppt-pipeline.js --input storyboard.json --project-dir /tmp/my-ppt
 *
 * 用法（模块调用）：
 *   const { run } = require('./ppt-pipeline');
 *   const result = await run({ storyboard, outputPath });
 *   console.log(result.pptxPath);
 */

const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { spawnSync } = require('child_process');
const JSZip    = require('jszip');

const SKILL_DIR = __dirname;

// ── 依赖加载 ─────────────────────────────────────────────────────
const { convert: convertStoryboard } = require(path.join(SKILL_DIR, 'storyboard-converter'));
const bring     = require(path.join(SKILL_DIR, 'bring-core'));
const pptxgen   = require('pptxgenjs');
const { stripPptxNotes } = require(path.join(SKILL_DIR, 'lib', 'pptx-notes'));
// v4.1.9：Google Drive 原样上传契约 — 按 OpenAPI 规格构造 upload_file_to_drive 请求 JSON
const {
  resolveDestinationFolder,
  buildUploadRequest,
  printUploadHint,
  DEFAULT_PPT_OUTPUT_FOLDER_ID,
} = require(path.join(SKILL_DIR, 'lib', 'upload-folder'));
const { uploadFileToDrive } = require(path.join(SKILL_DIR, 'lib', 'upload-adapter'));

// ── 版式映射表 ──────────────────────────────────────────────────
// 从 registry 自动生成，新增模板时无需修改本文件。
// v3.7.4: A 类页面模板也走自动注册（page-template-map.js），不再硬编码 switch。
const buildLayoutMap = require(path.join(SKILL_DIR, 'lib', 'layout-map'));
const buildPageMap   = require(path.join(SKILL_DIR, 'lib', 'page-template-map'));
const LAYOUT_MAP = buildLayoutMap(bring);
const PAGE_MAP   = buildPageMap(bring);


// ── 数据与验证工具 ───────────────────────────────────────────────
function safeWriteSlidesData(projectDir, slides, meta) {
  const tempDir = path.join(projectDir, '_temp');
  fs.mkdirSync(tempDir, { recursive: true });
  const slidesDataPath = path.join(tempDir, 'slides-data.json');
  fs.writeFileSync(slidesDataPath, JSON.stringify({ meta, slides }, null, 2) + '\n', 'utf-8');
  return slidesDataPath;
}

function validateSlidesData(slidesDataPath, opts = {}) {
  const args = [
    path.join(SKILL_DIR, 'validate-slides.js'),
    '--content',
    '--visual',
    '--stats',
    slidesDataPath,
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf-8' });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (opts.verbose) {
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
  }
  if (result.status !== 0) {
    // v4.0.3 (修 4-B 收口): graceful 模式下，schema 错误降为警告
    //   - 此时 ppt-pipeline 已加 layouts 直通 try/catch + insightBanner 兜底
    //   - 用户既然显式 --graceful，说明能接受部分页降级，不应再 hard exit
    //   - 非 graceful 模式仍按原样 exit 1，保住生产严格性
    if (opts.graceful) {
      const errCount = (stdout.match(/\[ERROR\]/g) || []).length;
      console.warn(`[ppt-pipeline] [WARN] slides-data 验证有 ${errCount} 处 ERROR（graceful 模式继续）`);
      if (opts.verbose) {
        const detail = `${stdout}`.trim().split('\n').filter(l => l.includes('[ERROR]')).slice(0, 10).join('\n');
        if (detail) console.warn(detail);
      }
      return { ok: false, lenient: true, stdout, stderr };
    }
    const detail = `${stdout}\n${stderr}`.trim().split('\n').slice(-40).join('\n');
    throw new Error(`[ppt-pipeline] slides-data 验证失败（exit ${result.status}）\n${detail}`);
  }
  return { ok: true, stdout, stderr };
}

function recordGenerationStats(slidesDataPath, opts = {}) {
  if (opts.noLearn || process.env.BRINGPPT_LEARNING_DISABLED === '1') {
    return { recorded: false, skipped: true };
  }
  const result = spawnSync(process.execPath, [
    path.join(SKILL_DIR, 'record-learning.js'),
    '--stats',
    slidesDataPath,
  ], { encoding: 'utf-8' });
  if (opts.verbose) {
    if ((result.stdout || '').trim()) console.log(result.stdout.trim());
    if ((result.stderr || '').trim()) console.error(result.stderr.trim());
  }
  return { recorded: result.status === 0, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function loadLearningContext(opts = {}) {
  const { verbose = false, skipLearning = false, recordAccess = true } = opts;
  if (skipLearning) {
    if (verbose) console.warn('[ppt-pipeline] WARN: 已跳过学习上下文读取（--skip-learning）');
    return { loaded: false, skipped: true };
  }
  const { getLearningContext, logContextAccess } = require(path.join(SKILL_DIR, 'learning-context'));
  const ctx = getLearningContext();
  if (recordAccess) logContextAccess(ctx);
  const trapCount = Object.values(ctx.knownTraps || {}).reduce((sum, arr) => sum + arr.length, 0);
  const stubborn = ctx.learningEffectiveness && Array.isArray(ctx.learningEffectiveness.stubbornTraps)
    ? ctx.learningEffectiveness.stubbornTraps.slice(0, 5).map(t => t.trapId)
    : [];
  if (verbose) {
    console.log(`[ppt-pipeline] 学习上下文已读取: knownTraps=${trapCount}, lowQA=${(ctx.lowQaTemplates || []).length}, totalGenerations=${ctx.meta?.totalGenerations || 0}`);
    if (stubborn.length > 0) console.log(`[ppt-pipeline] 顽固陷阱 Top: ${stubborn.join(', ')}`);
  }
  return {
    loaded: true,
    accessRecorded: recordAccess,
    trapCount,
    lowQaCount: (ctx.lowQaTemplates || []).length,
    totalGenerations: ctx.meta?.totalGenerations || 0,
    stubbornTraps: stubborn,
  };
}

// 各 layout 对应的期望 EMU 尺寸（1 inch = 914400 EMU）
const LAYOUT_SIZES = {
  LAYOUT_16x9:  { cx: 9144000,  cy: 5143500,  inches: '10 × 5.625' },
  LAYOUT_WIDE:  { cx: 12192000, cy: 6858000,  inches: '13.33 × 7.5' },
  LAYOUT_16x10: { cx: 9144000,  cy: 5715000,  inches: '10 × 6.25' },
};

async function assertPptxSize(outputPath, layoutName) {
  const expected = LAYOUT_SIZES[layoutName] || LAYOUT_SIZES.LAYOUT_16x9;
  const zip = await JSZip.loadAsync(fs.readFileSync(outputPath));
  const entry = zip.file('ppt/presentation.xml');
  if (!entry) {
    throw new Error('[ppt-pipeline] 无法读取 PPTX 尺寸信息: ppt/presentation.xml not found');
  }
  const xml = await entry.async('string');
  const match = xml.match(/<p:sldSz[^>]*>/);
  const sizeTag = match ? match[0] : '';
  const cxRe = new RegExp(`cx="${expected.cx}"`);
  const cyRe = new RegExp(`cy="${expected.cy}"`);
  if (!cxRe.test(sizeTag) || !cyRe.test(sizeTag)) {
    throw new Error(`[ppt-pipeline] 幻灯片尺寸异常: 期望 ${expected.inches} (${expected.cx}×${expected.cy})，实际 ${sizeTag || '未找到 p:sldSz'}`);
  }
  return sizeTag;
}

// v4.1.1 (修 C-1)：渲染失败时的友好提示卡（取代裸露 stack trace 的 insightBanner）
//   样式参考 fishbone 错误卡：KEY POINTS 标签 + 友好说明 + 建议
//   原始 stack 信息只写 learning log，不显示在 PPT 上
function addFriendlyFailureCard(pres, slide, infra, layoutType, errMsg, pageTitle) {
  const C = infra && infra.C || {
    PRIMARY: '1F3A5F', ACCENT: 'C95C3E', TEXT: '262626', TEXT_LIGHT: '6B7280',
    BG_LIGHT: 'F5F1EA', WHITE: 'FFFFFF', BORDER: 'D9D9D9',
  };
  const FONTS = infra && infra.FONTS || { primary: 'Microsoft YaHei', enSmall: 'Arial' };
  // v4.1.1: 区别从 errMsg 推断缺失字段（启发式，常见 forEach/undefined/required/missing）
  const lc = String(errMsg || '').toLowerCase();
  let missingHint = '';
  const m = String(errMsg || '').match(/['"]?(\w+)['"]?\s+(?:is required|missing|undefined|of undefined|forEach)/i);
  if (m && m[1]) missingHint = m[1];
  // 推荐替代模板（按当前模板分类粗略给）
  const RECOMMEND = {
    threeColumn: 'twoColumnCards 或 cardGrid',
    twoColumnCards: 'threeColumn 或 comparison',
    comparison: 'twoColumnCards',
    beforeAfter: 'comparison',
    quadrantMatrix: 'analysisMatrix 或 swotGrid',
    orgChart: 'pyramid 或 cardGrid',
    lineupCompare: 'comparison 或 twoColumnCards',
    compositeLayout: 'twoColumnCards 或 cardGrid',
    heroStat: 'dataHighlight',
    vennDiagram: 'twoColumnCards',
    kpiDashboard: 'dataHighlight',
    iconList: 'cardGrid',
    chartBubble: 'chartScatter 或 chartBar',
    chartScatter: 'chartBar',
    fishbone: 'issueTree 或 cardGrid',
  };
  const rec = RECOMMEND[layoutType] || 'twoColumnCards 或 cardGrid';
  const cardY = 1.1;
  const cardH = 3.0;
  // 卡片底
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cardY, w: 9.0, h: cardH,
    fill: { color: C.BG_LIGHT },
    line: { color: C.ACCENT, width: 1.5 },
  });
  // 左侧色条
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: cardY, w: 0.08, h: cardH,
    fill: { color: C.ACCENT },
  });
  // KEY POINTS 标签
  slide.addText('KEY POINTS', {
    x: 0.8, y: cardY + 0.25, w: 8.5, h: 0.3,
    fontSize: 11, fontFace: FONTS.enSmall, bold: true,
    color: C.ACCENT, charSpacing: 5, margin: 0,
  });
  // v4.1.4 (修 P1-4): freeform 走单独"自定义代码执行失败"文案，区别于普通模板
  //   普通模板：字段不完整 → 推荐替代模板
  //   freeform：renderCode/renderFn 抛错 → 显示截断错误信息 + 建议加 fallback
  const isFreeform = layoutType === 'freeform';
  const mainHeadline = isFreeform ? '自定义代码执行失败' : '此页所需数据字段不完整';
  slide.addText(mainHeadline, {
    x: 0.8, y: cardY + 0.6, w: 8.5, h: 0.5,
    fontSize: 22, fontFace: FONTS.primary, bold: true,
    color: C.PRIMARY, margin: 0,
  });
  // 详细说明
  const truncatedErr = String(errMsg || '').slice(0, 80);
  const tipLines = isFreeform
    ? [
        { text: `模板：`, options: { color: C.TEXT_LIGHT, bold: false } },
        { text: 'freeform', options: { color: C.TEXT, bold: true } },
        { text: `   错误：`, options: { color: C.TEXT_LIGHT, bold: false } },
        { text: truncatedErr || '（未知错误）', options: { color: C.ACCENT, bold: true } },
      ]
    : [
        { text: `模板：`, options: { color: C.TEXT_LIGHT, bold: false } },
        { text: layoutType, options: { color: C.TEXT, bold: true } },
        { text: missingHint ? `   缺少字段：` : `   `, options: { color: C.TEXT_LIGHT, bold: false } },
        { text: missingHint ? missingHint : '（请检查必填字段）', options: { color: C.ACCENT, bold: true } },
      ];
  slide.addText(tipLines, {
    x: 0.8, y: cardY + 1.25, w: 8.5, h: 0.35,
    fontSize: 14, fontFace: FONTS.primary, margin: 0,
  });
  // 建议
  const suggestionLines = isFreeform
    ? [
        { text: '建议：', options: { color: C.TEXT_LIGHT } },
        { text: '检查 renderCode/renderFn 是否调用了沙箱外 API（如 require/process），或在 data 里加 fallback 模板兜底', options: { color: C.TEXT, bold: true } },
      ]
    : [
        { text: '建议：', options: { color: C.TEXT_LIGHT } },
        { text: missingHint ? `补全 「${missingHint}」 字段` : '检查 schema 必填字段', options: { color: C.TEXT, bold: true } },
        { text: `，或改用模板 `, options: { color: C.TEXT_LIGHT } },
        { text: rec, options: { color: C.PRIMARY, bold: true } },
      ];
  slide.addText(suggestionLines, {
    x: 0.8, y: cardY + 1.7, w: 8.5, h: 0.4,
    fontSize: 13, fontFace: FONTS.primary, margin: 0,
  });
  // 底部细备注
  slide.addText('（此页因数据字段问题已用占位卡片代替，技术细节见 learning log）', {
    x: 0.8, y: cardY + 2.4, w: 8.5, h: 0.3,
    fontSize: 10, fontFace: FONTS.primary, italic: true,
    color: C.TEXT_LIGHT, margin: 0,
  });
}

// ── 核心函数：slides 数组 → .pptx ────────────────────────────────
async function generatePptx(slides, meta, outputPath, opts = {}) {
  const { graceful = false } = opts;
  const failedSlides = [];
  const pres = new pptxgen();

  // 幻灯片尺寸主题：
  //   meta.layout = 'LAYOUT_16x9'（默认 10" × 5.625"，与 v3.4.x 兼容）
  //   meta.layout = 'LAYOUT_WIDE' （现代宽屏 13.33" × 7.5"，PPT 2016+ 默认）
  //   meta.layout = 'LAYOUT_16x10'（16:10 比例，10" × 6.25"）
  if (meta.layout === 'LAYOUT_WIDE') {
    // 自定义尺寸（pptxgenjs API）
    pres.defineLayout({ name: 'BRING_WIDE', width: 13.333, height: 7.5 });
    pres.layout = 'BRING_WIDE';
  } else if (meta.layout === 'LAYOUT_16x10') {
    pres.defineLayout({ name: 'BRING_16x10', width: 10, height: 6.25 });
    pres.layout = 'BRING_16x10';
  } else {
    pres.layout = 'LAYOUT_16x9';
  }

  pres.author = meta.author || '薄云咨询';
  pres.title  = meta.title  || 'BRINGPPT';

  // v3.7.27: graceful 模式——任意 slide 渲染抛错时不再中断整份 PPT，
  //          替换为错误占位页继续。失败列表在最终返回中。
  function addPlaceholderSlide(s, err) {
    const ph = pres.addSlide();
    ph.addText(`⚠ 此页生成失败`, {
      x: 0.5, y: 0.5, w: 9.0, h: 0.6,
      fontSize: 28, color: 'C95C3E', bold: true,
    });
    ph.addText(`slide id: ${s.id || '-'}    type: ${s.type || '-'}`, {
      x: 0.5, y: 1.3, w: 9.0, h: 0.4, fontSize: 14, color: '6B7280',
    });
    ph.addText(s.title || '(无标题)', {
      x: 0.5, y: 1.85, w: 9.0, h: 0.5, fontSize: 18, bold: true, color: '1F3A5F',
    });
    ph.addText(`错误：${String(err && err.message || err).slice(0, 240)}`, {
      x: 0.5, y: 2.6, w: 9.0, h: 2.0, fontSize: 12, color: '262626',
    });
    failedSlides.push({ id: s.id, type: s.type, error: String(err && err.message || err) });
  }

  for (const s of slides) {
    let slide;
    // ─── 'content' 走 content slide + B 类 layout 装配 ─────────────
    if (s.type === 'content') {
      // 兼容性：若整页只有一个 A 类布局，重定向到 A 类分发
      if (s.layouts && s.layouts.length === 1 && PAGE_MAP[s.layouts[0].type]) {
        const aType = s.layouts[0].type;
        const aData = Object.assign({ title: s.title }, s.layouts[0].data || {});
        slide = PAGE_MAP[aType](pres, aData);
        console.warn(`[ppt-pipeline] slide "${s.id}": A-class "${aType}" used as layout → redirected. Use type:"${aType}" directly to avoid this warning.`);
        continue;
      }
      try {
        slide = bring.addContentSlide(pres, {
          title:             s.title,
          titleEn:           s.titleEn,
          sectionTag:        s.sectionTag,
          engagementQuestion: s.engagementQuestion,
          sourceRef:         s.sourceRef,
          takeaway:          s.takeaway,        // v4.0.5 P2-6
          chapterInfo:       s.chapterInfo,     // v4.0.5 P1-3
          variant:           s.variant,          // v4.0.5 P1-4
        });
        if (s.layouts) {
          // v4.1.6: 守护框上下沿统一注入到 slide 上，所有 B 类 layout 通过 getLayoutBox(slide) 读取
          //   - 含 insightBanner：上层 layout 区 = [1.20, 4.40]，banner 区 = [4.45, 4.85]
          //   - 不含 banner：上层 layout 区 = [1.20, 4.85]
          //   - 若 takeaway 已通过 _bottomY 抬到 1.20，仍以 1.20 为上沿（防顶撞）
          const hasInsightBanner = s.layouts.some(l => l.type === 'insightBanner');
          slide._layoutTop = (typeof slide._bottomY === 'number' && slide._bottomY > 1.20)
            ? slide._bottomY : 1.20;
          if (hasInsightBanner) {
            slide._layoutBottom = 4.40;  // 上层 layout 不超过 banner 上沿 - 0.05
            slide._contentMaxBottom = 4.40;  // 向后兼容（validateBounds 旧路径）
            slide._hasInsightBanner = true;
          } else {
            slide._layoutBottom = 4.85;
            slide._contentMaxBottom = 4.85;
          }
          // v4.1.7 (修 P1-4): 多 layout (≥3, 不含 banner) 同页堆叠时，按 layout 数均分守护区，
          //   每个 layout 拿到独立 [top, bottom]，避免共用守护框 + startY 接力导致后一层 available 变负
          //   (如 styledTable rowH = -0.42)。
          //   带 banner 时也分配（含 banner 但 banner 自己用 4.45-4.85，不在 layout 列表分配里）。
          const nonBannerLayouts = s.layouts.filter(l => l.type !== 'insightBanner');
          const splitBands = nonBannerLayouts.length >= 3;
          let bandTop = slide._layoutTop;
          const totalBand = slide._layoutBottom - slide._layoutTop;
          const perBand = totalBand / Math.max(1, nonBannerLayouts.length);
          let bandIdx = 0;
          for (const lay of s.layouts) {
            const fn = LAYOUT_MAP[lay.type];
            if (!fn) {
              // v4.0.3 (修 4-B): 未知 layout 不再 throw 整页崩溃，改用 insightBanner 兜底信息
              console.warn(`[ppt-pipeline] Unknown layout "${lay.type}" (slide: ${s.id}) → insightBanner 兜底`);
              const fallbackFn = LAYOUT_MAP.insightBanner;
              if (fallbackFn) fallbackFn(pres, slide, {
                insight: `[模板 "${lay.type}" 未注册]`,
                label:   s.title || '兜底说明',
                style:   'gray',
              });
              continue;
            }
            // v4.1.3 (修 N-4): 多 layout 同页 startY 接力 —
            //   若 lay.data 未显式指定 startY，且上一个 layout 已设置 slide._bottomY，
            //   把 startY 注入到 lay.data，让本 layout 紧跟上一个之下，避免堆叠重叠。
            //   不影响只有 1 个 layout 的常见路径（slide._bottomY 仍为 undefined）。
            if (!lay.data) lay.data = {};
            if ((lay.data.startY == null) && slide._bottomY != null) {
              lay.data.startY = slide._bottomY;
            }
            // v4.1.7 (修 P1-4): 多 layout 堆叠时，临时把 slide._layoutTop/_layoutBottom 替换为
            //   本 layout 的独立带状区间，让 getLayoutBox() 拿到正确范围；渲染后恢复总区间。
            const savedTop = slide._layoutTop;
            const savedBottom = slide._layoutBottom;
            const savedCmb = slide._contentMaxBottom;
            if (splitBands && lay.type !== 'insightBanner') {
              const bandBottom = bandTop + perBand - 0.10;  // 0.10" 间隔
              slide._layoutTop = bandTop;
              slide._layoutBottom = bandBottom;
              slide._contentMaxBottom = bandBottom;
              lay.data.startY = bandTop;
              bandTop += perBand;
              bandIdx++;
            }
            // v4.0.3 (修 4-B): 每个 layout 独立 try/catch，单 layout 失败时降级到 insightBanner，
            // 而不是把整页都换成"⚠ 生成失败"占位 — 大幅减少信息损失。
            try {
              fn(pres, slide, lay.data);
            } catch (layErr) {
              // v4.1.1 (修 C-1)：不再直接打印 stack 给用户，改为友好咨询师风格提示卡
              console.warn(`[ppt-pipeline] layout "${lay.type}" (slide: ${s.id}) 渲染失败: ${layErr.message} → 友好卡片兜底`);
              try {
                addFriendlyFailureCard(pres, slide, bring, lay.type, layErr.message, s.title);
              } catch (cardErr) {
                // 友好卡片若也失败，再降级到最简 insightBanner
                const fallbackFn = LAYOUT_MAP.insightBanner;
                if (fallbackFn) {
                  try {
                    fallbackFn(pres, slide, {
                      insight: '此页所需数据字段不完整，建议检查必填字段',
                      label:   s.title || '字段不匹配',
                      style:   'blue',
                    });
                  } catch { /* 静默 */ }
                }
              }
              failedSlides.push({ id: s.id, type: lay.type, error: layErr.message });
            }
            // v4.1.7: 恢复总守护区间，避免后续 banner 等共享区域读到 band 区间
            if (splitBands && lay.type !== 'insightBanner') {
              slide._layoutTop = savedTop;
              slide._layoutBottom = savedBottom;
              slide._contentMaxBottom = savedCmb;
            }
          }
        }
      } catch (err) {
        if (!graceful) throw err;
        addPlaceholderSlide(s, err);
      }
      continue;
    }
    // ─── 其他 type 走 A 类页面模板自动分发 ─
    const pageFn = PAGE_MAP[s.type];
    if (pageFn) {
      try {
        slide = pageFn(pres, s);
      } catch (err) {
        if (!graceful) throw err;
        addPlaceholderSlide(s, err);
      }
      continue;
    }

    // v4.0.4 (修 4-I): type 直通到 B 类 layout
    //   storyboard 作者常把 heroQuote / heroStat / heroClosing 当 A 类整页用
    //   （SKILL.md 与 storyboard skill 文档历来都这么描述），但它们其实是 B 类 layout。
    //   现在自动包成 content slide + 该 layout，user 体验与 A 类直通一致。
    if (LAYOUT_MAP[s.type]) {
      try {
        // 以 content slide 作为底座（保留 title/sectionTag）
        slide = bring.addContentSlide(pres, {
          title:             s.title,
          titleEn:           s.titleEn,
          sectionTag:        s.sectionTag,
          engagementQuestion: s.engagementQuestion,
          sourceRef:         s.sourceRef,
          takeaway:          s.takeaway,        // v4.0.5 P2-6
          chapterInfo:       s.chapterInfo,     // v4.0.5 P1-3
          variant:           s.variant,          // v4.0.5 P1-4
        });
        // s 上的其余字段直接作为 layout data 透传
        const { id, type, title, sectionTag, engagementQuestion, sourceRef, layouts, ...layoutData } = s;
        LAYOUT_MAP[s.type](pres, slide, layoutData);
      } catch (err) {
        if (!graceful) throw err;
        addPlaceholderSlide(s, err);
      }
      continue;
    }

    // 未知 type
    console.warn(`[ppt-pipeline] Unknown slide type: ${s.type} (id: ${s.id})`);
  }

  // v4.1.1 (修 B-1): writeFile 仍可能因 pptxgenjs 内部生成 excel/chart XML 时崩溃
  //   （例如 chartBubble/chartScatter 数据残缺虽然 addChart 当时不抛，但 writeFile 时 createExcelWorksheet 抛）
  //   graceful 模式下捕获并以同样的"友好兜底"思路重试：把所有失败的 chart 类 slide 替换为占位卡再写
  try {
    await pres.writeFile({ fileName: outputPath });
  } catch (writeErr) {
    if (!graceful) throw writeErr;
    console.warn(`[ppt-pipeline] writeFile 失败（chart 引擎崩）: ${writeErr.message}`);
    console.warn(`[ppt-pipeline] 启用应急写盘：跳过 chart 系列重试...`);
    // 应急：重新生成一份 pres，跳过所有 chart 系列 layout + freeform（freeform 可能也调 addChart）
    //   这里采用"宁可空白也要保住整份输出"的原则：把所有失败 slide 用友好卡片替代
    const SKIP_CHART_TYPES = new Set([
      'chartBubble', 'chartScatter', 'chartCombo', 'chartRadar', 'chartArea',
      'chartBar', 'chartBar3d', 'chartLine', 'chartPie',
      'freeform',  // freeform 可能内嵌 chart 调用，应急时跳过
    ]);
    const pres2 = new pptxgen();
    if (meta.layout === 'LAYOUT_WIDE') {
      pres2.defineLayout({ name: 'BRING_WIDE', width: 13.333, height: 7.5 });
      pres2.layout = 'BRING_WIDE';
    } else if (meta.layout === 'LAYOUT_16x10') {
      pres2.defineLayout({ name: 'BRING_16x10', width: 10, height: 6.25 });
      pres2.layout = 'BRING_16x10';
    } else {
      pres2.layout = 'LAYOUT_16x9';
    }
    pres2.author = meta.author || '薄云咨询';
    pres2.title  = meta.title  || 'BRINGPPT';
    for (const s of slides) {
      try {
        if (s.type === 'content') {
          const slide2 = bring.addContentSlide(pres2, {
            title: s.title, titleEn: s.titleEn, sectionTag: s.sectionTag,
            engagementQuestion: s.engagementQuestion, sourceRef: s.sourceRef,
            takeaway: s.takeaway, chapterInfo: s.chapterInfo, variant: s.variant,
          });
          if (s.layouts) {
            // v4.1.6: 应急路径同样注入守护框
            const hasInsightBanner2 = s.layouts.some(l => l.type === 'insightBanner');
            slide2._layoutTop = (typeof slide2._bottomY === 'number' && slide2._bottomY > 1.20)
              ? slide2._bottomY : 1.20;
            if (hasInsightBanner2) {
              slide2._layoutBottom = 4.40;
              slide2._contentMaxBottom = 4.40;
              slide2._hasInsightBanner = true;
            } else {
              slide2._layoutBottom = 4.85;
              slide2._contentMaxBottom = 4.85;
            }
            for (const lay of s.layouts) {
              if (SKIP_CHART_TYPES.has(lay.type)) {
                try { addFriendlyFailureCard(pres2, slide2, bring, lay.type, '图表引擎数据校验失败', s.title); }
                catch { /* */ }
                failedSlides.push({ id: s.id, type: lay.type, error: 'chart engine crash on writeFile' });
                continue;
              }
              const fn = LAYOUT_MAP[lay.type];
              if (!fn) continue;
              // v4.1.3 (修 N-4): 应急写盘路径同样接力 startY
              if (!lay.data) lay.data = {};
              if ((lay.data.startY == null) && slide2._bottomY != null) {
                lay.data.startY = slide2._bottomY;
              }
              try { fn(pres2, slide2, lay.data); }
              catch (e) {
                try { addFriendlyFailureCard(pres2, slide2, bring, lay.type, e.message, s.title); } catch {}
                failedSlides.push({ id: s.id, type: lay.type, error: e.message });
              }
            }
          }
        } else {
          const pageFn = PAGE_MAP[s.type];
          if (pageFn) { pageFn(pres2, s); continue; }
          if (LAYOUT_MAP[s.type]) {
            if (SKIP_CHART_TYPES.has(s.type)) {
              const slide2 = bring.addContentSlide(pres2, { title: s.title, sectionTag: s.sectionTag });
              try { addFriendlyFailureCard(pres2, slide2, bring, s.type, '图表引擎数据校验失败', s.title); } catch {}
              failedSlides.push({ id: s.id, type: s.type, error: 'chart engine crash on writeFile' });
              continue;
            }
            const slide2 = bring.addContentSlide(pres2, {
              title: s.title, titleEn: s.titleEn, sectionTag: s.sectionTag,
              engagementQuestion: s.engagementQuestion, sourceRef: s.sourceRef,
              takeaway: s.takeaway, chapterInfo: s.chapterInfo, variant: s.variant,
            });
            const { id, type, title, sectionTag, engagementQuestion, sourceRef, layouts, ...layoutData } = s;
            try { LAYOUT_MAP[s.type](pres2, slide2, layoutData); }
            catch (e) {
              try { addFriendlyFailureCard(pres2, slide2, bring, s.type, e.message, s.title); } catch {}
              failedSlides.push({ id: s.id, type: s.type, error: e.message });
            }
          }
        }
      } catch (slideErr) {
        // 单页失败：换占位
        const ph = pres2.addSlide();
        ph.addText('⚠ 此页生成失败', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 28, color: 'C95C3E', bold: true });
        ph.addText(s.title || '(无标题)', { x: 0.5, y: 1.85, w: 9.0, h: 0.5, fontSize: 18, bold: true, color: '1F3A5F' });
        failedSlides.push({ id: s.id, type: s.type, error: String(slideErr.message || slideErr) });
      }
    }
    await pres2.writeFile({ fileName: outputPath });
  }
  await stripPptxNotes(outputPath);
  return { failedSlides };
}

// ── 主函数：storyboard → .pptx ────────────────────────────────────
/**
 * @param {object} opts
 * @param {object|string} opts.storyboard - 分镜脚本对象或 JSON 字符串
 * @param {string} [opts.outputPath]      - 输出路径（默认 ./output.pptx）
 * @param {string} [opts.projectDir]      - 项目目录（存放中间文件）
 * @param {boolean} [opts.verbose]        - 是否打印详细日志
 * @param {boolean} [opts.skipValidate]   - 是否跳过 validate:all（仅调试使用）
 * @param {boolean} [opts.skipLearning]   - 是否跳过学习上下文读取（仅调试使用）
 * @param {boolean} [opts.noLearn]        - 是否跳过生成统计写入（测试/草稿使用）
 * @returns {Promise<{ pptxPath: string, slideCount: number, conversionLog: string[], slidesDataPath?: string }>}
 */
async function run(opts = {}) {
  const {
    verbose = false,
    skipValidate = false,
    skipLearning = false,
    noLearn = false,
    graceful = false,
    // v4.1.9：upload_file_to_drive 契约相关参数（与 OpenAPI 字段命名对齐）
    destinationFolderId,
    destinationFolderUrl,
    onConflict,
    suppressUploadHint = false,   // 仅测试场景禁用 stdout hint
  } = opts;

  // 解析输入
  let storyboard = opts.storyboard;
  if (typeof storyboard === 'string') {
    storyboard = JSON.parse(storyboard);
  }
  // 兼容示例文件的包装格式 { stage2_storyboard: { meta, chapters } }
  if (storyboard && storyboard.stage2_storyboard) {
    storyboard = storyboard.stage2_storyboard;
  }
  if (!storyboard || !storyboard.meta || !storyboard.chapters) {
    // 友好提示：判断常见误用——传入 slides-data 格式而非 storyboard 格式
    const looksLikeSlidesData =
      storyboard && Array.isArray(storyboard.slides) && !storyboard.chapters;
    if (looksLikeSlidesData) {
      throw new Error(
        '[ppt-pipeline] 输入看起来是 slides-data 格式（{meta, slides}），但 pipeline 接收的是 storyboard 格式（{meta, chapters}）。\n' +
        '  解法 A（推荐）：把内容改写为 storyboard 格式，字段定义见 docs/STORYBOARD-SCHEMA.md\n' +
        '  解法 B：如果你坚持用 slides-data，绕过 pipeline，改用：\n' +
        '         node gen_ppt_template.js   （需先把数据放到 _temp/slides-data.json）'
      );
    }
    throw new Error(
      '[ppt-pipeline] 无效的分镜脚本：缺少 meta 或 chapters 字段。\n' +
      '  storyboard 字段定义见 docs/STORYBOARD-SCHEMA.md'
    );
  }

  // 确定输出路径
  const projectDir = opts.projectDir || path.join(os.tmpdir(), 'bringppt-output');
  fs.mkdirSync(projectDir, { recursive: true });

  const outputPath = path.resolve(
    opts.outputPath || storyboard.meta.outputPath || './output.pptx'
  );

  // 确保输出目录存在
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (verbose) {
    console.log(`[ppt-pipeline] 分镜脚本: ${storyboard.meta.title}`);
    console.log(`[ppt-pipeline] 输出路径: ${outputPath}`);
  }

  // Step 1: 读取学习上下文，确保版式选择前已拿到历史陷阱/偏好/低QA模板
  let learningContext;
  try {
    learningContext = loadLearningContext({ verbose, skipLearning, recordAccess: !noLearn });
  } catch (e) {
    throw new Error(`[ppt-pipeline] 无法加载学习上下文，拒绝生成 PPT。若只是在调试，可显式传 --skip-learning。\n${e.message}`);
  }

  // Step 2: storyboard → slides-data（三层稳定性机制）
  const conversionLog = [];
  const { slides, meta } = convertStoryboard(storyboard, {
    verbose,
    onLayoutSelected: (slideId, layout, reason) => {
      conversionLog.push(`${slideId}: ${layout} (${reason})`);
    },
  });

  if (verbose) {
    console.log(`[ppt-pipeline] 转换完成: ${slides.length} 页`);
  }

  // Step 3: slides-data 落盘为 JSON，避免用户内容进入可执行 JS
  const slidesDataPath = safeWriteSlidesData(projectDir, slides, meta);

  // Step 4: 强制质量门禁（结构/内容/视觉/统计/已知陷阱）
  // v4.0.3: graceful 模式下，schema 错误会被降级为警告（与 layouts 直通的兜底机制一致）
  let validation = null;
  if (!skipValidate) {
    validation = validateSlidesData(slidesDataPath, { verbose, graceful });
  } else if (verbose) {
    console.warn('[ppt-pipeline] WARN: 已跳过 slides-data 验证（--skip-validate）');
  }

  // Step 5: slides → .pptx
  const renderResult = await generatePptx(slides, meta, outputPath, { graceful });
  if (renderResult && renderResult.failedSlides && renderResult.failedSlides.length) {
    // v4.0.3 (修 4-B): 区分整页占位 vs 单 layout 兜底
    const placeholders = renderResult.failedSlides.filter(f => f.type === 'content' || !f.type);
    const layoutBanners = renderResult.failedSlides.filter(f => f.type && f.type !== 'content');
    if (placeholders.length) {
      console.warn(`[ppt-pipeline] ⚠ ${placeholders.length} 张 slide 整页失败，已用占位符替代`);
      placeholders.forEach(f => console.warn(`  - ${f.id || '-'}: ${f.error.slice(0, 80)}`));
    }
    if (layoutBanners.length) {
      console.warn(`[ppt-pipeline] ⚠ ${layoutBanners.length} 个 layout 渲染失败，已用 insightBanner 兜底（页面仍可读）`);
      layoutBanners.forEach(f => console.warn(`  - ${f.id || '-'} (${f.type}): ${f.error.slice(0, 80)}`));
    }
  }

  // Step 6: 交付前尺寸检查（根据 meta.layout 校验对应尺寸）
  const sizeTag = await assertPptxSize(outputPath, meta.layout);

  // Step 5.5: 内容真实性校验（Pillar A）—— 当 storyboard 含 meta.sourceDocPath 时启用
  let grounding = null;
  if (meta && meta.sourceDocPath) {
    try {
      const srcPath = path.isAbsolute(meta.sourceDocPath) ? meta.sourceDocPath : path.join(projectDir, meta.sourceDocPath);
      if (fs.existsSync(srcPath)) {
        const sourceText = fs.readFileSync(srcPath, 'utf8');
        const { runGrounding } = require('./validators/grounding-check');
        grounding = await runGrounding({ slides, meta }, sourceText, {
          minHitRate: meta.groundingMinHitRate || 0.5,
          enableLLM:  process.env.BRINGPPT_GROUNDING_LLM === '1',
        });
        if (grounding.suspicious && grounding.suspicious.length) {
          console.warn(`[ppt-pipeline] ⚠ 内容真实性：${grounding.suspicious.length} 条 claim 未在源文档中找到充分支撑`);
          grounding.suspicious.slice(0, 6).forEach(s =>
            console.warn(`  - slide ${s.slideIdx} hit=${s.hitRate}: "${s.claim}"${s.missingNumbers.length ? ` (缺数字: ${s.missingNumbers.join(',')})` : ''}`)
          );
        } else if (grounding.error) {
          console.warn(`[ppt-pipeline] grounding 跳过: ${grounding.error}`);
        }
      } else if (verbose) {
        console.warn(`[ppt-pipeline] meta.sourceDocPath 找不到文件: ${srcPath}`);
      }
    } catch (e) {
      console.warn('[ppt-pipeline] grounding 校验失败:', e.message);
    }
  }

  // Step 6.5: 渲染后文本框非空检查（Pillar 8）—— catch 适配器返错字段导致框内空白类 bug
  let postRender = null;
  try {
    const { checkPostRender } = require('./lib/post-render-check');
    postRender = await checkPostRender(outputPath, slides);
    if (postRender.suspicious.length) {
      // v4.0.3 (修 4-D): 改报"疑似空 slide"而不是"命中率"
      const list = postRender.suspicious.slice(0, 8).map(s =>
        `    slide ${s.slideIdx} (${s.slideId || '-'}/${s.layouts}): ${s.blockCount} 文本块/${s.charCount} 字 — ${s.hint}`
      ).join('\n');
      console.warn(`[ppt-pipeline] ⚠ ${postRender.suspicious.length} 张 slide 渲染文本极少（疑似字段错配/静默失败）：\n${list}`);
    }
  } catch (e) {
    if (verbose) console.warn('[ppt-pipeline] post-render 检查失败:', e.message);
  }

  // Step 7: 成功生成后写入模板使用统计（失败不影响交付，但 verbose 下可见）
  const learning = recordGenerationStats(slidesDataPath, { verbose, noLearn });

  if (verbose) {
    console.log(`[ppt-pipeline] ✅ 生成完成: ${outputPath}`);
    console.log(`[ppt-pipeline] 尺寸检查: ${sizeTag}`);
  }

  // Step 8 (v4.1.9): 按 OpenAPI 规格生成 upload_file_to_drive 请求 JSON
  //   - 严格遵循字段命名：source_file / destination_folder_id / mime_type / on_conflict
  //   - 目录优先级：CLI > BRINGPPT_DEFAULT_FOLDER_ID（env） > meta.destinationFolderId > Agent 默认
  //   - 不实际上传，仅产出契约 + stdout hint，由调用方喂给 upload_file_to_drive 工具
  let uploadRequest = null;
  let uploadResponse = null;
  try {
    // CLI > env > meta：env 比 meta 优先级高（与任务规格一致），但 CLI 始终最高
    const envFolderId = (process.env.BRINGPPT_DEFAULT_FOLDER_ID || '').trim() || undefined;
    const folderIdEffective = destinationFolderId
      || envFolderId
      || (meta && meta.destinationFolderId)
      || undefined;
    const folderUrlEffective = destinationFolderUrl
      || (folderIdEffective ? undefined : (meta && meta.destinationFolderUrl))
      || undefined;
    const onConflictEffective = onConflict || (meta && meta.onConflict) || undefined;
    uploadRequest = buildUploadRequest(outputPath, {
      title:                 meta && meta.title,
      destinationFolderId:   folderIdEffective,
      destinationFolderUrl:  folderUrlEffective,
      onConflict:            onConflictEffective,
    });
    if (process.env.BRINGPPT_UPLOAD_COMMAND) {
      uploadResponse = uploadFileToDrive(uploadRequest);
      if (!suppressUploadHint) {
        console.log('');
        console.log('=== upload_file_to_drive (Google Drive 原样上传) ===');
        console.log(JSON.stringify(uploadResponse, null, 2));
        console.log('===');
        console.log('');
      }
    } else if (!suppressUploadHint) {
      printUploadHint(uploadRequest, outputPath);
    }
  } catch (uErr) {
    // 解析失败（如 url 不合法）不阻断 pptx 交付，但用 warn 标记 error_code
    console.warn(`[ppt-pipeline] [WARN] 构造 upload_file_to_drive 请求失败 (${uErr.error_code || 'UNKNOWN'}): ${uErr.message}`);
  }

  return {
    pptxPath:  outputPath,
    slideCount: slides.length,
    conversionLog,
    slidesDataPath,
    validation,
    learningContext,
    learning,
    sizeTag,
    postRender,
    grounding,
    // v4.1.9：upload_file_to_drive 请求 JSON（符合 OpenAPI UploadFileToDriveRequest schema）
    uploadRequest,
    uploadResponse,
  };
}

// ── CLI 入口 ──────────────────────────────────────────────────────
async function cli() {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

  const inputPath  = get('--input');
  const outputPath = get('--output');
  const projectDir = get('--project-dir');
  const verbose    = args.includes('--verbose') || args.includes('-v');
  const skipValidate = args.includes('--skip-validate');
  const skipLearning = args.includes('--skip-learning');
  const noLearn = args.includes('--no-learn') || args.includes('--no-record-learning');
  const graceful = args.includes('--graceful');

  // v4.1.9 (upload_file_to_drive 契约相关 CLI 参数 — 与 OpenAPI 字段命名对齐)
  //   --destination-folder-id <id>   推荐，对应 destination_folder_id
  //   --destination-folder-url <url> 备选，对应 destination_folder_url
  //   --on-conflict <策略>           keep_both | replace | fail（默认 keep_both）
  //   --folder <ref>                 v4.1.9 早期兼容别名（id 或 url 均可），等价于上面两个 CLI 之一
  const destinationFolderId  = get('--destination-folder-id');
  const destinationFolderUrl = get('--destination-folder-url');
  const onConflict           = get('--on-conflict');
  const folderAlias          = get('--folder');   // 向后兼容
  let resolvedFolderId  = destinationFolderId;
  let resolvedFolderUrl = destinationFolderUrl;
  if (!resolvedFolderId && !resolvedFolderUrl && folderAlias) {
    // --folder 接受 id 或 https://drive.google.com/drive/folders/... URL
    if (/^https?:/i.test(folderAlias)) {
      resolvedFolderUrl = folderAlias;
    } else {
      resolvedFolderId = folderAlias;
    }
  }

  if (!inputPath) {
    console.error('用法: node ppt-pipeline.js --input storyboard.json [--output ./output.pptx] [--verbose] [--skip-validate] [--skip-learning] [--graceful] [--destination-folder-id <id> | --destination-folder-url <url> | --folder <id|url>] [--on-conflict keep_both|replace|fail]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[ppt-pipeline] 找不到输入文件: ${inputPath}`);
    process.exit(1);
  }

  let storyboard;
  try {
    storyboard = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  } catch (e) {
    console.error(`[ppt-pipeline] JSON 解析失败: ${e.message}`);
    process.exit(1);
  }

  try {
    const result = await run({
      storyboard, outputPath, projectDir,
      verbose, skipValidate, skipLearning, noLearn, graceful,
      destinationFolderId:  resolvedFolderId,
      destinationFolderUrl: resolvedFolderUrl,
      onConflict,
    });
    console.log(`✅ 生成完成: ${result.pptxPath} (${result.slideCount} 页)`);
    if (verbose && result.conversionLog.length > 0) {
      console.log('版式选择日志:');
      result.conversionLog.forEach(l => console.log('  ' + l));
    }
  } catch (err) {
    console.error(`[ppt-pipeline] 生成失败: ${err.message}`);
    if (verbose) console.error(err.stack);
    process.exit(1);
  }
}

// 判断是直接运行还是被 require
if (require.main === module) {
  cli();
} else {
  module.exports = { run, generatePptx };
}
