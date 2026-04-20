import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../../stores/session-store";
import { useTemplateStore } from "../../stores/template-store";
import { SessionItem } from "./SessionItem";
import { UserMenu } from "../UserMenu";

export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const { t: tt } = useTranslation("template");
  const navigate = useNavigate();
  const location = useLocation();
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const currentTemplateId = useTemplateStore((s) => s.currentTemplateId);
  const setCurrentTemplateId = useTemplateStore((s) => s.setCurrentTemplateId);
  const templates = useTemplateStore((s) => s.templates);

  const isSettings = location.pathname.startsWith("/settings");
  const isTemplates = location.pathname === "/templates";
  const isChat = location.pathname === "/chat";

  const currentTemplate = templates.find((t) => t.id === currentTemplateId);
  const templateSessions = sessions.filter((s) => s.templateId === currentTemplateId);

  const handleNewSession = async () => {
    if (!currentTemplateId) return;
    await createSession(currentTemplateId);
    await loadSessions();
    navigate("/chat");
  };

  if (isTemplates) {
    const handleSelectTemplate = async (templateId: string) => {
      setCurrentTemplateId(templateId);
      await createSession(templateId);
      await loadSessions();
      navigate("/chat");
    };

    return (
      <aside className="w-[60px] flex-shrink-0 border-r border-zinc-800/50 flex flex-col bg-zinc-950 items-center">
        <div className="h-12 drag-region w-full" />
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-2 py-3 px-2 scrollbar-none">
          {templates.map((tpl) => {
            const isActive = tpl.id === currentTemplateId;
            return (
              <div key={tpl.id} className="relative group">
                <button
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-200
                    ${isActive
                      ? "bg-zinc-800 ring-1 ring-zinc-600 shadow-sm shadow-zinc-900/50"
                      : "hover:bg-zinc-800/60 active:scale-95"}`}
                >
                  {tpl.icon}
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  {tpl.name}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-zinc-800/50 py-2 px-2 w-full flex flex-col items-center gap-1.5">
          <button onClick={() => navigate("/settings")} title={t("settings")}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
              ${isSettings ? "text-zinc-100 bg-zinc-800/60" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"}`}>
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <UserMenu compact />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950">
      <div className="h-12 drag-region w-full flex-shrink-0" />

      <div className="px-3 pb-1">
        <button onClick={() => navigate("/templates")}
          className="flex items-center gap-1.5 px-1 py-1 rounded-md text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {tt("backToList")}
        </button>
      </div>

      {currentTemplate && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-xl">{currentTemplate.icon}</span>
          <span className="text-sm font-semibold text-zinc-200 truncate">{currentTemplate.name}</span>
        </div>
      )}

      <div className="px-3 pb-2">
        <button onClick={handleNewSession}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("newSession")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {templateSessions.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">{t("noSessions")}</p>
        ) : (
          templateSessions.map((session) => (
            <SessionItem key={session.id} session={session} isActive={session.id === currentSessionId && isChat} />
          ))
        )}
      </div>

      <div className="border-t border-zinc-800 p-2 space-y-0.5">
        <button onClick={() => navigate("/settings")}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
            ${isSettings ? "text-zinc-100 bg-zinc-800/50" : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/50"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t("settings")}
        </button>
        <UserMenu />
      </div>
    </aside>
  );
}
