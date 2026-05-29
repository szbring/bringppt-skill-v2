# BRINGPPT 常见错误与解决方案

> 从 SKILL.md 外迁，供查阅排错时使用。

---

## ❌ 错误1: iconList显示空白圆圈

**症状:** 生成的PPT中iconList显示为灰色空白圆圈,没有编号或图标

**错误写法:**
```javascript
{
  type: `iconList`,
  data: {
    items: [
      { icon: `①`, title: `标题`, desc: `说明`, color: `2C5A8E` }  // ❌ 错误
    ]
  }
}
```

**正确写法:**
```javascript
{
  type: `iconList`,
  data: {
    items: [
      { title: `标题`, desc: `说明` }  // ✅ 不需要icon和color字段
    ],
    numbered: true  // ✅ 显示1-5编号
  }
}
```

**说明:**
- iconList的items中不支持`icon`字段(除非是base64的iconData)
- 不支持`color`字段
- 要显示编号使用`numbered: true`参数
- 要使用渐变色使用`gradientColors: true`参数

---

## ❌ 错误2: B类模板函数调用缺少参数

**症状:** 生成PPT时报错"Cannot destructure property"

**错误写法:**
```javascript
bring.addStepList(slide, layout.data);  // ❌ 缺少pres参数
```

**正确写法:**
```javascript
bring.addStepList(pres, slide, layout.data);  // ✅ 需要pres和slide两个参数
```

**说明:**
- A类模板(独立页面): `addCoverSlide(pres, { data })`
- B类模板(嵌入内容): `addStepList(pres, slide, { data })`
- B类模板需要先调用`addContentSlide`获取slide对象

---

## ❌ 错误3: beforeAfter字段内容过长

**症状:** beforeAfter版式显示异常,文字被截断或重叠

**问题原因:** before/after/afterDesc字段超过字符限制

**字段约束:**
- before: 4-10字
- after: 4-12字
- afterDesc: 8-25字
- summary: ≤60字

**解决方案:**
- 精简文字内容,符合字符限制
- 或改用其他版式(comparison/twoColumnCards)

---

## ❌ 错误4: impactQuestion类型混淆

**症状:** 生成时报错"Cannot destructure property 'question'"

**错误写法:**
```javascript
{
  id: `p6`,
  type: `impactQuestion`,  // ❌ 不是独立页面类型
  question: `问题内容`
}
```

**正确写法:**
```javascript
{
  id: `p6`,
  type: `content`,  // ✅ 使用content类型
  title: `标题`,
  layouts: [
    {
      type: `impactQuestion`,  // ✅ 在layouts中使用
      data: {
        question: `问题内容`,
        answer: `答案内容`
      }
    }
  ]
}
```

---

## ❌ 错误5: 多版式叠加导致元素重叠

**症状:** 页面上多个版式的内容互相遮挡，文字被截断

**典型错误场景:**
```javascript
// ❌ 三个版式硬塞一页，总高度超出可用空间
layouts: [
  { type: `comparison`, data: { /* 3项+bottomText ≈1.9" */ } },
  { type: `caseBox`, data: { content: `长文本...`, startY: 2.9 } },
  { type: `quoteBanner`, data: { startY: 4.0 } }
]
```

