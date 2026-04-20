import { create } from "zustand";
import type { AgentIdentity } from "../../agent.config";

const DEFAULT_IDENTITY: AgentIdentity = {
  mode: "platform",
  appId: "com.nex-agent.app",
  productName: "Nex Agent",
};

interface IdentityStore {
  identity: AgentIdentity;
  loaded: boolean;
  load: () => Promise<void>;
}

const api = typeof window !== "undefined" ? window.api : undefined;

/**
 * 渲染层缓存 main 进程权威下发的「分身身份卡」。
 *
 * - 仅在应用启动时调用一次 `load()`
 * - mode === "platform" 时（main 分支）：identity 与 DEFAULT_IDENTITY 等价，
 *   UI 走多分身平台路径（保留 /templates 路由、侧栏显示返回按钮）
 * - mode === "single" 时（agent/* 分支）：UI 跳过模板列表、可选自动建会话
 */
export const useIdentityStore = create<IdentityStore>((set) => ({
  identity: DEFAULT_IDENTITY,
  loaded: false,
  load: async () => {
    if (!api?.getAgentIdentity) {
      set({ loaded: true });
      return;
    }
    try {
      const identity = (await api.getAgentIdentity()) as AgentIdentity | null;
      set({ identity: identity ?? DEFAULT_IDENTITY, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
