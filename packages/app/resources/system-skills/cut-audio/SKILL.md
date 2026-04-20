---
name: cut-audio
description: >-
  使用 cut_cli 处理剪映/CapCut 草稿的音频。覆盖 BGM/旁白/音效/视频原声的多轨道分层、
  音量平衡公式、音画对位（节拍对齐画面切换）、音频特效、淡入淡出。
  当用户提到"BGM"、"配音"、"旁白"、"音效"、"混音"、"背景音乐"、"音频"、"声音"、"audio"、
  "口播"、"播音"、"音乐"、"卡点"时使用此 skill。
---

> **⚠️ Nex Agent 环境说明（重要）**
>
> - 本 cutcli 工具生成的是 **CapCut 国际版** 草稿（特效/动画/花字/转场资产名都是 CapCut 国际版的命名）。
> - macOS 默认草稿目录为 `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<draftId>/`，**不是** 国内版剪映的 `~/Movies/JianyingPro Drafts/`。
> - 应在 **CapCut 桌面端** 打开。**国内版剪映（JianyingPro）大概率无法识别本草稿的特效/动画/花字**，可能出现"特效缺失"、字幕样式异常或直接打不开。
> - 如用户安装的是国内版剪映，**先告知此约束并征求确认**；本工具不提供国内版兼容方案。
> - 下文如出现 `~/Movies/JianyingPro Drafts/...` 路径，请以本节 CapCut 路径为准。


# cut_cli 音频剪辑指南

## 时间单位

所有时间参数使用**微秒 (μs)**：`1秒 = 1,000,000`。下文 `duration / start / end / fadeIn / fadeOut` 全是微秒。

---

## 音频在剪辑中的四种角色

剪辑里的音频不是"放一段就好"，而是分角色协作。**先想清楚每条音频是哪个角色，再决定音量和时机。**

| 角色 | 作用 | 推荐音量 | 出现时机 |
|------|------|----------|----------|
| 旁白 / 解说 / 人声 | 信息载体，必须最清晰 | `1.0` | 跟字幕同步 |
| 背景音乐 (BGM) | 情绪基调，不能盖过人声 | 有旁白：`0.20-0.30`；纯画面：`0.50-0.70` | 通常铺满全片 |
| 音效 (SFX) | 强调点睛（点击、爆破、转场、UI 反馈） | `0.40-0.60` | 关键节点，瞬时 |
| 留白 / 静音 | 节奏调节，凸显下一段 | `0` | 段落之间，0.3-1 秒 |

> **静音不是"不放"**：它是真实的剪辑手段。2 秒钟无声 + 一个清脆的音效，胜过 2 秒钟连续 BGM。

---

## 多轨道分层（强制）

**每次调用 `cutcli audios add` 都会创建一条独立的音频轨道**（参见 [src/api/audios/add-audios.ts](src/api/audios/add-audios.ts) 第 12 行 `findOrCreateTrack(draft, TrackTypes.AUDIO, newSegs)`，多次 add 由于时间区间重叠会自动开新轨道）。

**正确的做法**：不同角色的音频**分多次 add**，每次只传一类。

```bash
# 旁白轨
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/voice.mp3","duration":10000000,"start":0,"end":10000000,"volume":1.0}
]'

# BGM 轨
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/bgm.mp3","duration":10000000,"start":0,"end":10000000,"volume":0.25}
]'

# 音效轨（多个音效合并到同一次 add，前提是时间不重叠）
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/sfx_pop.mp3","duration":300000,"start":2000000,"end":2300000,"volume":0.5},
  {"audioUrl":"https://example.com/sfx_ding.mp3","duration":400000,"start":7000000,"end":7400000,"volume":0.5}
]'
```

**反例**：把 BGM 和旁白塞在同一个数组里。它们时间一定重叠，会被拆到两条轨道，但你失去了对"角色"的语义控制，后期想统一调音量都难。

---

## 音量平衡公式

记住这张表，所有混音问题都能现场解决：

| 场景 | 旁白 | BGM | 音效 | 视频原声 |
|------|------|-----|------|----------|
| 教程 / 知识科普（旁白主导） | `1.0` | `0.15-0.20` | `0.40` | `0`（关闭） |
| Vlog（旁白 + 环境感） | `1.0` | `0.25-0.30` | `0.50` | `0.20-0.40` |
| 产品介绍（情绪重） | `1.0` | `0.30` | `0.50` | `0` |
| 卡点 / 混剪（音乐主导） | `0`（无） | `0.80-1.00` | `0.40` | `0`（关闭） |
| 纯画面 + BGM | `0`（无） | `0.60-0.80` | `0.50` | `0` |
| 影视混剪（保留同期声） | `0`（无） | `0.30-0.50` | `0.40` | `0.50-0.80` |

