'use strict';
/**
 * validators/stats.js — Slide 统计汇聚与打印（v3.7.7 抽取）
 *
 * 纯函数。给定 slides 数组，返回结构化统计或打印 ASCII 报表。
 * 调用方：validate-slides.js --stats、learning-report.js（可选）。
 */

// ===== Stats Collection (for --stats mode) =====
function collectStats(allSlides) {
  const stats = {
    totalSlides: allSlides.length,
    typeDistribution: {},
    layoutDistribution: {},
    totalLayouts: 0,
    // Enrichment tracking
    enrichment: {
      stepList: { total: 0, withSummary: 0 },
      layeredList: { total: 0, withSummary: 0, withBanner: 0 },
      comparison: { total: 0, withBottomText: 0, withShowVS: 0 },
      styledTable: { total: 0, withSummary: 0 },
    },
    // ContentSlide parameter usage
    contentSlideParams: { total: 0, withSectionTag: 0, withEngagementQ: 0, withSourceRef: 0 },
    // startY customization
    startY: { totalLayoutSlots: 0, customized: 0 },
  };

  for (const s of allSlides) {
    // Type distribution
    stats.typeDistribution[s.type] = (stats.typeDistribution[s.type] || 0) + 1;


    // Content page specifics
    if (s.type === "content") {
      stats.contentSlideParams.total++;
      if (s.sectionTag) stats.contentSlideParams.withSectionTag++;
      if (s.engagementQuestion) stats.contentSlideParams.withEngagementQ++;
      if (s.sourceRef) stats.contentSlideParams.withSourceRef++;

      if (s.layouts) {
        for (const lay of s.layouts) {
          if (!lay.type) continue;
          stats.layoutDistribution[lay.type] = (stats.layoutDistribution[lay.type] || 0) + 1;
          stats.totalLayouts++;

          // startY tracking
          stats.startY.totalLayoutSlots++;
          if (lay.data && lay.data.startY !== undefined && lay.data.startY !== null) {
            stats.startY.customized++;
          }

          // Enrichment tracking
          if (!lay.data) continue;
          const d = lay.data;
          const lt = lay.type;

          if (lt === "stepList") {
            stats.enrichment.stepList.total++;
            if (d.summary && typeof d.summary === "string" && d.summary.trim()) stats.enrichment.stepList.withSummary++;
          }
          if (lt === "layeredList") {
            stats.enrichment.layeredList.total++;
            if (d.summary && typeof d.summary === "string" && d.summary.trim()) stats.enrichment.layeredList.withSummary++;
            if (d.banner) stats.enrichment.layeredList.withBanner++;
          }
          if (lt === "comparison") {
            stats.enrichment.comparison.total++;
            if (d.bottomText && typeof d.bottomText === "string" && d.bottomText.trim()) stats.enrichment.comparison.withBottomText++;
            if (d.showVS) stats.enrichment.comparison.withShowVS++;
          }
          if (lt === "styledTable") {
            stats.enrichment.styledTable.total++;
            if (d.summary && typeof d.summary === "string" && d.summary.trim()) stats.enrichment.styledTable.withSummary++;
          }
        }
      }
    }
  }

  return stats;
}

