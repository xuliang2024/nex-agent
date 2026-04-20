---
name: cut-draft
description: >-
  使用 cutcli 创建和操作剪映/CapCut 草稿。支持创建草稿、添加字幕/图片/视频/音频/特效/滤镜/贴纸/关键帧/遮罩、
  设置出入场动画、关键词高亮等。当用户想要创建剪映草稿、添加字幕、添加图片视频音频素材、
  操作剪映工程文件、或提到"剪映"、"草稿"、"字幕"、"cut"、"cut_cli"、"cutcli"、"CapCut draft"时使用此 skill。
---

> **⚠️ Nex Agent 环境说明（重要）**
>
> - 本 cutcli 工具生成的是 **CapCut 国际版** 草稿（特效/动画/花字/转场资产名都是 CapCut 国际版的命名）。
> - macOS 默认草稿目录为 `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<draftId>/`，**不是** 国内版剪映的 `~/Movies/JianyingPro Drafts/`。
> - 应在 **CapCut 桌面端** 打开。**国内版剪映（JianyingPro）大概率无法识别本草稿的特效/动画/花字**，可能出现"特效缺失"、字幕样式异常或直接打不开。
> - 如用户安装的是国内版剪映，**先告知此约束并征求确认**；本工具不提供国内版兼容方案。
> - 下文如出现 `~/Movies/JianyingPro Drafts/...` 路径，请以本节 CapCut 路径为准。


# cutcli — 剪映/CapCut 草稿 CLI 工具

用命令行生成剪映标准草稿文件夹，可直接被剪映桌面端打开。

## 安装

```bash
curl -s https://cutcli.com/cli | bash
```

## 关键约定

- **命令名**：`cutcli`（非 `cut`，避免与系统命令冲突）
- **时间单位**：所有时间参数使用**微秒（μs）**，`1秒 = 1,000,000`
- **草稿目录**：macOS 默认 `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/{draftId}/`
  - 可通过 `cutcli config set-dir <path>` 修改
  - 或设置环境变量 `CUT_DRAFTS_DIR`
- **媒体自动下载**：传入 URL 会自动下载到草稿 `resources/` 目录
- **CLI 选项风格**：使用 kebab-case（如 `--font-size`，非 `--fontSize`）
- **JSON 参数**：支持内联 `'[...]'` 或文件引用 `@file.json`
- **查看帮助**：任何命令加 `--help`，或 `cutcli docs [topic]`

## 常用工作流

### 1. 创建草稿 + 添加字幕（带动画）

```bash
# 创建草稿
cutcli draft create --width 1080 --height 1920

# 添加字幕，带入场出场动画
cutcli captions add <draftId> --captions '[
  {"text":"你好世界","start":0,"end":3000000,
   "inAnimation":"渐显","outAnimation":"渐隐",
   "inAnimationDuration":500000,"outAnimationDuration":500000}
]' --font-size 8 --bold
```

### 2. 创建草稿 + 添加图片轮播

```bash
cutcli draft create
cutcli images add <draftId> --image-infos '[
  {"imageUrl":"https://example.com/1.jpg","width":1920,"height":1080,"start":0,"end":5000000},
  {"imageUrl":"https://example.com/2.jpg","width":1920,"height":1080,"start":5000000,"end":10000000}
]'
```

### 3. 按音频时长快速铺素材

```bash
cutcli draft create
cutcli draft easy <draftId> --audio-url "https://example.com/bgm.mp3" \
  --img-url "https://example.com/bg.jpg" --text "欢迎观看"
```

### 4. 打包草稿为 zip

```bash
cutcli draft zip <draftId> --output ~/Desktop/draft.zip
```

## CLI 命令速查

