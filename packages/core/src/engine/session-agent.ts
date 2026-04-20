import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { MCPClient } from "@mastra/mcp";
import type { SessionConfig, MCPServerConfig } from "../config/types.js";
import {
  buildWorkspaceTools,
  buildSandboxTools,
} from "../tools/workspace-tools.js";
import {
  APIZ_SYSTEM_TOOL_NAMES,
  buildApizTools,
} from "../tools/apiz-tools.js";

const SYSTEM_TOOLS_STATUS_ID = "__system_tools__";
const SYSTEM_TOOLS_STATUS_NAME = "NEX AI (SDK)";

export interface AgentEngineOptions {
  sessionId: string;
  config: SessionConfig;
  apiKeys: Record<string, string>;
}

export interface StreamResult {
  text: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  }>;
}

export type StreamEventType =
  | "text-delta"
  | "reasoning"
  | "tool-call"
  | "tool-result"
  | "tool-error"
  | "step-start"
  | "step-finish"
  | "done"
  | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: any;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  status: "connected" | "failed" | "disconnected";
  error?: string;
  toolCount: number;
}

function buildModelId(config: SessionConfig): string {
  return config.model;
}

function buildProvider(config: SessionConfig, apiKeys: Record<string, string>) {
  const baseURL = config.providerBaseURL || "https://api.xskill.ai/v3";
  const apiKey = apiKeys.NEXAI_API_KEY || "";

  return createOpenAICompatible({
    name: "nexai",
    baseURL,
    apiKey,
  });
}

function buildInstructions(
  config: SessionConfig,
  skillContents: string[],
): string {
  let instructions = config.instructions || "";

  if (skillContents.length > 0) {
    instructions += "\n\n## Available Skills\n\n";
    for (const skill of skillContents) {
      instructions += skill + "\n\n---\n\n";
    }
  }

  if (config.tools.workspace) {
    instructions +=
      "\n\n## Tool Priority\nWhen uploading local files to get a public URL, always prefer the built-in `uploadFile` tool over any MCP upload/transfer tools.\n";
  }

  return instructions;
}

function buildMCPConfig(
  servers: MCPServerConfig[],
): ConstructorParameters<typeof MCPClient>[0] | null {
  const enabled = servers.filter((s) => s.enabled);
  if (enabled.length === 0) return null;

  const serversConfig: Record<string, any> = {};
  for (const server of enabled) {
    if (server.transport === "stdio" && server.command) {
      serversConfig[server.id] = {
        command: server.command,
        args: server.args || [],
        env: server.env || {},
      };
    } else if (server.transport === "http" && server.url) {
      const httpConfig: Record<string, any> = {
        url: new URL(server.url),
        connectTimeout: 30_000,
        timeout: 30_000,
      };
      if (server.headers) {
        httpConfig.requestInit = { headers: server.headers };
      }
      console.log(`[mcp-config] HTTP server "${server.id}" connectTimeout=30000`);
      serversConfig[server.id] = httpConfig;
    }
  }

  if (Object.keys(serversConfig).length === 0) return null;
  return { servers: serversConfig, timeout: 30_000 } as any;
}

function buildMCPConfigWithId(
  sessionId: string,
  servers: MCPServerConfig[],
): ConstructorParameters<typeof MCPClient>[0] | null {
  const base = buildMCPConfig(servers);
  if (!base) return null;
  return { ...base, id: `mcp-${sessionId}-${Date.now()}` } as any;
}

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string; mimeType?: string; mediaType?: string };

