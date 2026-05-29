// gen_ppt.js — 标准装配脚本模板（经50页PPT生产验证）
// 复制此文件到项目 _temp/ 目录，修改 slides-data 引用路径即可使用
// 自动定位 SKILL 安装目录（支持跨平台可移植）
//
// 参数：
//   --from N            从第 N 张开始（渐进式 QA）
//   --to N              生成到第 N 张
//   --skip-learning     跳过学习上下文（不推荐，绕过闸门 1）
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawnSync } = require("child_process");

function resolveSkillDir() {
  const candidates = [
    process.env.BRINGPPT_SKILL_DIR,
    path.resolve(__dirname, ".."),
    path.resolve(__dirname, "..", "bringppt"),
    __dirname,
    "/home/oai/skills/bringppt",
    path.join(os.homedir(), ".claude", "skills", "bringppt"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "bring-core.js"))) return p;
  }
  throw new Error("Cannot locate BRINGPPT skill directory. Set BRINGPPT_SKILL_DIR=/path/to/bringppt.");
}

const SKILL_DIR = resolveSkillDir();
const bring = require(path.join(SKILL_DIR, "bring-core"));
const { stripPptxNotes } = require(path.join(SKILL_DIR, "lib", "pptx-notes"));
function loadSlidesData() {
  const jsonPath = path.join(__dirname, "slides-data.json");
  const jsPath = path.join(__dirname, "slides-data.js");
  if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  return require(jsPath);
}
const { meta, slides } = loadSlidesData();
let pptxgen;
try { pptxgen = require("pptxgenjs"); }
catch { pptxgen = require(path.join(SKILL_DIR, "node_modules", "pptxgenjs")); }
const SLIDES_DATA_PATH = fs.existsSync(path.join(__dirname, "slides-data.json"))
  ? path.join(__dirname, "slides-data.json")
  : path.join(__dirname, "slides-data.js");

// --from / --to 参数（渐进式QA）
const args = process.argv.slice(2);
let fromIdx = 0, toIdx = slides.length;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--from") fromIdx = parseInt(args[i + 1]) || 0;
  if (args[i] === "--to") toIdx = parseInt(args[i + 1]) || slides.length;
}

// 版式模板分发表 —— 从 registry 自动生成，新增模板无需修改本文件
// v3.7.4: 同时引入 A 类页面模板自动分发（page-template-map.js）
const buildLayoutMap = require(path.join(SKILL_DIR, "lib", "layout-map"));
const buildPageMap   = require(path.join(SKILL_DIR, "lib", "page-template-map"));
const layoutMap = buildLayoutMap(bring);
const pageMap   = buildPageMap(bring);