**视频原声**通过 `videoInfo.volume` 字段控制（参见 [src/api/videos/add-videos.ts](src/api/videos/add-videos.ts) 第 70 行 `if (vi.volume != null) segment.volume = vi.volume;`）。

**关键原则**：

1. **旁白永远是主角**。其它一切音频都不能盖过它（峰值差 ≥ 8 dB，对应 volume 比 ≥ 2.5）。
2. **同时两条音频** → 较弱那条要降到 0.3 以下。
3. **BGM 在旁白进入前的"前奏"可以响一些**，旁白进入瞬间降下来（但 cut_cli 当前不支持自动 ducking，需要手动用关键帧实现，详见下文"高级技巧"）。

---

## 预先获取音频时长（必备步骤）

在 `audios add` 之前，**必须**知道音频的真实时长。两个办法：

```bash
# 方法 1：远程音频
cutcli query audio-duration --url https://example.com/audio.mp3
# 返回 {"message":"ok","duration":15234567}  （μs）

# 方法 2：用户告诉你时长（秒）→ 自己换算
# 30 秒 = 30 * 1000000 = 30000000 μs
```

**为什么必填**：`audios add` 需要 `duration` 字段告诉剪映这条音频的"原始长度"，剪映用它做缩略图/波形和"是否被截断"的提示。`start/end` 才是它出现在时间线上的位置。

```text
audioUrl     : 音频源 URL（必填，自动下载到 resources/）
duration     : 音频原始总时长 μs（必填，必须真实，不能瞎填）
start / end  : 在时间线上的位置 μs（必填）
volume       : 音量 0-1（可选，默认 1.0）
audioEffect  : 音频特效名（可选，见下文）
```

> **截断 vs 循环**：如果 `(end - start) < duration`，剪映会按 `start` 开始播放，到 `end` 截断。如果想循环填满，需要在数组里手动放多条同 URL 的素材，每条 start/end 接力。

---

## 音画对位的两种方法

### 方法 A：音频先行（推荐用于口播 / 解说）

**逻辑**：先有声，再让画面铺满音频时长。

```bash
# Step 1
DUR=$(cutcli query audio-duration --url https://example.com/voice.mp3 | python3 -c "import sys,json; print(json.load(sys.stdin)['duration'])")
echo "音频时长: $DUR μs"

# Step 2 创建草稿
DRAFT=$(cutcli draft create --width 1080 --height 1920 | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# Step 3 旁白
cutcli audios add "$DRAFT" --audio-infos "[
  {\"audioUrl\":\"https://example.com/voice.mp3\",\"duration\":$DUR,\"start\":0,\"end\":$DUR,\"volume\":1.0}
]"

# Step 4 画面铺满（举例：1 张图）
cutcli images add "$DRAFT" --image-infos "[
  {\"imageUrl\":\"https://example.com/bg.jpg\",\"width\":1080,\"height\":1920,\"start\":0,\"end\":$DUR}
]"
```

**捷径**：`cutcli draft easy` 一条命令搞定（参见 [src/api/draft/easy-create-material.ts](src/api/draft/easy-create-material.ts) 自动按音频时长铺图、视频、文字）：

```bash
cutcli draft easy "$DRAFT" \
  --audio-url "https://example.com/voice.mp3" \
  --img-url "https://example.com/bg.jpg" \
  --text "欢迎观看"
```

### 方法 B：画面先行（推荐用于卡点 / 混剪）

**逻辑**：先确定要拼几个画面，估总时长，再选 / 裁剪音乐。

```text
画面规划：
  3 张图 × 每张 2 秒 + 0.5 秒收尾 = 6.5 秒 = 6500000μs

音频要求：
  找一首 BPM ≥ 120 的音乐（拍点密）
  query audio-duration 拿到 duration（设为 60000000，即 1 分钟）
  在时间线只用 [0, 6500000] 这段 → start=0, end=6500000
```

```bash
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/bgm.mp3","duration":60000000,"start":0,"end":6500000,"volume":0.8}
]'
```

剪映会自动从音乐的开头播 6.5 秒（按 `start` 在时间线上的位置）。

---

## 节拍对齐画面切换（卡点视频专用）

BGM 的 BPM 决定每拍多长：

| BPM | 每拍时长 (μs) | 适用 |
|-----|---------------|------|
| 80 | 750000 | 慢节奏、回忆类 |
| 100 | 600000 | 中速、Vlog |
| 120 | 500000 | 主流抖音 / 流行 |
| 128 | 468750 | 电子 / 节奏感 |
| 140 | 428571 | 嘻哈 / 强节奏 |
| 160 | 375000 | 速食爆款 |

**对齐步骤**：