| 命令 | 用途 |
|------|------|
| `cutcli draft create [--width N] [--height N] [--name <name>]` | 创建草稿 |
| `cutcli draft list` | 列出所有草稿 |
| `cutcli draft info <draftId>` | 查看草稿信息 |
| `cutcli draft easy <draftId> --audio-url <url>` | 按音频时长铺素材 |
| `cutcli draft zip <draftId> [--output <path>]` | 打包草稿 |
| `cutcli captions add <draftId> --captions <json>` | 添加字幕 |
| `cutcli captions list <draftId>` | 列出字幕 |
| `cutcli images add <draftId> --image-infos <json>` | 添加图片 |
| `cutcli images list <draftId>` | 列出图片 |
| `cutcli videos add <draftId> --video-infos <json>` | 添加视频 |
| `cutcli videos list <draftId>` | 列出视频 |
| `cutcli audios add <draftId> --audio-infos <json>` | 添加音频 |
| `cutcli audios list <draftId>` | 列出音频 |
| `cutcli effects add <draftId> --effect-infos <json>` | 添加特效 |
| `cutcli effects list <draftId>` | 列出特效 |
| `cutcli filters add <draftId> --filter-infos <json>` | 添加滤镜 |
| `cutcli sticker add <draftId> --sticker-id <id> --start N --end N` | 添加贴纸 |
| `cutcli sticker list <draftId>` | 列出贴纸 |
| `cutcli keyframes add <draftId> --keyframes <json>` | 添加关键帧 |
| `cutcli keyframes list <draftId> --segment-id <id>` | 列出关键帧 |
| `cutcli masks add <draftId> --segment-ids <ids>` | 添加遮罩 |
| `cutcli masks list <draftId>` | 列出遮罩 |
| `cutcli text-style --text <t> --keyword <k>` | 生成文字样式 JSON |
| `cutcli query audio-duration --url <url>` | 获取音频时长 |
| `cutcli query image-animations [--type in\|out\|loop]` | 查询可用动画 |
| `cutcli query huazi --action list\|search\|categories` | 查询花字 |
| `cutcli query stickers --action search\|categories\|list` | 查询贴纸 |
| `cutcli query effects --action search\|categories\|list` | 查询特效 |
| `cutcli query filters --action search\|categories\|list` | 查询滤镜 |
| `cutcli query transitions --action search\|categories\|list` | 查询转场效果 |
| `cutcli query text-animations [--type in\|out\|loop]` | 查询文字动画 |
| `cutcli draft upload <draftId> [--zip <path>]` | 打包上传草稿，返回下载链接 |
| `cutcli setup <tool> [--force]` | 安装 AI 工具集成配置 |
| `cutcli config show` | 查看当前配置 |
| `cutcli config set-dir <path>` | 设置草稿导出目录 |
| `cutcli docs [topic]` | 查看使用手册 |

## 字幕参数详解

**全局选项**（CLI 使用 kebab-case）：

| 选项 | 说明 |
|------|------|
| `--font <name>` | 字体 |
| `--font-size <n>` | 字号（推荐 6-12） |
| `--text-color <hex>` | 颜色如 `#FFFFFF` |
| `--bold` / `--italic` / `--underline` | 样式 |
| `--alignment <n>` | 对齐（0=居中, 1=左, 2=右） |
| `--alpha <n>` | 透明度 0-1 |
| `--transform-x <n>` | X轴位置，归一化值 (0=居中, -1=最左, 1=最右) |
| `--transform-y <n>` | Y轴位置，归一化值 (0=居中, 1=最上, -1=最下) |
| `--border-color <hex>` | 描边颜色 |
| `--border-width <n>` | 描边宽度 |
| `--bg-color <hex>` | 背景颜色 |
| `--bg-alpha <n>` | 背景透明度 |
| `--bg-style <n>` | 背景样式 (0=无, 1=填充) |
| `--bg-round <n>` | 背景圆角 |
| `--has-shadow` | 启用阴影 |
| `--shadow-color <hex>` | 阴影颜色 |
| `--text-effect <name>` | 花字效果名称 (用 `cutcli query huazi` 查询) |
| `--letter-spacing <n>` | 字间距 |
| `--line-spacing <n>` | 行间距 |

> **坐标系**：`(0,0)` 屏幕正中，X 正方向朝右，Y 正方向朝上。`(-1,-1)` 为左下角，`(1,1)` 为右上角。

**每条字幕 JSON 字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 字幕文本 |
| `start` | number | 是 | 开始时间（μs） |
| `end` | number | 是 | 结束时间（μs） |
| `keyword` | string | 否 | 关键词高亮文本 |
| `keywordColor` | string | 否 | 关键词颜色 |
| `fontSize` | number | 否 | 单条字号覆盖 |
| `inAnimation` | string | 否 | 入场动画名（用 `cutcli query image-animations --type in` 查询） |
| `outAnimation` | string | 否 | 出场动画名（`--type out`） |
| `loopAnimation` | string | 否 | 循环动画名（`--type loop`） |
| `inAnimationDuration` | number | 否 | 入场动画时长（μs），建议 500000 |
| `outAnimationDuration` | number | 否 | 出场动画时长（μs），建议 500000 |
| `loopAnimationDuration` | number | 否 | 循环动画时长（μs） |

