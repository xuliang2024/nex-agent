# CapCut 剪辑助手 — 独立分身重构计划

> 分支：`agent/capcut-editor`
> 上游：`main`（多分身平台版）
> 目标产物：一个独立的桌面 App "CapCut 剪辑助手"，只做剪辑这一件事

---

## 一、为什么要做"分支 = 分身"

### 现状（main 分支）

`main` 是一个**多分身集合容器**（"Nex Agent"），内置 9 个 builtin template 共享：

- 同一个 Electron 壳、同一个产品名/icon/appId
- 同一份 `system-skills/`（20 个 skill 全部打包）
- 同一个模板列表页 → 选分身 → 创建会话 → 对话

问题：
- **不专业**：用户下载一个"什么都能做"的工具，无法立刻知道这个 App 解决什么问题。
- **不简单**：模板列表、技能勾选、MCP 配置 → 普通用户被淹没在选项里。
- **不聚焦**：CapCut 剪辑场景需要的提示词、UI 引导、首屏文案都被通用化稀释。
- **包体冗余**：cut-* skill 用户根本用不到 podcast/pet-video 的素材。

### 新理念

**每个 git 分支孵化出一个独立、专业、单一职责的分身 App**：

| 分支 | 产物 | 用户认知 |
|------|------|----------|
| `main` | Nex Agent（多分身平台） | "AI 工作台/孵化器" |
| `agent/capcut-editor` | CapCut 剪辑助手 | "AI 帮我剪 CapCut" |
| `agent/pet-video`（未来） | 萌宠科普视频助手 | "AI 帮我做宠物科普" |
| `agent/ecom-design`（未来） | 电商产品图助手 | "AI 帮我做商品图" |
| `agent/podcast`（未来） | 播客对话合成 | "AI 帮我做播客" |

每个分支：
- 自己的 productName / appId / icon / 启动图
- 自己的首屏（**不是**模板列表，直接进剪辑工作台）
- 自己的 system-skills 子集
- 自己的安装包（`CapCut剪辑助手-x.y.z-arm64.dmg`）
- 自己的版本号节奏

---

## 二、共享 vs 私有的边界（核心架构决策）

把代码切成两块，避免分支之间漂移：

```
┌─────────────────────────────────────────────────────────┐
│              SHARED（main 分支永远是上游）              │
│  - packages/core/        Agent runtime / mastra 接入     │
│  - main/agent-bridge.ts  IPC 与 worker 桥接              │
│  - main/agent-worker.ts  agent 进程                      │
│  - main/auth-handler.ts  登录鉴权                        │
│  - main/store.ts         数据持久层（不含 builtin）      │
│  - main/skill-importer / template-packer                 │
│  - main/ipc-handlers.ts  IPC 框架                        │
│  - renderer/components/chat/  对话组件                   │
│  - renderer/stores/      session/auth/template store     │
│  - i18n 框架与公共文案                                   │
│  - 系统工具（NEX AI generate / get_result / uploadFile） │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│        PRIVATE（每个 agent/ 分支独立持有）              │
│  - packages/app/agent.config.ts    ← 新增「分身身份卡」 │
│  - packages/app/build/             icon / 启动屏 / 商标 │
│  - packages/app/electron-builder.json   appId/产品名    │
│  - packages/app/package.json       name + version       │
│  - packages/app/resources/system-skills/ ← 仅本身用得到 │
│  - packages/app/src/main/builtin-templates.ts ← 单条     │
│  - packages/app/src/renderer/i18n/locales/ ← 行业话术   │
│  - packages/app/src/renderer/App.tsx 路由首屏           │
│  - packages/app/src/renderer/pages/ 简化版 UI           │
└─────────────────────────────────────────────────────────┘
```

### 关键抽象：`agent.config.ts`（新增，私有文件）

每个分身在 `packages/app/src/agent.config.ts` 里声明自己的"身份卡"，**所有需要差异化的硬编码都从这里读**，避免散落到处都是 `if (productName === ...)`：

