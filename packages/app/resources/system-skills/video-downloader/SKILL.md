# 全平台视频无水印下载

解析各大平台视频/图集分享链接，获取无水印资源并自动下载到本地工作空间。**免费使用**。

## 支持平台

抖音 · 快手 · 小红书 · 哔哩哔哩 · 微博 · TikTok · Instagram · YouTube 及其他主流平台。

## 工作流程

### 第一步：引导用户提供链接

收到用户消息后，判断是否包含视频/图集链接：
- 如果包含链接（URL 或带分享文案的文本），直接进入第二步
- 如果不包含链接，友好地引导用户：

> 请粘贴视频分享链接，我来帮你下载无水印版本。
>
> 支持平台：抖音、快手、小红书、B站、微博、TikTok、Instagram、YouTube 等
>
> 直接粘贴分享文案即可，我会自动提取链接。

### 第二步：解析链接

调用系统工具 `parse_video` 解析链接：

```json
{
  "url": "用户提供的链接或分享文案"
}
```

`parse_video` 接受完整分享文案（包含分享口令和链接混合的文本），会自动提取有效 URL。

### 第三步：展示解析结果

解析成功后，向用户展示信息摘要：

**视频类型**（有 `video_url`）：
```
✅ 解析成功
📹 标题: {title}
🔗 视频链接: 已获取（{video_urls 数量}个源）
🎵 音频链接: {有/无}
```

**图集类型**（有 `image_urls`）：
```
✅ 解析成功
🖼️ 标题: {title}
📷 图片数量: {image_urls.length} 张
```

如果解析失败，提示用户检查链接是否正确，或尝试其他链接。

### 第四步：下载到本地

确定下载目录为当前工作空间下的 `downloads/` 子目录。

使用 `curl` 命令下载资源，文件名格式：`{sanitized_title}_{timestamp}.{ext}`

**下载视频**：
```bash
mkdir -p downloads
curl -L -o "downloads/{filename}.mp4" "{video_url}" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
```

**下载音频**（如果有单独的 `audio_url`）：
```bash
curl -L -o "downloads/{filename}_audio.mp3" "{audio_url}" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
```

**下载图集**（逐张下载）：
```bash
curl -L -o "downloads/{filename}_1.jpg" "{image_urls[0]}" -H "User-Agent: ..."
curl -L -o "downloads/{filename}_2.jpg" "{image_urls[1]}" -H "User-Agent: ..."
# ...依次下载所有图片
```

文件名清理规则：
- 移除 `\ / : * ? " < > |` 等非法字符
- 空格替换为下划线
- 截断至 80 字符
- 时间戳格式 `YYYYMMDD_HHmmss`
- 从 URL 路径推断扩展名，默认视频 `.mp4`、音频 `.mp3`、图片 `.jpg`

### 第五步：汇报结果

下载完成后，列出所有已下载文件的完整绝对路径：

```
📥 下载完成！

已下载文件：
  📹 /absolute/path/to/downloads/标题_20260416_143000.mp4 (12.3 MB)
  🎵 /absolute/path/to/downloads/标题_20260416_143000_audio.mp3 (1.2 MB)

保存目录: /absolute/path/to/downloads/
```

图集结果：
```
📥 下载完成！共 5 张图片

已下载文件：
  🖼️ /absolute/path/to/downloads/标题_20260416_143000_1.jpg
  🖼️ /absolute/path/to/downloads/标题_20260416_143000_2.jpg
  🖼️ /absolute/path/to/downloads/标题_20260416_143000_3.jpg
  🖼️ /absolute/path/to/downloads/标题_20260416_143000_4.jpg
  🖼️ /absolute/path/to/downloads/标题_20260416_143000_5.jpg

保存目录: /absolute/path/to/downloads/
```

## 多链接批量处理

如果用户一次发来多个链接，逐个解析并下载，最后统一汇总：

```
📥 批量下载完成！

1. 视频A标题 → downloads/视频A_20260416_143000.mp4
2. 视频B标题 → downloads/视频B_20260416_143012.mp4
3. 图集C标题 → downloads/图集C_20260416_143025_1.jpg ~ _3.jpg

保存目录: /absolute/path/to/downloads/
```

## 注意事项

- 优先使用 `video_url`（首选链接），如果下载失败尝试 `video_urls` 中的其他源
- 如果 `curl` 下载返回非 200 状态码或文件大小为 0，尝试下一个源链接
- 某些平台的私密或已删除内容无法解析，需提示用户
- 下载大文件时告知用户预计等待时间
