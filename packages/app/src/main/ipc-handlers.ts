import { ipcMain, dialog, BrowserWindow, app, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { AppStore } from "./store.js";
import { AgentBridge } from "./agent-bridge.js";
import { registerAuthHandlers } from "./auth-handler.js";
import {
  searchAgentSkill,
  importFromAgentSkill,
  importFromGitHub,
  checkSkillUpdate,
  updateSkill,
} from "./skill-importer.js";
import { exportTemplate, importTemplate } from "./template-packer.js";
import type { SessionConfig, GlobalSettings } from "./store.js";
import { getApizClient } from "@agent-desktop/core";
import { AGENT_IDENTITY } from "../agent.config.js";

let store: AppStore;
let bridge: AgentBridge;

function loadEnvFile(): Record<string, string> {
  const fs = require("node:fs");
  const path = require("node:path");
  const envKeys: Record<string, string> = {};
  const locations = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "../../../.env"),
    path.join(__dirname, "../../../../.env"),
  ];
  for (const loc of locations) {
    try {
      const content = fs.readFileSync(loc, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (key.endsWith("_API_KEY") || key.endsWith("_KEY")) {
            envKeys[key] = val;
          }
        }
      }
      break;
    } catch {}
  }
  return envKeys;
}

function getSystemSkillsResourceDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "system-skills");
  }
  return path.join(__dirname, "../../resources/system-skills");
}