```ts
export const AGENT_IDENTITY = {
  // 产品身份
  appId: "com.nex-agent.capcut-editor",
  productName: "CapCut 剪辑助手",
  productNameEn: "CapCut Edit Agent",
  version: "0.1.0",

  // 单分身配置（替代 BUILTIN_TEMPLATES 数组）
  builtinTemplate: {
    id: "__builtin_video_editor__",
    name: "CapCut 剪辑助手",
    icon: "🎬",
    instructions: "...（剪辑助手的 system prompt）",
    skillRefs: [
      "__sys_cut-master__",
      "__sys_cut-draft__",
      "__sys_cut-text-design__",
      "__sys_cut-audio__",
      "__sys_xskill-ai__",
      "__sys_upload-image__",
    ],
    tools: { workspace: true, sandbox: true, system: true },
  },

  // UI 行为
  ui: {
    skipTemplateList: true,            // 启动直接进剪辑会话
    hideTemplateSwitcher: true,        // 侧边栏不显示其他分身
    defaultLandingRoute: "/chat",      // 首页指向剪辑会话
    showSettingsAdvanced: false,       // 隐藏高级配置（MCP/skill 池）
  },

  // 默认工作目录
  defaults: {
    workspacePath: "~/Movies/CapCut/AgentWorkspace",
  },
} as const;
```

> 这个抽象是整个重构的**地基**。后面所有改动都围绕"读 `AGENT_IDENTITY` 而不是写死字符串"展开。

---

## 三、CapCut 剪辑助手分支的具体改造清单

按"必须改 / 建议改 / 视情况改"分级：

### A. 必须改（不改就不是独立产品）

| # | 文件/目录 | 现状 | 目标 |
|---|----------|------|------|
| A1 | `packages/app/electron-builder.json` | `productName: "Nex Agent"` `appId: "com.nex-agent.app"` | 改为 `"CapCut 剪辑助手"` / `"com.nex-agent.capcut-editor"` |
| A2 | `packages/app/package.json` | `name: "@agent-desktop/app"` | 改为 `"@agent-desktop/capcut-editor"`；版本回归 `0.1.0` |
| A3 | `packages/app/build/icon.icns` + `icon.png` | Nex Agent 图标 | 替换为剪辑助手图标（黑底 + 剪刀/胶片元素） |
| A4 | `packages/app/src/main/builtin-templates.ts` | 9 个 BUILTIN_TEMPLATES | 仅保留 `__builtin_video_editor__`，从 `AGENT_IDENTITY` 读 |
| A5 | `packages/app/resources/system-skills/` | 20 个 skill | 删到 7 个：`cut-master/cut-draft/cut-text-design/cut-audio/xskill-ai/upload-image/ffmpeg`（其他全部 `git rm -rf`） |
| A6 | `packages/app/src/renderer/App.tsx` | 默认路由 `/templates` | 默认进 `/chat`，加个"启动时自动创建/复用唯一会话"的 hook |
| A7 | `packages/app/src/main/index.ts` | dock 图标用 `build/icon.png` | 同步换图标 |

### B. 建议改（不改也能跑，但用户体验差一截）

| # | 文件/目录 | 现状 | 目标 |
|---|----------|------|------|
| B1 | `packages/app/src/renderer/components/sidebar/Sidebar.tsx` | 显示模板切换/会话列表 | 隐藏"模板池"入口；只保留"我的剪辑工程"列表 + 新建按钮 |
| B2 | `packages/app/src/renderer/pages/TemplatesPage.tsx` | 9 个分身网格 | 整个页面删掉，路由也删 |
| B3 | `packages/app/src/renderer/pages/SettingsPage.tsx` | 含 MCP / Skill / Defaults 多 tab | 仅保留"账号 + 工作目录 + 模型"三块；其他 tab 隐藏 |
| B4 | `packages/app/src/renderer/i18n/locales/{zh,en}/common.json` | 通用 AI 助手话术 | 改成剪辑场景话术（"开始新剪辑工程" / "粘贴素材链接 / 拖入文件" / "打开 CapCut"） |
| B5 | `packages/app/src/renderer/components/chat/` 欢迎页 | 通用 hint | 内置 4-6 个剪辑场景 quick action（"产品介绍 15s 竖版" / "口播 3 段切镜" / "卡点 BGM 视频" / "字幕样式实验"） |
| B6 | `packages/app/src/main/store.ts` | `ensureBuiltinTemplates` 跑全部 | 改为只跑 `AGENT_IDENTITY.builtinTemplate` |

### C. 视情况改（可在 v0.2 再做）

