import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";

type Callback = (msg: any) => void;

export class AgentBridge {
  private worker: ChildProcess | null = null;
  private pending = new Map<
    string,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >();
  private streamListeners = new Map<string, Callback>();

  private ensureWorker(): ChildProcess {
    if (this.worker && !this.worker.killed) return this.worker;

    const isDev = !!process.env.ELECTRON_RENDERER_URL;

    let workerEntry: string;
    let execArgv: string[] = [];

    const workerEnv = { ...process.env };

    if (isDev) {
      const projectRoot = path.resolve(__dirname, "../..");
      workerEntry = path.join(projectRoot, "src/main/agent-worker.ts");
      execArgv = ["--import", "tsx"];
      this.worker = fork(workerEntry, [], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        execPath: process.execPath.includes("Electron")
          ? "node"
          : process.execPath,
        execArgv,
        cwd: projectRoot,
        env: workerEnv,
      });
    } else {
      workerEntry = path.join(__dirname, "agent-worker.js");
      this.worker = fork(workerEntry, [], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: workerEnv,
      });
    }

    this.worker.on("message", (msg: any) => {
      const { id, type, data } = msg;

      if (type === "stream-chunk") {
        const listener = this.streamListeners.get(id);
        if (listener) listener(data);
        return;
      }

      if (type === "stream-end") {
        this.streamListeners.delete(id);
        const pending = this.pending.get(id);
        if (pending) {
          pending.resolve({ done: true });
          this.pending.delete(id);
        }
        return;
      }

      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      this.streamListeners.delete(id);

      if (type === "error") {
        pending.reject(new Error(data.message));
      } else {
        pending.resolve(data);
      }
    });

    this.worker.on("exit", (code) => {
      console.log(`[agent-bridge] worker exited with code ${code}`);
      for (const [, { reject }] of this.pending) {
        reject(new Error("Agent worker process exited"));
      }
      this.pending.clear();
      this.streamListeners.clear();
      this.worker = null;
    });

    this.worker.stdout?.on("data", (data: Buffer) => {
      console.log(`[agent-worker] ${data.toString()}`);
    });

    this.worker.stderr?.on("data", (data: Buffer) => {
      console.error(`[agent-worker stderr] ${data.toString()}`);
    });

    return this.worker;
  }

  private sendCommand(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pending.set(id, { resolve, reject });
      this.ensureWorker().send({ id, type, payload });
    });
  }

  async setApiKeys(keys: Record<string, string>): Promise<void> {
    await this.sendCommand("set-keys", { keys });
  }

  async generate(
    sessionId: string,
    config: any,
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
  ): Promise<{ text: string; toolCalls?: any[] }> {
    return this.sendCommand("generate", {
      sessionId,
      config,
      input,
      history,
    });
  }

  streamChat(
    sessionId: string,
    config: any,
    input: any,
    history: Array<{ role: string; content: string; attachments?: any[] }> = [],
    onChunk: (chunk: { type: string; data: any }) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.streamListeners.set(id, onChunk);
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
      });
      this.ensureWorker().send({
        id,
        type: "stream",
        payload: { sessionId, config, input, history },
      });
    });
  }

  async rebuild(sessionId: string, config: any): Promise<void> {
    await this.sendCommand("rebuild", { sessionId, config });
  }

  async reconnectMCP(
    sessionId: string,
    config: any,
  ): Promise<{ statuses: any[] }> {
    return this.sendCommand("reconnect-mcp", { sessionId, config });
  }

  async getMCPStatus(sessionId: string): Promise<{ statuses: any[] }> {
    return this.sendCommand("mcp-status", { sessionId });
  }

  async dispose(sessionId: string): Promise<void> {
    await this.sendCommand("dispose", { sessionId });
  }

  async shutdown(): Promise<void> {
    if (this.worker && !this.worker.killed) {
      await this.sendCommand("dispose-all", {}).catch(() => {});
      this.worker.kill();
      this.worker = null;
    }
  }
}
