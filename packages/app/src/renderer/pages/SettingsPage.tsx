import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLocale } from "../i18n";
import { ModelSelect } from "../components/ModelSelect";

interface SettingsData {
  keys: Record<string, string>;
  defaults: {
    model: string;
    provider: string;
    providerBaseURL?: string;
    instructions: string;
    workspacePath: string;
    requireApproval: "all" | "dangerous" | "none";
  };
}

interface MCPServer {
  id: string;
  name: string;
  enabled: boolean;
  transport: "http" | "stdio";
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  isSystem?: boolean;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  path: string;
  tags?: string[];
  createdAt: string;
  source?: "local" | "github" | "agentskill" | "system";
  sourceUrl?: string;
  slug?: string;
  contentSha?: string;
  securityScore?: number;
  qualityScore?: number;
  isSystem?: boolean;
}

interface AgentSkillResult {
  slug: string;
  name: string;
  owner: string;
  description: string;
  installCount: number;
  githubStars: number;
  securityScore: number;
  contentQualityScore: number;
}

type Tab = "defaults" | "mcp-library" | "skill-library" | "language";

const VALID_TABS = new Set<string>(["defaults", "mcp-library", "skill-library", "language"]);

export function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { tab: urlTab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const tab: Tab = urlTab && VALID_TABS.has(urlTab) ? (urlTab as Tab) : "defaults";

  const TABS: { id: Tab; label: string }[] = [
    { id: "defaults", label: t("tabDefaults") },
    { id: "mcp-library", label: t("tabMcp") },
    { id: "skill-library", label: t("tabSkills") },
    { id: "language", label: t("tabLanguage") },
  ];

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.api) {
      window.api.getSettings().then((s: any) => {
        if (s?.defaults && !s.defaults.requireApproval) {
          s.defaults.requireApproval = "none";
        }
        setSettings(s);
      });
    }
  }, []);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const setTab = (t: Tab) => navigate(`/settings/${t}`, { replace: true });

  const handleSaveDefaults = async () => {
    if (!window.api) return;
    setSaving(true);
    await window.api.updateSettings({ defaults: settings.defaults });
    setSaving(false);
  };

  const handleSelectDir = async () => {
    if (!window.api) return;
    const dir = await window.api.selectDirectory();
    if (dir) {
      setSettings((s) =>
        s ? { ...s, defaults: { ...s.defaults, workspacePath: dir } } : s,
      );
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0 drag-region">
        <button
          onClick={() => navigate("/chat")}
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-zinc-100">{t("title")}</h1>
      </div>

      <div className="flex gap-1 px-6 pt-3 border-b border-zinc-800 shrink-0">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2 -mb-px
              ${tab === tabItem.id
                ? "border-blue-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-4">
          {tab === "defaults" && (
            <DefaultsTab settings={settings} onSettingsChange={setSettings}
              onSave={handleSaveDefaults} onSelectDir={handleSelectDir} saving={saving} />
          )}
          {tab === "mcp-library" && <MCPLibraryTab />}
          {tab === "skill-library" && <SkillLibraryTab />}
          {tab === "language" && <LanguageTab />}
        </div>
      </div>
    </div>
  );
}

/* ---- Language Tab ---- */

function LanguageTab() {
  const { t } = useTranslation("settings");
  const { i18n } = useTranslation();
  const [current, setCurrent] = useState(i18n.language);

  const handleChange = async (code: string) => {
    setCurrent(code);
    await i18n.changeLanguage(code);
    document.documentElement.lang = code;
    if (window.api?.setLocale) {
      await window.api.setLocale(code);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-400 mb-1">{t("languageLabel")}</label>
        <p className="text-xs text-zinc-600 mb-3">{t("languageHint")}</p>
        <div className="space-y-2">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left
                ${current === lang.code
                  ? "border-blue-500 bg-blue-500/10 text-zinc-100"
                  : "border-zinc-800 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
            >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${current === lang.code ? "border-blue-500" : "border-zinc-600"}`}>
                {current === lang.code && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </span>
              <span className="text-sm font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Defaults Tab ---- */

function DefaultsTab({
  settings, onSettingsChange, onSave, onSelectDir, saving,
}: {
  settings: SettingsData;
  onSettingsChange: (fn: (s: SettingsData | null) => SettingsData | null) => void;
  onSave: () => void; onSelectDir: () => void; saving: boolean;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const set = (key: string, value: string) =>
    onSettingsChange((s) => s ? { ...s, defaults: { ...s.defaults, [key]: value || undefined } } : s);

  return (
    <div className="space-y-4">
      <ModelSelect label={t("model")} value={settings.defaults.model} onChange={(v) => set("model", v)} />
      <div>
        <label className="block text-sm text-zinc-400 mb-1">{t("defaultInstructions")}</label>
        <textarea value={settings.defaults.instructions} onChange={(e) => set("instructions", e.target.value)}
          rows={4} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 resize-none" />
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">{t("workspacePath")}</label>
        <div className="flex gap-2">
          <input value={settings.defaults.workspacePath} readOnly placeholder={t("notSet")}
            className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-400 focus:outline-none" />
          <button onClick={onSelectDir} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors">
            {tc("browse")}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm text-zinc-400 mb-1">{t("toolApproval")}</label>
        <p className="text-xs text-zinc-600 mb-2">{t("toolApprovalHint")}</p>
        <div className="space-y-2">
          {([
            { value: "none" as const, label: t("approvalNone"), desc: t("approvalNoneDesc") },
            { value: "dangerous" as const, label: t("approvalDangerous"), desc: t("approvalDangerousDesc") },
            { value: "all" as const, label: t("approvalAll"), desc: t("approvalAllDesc") },
          ]).map((opt) => (
            <button key={opt.value} onClick={() => onSettingsChange((s) => s ? { ...s, defaults: { ...s.defaults, requireApproval: opt.value } } : s)}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors text-left
                ${settings.defaults.requireApproval === opt.value
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-600"}`}>
              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${settings.defaults.requireApproval === opt.value ? "border-blue-500" : "border-zinc-600"}`}>
                {settings.defaults.requireApproval === opt.value && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </span>
              <div>
                <span className={`text-sm font-medium ${settings.defaults.requireApproval === opt.value ? "text-zinc-100" : "text-zinc-400"}`}>{opt.label}</span>
                <p className="text-xs text-zinc-600 mt-0.5">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={onSave} disabled={saving}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50">
        {saving ? tc("saving") : t("saveDefaults")}
      </button>
    </div>
  );
}

/* ---- MCP Library Tab ---- */

function MCPLibraryTab() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", transport: "stdio" as "stdio" | "http", command: "", args: "", url: "" });

  const loadList = async () => {
    if (!window.api) return;
    const list = await window.api.listMCPLibrary();
    setServers(list ?? []);
  };

  useEffect(() => { loadList(); }, []);

  const resetForm = () => {
    setForm({ name: "", transport: "stdio", command: "", args: "", url: "" });
    setAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!window.api || !form.name.trim()) return;
    const config: any = { name: form.name.trim(), enabled: true, transport: form.transport };
    if (form.transport === "stdio") {
      config.command = form.command;
      config.args = form.args.split(/\s+/).filter(Boolean);
    } else {
      config.url = form.url;
    }
    if (editingId) {
      await window.api.updateMCPInLibrary(editingId, config);
    } else {
      await window.api.addMCPToLibrary(config);
    }
    resetForm();
    await loadList();
  };

  const handleEdit = (s: MCPServer) => {
    setEditingId(s.id);
    setForm({ name: s.name, transport: s.transport, command: s.command || "", args: (s.args || []).join(" "), url: s.url || "" });
    setAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.api) return;
    await window.api.removeMCPFromLibrary(id);
    await loadList();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{t("mcpCount", { count: servers.length })}</p>
      </div>

      {[...servers].sort((a, b) => (b.isSystem ? 1 : 0) - (a.isSystem ? 1 : 0)).map((s) => (
        <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-200 font-medium truncate">{s.name}</span>
              {s.isSystem ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400">{tc("system")}</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase">{s.transport}</span>
              )}
            </div>
            <span className="text-xs text-zinc-500 block truncate mt-0.5">
              {s.transport === "stdio" ? `${s.command} ${(s.args || []).join(" ")}` : s.url}
            </span>
          </div>
          {!s.isSystem && (
            <>
              <button onClick={() => handleEdit(s)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">{tc("edit")}</button>
              <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">{tc("delete")}</button>
            </>
          )}
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 p-3 rounded-lg border border-zinc-700 bg-zinc-800/30">
          <FieldBlock label={t("skillName")} value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} placeholder="my-server" />
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t("transport")}</label>
            <div className="flex gap-2">
              {(["stdio", "http"] as const).map((tp) => (
                <button key={tp} onClick={() => setForm((s) => ({ ...s, transport: tp }))}
                  className={`px-3 py-1 rounded text-xs transition-colors ${form.transport === tp ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                  {tp.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {form.transport === "stdio" ? (
            <>
              <FieldBlock label="Command" value={form.command} onChange={(v) => setForm((s) => ({ ...s, command: v }))} placeholder="npx" />
              <FieldBlock label={t("argsHint")} value={form.args} onChange={(v) => setForm((s) => ({ ...s, args: v }))} placeholder="-y @modelcontextprotocol/server" />
            </>
          ) : (
            <FieldBlock label="URL" value={form.url} onChange={(v) => setForm((s) => ({ ...s, url: v }))} placeholder="http://localhost:3001/sse" />
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={!form.name.trim()} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded text-xs transition-colors">
              {editingId ? tc("update") : t("addToLibrary")}
            </button>
            <button onClick={resetForm} className="px-3 py-1 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-xs transition-colors">{tc("cancel")}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setAdding(true); }}
          className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
          {t("addMcpServer")}
        </button>
      )}
    </div>
  );
}

/* ---- Skills Library Tab ---- */

const SOURCE_BADGE: Record<string, { labelKey: string; cls: string }> = {
  system: { labelKey: "system", cls: "bg-blue-900/50 text-blue-400" },
  agentskill: { labelKey: "agentskill.sh", cls: "bg-emerald-900/50 text-emerald-400" },
  github: { labelKey: "GitHub", cls: "bg-zinc-700 text-zinc-300" },
  local: { labelKey: "local", cls: "bg-zinc-800 text-zinc-500" },
};

function SkillLibraryTab() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<string | undefined>();
  const [form, setForm] = useState({ name: "", description: "", path: "", tags: "" });
  const [importMenu, setImportMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const loadList = async () => {
    if (!window.api) return;
    const list = await window.api.listSkillLibrary();
    setSkills(list ?? []);
  };

  useEffect(() => { loadList(); }, []);
  useEffect(() => { if (adding && formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [adding]);

  const resetForm = () => {
    setForm({ name: "", description: "", path: "", tags: "" });
    setAdding(false);
    setEditingId(null);
    setEditingSource(undefined);
  };

  const handleBrowse = async () => {
    if (!window.api) return;
    const file = await window.api.selectFile();
    if (file) setForm((s) => ({ ...s, path: file, name: s.name || file.split("/").pop()?.replace(/\.md$/i, "") || "" }));
  };

  const handleSave = async () => {
    if (!window.api || !form.name.trim()) return;
    if (editingId) {
      const partial: any = { name: form.name.trim(), description: form.description.trim() || undefined, tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined };
      if (editingSource === "local" || !editingSource) partial.path = form.path.trim();
      await window.api.updateSkillInLibrary(editingId, partial);
    } else {
      if (!form.path.trim()) return;
      await window.api.addSkillToLibrary({ name: form.name.trim(), description: form.description.trim() || undefined, path: form.path.trim(), source: "local", tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined });
    }
    resetForm();
    await loadList();
  };

  const handleEdit = (s: Skill) => {
    setEditingId(s.id);
    setEditingSource(s.source);
    setForm({ name: s.name, description: s.description || "", path: s.path, tags: (s.tags || []).join(", ") });
    setAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.api) return;
    await window.api.removeSkillFromLibrary(id);
    await loadList();
  };

  const sorted = [...skills].sort((a, b) => {
    const w = (s: Skill) => (s.isSystem ? 0 : s.source === "agentskill" ? 1 : s.source === "github" ? 2 : 3);
    return w(a) - w(b);
  });

  const isPathEditable = !editingId || editingSource === "local" || !editingSource;

  const getBadgeLabel = (source: string) => {
    if (source === "system") return tc("system");
    if (source === "local") return tc("local");
    return SOURCE_BADGE[source]?.labelKey ?? source;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 shrink-0">{t("skillCount", { count: skills.length })}</p>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => { resetForm(); setAdding(true); }}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-zinc-300 transition-colors whitespace-nowrap">
            {t("addLocal")}
          </button>
          <div className="relative">
            <button onClick={() => setImportMenu(!importMenu)} onBlur={() => setTimeout(() => setImportMenu(false), 150)}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[11px] text-white transition-colors whitespace-nowrap">
              {t("importMenu")} ▾
            </button>
            {importMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setImportMenu(false); setShowGitHub(true); }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">{t("importGitHub")}</button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setImportMenu(false); setShowSearch(true); }}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors">{t("importAgentSkill")}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {adding && (
        <div ref={formRef} className="space-y-2 p-3 rounded-lg border border-blue-800/50 bg-zinc-800/50">
          <p className="text-xs text-zinc-400 font-medium">
            {editingId ? t("editSkill", { name: form.name }) : t("addLocalSkill")}
          </p>
          <FieldBlock label={t("skillName")} value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} placeholder="My Skill" />
          <FieldBlock label={t("skillDesc")} value={form.description} onChange={(v) => setForm((s) => ({ ...s, description: v }))} placeholder={t("skillDescPlaceholder")} />
          {isPathEditable ? (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t("skillPath")}</label>
              <div className="flex gap-2">
                <input value={form.path} onChange={(e) => setForm((s) => ({ ...s, path: e.target.value }))}
                  placeholder="/path/to/SKILL.md"
                  className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500" />
                <button onClick={handleBrowse} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors">{tc("browse")}</button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{t("skillPathReadonly")}</label>
              <p className="text-[11px] text-zinc-600 font-mono truncate">{form.path}</p>
            </div>
          )}
          <FieldBlock label={t("skillTags")} value={form.tags} onChange={(v) => setForm((s) => ({ ...s, tags: v }))} placeholder="image, video, tts" />
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={!form.name.trim() || (isPathEditable && !form.path.trim())}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded text-xs transition-colors">
              {editingId ? tc("save") : tc("add")}
            </button>
            <button onClick={resetForm} className="px-3 py-1 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-xs transition-colors">{tc("cancel")}</button>
          </div>
        </div>
      )}

      {sorted.map((s) => {
        const badgeCfg = SOURCE_BADGE[s.source || "local"] || SOURCE_BADGE.local;
        return (
          <div key={s.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm text-zinc-200 font-medium truncate">{s.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badgeCfg.cls}`}>{getBadgeLabel(s.source || "local")}</span>
                {s.source === "agentskill" && s.securityScore != null && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500 shrink-0">{t("security")} {s.securityScore}</span>
                )}
                {s.source === "agentskill" && s.qualityScore != null && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500 shrink-0">{t("quality")} {s.qualityScore}</span>
                )}
              </div>
              {s.description && <span className="text-xs text-zinc-500 block truncate">{s.description}</span>}
              <span className="text-[11px] text-zinc-600 font-mono block truncate mt-0.5">{s.path}</span>
              {s.tags?.length ? (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {s.tags.map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-500">{tag}</span>)}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              {(s.source === "github" || s.source === "agentskill") && <SkillUpdateButton skillId={s.id} />}
              <button onClick={() => handleEdit(s)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">{tc("edit")}</button>
              {!s.isSystem && (
                <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">{tc("delete")}</button>
              )}
            </div>
          </div>
        );
      })}

      {showSearch && <AgentSkillSearchModal installedSlugs={skills.filter((s) => s.slug).map((s) => s.slug!)} onInstalled={loadList} onClose={() => setShowSearch(false)} />}
      {showGitHub && <GitHubImportModal onImported={loadList} onClose={() => setShowGitHub(false)} />}
    </div>
  );
}

/* ---- Skill Update Button ---- */

function SkillUpdateButton({ skillId }: { skillId: string }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [state, setState] = useState<"idle" | "checking" | "updating" | "done">("idle");

  const handleClick = async () => {
    if (!window.api) return;
    setState("checking");
    try {
      const { hasUpdate } = await window.api.checkSkillUpdate(skillId);
      if (hasUpdate) {
        setState("updating");
        await window.api.updateSkill(skillId);
        setState("done");
      } else {
        setState("idle");
      }
    } catch { setState("idle"); }
  };

  if (state === "done") return <span className="text-[10px] text-emerald-400">{t("updated")}</span>;
  return (
    <button onClick={handleClick} disabled={state !== "idle"}
      className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:text-zinc-600 transition-colors">
      {state === "checking" ? t("checking") : state === "updating" ? t("updating") : tc("update")}
    </button>
  );
}

/* ---- agentskill.sh Search Modal ---- */

function AgentSkillSearchModal({ installedSlugs, onInstalled, onClose }: {
  installedSlugs: string[]; onInstalled: () => void; onClose: () => void;
}) {
  const { t } = useTranslation("settings");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AgentSkillResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set(installedSlugs));

  const handleSearch = async () => {
    if (!window.api || !query.trim()) return;
    setSearching(true);
    try {
      const data = await window.api.searchAgentSkill(query.trim(), 10);
      setResults(data.results ?? []);
    } catch { setResults([]); }
    setSearching(false);
  };

  const handleInstall = async (slug: string) => {
    if (!window.api) return;
    setInstalling(slug);
    try { await window.api.importFromAgentSkill(slug); setInstalled((prev) => new Set([...prev, slug])); onInstalled(); } catch {}
    setInstalling(null);
  };

  const { t: tc } = useTranslation("common");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[550px] max-h-[70vh] bg-zinc-900 rounded-xl border border-zinc-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-200">{t("agentSkillSearch")}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex gap-2 px-4 py-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t("searchSkills")}
            className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500" autoFocus />
          <button onClick={handleSearch} disabled={searching || !query.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-lg text-xs transition-colors">
            {searching ? t("searching") : tc("search")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {results.length === 0 && !searching && <p className="text-xs text-zinc-600 text-center py-6">{t("searchHint")}</p>}
          {results.map((r) => {
            const isInst = installed.has(r.slug);
            return (
              <div key={r.slug} className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-200 font-medium truncate">{r.name}</span>
                      <span className="text-[10px] text-zinc-600 shrink-0">{r.owner}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{r.description}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] text-zinc-600">{t("security")} {r.securityScore}</span>
                      <span className="text-[10px] text-zinc-600">{t("quality")} {r.contentQualityScore}</span>
                      <span className="text-[10px] text-zinc-600">{t("installs")} {r.installCount}</span>
                      {r.githubStars > 0 && <span className="text-[10px] text-zinc-600">★ {r.githubStars}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleInstall(r.slug)} disabled={isInst || installing === r.slug}
                    className={`px-2.5 py-1 rounded text-xs shrink-0 transition-colors ${isInst ? "bg-zinc-700 text-zinc-500 cursor-default" : installing === r.slug ? "bg-zinc-700 text-zinc-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}>
                    {isInst ? t("installed") : installing === r.slug ? t("installing") : t("install")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- GitHub Import Modal ---- */

function GitHubImportModal({ onImported, onClose }: { onImported: () => void; onClose: () => void }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async () => {
    if (!window.api || !url.trim()) return;
    setLoading(true);
    setError("");
    try { await window.api.importFromGitHub(url.trim()); onImported(); onClose(); } catch (e: any) { setError(e?.message || tc("importFailed")); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[420px] bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-200">{t("gitHubImport")}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-zinc-500">{t("gitHubHint")}</p>
          <input value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleImport()}
            placeholder={t("gitHubPlaceholder")}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 font-mono focus:outline-none focus:border-blue-500" autoFocus />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs transition-colors">{tc("cancel")}</button>
            <button onClick={handleImport} disabled={loading || !url.trim()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white rounded-lg text-xs transition-colors">
              {loading ? t("importing") : tc("import")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Shared ---- */

function FieldBlock({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500" />
    </div>
  );
}
