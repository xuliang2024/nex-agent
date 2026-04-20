---
name: product-promo-design
description: 基于用户提供的产品照片，先提取干净的多角度产品图，再用 Seedream v5 Lite Edit 生成高级营销构图宣传图。当用户提到「产品宣传图」「高端产品图」「营销图」「产品多角度」「product promo」时使用此 skill。
---

# 高端产品宣传图设计

基于用户提供的产品照片，**两阶段**生成高端宣传图：先提取干净的多角度产品特写，再基于干净图生成营销构图。

## 设计理念

- **两阶段策略**：先提取 → 再构图，确保生成稳定可控
- **产品一致性优先**：所有宣传图均基于提取后的干净产品图编辑
- **高级构图**：商业摄影构图法则（黄金比例、引导线、负空间等）
- **模型选择**：使用 Seedream v5 Lite Edit（`fal-ai/bytedance/seedream/v5/lite/edit`），支持多图引用（Figure 1/2/3 语法）

## 前置条件

1. **会话已启用系统工具（NEX AI）**，以下工具可用：`generate`、`get_result`
2. **Agent 内置工具** `uploadFile` 可用于上传本地图片到 CDN

## 工作流总览

```
用户提供产品照片（1-N 张，可能有文字/杂乱背景）
  → ① 上传图片到 CDN
  → ② 第一阶段：提取干净产品图（去文字/去背景/白底/多角度）
  → ③ 第二阶段：基于干净图生成高级营销构图
  → ④ 输出全部结果图
```

---

## Step 1：引导用户输入 & 上传图片

### 引导话术

如果用户未提供产品图片：

> 请提供您的产品照片（支持多张），我将为您设计高端宣传图。
>
> 直接发送图片即可，不需要预处理——我会自动去除文字、水印、杂乱背景，提取干净的产品特写。

### 图片上传

使用内置 `uploadFile` 工具上传到 CDN：

```
uploadFile({ path: "用户提供的本地图片路径" })
→ { publicUrl: "https://cdn-video.51sux.com/..." }
```

如果已是网络 URL，直接使用。保存所有 URL 到 `raw_images` 列表。

---

## Step 2：第一阶段 — 提取干净产品多角度图

目标：从用户提供的原始照片中，提取出**去除文字/水印、纯白背景、干净**的产品多角度图片。

对每张原始图片，**并行**提交以下 3-4 个提取任务：

所有调用都使用 `generate` 工具，参数如下：

### 2a. 正面白底主图

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "Remove all text, watermarks, logos, captions and background from Figure 1. Place the exact product on a pure white background, front-facing view, centered, clean product-only shot, professional product photography lighting, no text anywhere in the image",
  "image_url": "raw_images[0]",
  "image_size": "square_hd",
  "options": {
    "enable_safety_checker": false
  }
}
```

### 2b. 45° 左侧视角白底图

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "Remove all text, watermarks, logos and background from Figure 1. Show the exact product from a 45-degree left angle on pure white background, revealing the side profile and depth, clean isolated product shot, studio lighting, no text",
  "image_url": "raw_images[0]",
  "image_size": "square_hd",
  "options": {
    "enable_safety_checker": false
  }
}
```

### 2c. 45° 右侧视角白底图

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "Remove all text, watermarks, logos and background from Figure 1. Show the exact product from a 45-degree right angle on pure white background, clean isolated product shot, studio lighting, preserve all product details accurately, no text",
  "image_url": "raw_images[0]",
  "image_size": "square_hd",
  "options": {
    "enable_safety_checker": false
  }
}
```

### 2d. 俯视角度白底图（可选）

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "Remove all text, watermarks, logos and background from Figure 1. Show the exact product from a slight overhead top-down perspective on pure white background, clean isolated product shot, soft even lighting, no text",
  "image_url": "raw_images[0]",
  "image_size": "square_hd",
  "options": {
    "enable_safety_checker": false
  }
}
```

**轮询策略**：每 5-10 秒调用 `get_result`。

**多原图处理**：如果用户提供了多张照片，对每张都执行提取。最终选择质量最好的一组作为 `clean_images` 列表。

### 展示提取结果

