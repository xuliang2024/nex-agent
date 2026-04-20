import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/auth-store";

type LoginTab = "password" | "code" | "wechat";

export function LoginPage() {
  const { t } = useTranslation("login");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<LoginTab>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const loginEmail = useAuthStore((s) => s.loginEmail);
  const sendEmailCode = useAuthStore((s) => s.sendEmailCode);
  const loginEmailCode = useAuthStore((s) => s.loginEmailCode);
  const loginGoogle = useAuthStore((s) => s.loginGoogle);
  const googlePending = useAuthStore((s) => s.googlePending);
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const startWechatLogin = useAuthStore((s) => s.startWechatLogin);
  const stopWechatPolling = useAuthStore((s) => s.stopWechatPolling);
  const wechatQrUrl = useAuthStore((s) => s.wechatQrUrl);
  const wechatExpired = useAuthStore((s) => s.wechatExpired);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/templates", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (tab === "wechat") {
      startWechatLogin();
    } else {
      stopWechatPolling();
    }
    return () => stopWechatPolling();
  }, [tab]);

  const handleSendCode = useCallback(async () => {
    if (!email.trim() || countdown > 0) return;
    const ok = await sendEmailCode(email.trim());
    if (ok) setCountdown(60);
  }, [email, countdown, sendEmailCode]);

  const handlePasswordLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !password.trim()) return;
      await loginEmail(email.trim(), password.trim());
    },
    [email, password, loginEmail],
  );

  const handleCodeLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email.trim() || !code.trim()) return;
      await loginEmailCode(email.trim(), code.trim());
    },
    [email, code, loginEmailCode],
  );

  const handleForgotPassword = useCallback(async () => {
    if (!forgotEmail.trim()) return;
    const ok = await forgotPassword(forgotEmail.trim());
    if (ok) setForgotSent(true);
  }, [forgotEmail, forgotPassword]);

  const switchTab = useCallback((t: LoginTab) => {
    setTab(t);
    clearError();
  }, [clearError]);

  if (showForgot) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="text-center mb-8">
            <BrandIcon />
            <h1 className="text-xl font-bold text-zinc-100">{t("resetPassword")}</h1>
            <p className="text-sm text-zinc-500 mt-1">{t("resetSubtitle")}</p>
          </div>

          {forgotSent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-zinc-300">{t("resetSent")} <span className="text-zinc-100">{forgotEmail}</span></p>
              <p className="text-xs text-zinc-500 mt-1">{t("resetHint")}</p>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(""); }}
                className="mt-6 text-sm text-blue-400 hover:text-blue-300"
              >
                {t("backToLogin")}
              </button>
            </div>
          ) : (
            <>
              <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                placeholder={t("email")} className={inputClass} />
              <button onClick={handleForgotPassword} disabled={!forgotEmail.trim()}
                className="w-full mt-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {t("sendResetLink")}
              </button>
              <button onClick={() => { setShowForgot(false); setForgotEmail(""); clearError(); }}
                className="w-full mt-2 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                {t("backToLogin")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <BrandIcon />
          <h1 className="text-xl font-bold text-zinc-100">{t("title")}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex bg-zinc-900 rounded-lg p-1 mb-5">
          {(["code", "wechat", "password"] as const).map((tabId) => (
            <button key={tabId} onClick={() => switchTab(tabId)}
              className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === tabId ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              {tabId === "code" ? t("tabCode") : tabId === "wechat" ? t("tabWechat") : t("tabPassword")}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {tc(error, { defaultValue: error })}
          </div>
        )}

        {tab === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")} autoFocus className={inputClass} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")} className={inputClass} />
            <div className="flex justify-end">
              <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); clearError(); }}
                className="text-xs text-zinc-500 hover:text-blue-400 transition-colors">
                {t("forgotPassword")}
              </button>
            </div>
            <button type="submit" disabled={isLoading || !email.trim() || !password.trim()} className={btnPrimary}>
              {isLoading ? t("loggingIn") : t("loginBtn")}
            </button>
          </form>
        )}

        {tab === "code" && (
          <form onSubmit={handleCodeLogin} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")} autoFocus className={inputClass} />
            <div className="flex gap-2">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                placeholder={t("code")} maxLength={6} className={`flex-1 ${inputClass}`} />
              <button type="button" onClick={handleSendCode}
                disabled={!email.trim() || countdown > 0}
                className="px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {countdown > 0 ? `${countdown}${t("countdownSuffix")}` : t("sendCode")}
              </button>
            </div>
            <button type="submit" disabled={isLoading || !email.trim() || !code.trim()} className={btnPrimary}>
              {isLoading ? t("loggingIn") : t("loginBtn")}
            </button>
            <p className="text-center text-xs text-zinc-600">{t("autoRegister")}</p>
          </form>
        )}

        {tab === "wechat" && (
          <div className="flex flex-col items-center py-4">
            {wechatExpired ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-400 mb-1">{t("wechatExpired")}</p>
                <button onClick={() => startWechatLogin()}
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-500 transition-colors">
                  {t("wechatRefresh")}
                </button>
              </div>
            ) : wechatQrUrl ? (
              <>
                <div className="bg-white p-3 rounded-xl mb-4">
                  <img src={wechatQrUrl} alt="WeChat QR" className="w-[180px] h-[180px]" />
                </div>
                <p className="text-sm text-zinc-400">{t("wechatScan")}</p>
                <p className="text-xs text-zinc-600 mt-1">{t("wechatHint")}</p>
              </>
            ) : (
              <div className="flex flex-col items-center py-8">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-green-500 rounded-full animate-spin mb-3" />
                <p className="text-sm text-zinc-500">{t("wechatLoading")}</p>
              </div>
            )}
          </div>
        )}

        {tab !== "wechat" && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600">{tc("or")}</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <button onClick={() => loginGoogle()} disabled={isLoading || googlePending}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <GoogleIcon />
              {googlePending ? t("googlePending") : t("googleLogin")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const inputClass = "w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors";
const btnPrimary = "w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

function BrandIcon() {
  return (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.375 3.375 0 01-4.06.54L12 17.25l-.47.26a3.375 3.375 0 01-4.06-.54L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5" />
      </svg>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