1. 听 BGM，找出第一个明显鼓点的时间偏移（offset，单位 μs）
2. 计算每拍间隔 `beat = 60000000 / BPM`
3. 第 N 拍位置 `t(N) = offset + N × beat`
4. 画面切换、字幕入场、贴纸出现都对齐 `t(N)`

**示例**（120 BPM，第一拍在 0.2 秒处）：

```text
beat   = 60000000 / 120 = 500000 μs
offset = 200000 μs
拍 1   = 200000
拍 2   = 700000
拍 3   = 1200000
拍 4   = 1700000
...
```

3 张图卡点：

```bash
cutcli images add "$DRAFT" --image-infos '[
  {"imageUrl":"https://a.com/1.jpg","width":1080,"height":1920,"start":200000, "end":1700000},
  {"imageUrl":"https://a.com/2.jpg","width":1080,"height":1920,"start":1700000,"end":3200000},
  {"imageUrl":"https://a.com/3.jpg","width":1080,"height":1920,"start":3200000,"end":4700000}
]'
```

---

## 音频特效

`audioInfo.audioEffect` 可以加变声 / 空间感效果（参见 [src/api/audios/add-audios.ts](src/api/audios/add-audios.ts) 第 22-26 行 `create_materials_audio_effects`）。

**常用音频特效名**（数据来自 `src/draft/drafts/data/audio/audio_effect.js`）：

| 类目 | 名称 |
|------|------|
| 增强 | `人声增强` `清澈人声` `高解析人声` `低音增强` `超重低音` |
| 空间感 | `3d环绕音` `360度环绕音` `深海回声` `空灵感` |
| 场景 | `房间` `教堂` `电台播音` `留声机` `音乐厅` `教室` `浴室` `下雨` `楼道` |
| 设备 | `电话` `老式电话` `乡村大喇叭` |
| 趣味变声 | `氦气` `闷响` `回忆人声` |
| 总和 | 共 130 个音效（mode=2） |

```bash
# 给旁白加"清澈人声"
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/voice.mp3","duration":10000000,"start":0,"end":10000000,"volume":1.0,"audioEffect":"清澈人声"}
]'
```

---

## 三个完整案例

### 案例 1：Vlog 双轨道（旁白 + BGM）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "周末Vlog" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 1. 先拿到音频时长
VOICE_DUR=$(cutcli query audio-duration --url https://example.com/voice.mp3 | python3 -c "import sys,json; print(json.load(sys.stdin)['duration'])")
# 假设 VOICE_DUR = 30000000（30 秒）

# 2. 旁白轨：音量 1.0
cutcli audios add "$DRAFT" --audio-infos "[
  {\"audioUrl\":\"https://example.com/voice.mp3\",\"duration\":$VOICE_DUR,\"start\":0,\"end\":$VOICE_DUR,\"volume\":1.0}
]"

# 3. BGM 轨：音量 0.25（旁白主导）
cutcli audios add "$DRAFT" --audio-infos "[
  {\"audioUrl\":\"https://example.com/bgm.mp3\",\"duration\":120000000,\"start\":0,\"end\":$VOICE_DUR,\"volume\":0.25}
]"

# 4. 转场音效轨（在 10 秒 / 20 秒处加一下"叮"）
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/ding.mp3","duration":300000,"start":10000000,"end":10300000,"volume":0.5},
  {"audioUrl":"https://example.com/ding.mp3","duration":300000,"start":20000000,"end":20300000,"volume":0.5}
]'
```

**输出 4 条独立音轨**：旁白 / BGM / 音效（连成一条）。

### 案例 2：纯讲解教程（旁白主导，极弱 BGM）

```bash
DRAFT=$(cutcli draft create --width 1920 --height 1080 --name "教程" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

VOICE_DUR=$(cutcli query audio-duration --url https://example.com/lecture.mp3 | python3 -c "import sys,json; print(json.load(sys.stdin)['duration'])")

# 旁白
cutcli audios add "$DRAFT" --audio-infos "[
  {\"audioUrl\":\"https://example.com/lecture.mp3\",\"duration\":$VOICE_DUR,\"start\":0,\"end\":$VOICE_DUR,\"volume\":1.0,\"audioEffect\":\"人声增强\"}
]"

# BGM 极弱（0.10），让旁白完全无干扰
cutcli audios add "$DRAFT" --audio-infos "[
  {\"audioUrl\":\"https://example.com/calm_bgm.mp3\",\"duration\":300000000,\"start\":0,\"end\":$VOICE_DUR,\"volume\":0.10}
]"
```

**关键点**：教程类 BGM 必须用钢琴 / 环境音 / lo-fi，**不能用人声 BGM**（会和旁白打架）。

### 案例 3：卡点视频（音乐主导）

```bash
DRAFT=$(cutcli draft create --width 1080 --height 1920 --name "卡点" | python3 -c "import sys,json; print(json.load(sys.stdin)['draftId'])")

# 1. BGM 主导（120 BPM，第一拍在 200000μs）
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/electronic_bgm.mp3","duration":120000000,"start":0,"end":12200000,"volume":0.95}
]'

# 2. 8 张图按拍点切换（每 4 拍换一张 = 2000000μs/张）
cutcli images add "$DRAFT" --image-infos '[
  {"imageUrl":"https://a.com/1.jpg","width":1080,"height":1920,"start":200000,  "end":2200000, "transition":"叠化","transitionDuration":200000},
  {"imageUrl":"https://a.com/2.jpg","width":1080,"height":1920,"start":2200000, "end":4200000, "transition":"叠化","transitionDuration":200000},
  {"imageUrl":"https://a.com/3.jpg","width":1080,"height":1920,"start":4200000, "end":6200000, "transition":"叠化","transitionDuration":200000},
  {"imageUrl":"https://a.com/4.jpg","width":1080,"height":1920,"start":6200000, "end":8200000, "transition":"叠化","transitionDuration":200000},
  {"imageUrl":"https://a.com/5.jpg","width":1080,"height":1920,"start":8200000, "end":10200000,"transition":"叠化","transitionDuration":200000},
  {"imageUrl":"https://a.com/6.jpg","width":1080,"height":1920,"start":10200000,"end":12200000}
]'

