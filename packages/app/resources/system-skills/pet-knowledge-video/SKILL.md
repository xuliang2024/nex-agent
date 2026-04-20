---
name: pet-knowledge-video
description: 生成 1 分钟宠物知识科普口播视频（4×15s）。使用 Seedance 2.0 Fast VIP omni_reference 模式生成四段视频，ffmpeg 拼接。当用户提到「宠物视频」「宠物科普」「宠物知识」「萌宠视频」「养宠科普」「pet knowledge video」时使用此 skill。
---

# 宠物知识科普口播视频生成（1 分钟 / 4×15s）

将用户提供的博主图片和科普主题，生成一条 1 分钟的宠物知识科普**竖版**视频。使用 Seedance 2.0 Fast VIP 的 **omni_reference** 模式一次性生成每段 15 秒视频，最终四段用 **ffmpeg** 拼接。

## 设计理念

- **一镜到底**：每段 15s 由 Seedance 2.0 omni_reference 一次性生成，无拼接
- **博主参考图**：通过 `@image_file_1` 引用博主形象，确保四段人物一致
- **画面硬切**：博主口播 → 硬切宠物 B-roll → 回博主，增加观赏性
- **原生配音**：Seedance 在 15s 内生成 50-70 字口播旁白，嘴型同步
- **纯净画面**：视频中绝对不出现任何文字、字幕、标题、水印
- **竖版 9:16**：适配抖音/快手/小红书

## 工作流总览

```
博主图片 + 宠物主题
  → ① 准备博主图片 URL（uploadFile / transfer_url）
  → ② Seedream v5 Lite 生成 4 张博主形象图（备用换图）
  → ③ 写 4 段连贯口播词 + 4 条 Seedance 提示词
  → ④ super-seed2 omni_reference 并行生成 4 条 15s 视频
  → ⑤ ffmpeg 拼接为 1 分钟完整视频
```

## 前置条件

1. **会话已启用系统工具（NEX AI）**，以下工具可用：`generate`、`get_result`
2. **本机已安装 `ffmpeg`**（仅 Step 5 拼接需要）

### 环境检查

- 若系统工具未启用或 `generate` 不可用：停止并提示用户在会话配置中启用系统工具（NEX AI）。
- 若拼接步骤失败且报找不到 `ffmpeg`：提示用户安装 ffmpeg。

### 关于图片 URL

- `generate` 的图生图 / 图生视频需要**公网可访问**的图片 URL。
- 无论用户提供的是本地文件路径、粘贴的图片还是网络链接，统一使用内置 `uploadFile` 工具上传到 CDN 获取公网 URL。

---

## Step 1：准备博主图片 URL

如果用户**未提供博主图片**，使用以下预设博主形象图（无需 Step 2 生成形象图，直接跳到 Step 3）：

| 编号 | 预设图片 URL |
|------|------------|
| 女博主 A | `https://cdn-video.51sux.com/v3-tasks/2026/04/17/c8ade479a0504341ae7d9ca588bfbe40.jpeg` |
| 女博主 B | `https://cdn-video.51sux.com/v3-tasks/2026/04/17/27d3fcd325e34f77a16c0d8a63e6fe38.png` |

默认随机选择其中一位，或让用户选择。

如果用户**提供了博主图片**，使用内置 `uploadFile` 工具上传到 CDN 获取公网 URL。

---

## Step 2：Seedream v5 Lite 生成 4 张博主形象图

使用 `fal-ai/bytedance/seedream/v5/lite/edit`（图生图编辑模式）基于博主原图生成 4 张不同姿态的形象图。

调用 `generate` 工具 4 次（或使用 `options.n: 4`），轮询 `get_result` 直至完成（图片生成较快，建议 **5-10 秒** 查询一次）：

```
generate({
  model: "fal-ai/bytedance/seedream/v5/lite/edit",
  prompt: "基于图片中的人物形象，生成该人物的写实风格照片，保持人物面部特征一致",
  image_url: "博主图片的稳定 URL"
})
→ get_result({ task_id: "..." })  // 间隔 5-10 秒轮询
```

