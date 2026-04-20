// Note: ConfigStore (./config/store.ts) is intentionally not re-exported.
// It depends on `@mastra/libsql`, which pulls in the native `libsql` binary
// (`@libsql/darwin-arm64` etc.) via dynamic require. Bundling that into the
// Electron main process triggers "Could not dynamically require @libsql/..."
// at startup. The desktop app uses the JSON-backed `AppStore` instead, so
// `ConfigStore` is currently dead code. Re-export it (and add a libsql-stub
// alias in `electron-vite.config.ts`) only if you actually need it.
export type {
  AuthUser,
  AuthState,
  LoginResult,
  SendCodeResult,
} from "./config/auth-types.js";
export { AUTH_API_BASE, createEmptyAuthState } from "./config/auth-types.js";
export type {
  GlobalSettings,
  SessionConfig,
  Session,
  SessionSummary,
  Message,
  ToolCallInfo,
  MCPServerConfig,
  SkillConfig,
} from "./config/types.js";
export {
  createDefaultGlobalSettings,
  createSessionConfigFromDefaults,
} from "./config/types.js";

export { SessionAgentEngine } from "./engine/session-agent.js";
export type {
  AgentEngineOptions,
  StreamResult,
  StreamEvent,
  StreamEventType,
  MCPServerStatus,
} from "./engine/session-agent.js";
export { AgentManager } from "./engine/agent-manager.js";
export { buildWorkspaceTools, buildSandboxTools } from "./tools/workspace-tools.js";
export {
  buildApizTools,
  APIZ_SYSTEM_TOOL_NAMES,
  type BuildApizToolsOptions,
} from "./tools/apiz-tools.js";
export {
  ApizClient,
  getApizClient,
  resetApizClient,
  type PresignUploadParams,
  type PresignUploadResult,
  type ListAPIKeysParams,
} from "./services/apiz-client.js";
