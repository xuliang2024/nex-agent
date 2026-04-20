import { create } from "zustand";

export interface MessageAttachment {
  type: "image";
  data: string;
  name?: string;
}

export type StreamBlock =
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string }
  | {
      type: "tool-call";
      id: string;
      name: string;
      args: any;
      status: "running" | "done" | "error";
    }
  | {
      type: "tool-result";
      id: string;
      name: string;
      result: any;
      isError?: boolean;
    }
  | { type: "step-boundary" };

interface SessionSummary {
  id: string;
  name: string;
  templateId: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  attachments?: MessageAttachment[];
  blocks?: StreamBlock[];
  toolCalls?: any[];
  createdAt: string;
}

export interface StreamStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  steps: number;
  toolCalls: number;
}

interface SessionStreamState {
  streaming: boolean;
  blocks: StreamBlock[];
  stats: StreamStats;
}

interface SessionStore {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  messages: Message[];
  loading: boolean;
  sessionStreams: Record<string, SessionStreamState>;
  lastStats: Record<string, StreamStats>;

  loadSessions: () => Promise<void>;
  createSession: (templateId: string, name?: string) => Promise<string>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  sendMessage: (
    input: string,
    attachments?: MessageAttachment[],
  ) => Promise<void>;
  updateConfig: (partial: Record<string, any>) => Promise<void>;
  getConfig: () => Promise<any | null>;
}

const api = typeof window !== "undefined" ? window.api : undefined;

