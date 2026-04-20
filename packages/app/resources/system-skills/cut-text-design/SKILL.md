---
name: cut-text-design
description: >-
  使用 cut_cli 设计高质量字幕。覆盖字幕角色分工（主标题/解说字幕/装饰花字）、
  样式组合公式（颜色/描边/背景/阴影）、位置坐标系、关键词高亮 4 种方法、
  字幕节奏控制、入场出场动画搭配、花字使用、多语言字幕、字幕动画 + 关键帧组合。
  当用户提到"字幕样式"、"花字"、"关键词高亮"、"字幕动画"、"文字设计"、"字体颜色"、
  "字幕排版"、"字幕节奏"、"标题样式"、"双语字幕"、"字幕模板"、"text style"时使用此 skill。
---

> **⚠️ Nex Agent 环境说明（重要）**
>
> - 本 cutcli 工具生成的是 **CapCut 国际版** 草稿（特效/动画/花字/转场资产名都是 CapCut 国际版的命名）。
> - macOS 默认草稿目录为 `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<draftId>/`，**不是** 国内版剪映的 `~/Movies/JianyingPro Drafts/`。
> - 应在 **CapCut 桌面端** 打开。**国内版剪映（JianyingPro）大概率无法识别本草稿的特效/动画/花字**，可能出现"特效缺失"、字幕样式异常或直接打不开。
> - 如用户安装的是国内版剪映，**先告知此约束并征求确认**；本工具不提供国内版兼容方案。
> - 下文如出现 `~/Movies/JianyingPro Drafts/...` 路径，请以本节 CapCut 路径为准。


# cut_cli 字幕进阶设计指南

## 时间单位

所有时间参数使用**微秒 (μs)**：`1秒 = 1,000,000`。

> 字幕基础调用（add / list 命令、参数清单）见 [.cursor/skills/cut-draft/SKILL.md](.cursor/skills/cut-draft/SKILL.md)。本 skill 只讲**怎么设计**。

---

## 字幕的角色分工

短视频里**字幕不止一种**，按角色分工是高质量剪辑的起点：

| 角色 | 用途 | 推荐字号 | 推荐位置 (transformY) | 推荐时长 |
|------|------|----------|----------------------|----------|
| 主标题 (Title) | 视频主题，全程或前段 | 14-20 | `0.65 ~ 0.85`（顶部） | 持续整段 / 开场 3 秒 |
| 解说字幕 (Subtitle) | 跟随旁白，逐句出现 | 8-12 | `-0.70 ~ -0.85`（底部） | 单条 = 字数 × 0.25-0.3 秒 |
| 装饰花字 (Decoration) | 强调情绪 / 综艺感 | 12-18 | 任意，常在画面焦点旁 | 短暂 0.5-1.5 秒 |
| 数据 / 标签 (Label) | 数字、价格、时间戳 | 8-12 | 角落，如 `(0.6, 0.6)` 右上 | 出现即停留 |
| CTA (Call To Action) | 收尾引导 | 14-18 | `-0.30 ~ 0.0`（中下偏中） | 收尾 1-2 秒 |

> **绝对不要把所有字幕用同一种样式**。主标题大、解说小、CTA 强对比，才能形成视觉层级。

每种角色独立调用 `cutcli captions add`，会自动落到不同的字幕轨道（参见 [src/api/captions/add-captions.ts](src/api/captions/add-captions.ts) 第 17 行 `findOrCreateTrack` 行为）。

---

## 5 种经典样式组合

记住这 5 套，覆盖 90% 场景。**先按场景选模板，再微调颜色字号。**

### 组合 1：万能白字（短视频默认）