export function registerIPCHandlers() {
  store = new AppStore();
  bridge = new AgentBridge();

  try {
    const resDir = path.dirname(getSystemSkillsResourceDir());
    store.ensureSystemSkills(resDir);
  } catch {}

  store.ensureBuiltinTemplates();

  const settings = store.getSettings();
  const envKeys = loadEnvFile();
  const mergedKeys = { ...envKeys, ...settings.keys };
  if (Object.keys(envKeys).length > 0 && Object.keys(settings.keys).length === 0) {
    settings.keys = mergedKeys;
    store.saveSettings(settings);
  }
  bridge.setApiKeys(mergedKeys).catch(() => {});

  // Ensure API key is initialized if user is already logged in
  const auth = store.getAuth();
  if (auth.token && !mergedKeys.NEXAI_API_KEY) {
    console.log("[startup] user logged in but NEXAI_API_KEY missing, fetching...");
    (async () => {
      try {
        const client = getApizClient("");
        const data: any = await client.listAPIKeys({ token: auth.token! });
        const items = data?.items;
        if (Array.isArray(items) && items.length > 0) {
          const active = items.find((i: any) => i.status === "active");
          if (active?.key) {
            console.log("[startup] API key fetched, updating settings and worker");
            const s = store.getSettings();
            s.keys.NEXAI_API_KEY = active.key;
            store.saveSettings(s);
            await bridge.setApiKeys(s.keys).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[startup] failed to fetch API key:", err);
      }
    })();
  }

  // --- Agent Identity ---
  // 「分身身份卡」由 main 进程权威持有，renderer 通过此 IPC 拉取，
  // 用于决定首屏路由、侧栏样式、是否弹启动横幅等。
  ipcMain.handle("agent:identity", () => AGENT_IDENTITY);

  // --- Auth ---
  registerAuthHandlers(store, bridge);

  // --- Session ---

  ipcMain.handle("session:list", () => store.listSessions());

  ipcMain.handle("session:create", (_e, templateId: string, name?: string) =>
    store.createSession(templateId, name),
  );

  ipcMain.handle("session:get", (_e, id: string) => store.getSession(id));

  ipcMain.handle("session:delete", async (_e, id: string) => {
    store.deleteSession(id);
    await bridge.dispose(id).catch(() => {});
  });

  ipcMain.handle("session:rename", (_e, id: string, name: string) =>
    store.renameSession(id, name),
  );

  ipcMain.handle("session:get-config", (_e, id: string) => {
    const session = store.getSession(id);
    return session?.config ?? null;
  });

  ipcMain.handle(
    "session:update-config",
    async (_e, id: string, partial: Partial<SessionConfig>) => {
      const updated = store.updateSessionConfig(id, partial);
      if (updated) {
        await bridge.rebuild(id, updated.config).catch(() => {});
      }
      return updated;
    },
  );

  // --- Messages ---

  ipcMain.handle(
    "messages:list",
    (_e, sessionId: string, limit?: number, offset?: number) =>
      store.getMessages(sessionId, limit, offset),
  );

  ipcMain.handle("messages:save", (_e, msg: any) => store.saveMessage(msg));

  // --- Settings ---

  ipcMain.handle("settings:get", () => store.getSettings());

  ipcMain.handle(
    "settings:update",
    async (_e, partial: Partial<GlobalSettings>) => {
      const current = store.getSettings();
      const merged = { ...current, ...partial };
      if (partial.defaults) {
        merged.defaults = { ...current.defaults, ...partial.defaults };
      }
      if (partial.keys) {
        merged.keys = { ...current.keys, ...partial.keys };
      }
      store.saveSettings(merged);
      await bridge.setApiKeys(merged.keys).catch(() => {});
      return merged;
    },
  );

  ipcMain.handle("settings:set-key", async (_e, name: string, value: string) => {
    const settings = store.getSettings();
    settings.keys[name] = value;
    store.saveSettings(settings);
    await bridge.setApiKeys(settings.keys).catch(() => {});
  });

  ipcMain.handle("settings:delete-key", async (_e, name: string) => {
    const settings = store.getSettings();
    delete settings.keys[name];
    store.saveSettings(settings);
    await bridge.setApiKeys(settings.keys).catch(() => {});
  });

  ipcMain.handle("settings:select-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("settings:select-file", async (_e, filters?: any[]) => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: filters || [
        { name: "Markdown", extensions: ["md"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // --- Shell ---

  ipcMain.handle("shell:open-path", async (_e, p: string) => {
    if (!p || typeof p !== "string") {
      return { ok: false, error: "Invalid path" };
    }
    try {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const err = await shell.openPath(p);
        return err ? { ok: false, error: err } : { ok: true };
      }
      shell.showItemInFolder(p);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Path not accessible" };
    }
  });

  // --- MCP Library ---

  ipcMain.handle("mcp-library:list", () => store.listMCPLibrary());

  ipcMain.handle("mcp-library:add", (_e, config: any) =>
    store.addMCPToLibrary(config),
  );

  ipcMain.handle("mcp-library:update", (_e, id: string, partial: any) =>
    store.updateMCPInLibrary(id, partial),
  );

  ipcMain.handle("mcp-library:remove", (_e, id: string) =>
    store.removeMCPFromLibrary(id),
  );

  // --- Skill Library ---

  ipcMain.handle("skill-library:list", () => store.listSkillLibrary());

  ipcMain.handle("skill-library:add", (_e, config: any) =>
    store.addSkillToLibrary(config),
  );

  ipcMain.handle("skill-library:update", (_e, id: string, partial: any) =>
    store.updateSkillInLibrary(id, partial),
  );

  ipcMain.handle("skill-library:remove", (_e, id: string) =>
    store.removeSkillFromLibrary(id),
  );

  // --- Skill Import ---

  ipcMain.handle("skill:search-agentskill", async (_e, query: string, limit?: number) => {
    return searchAgentSkill(query, limit);
  });

  ipcMain.handle("skill:import-agentskill", async (_e, slug: string) => {
    const { config } = await importFromAgentSkill(slug, store.getSkillsDir());
    return store.addSkillToLibrary(config);
  });

  ipcMain.handle("skill:import-github", async (_e, url: string) => {
    const { config } = await importFromGitHub(url, store.getSkillsDir());
    return store.addSkillToLibrary(config);
  });

  ipcMain.handle("skill:check-update", async (_e, id: string) => {
    const skill = store.getSkillFromLibrary(id);
    if (!skill) return { hasUpdate: false };
    return checkSkillUpdate(skill);
  });

  ipcMain.handle("skill:update", async (_e, id: string) => {
    const skill = store.getSkillFromLibrary(id);
    if (!skill) return null;
    const partial = await updateSkill(skill, store.getSkillsDir());
    if (partial) return store.updateSkillInLibrary(id, partial);
    return null;
  });

  // --- Templates ---

  ipcMain.handle("template:list", () => store.listTemplates());

  ipcMain.handle("template:get", (_e, id: string) => store.getTemplate(id));

  ipcMain.handle("template:create", (_e, meta: { name: string; description: string; icon: string; config: SessionConfig }) =>
    store.createTemplate(meta),
  );

  ipcMain.handle("template:create-from-session", (_e, sessionId: string, meta: { name: string; description: string; icon: string }) =>
    store.createTemplateFromSession(sessionId, meta),
  );

  ipcMain.handle("template:update", (_e, id: string, partial: any) =>
    store.updateTemplate(id, partial),
  );

  ipcMain.handle("template:delete", (_e, id: string) =>
    store.deleteTemplate(id),
  );

  ipcMain.handle("template:create-session", (_e, templateId: string, name?: string) =>
    store.createSession(templateId, name),
  );

  ipcMain.handle("template:sessions", (_e, templateId: string) =>
    store.listSessionsByTemplate(templateId),
  );

  ipcMain.handle("template:export", async (_e, templateId: string) => {
    const template = store.getTemplate(templateId);
    if (!template) throw new Error("Template not found");
    const result = await dialog.showSaveDialog({
      defaultPath: `${template.name}.nax`,
      filters: [{ name: "Agent Template", extensions: ["nax"] }],
    });
    if (result.canceled || !result.filePath) return null;
    exportTemplate(template, store, result.filePath);
    return result.filePath;
  });

  ipcMain.handle("template:import", async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: "Agent Template", extensions: ["nax"] }],
      properties: ["openFile"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return importTemplate(result.filePaths[0], store);
  });

  // --- Models ---

  async function fetchModelsFromAPI(): Promise<any[]> {
    const settings = store.getSettings();
    const apiKey = settings.keys.NEXAI_API_KEY;
    if (!apiKey) return [];
    const client = getApizClient(apiKey);
    const result = await client.listAdminModels();
    return Array.isArray(result) ? result : [];
  }

  ipcMain.handle("models:list", async () => {
    const cached = store.getModelCache();
    if (cached) return cached;

    const stale = store.getModelCacheStale();

    fetchModelsFromAPI()
      .then((data) => {
        if (data.length > 0) store.setModelCache(data);
      })
      .catch(() => {});

    if (stale) return stale;

    try {
      const data = await fetchModelsFromAPI();
      if (data.length > 0) store.setModelCache(data);
      return data;
    } catch {
      return [];
    }
  });

  // --- Upload ---

  ipcMain.handle(
    "upload:image",
    async (_e, base64Data: string, fileName: string) => {
      const match = base64Data.match(
        /^data:(image\/[a-zA-Z+]+);base64,(.+)$/,
      );
      if (!match) throw new Error("Invalid base64 image data");
      const contentType = match[1];
      const buffer = Buffer.from(match[2], "base64");

      const client = getApizClient("");
      const presign = await client.presignUpload({
        fileName,
        contentType,
        expiresIn: 3600,
      });

      const uploadRes = await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: buffer,
      });
      if (!uploadRes.ok) {
        throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      }
      return presign.public_url;
    },
  );

  // --- Locale ---

  ipcMain.handle("locale:get", () => store.getLocale());

  ipcMain.handle("locale:set", (_e, locale: string) => {
    store.setLocale(locale);
  });

  // --- MCP ---

  ipcMain.handle("mcp:status", async (_e, sessionId: string) => {
    try {
      const result = await bridge.getMCPStatus(sessionId);
      return result.statuses;
    } catch {
      return [];
    }
  });

  ipcMain.handle("mcp:reconnect", async (_e, sessionId: string) => {
    const session = store.getSession(sessionId);
    if (!session) throw new Error("Session not found");
    const result = await bridge.reconnectMCP(sessionId, session.config);
    return result.statuses;
  });

  // --- Agent ---

  function buildHistory(sessionId: string) {
    const msgs = store.getMessages(sessionId);
    // The engine appends the current user input as a new message,
    // so exclude the last user message to avoid duplication.
    const lastIdx = msgs.length - 1;
    const history =
      lastIdx >= 0 && msgs[lastIdx].role === "user"
        ? msgs.slice(0, lastIdx)
        : msgs;
    return history.map((m) => ({
      role: m.role,
      // Strip image attachments from history to avoid bloating the
      // request payload with repeated base64 data on every turn.
      content:
        m.attachments?.length && m.role === "user"
          ? `${m.content}\n[User sent ${m.attachments.length} image(s)]`
          : m.content,
    }));
  }

  ipcMain.handle(
    "agent:generate",
    async (_e, sessionId: string, input: any) => {
      const session = store.getSession(sessionId);
      if (!session) throw new Error("Session not found");
      const history = buildHistory(sessionId);
      return bridge.generate(sessionId, session.config, input, history);
    },
  );

  ipcMain.handle(
    "agent:stream",
    async (event, sessionId: string, input: any) => {
      const session = store.getSession(sessionId);
      if (!session)
        return { text: "Error: Session not found" };

      // Save pasted images to temp files so Agent can use uploadFile tool
      if (input?.attachments?.length) {
        const savedPaths: string[] = [];
        for (const att of input.attachments) {
          if (att.type === "image" && att.data) {
            try {
              const match = att.data.match(
                /^data:image\/([a-zA-Z+]+);base64,(.+)$/,
              );
              const ext = match ? match[1].replace("jpeg", "jpg") : "png";
              const raw = match ? match[2] : att.data;
              const buf = Buffer.from(raw, "base64");
              const tmpDir = path.join(os.tmpdir(), "nex-agent-images");
              fs.mkdirSync(tmpDir, { recursive: true });
              const fname = `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
              const fpath = path.join(tmpDir, fname);
              fs.writeFileSync(fpath, buf);
              savedPaths.push(fpath);
            } catch {}
          }
        }
        if (savedPaths.length) {
          const note = `\n\n[Pasted images saved to: ${savedPaths.join(", ")}]`;
          if (typeof input === "object" && input.text !== undefined) {
            input = { ...input, text: (input.text || "") + note };
          }
        }
      }

      const history = buildHistory(sessionId);
      const win = BrowserWindow.fromWebContents(event.sender);
      let fullText = "";

      try {
        await bridge.streamChat(
          sessionId,
          session.config,
          input,
          history,
          (chunk) => {
            if (chunk.type === "text-delta") {
              fullText += chunk.data?.text ?? "";
            }
            win?.webContents.send("agent:stream-chunk", {
              sessionId,
              type: chunk.type,
              data: chunk.data,
            });
          },
        );
      } catch (err: any) {
        const errMsg = err.message || "Unknown error";
        const errText = `**Error:** ${errMsg}`;
        fullText += fullText ? `\n\n${errText}` : errText;
        win?.webContents.send("agent:stream-chunk", {
          sessionId,
          type: "error",
          data: { message: errMsg },
        });
      }

      return { text: fullText };
    },
  );

  ipcMain.handle(
    "agent:summarize-title",
    async (_e, sessionId: string): Promise<string | null> => {
      const msgs = store.getMessages(sessionId, 20);
      if (msgs.length < 2) return null;

      const conversation = msgs
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const settings = store.getSettings();
      const apiKey = settings.keys.NEXAI_API_KEY;
      if (!apiKey) return null;

      try {
        const res = await fetch("https://api.xskill.ai/v3/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-5.4-mini",
            max_tokens: 30,
            messages: [
              {
                role: "user",
                content: `Based on this conversation, generate a concise title (max 15 chars, Chinese preferred). Only output the title, nothing else.\n\n${conversation}`,
              },
            ],
          }),
        });
        const json = await res.json();
        const title = json?.choices?.[0]?.message?.content?.trim();
        return title || null;
      } catch {
        return null;
      }
    },
  );

  // Pre-warm model cache on startup
  fetchModelsFromAPI()
    .then((data) => {
      if (data.length > 0) store.setModelCache(data);
    })
    .catch(() => {});
}

export function getAgentBridge(): AgentBridge {
  return bridge;
}
