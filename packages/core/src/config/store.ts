import { LibSQLStore } from "@mastra/libsql";
import type {
  GlobalSettings,
  Session,
  SessionConfig,
  SessionSummary,
  Message,
} from "./types.js";
import {
  createDefaultGlobalSettings,
  createSessionConfigFromDefaults,
} from "./types.js";

export class ConfigStore {
  private db: LibSQLStore;
  private initialized = false;

  constructor(dbUrl: string = "file:./agent-desktop.db") {
    this.db = new LibSQLStore({ id: "agent-desktop-store", url: dbUrl });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const client = (this.db as any).client;
    if (!client) {
      throw new Error("LibSQLStore client not available");
    }

    await client.execute(`
      CREATE TABLE IF NOT EXISTS global_settings (
        id TEXT PRIMARY KEY DEFAULT 'singleton',
        data TEXT NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)
    `);

    this.initialized = true;
  }

  private getClient() {
    const client = (this.db as any).client;
    if (!client) throw new Error("DB not initialized");
    return client;
  }

  // --- Global Settings ---

  async getSettings(): Promise<GlobalSettings> {
    await this.init();
    const client = this.getClient();
    const result = await client.execute(
      "SELECT data FROM global_settings WHERE id = 'singleton'",
    );
    if (result.rows.length === 0) {
      return createDefaultGlobalSettings();
    }
    return JSON.parse(result.rows[0].data as string);
  }

  async saveSettings(settings: GlobalSettings): Promise<void> {
    await this.init();
    const client = this.getClient();
    await client.execute({
      sql: `INSERT INTO global_settings (id, data) VALUES ('singleton', ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      args: [JSON.stringify(settings)],
    });
  }

  // --- Sessions ---

  async createSession(name?: string): Promise<Session> {
    await this.init();
    const settings = await this.getSettings();
    const config = createSessionConfigFromDefaults(settings.defaults);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const session: Session = {
      id,
      name: name || `Session ${now.slice(5, 16).replace("T", " ")}`,
      config,
      createdAt: now,
      updatedAt: now,
    };

    const client = this.getClient();
    await client.execute({
      sql: "INSERT INTO sessions (id, name, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        session.id,
        session.name,
        JSON.stringify(session.config),
        session.createdAt,
        session.updatedAt,
      ],
    });

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    await this.init();
    const client = this.getClient();
    const result = await client.execute({
      sql: "SELECT * FROM sessions WHERE id = ?",
      args: [id],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      config: JSON.parse(row.config as string),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async listSessions(): Promise<SessionSummary[]> {
    await this.init();
    const client = this.getClient();
    const result = await client.execute(
      "SELECT id, name, updated_at FROM sessions ORDER BY updated_at DESC",
    );
    return result.rows.map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async updateSessionConfig(
    id: string,
    partial: Partial<SessionConfig>,
  ): Promise<Session | null> {
    await this.init();
    const session = await this.getSession(id);
    if (!session) return null;

    session.config = { ...session.config, ...partial };
    session.updatedAt = new Date().toISOString();

    const client = this.getClient();
    await client.execute({
      sql: "UPDATE sessions SET config = ?, updated_at = ? WHERE id = ?",
      args: [JSON.stringify(session.config), session.updatedAt, id],
    });

    return session;
  }

  async renameSession(id: string, name: string): Promise<void> {
    await this.init();
    const client = this.getClient();
    await client.execute({
      sql: "UPDATE sessions SET name = ?, updated_at = ? WHERE id = ?",
      args: [name, new Date().toISOString(), id],
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.init();
    const client = this.getClient();
    await client.execute({ sql: "DELETE FROM messages WHERE session_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [id] });
  }

  // --- Messages ---

  async saveMessage(msg: Message): Promise<void> {
    await this.init();
    const client = this.getClient();
    await client.execute({
      sql: "INSERT INTO messages (id, session_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [
        msg.id,
        msg.sessionId,
        msg.role,
        msg.content,
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.createdAt,
      ],
    });
    await client.execute({
      sql: "UPDATE sessions SET updated_at = ? WHERE id = ?",
      args: [new Date().toISOString(), msg.sessionId],
    });
  }

  async getMessages(
    sessionId: string,
    limit = 50,
    offset = 0,
  ): Promise<Message[]> {
    await this.init();
    const client = this.getClient();
    const result = await client.execute({
      sql: "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?",
      args: [sessionId, limit, offset],
    });
    return result.rows.map((row: any) => ({
      id: row.id as string,
      sessionId: row.session_id as string,
      role: row.role as Message["role"],
      content: row.content as string,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined,
      createdAt: row.created_at as string,
    }));
  }
}