| # | 项 | 说明 |
|---|-----|------|
| C1 | 启动时若未安装 `cutcli` 自动跳出引导弹窗 | 现在是模型自己用 sandbox 检测，可前置到 main 进程 |
| C2 | 自动检测 CapCut 是否安装 + 草稿目录路径 | macOS `mdfind kMDItemCFBundleIdentifier="com.lemon.lveditor"` |
| C3 | 在侧栏直接列出 `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/` 下的草稿，点击直接打开 CapCut | 提升"工作台"感 |
| C4 | 内置 cut-effects / cut-filters / cut-keyframes / cut-transitions / cut-stickers / cut-masks skill 文件 | 当前 system-skills 只有 4 个 cut-*；其他在 `~/.claude/skills` 里。如果要让普通用户开箱即用，得把这些 skill 也搬进 system-skills |

### D. 不动（继承 main）

- `packages/core/` 整个不改
- `agent-bridge.ts` / `agent-worker.ts` / `auth-handler.ts` 不改
- 系统工具（apiz-sdk）不改
- store.ts 数据结构不改

---

## 四、执行步骤（分阶段，每阶段一次性 commit）

### Phase 0：基础设施（1 个 commit）

> 这步在 `main` 分支做更合适，但为了避免阻塞先放本分支。验证完后 cherry-pick 回 main。

- [ ] 0.1 新增 `packages/app/src/agent.config.ts`（默认导出当前 Nex Agent 身份）
- [ ] 0.2 改造 `builtin-templates.ts` 从 `AGENT_IDENTITY` 读单条
- [ ] 0.3 改造 `electron-builder.json` 的 `productName/appId` 改成从环境变量或 config 读（脚本生成）
- [ ] 0.4 改造 `App.tsx` 根据 `AGENT_IDENTITY.ui.skipTemplateList` 决定首屏

### Phase 1：身份切换为 CapCut（1 个 commit）

- [ ] 1.1 改写 `agent.config.ts` 为 CapCut 剪辑助手的身份卡
- [ ] 1.2 改 `package.json` name + version
- [ ] 1.3 替换 `build/icon.icns` `build/icon.png`（设计稿待定，先放占位）
- [ ] 1.4 删除非剪辑相关的 system-skills 目录（保留 7 个）
- [ ] 1.5 验证 `pnpm dev` 启动后直接进剪辑会话，无模板列表

### Phase 2：UI 简化（1 个 commit）

- [ ] 2.1 删除 `TemplatesPage.tsx` 与对应路由
- [ ] 2.2 改 `Sidebar.tsx` 去掉模板切换入口
- [ ] 2.3 改 `SettingsPage.tsx` 隐藏高级 tab（MCP / Skill 池）
- [ ] 2.4 改 i18n 话术为剪辑场景
- [ ] 2.5 在 ChatPage 欢迎页加 4 个剪辑 quick action

### Phase 3：剪辑专属增强（v0.2）

- [ ] 3.1 main 进程检测 cutcli 与 CapCut 安装状态
- [ ] 3.2 侧栏列出 CapCut 草稿目录
- [ ] 3.3 把 cut-effects/filters/keyframes/transitions/stickers/masks 搬进 system-skills

### Phase 4：构建与发布（1 个 commit）

- [ ] 4.1 跑 `pnpm build && pnpm --filter @agent-desktop/capcut-editor dist`
- [ ] 4.2 验证生成 `CapCut 剪辑助手-0.1.0-arm64.dmg`
- [ ] 4.3 测试包：双击安装 → 启动 → 直接进剪辑会话 → 跑一个 12 秒产品介绍 demo → 验证草稿在 CapCut 国际版能打开
- [ ] 4.4 写 `RELEASE_NOTES.md`（剪辑场景维度，不是技术维度）

---

## 五、main 与分支的同步策略

这是"分支 = 分身"模式必须解决的问题。否则 6 个月后各分支严重漂移，无法维护。

### 5.1 单向流动原则

```
main（平台底座）  ──cherry-pick──►  agent/capcut-editor
                  ──cherry-pick──►  agent/pet-video
                  ──cherry-pick──►  agent/ecom-design
                                          │
                                          │（私有改动不回流）
                                          ▼
                                       绝不 PR 回 main
```

- **共享层改动**（agent runtime / IPC / store / 公共组件）只在 `main` 提交
- 各分身分支定期 `git cherry-pick <main 上的 commit>` 拉取
- 分身私有改动（`agent.config.ts` / icon / 裁剪后的 builtin-templates / 简化 UI）**不回 main**

### 5.2 哪些目录"禁止"在分身分支改

通过 CODEOWNERS / 文档约定：

