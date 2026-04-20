---
name: xskill-ai
description: 通过 xskill.ai MCP 服务生成 AI 图片、视频、语音，解析视频链接，管理账户。支持 MCP 调用和 Python 脚本两种模式。当用户需要画图、生成图片、生成视频、语音合成、配音、TTS、解析视频、下载视频、查看模型、查余额，或提到 xskill、NEX AI、速推 时使用此 skill。
---

# xskill.ai — AI 生成一站式服务

通过 MCP 或 Python 脚本调用 xskill.ai 平台，支持图片生成、视频生成、语音合成、视频解析等能力。

## MCP 服务信息

- **服务标识**: `user-xskill-ai`
- **调用方式**: 使用 `CallMcpTool` 工具
- **8 个工具**: `generate`, `get_result`, `search_models`, `guide`, `account`, `speak`, `parse_video`, `transfer_url`

## 方式一：MCP 调用（推荐）

### 快速开始

**生成图片**（最简调用，只需 model + prompt）：

```json
{
  "server": "user-xskill-ai",
  "toolName": "generate",
  "arguments": {
    "model": "fal-ai/flux-2/flash",
    "prompt": "a cat sitting on a rainbow"
  }
}
```

返回 `task_id` 后，用 `get_result` 轮询：

```json
{
  "server": "user-xskill-ai",
  "toolName": "get_result",
  "arguments": {
    "task_id": "返回的 task_id"
  }
}
```

轮询间隔 5-10 秒，直到 status 为 `completed`（结果在 result 字段）或 `failed`。

**生成视频**（图生视频，加 image_url）：

```json
{
  "server": "user-xskill-ai",
  "toolName": "generate",
  "arguments": {
    "model": "wan/v2.6/image-to-video",
    "prompt": "camera slowly zooms in",
    "image_url": "https://example.com/photo.jpg"
  }
}
```

**语音合成**：

```json
{
  "server": "user-xskill-ai",
  "toolName": "speak",
  "arguments": {
    "action": "synthesize",
    "text": "你好，欢迎使用 xskill",
    "voice_id": "male-qn-qingse"
  }
}
```

**解析视频链接**（免费）：

```json
{
  "server": "user-xskill-ai",
  "toolName": "parse_video",
  "arguments": {
    "url": "https://v.douyin.com/xxxxx"
  }
}
```

### 完整工作流

不确定用哪个模型时，按以下流程操作：

#### Step 1: 搜索模型

```json
{
  "server": "user-xskill-ai",
  "toolName": "search_models",
  "arguments": {
    "category": "image"
  }
}
```

支持参数：
- `query` -- 自由文本搜索（如 "fast image"）
- `category` -- 类别筛选：`image` / `video` / `audio` / `all`
- `capability` -- 能力筛选：`t2i`(文生图) `i2i`(图生图) `t2v`(文生视频) `i2v`(图生视频) `v2v`(视频转视频) `t2a`(语音合成) `stt`(语音转文字) `i2t`(图片理解) `v2t`(视频理解)
- `model_id` -- 传入精确 ID，返回该模型的完整参数 Schema

#### Step 2: 查看教程（可选）

```json
{
  "server": "user-xskill-ai",
  "toolName": "guide",
  "arguments": {
    "skill_id": "sora-2"
  }
}
```

也可搜索：`{"query": "视频生成"}` 或按类别：`{"category": "video"}`

常用 skill_id：`sora-2`, `flux2-flash`, `seedream-image`, `wan-video`, `minimax-audio`, `nano-banana-pro`

#### Step 3: 生成

```json
{
  "server": "user-xskill-ai",
  "toolName": "generate",
  "arguments": {
    "model": "模型ID",
    "prompt": "描述文本",
    "image_url": "图片URL（图生图/图生视频时）",
    "image_size": "图片尺寸（图像模型用，如 square_hd, landscape_16_9）",
    "aspect_ratio": "宽高比（视频模型用，如 16:9, 9:16）",
    "duration": "视频时长秒数（如 5, 10）",
    "options": {}
  }
}
```

80% 场景只需 `model` + `prompt`。参数填错时会返回正确 Schema，可据此修正重试。

#### Step 4: 获取结果

```json
{
  "server": "user-xskill-ai",
  "toolName": "get_result",
  "arguments": {
    "task_id": "任务ID"
  }
}
```

不传 task_id 则返回最近任务列表（可加 `status` 和 `limit` 筛选）。

