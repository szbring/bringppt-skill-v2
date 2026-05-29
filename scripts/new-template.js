#!/usr/bin/env node
'use strict';
/**
 * scripts/new-template.js — 新模板脚手架生成器
 *
 * 用法：
 *   node scripts/new-template.js --name barChart3D --category 数据/指标型 --max 5
 *   node scripts/new-template.js --name riskMatrix --category 咨询框架 --max 5 --desc '风险矩阵' --field items
 *
 * 自动生成：
 *   1. templates/<kebab>.js（含 schema + fromKeyPoints + render 骨架，调 adapter-helpers）
 *   2. registry 注册（追加到 registry.js）
 *   3. 默认 keyPoints 测试样本
 *
 * 生成后建议立即跑：
 *   node tests/contract-test.js
 *   node tests/visual-regression-88.js --update
 */

const fs   = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}

const name      = arg('--name');
const category  = arg('--category', '其他');
const max       = parseInt(arg('--max', '5'));
const desc      = arg('--desc', name + ' 模板');
const fieldName = arg('--field', 'items');

if (!name) {
  console.error('用法: node scripts/new-template.js --name camelCaseName [--category 类别] [--max 5] [--desc 描述] [--field items]');
  process.exit(1);
}

if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
  console.error('--name 必须是 camelCase（首字母小写，无空格/连字符）');
  process.exit(1);
}

const kebab = name.replace(/([A-Z])/g, '-$1').toLowerCase();
const filePath = path.join(__dirname, '..', 'templates', `${kebab}.js`);

if (fs.existsSync(filePath)) {
  console.error(`模板已存在：${filePath}`);
  process.exit(1);
}

const template = `'use strict';
// templates/${kebab}.js
// 由 scripts/new-template.js 生成于 ${new Date().toISOString().slice(0, 10)}
const path = require('path');
const fs   = require('fs');

module.exports = {
  name:        '${name}',
  version:     '1.0.0',
  category:    '${category}',
  description: '${desc}',

  schema: {
    ${fieldName}: {
      type: 'array',
      min:  2,
      max:  ${max},
      item: {
        title: { type: 'string', warn: 15, error: 25, required: true },
        desc:  { type: 'string', warn: 30, error: 50 },
      },
    },
    startY: { type: 'number', optional: true },
  },

  usage: {
    when:    'TODO: 描述什么场景下用此模板（如 "3-5 个并列要点需视觉对比"）',
    notWhen: 'TODO: 描述什么场景下不要用',
    maxItems: ${max},
    typicalHeight: '2.5-3.5"',
    scenarios: [
      {
        trigger: 'TODO: 触发条件描述',
        example: 'TODO: 示例场景',
      },
    ],
  },

  get selfLearning() {
    const p = path.join(__dirname, '../learning/templates/${kebab}.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { errorPatterns: [], corrections: [] }; }
  },

  // 从 keyPoints 自动适配——用 lib/adapter-helpers 减少样板
  fromKeyPoints(keyPoints, page) {
    const { mapKpsToItems } = require('../lib/adapter-helpers');
    return { ${fieldName}: mapKpsToItems(keyPoints, { max: ${max} }) };
  },

  render(pres, slide, data, infra) {
    const { C, STEP_COLORS, shadow,
            calcFitFontSize, resolveStartY, validateBounds, FONTS } = infra;
    const { ${fieldName} = [], startY: explicitStartY } = data;
    const startY = resolveStartY(slide, explicitStartY, 1.0);
    const maxBottom = slide._contentMaxBottom || 4.8;
    const totalW = 8.5, baseX = (10 - totalW) / 2;
    const n = ${fieldName}.length;
    if (n === 0) return;

    const gap = 0.2;
    const cardW = (totalW - gap * (n - 1)) / n;
    const cardH = Math.min(2.5, maxBottom - startY - 0.5);

    ${fieldName}.forEach((item, i) => {
      const x = baseX + i * (cardW + gap);
      const color = STEP_COLORS[i % STEP_COLORS.length];

      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
        x, y: startY, w: cardW, h: cardH,
        rectRadius: 0.08, fill: { color: C.BG_LIGHT },
        line: { color: C.BORDER, width: 0.5 }, shadow: shadow(),
      });
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cardW, h: 0.08, fill: { color },
      });

      slide.addText(item.title, {
        x: x + 0.15, y: startY + 0.2, w: cardW - 0.3, h: 0.4,
        fontSize: 16, fontFace: FONTS.primary, bold: true,
        color: C.PRIMARY, valign: 'middle', margin: 0,
      });

      if (item.desc) {
        slide.addText(item.desc, {
          x: x + 0.15, y: startY + 0.65, w: cardW - 0.3, h: cardH - 0.8,
          fontSize: 11, fontFace: FONTS.primary,
          color: C.TEXT_LIGHT, valign: 'top', lineSpacingMultiple: 1.3, margin: 0,
        });
      }
    });

    validateBounds(slide, startY + cardH);
  },
};
`;

fs.writeFileSync(filePath, template, 'utf8');
console.log(`✓ 模板文件已生成：${path.relative(process.cwd(), filePath)}`);
console.log(`✓ registry.js 自动加载 templates/*.js，无需手工注册`);

console.log(`\n下一步：`);
console.log(`  1. 编辑 ${path.relative(process.cwd(), filePath)} 完成 render / usage 细节`);
console.log(`  2. 跑契约测试: node tests/contract-test.js`);
console.log(`  3. 更新视觉基线: node tests/visual-regression-88.js --update`);
console.log(`  4. 验证: node validate-slides.js 用一个含 ${name} 的样例\n`);