适用：所有"不知道用什么"的场合。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"今天教大家做菜","start":0,"end":3000000}
]' --font-size 10 --bold --text-color "#FFFFFF" --border-color "#000000" --transform-y -0.75
```

要点：白字 + 黑描边 + 加粗 + 底部。任何背景下都清晰。

### 组合 2：高级感简洁

适用：知识类、商务类、品牌片。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"我们相信","start":0,"end":3000000}
]' --font-size 12 --text-color "#FFFFFF" --bg-color "#000000" --bg-alpha 0.6 --bg-style 1 --bg-round 0.5 --transform-y -0.7
```

要点：白字 + 半透明黑底 + 圆角 + 不加粗。安静、有质感。

### 组合 3：综艺爆款

适用：搞笑、热血、综艺感。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"这也太好吃了吧","start":0,"end":2500000,"keyword":"太好吃","keywordColor":"#FFD700","keywordFontSize":14}
]' --font-size 11 --bold --text-color "#FFFFFF" --border-color "#FF3300" --border-width 0.12 --has-shadow --shadow-color "#000000" --shadow-distance 6 --transform-y -0.7
```

要点：白字 + 红描边 + 黑阴影 + 关键词金色放大。冲击力强。

### 组合 4：电影感字幕

适用：旅拍、Vlog、影视风格。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"那一年的夏天","start":0,"end":4000000}
]' --font-size 8 --text-color "#FFFFFF" --alpha 0.85 --letter-spacing 4 --transform-y -0.85
```

要点：白字 + 半透明 + 大字间距 + 小字号 + 底部。文艺、克制。

### 组合 5：数据 / 标签

适用：价格标签、时间戳、数据标注。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"-50%","start":0,"end":5000000}
]' --font-size 16 --bold --text-color "#FFFFFF" --bg-color "#FF3300" --bg-style 1 --bg-round 0.3 --transform-x 0.6 --transform-y 0.6
```

要点：纯色背景 + 加粗 + 大字 + 角落位置。视觉锚点。

---

## 位置坐标系（关键）

cut_cli 的字幕位置使用**归一化坐标**（参见 [src/api/captions/add-captions.ts](src/api/captions/add-captions.ts) 第 187-188 行 `segment.clip.transform.x/y`）。

```text
                  transform-y = 1 (顶部)
                       ↑
                       │
  transform-x = -1 ────┼──── transform-x = 1
       (最左)          0          (最右)
                       │
                       ↓
                  transform-y = -1 (底部)
```

| 位置 | transformX | transformY |
|------|-----------|-----------|
| 屏幕底部字幕（短视频默认） | `0` | `-0.70 ~ -0.85` |
| 顶部主标题 | `0` | `0.65 ~ 0.85` |
| 居中（大标题、CTA） | `0` | `0` |
| 中下方 CTA | `0` | `-0.30` |
| 左上角标签 | `-0.6` | `0.6` |
| 右上角标签 | `0.6` | `0.6` |
| 左下角标签 | `-0.6` | `-0.6` |
| 右下角标签 | `0.6` | `-0.6` |

> **不是像素**：`-1 ~ 1` 是相对画布的归一化值。换画幅（横屏 → 竖屏）字幕位置不会失真。

**安全区**（避免被刘海 / 进度条遮挡）：

- 顶部字幕：`transform-y` 不超过 `0.85`
- 底部字幕：`transform-y` 不低于 `-0.85`
- 抖音底部进度条 / 互动按钮：`transform-y` 不要在 `-0.6 ~ -0.5` 范围放重要文字

---

## 关键词高亮的 4 种方法

### 方法 1：caption.keyword + keywordColor（自动定位，最简单）

每条字幕里指定 `keyword` 字段，cut_cli 自动找到位置高亮（参见 [src/api/captions/add-captions.ts](src/api/captions/add-captions.ts) 第 115-127 行 `generateKeywordStyle`）。

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"今天教大家做番茄炒蛋","start":0,"end":3000000,"keyword":"番茄炒蛋","keywordColor":"#FFD700"}
]' --font-size 10 --bold --text-color "#FFFFFF" --transform-y -0.75
```

效果："今天教大家做" 是白色，"番茄炒蛋" 是金色。

