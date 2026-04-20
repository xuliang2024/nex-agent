import {
  SessionAgentEngine,
  type AgentEngineOptions,
  type StreamResult,
  type StreamEvent,
  type MCPServerStatus,
} from "./session-agent.js";
import type { SessionConfig } from "../config/types.js";

export class AgentManager {
  private engines = new Map<string, SessionAgentEngine>();
  private apiKeys: Record<string, string> = {};

  setApiKeys(keys: Record<string, string>): void {
    this.apiKeys = { ...keys };
  }

  async getOrCreate(
    sessionId: string,
    config: SessionConfig,
  ): Promise<SessionAgentEngine> {
    const existing = this.engines.get(sessionId);
    if (existing) return existing;

    const engine = new SessionAgentEngine({
      sessionId,
      config,
      apiKeys: this.apiKeys,
    });

    await engine.init();
    this.engines.set(sessionId, engine);
    return engine;
  }

  async rebuild(
    sessionId: string,
    config: SessionConfig,
  ): Promise<SessionAgentEngine> {
    await this.dispose(sessionId);
    return this.getOrCreate(sessionId, config);
  }

  async generate(
    sessionId: string,
    config: SessionConfig,
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
  ): Promise<StreamResult> {
    const engine = await this.getOrCreate(sessionId, config);
    return engine.generate(input, history);
  }

  async *stream(
    sessionId: string,
    config: SessionConfig,
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
  ): AsyncGenerator<StreamEvent> {
    const engine = await this.getOrCreate(sessionId, config);
    yield* engine.stream(input, history);
  }

  async reconnectMCP(
    sessionId: string,
    config: SessionConfig,
  ): Promise<MCPServerStatus[]> {
    const engine = await this.getOrCreate(sessionId, config);
    return engine.reconnectMCP();
  }

  getMCPStatus(sessionId: string): MCPServerStatus[] {
    const engine = this.engines.get(sessionId);
    if (!engine) return [];
    return engine.getMCPStatus();
  }

  async dispose(sessionId: string): Promise<void> {
    const engine = this.engines.get(sessionId);
    if (engine) {
      await engine.dispose();
      this.engines.delete(sessionId);
    }
  }

  async disposeAll(): Promise<void> {
    const promises = Array.from(this.engines.keys()).map((id) =>
      this.dispose(id),
    );
    await Promise.all(promises);
  }

  has(sessionId: string): boolean {
    return this.engines.has(sessionId);
  }

  get size(): number {
    return this.engines.size;
  }
}
