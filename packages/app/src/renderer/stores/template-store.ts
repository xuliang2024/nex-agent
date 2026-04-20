import { create } from "zustand";

export interface AgentTemplateSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  isBuiltin?: boolean;
  sessionCount: number;
  updatedAt: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: any;
  isBuiltin?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateStore {
  templates: AgentTemplateSummary[];
  currentTemplateId: string | null;

  loadTemplates: () => Promise<void>;
  getTemplate: (id: string) => Promise<AgentTemplate | null>;
  createTemplate: (meta: { name: string; description: string; icon: string; config: any }) => Promise<AgentTemplate | null>;
  createTemplateFromSession: (sessionId: string, meta: { name: string; description: string; icon: string }) => Promise<AgentTemplate | null>;
  updateTemplate: (id: string, partial: Partial<{ name: string; description: string; icon: string; config: any }>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<boolean>;
  exportTemplate: (id: string) => Promise<string | null>;
  importTemplate: () => Promise<AgentTemplate | null>;
  setCurrentTemplateId: (id: string | null) => void;
}

const api = typeof window !== "undefined" ? window.api : undefined;

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  currentTemplateId: null,

  loadTemplates: async () => {
    if (!api) return;
    const templates = await api.listTemplates();
    set({ templates });
  },

  getTemplate: async (id: string) => {
    if (!api) return null;
    return api.getTemplate(id);
  },

  createTemplate: async (meta) => {
    if (!api) return null;
    const tpl = await api.createTemplate(meta);
    await get().loadTemplates();
    return tpl;
  },

  createTemplateFromSession: async (sessionId, meta) => {
    if (!api) return null;
    const tpl = await api.createTemplateFromSession(sessionId, meta);
    await get().loadTemplates();
    return tpl;
  },

  updateTemplate: async (id, partial) => {
    if (!api) return;
    await api.updateTemplate(id, partial);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    if (!api) return false;
    const ok = await api.deleteTemplate(id);
    if (ok && get().currentTemplateId === id) {
      set({ currentTemplateId: null });
    }
    await get().loadTemplates();
    return ok;
  },

  exportTemplate: async (id) => {
    if (!api) return null;
    return api.exportTemplate(id);
  },

  importTemplate: async () => {
    if (!api) return null;
    const tpl = await api.importTemplate();
    if (tpl) await get().loadTemplates();
    return tpl;
  },

  setCurrentTemplateId: (id) => set({ currentTemplateId: id }),
}));
