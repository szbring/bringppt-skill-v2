'use strict';
/**
 * validators/height-estimator.js — 版式高度估算（v3.7.7 抽取）
 *
 * 从 validate-slides.js 抽出。纯函数 + 数据表，无依赖。
 * 调用方：validate-slides.js / ppt-pipeline.js（如需提前判断溢出风险）。
 */

const LAYOUT_HEIGHT = {
  // B-class layouts (overlay on content page)
  comparison: {
    base: 1.5,
    perItem: 0.15,  // Additional height per item beyond 2
    withBottomText: 0.4,
    typical: { min: 1.8, max: 2.5 },
    description: "Left-right comparison layout"
  },
  twoColumnCards: {
    base: 1.5,
    perNewline: 0.2,  // Additional height per newline in content
    typical: { min: 1.5, max: 2.5 },
    description: "Two-column cards layout"
  },
  threeColumn: {
    base: 2.0,
    withSummary: 0.5,
    typical: { min: 2.0, max: 2.8 },
    description: "Three-column with summary"
  },
  stepList: {
    base: 1.8,
    perItem: 0.25,
    withSummary: 0.5,
    typical: { min: 2.0, max: 3.0 },
    description: "Numbered step list"
  },
  iconList: {
    base: 1.5,
    perItem: 0.4,
    typical: { min: 2.0, max: 3.2 },
    description: "Icon list with descriptions"
  },
  styledTable: {
    base: 1.5,
    perRow: 0.25,
    withSummary: 0.5,
    typical: { min: 2.0, max: 2.5 },
    description: "Styled table layout"
  },
  dataHighlight: {
    base: 1.2,
    perItem: 0.05,
    typical: { min: 1.2, max: 1.5 },
    description: "Large data highlight"
  },
  quoteBanner: {
    base: 0.5,
    perLine: 0.1,
    typical: { min: 0.5, max: 0.7 },
    description: "Quote banner"
  },
  caseBox: {
    base: 0.7,
    perLine: 0.1,
    typical: { min: 0.7, max: 1.0 },
    description: "Case study box"
  },
  layeredList: {
    base: 1.8,
    perLayer: 0.3,
    withSummary: 0.5,
    typical: { min: 2.0, max: 2.5 },
    description: "Layered list with tags"
  },
  processFlow: {
    base: 1.5,
    perStep: 0.1,
    typical: { min: 1.5, max: 2.0 },
    description: "Process flow diagram"
  },
  timeline: {
    base: 1.5,
    perEvent: 0.1,
    typical: { min: 1.5, max: 2.0 },
    description: "Timeline layout"
  },
  quadrantMatrix: {
    base: 2.5,
    typical: { min: 2.5, max: 3.0 },
    description: "Quadrant matrix"
  },
  colorMatrix: {
    base: 2.5,
    typical: { min: 2.5, max: 3.0 },
    description: "Color-filled matrix"
  },
  pyramid: {
    base: 2.0,
    perLevel: 0.2,
    typical: { min: 2.0, max: 2.8 },
    description: "Pyramid structure"
  },
  moduleOverview: {
    base: 2.5,
    typical: { min: 2.5, max: 3.2 },
    description: "Module overview panel"
  },
  dualPanel: {
    base: 2.2,
    withSummary: 0.5,
    typical: { min: 2.2, max: 2.8 },
    description: "Dual panel layout"
  },
  quoteEmphasis: {
    base: 1.8,
    withSummary: 0.5,
    typical: { min: 1.8, max: 2.3 },
    description: "Quote with emphasis"
  },
  impactQuestion: {
    base: 2.0,
    typical: { min: 2.0, max: 2.5 },
    description: "Impact question layout"
  },
  beforeAfter: {
    base: 2.0,
    perPair: 0.3,
    withSummary: 0.5,
    typical: { min: 2.0, max: 3.0 },
    description: "Before-after comparison"
  },
  cardGrid: {
    base: 1.5,
    perRow: 0.5,
    withSummary: 0.5,
    typical: { min: 2.0, max: 3.5 },
    description: "Card grid layout"
  },
  imageText: {
    base: 2.0,
    typical: { min: 2.0, max: 2.8 },
    description: "Image with text"
  },

  // ── v3.2.5/3.2.6 新增模板 ───────────────────────────────────────
  chartBar3D: { base: 3.2, typical: { min: 3.2, max: 3.6 }, description: "3D bar chart" },
  chartArea:  { base: 3.2, typical: { min: 3.2, max: 3.6 }, description: "Area chart" },
  chartRadar: { base: 3.4, typical: { min: 3.2, max: 3.8 }, description: "Radar chart" },
  chartScatter: { base: 3.4, typical: { min: 3.2, max: 3.8 }, description: "Scatter chart" },
  chartBubble:  { base: 3.4, typical: { min: 3.2, max: 3.8 }, description: "Bubble chart" },
  keywordHighlight: {
    base: 2.0,
    typical: { min: 2.0, max: 2.8 },
    description: "Paragraph with keyword highlight/outline",
  },
  linkList: {
    base: 1.5,
    perItem: 0.55,
    typical: { min: 1.5, max: 3.5 },
    description: "Hyperlinked list",
  },
  calloutAnnotation: {
    base: 2.0,
    typical: { min: 2.0, max: 3.5 },
    description: "Annotation callouts with leader lines",
  },
  cloudConcept: {
    base: 2.4,
    typical: { min: 2.4, max: 3.0 },
    description: "Cloud-shape concept keywords",
  },
  hexagonHive: {
    base: 2.8,
    typical: { min: 2.5, max: 3.4 },
    description: "Hexagon honeycomb layout",
  },
  bracketGroup: {
    base: 1.25,
    perItem: 0.18,
    perDesc: 0.06,
    withSummaryDesc: 0.10,
    withTitle: 0.12,
    typical: { min: 1.8, max: 2.9 },
    description: "Brace-grouped items to summary",
  },
  cubeStack: {
    base: 2.8,
    perLayer: 0.3,
    typical: { min: 2.5, max: 3.4 },
    description: "3D cube stack",
  },
};
function estimateLayoutHeight(layoutType, data) {
  const spec = LAYOUT_HEIGHT[layoutType];
  if (!spec) return 2.0; // Default fallback

  let height = spec.base;

  // Type-specific calculations
  switch (layoutType) {
    case "comparison":
      if (data.left && data.left.items) {
        height += Math.max(0, data.left.items.length - 2) * spec.perItem;
      }
      if (data.bottomText) height += spec.withBottomText;
      break;

    case "twoColumnCards":
      if (data.cards && Array.isArray(data.cards)) {
        for (const card of data.cards) {
          if (card.content && typeof card.content === "string") {
            const newlines = (card.content.match(/\n/g) || []).length;
            height += newlines * spec.perNewline;
          }
        }
      }
      break;

    case "threeColumn":
      if (data.summary) height += spec.withSummary;
      break;

    case "stepList":
      if (data.steps && Array.isArray(data.steps)) {
        height += Math.max(0, data.steps.length - 3) * spec.perItem;
      }
      if (data.summary) height += spec.withSummary;
      break;

    case "iconList":
      if (data.items && Array.isArray(data.items)) {
        height += Math.max(0, data.items.length - 3) * spec.perItem;
      }
      break;

    case "styledTable":
      if (data.rows && Array.isArray(data.rows)) {
        height += data.rows.length * spec.perRow;
      }
      if (data.summary) height += spec.withSummary;
      break;

    case "dataHighlight":
      if (data.items && Array.isArray(data.items)) {
        height += data.items.length * spec.perItem;
      }
      break;

    case "quoteBanner":
      if (data.quote && typeof data.quote === "string") {
        const lines = Math.ceil(data.quote.length / 60); // Rough estimate
        height += Math.max(0, lines - 1) * spec.perLine;
      }
      break;

    case "caseBox":
      if (data.content && typeof data.content === "string") {
        const lines = Math.ceil(data.content.length / 50);
        height += Math.max(0, lines - 2) * spec.perLine;
      }
      break;

    case "layeredList":
      if (data.layers && Array.isArray(data.layers)) {
        height += Math.max(0, data.layers.length - 2) * spec.perLayer;
      }
      if (data.summary) height += spec.withSummary;
      break;

    case "processFlow":
      if (data.steps && Array.isArray(data.steps)) {
        height += Math.max(0, data.steps.length - 3) * spec.perStep;
      }
      break;

    case "timeline":
      if (data.events && Array.isArray(data.events)) {
        height += Math.max(0, data.events.length - 3) * spec.perEvent;
      }
      break;

    case "pyramid":
      if (data.levels && Array.isArray(data.levels)) {
        height += Math.max(0, data.levels.length - 3) * spec.perLevel;
      }
      break;

    case "dualPanel":
      if (data.summary) height += spec.withSummary;
      break;

    case "quoteEmphasis":
      if (data.summary) height += spec.withSummary;
      break;

    case "beforeAfter":
      if (data.pairs && Array.isArray(data.pairs)) {
        height += Math.max(0, data.pairs.length - 2) * spec.perPair;
      }
      if (data.summary) height += spec.withSummary;
      break;

    case "cardGrid":
      if (data.cards && Array.isArray(data.cards)) {
        const cols = data.columns || 4;
        const rows = Math.ceil(data.cards.length / cols);
        height += Math.max(0, rows - 2) * spec.perRow;
      }
      if (data.summary) height += spec.withSummary;
      break;

    case "bracketGroup":
      if (data.items && Array.isArray(data.items)) {
        height += data.items.length * spec.perItem;
        for (const item of data.items) {
          if (item && typeof item === "object" && item.desc) {
            height += spec.perDesc;
          }
        }
      }
      if (data.summaryDesc) height += spec.withSummaryDesc;
      if (data.title) height += spec.withTitle;
      break;
  }

  return Math.min(height, 4.0); // Cap at 4.0 inches (safety limit)
}

module.exports = { LAYOUT_HEIGHT, estimateLayoutHeight };