先用 Markdown 展示提取后的干净图片，让用户确认产品外观正确：

```
### 📸 提取结果 — 干净产品图

**正面**
![正面](url)

**左侧 45°**
![左侧](url)

**右侧 45°**
![右侧](url)

这些图片将作为宣传图的基础素材，确认无误后我继续生成营销构图。
```

---

## Step 3：第二阶段 — 基于干净图生成高级营销构图

使用 Step 2 提取的 `clean_images` 作为 `image_url`，确保产品一致性。

### 3a. 产品分析

基于干净图和用户信息确认：
- **产品类型**（手表、香水、运动鞋等）
- **材质特征**（金属、皮革、玻璃等）
- **主色调**
- **目标调性**（奢华/科技/自然/极简/运动）

### 3b. 设计中文推广文案

根据产品分析，为每种构图设计**中文推广文案**，用于渲染在图片上。

**文案设计原则**：
- **主标题**：4-8 个字，传达核心卖点（如「匠心臻选」「科技之美」「自然本真」）
- **副标题**：8-15 个字，补充说明（如「瑞士机芯·百年传承」「轻奢质感·触手可及」）
- **文案位置**：根据构图类型合理排布，不遮挡产品主体

**各构图的文案排布建议**：

| 构图类型 | 文案位置 | 字体风格 |
|----------|---------|---------|
| 奢华光影 | 画面上方或底部，居中 | 金色衬线体，优雅大气 |
| 自然场景 | 画面左侧或右侧留白区域 | 白色/深棕手写体，自然温暖 |
| 科技悬浮 | 产品旁侧，沿光效方向 | 白色/浅蓝无衬线体，科技感 |
| 极简留白 | 大面积留白区域内 | 黑色/深灰极细体，克制高级 |
| 材质对比 | 画面底部横排 | 白色衬线体，沉稳质感 |
| Flatlay | 画面顶部或底部边缘 | 黑色手写体，时尚感 |

### 3c. 构图模板库

根据产品类型选择最合适的 3-4 种。**所有提示词通过 `image_url` 传入干净产品图，提示词中包含中文文案渲染指令**：

#### A. 奢华光影（适合：手表、珠宝、香水）

```
Place the product from Figure 1 in a luxurious setting with dramatic chiaroscuro lighting, deep black background with golden rim light, reflective glossy surface beneath creating mirror reflection, cinematic color grading, Vogue magazine style, ultra premium commercial photography, 8K. Render elegant golden Chinese text "[主标题]" at the top center in serif font, and smaller text "[副标题]" below it
```

#### B. 自然场景（适合：护肤品、食品、家居）

```
Place the product from Figure 1 elegantly in a [自然场景] setting, surrounded by [相关自然元素], soft golden hour sunlight streaming in, shallow depth of field with beautiful bokeh, organic luxurious atmosphere, lifestyle editorial photography, 8K. Render Chinese text "[主标题]" in white handwritten style font on the [left/right] side, with "[副标题]" in smaller text below
```

#### C. 科技悬浮（适合：电子产品、运动装备）

```
The product from Figure 1 floating in mid-air against a dark gradient background, subtle neon accent lights in [品牌色], soft particle effects and light trails around it, futuristic tech product visualization, cinematic CGI render style, 8K. Render Chinese text "[主标题]" in glowing white/cyan sans-serif font next to the product, with "[副标题]" in smaller text below
```

#### D. 极简留白（适合：所有品类）

```
The product from Figure 1 with generous negative space, minimalist composition following golden ratio, clean [调性色] gradient background, subtle soft shadow beneath, Scandinavian design aesthetic, high-end editorial photography, 8K. Render Chinese text "[主标题]" in thin dark gray font in the negative space area, with "[副标题]" in lighter smaller text below
```

#### E. 材质对比（适合：皮具、金属制品、陶瓷）

```
The product from Figure 1 placed on contrasting [对比材质: marble/wood/concrete] surface, dramatic side lighting emphasizing texture and craftsmanship details, architectural interior photography style, premium catalog shot, 8K. Render Chinese text "[主标题]" in white serif font at the bottom, with "[副标题]" in smaller text alongside
```

