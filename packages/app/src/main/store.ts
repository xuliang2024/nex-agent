import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { SYSTEM_MCP_ID, BUILTIN_TEMPLATES } from "./builtin-templates.js";

function getDefaultDataDir(): string {
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "data");
  } catch {
    return path.join(process.cwd(), ".agent-desktop-data");
  }
}

export interface MCPServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: "http" | "stdio";
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  isSystem?: boolean;
}

export { SYSTEM_MCP_ID };

export interface SkillConfig {
  id: string;
  name: string;
  description?: string;
  path: string;
  tags?: string[];
  createdAt: string;
  source?: "local" | "github" | "agentskill" | "system";
  sourceUrl?: string;
  slug?: string;
  contentSha?: string;
  securityScore?: number;
  qualityScore?: number;
  isSystem?: boolean;
}

export interface SessionConfig {
  instructions: string;
  model: string;
  provider: string;
  providerBaseURL?: string;
  maxSteps: number;
  requireApproval: "all" | "dangerous" | "none";
  mcp: MCPServerConfig[];
  mcpRefs: string[];
  skills: string[];
  skillRefs: string[];
  tools: {
    workspace: boolean;
    sandbox: boolean;
    system?: boolean;
    mcpToolFilter?: string[];
  };
  workspacePath: string;
  sandboxIsolation: "none" | "seatbelt" | "bwrap";
}

export interface Session {
  id: string;
  name: string;
  config: SessionConfig;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  templateId: string;
  updatedAt: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: SessionConfig;
  isBuiltin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBuiltin?: boolean;
  sessionCount: number;
  updatedAt: string;
}

export interface MessageAttachment {
  type: "image";
  data: string;
  name?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  attachments?: MessageAttachment[];
  toolCalls?: any[];
  blocks?: any[];
  createdAt: string;
}

export interface GlobalSettings {
  keys: Record<string, string>;
  defaults: {
    model: string;
    provider: string;
    providerBaseURL?: string;
    instructions: string;
    mcp: MCPServerConfig[];
    skills: string[];
    workspacePath: string;
    requireApproval: "all" | "dangerous" | "none";
  };
}

const DEFAULT_SETTINGS: GlobalSettings = {
  keys: {},
  defaults: {
    model: "anthropic/claude-sonnet-4.6",
    provider: "nexai",
    instructions: "You are a helpful AI assistant.",
    mcp: [],
    skills: [],
    workspacePath: os.homedir(),
    requireApproval: "none",
  },
};

function createDefaultConfig(
  defaults: GlobalSettings["defaults"],
): SessionConfig {
  return {
    instructions: defaults.instructions,
    model: defaults.model,
    provider: defaults.provider,
    providerBaseURL: defaults.providerBaseURL,
    maxSteps: 100,
    requireApproval: defaults.requireApproval,
    mcp: [...defaults.mcp],
    mcpRefs: [],
    skills: [...defaults.skills],
    skillRefs: [],
    tools: { workspace: true, sandbox: true, system: true },
    workspacePath: defaults.workspacePath,
    sandboxIsolation: "none",
  };
}

export interface AuthData {
  token: string | null;
  user: any | null;
  loginAt: string | null;
}

interface StoreData {
  settings: GlobalSettings;
  sessions: Record<string, Session>;
  messages: Record<string, Message[]>;
  mcpLibrary: Record<string, MCPServerConfig>;
  skillLibrary: Record<string, SkillConfig>;
  auth: AuthData;
  locale?: string;
  templates: Record<string, AgentTemplate>;
}

