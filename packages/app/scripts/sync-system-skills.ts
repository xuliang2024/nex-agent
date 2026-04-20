#!/usr/bin/env npx tsx
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

/**
 * cut-* skill 在本项目里都需要追加同一段 CapCut 环境约束说明：
 * cutcli 生成的资产是 CapCut 国际版的命名/路径，国内版剪映打不开。
 * 通过 sync 脚本的 localPrefix 注入，保证下次 sync 时不会丢失。
 */
const CAPCUT_LOCAL_NOTE = `> **⚠️ Nex Agent 环境说明（重要）**
>
> - 本 cutcli 工具生成的是 **CapCut 国际版** 草稿（特效/动画/花字/转场资产名都是 CapCut 国际版的命名）。
> - macOS 默认草稿目录为 \`~/Movies/CapCut/User Data/Projects/com.lveditor.draft/<draftId>/\`，**不是** 国内版剪映的 \`~/Movies/JianyingPro Drafts/\`。
> - 应在 **CapCut 桌面端** 打开。**国内版剪映（JianyingPro）大概率无法识别本草稿的特效/动画/花字**，可能出现"特效缺失"、字幕样式异常或直接打不开。
> - 如用户安装的是国内版剪映，**先告知此约束并征求确认**；本工具不提供国内版兼容方案。
> - 下文如出现 \`~/Movies/JianyingPro Drafts/...\` 路径，请以本节 CapCut 路径为准。`;

interface SkillConfig {
  name: string;
  src: string;
  description: string;
  tags?: string[];
  /** 写入 SKILL.md 时在 frontmatter 后注入的本地说明，sync 时会重新覆盖。 */
  localPrefix?: string;
}

const SKILLS: SkillConfig[] = [
  {
    name: "xskill-ai",
    src: path.join(os.homedir(), ".claude/skills/xskill-ai/SKILL.md"),
    description: "通过 xskill.ai 生成 AI 图片、视频、语音，解析视频链接，管理账户",
    tags: ["图片生成", "视频生成", "语音合成", "多模型"],
  },
  {
    name: "flux2-flash",
    src: path.join(os.homedir(), ".claude/skills/flux2-flash/SKILL.md"),
    description: "Flux 2 Flash 文生图/图编辑",
    tags: ["图像生成", "文生图", "图像编辑", "Flux"],
  },
  {
    name: "nano-banana-2",
    src: path.join(os.homedir(), ".claude/skills/nano-banana-2/SKILL.md"),
    description: "Nano Banana 2 (Gemini 3.1 Flash) 快速生图",
    tags: ["图像生成", "文生图", "Google", "Gemini"],
  },
  {
    name: "seedream-image",
    src: path.join(os.homedir(), ".claude/skills/seedream-image/SKILL.md"),
    description: "字节 Seedream 4.5 文生图/图编辑",
    tags: ["图像生成", "文生图", "Seedream", "字节跳动"],
  },
  {
    name: "seedance-video",
    src: path.join(os.homedir(), ".claude/skills/seedance-video/SKILL.md"),
    description: "字节 Seedance 文/图生视频（带音频）",
    tags: ["视频生成", "文生视频", "图生视频", "Seedance"],
  },
  {
    name: "upload-image",
    src: path.join(os.homedir(), ".claude/skills/upload-image/SKILL.md"),
    description: "上传本地图片到云存储获取 URL",
    tags: ["图片上传", "云存储", "URL"],
  },
  {
    name: "cut-master",
    src: path.join(os.homedir(), "codes/jy_cli/.cursor/skills/cut-master/SKILL.md"),
    description: "CapCut 国际版剪辑思维总指挥：5 步框架、3 大原则、轨道分层、时间线节奏、Skill 路由表",
    tags: ["CapCut", "剪辑思维", "工作流", "国际版"],
    localPrefix: CAPCUT_LOCAL_NOTE,
  },
  {
    name: "cut-draft",
    src: path.join(os.homedir(), "codes/jy_cli/.cursor/skills/cut-draft/SKILL.md"),
    description: "cutcli CapCut 国际版草稿基础命令与参数完整速查",
    tags: ["CapCut", "视频编辑", "字幕", "国际版"],
    localPrefix: CAPCUT_LOCAL_NOTE,
  },
  {
    name: "cut-text-design",
    src: path.join(os.homedir(), "codes/jy_cli/.cursor/skills/cut-text-design/SKILL.md"),
    description: "CapCut 国际版字幕进阶设计：5 套样式组合、关键词高亮、节奏公式、入场出场动画、双语字幕",
    tags: ["CapCut", "字幕设计", "花字", "关键词高亮", "国际版"],
    localPrefix: CAPCUT_LOCAL_NOTE,
  },
  {
    name: "cut-audio",
    src: path.join(os.homedir(), "codes/jy_cli/.cursor/skills/cut-audio/SKILL.md"),
    description: "CapCut 国际版音频剪辑指南：4 角色分工、混音平衡、音画对位、节拍对齐、自动 ducking",
    tags: ["CapCut", "音频", "BGM", "混音", "卡点", "国际版"],
    localPrefix: CAPCUT_LOCAL_NOTE,
  },
  {
    name: "parse-video",
    src: path.join(os.homedir(), ".claude/skills/parse-video/SKILL.md"),
    description: "解析视频分享链接，获取无水印下载地址",
    tags: ["视频下载", "去水印", "抖音", "B站"],
  },
  {
    name: "ffmpeg",
    src: path.join(os.homedir(), ".agents/skills/ffmpeg/SKILL.md"),
    description: "FFmpeg 视频/音频格式转换、压缩、裁剪",
    tags: ["FFmpeg", "视频处理", "音频处理", "格式转换"],
  },
];

const destBase = path.resolve(__dirname, "../resources/system-skills");

/** 在 frontmatter `---...---` 块后注入本地说明；没有 frontmatter 就插到最前面。 */
function injectLocalPrefix(content: string, prefix: string): string {
  const trimmed = prefix.trim();
  const fmMatch = content.match(/^(---\n[\s\S]*?\n---\n)/);
  if (fmMatch) {
    return fmMatch[1] + "\n" + trimmed + "\n\n" + content.slice(fmMatch[1].length);
  }
  return trimmed + "\n\n" + content;
}

let synced = 0;
for (const skill of SKILLS) {
  if (!fs.existsSync(skill.src)) {
    console.warn(`SKIP ${skill.name}: source not found at ${skill.src}`);
    continue;
  }

  const destDir = path.join(destBase, skill.name);
  fs.mkdirSync(destDir, { recursive: true });

  const rawContent = fs.readFileSync(skill.src, "utf-8");
  const finalContent = skill.localPrefix
    ? injectLocalPrefix(rawContent, skill.localPrefix)
    : rawContent;
  fs.writeFileSync(path.join(destDir, "SKILL.md"), finalContent);

  const hash = crypto.createHash("sha256").update(finalContent).digest("hex").slice(0, 8);
  const manifest = {
    name: skill.name,
    description: skill.description,
    tags: skill.tags,
    source: "local",
    sourcePath: skill.src,
    version: "1.0.0",
    contentHash: hash,
  };
  fs.writeFileSync(path.join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  synced++;
  const prefixLabel = skill.localPrefix ? " +prefix" : "";
  console.log(`OK ${skill.name} (${hash})${prefixLabel}`);
}

console.log(`\nSynced ${synced}/${SKILLS.length} system skills to ${destBase}`);