function detectMimeFromBase64(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("R0lG")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

function extractMimeAndBase64(data: string): {
  base64: string;
  mimeType: string;
} {
  const match = data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (match) {
    const declaredMime = match[1];
    const actualMime = detectMimeFromBase64(match[2]);
    if (declaredMime !== actualMime) {
      console.log(
        `[image] MIME type corrected: ${declaredMime} → ${actualMime}`,
      );
    }
    return { mimeType: actualMime, base64: match[2] };
  }
  return { mimeType: detectMimeFromBase64(data), base64: data };
}

function extractStreamError(err: any): string {
  const msg = err?.message || String(err);

  // Try parsing the message itself as JSON (nested error pattern)
  try {
    const parsed = JSON.parse(msg);
    const deep =
      parsed?.error?.metadata?.raw &&
      JSON.parse(parsed.error.metadata.raw)?.error?.message;
    if (deep) return deep;
    const apiMsg = parsed?.error?.message || parsed?.message;
    if (apiMsg) return apiMsg;
  } catch {}

  const sources = [
    err?.cause?.responseBody,
    err?.responseBody,
    err?.cause?.body,
    err?.body,
  ];
  for (const src of sources) {
    if (!src) continue;
    try {
      const body = typeof src === "string" ? src : JSON.stringify(src);
      const parsed = JSON.parse(body);
      const apiMsg =
        parsed?.error?.message || parsed?.message || parsed?.detail;
      if (apiMsg) return apiMsg;
    } catch {}
  }

  if (err?.data?.error?.message) return err.data.error.message;
  if (err?.data?.message) return err.data.message;
  if (err?.cause?.message && err.cause.message !== msg) {
    return `${msg} — ${err.cause.message}`;
  }
  return msg;
}

function buildUserContent(input: any): string | UserContentPart[] {
  if (typeof input === "string") return input;
  const parts: UserContentPart[] = [];
  if (input.text) parts.push({ type: "text", text: input.text });

  for (const att of input.attachments ?? []) {
    if (att.type === "image" && att.data) {
      const { base64, mimeType } = extractMimeAndBase64(att.data);
      parts.push({
        type: "image",
        image: base64,
        mimeType,
        mediaType: mimeType,
      });
    }
  }
  return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

function buildMessageContent(
  content: string,
  attachments?: any[],
): string | UserContentPart[] {
  if (!attachments?.length) return content;
  return buildUserContent({ text: content, attachments });
}

const MCP_CONNECT_TIMEOUT = 15_000;
const MCP_MAX_RETRIES = 2;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export class SessionAgentEngine {
  private agent: Agent | null = null;
  private mcpClient: MCPClient | null = null;
  private sessionId: string;
  private config: SessionConfig;
  private apiKeys: Record<string, string>;
  private mcpServerStatus: Map<string, MCPServerStatus> = new Map();
  private systemToolsStatus: MCPServerStatus | null = null;

  constructor(options: AgentEngineOptions) {
    this.sessionId = options.sessionId;
    this.config = options.config;
    this.apiKeys = options.apiKeys;
  }

  async init(): Promise<void> {
    const provider = buildProvider(this.config, this.apiKeys);
    const modelId = buildModelId(this.config);
    const model = provider.chatModel(modelId);

    const skillContents = await this.loadSkills();
    const instructions = buildInstructions(this.config, skillContents);

    const mcpConfig = buildMCPConfigWithId(this.sessionId, this.config.mcp);
    if (mcpConfig) {
      this.mcpClient = new MCPClient(mcpConfig);
    }

    const tools: Record<string, any> = {};

    if (this.config.tools.workspace && this.config.workspacePath) {
      Object.assign(tools, buildWorkspaceTools(this.config.workspacePath));
    }
    if (this.config.tools.sandbox && this.config.workspacePath) {
      Object.assign(tools, buildSandboxTools(this.config.workspacePath));
    }
    if (this.config.tools.system) {
      const systemTools = this.buildSystemTools();
      Object.assign(tools, systemTools);
    }

    if (this.mcpClient) {
      const mcpTools = await this.connectMCPWithRetry();
      Object.assign(tools, mcpTools);
    }

    this.agent = new Agent({
      id: `session-${this.sessionId}`,
      name: `session-${this.sessionId}`,
      instructions,
      model,
      tools,
    });
  }

  private async connectMCPWithRetry(): Promise<Record<string, any>> {
    if (!this.mcpClient) return {};

    const enabledServers = this.config.mcp.filter((s) => s.enabled);
    for (const server of enabledServers) {
      this.mcpServerStatus.set(server.id, {
        id: server.id,
        name: server.name,
        status: "disconnected",
        toolCount: 0,
      });
    }

    for (let attempt = 1; attempt <= MCP_MAX_RETRIES; attempt++) {
      try {
        const mcpTools = await withTimeout(
          this.mcpClient.listTools(),
          MCP_CONNECT_TIMEOUT,
        );

        for (const server of enabledServers) {
          const prefix = `${server.id}_`;
          const count = Object.keys(mcpTools).filter(
            (k) => k.startsWith(prefix) || enabledServers.length === 1,
          ).length;
          this.mcpServerStatus.set(server.id, {
            id: server.id,
            name: server.name,
            status: "connected",
            toolCount: count || Object.keys(mcpTools).length,
          });
        }

        console.log(
          `[session-agent] MCP connected: ${Object.keys(mcpTools).length} tools loaded (attempt ${attempt})`,
        );
        return mcpTools;
      } catch (err: any) {
        console.error(
          `[session-agent] MCP connect attempt ${attempt}/${MCP_MAX_RETRIES} failed: ${err.message}`,
        );

        for (const server of enabledServers) {
          this.mcpServerStatus.set(server.id, {
            id: server.id,
            name: server.name,
            status: "failed",
            error: err.message,
            toolCount: 0,
          });
        }

        if (attempt < MCP_MAX_RETRIES) {
          const delay = attempt * 2000;
          console.log(`[session-agent] Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    console.error(
      `[session-agent] MCP failed after ${MCP_MAX_RETRIES} attempts, agent will start without MCP tools`,
    );
    return {};
  }

  async reconnectMCP(): Promise<MCPServerStatus[]> {
    if (!this.mcpClient) {
      return [];
    }

    try {
      await this.mcpClient.disconnect();
    } catch {}

    const mcpConfig = buildMCPConfigWithId(this.sessionId, this.config.mcp);
    if (!mcpConfig) {
      this.mcpClient = null;
      this.mcpServerStatus.clear();
      return [];
    }

    this.mcpClient = new MCPClient(mcpConfig);
    const mcpTools = await this.connectMCPWithRetry();

    if (Object.keys(mcpTools).length > 0) {
      await this.rebuildAgentWithNewTools(mcpTools);
    }

    return this.getMCPStatus();
  }

  private async rebuildAgentWithNewTools(
    mcpTools: Record<string, any>,
  ): Promise<void> {
    if (!this.agent) return;

    const provider = buildProvider(this.config, this.apiKeys);
    const modelId = buildModelId(this.config);
    const model = provider.chatModel(modelId);
    const skillContents = await this.loadSkills();
    const instructions = buildInstructions(this.config, skillContents);

    const tools: Record<string, any> = {};
    if (this.config.tools.workspace && this.config.workspacePath) {
      Object.assign(tools, buildWorkspaceTools(this.config.workspacePath));
    }
    if (this.config.tools.sandbox && this.config.workspacePath) {
      Object.assign(tools, buildSandboxTools(this.config.workspacePath));
    }
    if (this.config.tools.system) {
      Object.assign(tools, this.buildSystemTools());
    }
    Object.assign(tools, mcpTools);

    this.agent = new Agent({
      id: `session-${this.sessionId}`,
      name: `session-${this.sessionId}`,
      instructions,
      model,
      tools,
    });
  }

  private buildSystemTools(): Record<string, any> {
    const apizKey = this.apiKeys.NEXAI_API_KEY;
    if (!apizKey) {
      this.systemToolsStatus = {
        id: SYSTEM_TOOLS_STATUS_ID,
        name: SYSTEM_TOOLS_STATUS_NAME,
        status: "failed",
        error: "NEXAI_API_KEY missing — sign in to enable system tools.",
        toolCount: 0,
      };
      return {};
    }
    const tools = buildApizTools({ apiKey: apizKey });
    this.systemToolsStatus = {
      id: SYSTEM_TOOLS_STATUS_ID,
      name: SYSTEM_TOOLS_STATUS_NAME,
      status: "connected",
      toolCount: APIZ_SYSTEM_TOOL_NAMES.length,
    };
    return tools;
  }

  getMCPStatus(): MCPServerStatus[] {
    const list = Array.from(this.mcpServerStatus.values());
    if (this.systemToolsStatus) {
      list.unshift(this.systemToolsStatus);
    }
    return list;
  }

  private async loadSkills(): Promise<string[]> {
    const fs = await import("node:fs");
    const results: string[] = [];

    for (const skillPath of this.config.skills) {
      try {
        const content = fs.readFileSync(skillPath, "utf-8");
        results.push(content);
      } catch {
        results.push(`[Skill not found: ${skillPath}]`);
      }
    }

    return results;
  }

  async generate(
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
  ): Promise<StreamResult> {
    if (!this.agent) {
      throw new Error("Agent not initialized. Call init() first.");
    }

    const messages: any[] = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: buildMessageContent(m.content, m.attachments),
      })),
      { role: "user" as const, content: buildUserContent(input) },
    ];

    const result = await this.agent.generate(messages, {
      maxSteps: this.config.maxSteps,
    });

    return {
      text: result.text,
      toolCalls: result.toolResults?.map((tr: any) => ({
        id: tr.toolCallId,
        name: tr.toolName,
        args: tr.args,
        result: tr.result,
      })),
    };
  }

  async *stream(
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
  ): AsyncGenerator<StreamEvent> {
    if (!this.agent) {
      throw new Error("Agent not initialized. Call init() first.");
    }

    const messages: any[] = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: buildMessageContent(m.content, m.attachments),
      })),
      { role: "user" as const, content: buildUserContent(input) },
    ];

    let result: any;
    try {
      result = await this.agent.stream(messages, {
        maxSteps: this.config.maxSteps,
      });
    } catch (err: any) {
      const detail = extractStreamError(err);
      console.error("[session-agent] stream init error:", detail);
      yield { type: "error" as const, data: { message: detail } };
      yield { type: "done" as const, data: null };
      return;
    }

    const reader = result.fullStream.getReader();
    try {
      while (true) {
        let readResult: any;
        try {
          readResult = await reader.read();
        } catch (err: any) {
          const detail = extractStreamError(err);
          console.error("[session-agent] stream read error:", detail);
          yield { type: "error" as const, data: { message: detail } };
          break;
        }
        const { done, value } = readResult;
        if (done) break;

        const chunk = value as any;
        const p = chunk.payload;
        switch (chunk.type) {
          case "text-delta":
            if (p?.text) {
              yield { type: "text-delta", data: { text: p.text } };
            }
            break;
          case "reasoning-delta":
          case "reasoning":
            if (p?.text) {
              yield { type: "reasoning", data: { text: p.text } };
            }
            break;
          case "tool-call":
            yield {
              type: "tool-call",
              data: {
                id: p?.toolCallId,
                name: p?.toolName,
                args: p?.args,
              },
            };
            break;
          case "tool-result":
            yield {
              type: "tool-result",
              data: {
                id: p?.toolCallId,
                name: p?.toolName,
                result: p?.result,
                isError: p?.isError ?? false,
              },
            };
            break;
          case "tool-error":
            yield {
              type: "tool-error",
              data: {
                id: p?.toolCallId,
                name: p?.toolName,
                error: p?.error?.toString?.() ?? String(p?.error),
              },
            };
            break;
          case "step-start":
            yield { type: "step-start", data: {} };
            break;
          case "step-finish": {
            const usage = p?.output?.usage ?? p?.totalUsage ?? chunk.usage;
            yield {
              type: "step-finish",
              data: {
                text: p?.stepResult?.text ?? chunk.text,
                usage,
              },
            };
            break;
          }
          case "error": {
            const err = p?.error;
            let errMsg = err?.toString?.() ?? String(err);
            try {
              const deepMsg = extractStreamError(err);
              if (deepMsg && deepMsg !== errMsg) errMsg = deepMsg;
            } catch {}
            yield {
              type: "error",
              data: { message: errMsg },
            };
            break;
          }
          case "finish":
            break;
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done", data: null };
  }

  async dispose(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.disconnect();
      this.mcpClient = null;
    }
    this.mcpServerStatus.clear();
    this.systemToolsStatus = null;
    this.agent = null;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getConfig(): SessionConfig {
    return { ...this.config };
  }
}