function appendToLastBlock(
  blocks: StreamBlock[],
  blockType: "text" | "reasoning",
  text: string,
): StreamBlock[] {
  const updated = [...blocks];
  const last = updated[updated.length - 1];
  if (last && last.type === blockType) {
    updated[updated.length - 1] = { ...last, content: last.content + text };
  } else {
    updated.push({ type: blockType, content: text });
  }
  return updated;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  loading: false,
  sessionStreams: {},
  lastStats: {},

  loadSessions: async () => {
    if (!api) return;
    const sessions = await api.listSessions();
    set({ sessions });
  },

  createSession: async (templateId: string, name?: string) => {
    if (!api) return "";
    const session = await api.createSession(templateId, name);
    await get().loadSessions();
    await get().selectSession(session.id);
    return session.id;
  },

  selectSession: async (id: string) => {
    if (!api) return;
    set({ currentSessionId: id, loading: true });
    const messages = await api.listMessages(id);
    set({ messages, loading: false });
  },

  deleteSession: async (id: string) => {
    if (!api) return;
    await api.deleteSession(id);
    const { currentSessionId } = get();
    if (currentSessionId === id) {
      set({ currentSessionId: null, messages: [] });
    }
    await get().loadSessions();
  },

  renameSession: async (id: string, name: string) => {
    if (!api) return;
    await api.renameSession(id, name);
    await get().loadSessions();
  },

  updateConfig: async (partial: Record<string, any>) => {
    if (!api) return;
    const { currentSessionId } = get();
    if (!currentSessionId) return;
    await api.updateSessionConfig(currentSessionId, partial);
  },

  getConfig: async () => {
    if (!api) return null;
    const { currentSessionId } = get();
    if (!currentSessionId) return null;
    return api.getSessionConfig(currentSessionId);
  },

  sendMessage: async (input: string, attachments?: MessageAttachment[]) => {
    if (!api) return;
    const sessionId = get().currentSessionId;
    if (!sessionId || (!input.trim() && !attachments?.length)) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: "user",
      content: input.trim(),
      attachments: attachments?.length ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg] }));
    await api.saveMessage(userMsg);

    const emptyStats: StreamStats = { promptTokens: 0, completionTokens: 0, totalTokens: 0, steps: 0, toolCalls: 0 };
    set((s) => ({
      sessionStreams: {
        ...s.sessionStreams,
        [sessionId]: { streaming: true, blocks: [], stats: emptyStats },
      },
    }));

    const updateBlocks = (
      updater: (blocks: StreamBlock[]) => StreamBlock[],
    ) => {
      set((s) => {
        const current = s.sessionStreams[sessionId];
        if (!current) return {};
        return {
          sessionStreams: {
            ...s.sessionStreams,
            [sessionId]: { ...current, blocks: updater(current.blocks) },
          },
        };
      });
    };

    const updateStats = (updater: (stats: StreamStats) => StreamStats) => {
      set((s) => {
        const current = s.sessionStreams[sessionId];
        if (!current) return {};
        return {
          sessionStreams: {
            ...s.sessionStreams,
            [sessionId]: { ...current, stats: updater(current.stats) },
          },
        };
      });
    };

    const unsubscribe = api.onStreamChunk((evt: any) => {
      if (evt.sessionId !== sessionId) return;

      switch (evt.type) {
        case "text-delta":
          updateBlocks((blocks) =>
            appendToLastBlock(blocks, "text", evt.data?.text ?? ""),
          );
          break;
        case "reasoning":
          updateBlocks((blocks) =>
            appendToLastBlock(blocks, "reasoning", evt.data?.text ?? ""),
          );
          break;
        case "tool-call":
          updateBlocks((blocks) => [
            ...blocks,
            {
              type: "tool-call" as const,
              id: evt.data?.id ?? "",
              name: evt.data?.name ?? "",
              args: evt.data?.args,
              status: "running" as const,
            },
          ]);
          updateStats((s) => ({ ...s, toolCalls: s.toolCalls + 1 }));
          break;
        case "tool-result":
          updateBlocks((blocks) => [
            ...blocks.map((b) =>
              b.type === "tool-call" && b.id === evt.data?.id
                ? { ...b, status: "done" as const }
                : b,
            ),
            {
              type: "tool-result" as const,
              id: evt.data?.id ?? "",
              name: evt.data?.name ?? "",
              result: evt.data?.result,
              isError: evt.data?.isError,
            },
          ]);
          break;
        case "tool-error":
          updateBlocks((blocks) =>
            blocks.map((b) =>
              b.type === "tool-call" && b.id === evt.data?.id
                ? { ...b, status: "error" as const }
                : b,
            ),
          );
          break;
        case "step-finish": {
          updateBlocks((blocks) => [
            ...blocks,
            { type: "step-boundary" as const },
          ]);
          const usage = evt.data?.usage;
          if (usage) {
            const input = usage.inputTokens ?? usage.promptTokens ?? 0;
            const output = usage.outputTokens ?? usage.completionTokens ?? 0;
            updateStats((s) => ({
              ...s,
              steps: s.steps + 1,
              promptTokens: input,
              completionTokens: output,
              totalTokens: input + output,
            }));
          } else {
            updateStats((s) => ({ ...s, steps: s.steps + 1 }));
          }
          break;
        }
        case "error":
          updateBlocks((blocks) =>
            appendToLastBlock(blocks, "text", `\n\n**Error:** ${evt.data?.message ?? "Unknown error"}`),
          );
          break;
      }
    });

    try {
      const agentInput = attachments?.length
        ? { text: input.trim(), attachments }
        : input.trim();
      const result = await api.agentStream(sessionId, agentInput);

      const finalBlocks = get().sessionStreams[sessionId]?.blocks ?? [];
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        content: result.text || "No response",
        blocks: finalBlocks.length > 0 ? finalBlocks : undefined,
        createdAt: new Date().toISOString(),
      };
      await api.saveMessage(assistantMsg);
      if (get().currentSessionId === sessionId) {
        set((s) => ({ messages: [...s.messages, assistantMsg] }));
      }

      const allMsgs = get().messages.filter((m) => m.sessionId === sessionId);
      const msgCount = allMsgs.length;
      if (msgCount === 2) {
        const title = input.trim().slice(0, 30) || "New Chat";
        api.renameSession(sessionId, title).then(() => get().loadSessions());
      } else if (msgCount > 0 && msgCount % 10 === 0) {
        api
          .agentSummarizeTitle(sessionId)
          .then(async (title: string | null) => {
            if (title) {
              await api.renameSession(sessionId, title);
              await get().loadSessions();
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        content: `Error: ${err.message || "Unknown error"}`,
        createdAt: new Date().toISOString(),
      };
      if (get().currentSessionId === sessionId) {
        set((s) => ({ messages: [...s.messages, errorMsg] }));
      }
      await api.saveMessage(errorMsg).catch(() => {});
    } finally {
      unsubscribe();
      set((s) => {
        const current = s.sessionStreams[sessionId];
        const { [sessionId]: _, ...rest } = s.sessionStreams;
        return {
          sessionStreams: rest,
          lastStats: current?.stats
            ? { ...s.lastStats, [sessionId]: current.stats }
            : s.lastStats,
        };
      });
    }
  },
}));
