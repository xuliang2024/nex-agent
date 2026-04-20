---
name: podcast-dialogue
description: 设计多人播客对话脚本，使用 Gemini 3.1 Flash TTS 多说话人语音合成。当用户提到「播客」「对话合成」「多人对话」「podcast」「语音对话」时使用此 skill。
---

# 播客对话合成

设计多人播客对话脚本，使用 Gemini 3.1 Flash TTS 的多说话人合成能力，生成自然流畅的播客音频。

## 模型信息

- **模型 ID**：`fal-ai/gemini-3.1-flash-tts`
- **能力**：多说话人合成、情感标签、风格控制
- **费用**：10 积分/次
- **输出格式**：mp3（推荐）/ wav / ogg_opus

## 可用音色（30 种预设）

### 推荐搭配

| 角色定位 | 推荐音色 | 风格描述 |
|----------|---------|---------|
| 沉稳女主播 | **Kore** | 成熟稳重，适合主持 |
| 温暖女嘉宾 | **Aoede** | 温暖亲切，有感染力 |
| 清亮女性 | **Zephyr** | 清新明亮 |
| 活泼男嘉宾 | **Puck** | 活泼有趣，适合轻松话题 |
| 专业男主播 | **Charon** | 专业沉稳，适合深度话题 |
| 温柔男性 | **Orus** | 温和从容 |

### 全部音色列表

女声：Kore, Aoede, Zephyr, Leda, Fenrir, Achelois, Callirhoe, Autonoe, Iambe, Elara, Despina
男声：Puck, Charon, Orus, Vale, Pegasus, Perseus, Tethys, Enceladus, Proteus, Umbriel, Altair, Cepheus

## 表情音频标签

在对话文本中可嵌入以下标签，增加语音自然度：

| 标签 | 效果 | 使用场景 |
|------|------|---------|
| `[laughing]` | 笑声 | 开心、幽默时 |
| `[sigh]` | 叹气 | 感慨、无奈时 |
| `[whispering]` | 耳语 | 强调秘密、悄悄话 |
| `[short pause]` | 短暂停顿 | 思考、话题转换 |

## 前置条件

1. **会话已启用系统工具（NEX AI）**，以下工具可用：`generate`、`get_result`

---

## 工作流总览

```
用户提供播客主题/大纲
  → ① 确认话题、角色、时长
  → ② 设计角色和音色搭配
  → ③ 撰写多人对话脚本（含表情标签）
  → ④ 多说话人语音合成
  → ⑤ 输出音频 + 文稿
```

---

## Step 1：引导确认播客设定

### 引导话术

如果用户未提供详细信息：

> 我来帮你制作一段播客对话！请告诉我：
>
> 1. **话题**：聊什么内容？（如「AI 对设计行业的影响」「健身新手入门指南」）
> 2. **人数**：几个人对话？（推荐 2-3 人）
> 3. **风格**：轻松闲聊 / 深度访谈 / 知识科普 / 辩论？
> 4. **时长**：大约几分钟？（每分钟约 150-200 字）

### 默认设定（用户未指定时）

- 2 人对话（1 主播 + 1 嘉宾）
- 轻松闲聊风格
- 约 2-3 分钟（400-600 字）

---

## Step 2：设计角色和音色

根据话题和风格选择角色和音色搭配。

**示例——科技话题双人播客**：

| 角色 | speaker_id | 音色 | 定位 |
|------|-----------|------|------|
| 小雪 | Xiaoxue | Kore | 主播，引导话题，提问 |
| 阿明 | Aming | Puck | 嘉宾，分享见解，活泼 |

**示例——三人知识科普**：

| 角色 | speaker_id | 音色 | 定位 |
|------|-----------|------|------|
| 主持人 | Host | Charon | 开场、串场、总结 |
| 专家 | Expert | Kore | 提供专业知识 |
| 听众代表 | Audience | Puck | 提出普通人的疑问 |

---

## Step 3：撰写对话脚本

### 脚本格式

每行以 `speaker_id:` 开头，对应 Step 2 中定义的角色：

```
Xiaoxue: 大家好，欢迎收听今天的节目！[short pause] 今天我们要聊一个超级有趣的话题。
Aming: [laughing] 是啊，我已经迫不及待了！
Xiaoxue: 好，那我们今天要聊的是……
```

### 脚本撰写规则

