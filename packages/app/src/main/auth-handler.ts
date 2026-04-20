import { ipcMain, BrowserWindow, shell } from "electron";

const AUTH_API_BASE = "https://api.apiz.ai/api";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  token: string;
  head_img?: string;
  vip_level?: number;
  balance?: number;
  google_id?: string;
  google_email?: string;
}

interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

interface SendCodeResult {
  success: boolean;
  error?: string;
}

interface QrcodeResult {
  success: boolean;
  url?: string;
  scene_id?: string;
  error?: string;
}

interface AuthStore {
  getAuth(): { token: string | null; user: AuthUser | null; loginAt: string | null };
  saveAuth(token: string | null, user: AuthUser | null): void;
  getSettings(): { keys: Record<string, string>; defaults: any };
  saveSettings(settings: any): void;
}

interface AgentBridgeLike {
  setApiKeys(keys: Record<string, string>): Promise<void>;
}

let store: AuthStore;
let bridge: AgentBridgeLike | null = null;

function parseErrorDetail(json: any): string {
  if (!json) return "未知错误";
  const d = json.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0];
    return first?.msg || first?.message || JSON.stringify(first);
  }
  if (typeof json.message === "string") return json.message;
  return JSON.stringify(json);
}

async function apiRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<T> {
  const url =
    method === "GET" && body
      ? `${AUTH_API_BASE}${path}?${new URLSearchParams(body as any).toString()}`
      : `${AUTH_API_BASE}${path}`;

  console.log(`[auth] ${method} ${path}`, method === "POST" ? JSON.stringify(body) : "");

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.log(`[auth] ${path} error ${res.status}:`, text);
    let detail = `请求失败 (${res.status})`;
    try {
      detail = parseErrorDetail(JSON.parse(text));
    } catch {}
    throw new Error(detail);
  }

  const data = await res.json();
  console.log(`[auth] ${path} ok`);
  return data;
}

function extractUser(data: any): AuthUser {
  return {
    id: data.id,
    name: data.name || data.nickname || "",
    email: data.email || data.google_email || "",
    token: data.token,
    head_img: data.head_img || data.headimgurl,
    vip_level: data.vip_level,
    balance: data.balance,
    google_id: data.google_id,
    google_email: data.google_email,
  };
}

async function fetchApiKey(token: string): Promise<string | null> {
  try {
    const data = await apiRequest<any>("/v3/apikeys/list", "POST", {
      token,
      user_type: 1,
      page: 1,
      page_size: 10,
    });
    const items = data?.data?.items;
    if (Array.isArray(items) && items.length > 0) {
      const active = items.find((i: any) => i.status === "active");
      return active?.key ?? null;
    }
  } catch {}
  return null;
}

async function handleLogin(data: any): Promise<LoginResult> {
  if (!data || !data.token) {
    console.log("[auth] login response missing token:", JSON.stringify(data)?.slice(0, 200));
    return { success: false, error: "登录失败：服务器未返回有效凭证" };
  }
  const user = extractUser(data);
  store.saveAuth(user.token, user);

  try {
    const apiKey = await fetchApiKey(user.token);
    if (apiKey) {
      console.log("[auth] API key fetched, updating settings and worker");
      const settings = store.getSettings();
      settings.keys.NEXAI_API_KEY = apiKey;
      store.saveSettings(settings);
      if (bridge) {
        await bridge.setApiKeys(settings.keys).catch((err) =>
          console.error("[auth] failed to push keys to worker:", err),
        );
      }
    } else {
      console.warn("[auth] no API key found for user");
    }
  } catch (err) {
    console.error("[auth] fetchApiKey error:", err);
  }

  return { success: true, user };
}

