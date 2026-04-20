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
  const loadTemplates = useTemplateStore((s) => s.loadTemplates);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
      loadTemplates();
    }
  }, [isAuthenticated, loadSessions, loadTemplates]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/:tab" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Route>
    </Routes>
  );
}