- `packages/core/**`
- `packages/app/src/main/agent-bridge.ts`
- `packages/app/src/main/agent-worker.ts`
- `packages/app/src/main/auth-handler.ts`
- `packages/app/src/main/store.ts`（除非是 builtin-template 加载逻辑）
- `packages/app/src/renderer/stores/**`
- `packages/app/src/renderer/components/chat/**`

### 5.3 同步节奏

- main 上每个 PR 合入后，给所有 agent/* 分支开一个 cherry-pick 任务（脚本化）
- 每周做一次"分身分支同步日"
- 重大版本（如 mastra 升级）由维护者集中合一次

---

## 六、构建与发布（多产品矩阵）

### 6.1 GitHub Actions Matrix

```yaml
matrix:
  branch: [main, agent/capcut-editor, agent/pet-video]
  os: [macos-latest, windows-latest]
```

每个 branch + os 出一个独立产物。

### 6.2 产物命名

通过 `electron-builder.json` 的 `${productName}-${version}-${arch}.${ext}`：

- main：`Nex Agent-0.2.1-arm64.dmg`
- capcut：`CapCut 剪辑助手-0.1.0-arm64.dmg`
- pet-video：`萌宠科普助手-0.1.0-arm64.dmg`

### 6.3 分发渠道

每个分身有自己的：
- 下载页（landing page）
- 更新源（autoUpdater 的 channel）
- 帮助文档
- 社群

---

## 七、风险与回滚

| 风险 | 应对 |
|------|------|
| icon 设计来不及，影响 dmg 出包 | 用占位图先出，发布前再换 |
| 删除 9 个 skill 后用户临时想用 | 不影响：本分身就是不做这些事；要做就回 main |
| main 漂移导致 cherry-pick 冲突 | 每周同步；不要积压 |
| 国内版剪映用户安装后无法打开草稿 | 启动屏明确告知"仅支持 CapCut 国际版"；首屏检测 + 阻断 |
| 分支太多失控（agent/A/B/C/D...） | 设门槛：必须有 200+ 用户验证才允许独立分身；否则留在 main 做 builtin |

回滚方案：
- 整个分支可丢弃，main 不受影响
- Phase 0 的"agent.config.ts 抽象"如果 cherry-pick 回 main，main 仍是多分身模式，向后兼容

---

## 八、已确认的关键决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 产品中文名 / 英文名 | **CapCut Agent**（中英文统一） |
| 2 | appId | **`com.nex-agent.capcut-editor`** |
| 3 | Phase 0 抽象（`agent.config.ts`） | **做**。后续要孵化更多分身，地基必须稳 |
| 4 | 国内版剪映兼容策略 | **warn 但放行**：启动屏 / 首条对话明确告警，不阻断用户 |
| 5 | UI 简化程度 | **轻度**：删 `TemplatesPage`，保留侧栏 + 会话列表（多剪辑工程并行） |
| 6 | icon 处理 | **先沿用 Nex Agent 原 icon 顶替**，发布前再换 |
| 7 | 计划文档 | **提交进 `agent/capcut-editor` 分支历史** |

> "warn 但放行" 实施细节：
> - 启动后第一次进入 ChatPage 时弹一次性提示横幅（带"不再提示"勾选）
> - System prompt 仍包含"如检测到只装国内版剪映 → 先告知约束"那一段
> - **不**做强制阻断，不影响用户跑命令

> "轻度简化" 实施细节：
> - `App.tsx` 删除 `/templates` 路由，根路径 → `/chat`
> - 启动时如无任何会话，自动创建一个默认会话
> - 侧栏继续展示会话列表 + "新建剪辑工程" 按钮（多工程并行）
> - 设置页只藏 MCP 池/Skill 池高级 tab，账号/工作目录/模型保留

---

## 九、本次落地的具体动作

1. ✅ 在 `agent/capcut-editor` 分支提交本计划
2. ⏳ Phase 0：抽象 `agent.config.ts` + 改造 `builtin-templates.ts` + 改造 `App.tsx` 路由（让 main 兼容、capcut 走 single 模式）
3. ⏳ Phase 1：分支身份切换为 CapCut Agent + 删 13 个 skill + 改 `electron-builder.json` / `package.json`
4. ⏳ Phase 2：删 `TemplatesPage` + 简化 Sidebar/Settings + 改 i18n 文案 + 加 quick action
5. ⏳ Phase 3-4：cutcli/CapCut 检测 + 出 dmg + 验收

每个 Phase 单独 commit，可独立回滚。