## 图片参数详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageUrl` | string | 是 | 图片 URL |
| `width` | number | 是 | 宽度（像素） |
| `height` | number | 是 | 高度（像素） |
| `start` | number | 是 | 开始时间（μs） |
| `end` | number | 是 | 结束时间（μs） |
| `transformX` | number | 否 | X位置 (-1~1, 0=居中) |
| `transformY` | number | 否 | Y位置 (-1~1, 0=居中) |
| `scaleX` | number | 否 | X缩放 (1.0=原大) |
| `scaleY` | number | 否 | Y缩放 (1.0=原大) |
| `rotation` | number | 否 | 旋转角度 |
| `inAnimation` | string | 否 | 入场动画名 |
| `outAnimation` | string | 否 | 出场动画名 |
| `inAnimationDuration` | number | 否 | 入场动画时长（μs） |
| `outAnimationDuration` | number | 否 | 出场动画时长（μs） |
| `transition` | string | 否 | 转场效果名 |
| `transitionDuration` | number | 否 | 转场时长（μs） |

## 视频参数详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `videoUrl` | string | 是 | 视频 URL |
| `width` | number | 是 | 宽度 |
| `height` | number | 是 | 高度 |
| `duration` | number | 是 | 视频原始时长（μs） |
| `start` | number | 是 | 时间线开始（μs） |
| `end` | number | 是 | 时间线结束（μs） |
| `volume` | number | 否 | 音量 (0-1) |
| `transition` | string | 否 | 转场效果名 |

## 音频参数详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `audioUrl` | string | 是 | 音频 URL |
| `duration` | number | 是 | 音频时长（μs） |
| `start` | number | 是 | 开始时间（μs） |
| `end` | number | 是 | 结束时间（μs） |
| `volume` | number | 否 | 音量 (0-1) |
| `audioEffect` | string | 否 | 音效名称 |

## 特效参数详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `effectId` | string | 是 | 特效ID (用 `cutcli query effects` 查询) |
| `start` | number | 是 | 开始时间（μs） |
| `end` | number | 是 | 结束时间（μs） |
| `segmentId` | string | 否 | 指定应用到的片段 |

## 滤镜参数详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filterId` | string | 是 | 滤镜ID (用 `cutcli query filters` 查询) |
| `start` | number | 是 | 开始时间（μs） |
| `end` | number | 是 | 结束时间（μs） |
| `intensity` | number | 否 | 滤镜强度 (0-100) |

## 遮罩参数

| 选项 | 说明 |
|------|------|
| `--segment-ids <ids>` | 片段ID列表（逗号分隔，必填） |
| `--name <name>` | 遮罩类型: 线性/镜面/圆形/矩形/星形/爱心（默认: 线性） |
| `--width <n>` | 宽度 |
| `--height <n>` | 高度 |
| `--feather <n>` | 羽化 |
| `--rotation <n>` | 旋转角度 |
| `--invert` | 反转遮罩 |

## 关键帧参数详解

```bash
cutcli keyframes add <draftId> --keyframes '[
  {"segmentId":"<segId>","property":"scale_x","keyframes":[
    {"time":0,"value":1.0,"easing":"ease_in_out"},
    {"time":3000000,"value":1.5,"easing":"linear"}
  ]}
]'
```

支持属性: `position_x`, `position_y`, `scale_x`, `scale_y`, `rotation`, `opacity`
缓动类型: `linear`, `ease_in`, `ease_out`, `ease_in_out`

## 常用动画名称

查询所有可用动画：`cutcli query image-animations --type in|out|loop`

常用入场动画：淡入显现、轻微放大、向下滑动、波浪弹入、居中淡入、推近淡入、逐步显现、弹入跳动、冲刺急停、强力砸下、闪现入场、3D翻转、晃动入场

常用出场动画：渐隐、放大、向上滑动、向下滑动、向右露出、向左露出、波浪弹出、居中淡出

## 典型场景示例

### 多条字幕 + 关键词高亮

```bash
cutcli captions add <draftId> --captions '[
  {"text":"今天天气真好","start":0,"end":2000000,
   "keyword":"天气","keywordColor":"#FF6600"},
  {"text":"我们一起出去玩吧","start":2000000,"end":4000000,
   "inAnimation":"渐显","outAnimation":"渐隐",
   "inAnimationDuration":500000,"outAnimationDuration":500000}
]' --font-size 8 --text-color "#FFFFFF" --bold
```

### 图片轮播 + 转场 + 背景音乐

```bash
cutcli images add <draftId> --image-infos '[
  {"imageUrl":"https://a.com/1.jpg","width":1080,"height":1920,"start":0,"end":3000000,
   "inAnimation":"渐显","inAnimationDuration":500000,
   "transition":"叠化","transitionDuration":500000},
  {"imageUrl":"https://a.com/2.jpg","width":1080,"height":1920,"start":3000000,"end":6000000}
]'
cutcli audios add <draftId> --audio-infos '[
  {"audioUrl":"https://a.com/bgm.mp3","duration":6000000,"start":0,"end":6000000,"volume":0.5}
]'
```

### 关键帧动画（缩放效果）