### 方法 2：多关键词用 `|` 分隔

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"AI 编程让我每天多 2 小时","start":0,"end":3000000,"keyword":"AI|编程|2 小时","keywordColor":"#FF6600"}
]' --font-size 10 --bold --transform-y -0.75
```

效果：3 个关键词都变橙色。注意 `|` 分隔的是**多个关键词**，不是"或"逻辑。

### 方法 3：大字号关键词 (keywordFontSize > fontSize)

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"年度新品 一折抢购","start":0,"end":3000000,"keyword":"一折","keywordColor":"#FF0000","fontSize":10,"keywordFontSize":18}
]' --bold --transform-y -0.5
```

效果："一折" 是 18 号大字 + 红色，其它字 10 号白色。视觉冲击强。

### 方法 4：花字 textEffect（综艺感）

```bash
# 先搜花字
cutcli query huazi --action search --keyword "可爱" --limit 5 --pretty

# 用花字
cutcli captions add "$DRAFT" --captions '[
  {"text":"萌翻了","start":0,"end":2000000}
]' --font-size 16 --bold --text-effect "找到的花字名" --transform-y -0.5
```

效果：整条字幕变成卡通花字。**注意 textEffect 是整条字幕的样式**，不是某个关键词。

也可以用 `cutcli text-style` 单独生成关键词花字 JSON（不写入草稿，仅返回数据）：

```bash
cutcli text-style --text "今天天气真好" --keyword "天气" --keyword-color "#FF0000" --keyword-font-size 14
```

---

## 字幕节奏公式（中文）

**单条字幕时长 = 字数 × 250000 ~ 300000 μs**。

| 字数 | 推荐时长 (μs) | 推荐时长 (秒) |
|------|--------------|---------------|
| 4 字 | 1000000-1200000 | 1.0-1.2 |
| 6 字 | 1500000-1800000 | 1.5-1.8 |
| 8 字 | 2000000-2400000 | 2.0-2.4 |
| 10 字 | 2500000-3000000 | 2.5-3.0 |
| 12 字 | 3000000-3600000 | 3.0-3.6 |
| 15 字 | 3750000-4500000 | 3.75-4.5 |

**句间留白**：每两条字幕之间留 `100000 ~ 300000 μs` 的空隙（让眼睛喘口气）。但如果字幕跟旁白同步，可以直接首尾相接。

**反例**：

```json
[{"text":"今天我要给大家介绍一个非常厉害的新产品它就是XXX","start":0,"end":5000000}]
```

22 个字塞 5 秒，每字 0.22 秒——快得看不清。

**正例**：

```json
[
  {"text":"今天我要给大家介绍",   "start":0,        "end":2250000},
  {"text":"一个非常厉害的新产品", "start":2350000,  "end":5000000},
  {"text":"它就是 XXX",            "start":5100000,  "end":7000000}
]
```

按句切分，留 100000μs 间隔。

---

## 入场 / 出场动画的搭配

每条字幕可以单独设置入场 / 出场 / 循环动画（参见 [src/api/captions/add-captions.ts](src/api/captions/add-captions.ts) 第 190-199 行）：

```json
{
  "text": "...",
  "start": 0,
  "end": 3000000,
  "inAnimation": "渐显",
  "outAnimation": "渐隐",
  "inAnimationDuration": 500000,
  "outAnimationDuration": 500000
}
```

**搭配建议**：

| 场景 | 入场 | 出场 | 时长 (μs) |
|------|------|------|-----------|
| 安静讲解、教程 | `渐显` | `渐隐` | 500000 |
| 强调性、爆点 | `弹入` | `弹出` | 400000 |
| 节奏感、卡点 | `滑入` | `滑出` | 300000 |
| 综艺、搞笑 | `跳跃` / `弹跳` | `波动消失` | 500000 |
| 大标题（开场） | `打字机` / `逐字显示` | `渐隐` | 800000 |

**查询所有可用动画**：

