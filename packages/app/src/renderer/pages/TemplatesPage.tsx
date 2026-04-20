import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTemplateStore, type AgentTemplateSummary } from "../stores/template-store";
import { useSessionStore } from "../stores/session-store";
import { SaveTemplateDialog } from "../components/SaveTemplateDialog";

function TemplateCard({
  template,
  onNewSession,
  onExport,
  onDelete,
}: {
  template: AgentTemplateSummary;
  onNewSession: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("template");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 hover:bg-zinc-900 transition-all">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{template.icon}</span>
        {!template.isBuiltin && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
                  <button onClick={() => { setMenuOpen(false); onExport(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700">{t("export")}</button>
                  <button onClick={() => { setMenuOpen(false); onDelete(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700">{t("delete")}</button>
                </div>
              </>
            )}
          </div>
        )}
        {template.isBuiltin && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
                  <button onClick={() => { setMenuOpen(false); onExport(); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700">{t("export")}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold text-zinc-100 mb-1">{template.name}</h3>
      <p className="text-xs text-zinc-500 line-clamp-2 mb-3 flex-1">{template.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">
          {template.sessionCount > 0 ? t("sessionCount", { count: template.sessionCount }) : t("noSessions")}
        </span>
        <button
          onClick={onNewSession}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
        >
          {t("newSession")}
        </button>
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const { t } = useTranslation("template");
  const navigate = useNavigate();
  const templates = useTemplateStore((s) => s.templates);
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);
  const setCurrentTemplateId = useTemplateStore((s) => s.setCurrentTemplateId);
  const exportTemplate = useTemplateStore((s) => s.exportTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const importTemplate = useTemplateStore((s) => s.importTemplate);
  const createSession = useSessionStore((s) => s.createSession);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleNewSession = async (templateId: string) => {
    setCurrentTemplateId(templateId);
    await createSession(templateId);
    await loadSessions();
    navigate("/chat");
  };

  const handleImport = async () => {
    const tpl = await importTemplate();
    if (tpl) await loadTemplates();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="h-10 drag-region shrink-0" />
      <div className="max-w-4xl mx-auto px-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zinc-100">{t("title")}</h1>
          <div className="flex gap-2">
            <button onClick={handleImport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors">
              {t("import")}
            </button>
            <button onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-colors">
              {t("create")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onNewSession={() => handleNewSession(tpl.id)}
              onExport={() => exportTemplate(tpl.id)}
              onDelete={() => deleteTemplate(tpl.id)}
            />
          ))}
        </div>
      </div>

      {showCreate && (
        <SaveTemplateDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onCreated={(tpl) => {
            setShowCreate(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}