async function main() {
  // ── [Fix10] 闸门 1：强制读取学习上下文 ─────────────────────────
  // 默认必须成功加载学习上下文才能生成 PPT，除非显式 --skip-learning
  const skipLearning = args.includes("--skip-learning");
  let ctxLoaded = false;

  if (!skipLearning) {
    try {
      const { getLearningContext, logContextAccess } = require(path.join(SKILL_DIR, "learning-context"));
      const ctx = getLearningContext();
      logContextAccess(ctx);  // 显式埋点，证明本次 gen_ppt 确实读了上下文
      const trapCount = Object.values(ctx.knownTraps).reduce((s, v) => s + v.length, 0);
      const overflowTemplates = Object.keys(ctx.overflowRisk);

      if (trapCount > 0 || overflowTemplates.length > 0) {
        console.log("[LEARN] ── 已知陷阱提示 ───────────────────────────────");
        for (const [tpl, traps] of Object.entries(ctx.knownTraps)) {
          for (const t of traps) {
            console.log(`[LEARN] ⚠️  ${tpl} [${t.id}]: ${t.condition.slice(0, 80)}`);
            if (t.fix && t.fix !== '（暂无修复方案）') {
              console.log(`[LEARN]    → ${t.fix.slice(0, 80)}`);
            }
          }
        }
        if (overflowTemplates.length > 0) {
          console.log(`[LEARN] 📐 Overflow风险模板: ${overflowTemplates.join(', ')}`);
        }

        // [Fix10] 顺便把学习效果指标也显示出来，让人一眼看到系统是否有效
        const eff = ctx.learningEffectiveness;
        if (eff && eff.totalRepeats > 0) {
          console.log(`[LEARN] 🎯 过去 ${eff.windowDays} 天重复踩坑 ${eff.totalRepeats} 次`);
          if (eff.stubbornTraps && eff.stubbornTraps.length > 0) {
            console.log(`[LEARN]    最顽固: ${eff.stubbornTraps.slice(0, 3).map(t => t.trapId).join(', ')}`);
          }
        }
        console.log("[LEARN] ────────────────────────────────────────────────");
      }
      ctxLoaded = true;
    } catch (e) {
      // [Fix10] 关键变更：不再静默吞掉，而是打印错误并退出
      console.error("\x1b[31m[FATAL]\x1b[0m 无法加载学习上下文，拒绝生成 PPT。");
      console.error("        原因:", e.message);
      console.error("        如需跳过（不推荐），使用 --skip-learning 参数。");
      process.exit(3);  // exit 3 = 学习上下文加载失败
    }
  } else {
    console.warn("\x1b[33m[WARN]\x1b[0m 已跳过学习上下文加载（--skip-learning）");
  }

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = meta.author;
  pres.title = meta.title;

  const selected = slides.slice(fromIdx, toIdx);
  console.log(`Generating ${selected.length} slides (from=${fromIdx}, to=${toIdx})...`);

  for (const s of selected) {
    let slide;
    // ─── 'content' 走 content slide + B 类 layout 装配 ─────────────
    if (s.type === 'content') {
      // 兼容性处理：单个 layout 且类型是 A 类 tocPage，直接走 A 类分发
      if (s.layouts && s.layouts.length === 1 && pageMap[s.layouts[0].type]) {
        const tocType = s.layouts[0].type;
        const tocData = Object.assign({ title: s.title }, s.layouts[0].data || {});
        slide = pageMap[tocType](pres, tocData);
        console.warn(`[COMPAT] slide "${s.id}": A-class "${tocType}" used as layout → redirected. Use type:"${tocType}" directly to avoid this warning.`);
        continue;
      }
      slide = bring.addContentSlide(pres, { title: s.title, sectionTag: s.sectionTag, engagementQuestion: s.engagementQuestion, sourceRef: s.sourceRef });
      if (s.layouts) {
        for (const lay of s.layouts) {
          const fn = layoutMap[lay.type];
          // v3.7.5: layout-map 自动注入 _templateName，不需要手设
          if (fn) fn(pres, slide, lay.data);
          else console.warn(`Unknown layout: ${lay.type} (slide: ${s.id})`);
        }
      }
      continue;
    }
    // ─── 其他 type 走 A 类页面模板自动分发（v3.7.4: 从硬编码 switch 改为 registry 驱动）─
    const pageFn = pageMap[s.type];
    if (pageFn) {
      slide = pageFn(pres, s);
    } else {
      console.warn(`Unknown type: ${s.type} (slide: ${s.id}); available: ${Object.keys(pageMap).sort().join(', ')}`);
    }
  }

  const outPath = meta.outputPath || (__dirname + "/output.pptx");
  await pres.writeFile({ fileName: outPath });
  await stripPptxNotes(outPath);
  console.log(`Output: ${outPath} (${selected.length} slides)`);

  // 自学习：自动记录模板使用统计
  try {
    spawnSync(process.execPath, [path.join(SKILL_DIR, "record-learning.js"), "--stats", SLIDES_DATA_PATH], { stdio: "inherit" });
  } catch (e) { /* 统计记录失败不影响PPT输出 */ }
}

main().catch(err => { console.error(err); process.exit(1); });