# 3. 在第 4 拍 / 第 8 拍各加一个"砰"音效
cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/boom.mp3","duration":500000,"start":2200000,"end":2700000,"volume":0.7},
  {"audioUrl":"https://example.com/boom.mp3","duration":500000,"start":4200000,"end":4700000,"volume":0.7}
]'
```

**关键点**：卡点视频 BGM 几乎全开（0.95），不需要旁白；画面切换严格对齐拍点。

---

## 高级技巧：自动 Ducking（旁白进入时压低 BGM）

cut_cli 当前不支持音频淡入淡出关键帧的便捷 CLI，但可以通过 `keyframes` 实现**音量曲线**。

设旁白在 5000000μs 进入，2000000μs 持续，BGM 在这段需要降到 0.10：

```bash
# 1. 先 add BGM，拿到 segmentId
BGM_RESULT=$(cutcli audios add "$DRAFT" --audio-infos '[
  {"audioUrl":"https://example.com/bgm.mp3","duration":30000000,"start":0,"end":30000000,"volume":0.5}
]')
# 从 trackId 找 segmentId（cutcli audios list 可见）
BGM_SEG=$(cutcli audios list "$DRAFT" | python3 -c "import sys,json; print(json.load(sys.stdin)[-1]['segmentId'])")

# 2. 在 BGM segment 上加 volume 关键帧
cutcli keyframes add "$DRAFT" --keyframes "[
  {\"segmentId\":\"$BGM_SEG\",\"property\":\"volume\",\"offset\":0,       \"value\":0.50},
  {\"segmentId\":\"$BGM_SEG\",\"property\":\"volume\",\"offset\":4500000, \"value\":0.50},
  {\"segmentId\":\"$BGM_SEG\",\"property\":\"volume\",\"offset\":5000000, \"value\":0.10},
  {\"segmentId\":\"$BGM_SEG\",\"property\":\"volume\",\"offset\":7000000, \"value\":0.10},
  {\"segmentId\":\"$BGM_SEG\",\"property\":\"volume\",\"offset\":7500000, \"value\":0.50}
]"
```

**注意 `offset` 是片段相对偏移**（参见 [.cursor/skills/cut-keyframes/SKILL.md](.cursor/skills/cut-keyframes/SKILL.md)），从 segment.start 算起。

---

## 注意事项

1. **duration 必须是真实音频时长**：随便填会导致剪映波形错位、自动检测异常。优先用 `cutcli query audio-duration`。
2. **每个角色的音频独立 add**：不要把 BGM 和旁白塞同一个数组。
3. **音效不要超过 1 秒**：超过 1 秒就不是"音效"了，是"插曲"。
4. **不同音频不需要同步开始**：BGM 通常 0 开始，旁白可能 1 秒后才进，音效在关键节点出现。
5. **音频 URL 自动下载**：传入的 URL 会被下载到草稿的 `resources/{uuid}.mp3`，剪映打开后自带本地文件，不依赖网络。
6. **截断的音频不会循环**：如果 `end - start < duration`，剪映只播 `[0, end-start]` 这段，不循环。要循环就在数组里多次 add 同一个 URL，时间接力。
7. **想要的特效搜不到**：`audioEffect` 必须精确名称（中文）；记不住时让用户换说法，或先在 [src/draft/drafts/data/audio/audio_effect.js](src/draft/drafts/data/audio/audio_effect.js) 查名称，不要瞎猜。