```bash
cutcli query text-animations --type in --pretty   # 入场
cutcli query text-animations --type out --pretty  # 出场
cutcli query text-animations --type loop --pretty # 循环
cutcli query text-animations --type in --mode 2   # 仅免费
```

> 名字必须精确（中文）。记不住时先 query 搜，再填。

**约束**：

- 入场 + 出场总时长 ≤ 字幕时长 - 500000（留 0.5 秒静态展示）
- 例：字幕时长 3000000，入场 500000 + 出场 500000 = 1000000 ≤ 3000000 - 500000 ✓
- 例：字幕时长 1000000，入场 600000 + 出场 600000 = 1200000 > 500000 ✗（动画会卡顿）

---

## 花字（textEffect）使用场景

花字是**整条字幕的预设样式包**（包含颜色、描边、阴影、纹理），由剪映 API 提供。

**适合**：

- 综艺、搞笑、卡通风格视频
- 关键节点的强调字（"福利"、"上链接"、"必看"）
- 节日、庆祝主题

**不适合**：

- 严肃的知识科普（会显得轻佻）
- 商务、企业宣传（会显得不专业）
- 教程类正文字幕（会分散注意力）

**使用流程**：

```bash
# Step 1: 先搜
cutcli query huazi --action categories --pretty                  # 看分类
cutcli query huazi --action search --keyword "可爱" --pretty     # 搜关键词
cutcli query huazi --action list --category "热门" --pretty      # 按分类列

# Step 2: 用 textEffect 字段（也可作为全局选项 --text-effect）
cutcli captions add "$DRAFT" --captions '[
  {"text":"惊喜大礼包","start":0,"end":2500000,"textEffect":"找到的花字名"}
]' --font-size 14 --bold --transform-y 0
```

> 花字会覆盖你设置的 `--text-color` 和 `--border-color`，因为花字本身有完整样式。

---

## 多语言字幕

### 方案 A：单条字幕双行（line-spacing 加大）

中英文写在同一条字幕里，用换行符 `\n`：

```bash
cutcli captions add "$DRAFT" --captions '[
  {"text":"欢迎观看\nWelcome","start":0,"end":3000000}
]' --font-size 10 --bold --line-spacing 8 --text-color "#FFFFFF" --border-color "#000000" --transform-y -0.75
```

优点：始终对齐；缺点：两种语言用同一种样式。

### 方案 B：上下两条独立字幕轨道

```bash
# 中文（轨道 1，稍上）
cutcli captions add "$DRAFT" --captions '[
  {"text":"欢迎观看","start":0,"end":3000000}
]' --font-size 12 --bold --text-color "#FFFFFF" --border-color "#000000" --transform-y -0.70

# 英文（轨道 2，稍下，小字号、副色）
cutcli captions add "$DRAFT" --captions '[
  {"text":"Welcome","start":0,"end":3000000}
]' --font-size 8 --text-color "#CCCCCC" --transform-y -0.82
```

优点：可分别调样式（中文加粗、英文细体），符合双语字幕惯例；缺点：管理两条轨道。

---

## 字幕 + 关键帧（让字幕动起来）

字幕 segment 也支持关键帧（位置 / 缩放 / 透明度 / 颜色）。先 `captions add` 拿到 `segmentIds`，再 `keyframes add`。

**示例：字幕从屏幕外滑入并放大**

