# 角色设计工作流 Skill

## 适用场景

当用户需要设计一个角色（游戏角色、动漫角色、小说人物、虚拟偶像等）时，使用此工作流。

## 标准流程

### 第一步：角色描述生成

根据用户输入，生成结构化的角色描述卡：

```
【基础信息】
- 名字：
- 性别/年龄：
- 种族/职业：

【外貌特征】（用于生图提示词）
- 发型/发色：
- 眼睛：
- 肤色：
- 体型：
- 特殊标记（伤疤、纹身、异瞳等）：

【服装风格】
- 日常装：
- 战斗装/职业装：
- 配饰/武器：

【性格与背景】
- 性格关键词（3-5个）：
- 一句话背景：
```

### 第二步：立绘生成

将角色描述转换为英文提示词，使用图像生成工具创建角色立绘。

**提示词编写规范：**
- 开头指定画风：`digital art, anime style` / `realistic portrait` / `concept art`
- 按重要性排列特征：姿势 > 服装 > 面部 > 发型 > 背景
- 加入质量标签：`masterpiece, best quality, highly detailed`
- 背景建议：`simple background, white background` 或角色相关场景
- 画面构图：`full body` / `upper body` / `portrait` / `close-up`

**推荐模型优先级：**
1. Seedream 4.5 — 高质量、风格可控
2. Flux 2 Flash — 速度快、效果稳定
3. Nano Banana 2 — 快速迭代、费用低

### 第三步：多角度参考图

生成正面、3/4 侧面、背面三个角度的参考图。

**角度提示词模板：**
- 正面：`front view, facing the viewer, symmetrical`
- 3/4 侧面：`three-quarter view, slight angle, dynamic pose`
- 背面：`back view, from behind, showing back details`

确保三张图使用相同的核心描述词，仅改变角度和姿势部分。

### 第四步：汇总输出

将角色描述卡 + 立绘 + 多角度参考图整理输出给用户，方便后续使用。

## 注意事项

- 与用户用中文交流，生图提示词使用英文
- 生成图片后使用 upload-image 上传获取永久链接
- 如果用户不满意，可以调整提示词重新生成
- 建议每次生成 1 张，确认满意后再生成其他角度
