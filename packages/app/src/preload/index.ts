import { contextBridge, ipcRenderer } from "electron";

const api = {
  // Agent Identity
  getAgentIdentity: () => ipcRenderer.invoke("agent:identity"),

  // Auth
  authGet: () => ipcRenderer.invoke("auth:get"),
  authLoginEmail: (email: string, password: string) =>
    ipcRenderer.invoke("auth:login-email", email, password),
  authSendEmailCode: (email: string) =>
    ipcRenderer.invoke("auth:send-email-code", email),
  authLoginEmailCode: (email: string, code: string, refCode?: string) =>
    ipcRenderer.invoke("auth:login-email-code", email, code, refCode),
  authGoogleLogin: () => ipcRenderer.invoke("auth:google-login"),
  authGoogleCheck: (state: string) =>
    ipcRenderer.invoke("auth:google-check", state),
  authWechatQrcode: () => ipcRenderer.invoke("auth:wechat-qrcode"),
  authWechatCheck: (sceneId: string) =>
    ipcRenderer.invoke("auth:wechat-check", sceneId),
  authForgotPassword: (email: string) =>
    ipcRenderer.invoke("auth:forgot-password", email),
  authResetPassword: (token: string, newPassword: string) =>
    ipcRenderer.invoke("auth:reset-password", token, newPassword),
  authRefreshUser: () => ipcRenderer.invoke("auth:refresh-user"),
  authGetUserMoney: () => ipcRenderer.invoke("auth:get-user-money"),
  authLogout: () => ipcRenderer.invoke("auth:logout"),

  // Templates
  listTemplates: () => ipcRenderer.invoke("template:list"),
  getTemplate: (id: string) => ipcRenderer.invoke("template:get", id),
  createTemplate: (meta: any) => ipcRenderer.invoke("template:create", meta),
  createTemplateFromSession: (sessionId: string, meta: any) =>
    ipcRenderer.invoke("template:create-from-session", sessionId, meta),
  updateTemplate: (id: string, partial: any) =>
    ipcRenderer.invoke("template:update", id, partial),
  deleteTemplate: (id: string) => ipcRenderer.invoke("template:delete", id),
  createSessionFromTemplate: (templateId: string, name?: string) =>
    ipcRenderer.invoke("template:create-session", templateId, name),
  listTemplateSessions: (templateId: string) =>
    ipcRenderer.invoke("template:sessions", templateId),
  exportTemplate: (templateId: string) =>
    ipcRenderer.invoke("template:export", templateId),
  importTemplate: () => ipcRenderer.invoke("template:import"),

  // Session
  listSessions: () => ipcRenderer.invoke("session:list"),
  createSession: (templateId: string, name?: string) =>
    ipcRenderer.invoke("session:create", templateId, name),
  getSession: (id: string) => ipcRenderer.invoke("session:get", id),
  deleteSession: (id: string) => ipcRenderer.invoke("session:delete", id),
  renameSession: (id: string, name: string) =>
    ipcRenderer.invoke("session:rename", id, name),
  getSessionConfig: (id: string) =>
    ipcRenderer.invoke("session:get-config", id),
  updateSessionConfig: (id: string, partial: any) =>
    ipcRenderer.invoke("session:update-config", id, partial),

  // Messages
  listMessages: (sessionId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke("messages:list", sessionId, limit, offset),
  saveMessage: (msg: any) => ipcRenderer.invoke("messages:save", msg),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (partial: any) =>
    ipcRenderer.invoke("settings:update", partial),
  setKey: (name: string, value: string) =>
    ipcRenderer.invoke("settings:set-key", name, value),
  deleteKey: (name: string) => ipcRenderer.invoke("settings:delete-key", name),
  selectDirectory: () => ipcRenderer.invoke("settings:select-directory"),
  selectFile: (filters?: any[]) =>
    ipcRenderer.invoke("settings:select-file", filters),

  // Shell
  openPath: (p: string) =>
    ipcRenderer.invoke("shell:open-path", p) as Promise<{
      ok: boolean;
      error?: string;
    }>,

  // MCP Library
  listMCPLibrary: () => ipcRenderer.invoke("mcp-library:list"),
  addMCPToLibrary: (config: any) =>
    ipcRenderer.invoke("mcp-library:add", config),
  updateMCPInLibrary: (id: string, partial: any) =>
    ipcRenderer.invoke("mcp-library:update", id, partial),
  removeMCPFromLibrary: (id: string) =>
    ipcRenderer.invoke("mcp-library:remove", id),

  // Skill Library
  listSkillLibrary: () => ipcRenderer.invoke("skill-library:list"),
  addSkillToLibrary: (config: any) =>
    ipcRenderer.invoke("skill-library:add", config),
  updateSkillInLibrary: (id: string, partial: any) =>
    ipcRenderer.invoke("skill-library:update", id, partial),
  removeSkillFromLibrary: (id: string) =>
    ipcRenderer.invoke("skill-library:remove", id),

  // Skill Import
  searchAgentSkill: (query: string, limit?: number) =>
    ipcRenderer.invoke("skill:search-agentskill", query, limit),
  importFromAgentSkill: (slug: string) =>
    ipcRenderer.invoke("skill:import-agentskill", slug),
  importFromGitHub: (url: string) =>
    ipcRenderer.invoke("skill:import-github", url),
  checkSkillUpdate: (id: string) =>
    ipcRenderer.invoke("skill:check-update", id),
  updateSkill: (id: string) => ipcRenderer.invoke("skill:update", id),

  // Models
  listModels: () => ipcRenderer.invoke("models:list"),

  // Locale
  getLocale: () => ipcRenderer.invoke("locale:get"),
  setLocale: (locale: string) => ipcRenderer.invoke("locale:set", locale),

  // MCP
  mcpStatus: (sessionId: string) =>
    ipcRenderer.invoke("mcp:status", sessionId),
  mcpReconnect: (sessionId: string) =>
    ipcRenderer.invoke("mcp:reconnect", sessionId),

  // Upload
  uploadImage: (base64Data: string, fileName: string) =>
    ipcRenderer.invoke("upload:image", base64Data, fileName) as Promise<string>,

  // Agent
  agentStream: (sessionId: string, input: any) =>
    ipcRenderer.invoke("agent:stream", sessionId, input),
  agentGenerate: (sessionId: string, input: any) =>
    ipcRenderer.invoke("agent:generate", sessionId, input),
  agentSummarizeTitle: (sessionId: string) =>
    ipcRenderer.invoke("agent:summarize-title", sessionId),

  // Stream events
  onStreamChunk: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("agent:stream-chunk", handler);
    return () => ipcRenderer.removeListener("agent:stream-chunk", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
