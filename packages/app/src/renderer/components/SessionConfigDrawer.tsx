import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../stores/session-store";
import { useTemplateStore } from "../stores/template-store";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { ModelSelect } from "./ModelSelect";

type Tab = "prompt" | "model" | "mcp" | "skills" | "workspace";

interface Props { open: boolean; onClose: () => void; }

interface MCPServer { id: string; name: string; enabled: boolean; transport: "http" | "stdio"; url?: string; command?: string; args?: string[]; env?: Record<string, string>; }
interface SkillItem { id: string; name: string; description?: string; path: string; tags?: string[]; }
interface Config {
  instructions: string; model: string; provider: string; providerBaseURL?: string; maxSteps: number;
  mcp: MCPServer[]; mcpRefs: string[]; skills: string[]; skillRefs: string[];
  tools: { workspace: boolean; sandbox: boolean }; workspacePath: string; sandboxIsolation: "none" | "seatbelt" | "bwrap";
}
interface MCPStatusInfo { id: string; name: string; status: "connected" | "failed" | "disconnected"; error?: string; toolCount: number; }

export function SessionConfigDrawer({ open, onClose }: Props) {
  const { t } = useTranslation("chat");
  const { t: tt } = useTranslation("template");
  const [tab, setTab] = useState<Tab>("prompt");
  const [config, setConfig] = useState<Config | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const getConfig = useSessionStore((s) => s.getConfig);
  const updateConfig = useSessionStore((s) => s.updateConfig);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const templateId = currentSession?.templateId;

  const TABS: { id: Tab; label: string }[] = [
    { id: "prompt", label: t("tabPrompt") },
    { id: "model", label: t("tabModel") },
    { id: "mcp", label: t("tabMcp") },
    { id: "skills", label: t("tabSkills") },
    { id: "workspace", label: t("tabWorkspace") },
  ];

  useEffect(() => {
    if (open) {
      getConfig().then((c: any) => {
        if (c) { if (!c.mcpRefs) c.mcpRefs = []; if (!c.skillRefs) c.skillRefs = []; setConfig(c); }
        setDirty(false);
      });
    }
  }, [open, getConfig]);

  const save = useCallback(async (partial: Partial<Config>) => {
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev));
    await updateConfig(partial);
    setDirty(false);
  }, [updateConfig]);

  if (!open || !config) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-[420px] h-full bg-zinc-900 border-l border-zinc-700 flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">{t("configTitle")}</h3>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-0.5 px-3 pt-2 border-b border-zinc-800 overflow-x-auto">
          {TABS.map((tabItem) => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap ${tab === tabItem.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "prompt" && <PromptTab config={config} onSave={save} />}
          {tab === "model" && <ModelTab config={config} onSave={save} />}
          {tab === "mcp" && <MCPTab config={config} onSave={save} />}
          {tab === "skills" && <SkillsTab config={config} onSave={save} />}
          {tab === "workspace" && <WorkspaceTab config={config} onSave={save} />}
        </div>

        <div className="border-t border-zinc-800 px-4 py-3 flex gap-2">
          {templateId && (
            <button onClick={() => config && updateTemplate(templateId, { config })}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-blue-800/50 text-blue-400 hover:bg-blue-900/20 transition-colors">
              {tt("updateTemplate")}
            </button>
          )}
          <button onClick={() => setShowSaveDialog(true)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
            {tt("saveAsNew")}
          </button>
        </div>
      </div>

      {showSaveDialog && currentSessionId && (
        <SaveTemplateDialog
          mode="from-session"
          sessionId={currentSessionId}
          onClose={() => setShowSaveDialog(false)}
          onCreated={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}

function PromptTab({ config, onSave }: { config: Config; onSave: (p: Partial<Config>) => Promise<void> }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const [value, setValue] = useState(config.instructions);
  useEffect(() => setValue(config.instructions), [config.instructions]);
  return (
    <div className="space-y-3">
      <label className="block text-xs text-zinc-400">{t("systemInstructions")}</label>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={12}
        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 resize-none" />
      <button onClick={() => onSave({ instructions: value })} disabled={value === config.instructions}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-xs transition-colors">{tc("save")}</button>
    </div>
  );
}

function ModelTab({ config, onSave }: { config: Config; onSave: (p: Partial<Config>) => Promise<void> }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const [local, setLocal] = useState({ provider: config.provider, model: config.model, providerBaseURL: config.providerBaseURL || "", maxSteps: config.maxSteps });
  useEffect(() => { setLocal({ provider: config.provider, model: config.model, providerBaseURL: config.providerBaseURL || "", maxSteps: config.maxSteps }); }, [config]);
  return (
    <div className="space-y-3">
      <ModelSelect label="Model" value={local.model} onChange={(v) => setLocal((s) => ({ ...s, model: v }))} />
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{t("maxSteps")}</label>
        <input type="number" value={local.maxSteps} onChange={(e) => setLocal((s) => ({ ...s, maxSteps: Number(e.target.value) || 100 }))}
          className="w-24 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500" />
      </div>
      <button onClick={() => onSave({ provider: local.provider, model: local.model, providerBaseURL: local.providerBaseURL || undefined, maxSteps: local.maxSteps })}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">{tc("save")}</button>
    </div>
  );
}

function MCPTab({ config, onSave }: { config: Config; onSave: (p: Partial<Config>) => Promise<void> }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const [servers, setServers] = useState<MCPServer[]>(config.mcp);
  const [mcpRefs, setMcpRefs] = useState<string[]>(config.mcpRefs || []);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<MCPStatusInfo[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [form, setForm] = useState<MCPServer>({ id: "", name: "", enabled: true, transport: "stdio", command: "", args: [], url: "" });

  useEffect(() => { setServers(config.mcp); setMcpRefs(config.mcpRefs || []); }, [config.mcp, config.mcpRefs]);

  const refreshStatus = async () => {
    if (!currentSessionId || !window.api) return;
    await new Promise((r) => setTimeout(r, 1500));
    const s = await window.api.mcpStatus(currentSessionId);
    if (s?.length) setMcpStatus(s);
  };

  useEffect(() => {
    if (currentSessionId && window.api) { window.api.mcpStatus(currentSessionId).then((s: MCPStatusInfo[]) => { if (s?.length) setMcpStatus(s); }); }
  }, [currentSessionId]);

  const handleReconnect = async () => {
    if (!currentSessionId || !window.api || reconnecting) return;
    setReconnecting(true);
    try { const statuses = await window.api.mcpReconnect(currentSessionId); setMcpStatus(statuses ?? []); } catch {}
    setReconnecting(false);
  };

  const handleAdd = async () => {
    const newServer = { ...form, id: form.name.toLowerCase().replace(/\s+/g, "-") || crypto.randomUUID() };
    const updated = [...servers, newServer];
    setServers(updated);
    await onSave({ mcp: updated });
    setAdding(false);
    setForm({ id: "", name: "", enabled: true, transport: "stdio", command: "", args: [], url: "" });
    refreshStatus();
  };

  const handleToggle = async (id: string) => {
    const updated = servers.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setServers(updated);
    await onSave({ mcp: updated });
    refreshStatus();
  };

  const handleDelete = async (id: string) => {
    const updated = servers.filter((s) => s.id !== id);
    const updatedRefs = mcpRefs.filter((r) => r !== id);
    setServers(updated);
    setMcpRefs(updatedRefs);
    await onSave({ mcp: updated, mcpRefs: updatedRefs });
    refreshStatus();
  };

  const handlePickerConfirm = async (selectedIds: string[]) => {
    setMcpRefs(selectedIds);
    setReconnecting(true);
    await onSave({ mcpRefs: selectedIds });
    setPickerOpen(false);
    if (currentSessionId && window.api) { const session = await window.api.getSession(currentSessionId); if (session?.config?.mcp) setServers(session.config.mcp); }
    await refreshStatus();
    setReconnecting(false);
  };

  const enabledCount = servers.filter((s) => s.enabled).length;
  const getStatus = (id: string) => mcpStatus.find((s) => s.id === id);

  return (
    <div className="space-y-3">
      {enabledCount > 0 && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/30 border border-zinc-800">
          <div className="flex items-center gap-2">
            <StatusDot statuses={mcpStatus} />
            <span className="text-xs text-zinc-400">{t("connectedCount", { connected: mcpStatus.filter((s) => s.status === "connected").length, total: enabledCount })}</span>
          </div>
          <button onClick={handleReconnect} disabled={reconnecting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:text-zinc-600">
            <svg className={`w-3 h-3 ${reconnecting ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {reconnecting ? t("reconnecting") : t("reconnect")}
          </button>
        </div>
      )}
      {servers.length === 0 && !adding && <p className="text-xs text-zinc-600 py-4 text-center">{t("noMcp")}</p>}
      {servers.map((s) => {
        const status = getStatus(s.id);
        const isFromLib = mcpRefs.includes(s.id);
        return (
          <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-800">
            <button onClick={() => handleToggle(s.id)} className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${s.enabled ? "bg-blue-600 justify-end" : "bg-zinc-700 justify-start"}`}><span className="w-3 h-3 bg-white rounded-full block" /></button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-zinc-200 truncate">{s.name}</span>
                {isFromLib && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 uppercase">Lib</span>}
                {s.enabled && status && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.status === "connected" ? "bg-green-400" : status.status === "failed" ? "bg-red-400" : "bg-zinc-600"}`}
                    title={status.status === "connected" ? `${t("connected")} (${status.toolCount} tools)` : status.error || status.status} />
                )}
              </div>
              <span className="text-xs text-zinc-500 block truncate">{s.transport === "stdio" ? s.command : s.url}</span>
              {s.enabled && status?.status === "failed" && status.error && (
                <span className="text-xs text-red-400/70 block truncate mt-0.5" title={status.error}>{status.error.length > 60 ? status.error.slice(0, 60) + "..." : status.error}</span>
              )}
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">{tc("delete")}</button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button onClick={() => setPickerOpen(true)} className="flex-1 py-2 border border-blue-800/50 bg-blue-900/10 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:border-blue-700 transition-colors">{t("fromLibrary")}</button>
        {!adding && <button onClick={() => setAdding(true)} className="flex-1 py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">{t("addInline")}</button>}
      </div>
      {adding && (
        <div className="space-y-2 p-3 rounded-lg border border-zinc-700 bg-zinc-800/30">
          <Field label="Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} placeholder="my-server" />
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Transport</label>
            <div className="flex gap-2">
              {(["stdio", "http"] as const).map((tp) => (
                <button key={tp} onClick={() => setForm((s) => ({ ...s, transport: tp }))}
                  className={`px-3 py-1 rounded text-xs transition-colors ${form.transport === tp ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{tp.toUpperCase()}</button>
              ))}
            </div>
          </div>
          {form.transport === "stdio" ? (
            <>
              <Field label="Command" value={form.command || ""} onChange={(v) => setForm((s) => ({ ...s, command: v }))} placeholder="npx" />
              <Field label="Args" value={(form.args || []).join(" ")} onChange={(v) => setForm((s) => ({ ...s, args: v.split(/\s+/).filter(Boolean) }))} placeholder="-y @modelcontextprotocol/server" />
            </>
          ) : (
            <Field label="URL" value={form.url || ""} onChange={(v) => setForm((s) => ({ ...s, url: v }))} placeholder="http://localhost:3001/sse" />
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} disabled={!form.name} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded text-xs transition-colors">{tc("add")}</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-xs transition-colors">{tc("cancel")}</button>
          </div>
        </div>
      )}
      {pickerOpen && <MCPPickerModal currentRefs={mcpRefs} onConfirm={handlePickerConfirm} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function MCPPickerModal({ currentRefs, onConfirm, onClose }: { currentRefs: string[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const [library, setLibrary] = useState<MCPServer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRefs));
  useEffect(() => { if (window.api) window.api.listMCPLibrary().then((list: MCPServer[]) => setLibrary(list ?? [])); }, []);
  const toggle = (id: string) => { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[380px] max-h-[60vh] bg-zinc-900 rounded-xl border border-zinc-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-200">{t("selectFromMcp")}</h4>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {library.length === 0 && <p className="text-xs text-zinc-600 py-6 text-center">{t("noMcpInLib")}</p>}
          {library.map((s) => (
            <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm text-zinc-200 truncate">{s.name}</span><span className="text-[10px] px-1 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase">{s.transport}</span></div>
                <span className="text-xs text-zinc-500 block truncate">{s.transport === "stdio" ? `${s.command} ${(s.args || []).join(" ")}` : s.url}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={() => onConfirm(Array.from(selected))} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">{tc("confirm")} ({selected.size})</button>
          <button onClick={onClose} className="px-4 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors">{tc("cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function SkillsTab({ config, onSave }: { config: Config; onSave: (p: Partial<Config>) => Promise<void> }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const [skills, setSkills] = useState<string[]>(config.skills);
  const [skillRefs, setSkillRefs] = useState<string[]>(config.skillRefs || []);
  const [skillLibrary, setSkillLibrary] = useState<SkillItem[]>([]);
  const [inputPath, setInputPath] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => { setSkills(config.skills); setSkillRefs(config.skillRefs || []); }, [config.skills, config.skillRefs]);
  useEffect(() => { if (window.api) window.api.listSkillLibrary().then((list: SkillItem[]) => setSkillLibrary(list ?? [])); }, []);

  const getSkillName = (path: string) => skillLibrary.find((s) => s.path === path)?.name;
  const isFromLib = (path: string) => skillLibrary.some((s) => skillRefs.includes(s.id) && s.path === path);

  const handleAdd = async (skillPath: string) => {
    if (!skillPath.trim() || skills.includes(skillPath)) return;
    const updated = [...skills, skillPath.trim()];
    setSkills(updated);
    await onSave({ skills: updated });
    setInputPath("");
  };

  const handleBrowse = async () => { if (!window.api) return; const file = await window.api.selectFile(); if (file) await handleAdd(file); };

  const handleDelete = async (idx: number) => {
    const path = skills[idx];
    const updated = skills.filter((_, i) => i !== idx);
    setSkills(updated);
    const libItem = skillLibrary.find((s) => s.path === path);
    let updatedRefs = skillRefs;
    if (libItem && skillRefs.includes(libItem.id)) { updatedRefs = skillRefs.filter((r) => r !== libItem.id); setSkillRefs(updatedRefs); }
    await onSave({ skills: updated, skillRefs: updatedRefs });
  };

  const handlePickerConfirm = async (selectedIds: string[]) => {
    setSkillRefs(selectedIds);
    await onSave({ skillRefs: selectedIds });
    setPickerOpen(false);
    if (currentSessionId && window.api) { const session = await window.api.getSession(currentSessionId); if (session?.config?.skills) setSkills(session.config.skills); }
  };

  return (
    <div className="space-y-3">
      {skills.length === 0 && <p className="text-xs text-zinc-600 py-4 text-center">{t("noSkills")}</p>}
      {skills.map((s, i) => {
        const name = getSkillName(s);
        const fromLib = isFromLib(s);
        return (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-800">
            <div className="flex-1 min-w-0">
              {name ? (<div className="flex items-center gap-1.5"><span className="text-sm text-zinc-200 truncate">{name}</span>{fromLib && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 uppercase">Lib</span>}</div>) : null}
              <span className="text-xs text-zinc-400 font-mono truncate block">{s}</span>
            </div>
            <button onClick={() => handleDelete(i)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">{tc("delete")}</button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button onClick={() => setPickerOpen(true)} className="flex-1 py-2 border border-blue-800/50 bg-blue-900/10 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:border-blue-700 transition-colors">{t("fromLibrary")}</button>
      </div>
      <div className="flex gap-2">
        <input value={inputPath} onChange={(e) => setInputPath(e.target.value)} placeholder="/path/to/SKILL.md" onKeyDown={(e) => e.key === "Enter" && handleAdd(inputPath)}
          className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500" />
        <button onClick={handleBrowse} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors">{tc("browse")}</button>
        <button onClick={() => handleAdd(inputPath)} disabled={!inputPath.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-xs transition-colors">{tc("add")}</button>
      </div>
      {pickerOpen && <SkillPickerModal currentRefs={skillRefs} onConfirm={handlePickerConfirm} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}

function SkillPickerModal({ currentRefs, onConfirm, onClose }: { currentRefs: string[]; onConfirm: (ids: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const [library, setLibrary] = useState<SkillItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRefs));
  useEffect(() => { if (window.api) window.api.listSkillLibrary().then((list: SkillItem[]) => setLibrary(list ?? [])); }, []);
  const toggle = (id: string) => { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[380px] max-h-[60vh] bg-zinc-900 rounded-xl border border-zinc-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h4 className="text-sm font-semibold text-zinc-200">{t("selectFromSkills")}</h4>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-200"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {library.length === 0 && <p className="text-xs text-zinc-600 py-6 text-center">{t("noSkillsInLib")}</p>}
          {library.map((s) => (
            <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-zinc-200 block truncate">{s.name}</span>
                {s.description && <span className="text-xs text-zinc-500 block truncate">{s.description}</span>}
                <span className="text-[11px] text-zinc-600 font-mono block truncate">{s.path}</span>
                {s.tags?.length ? (<div className="flex gap-1 mt-0.5 flex-wrap">{s.tags.map((tag) => <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500">{tag}</span>)}</div>) : null}
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={() => onConfirm(Array.from(selected))} className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">{tc("confirm")} ({selected.size})</button>
          <button onClick={onClose} className="px-4 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors">{tc("cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab({ config, onSave }: { config: Config; onSave: (p: Partial<Config>) => Promise<void> }) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const [local, setLocal] = useState({ workspacePath: config.workspacePath, workspace: config.tools.workspace, sandbox: config.tools.sandbox, sandboxIsolation: config.sandboxIsolation });
  useEffect(() => { setLocal({ workspacePath: config.workspacePath, workspace: config.tools.workspace, sandbox: config.tools.sandbox, sandboxIsolation: config.sandboxIsolation }); }, [config]);

  const handleBrowse = async () => { if (!window.api) return; const dir = await window.api.selectDirectory(); if (dir) setLocal((s) => ({ ...s, workspacePath: dir })); };
  const handleSave = () => onSave({ workspacePath: local.workspacePath, tools: { workspace: local.workspace, sandbox: local.sandbox }, sandboxIsolation: local.sandboxIsolation });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">{t("tabWorkspace")}</label>
        <div className="flex gap-2">
          <input value={local.workspacePath} onChange={(e) => setLocal((s) => ({ ...s, workspacePath: e.target.value }))} placeholder="..."
            className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
          <button onClick={handleBrowse} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors">{tc("browse")}</button>
        </div>
        {!local.workspacePath && <p className="text-xs text-amber-500/70 mt-1">{t("setWorkspaceHint")}</p>}
      </div>
      <Toggle label={t("fileReadWrite")} description={t("fileReadWriteDesc")} checked={local.workspace} onChange={(v) => setLocal((s) => ({ ...s, workspace: v }))} />
      <Toggle label={t("commandExec")} description={t("commandExecDesc")} checked={local.sandbox} onChange={(v) => setLocal((s) => ({ ...s, sandbox: v }))} />
      {local.sandbox && (
        <div>
          <label className="block text-xs text-zinc-400 mb-1">{t("sandboxIsolation")}</label>
          <div className="flex gap-2">
            {(["none", "seatbelt", "bwrap"] as const).map((level) => (
              <button key={level} onClick={() => setLocal((s) => ({ ...s, sandboxIsolation: level }))}
                className={`px-3 py-1 rounded text-xs transition-colors ${local.sandboxIsolation === level ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}>{level}</button>
            ))}
          </div>
        </div>
      )}
      <button onClick={handleSave} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">{tc("save")}</button>
    </div>
  );
}

/* ---- Shared ---- */

function StatusDot({ statuses }: { statuses: MCPStatusInfo[] }) {
  if (statuses.length === 0) return null;
  const allConnected = statuses.every((s) => s.status === "connected");
  const someFailed = statuses.some((s) => s.status === "failed");
  return <span className={`inline-block w-2 h-2 rounded-full ${allConnected ? "bg-green-400" : someFailed ? "bg-amber-400" : "bg-zinc-600"}`} />;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500" />
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div><span className="text-sm text-zinc-200 block">{label}</span><span className="text-xs text-zinc-500">{description}</span></div>
      <button onClick={() => onChange(!checked)} className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${checked ? "bg-blue-600 justify-end" : "bg-zinc-700 justify-start"}`}><span className="w-4 h-4 bg-white rounded-full block" /></button>
    </div>
  );
}
