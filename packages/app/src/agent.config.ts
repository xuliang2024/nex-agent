/**
 * 分身身份卡（Agent Identity Card）
 *
 * 「分支 = 独立分身」架构的地基。每个 agent/* 分支只需修改这一个文件
 * 即可切换为独立分身产品；main 分支保持 mode = "platform" 即当前的
 * 多分身平台行为。
 *
 * --- 字段语义 ---
 *   mode: "platform"  → 加载全部 builtin templates，首屏 /templates
 *   mode: "single"    → 仅加载 single.builtinTemplateId 一条，首屏 /chat
 *
 * --- cherry-pick 规则 ---
 *   - main 上对 AgentIdentity 类型/字段的扩充可以 cherry-pick 到所有分支
 *   - 各分支对 mode / single / appId / productName / defaults 的覆盖不要回流 main
 *
 * --- 修改后必须验证 ---
 *   - pnpm dev 启动后行为是否符合 mode 描述
 *   - mode === "single" 时，single.builtinTemplateId 必须在 builtin-templates.ts
 *     的 ALL_BUILTIN_TEMPLATES 数组中存在，否则会拿到空模板列表
 */

export type AgentMode = "platform" | "single";

export interface AgentSingleConfig {
  /** 必须存在于 builtin-templates.ts 的 ALL_BUILTIN_TEMPLATES 中 */
  builtinTemplateId: string;
  /** 启动时若该 template 没有任何会话，则自动创建一个默认会话 */
  autoCreateSession: boolean;
  /** 跳过 /templates 列表页，根路径直接重定向到 /chat */
  skipTemplateList: boolean;
  /** 侧栏是否隐藏「返回模板列表」按钮（true = 完全隐藏） */
  hideTemplateBackLink: boolean;
}

export interface AgentStartupBanner {
  /** 横幅标题 */
  title: string;
  /** 横幅正文（支持 markdown） */
  body: string;
  /** localStorage key，记录用户「不再提示」状态 */
  dismissKey: string;
  /** 横幅样式：info（蓝） / warn（黄） / danger（红） */
  level?: "info" | "warn" | "danger";
}

export interface AgentIdentity {
  /** 区分多分身平台 vs 独立分身 */
  mode: AgentMode;
  /** electron-builder 的 appId */
  appId: string;
  /** 显示给用户的产品名（窗口标题、关于页、dmg 标题） */
  productName: string;
  /** 仅 mode === "single" 时生效 */
  single?: AgentSingleConfig;
  /** 启动后首次进入主界面时弹一次性横幅（如「CapCut 国际版」兼容性提示） */
  startupBanner?: AgentStartupBanner;
  /** 各分身的默认值（覆盖 settings.defaults） */
  defaults?: {
    workspacePath?: string;
  };
}

export const AGENT_IDENTITY: AgentIdentity = {
  mode: "platform",
  appId: "com.nex-agent.app",
  productName: "Nex Agent",
};