#### F. Flatlay 俯拍（适合：化妆品、文具、配饰）

```
Top-down flat lay composition with the product from Figure 1 as hero, surrounded by curated styling props ([相关道具]), on [marble/linen/wood] surface, soft diffused overhead lighting, Instagram editorial aesthetic, 8K. Render Chinese text "[主标题]" in stylish black handwritten font at the top, with "[副标题]" at the bottom edge
```

### 生成调用

对选定的 3-4 种构图**并行**发起 `generate`，使用不同角度的 `clean_images`：

```json
{
  "model": "fal-ai/bytedance/seedream/v5/lite/edit",
  "prompt": "（选定构图的完整提示词，使用 Figure 1 引用产品图，包含中文文案渲染指令）",
  "image_url": "clean_images 中选择合适角度的图片",
  "image_size": "auto_2K",
  "options": {
    "enable_safety_checker": false
  }
}
```

**构图与角度匹配建议**：
- 奢华光影 → 使用正面白底图
- 自然场景 → 使用 45° 侧面图
- 科技悬浮 → 使用正面白底图
- 极简留白 → 使用正面白底图
- 材质对比 → 使用 45° 侧面图
- Flatlay → 使用俯视角度图

---

## Step 4：输出结果

### 展示格式

```
## 🎨 高端产品宣传图设计完成

### 📸 干净产品图（Step 1 提取）

| 正面 | 左侧 45° | 右侧 45° |
|:---:|:---:|:---:|
| ![](url) | ![](url) | ![](url) |

---

### 🖼️ 营销宣传图

**[构图名称 A]**
![](url)

**[构图名称 B]**
![](url)

**[构图名称 C]**
![](url)

**[构图名称 D]**（如有）
![](url)

---

📊 模型：Nano Banana 2 | 分辨率：2K
💡 如需调整风格或构图，请告诉我！
```

### 下载到本地

```bash
mkdir -p output/product-promo/clean
mkdir -p output/product-promo/promo

# 干净产品图
curl -L -o output/product-promo/clean/front.png "url"
curl -L -o output/product-promo/clean/left-45.png "url"
curl -L -o output/product-promo/clean/right-45.png "url"

# 营销宣传图
curl -L -o output/product-promo/promo/01-luxury.png "url"
curl -L -o output/product-promo/promo/02-nature.png "url"
curl -L -o output/product-promo/promo/03-minimal.png "url"
```

---

## 构图选择指南

| 产品类型 | 推荐构图组合 |
|----------|-------------|
| 手表/珠宝 | 奢华光影 + 材质对比 + 极简留白 |
| 香水/护肤品 | 奢华光影 + 自然场景 + Flatlay |
| 电子产品 | 科技悬浮 + 极简留白 + 材质对比 |
| 运动鞋/装备 | 科技悬浮 + 自然场景 + 极简留白 |
| 食品/饮品 | 自然场景 + Flatlay + 极简留白 |
| 家居用品 | 自然场景 + 极简留白 + 材质对比 |
| 服装/配饰 | Flatlay + 自然场景 + 极简留白 |

## 提示词核心约束

| 约束 | 说明 |
|------|------|
| **Figure 引用** | 使用 `Figure 1` 引用传入的产品图，确保模型识别产品 |
| **提取阶段无文字** | Step 2 提取干净图时必须 `no text`，确保白底纯净 |
| **营销阶段有文案** | Step 3 构图必须包含中文推广文案，合理排布不遮挡产品 |
| **编辑模式** | 必须通过 `image_url` 传入干净产品图 |
| **高分辨率** | 提取阶段用 `square_hd`，构图阶段用 `auto_2K` |
| **模型** | 统一使用 `fal-ai/bytedance/seedream/v5/lite/edit` |

## 错误处理

- **系统工具未启用**：提示用户在会话配置中启用系统工具（NEX AI）
- **余额不足**：提示充值
- **产品变形严重**：在提示词追加 `preserve the exact product shape, color, proportions and all design details`
- **背景去除不干净**：重试时强调 `completely remove ALL background elements, text, watermarks, ensure absolutely pure white #FFFFFF background`
- **提取效果不佳**：尝试使用用户提供的另一张原图重新提取
