import React, { useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatPage } from "./pages/ChatPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { useSessionStore } from "./stores/session-store";
import { useTemplateStore } from "./stores/template-store";
import { useAuthStore } from "./stores/auth-store";
import { useIdentityStore } from "./stores/identity-store";

function AuthGuard() {
  const { t } = useTranslation("common");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-zinc-500">{t("loading")}</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const selectSession = useSessionStore((s) => s.selectSession);
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const identity = useIdentityStore((s) => s.identity);
  const identityLoaded = useIdentityStore((s) => s.loaded);
  const loadIdentity = useIdentityStore((s) => s.load);

  useEffect(() => {
    loadIdentity();
    checkAuth();
  }, [loadIdentity, checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
      loadTemplates();
    }
  }, [isAuthenticated, loadSessions, loadTemplates]);

  // 单分身模式：登录 + 模板/会话加载完后，确保有一个会话可用，避免用户落到「请先创建会话」空页
  useEffect(() => {
    if (!identityLoaded) return;
    if (identity.mode !== "single" || !identity.single) return;
    if (!identity.single.autoCreateSession) return;
    if (!isAuthenticated) return;

    const tplId = identity.single.builtinTemplateId;
    const owned = sessions.filter((s) => s.templateId === tplId);

    if (owned.length === 0) {
      createSession(tplId);
      return;
    }
    if (!currentSessionId || !owned.find((s) => s.id === currentSessionId)) {
      selectSession(owned[0].id);
    }
  }, [
    identity,
    identityLoaded,
    isAuthenticated,
    sessions,
    currentSessionId,
    createSession,
    selectSession,
  ]);

  if (!identityLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const isSingle = identity.mode === "single";
  const fallbackPath = isSingle ? "/chat" : "/templates";

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        {!isSingle && (
          <Route path="/templates" element={<TemplatesPage />} />
        )}
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:tab" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to={fallbackPath} replace />} />
      </Route>
    </Routes>
  );
}