export function registerAuthHandlers(authStore: AuthStore, agentBridge?: AgentBridgeLike) {
  store = authStore;
  bridge = agentBridge ?? null;

  ipcMain.handle("auth:get", () => store.getAuth());

  // --- Email + Password ---
  ipcMain.handle(
    "auth:login-email",
    async (_e, email: string, password: string): Promise<LoginResult> => {
      try {
        const data = await apiRequest<any>("/email_login", "POST", { email, password });
        return handleLogin(data);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  );

  // --- Send Email Code ---
  ipcMain.handle(
    "auth:send-email-code",
    async (_e, email: string): Promise<SendCodeResult> => {
      try {
        const data = await apiRequest<any>("/send_email_code", "POST", {
          email,
          code_type: 4,
        });
        if (data?.code === 200 || data?.message?.includes("已发送")) {
          return { success: true };
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  );

  // --- Email + Code ---
  ipcMain.handle(
    "auth:login-email-code",
    async (_e, email: string, code: string, refCode?: string): Promise<LoginResult> => {
      try {
        const data = await apiRequest<any>("/email_login_code", "POST", {
          email,
          code,
          ref_code: refCode || "",
        });
        return handleLogin(data);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  );

  // --- Google Login (external browser → polling) ---
  ipcMain.handle(
    "auth:google-login",
    async (): Promise<LoginResult & { state?: string }> => {
      try {
        const data = await apiRequest<any>("/auth/google/url", "GET", {
          source: "agent-desktop",
        });
        if (!data?.data?.url || !data?.data?.state) {
          return { success: false, error: "无法获取 Google 授权链接" };
        }
        await shell.openExternal(data.data.url);
        return { success: false, error: "__google_opened__", state: data.data.state };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  );

  // --- Google OAuth polling ---
  ipcMain.handle(
    "auth:google-check",
    async (_e, state: string): Promise<LoginResult> => {
      try {
        const data = await apiRequest<any>("/auth/google/check", "POST", { state });
        if (data?.code === 200 && data?.data) {
          return handleLogin(data.data);
        }
        return { success: false };
      } catch {
        return { success: false };
      }
    },
  );

  // --- WeChat QR Code ---
  ipcMain.handle("auth:wechat-qrcode", async (): Promise<QrcodeResult> => {
    try {
      const data = await apiRequest<any>("/get_qrcode", "GET");
      if (data?.url && data?.scene_id) {
        const ticket = data.ticket as string | undefined;
        const qrImgUrl = ticket
          ? `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`
          : data.url;
        return { success: true, url: qrImgUrl, scene_id: data.scene_id };
      }
      return { success: false, error: "无法获取二维码" };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(
    "auth:wechat-check",
    async (_e, sceneId: string): Promise<LoginResult> => {
      try {
        const data = await apiRequest<any>("/check_qrcode_status", "POST", {
          scene_id: sceneId,
          from_user_id: 0,
          ref_code: "",
        });
        if (data?.code === 200 && data?.data) {
          return handleLogin(data.data);
        }
        if (data?.token) {
          return handleLogin(data);
        }
        return { success: false };
      } catch {
        return { success: false };
      }
    },
  );

  // --- Forgot Password ---
  ipcMain.handle(
    "auth:forgot-password",
    async (_e, email: string): Promise<SendCodeResult> => {
      try {
        await apiRequest<any>("/forgot_password", "POST", { email });
        return { success: true };
      } catch {
        return { success: true };
      }
    },
  );

  // --- Reset Password ---
  ipcMain.handle(
    "auth:reset-password",
    async (_e, token: string, newPassword: string): Promise<SendCodeResult> => {
      try {
        const data = await apiRequest<any>("/reset_password", "POST", {
          token,
          new_password: newPassword,
        });
        if (data.code === 200) return { success: true };
        return { success: false, error: parseErrorDetail(data) };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  );

  // --- Refresh User ---
  ipcMain.handle("auth:refresh-user", async (): Promise<LoginResult> => {
    const auth = store.getAuth();
    if (!auth.token) return { success: false, error: "未登录" };
    try {
      const data = await apiRequest<any>("/user_info", "POST", { token: auth.token });
      if (!data || !data.token) {
        store.saveAuth(null, null);
        return { success: false, error: "登录已过期" };
      }
      const user = extractUser(data);
      store.saveAuth(user.token, user);
      try {
        const apiKey = await fetchApiKey(user.token);
        if (apiKey) {
          const s = store.getSettings();
          s.keys.NEXAI_API_KEY = apiKey;
          store.saveSettings(s);
          if (bridge) {
            await bridge.setApiKeys(s.keys).catch(() => {});
          }
        }
      } catch {}
      return { success: true, user };
    } catch {
      if (auth.user) {
        return { success: true, user: auth.user };
      }
      return { success: false, error: "网络异常，请检查网络连接" };
    }
  });

  // --- Get User Money / Points ---
  ipcMain.handle("auth:get-user-money", async (): Promise<any> => {
    const auth = store.getAuth();
    if (!auth.token) return null;
    try {
      return await apiRequest<any>("/get_user_money", "POST", { token: auth.token });
    } catch {
      return null;
    }
  });

  // --- Logout ---
  ipcMain.handle("auth:logout", () => {
    store.saveAuth(null, null);
    return { success: true };
  });
}