若需要纯文生图（无参考图场景），使用 `fal-ai/bytedance/seedream/v5/lite/text-to-image`。

**保留全部 4 张图片 URL**，按偏好排序，供 Step 4 人脸审核失败时按顺序换图。

---

## Step 3：写 4 段连贯口播词 + 设计混合镜头提示词

### 3a. 确认用户主题

用户应提供具体科普主题（如「猫咪打呼噜的秘密」「新手养狗注意事项」）。未指定则询问用户或从热门话题中选择。

### 3b. 设计 4 段叙事结构

4 段口播词必须**前后连贯**，每段约 **50～70 字**（约 10～14 秒语速）。

| 段落 | 叙事功能 | 内容要求 |
|------|---------|---------|
| **P1 开场引入** | 抓注意力 | 悬念/反常识/痛点 |
| **P2 知识展开** | 讲道理 | 原因、机制、科学依据 |
| **P3 实操演示** | 教方法 | 可操作的建议与演示 |
| **P4 总结号召** | 促互动 | 总结 + 点赞关注评论引导 |

### 3c. 设计 4 条 Seedance 提示词

**核心原则**：

- 每条 15s 内要有**画面硬切**，不要全程博主正面口播
- **口播词不停顿**，写成完整一段；宠物画面时段口播作为画外音继续
- **宠物画面为独立 B-roll**，用「画面硬切到」描述
- **全部 4 条都依赖同一张博主参考图**（通过 `reference_images` 传入，提示词中自然描述博主外貌即可）
- **必须包含防字幕三重约束**

**画面节奏（15s）**：

```
博主说话(~5s) → 硬切到独立宠物素材(~4s，口播继续) → 硬切回博主(~6s)
```

**提示词模板**：

```
STRICT RULE: The video must contain absolutely NO text, NO subtitles, NO captions, NO titles, NO watermarks, NO on-screen words of any kind.

参考图中的博主[外貌描述]，面对镜头说话，嘴部持续自然张合，表情[情绪变化]。画面中不得出现任何文字、字幕、标题、水印。
(0-5s) 博主面对镜头亲切说话，[手势/动作]。中景构图，背景是[场景]。
(5-9s) 画面硬切到[独立宠物场景：种类+外貌+行为+独立背景+光线]。口播作为画外音继续。
(9-15s) 画面硬切回博主继续说话，[结尾动作/表情]。
[博主场景+光线]，竖版构图，短视频知识科普口播风格。

Spoken voiceover audio (warm friendly Chinese female voice, natural conversational pace): "[完整口播词]"

REMINDER: Absolutely no text, subtitles, or captions anywhere in the video.
```

---

## Step 4：并行生成 4 条 15s 视频（Seedance 2.0 Ark API）

对 P1～P4 **同时**发起 4 次 `generate` 调用：

```
generate({
  model: "ark/seedance-2.0",
  prompt: "（本条完整视频提示词）",
  model: "seedance_2.0_fast",          // params 内的模型变体
  reference_images: ["博主形象图 CDN URL"],
  ratio: "9:16",
  duration: "15",
  resolution: "720p",
  generate_audio: true
})
```

> **注意**：`generate` 工具会自动将参数映射到 API 的 `params` 字段。`model` 同时作为顶层模型标识（`ark/seedance-2.0`）和 params 内变体选择（`seedance_2.0_fast`），两者均需传入。

四条任务并行提交后，分别 `get_result` 轮询直至全部完成。

**轮询策略**：视频生成通常需要 3-8 分钟，建议每 **10-20 秒** 查询一次结果。不要查询过于频繁（<5s 会浪费资源），也不要间隔太长（>60s 会延迟用户看到结果）。

将生成的视频下载到本地：