function printStats(stats) {
  const pct = (n, d) => d > 0 ? `${Math.round(n / d * 100)}%` : "N/A";
  const bar = (n, d, w = 20) => {
    if (d === 0) return "░".repeat(w);
    const filled = Math.round(n / d * w);
    return "█".repeat(filled) + "░".repeat(w - filled);
  };

  console.log("\n\x1b[36m══════════════════════════════════════════\x1b[0m");
  console.log("\x1b[36m  BRINGPPT STATS REPORT\x1b[0m");
  console.log("\x1b[36m══════════════════════════════════════════\x1b[0m\n");

  // Slide type distribution
  console.log("\x1b[1m[SLIDE TYPES]\x1b[0m");
  for (const [type, count] of Object.entries(stats.typeDistribution).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(14)} ${bar(count, stats.totalSlides, 15)} ${count}/${stats.totalSlides} (${pct(count, stats.totalSlides)})`);
  }

  // Layout distribution
  console.log(`\n\x1b[1m[LAYOUT TYPES]\x1b[0m  (${stats.totalLayouts} total)`);
  for (const [type, count] of Object.entries(stats.layoutDistribution).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(20)} ${bar(count, stats.totalLayouts, 15)} ${count} (${pct(count, stats.totalLayouts)})`);
  }

  // Enrichment usage rates
  console.log("\n\x1b[1m[ENRICHMENT USAGE]\x1b[0m");
  const enrichChecks = [];
  const e = stats.enrichment;

  // v4.0.3 (修 4-A): 富集字段命中率从 [required: 100%] 改为 [recommended]，命中不足只发 WARN
  if (e.stepList.total > 0) {
    const rate = e.stepList.withSummary / e.stepList.total;
    const tag = rate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
    console.log(`  stepList.summary     ${bar(e.stepList.withSummary, e.stepList.total)} ${e.stepList.withSummary}/${e.stepList.total} (${pct(e.stepList.withSummary, e.stepList.total)}) [recommended] ${tag}`);
    enrichChecks.push({ name: "stepList.summary", rate, required: 0.5 });  // 阈值改为推荐 50%
  }
  if (e.layeredList.total > 0) {
    const rate = e.layeredList.withSummary / e.layeredList.total;
    const tag = rate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
    console.log(`  layeredList.summary  ${bar(e.layeredList.withSummary, e.layeredList.total)} ${e.layeredList.withSummary}/${e.layeredList.total} (${pct(e.layeredList.withSummary, e.layeredList.total)}) [recommended] ${tag}`);
    enrichChecks.push({ name: "layeredList.summary", rate, required: 0.5 });

    const bannerRate = e.layeredList.withBanner / e.layeredList.total;
    const bannerTag = bannerRate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
    console.log(`  layeredList.banner   ${bar(e.layeredList.withBanner, e.layeredList.total)} ${e.layeredList.withBanner}/${e.layeredList.total} (${pct(e.layeredList.withBanner, e.layeredList.total)}) [target: ≥50%] ${bannerTag}`);
    enrichChecks.push({ name: "layeredList.banner", rate: bannerRate, required: 0.5 });
  }
  if (e.comparison.total > 0) {
    const btRate = e.comparison.withBottomText / e.comparison.total;
    const btTag = btRate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
    console.log(`  comparison.bottomText ${bar(e.comparison.withBottomText, e.comparison.total)} ${e.comparison.withBottomText}/${e.comparison.total} (${pct(e.comparison.withBottomText, e.comparison.total)}) [recommended] ${btTag}`);
    enrichChecks.push({ name: "comparison.bottomText", rate: btRate, required: 0.5 });

    const vsRate = e.comparison.withShowVS / e.comparison.total;
    const vsTag = vsRate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
    console.log(`  comparison.showVS    ${bar(e.comparison.withShowVS, e.comparison.total)} ${e.comparison.withShowVS}/${e.comparison.total} (${pct(e.comparison.withShowVS, e.comparison.total)}) [target: ≥50%] ${vsTag}`);
    enrichChecks.push({ name: "comparison.showVS", rate: vsRate, required: 0.5 });
  }
  if (e.styledTable.total > 0) {
    console.log(`  styledTable.summary  ${bar(e.styledTable.withSummary, e.styledTable.total)} ${e.styledTable.withSummary}/${e.styledTable.total} (${pct(e.styledTable.withSummary, e.styledTable.total)})`);
  }

  // v4.0.3 (修 4-E): 删除 startY customization 指标
  // 多模板已用 slide._bottomY 自动接力，用户主动写 startY 反而少；该指标长期 0% 是常态。

  // Overall enrichment rate (不再计入 startY)
  let totalEnrichSlots = 0, totalEnrichUsed = 0;
  if (e.stepList.total > 0) { totalEnrichSlots += e.stepList.total; totalEnrichUsed += e.stepList.withSummary; }
  if (e.layeredList.total > 0) { totalEnrichSlots += e.layeredList.total * 2; totalEnrichUsed += e.layeredList.withSummary + e.layeredList.withBanner; }
  if (e.comparison.total > 0) { totalEnrichSlots += e.comparison.total * 2; totalEnrichUsed += e.comparison.withBottomText + e.comparison.withShowVS; }
  const overallRate = totalEnrichSlots > 0 ? totalEnrichUsed / totalEnrichSlots : 0;
  const overallTag = overallRate < 0.5 ? "\x1b[33mWARN\x1b[0m" : "\x1b[32mPASS\x1b[0m";
  console.log(`  \x1b[1mOverall enrichment\x1b[0m   ${bar(totalEnrichUsed, totalEnrichSlots)} ${totalEnrichUsed}/${totalEnrichSlots} (${pct(totalEnrichUsed, totalEnrichSlots)}) [target: ≥50%] ${overallTag}`);

  // ContentSlide parameters
  console.log(`\n\x1b[1m[CONTENT PAGE PARAMS]\x1b[0m  (${stats.contentSlideParams.total} content pages)`);
  const cp = stats.contentSlideParams;
  console.log(`  sectionTag           ${bar(cp.withSectionTag, cp.total)} ${cp.withSectionTag}/${cp.total} (${pct(cp.withSectionTag, cp.total)})`);
  console.log(`  engagementQuestion   ${bar(cp.withEngagementQ, cp.total)} ${cp.withEngagementQ}/${cp.total} (${pct(cp.withEngagementQ, cp.total)})`);
  console.log(`  sourceRef            ${bar(cp.withSourceRef, cp.total)} ${cp.withSourceRef}/${cp.total} (${pct(cp.withSourceRef, cp.total)})`);

  console.log("\n\x1b[36m══════════════════════════════════════════\x1b[0m\n");

  return enrichChecks;
}

module.exports = { collectStats, printStats };