export class AppStore {
  private dataDir: string;
  private dataPath: string;
  private data: StoreData;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || getDefaultDataDir();
    this.dataPath = path.join(this.dataDir, "store.json");

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.data = this.load();
  }

  private load(): StoreData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = JSON.parse(fs.readFileSync(this.dataPath, "utf-8"));
        if (!raw.mcpLibrary) raw.mcpLibrary = {};
        if (!raw.skillLibrary) raw.skillLibrary = {};
        if (!raw.templates) raw.templates = {};
        for (const skill of Object.values(raw.skillLibrary) as any[]) {
          if (!skill.source) skill.source = "local";
        }
        if (!raw.auth) raw.auth = { token: null, user: null, loginAt: null };
        for (const session of Object.values(raw.sessions ?? {}) as any[]) {
          if (!session.config.mcpRefs) session.config.mcpRefs = [];
          if (!session.config.skillRefs) session.config.skillRefs = [];
        }
        // Clean up orphan sessions (no templateId) from before template system
        const orphanIds = Object.keys(raw.sessions ?? {}).filter(
          (id) => !(raw.sessions[id] as any).templateId,
        );
        for (const id of orphanIds) {
          delete raw.sessions[id];
          delete (raw.messages ?? {})[id];
        }
        // Migrate openrouter → nexai for existing sessions, templates, and settings
        this.migrateProvider(raw);
        // Drop the legacy __system_mcp__ HTTP MCP and switch to tools.system = true
        this.migrateSystemMCP(raw);
        return raw;
      }
    } catch {
      // corrupted file, start fresh
    }
    return {
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      sessions: {},
      messages: {},
      mcpLibrary: {},
      skillLibrary: {},
      auth: { token: null, user: null, loginAt: null },
      templates: {},
    };
  }

  private migrateProvider(raw: any): void {
    const migrate = (cfg: any) => {
      if (cfg?.provider === "openrouter") {
        cfg.provider = "nexai";
      }
      if (cfg?.model === "claude-sonnet-4-6") {
        cfg.model = "anthropic/claude-sonnet-4.6";
      }
    };

    migrate(raw.settings?.defaults);
    for (const session of Object.values(raw.sessions ?? {}) as any[]) {
      migrate(session.config);
    }
    for (const template of Object.values(raw.templates ?? {}) as any[]) {
      migrate(template.config);
    }
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
  }

  // --- Settings ---

  getSettings(): GlobalSettings {
    return this.data.settings;
  }

  saveSettings(settings: GlobalSettings): void {
    this.data.settings = settings;
    this.save();
  }

  // --- MCP Library ---

  listMCPLibrary(): MCPServerConfig[] {
    return Object.values(this.data.mcpLibrary);
  }

  getMCPFromLibrary(id: string): MCPServerConfig | null {
    return this.data.mcpLibrary[id] ?? null;
  }

  addMCPToLibrary(config: Omit<MCPServerConfig, "id">): MCPServerConfig {
    const id = crypto.randomUUID();
    const entry: MCPServerConfig = { ...config, id };
    this.data.mcpLibrary[id] = entry;
    this.save();
    return entry;
  }

  updateMCPInLibrary(
    id: string,
    partial: Partial<MCPServerConfig>,
  ): MCPServerConfig | null {
    const existing = this.data.mcpLibrary[id];
    if (!existing) return null;
    const updated = { ...existing, ...partial, id };
    this.data.mcpLibrary[id] = updated;
    this.save();
    return updated;
  }

  removeMCPFromLibrary(id: string): void {
    const entry = this.data.mcpLibrary[id];
    if (entry?.isSystem) return;
    delete this.data.mcpLibrary[id];
    this.save();
  }

  /**
   * One-shot migration: if a legacy `__system_mcp__` HTTP MCP entry exists,
   * remove it and rewire any session/template that referenced it to use the
   * new `tools.system = true` flag (which mounts the apiz-sdk powered system
   * tools directly inside the session agent). Idempotent.
   */
  private migrateSystemMCP(raw: any): boolean {
    let changed = false;
    if (raw.mcpLibrary && raw.mcpLibrary[SYSTEM_MCP_ID]) {
      delete raw.mcpLibrary[SYSTEM_MCP_ID];
      changed = true;
    }
    const rewireConfig = (cfg: any): boolean => {
      if (!cfg) return false;
      let mut = false;
      if (Array.isArray(cfg.mcpRefs) && cfg.mcpRefs.includes(SYSTEM_MCP_ID)) {
        cfg.mcpRefs = cfg.mcpRefs.filter((r: string) => r !== SYSTEM_MCP_ID);
        mut = true;
      }
      if (Array.isArray(cfg.mcp)) {
        const filtered = cfg.mcp.filter((m: any) => m?.id !== SYSTEM_MCP_ID);
        if (filtered.length !== cfg.mcp.length) {
          cfg.mcp = filtered;
          mut = true;
        }
      }
      if (cfg.tools && cfg.tools.system === undefined) {
        cfg.tools.system = true;
        mut = true;
      }
      return mut;
    };
    for (const session of Object.values(raw.sessions ?? {}) as any[]) {
      if (rewireConfig(session.config)) changed = true;
    }
    for (const template of Object.values(raw.templates ?? {}) as any[]) {
      if (rewireConfig(template.config)) changed = true;
    }
    return changed;
  }

  // --- Skill Library ---

  listSkillLibrary(): SkillConfig[] {
    return Object.values(this.data.skillLibrary);
  }

  getSkillFromLibrary(id: string): SkillConfig | null {
    return this.data.skillLibrary[id] ?? null;
  }

  addSkillToLibrary(
    config: Omit<SkillConfig, "id" | "createdAt">,
  ): SkillConfig {
    const id = crypto.randomUUID();
    const entry: SkillConfig = {
      ...config,
      id,
      createdAt: new Date().toISOString(),
    };
    this.data.skillLibrary[id] = entry;
    this.save();
    return entry;
  }

  updateSkillInLibrary(
    id: string,
    partial: Partial<SkillConfig>,
  ): SkillConfig | null {
    const existing = this.data.skillLibrary[id];
    if (!existing) return null;
    const updated = { ...existing, ...partial, id };
    this.data.skillLibrary[id] = updated;
    this.save();
    return updated;
  }

  removeSkillFromLibrary(id: string): void {
    const entry = this.data.skillLibrary[id];
    if (entry?.isSystem) return;
    delete this.data.skillLibrary[id];
    this.save();
  }

  getSkillsDir(): string {
    return path.join(this.dataDir, "skills");
  }

  ensureSystemSkills(resourcesDir: string): void {
    const sysSkillsSource = path.join(resourcesDir, "system-skills");
    if (!fs.existsSync(sysSkillsSource)) return;

    const destBase = path.join(this.getSkillsDir(), "system");
    if (!fs.existsSync(destBase)) fs.mkdirSync(destBase, { recursive: true });

    const dirs = fs.readdirSync(sysSkillsSource, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const skillDir = path.join(sysSkillsSource, d.name);
      const manifestPath = path.join(skillDir, "manifest.json");
      const skillMdPath = path.join(skillDir, "SKILL.md");
      if (!fs.existsSync(manifestPath) || !fs.existsSync(skillMdPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const sysId = `__sys_${d.name}__`;
      const destDir = path.join(destBase, d.name);
      const destFile = path.join(destDir, "SKILL.md");

      const sourceHash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(skillMdPath))
        .digest("hex")
        .slice(0, 12);

      const existing = this.data.skillLibrary[sysId];
      const needsCopy =
        !existing ||
        !fs.existsSync(destFile) ||
        existing.contentSha !== sourceHash;

      if (needsCopy) {
        if (!fs.existsSync(destDir))
          fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(skillMdPath, destFile);
      }

      this.data.skillLibrary[sysId] = {
        id: sysId,
        name: manifest.name || d.name,
        description: manifest.description,
        path: destFile,
        tags: manifest.tags ?? existing?.tags,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        source: "system",
        contentSha: sourceHash,
        isSystem: true,
      };
    }
    this.save();
  }

  getSystemSkillIds(): string[] {
    return Object.keys(this.data.skillLibrary).filter(
      (id) => this.data.skillLibrary[id]?.isSystem,
    );
  }

  // --- Resolve refs ---

  resolveSessionMCP(mcpRefs: string[]): MCPServerConfig[] {
    const results: MCPServerConfig[] = [];
    for (const ref of mcpRefs) {
      const entry = this.data.mcpLibrary[ref];
      if (entry) results.push({ ...entry, enabled: true });
    }
    return results;
  }

  resolveSessionSkills(skillRefs: string[]): string[] {
    const results: string[] = [];
    for (const ref of skillRefs) {
      const entry = this.data.skillLibrary[ref];
      if (entry) results.push(entry.path);
    }
    return results;
  }

  // --- Sessions ---

  createSession(templateId: string, name?: string): Session {
    const template = this.data.templates[templateId];
    const config = template
      ? JSON.parse(JSON.stringify(template.config)) as SessionConfig
      : createDefaultConfig(this.data.settings.defaults);

    if (template) {
      config.workspacePath = this.data.settings.defaults.workspacePath || os.homedir();
      const resolvedMcp = this.resolveSessionMCP(config.mcpRefs);
      const inlineOnly = config.mcp.filter((m) => !config.mcpRefs.includes(m.id));
      config.mcp = [...resolvedMcp, ...inlineOnly];
      const resolvedSkills = this.resolveSessionSkills(config.skillRefs);
      const inlineOnly2 = config.skills.filter((s) => !resolvedSkills.includes(s));
      config.skills = [...resolvedSkills, ...inlineOnly2];
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const sessionName = name || `Session ${now.slice(5, 16).replace("T", " ")}`;

    const session: Session = { id, name: sessionName, config, templateId, createdAt: now, updatedAt: now };
    this.data.sessions[id] = session;
    this.data.messages[id] = [];
    this.save();
    return session;
  }

  getSession(id: string): Session | null {
    return this.data.sessions[id] || null;
  }

  listSessions(): SessionSummary[] {
    return Object.values(this.data.sessions)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((s) => ({ id: s.id, name: s.name, templateId: s.templateId, updatedAt: s.updatedAt }));
  }

  listSessionsByTemplate(templateId: string): SessionSummary[] {
    return Object.values(this.data.sessions)
      .filter((s) => s.templateId === templateId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((s) => ({ id: s.id, name: s.name, templateId: s.templateId, updatedAt: s.updatedAt }));
  }

  updateSessionConfig(
    id: string,
    partial: Partial<SessionConfig>,
  ): Session | null {
    const session = this.data.sessions[id];
    if (!session) return null;

    if (partial.tools) {
      partial.tools = { ...session.config.tools, ...partial.tools };
    }
    session.config = { ...session.config, ...partial };

    if (partial.mcpRefs !== undefined) {
      const resolved = this.resolveSessionMCP(session.config.mcpRefs);
      const inlineOnly = session.config.mcp.filter(
        (m) => !session.config.mcpRefs.includes(m.id),
      );
      session.config.mcp = [...resolved, ...inlineOnly];
    }
    if (partial.skillRefs !== undefined) {
      const resolved = this.resolveSessionSkills(session.config.skillRefs);
      const inlineOnly = session.config.skills.filter(
        (s) => !resolved.includes(s),
      );
      session.config.skills = [...resolved, ...inlineOnly];
    }

    session.updatedAt = new Date().toISOString();
    this.save();
    return session;
  }

  renameSession(id: string, name: string): void {
    const session = this.data.sessions[id];
    if (!session) return;
    session.name = name;
    session.updatedAt = new Date().toISOString();
    this.save();
  }

  deleteSession(id: string): void {
    delete this.data.sessions[id];
    delete this.data.messages[id];
    this.save();
  }

  // --- Messages ---

  saveMessage(msg: Message): void {
    if (!this.data.messages[msg.sessionId]) {
      this.data.messages[msg.sessionId] = [];
    }
    this.data.messages[msg.sessionId].push(msg);
    const session = this.data.sessions[msg.sessionId];
    if (session) {
      session.updatedAt = new Date().toISOString();
    }
    this.save();
  }

  getMessages(sessionId: string, limit = 50, offset = 0): Message[] {
    const msgs = this.data.messages[sessionId] || [];
    return msgs.slice(offset, offset + limit);
  }

  // --- Auth ---

  getAuth(): AuthData {
    return this.data.auth;
  }

  saveAuth(token: string | null, user: any | null): void {
    this.data.auth = {
      token,
      user,
      loginAt: token ? new Date().toISOString() : null,
    };
    this.save();
  }

  // --- Locale ---

  getLocale(): string {
    return this.data.locale || "zh-CN";
  }

  setLocale(locale: string): void {
    this.data.locale = locale;
    this.save();
  }

  // --- Templates ---

  ensureBuiltinTemplates(): void {
    const now = new Date().toISOString();
    let changed = false;
    for (const tpl of BUILTIN_TEMPLATES) {
      const existing = this.data.templates[tpl.id];
      if (!existing) {
        this.data.templates[tpl.id] = { ...tpl, createdAt: now, updatedAt: now };
        changed = true;
      } else if (existing.isBuiltin) {
        existing.config = JSON.parse(JSON.stringify(tpl.config));
        existing.name = tpl.name;
        existing.description = tpl.description;
        existing.icon = tpl.icon;
        existing.updatedAt = now;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  listTemplates(): AgentTemplateSummary[] {
    return Object.values(this.data.templates)
      .sort((a, b) => {
        if (a.isBuiltin && !b.isBuiltin) return -1;
        if (!a.isBuiltin && b.isBuiltin) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        icon: t.icon,
        isBuiltin: t.isBuiltin,
        sessionCount: Object.values(this.data.sessions).filter((s) => s.templateId === t.id).length,
        updatedAt: t.updatedAt,
      }));
  }

  getTemplate(id: string): AgentTemplate | null {
    return this.data.templates[id] ?? null;
  }

  createTemplate(meta: { name: string; description: string; icon: string; config: SessionConfig }): AgentTemplate {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const template: AgentTemplate = {
      id,
      name: meta.name,
      description: meta.description,
      icon: meta.icon,
      config: JSON.parse(JSON.stringify(meta.config)),
      createdAt: now,
      updatedAt: now,
    };
    this.data.templates[id] = template;
    this.save();
    return template;
  }

  createTemplateFromSession(sessionId: string, meta: { name: string; description: string; icon: string }): AgentTemplate | null {
    const session = this.data.sessions[sessionId];
    if (!session) return null;
    const template = this.createTemplate({ ...meta, config: session.config });
    session.templateId = template.id;
    session.updatedAt = new Date().toISOString();
    this.save();
    return template;
  }

  updateTemplate(id: string, partial: Partial<Pick<AgentTemplate, "name" | "description" | "icon" | "config">>): AgentTemplate | null {
    const existing = this.data.templates[id];
    if (!existing) return null;
    if (partial.name !== undefined) existing.name = partial.name;
    if (partial.description !== undefined) existing.description = partial.description;
    if (partial.icon !== undefined) existing.icon = partial.icon;
    if (partial.config !== undefined) existing.config = JSON.parse(JSON.stringify(partial.config));
    existing.updatedAt = new Date().toISOString();
    this.save();
    return existing;
  }

  deleteTemplate(id: string): boolean {
    const template = this.data.templates[id];
    if (!template || template.isBuiltin) return false;
    for (const sid of Object.keys(this.data.sessions)) {
      if (this.data.sessions[sid].templateId === id) {
        delete this.data.sessions[sid];
        delete this.data.messages[sid];
      }
    }
    delete this.data.templates[id];
    this.save();
    return true;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  // --- Model Cache ---

  private modelCache: { data: any[]; fetchedAt: number } | null = null;
  private static MODEL_CACHE_TTL = 10 * 60 * 1000; // 10 min

  private get modelCachePath(): string {
    return path.join(this.dataDir, "model-cache.json");
  }

  getModelCache(): any[] | null {
    if (
      this.modelCache &&
      Date.now() - this.modelCache.fetchedAt < AppStore.MODEL_CACHE_TTL
    ) {
      return this.modelCache.data;
    }
    try {
      if (fs.existsSync(this.modelCachePath)) {
        const raw = JSON.parse(
          fs.readFileSync(this.modelCachePath, "utf-8"),
        );
        if (
          Array.isArray(raw.data) &&
          raw.fetchedAt &&
          Date.now() - raw.fetchedAt < AppStore.MODEL_CACHE_TTL
        ) {
          this.modelCache = raw;
          return raw.data;
        }
      }
    } catch {
      // ignore corrupted cache
    }
    return null;
  }

  getModelCacheStale(): any[] | null {
    if (this.modelCache) return this.modelCache.data;
    try {
      if (fs.existsSync(this.modelCachePath)) {
        const raw = JSON.parse(
          fs.readFileSync(this.modelCachePath, "utf-8"),
        );
        if (Array.isArray(raw.data)) {
          this.modelCache = raw;
          return raw.data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  setModelCache(data: any[]): void {
    const entry = { data, fetchedAt: Date.now() };
    this.modelCache = entry;
    try {
      fs.writeFileSync(this.modelCachePath, JSON.stringify(entry));
    } catch {
      // non-critical
    }
  }
}