**根因:** 未做空间预算。comparison(1.9") + caseBox(0.9") + quoteBanner(0.6") = 3.4"，加上起始偏移0.9"，总计需要4.3"，接近安全底边4.8"，任何一个版式高度略超预期就会重叠。

**正确做法:**
```javascript
// ✅ 方案A：减少到2个版式，案例内容拆分到新页
layouts: [
  { type: `comparison`, data: { /* 3项+bottomText */ startY: 0.9 } },
  { type: `quoteBanner`, data: { quote: `金句`, startY: 3.0 } }
]
// 案例故事拆分为独立案例页

// ✅ 方案B：换用更紧凑的版式
layouts: [
  { type: `twoColumnCards`, data: { /* 对比内容 */ startY: 0.9 } },
  { type: `quoteBanner`, data: { quote: `金句` } }  // 自动衔接
]
```

**决策规则：** 空间预算 > 3.5" 时必须简化，优先砍掉 caseBox（案例拆分到新页），其次合并 quoteBanner 到主版式的 summary/bottomText。

---

## ❌ 错误6: twoColumnCards/dataHighlight 组合重叠

**症状:** dataHighlight 的大字数据与上方 twoColumnCards 内容重叠

**根因:** twoColumnCards 的 content 文本过长（含换行符），实际渲染高度超过预期，而 dataHighlight 的 startY 设置不够低。

**错误写法:**
```javascript
layouts: [
  { type: `twoColumnCards`, data: {
    cards: [
      { title: `标题`, content: `多行文本\n第二行\n第三行\n第四行\n第五行` },  // ❌ 内容过长
      { title: `标题`, content: `同样很长的内容...` }
    ],
    startY: 0.9
  }},
  { type: `dataHighlight`, data: { items: [...], startY: 3.0 } }  // ❌ 与卡片重叠
]
```

**正确做法:**
```javascript
// ✅ 方案A：精简卡片内容，控制在3行以内
layouts: [
  { type: `twoColumnCards`, data: {
    cards: [
      { title: `标题`, content: `精简到2-3行的核心内容` },
      { title: `标题`, content: `精简到2-3行的核心内容` }
    ],
    startY: 0.9
  }},
  { type: `dataHighlight`, data: { items: [...], startY: 3.2 } }
]

// ✅ 方案B：不叠加，dataHighlight 单独成页或用 engagementQuestion 替代
layouts: [
  { type: `twoColumnCards`, data: { cards: [...], startY: 0.9 } }
],
engagementQuestion: `专项组12人 | 驻场3个月 | 15项改进 | 满意度78→86分`
```

**关键原则：** twoColumnCards 的 content 每多一个换行符（\n），卡片高度约增加 0.2"。超过3个换行符时，必须预留额外空间或换版式。

---

## ❌ 错误7: dataHighlight 与 engagementQuestion 冲突重叠

**症状:** dataHighlight 的 label 和 desc 文字与页面底部的 engagementQuestion 橙色文字重叠

**根因:** dataHighlight 含 desc 字段时总高度约 2.25"，从 startY=3.2 开始会延伸到 5.45"，超出有 engagementQuestion 时的安全底边 4.55"

**错误写法:**
```javascript
{
  type: `content`,
  data: {
    title: `案例展示`,
    engagementQuestion: `你的企业是否也面临类似问题?`,  // ❌ 占用底部空间
    layouts: [
      { type: `threeColumn`, data: { cards: [...], summary: `...` } },
      { type: `dataHighlight`, data: {
        items: [
          { number: `85%`, label: `时间节省`, desc: `从2小时降至20分钟` },  // ❌ desc导致高度增加
          { number: `200+`, label: `月均产出`, unit: `份`, desc: `满足需求` }
        ],
        startY: 3.2  // ❌ 位置过低，与engagementQuestion冲突
      }}
    ]
  }
}
```

**正确做法:**
```javascript
// ✅ 方案A：移除desc字段，只保留number+label(+unit)
{ type: `dataHighlight`, data: {
  items: [
    { number: `85%`, label: `时间节省` },  // ✅ 无desc，高度降至1.5"
    { number: `200+`, label: `月均产出`, unit: `份` }
  ],
  startY: 3.2  // ✅ 3.2+1.5=4.7" < 4.8"，安全
}}

// ✅ 方案B：将engagementQuestion改为sourceRef
sourceRef: `数据来源:企业内部调研报告`,  // ✅ sourceRef不占用底部空间

// ✅ 方案C：dataHighlight单独成页
```

**关键原则:**
- dataHighlight 含 desc 时高度 ≈ 2.25"，不含 desc 时高度 ≈ 1.5"
- 有 engagementQuestion 时安全底边 = 4.55"，无 engagementQuestion 时 = 4.8"
- 空间预算公式：startY + dataHighlight高度 ≤ 安全底边
- **优先级**：①移除desc ②改用sourceRef ③提高startY ④拆分成独立页