```bash
mkdir -p /tmp/pet_video_{timestamp}
curl -L -o /tmp/pet_video_{timestamp}/part1.mp4 "{video_url_1}"
curl -L -o /tmp/pet_video_{timestamp}/part2.mp4 "{video_url_2}"
curl -L -o /tmp/pet_video_{timestamp}/part3.mp4 "{video_url_3}"
curl -L -o /tmp/pet_video_{timestamp}/part4.mp4 "{video_url_4}"
```

### 人脸审核失败重试

若某条任务失败且错误信息含人脸/审核/moderation：

1. 换用 Step 2 中的**下一张**博主图 URL，**提示词不变**，仅替换参考图重新生成。
2. 顺序：图1 → 图2 → 图3 → 图4 → 仍失败则请用户更换原始博主素材。

---

## Step 5：ffmpeg 拼接为 1 分钟完整视频

按 **P1→P2→P3→P4** 顺序拼接：

```bash
cat > /tmp/pet_video_{timestamp}/list.txt << 'EOF'
file 'part1.mp4'
file 'part2.mp4'
file 'part3.mp4'
file 'part4.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i /tmp/pet_video_{timestamp}/list.txt -c copy /tmp/pet_video_{timestamp}/pet_knowledge_final.mp4
```

若编码不兼容导致 `copy` 失败，改用重新编码：

```bash
ffmpeg -y -f concat -safe 0 -i /tmp/pet_video_{timestamp}/list.txt -c:v libx264 -c:a aac /tmp/pet_video_{timestamp}/pet_knowledge_final.mp4
```

---

## 输出结果

```
🎬 宠物知识科普口播视频生成完成！

视频：{final_video_path}
分辨率：竖版 9:16
时长：约 60 秒（4 × 15s）
模式：Seedance 2.0 Fast VIP omni_reference

4 段口播文案：
P1: "{p1_text}"
P2: "{p2_text}"
P3: "{p3_text}"
P4: "{p4_text}"

抖音发布标题建议：{title}
```

## 提示词约束清单

| 约束 | 说明 | 错误示例 |
|------|------|---------|
| **禁止字幕** | 首行 STRICT RULE + 场景中加中文"不得出现文字" + 末尾 REMINDER | 画面出现字幕 |
| 人物一致 | 全部通过 `reference_images` 传入同一张参考图 | 四段人物长相不同 |
| 硬切节奏 | 博主(5s) → 宠物B-roll(4s) → 博主(6s) | 全程正面口播无变化 |
| 口播连续 | 宠物画面时口播作为画外音继续 | 口播在硬切时中断 |
| 科普准确 | 避免传播错误养宠知识 | 给猫喂巧克力 |
| 竖版 9:16 | 全片统一竖版 | 横版画面 |

## 热门宠物科普话题参考

| 分类 | 话题示例 |
|------|---------|
| 猫咪行为 | 猫咪打呼噜的秘密、猫为什么揉面团、猫咪竖尾巴的含义 |
| 狗狗行为 | 狗狗歪头的原因、为什么狗狗喜欢转圈、狗狗摇尾巴的不同含义 |
| 养宠入门 | 新手养猫必备清单、小狗到家第一天怎么做、养仓鼠注意事项 |
| 宠物健康 | 宠物驱虫指南、猫咪绝育的好处、狗狗不能吃的 10 种食物 |
| 宠物趣味 | 动物界的冷知识、猫和狗谁更聪明、宠物的超能力 |

## 固定参数

所有视频生成任务必须使用以下参数：
- `model`：`ark/seedance-2.0`
- `model`（params 内）：`seedance_2.0_fast`
- `reference_images`：博主形象图 CDN URL 数组
- `ratio`：`9:16`
- `duration`：`15`
- `resolution`：`720p`
- `generate_audio`：`true`

## 错误处理

- **系统工具未启用**：提示用户在会话配置中启用系统工具（NEX AI）
- **余额不足**：提示充值
- **人脸审核被拒**：换下一张博主图重试
- **视频生成失败**：自动重试 1 次
- **ffmpeg 未安装**：提示用户安装 ffmpeg