### 其他工具

**账户管理**：

```json
// 查余额
{"server": "user-xskill-ai", "toolName": "account", "arguments": {"action": "balance"}}

// 每日签到
{"server": "user-xskill-ai", "toolName": "account", "arguments": {"action": "checkin"}}

// 查看充值套餐
{"server": "user-xskill-ai", "toolName": "account", "arguments": {"action": "packages"}}

// 生成支付链接
{"server": "user-xskill-ai", "toolName": "account", "arguments": {"action": "pay", "package_id": 1}}
```

**语音合成完整功能**：

```json
// 获取音色列表
{"server": "user-xskill-ai", "toolName": "speak", "arguments": {"action": "list_voices"}}

// 用自然语言设计音色
{"server": "user-xskill-ai", "toolName": "speak", "arguments": {"action": "design_voice", "prompt": "温柔的女性声音"}}

// 从音频克隆音色
{"server": "user-xskill-ai", "toolName": "speak", "arguments": {"action": "clone_voice", "audio_url": "https://..."}}

// 合成语音（可选 model: speech-2.8-hd/turbo, speed: 0.5-2.0）
{"server": "user-xskill-ai", "toolName": "speak", "arguments": {"action": "synthesize", "text": "文本", "voice_id": "xxx"}}
```

**转存 URL 到 CDN**（免费）：

```json
{"server": "user-xskill-ai", "toolName": "transfer_url", "arguments": {"url": "https://外部图片或音频URL", "type": "image"}}
```

type 可选：`image`（默认）、`audio`

## 方式二：Python 脚本

脚本路径：`.cursor/skills/xskill-ai/scripts/xskill_api.py`

首次使用会提示输入 API Key（sk- 开头），自动保存到 `~/.zshrc`。获取地址：https://www.xskill.ai/#/v2/api-keys

### 常用命令

```bash
# 查看所有模型
python .cursor/skills/xskill-ai/scripts/xskill_api.py list

# 按类别筛选
python .cursor/skills/xskill-ai/scripts/xskill_api.py list --category video

# 查看模型详情和参数 Schema
python .cursor/skills/xskill-ai/scripts/xskill_api.py info st-ai/super-seed2

# 提交任务
python .cursor/skills/xskill-ai/scripts/xskill_api.py submit st-ai/super-seed2 \
  --params '{"prompt":"一位穿红裙的女孩在花田中跳舞","duration":5}'

# 查询任务
python .cursor/skills/xskill-ai/scripts/xskill_api.py query <task_id>

# 提交并等待完成（推荐）
python .cursor/skills/xskill-ai/scripts/xskill_api.py run fal-ai/flux-2/flash \
  --params '{"prompt":"a cat on rainbow","image_size":"landscape_16_9"}'

# 查看公共音色列表
python .cursor/skills/xskill-ai/scripts/xskill_api.py voices

# 筛选女声
python .cursor/skills/xskill-ai/scripts/xskill_api.py voices --tag 女

# 输出完整 JSON
python .cursor/skills/xskill-ai/scripts/xskill_api.py voices --json
```

## 热门模型速查

| 场景 | 推荐模型 | model ID |
|------|---------|----------|
| 快速文生图 | Flux 2 Flash | `fal-ai/flux-2/flash` |
| 中文文字图 | Seedream 4.5 | `fal-ai/bytedance/seedream/v4.5/text-to-image` |
| 同步即梦图 | 即梦 4.5 | `jimeng-4.5` |
| 全能视频 | Seedance 2.0 | `st-ai/super-seed2` |
| 图生视频 | Kling O3 Pro | `fal-ai/kling-video/o3/pro/image-to-video` |
| 图生视频 | Wan 2.6 | `wan/v2.6/image-to-video` |
| 语音合成 | Minimax TTS | 通过 `speak` 工具 |

## 注意事项

1. **异步任务**: `generate` 返回 task_id，需用 `get_result` 轮询（间隔 5-10 秒，通常 30-120 秒完成）
2. **图片 URL**: 图生图/图生视频需要公开可访问的 URL；本地图片可用 `transfer_url` 转存到 CDN
3. **参数容错**: `generate` 参数填错会返回正确 Schema，可据此修正重试
4. **余额不足**: 用 `account` 查余额，引导用户到 https://www.xskill.ai/#/v2/recharge 充值
5. **免费工具**: `parse_video` 和 `transfer_url` 免费使用，无需消耗积分
