/**
 * Agent worker runs in a forked Node.js child process.
 * Receives commands via IPC and delegates to AgentManager.
 * This avoids native module bundling issues in Electron.
 */
import { AgentManager } from "@agent-desktop/core";
import type { SessionConfig } from "@agent-desktop/core";

process.setMaxListeners(50);

const manager = new AgentManager();

interface WorkerMessage {
  id: string;
  type:
    | "set-keys"
    | "generate"
    | "stream"
    | "dispose"
    | "dispose-all"
    | "rebuild"
    | "reconnect-mcp"
    | "mcp-status";
  payload: any;
}

interface WorkerResponse {
  id: string;
  type: "result" | "stream-chunk" | "stream-end" | "error";
  data: any;
}

function send(msg: WorkerResponse) {
  process.send!(msg);
}

function extractErrorMessage(err: any): string {
  // Try to extract API error message from nested JSON
  const raw = err.message || String(err);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const apiMsg = parsed?.error?.message || parsed?.message;
      if (apiMsg) return apiMsg;
    }
  } catch {}

  const details = [raw];
  if (err.cause?.message && err.cause.message !== raw) {
    details.push(err.cause.message);
  }
  if (err.statusCode) details.push(`status ${err.statusCode}`);
  if (err.responseBody) {
    try {
      const body =
        typeof err.responseBody === "string"
          ? err.responseBody
          : JSON.stringify(err.responseBody);
      if (body.length < 500) {
        const parsed = JSON.parse(body);
        const apiMsg = parsed?.error?.message || parsed?.message;
        if (apiMsg) return apiMsg;
        details.push(body);
      }
    } catch {}
  }
  return details.join(" — ");
}

process.on("message", async (msg: WorkerMessage) => {
  try {
    switch (msg.type) {
      case "set-keys": {
        manager.setApiKeys(msg.payload.keys);
        send({ id: msg.id, type: "result", data: { ok: true } });
        break;
      }

      case "generate": {
        const { sessionId, config, input, history } = msg.payload;
        const result = await manager.generate(
          sessionId,
          config as SessionConfig,
          input,
          history,
        );
        send({ id: msg.id, type: "result", data: result });
        break;
      }

      case "stream": {
        const { sessionId, config, input, history } = msg.payload;
        const stream = manager.stream(
          sessionId,
          config as SessionConfig,
          input,
          history,
        );
        for await (const chunk of stream) {
          send({ id: msg.id, type: "stream-chunk", data: chunk });
        }
        send({ id: msg.id, type: "stream-end", data: null });
        break;
      }

      case "rebuild": {
        const { sessionId, config } = msg.payload;
        await manager.rebuild(sessionId, config as SessionConfig);
        send({ id: msg.id, type: "result", data: { ok: true } });
        break;
      }

      case "reconnect-mcp": {
        const { sessionId, config } = msg.payload;
        const statuses = await manager.reconnectMCP(
          sessionId,
          config as SessionConfig,
        );
        send({ id: msg.id, type: "result", data: { statuses } });
        break;
      }

      case "mcp-status": {
        const { sessionId } = msg.payload;
        const statuses = manager.getMCPStatus(sessionId);
        send({ id: msg.id, type: "result", data: { statuses } });
        break;
      }

      case "dispose": {
        await manager.dispose(msg.payload.sessionId);
        send({ id: msg.id, type: "result", data: { ok: true } });
        break;
      }

      case "dispose-all": {
        await manager.disposeAll();
        send({ id: msg.id, type: "result", data: { ok: true } });
        break;
      }
    }
  } catch (err: any) {
    const message = extractErrorMessage(err);
    send({
      id: msg.id,
      type: "error",
      data: { message, stack: err.stack },
    });
  }
});

process.on("uncaughtException", (err) => {
  console.error("[agent-worker] uncaught:", err);
});