```bash
# Step 1: 加字幕，从右屏外开始
RESULT=$(cutcli captions add "$DRAFT" --captions '[
  {"text":"重磅消息","start":0,"end":3000000}
]' --font-size 16 --bold --text-color "#FFD700" --transform-y 0)
SEG_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['segmentIds'][0])")

# Step 2: 关键帧动画
cutcli keyframes add "$DRAFT" --keyframes "[
  {\"segmentId\":\"$SEG_ID\",\"property\":\"position_x\",\"offset\":0,        \"value\":1.5},
  {\"segmentId\":\"$SEG_ID\",\"property\":\"position_x\",\"offset\":500000,   \"value\":0},
  {\"segmentId\":\"$SEG_ID\",\"property\":\"scale_x\",   \"offset\":500000,   \"value\":1.0},
  {\"segmentId\":\"$SEG_ID\",\"property\":\"scale_x\",   \"offset\":1000000,  \"value\":1.3},
  {\"segmentId\":\"$SEG_ID\",\"property\":\"scale_y\",   \"offset\":500000,   \"value\":1.0},
  {\"segmentId\":\"$SEG_ID\",\"property\":\"scale_y\",   \"offset\":1000000,  \"value\":1.3}
]"
```

效果：字幕从屏幕右外滑入到中间（500ms），然后放大 1.3 倍（500ms）。

> 字幕颜色渐变需要用 `text_color` 关键帧，value 是 RGBA 数组（参见 [.cursor/skills/cut-keyframes/SKILL.md](.cursor/skills/cut-keyframes/SKILL.md)）。

---

## 4 个完整案例

### 案例 1：教程类解说字幕（标准模板）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "教程字幕" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 主标题（顶部，全程）
cutcli captions add "$DRAFT" --captions '[
  {"text":"5 分钟学会做番茄炒蛋","start":0,"end":12000000,"inAnimation":"渐显","inAnimationDuration":500000}
]' --font-size 14 --bold --text-color "#FFFFFF" --border-color "#000000" --transform-y 0.78

# 解说字幕（底部，按句切分）
cutcli captions add "$DRAFT" --captions '[
  {"text":"准备 2 个鸡蛋","start":0,        "end":2500000,"keyword":"2 个","keywordColor":"#FFD700"},
  {"text":"切 1 个西红柿","start":2500000, "end":5000000,"keyword":"1 个","keywordColor":"#FFD700"},
  {"text":"先炒蛋再炒番茄","start":5000000,"end":8000000,"keyword":"炒蛋|炒番茄","keywordColor":"#FF6600"},
  {"text":"加盐和糖各一勺","start":8000000,"end":10500000,"keyword":"盐|糖","keywordColor":"#FF6600"},
  {"text":"出锅装盘","start":10500000,"end":12000000}
]' --font-size 10 --bold --text-color "#FFFFFF" --border-color "#000000" --transform-y -0.75
```

### 案例 2：综艺花字（爆点强调）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "综艺花字" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 先搜花字
# cutcli query huazi --action search --keyword "可爱" --pretty
# 假设找到名为 "果冻可爱" 的花字

cutcli captions add "$DRAFT" --captions '[
  {"text":"萌翻了","start":1000000,"end":2500000,"inAnimation":"弹入","outAnimation":"弹出","inAnimationDuration":300000,"outAnimationDuration":300000}
]' --font-size 18 --bold --text-effect "果冻可爱" --transform-y 0.2

cutcli captions add "$DRAFT" --captions '[
  {"text":"这才是冠军","start":4000000,"end":6500000,"keyword":"冠军","keywordColor":"#FFD700","keywordFontSize":24,"inAnimation":"跳跃","outAnimation":"渐隐"}
]' --font-size 14 --bold --text-color "#FFFFFF" --border-color "#FF0000" --has-shadow --shadow-color "#000000" --transform-y -0.4
```

### 案例 3：双语字幕（中英对照）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "双语字幕" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 中文主字幕（轨道 1）
cutcli captions add "$DRAFT" --captions '[
  {"text":"我们都是追梦人","start":0,        "end":3000000},
  {"text":"勇敢向前","start":3000000, "end":5500000},
  {"text":"永不止步","start":5500000, "end":8000000}
]' --font-size 12 --bold --text-color "#FFFFFF" --border-color "#000000" --transform-y -0.65

