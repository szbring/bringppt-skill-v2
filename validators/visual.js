'use strict';
/**
 * validators/visual.js — 可视布局验证（v3.7.9 抽取）
 *
 * 空间预算、版式重叠、startY 排序检测。纯函数，无共享状态。
 * 依赖：validators/height-estimator
 */

const { estimateLayoutHeight } = require('./height-estimator');

function validateVisualLayout(slide, index) {
  const visualIssues = [];
  const slideId = slide.id || `slide-${index + 1}`;

  function vError(msg) { visualIssues.push({ level: "ERROR", slideId, msg }); }
  function vWarn(msg) { visualIssues.push({ level: "WARN", slideId, msg }); }

  if (slide.type !== "content" || !slide.layouts || !Array.isArray(slide.layouts)) {
    return visualIssues;
  }

  const layouts = slide.layouts;

  // v4.0.5: insightBanner 等贴底/自动接力模板组合时，不强制要求 startY，也不计入 space budget
  const AUTO_STACK_LAYOUTS = new Set(['insightBanner']);
  const isAutoStack = lay => AUTO_STACK_LAYOUTS.has(lay.type);

  // Check 1: Multiple layouts without explicit startY
  // v4.0.5: 若所有非首 layout 都是 auto-stack 类（贴底自动接力），跳过该检查
  const nonFirstNonAutoStack = layouts.slice(1).filter(l => !isAutoStack(l));
  if (layouts.length > 1 && nonFirstNonAutoStack.length > 0) {
    let hasStartY = 0;
    const checkLayouts = [layouts[0], ...nonFirstNonAutoStack];
    for (const lay of checkLayouts) {
      if (lay.data && lay.data.startY !== undefined && lay.data.startY !== null) {
        hasStartY++;
      }
    }
    if (hasStartY === 0) {
      vError(`Multiple layouts (${layouts.length}) without any startY specified - will overlap`);
    } else if (hasStartY < checkLayouts.length - 1) {
      vWarn(`Multiple layouts (${layouts.length}) but only ${hasStartY} have startY - may overlap`);
    }
  }

  // Check 2: Space budget validation
  const maxBottom = slide.engagementQuestion ? 4.55 : 4.8;
  const firstStartY = (layouts[0] && layouts[0].data && layouts[0].data.startY) || 0.9;
  const availableHeight = maxBottom - firstStartY;

  let totalEstimatedHeight = 0;
  const layoutHeights = [];

  for (const lay of layouts) {
    if (!lay.type || !lay.data) continue;
    // v4.0.5: auto-stack 模板（insightBanner）不计入主体 space budget
    //   它会自动贴在内容底部 maxBottom 之下，预留区不算
    if (isAutoStack(lay)) continue;
    const estimatedHeight = estimateLayoutHeight(lay.type, lay.data);
    layoutHeights.push({ type: lay.type, height: estimatedHeight });
    totalEstimatedHeight += estimatedHeight;
  }

  // Add spacing between layouts (0.25" per gap) — 排除 auto-stack 的 spacing
  const nonAutoCount = layouts.filter(l => !isAutoStack(l)).length;
  if (nonAutoCount > 1) {
    totalEstimatedHeight += (nonAutoCount - 1) * 0.25;
  }

  if (totalEstimatedHeight > availableHeight) {
    const overflow = (totalEstimatedHeight - availableHeight).toFixed(2);
    vError(`Space budget exceeded: ${totalEstimatedHeight.toFixed(2)}" needed > ${availableHeight.toFixed(2)}" available (overflow: ${overflow}")`);

    // Provide breakdown
    const breakdown = layoutHeights.map(lh => `${lh.type}≈${lh.height.toFixed(1)}"`).join(" + ");
    vError(`  Layout breakdown: ${breakdown} + spacing ≈ ${totalEstimatedHeight.toFixed(2)}"`);

    // Suggest solutions
    if (layouts.length >= 3) {
      vWarn(`  Suggestion: Reduce to 2 layouts max, or move content to another slide/engagementQuestion`);
    } else if (layouts.length === 2) {
      vWarn(`  Suggestion: Use more compact layouts or split into multiple slides`);
    }
  } else if (totalEstimatedHeight > availableHeight * 0.9) {
    vWarn(`Space budget tight: ${totalEstimatedHeight.toFixed(2)}" / ${availableHeight.toFixed(2)}" (${Math.round(totalEstimatedHeight / availableHeight * 100)}% used)`);
  }

  // Check 3: startY ordering and spacing
  if (layouts.length > 1) {
    const startYs = [];
    for (let i = 0; i < layouts.length; i++) {
      const lay = layouts[i];
      if (lay.data && lay.data.startY !== undefined && lay.data.startY !== null) {
        startYs.push({ index: i, type: lay.type, startY: lay.data.startY });
      }
    }

    // Check ordering
    for (let i = 1; i < startYs.length; i++) {
      if (startYs[i].startY <= startYs[i - 1].startY) {
        vError(`Layout ${startYs[i].type} startY ${startYs[i].startY}" <= previous ${startYs[i - 1].type} ${startYs[i - 1].startY}" - will overlap`);
      }
    }

    // Check spacing
    for (let i = 1; i < startYs.length; i++) {
      const prevHeight = layoutHeights[startYs[i - 1].index].height;
      const expectedMinStartY = startYs[i - 1].startY + prevHeight + 0.2; // Min 0.2" spacing
      if (startYs[i].startY < expectedMinStartY) {
        const gap = (startYs[i].startY - startYs[i - 1].startY).toFixed(2);
        vWarn(`Layout ${startYs[i].type} startY ${startYs[i].startY}" too close to previous (gap: ${gap}", expected ≥${expectedMinStartY.toFixed(2)}")`);
      }
    }
  }

  // Check 4: twoColumnCards + dataHighlight combination
  const hasTwoColumnCards = layouts.some(l => l.type === "twoColumnCards");
  const hasDataHighlight = layouts.some(l => l.type === "dataHighlight");
  if (hasTwoColumnCards && hasDataHighlight) {
    const tccLayout = layouts.find(l => l.type === "twoColumnCards");
    if (tccLayout && tccLayout.data && tccLayout.data.cards) {
      for (const card of tccLayout.data.cards) {
        if (card.content && typeof card.content === "string") {
          const newlines = (card.content.match(/\n/g) || []).length;
          if (newlines > 3) {
            vWarn(`twoColumnCards + dataHighlight combination with long content (${newlines} newlines) - high risk of overlap`);
            break;
          }
        }
      }
    }
  }

  // Check 5: Excessive layouts (>3 B-class layouts)
  if (layouts.length > 3) {
    vError(`Too many layouts (${layouts.length}) on single slide - max recommended is 2, absolute max is 3`);
  }

  return visualIssues;
}

module.exports = { validateVisualLayout };
