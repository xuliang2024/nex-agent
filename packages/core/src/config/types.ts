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
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ToolCallInfo[];
  createdAt: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: "pending" | "approved" | "denied" | "completed" | "error";
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

export function createDefaultGlobalSettings(): GlobalSettings {
  return {
    keys: {},
    defaults: {
      model: "anthropic/claude-sonnet-4.6",
      provider: "nexai",
      instructions:
        "You are a helpful AI assistant. You can use tools to help complete tasks.",
      mcp: [],
      skills: [],
      workspacePath: "",
      requireApproval: "dangerous",
    },
  };
}

export function createSessionConfigFromDefaults(
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
    tools: {
      workspace: true,
      sandbox: true,
      system: true,
    },
    workspacePath: defaults.workspacePath,
    sandboxIsolation: "none",
  };
}