# 英文副字幕（轨道 2，稍下、小字号、灰色）
cutcli captions add "$DRAFT" --captions '[
  {"text":"We are all dreamers",        "start":0,        "end":3000000},
  {"text":"Move forward bravely",       "start":3000000, "end":5500000},
  {"text":"Never stop",                 "start":5500000, "end":8000000}
]' --font-size 8 --text-color "#CCCCCC" --letter-spacing 2 --transform-y -0.78
```

### 案例 4：关键词强调字幕（数据爆点）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "数据强调" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 主字幕用大字号金色关键词
cutcli captions add "$DRAFT" --captions '[
  {"text":"3 天涨粉 10 万","start":0,        "end":3000000,"keyword":"3 天|10 万","keywordColor":"#FFD700","keywordFontSize":20},
  {"text":"转化率提升 200%","start":3000000,"end":6000000,"keyword":"200%","keywordColor":"#FF3300","keywordFontSize":22},
  {"text":"团队从 0 到 1","start":6000000, "end":9000000,"keyword":"0|1","keywordColor":"#00DDFF","keywordFontSize":24}
]' --font-size 12 --bold --text-color "#FFFFFF" --border-color "#000000" --has-shadow --shadow-color "#000000" --shadow-distance 4 --transform-y 0
```

---

## 字幕样式备忘单

| 维度 | CLI 选项 | JSON 字段 | 推荐值 |
|------|----------|-----------|--------|
| 字号 | `--font-size` | `fontSize` | 6-12 解说 / 14-20 标题 |
| 颜色 | `--text-color` | — | `#FFFFFF` / `#FFD700` / `#FF3300` |
| 加粗 | `--bold` | — | 解说字必加 |
| 描边色 | `--border-color` | — | `#000000`（万能） |
| 描边粗细 | `--border-width` | — | 默认 0.08，加重 0.12 |
| 背景色 | `--bg-color` | — | `#000000` 半透明 |
| 背景透明度 | `--bg-alpha` | — | 0.5-0.7 |
| 背景圆角 | `--bg-round` | — | 0.3-0.5 |
| 阴影 | `--has-shadow --shadow-color` | — | 黑色阴影提对比度 |
| 阴影距离 | `--shadow-distance` | — | 4-8 |
| 字间距 | `--letter-spacing` | — | 2-6（电影感） |
| 行间距 | `--line-spacing` | — | 6-10（双行字幕） |
| 位置 X | `--transform-x` | — | -1 ~ 1，0 居中 |
| 位置 Y | `--transform-y` | — | -1 ~ 1，0 居中 |
| 缩放 | `--scale-x --scale-y` | — | 1.0 = 原大 |
| 入场动画 | — | `inAnimation` | `渐显` `弹入` `滑入` |
| 出场动画 | — | `outAnimation` | `渐隐` `弹出` `滑出` |
| 关键词 | — | `keyword` | 单词或 `词1\|词2\|词3` |
| 关键词色 | — | `keywordColor` | `#FFD700` `#FF3300` |
| 花字 | `--text-effect` | `textEffect` | 用 query huazi 搜 |

---

## 注意事项

1. **样式优先级**：花字 > 颜色/描边/阴影 > 默认。一旦用了花字，颜色 / 描边参数会被覆盖。
2. **alignment 不是位置**：是文字本身的对齐方式（0=居中，1=左，2=右）；位置用 `transformX/Y`。
3. **关键词必须出现在 text 里**：`keyword` 字段做的是字符串匹配，不在 text 里则不高亮。
4. **多关键词的 `|` 不是正则**：是普通字符分隔，不要写成 `keyword1\|keyword2` 转义。
5. **字号超过画幅**：超大字会自动截断显示。竖屏 1080 宽，字号别超过 24。
6. **花字名字必须精确**：用 `cutcli query huazi --action search` 获取真实名字，不要凭印象写。
7. **入场/出场动画名字也是中文**：用 `cutcli query text-animations` 查；写错会被静默忽略。
8. **字幕轨道顺序**：后 add 的字幕在更上层，会盖住先 add 的；想让标题在解说之上，标题最后 add。