| 规则 | 说明 |
|------|------|
| **自然口语** | 使用口语化表达，避免书面语 |
| **互动感** | 角色之间要有自然的回应、追问、插话 |
| **节奏控制** | 适当使用 `[short pause]` 控制节奏 |
| **情感表达** | 在合适位置使用表情标签（`[laughing]`、`[sigh]` 等） |
| **开场结尾** | 包含自然的开场白和结尾总结 |
| **每段长度** | 每人每次发言 20-60 字，避免长篇独白 |

### 对话结构模板

| 段落 | 内容 | 比例 |
|------|------|------|
| 开场 | 问候、引入话题 | ~10% |
| 展开 | 核心讨论 2-3 个子话题 | ~70% |
| 高潮 | 最有趣/最有价值的观点 | ~10% |
| 收尾 | 总结、互动引导 | ~10% |

---

## Step 4：多说话人语音合成

### 合成调用

将完整对话脚本一次性提交，使用 `speakers` 参数配置多说话人。调用 `generate` 工具：

```json
{
  "model": "fal-ai/gemini-3.1-flash-tts",
  "prompt": "Xiaoxue: 大家好，欢迎收听今天的节目！[short pause] 今天我们要聊一个超级有趣的话题。\nAming: [laughing] 是啊，我已经迫不及待了！\nXiaoxue: 好，那我们今天要聊的是……",
  "options": {
    "speakers": [
      {"speaker_id": "Xiaoxue", "voice": "Kore"},
      {"speaker_id": "Aming", "voice": "Puck"}
    ],
    "style_instructions": "Natural conversational podcast style, relaxed and engaging pace, like two friends chatting",
    "output_format": "mp3",
    "temperature": 1
  }
}
```

### 关键参数说明

| 参数 | 说明 |
|------|------|
| `prompt` | 完整对话脚本，每行 `speaker_id: 对话内容` |
| `speakers` | 说话人配置数组，`speaker_id` 对应 prompt 中的角色名前缀 |
| `style_instructions` | 全局风格控制，影响所有说话人的整体风格 |
| `output_format` | 推荐 `mp3`，文件小 |
| `temperature` | 默认 1，越高越有变化 |

### 长对话分段策略

如果对话较长（超过 2000 字），建议分段合成：

1. 按自然话题转换点分为 2-3 段
2. 每段独立调用 `generate`（并行）
3. 使用 ffmpeg 拼接：

```bash
ffmpeg -y -f concat -safe 0 -i list.txt -c copy output/podcast-final.mp3
```

**轮询策略**：语音合成通常较快，每 **5-10 秒** 调用 `get_result`。

---

## Step 5：输出结果

### 展示格式

```
## 🎙️ 播客对话合成完成！

**话题**：[话题名称]
**时长**：约 X 分钟
**角色**：[角色列表和音色]

### 🔊 音频
[点击收听](音频URL)

### 📝 完整文稿

**小雪**：大家好，欢迎收听今天的节目！今天我们要聊一个超级有趣的话题。

**阿明**：是啊，我已经迫不及待了！

（完整对话文稿...）

---

📊 模型：Gemini 3.1 Flash TTS | 10 积分/次
💡 如需调整对话内容或音色，请告诉我！
```

### 下载到本地

```bash
mkdir -p output/podcast
curl -L -o output/podcast/dialogue.mp3 "音频URL"
```

---

## 风格参考

| 播客风格 | style_instructions 建议 |
|----------|----------------------|
| 轻松闲聊 | `Natural conversational podcast, relaxed pace, like friends chatting over coffee` |
| 深度访谈 | `Professional interview style, thoughtful pauses, clear articulation, intellectual tone` |
| 知识科普 | `Educational podcast, enthusiastic and clear, making complex topics accessible` |
| 新闻播报 | `News broadcast style, authoritative and clear, professional delivery` |
| 故事叙述 | `Storytelling podcast, dramatic pacing, emotional range, captivating narration` |

## 错误处理

- **系统工具未启用**：提示用户在会话配置中启用系统工具（NEX AI）
- **余额不足**：提示充值
- **文本过长**：分段合成后用 ffmpeg 拼接
- **音色不满意**：更换音色后重新合成
- **语速问题**：调整 `style_instructions` 中的节奏描述（如 `slower pace` / `faster delivery`）