```bash
# 先添加图片，获取 segmentId
cutcli images add <draftId> --image-infos '[...]'
# 为片段添加关键帧
cutcli keyframes add <draftId> --keyframes '[
  {"segmentId":"<segId>","property":"scale_x","offset":0,"value":1.0},
  {"segmentId":"<segId>","property":"scale_x","offset":3000000,"value":1.5},
  {"segmentId":"<segId>","property":"scale_y","offset":0,"value":1.0},
  {"segmentId":"<segId>","property":"scale_y","offset":3000000,"value":1.5}
]'
```

### 查询并添加贴纸

```bash
# 搜索贴纸
cutcli query stickers --action search --keyword "爱心" --pretty

# 添加贴纸
cutcli sticker add <draftId> --sticker-id "找到的ID" --start 0 --end 5000000 --scale 1.5
```

### 查询并添加滤镜

```bash
# 搜索滤镜
cutcli query filters --action search --keyword "复古" --pretty

# 添加滤镜
cutcli filters add <draftId> --filter-infos '[{"filterId":"找到的ID","start":0,"end":5000000,"intensity":80}]'
```

## 配置管理

```bash
# 查看当前配置
cutcli config show --pretty

# 设置草稿导出目录（草稿将创建到此目录）
cutcli config set-dir ~/Desktop/drafts

# 设置为剪映默认目录
cutcli config set-dir "/Volumes/JianyingPro/User Data/Projects/com.lveditor.draft"
```

## 草稿上传

将草稿打包并上传到云端，返回下载链接，方便分享给他人导入剪映。

```bash
# 自动打包并上传
cutcli draft upload <draftId>

# 上传已有的 zip 文件
cutcli draft upload <draftId> --zip ~/Desktop/draft.zip
```

返回结果包含 `downloadUrl`（下载链接）、`zipPath`（本地 zip 路径）、`size`（文件大小）。

## 转场查询

查询剪映可用的转场效果（共 2270+ 个，13 个分类）。

```bash
# 查看转场分类
cutcli query transitions --action categories --pretty

# 搜索转场
cutcli query transitions --action search --keyword "叠化" --pretty

# 按分类列出
cutcli query transitions --action list --category "热门" --limit 20 --pretty
```

| 选项 | 说明 |
|------|------|
| `--action` | 必填，`search`(搜索) / `categories`(分类) / `list`(列表) |
| `--keyword` | `action=search` 时的搜索关键词 |
| `--category` | `action=list` 时的分类名 |
| `--limit` | 最大结果数，默认 50 |

## 文字动画查询

查询可用的文字入场/出场/循环动画。

```bash
# 文字入场动画
cutcli query text-animations --type in --pretty

# 文字出场动画
cutcli query text-animations --type out --pretty

# 文字循环动画
cutcli query text-animations --type loop --pretty

# 仅查看免费动画
cutcli query text-animations --type in --mode 2 --pretty
```

| 选项 | 说明 |
|------|------|
| `--type` | `in`(入场) / `out`(出场) / `loop`(循环)，默认 `in` |
| `--mode` | `0`(全部) / `1`(VIP) / `2`(免费)，默认 `0` |

## AI 工具集成安装

`setup` 命令为 Cursor、Claude Code、OpenClaw 等 AI 工具安装 cutcli 的 SKILL 配置文件。

```bash
# 为 Cursor IDE 安装
cutcli setup cursor

# 为 Claude Code 安装
cutcli setup claude

# 安装所有工具配置
cutcli setup all

# 强制覆盖已有配置
cutcli setup cursor --force
```

| 参数 | 说明 |
|------|------|
| `<tool>` | `cursor` / `claude` / `openclaw` / `all` |
| `--force` | 覆盖已有配置文件 |

## 注意事项

1. **命令名是 cutcli**：不是 `cut`（`cut` 是系统命令），所有命令都以 `cutcli` 开头
2. **先创建草稿再操作**：所有 add/list 命令都需要先 `cutcli draft create` 获取 `draftId`
3. **时间不要重叠**：同一轨道内片段的时间区间不应重叠
4. **动画名必须有效**：使用 `cutcli query image-animations` 查询可用动画，无效名称会被忽略
5. **动画时长不超过片段时长**：入场 + 出场动画总时长应小于片段时长
6. **图片需要宽高**：添加图片时 `width` 和 `height` 为必填字段
7. **视频需要原始时长**：添加视频时 `duration` 为原始视频时长
8. **草稿可叠加操作**：同一草稿可多次调用不同 add 命令，逐步构建完整工程
9. **查看详细帮助**：`cutcli docs <command>` 或 `cutcli <command> --help`
10. **在线文档**：https://cutcli.com
