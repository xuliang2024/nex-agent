# OpenRouter LLM API 接入文档

## 概述

通过 NEX AI 平台调用 OpenRouter 聚合的主流大语言模型，完全兼容 OpenAI API 格式。支持 Chat Completions、Responses、Embeddings 三类接口，按实际用量动态计费。

**Base URL**

| 环境 | 地址 |
|------|------|
| 主域名 | `https://api.xskill.ai` |
| 备用域名 | `https://api.apiz.ai` |

## 认证

所有请求通过 `Authorization` Header 传递 API Key：

```
Authorization: Bearer sk-xxxxxxxxxxxx
```

API Key 在平台的 **API Key** 页面创建和管理。

---

## 可用模型

| 模型 ID | 厂商 | 说明 |
|---------|------|------|
| `anthropic/claude-opus-4.6-fast` | Anthropic | Claude Opus 4.6 快速版 |
| `anthropic/claude-sonnet-4.6` | Anthropic | Claude Sonnet 4.6 |
| `anthropic/claude-opus-4.6` | Anthropic | Claude Opus 4.6 |
| `deepseek/deepseek-v3.2-speciale` | DeepSeek | DeepSeek V3.2 特别版 |
| `deepseek/deepseek-v3.2` | DeepSeek | DeepSeek V3.2 |
| `google/gemini-3-flash-preview` | Google | Gemini 3 Flash 预览版 |
| `google/gemini-2.5-flash` | Google | Gemini 2.5 Flash |
| `google/gemini-3.1-pro-preview` | Google | Gemini 3.1 Pro 预览版 |
| `google/gemini-3.1-flash-lite-preview` | Google | Gemini 3.1 Flash Lite 预览版 |
| `openai/gpt-5.4` | OpenAI | GPT-5.4 |
| `openai/gpt-5.4-nano` | OpenAI | GPT-5.4 Nano |
| `openai/gpt-5.4-mini` | OpenAI | GPT-5.4 Mini |
| `minimax/minimax-m2.7` | MiniMax | MiniMax M2.7 |
| `z-ai/glm-5.1` | 智谱 | GLM-5.1 |
| `x-ai/grok-4.1-fast` | xAI | Grok 4.1 Fast |
| `qwen/qwen3.6-plus` | 阿里 | 通义千问 3.6 Plus |
| `z-ai/glm-4.5-air:free` | 智谱 | GLM-4.5 Air (免费) |
| `minimax/minimax-m2.5:free` | MiniMax | MiniMax M2.5 (免费) |

> 模型 ID 中带 `:free` 后缀的为免费模型，不消耗积分。

---

## 计费说明

- 按上游返回的实际 USD 成本动态计费，汇率 **1 USD = 400 积分**
- 支持小数积分扣费（精确到 4 位小数）
- 最低扣费 0.01 积分
- 免费模型（`:free` 后缀）不扣费

---

## 接口列表

### 1. 获取模型列表

**GET** `/v3/models`

返回当前可用的 OpenRouter 模型列表。

**请求示例**

```bash
curl https://api.xskill.ai/v3/models \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx"
```

**响应示例**

```json
{
  "object": "list",
  "data": [
    {"id": "google/gemini-2.5-flash", "object": "model", "owned_by": "google"},
    {"id": "openai/gpt-5.4", "object": "model", "owned_by": "openai"}
  ]
}
```

---

### 2. Chat Completions

**POST** `/v3/chat/completions`

与 OpenAI Chat Completions API 完全兼容，支持流式和非流式。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID，如 `google/gemini-2.5-flash` |
| messages | array | 是 | 消息列表，格式同 OpenAI |
| stream | boolean | 否 | 是否流式返回，默认 `false` |
| temperature | number | 否 | 采样温度 |
| max_tokens | number | 否 | 最大生成 token 数 |
| top_p | number | 否 | nucleus 采样 |

`messages` 数组中每个元素：

| 字段 | 类型 | 说明 |
|------|------|------|
| role | string | `system` / `user` / `assistant` |
| content | string 或 array | 文本内容，或多模态内容数组（支持 image_url / video_url） |

