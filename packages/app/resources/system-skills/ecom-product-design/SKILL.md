# 电商产品图设计工作流 Skill

## 适用场景

当用户需要为产品生成电商平台展示图片时，使用此工作流。适用于淘宝、京东、拼多多、亚马逊等平台的商品图需求。

## 标准流程

### 第一步：产品信息收集

确认以下信息（如果用户未提供，主动询问）：
- 产品名称和类别
- 核心卖点（2-3 个）
- 目标平台（决定图片尺寸）
- 风格偏好（简约/高端/活泼/国潮等）
- 是否有参考图片

### 第二步：白底主图

电商主图必须是白底产品图，突出产品本身。

**提示词模板：**
```
product photography, [产品描述], white background, studio lighting,
clean composition, professional product shot, high resolution,
commercial photography, centered, no text, no watermark
```

**要点：**
- 白底纯净，不加文字
- 产品居中，占画面 60-80%
- 光影自然，突出质感
- 推荐尺寸：正方形 1:1

### 第三步：场景展示图

将产品置于使用场景中，增强代入感。

**提示词模板：**
```
lifestyle product photography, [产品描述] in [场景],
natural lighting, [风格词], photorealistic, editorial style,
magazine quality, bokeh background
```

**常见场景类型：**
- 家居类：`in a modern living room, cozy atmosphere`
- 食品类：`on a wooden table, with fresh ingredients around`
- 美妆类：`on marble surface, with flowers and soft light`
- 服装类：`worn by a [model description], urban street`
- 数码类：`on a minimalist desk, workspace setup`

### 第四步：模特展示图（如需）

适用于服装、饰品、箱包等穿戴类产品。

**提示词模板：**
```
fashion photography, [model description] wearing/holding [产品描述],
[pose description], professional studio, fashion editorial,
full body / upper body, [背景描述]
```

### 第五步：详情页长图（可选）

引导用户描述卖点，生成多张不同角度/场景的展示图。

**详情页常用图片类型：**
1. 产品正面特写
2. 细节放大图（材质、做工）
3. 使用场景图
4. 尺寸对比图
5. 多色/多款合集图

## 图片生成建议

**推荐模型优先级：**
1. Seedream 4.5 — 产品图真实感最强
2. Flux 2 Flash — 速度快，适合快速迭代
3. Nano Banana 2 — 低成本快速出图

**质量增强词：**
- `8k resolution, ultra detailed, professional photography`
- `studio lighting, soft shadows, product catalog`

## 注意事项

- 与用户用中文交流，生图提示词使用英文
- 生成图片后使用 upload-image 上传获取永久链接
- 电商主图避免文字，详情页图可以后期加文字
- 注意不同平台的图片尺寸要求
- 如果用户提供了产品实物照片，基于实物特征编写提示词
