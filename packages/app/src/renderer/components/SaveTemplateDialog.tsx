import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTemplateStore } from "../stores/template-store";
import { useSessionStore } from "../stores/session-store";

const EMOJI_OPTIONS = ["🤖", "🎭", "🛍️", "💻", "🌐", "📝", "🎨", "🔍", "📊", "🎵", "🎬", "📸", "🧠", "⚡", "🛠️", "🎯"];

interface Props {
  mode: "create" | "from-session";
  sessionId?: string;
  onClose: () => void;
  onCreated: (tpl: any) => void;
}

export function SaveTemplateDialog({ mode, sessionId, onClose, onCreated }: Props) {
  const { t } = useTranslation("template");
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const createFromSession = useTemplateStore((s) => s.createTemplateFromSession);
  const getConfig = useSessionStore((s) => s.getConfig);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let tpl: any = null;
      if (mode === "from-session" && sessionId) {
        tpl = await createFromSession(sessionId, { name: name.trim(), description: description.trim(), icon });
      } else {
        const config = await getConfig();
        const defaultConfig = config || {
          instructions: "You are a helpful AI assistant.",
          model: "anthropic/claude-sonnet-4.6",
          provider: "nexai",
          maxSteps: 100,
          requireApproval: "dangerous",
          mcp: [], mcpRefs: [],
          skills: [], skillRefs: [],
          tools: { workspace: true, sandbox: true, system: true },
          workspacePath: "",
          sandboxIsolation: "none",
        };
        tpl = await createTemplate({ name: name.trim(), description: description.trim(), icon, config: defaultConfig });
      }
      if (tpl) onCreated(tpl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[400px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">
            {mode === "create" ? t("createTitle") : t("saveAsTitle")}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-2">{t("iconLabel")}</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button key={emoji} onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors
                    ${icon === emoji ? "bg-blue-600/30 ring-1 ring-blue-500" : "hover:bg-zinc-800"}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t("nameLabel")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
              autoFocus />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t("descLabel")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("descPlaceholder")} rows={3}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors">{t("cancel")}</button>
          <button onClick={handleSave} disabled={!name.trim() || saving}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