#### 非流式请求

```bash
curl https://api.xskill.ai/v3/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ]
  }'
```

**响应**

```json
{
  "id": "gen-xxxx",
  "object": "chat.completion",
  "model": "google/gemini-2.5-flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是一个 AI 助手..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 25,
    "total_tokens": 35,
    "cost": 0.0000231
  }
}
```

#### 流式请求

```bash
curl https://api.xskill.ai/v3/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "从 1 数到 5"}
    ],
    "stream": true
  }'
```

**响应** (SSE 格式)

```
data: {"id":"gen-xxxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"1"},"index":0}]}

data: {"id":"gen-xxxx","object":"chat.completion.chunk","choices":[{"delta":{"content":","}}]}

data: {"id":"gen-xxxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" 2, 3, 4, 5"}}]}

data: {"id":"gen-xxxx","object":"chat.completion.chunk","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":7,"completion_tokens":13,"total_tokens":20,"cost":0.0000346}}

data: [DONE]
```

> 流式模式下 `usage` 和 `cost` 在最后一个 chunk 中返回。

#### 多模态输入（图片）

```bash
curl https://api.xskill.ai/v3/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "描述这张图片"},
          {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
        ]
      }
    ]
  }'
```

---

### 3. Responses API

**POST** `/v1/responses`

OpenAI Responses API 格式，更简洁的对话接口。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | 模型 ID |
| input | string | 是 | 用户输入文本 |
| instructions | string | 否 | 系统指令 |
| stream | boolean | 否 | 是否流式返回 |

#### 请求示例

```bash
curl https://api.xskill.ai/v1/responses \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemini-2.5-flash",
    "input": "法国的首都是哪里？"
  }'
```

**响应示例**

```json
{
  "id": "gen-xxxx",
  "object": "response",
  "model": "google/gemini-2.5-flash",
  "status": "completed",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "法国的首都是巴黎。"
        }
      ]
    }
  ],
  "usage": {
    "total_tokens": 15,
    "cost": 0.0000221
  }
}
```

---

### 4. Embeddings

**POST** `/v1/embeddings`

文本向量化接口，用于语义搜索、文本相似度计算等场景。

> 需要使用支持 Embeddings 的模型，如 `openai/text-embedding-3-small`。列表中的对话模型不支持此接口。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | Embedding 模型 ID |
| input | string 或 array | 是 | 待向量化的文本，或文本数组 |
| encoding_format | string | 否 | 返回格式：`float`（默认）或 `base64` |

#### 请求示例

```bash
curl https://api.xskill.ai/v1/embeddings \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/text-embedding-3-small",
    "input": "Hello world"
  }'
```

**响应示例**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.0023, -0.0091, 0.0153, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 2,
    "total_tokens": 2,
    "cost": 0
  }
}
```

---

## 错误处理

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误或模型不支持该操作 |
| 401 | API Key 无效或未提供 |
| 402 | 余额不足 |
| 404 | 模型不存在 |
| 502 | 上游服务不可用 |
| 503 | 服务暂时不可用 |

**错误响应格式**

```json
{
  "error": {
    "message": "错误描述",
    "type": "error_type",
    "code": 400
  }
}
```

---

## OpenAI SDK 接入

由于接口完全兼容 OpenAI 格式，可直接使用 OpenAI 官方 SDK。

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-xxxxxxxxxxxx",
    base_url="https://api.xskill.ai/v3"
)

response = client.chat.completions.create(
    model="google/gemini-2.5-flash",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)
```

**流式调用**

```python
stream = client.chat.completions.create(
    model="google/gemini-2.5-flash",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Node.js

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "sk-xxxxxxxxxxxx",
  baseURL: "https://api.xskill.ai/v3",
});

const response = await client.chat.completions.create({
  model: "google/gemini-2.5-flash",
  messages: [{ role: "user", content: "你好" }],
});
console.log(response.choices[0].message.content);
```

### cURL

```bash
curl https://api.xskill.ai/v3/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-2.5-flash","messages":[{"role":"user","content":"你好"}]}'
```

---

*最后更新: 2026-04-16*
