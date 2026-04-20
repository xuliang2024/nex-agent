---
name: Nano Banana 2 图像生成
description: 使用 Nano Banana 2 模型生成或编辑图像。当用户想要文生图、图像编辑，或提到 nano banana 2、Gemini 3.1 Flash Image 时使用此 skill。
category: image
tags: [图像生成, 文生图, 图像编辑, Google, Nano Banana 2, Gemini Flash]
featured: false
---

# Nano Banana 2 图像生成

Google Gemini 3.1 Flash Image 架构，比 Nano Banana Pro 快 4 倍、成本更低的高质量图像生成和编辑模型。支持文字渲染、角色一致性（最多 5 人）、网页搜索辅助生成。

## 可用模型

| 模型 ID | 功能 | 说明 |
|--------|------|------|
| `fal-ai/nano-banana-2` | 文生图/图像编辑 | 无图片时为文生图，提供图片时自动切换为编辑模式 |

**积分消耗**：
| 分辨率 | 积分/张 |
|--------|---------|
| 0.5K | 24 |
| 1K（默认） | 32 |
| 2K | 48 |
| 4K | 64 |

启用网页搜索额外 +6 积分/张。按 `num_images` 数量倍乘。

## 工作流

### 1. 调用 submit_task

使用 MCP 工具 `submit_task` 提交任务：

**文生图示例**：

```json
{
  "model_id": "fal-ai/nano-banana-2",
  "parameters": {
    "prompt": "An action shot of a black lab swimming in a pool, camera at water line, half above and half below water",
    "aspect_ratio": "16:9",
    "resolution": "1K"
  }
}
```

**图像编辑示例**（提供 image_urls 自动切换为编辑模式）：

```json
{
  "model_id": "fal-ai/nano-banana-2",
  "parameters": {
    "prompt": "make a photo of the man driving the car down the california coastline",
    "image_urls": ["https://example.com/person.png", "https://example.com/car.png"],
    "resolution": "2K"
  }
}
```

### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|-----|------|-----|-------|------|
| prompt | string | **是** | - | 图像生成/编辑提示词 |
| image_urls | array | 否 | - | 输入图片 URL 列表，最多 14 张。提供时自动切换为编辑模式 |
| num_images | integer | 否 | 1 | 生成图像数量（1-4） |
| aspect_ratio | string | 否 | auto | 宽高比：auto/21:9/16:9/3:2/4:3/5:4/1:1/4:5/3:4/2:3/9:16 |
| resolution | string | 否 | 1K | 分辨率：0.5K/1K/2K/4K（影响价格） |
| output_format | string | 否 | png | 输出格式：jpeg/png/webp |
| seed | integer | 否 | - | 随机种子，用于复现结果 |
| enable_web_search | boolean | 否 | false | 启用网页搜索辅助生成（额外收费） |
| safety_tolerance | string | 否 | 4 | 安全审核级别，1 最严格，6 最宽松 |
| limit_generations | boolean | 否 | true | 限制每轮只生成一张图片 |

## 查询任务状态

提交任务后会返回 `task_id`，使用 `get_task` 查询结果：

```json
{
  "task_id": "返回的任务ID"
}
```

任务状态：
- `pending` - 排队中
- `processing` - 处理中
- `completed` - 完成，结果在 `result` 中
- `failed` - 失败，查看 `error` 字段

## 与 Nano Banana Pro 的区别

| 对比 | Nano Banana Pro | Nano Banana 2 |
|------|----------------|---------------|
| 架构 | Gemini 3 Pro Image | Gemini 3.1 Flash Image |
| 速度 | 较慢 | **4x 更快** |
| 价格 | 60 积分/张（固定） | **32 积分/张**（1K，按分辨率浮动） |
| 额外分辨率 | - | 支持 0.5K (24积分) |
| 推荐场景 | 最高质量、复杂构图 | 快速迭代、批量生产 |

## 提示词技巧

1. 支持自然语言描述，无需掌握提示词工程语法
2. 文字渲染准确，可直接在图片中生成文字
3. 角色一致性：同一提示词中最多保持 5 个人物的身份一致
4. 启用 `enable_web_search` 可让模型参考最新网络信息生成图片
