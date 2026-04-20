---
name: image-translate
description: 保持图片内容和布局不变，将推广图上的文字翻译为中/英/日/泰等多语言版本。当用户提到「图片翻译」「多语言图片」「翻译推广图」「image translate」时使用此 skill。
---

# 图片多语言翻译

将带有文字推广的图片翻译为多种语言版本，保持图片内容、布局和设计风格不变，仅替换文字为目标语言。

## 设计理念

- **布局保真**：保持原图的构图、颜色、产品位置完全不变
- **文字替换**：仅将原文翻译为目标语言，保持字体风格和排版位置一致
- **多语言输出**：一次输入，同时输出中/英/日/泰四个语言版本
- **营销适配**：翻译时考虑目标市场的表达习惯，不是直译而是意译营销文案

## 前置条件

1. **会话已启用系统工具（NEX AI）**，以下工具可用：`generate`、`get_result`
2. **Agent 内置工具** `uploadFile` 可用于上传本地图片到 CDN

## 工作流总览

```
用户提供带文字的推广图片
  → ① 上传图片到 CDN
  → ② 识别图中所有文字内容及其位置
  → ③ 翻译文案为四种语言（营销意译）
  → ④ 并行生成四个语言版本图片
  → ⑤ 输出全部结果
```

---

## Step 1：引导用户输入 & 上传图片

### 引导话术

如果用户未提供图片：

> 请发送需要翻译的推广图片，我将保持图片内容和布局不变，自动将文字翻译为中文、英文、日文、泰文四个版本。
>
> 支持：产品宣传图、海报、Banner、社交媒体图、电商详情图等。

### 图片上传

使用内置 `uploadFile` 工具上传到 CDN：

```
uploadFile({ path: "用户提供的本地图片路径" })
→ { publicUrl: "https://cdn-video.51sux.com/..." }
```

保存 URL 到 `source_image`。

---

## Step 2：识别图中文字

仔细分析原图，识别并列出所有文字内容：

```
### 🔍 原图文字识别

| 序号 | 原文 | 位置描述 | 字体风格 |
|------|------|---------|---------|
| 1 | [主标题文字] | 顶部居中 | 大号粗体 |
| 2 | [副标题文字] | 主标题下方 | 中号 |
| 3 | [按钮/标语] | 底部左侧 | 小号 |
| ... | ... | ... | ... |
```

如果图中文字模糊或不确定，主动询问用户确认。

---

## Step 3：翻译文案（营销意译）

将识别出的文字翻译为四种目标语言。**注意是营销意译，不是直译**——需要符合目标市场的表达习惯和文化语境。

| 序号 | 原文 | 中文 | English | 日本語 | ภาษาไทย |
|------|------|------|---------|-------|---------|
| 1 | [原文] | [翻译] | [翻译] | [翻译] | [翻译] |
| 2 | [原文] | [翻译] | [翻译] | [翻译] | [翻译] |
| ... | ... | ... | ... | ... | ... |

展示翻译结果供用户确认后再生成图片。

---

## Step 4：并行生成四个语言版本

使用 Seedream v5 Lite Edit 的编辑模式，通过 `Figure 1` 引用原图，指示替换文字。

**四个语言版本并行提交**：

### 提示词模板

```
Keep the exact same image content, layout, composition, colors, product placement and design of Figure 1 completely unchanged. Only replace the text in the image:

[逐条列出文字替换指令]
- Replace "[原文1]" at [位置] with "[目标语言翻译1]" in the same font style and size
- Replace "[原文2]" at [位置] with "[目标语言翻译2]" in the same font style and size
- ...

Keep all other visual elements exactly the same. The translated text should match the original font style, weight, color and position. Do not change any non-text elements.
```

### 生成调用（4 次并行调用 `generate` 工具）

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "（中文版提示词）",
  "image_url": "source_image",
  "image_size": "auto_2K",
  "options": {
    "enable_safety_checker": false
  }
}
```

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "（English 版提示词）",
  "image_url": "source_image",
  "image_size": "auto_2K",
  "options": {
    "enable_safety_checker": false
  }
}
```

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "（日本語版提示词）",
  "image_url": "source_image",
  "image_size": "auto_2K",
  "options": {
    "enable_safety_checker": false
  }
}
```

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "（ภาษาไทย 版提示词）",
  "image_url": "source_image",
  "image_size": "auto_2K",
  "options": {
    "enable_safety_checker": false
  }
}
```

**轮询策略**：每 5-10 秒调用 `get_result`。

---

## Step 5：输出结果

### 展示格式

```
## 🌍 图片多语言翻译完成

### 原图
![原图](source_image_url)

---

### 🇨🇳 中文版
![中文版](url_zh)

### 🇺🇸 English
![English](url_en)

### 🇯🇵 日本語
![日本語](url_ja)

### 🇹🇭 ภาษาไทย
![ภาษาไทย](url_th)

---

📊 模型：Seedream v5 Lite Edit
💡 如需调整翻译或重新生成某个语言版本，请告诉我！
```

### 下载到本地

```bash
mkdir -p output/image-translate
curl -L -o output/image-translate/zh.png "url_zh"
curl -L -o output/image-translate/en.png "url_en"
curl -L -o output/image-translate/ja.png "url_ja"
curl -L -o output/image-translate/th.png "url_th"
```

---

## 翻译原则

| 原则 | 说明 |
|------|------|
| **营销意译** | 不直译，根据目标市场习惯调整措辞 |
| **长度适配** | 翻译后文字长度应与原文相近，避免溢出 |
| **文化适配** | 避免文化禁忌（如泰国避免使用某些颜色/符号的隐喻） |
| **品牌音调** | 保持品牌的整体语气风格一致 |

## 支持的语言

默认输出四种语言，用户可指定需要的语言子集：
- 🇨🇳 中文（简体）
- 🇺🇸 English
- 🇯🇵 日本語
- 🇹🇭 ภาษาไทย

可按需扩展：🇰🇷 한국어、🇻🇳 Tiếng Việt、🇮🇩 Bahasa Indonesia、🇪🇸 Español 等。

## 错误处理

- **系统工具未启用**：提示用户在会话配置中启用系统工具（NEX AI）
- **余额不足**：提示充值
- **文字识别不准**：让用户确认或手动提供原文内容
- **翻译后文字未替换干净**：在提示词中更精确描述文字位置和内容，重新生成
- **字体风格不匹配**：在提示词中增加字体描述细节（如 `bold serif font`, `thin sans-serif`）
- **布局变形**：强调 `keep the exact same layout, do not change any visual elements except the text`
