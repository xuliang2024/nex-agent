import { create } from "zustand";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  token: string;
  head_img?: string;
  vip_level?: number;
  balance?: number;
  google_id?: string;
  google_email?: string;
  pointsBalance?: number;
}

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  wechatQrUrl: string | null;
  wechatSceneId: string | null;
  wechatExpired: boolean;
  googlePending: boolean;

  checkAuth: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<boolean>;
  sendEmailCode: (email: string) => Promise<boolean>;
  loginEmailCode: (email: string, code: string) => Promise<boolean>;
  loginGoogle: () => Promise<void>;
  stopGooglePolling: () => void;
  startWechatLogin: () => Promise<void>;
  stopWechatPolling: () => void;
  fetchUserMoney: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const api = typeof window !== "undefined" ? window.api : undefined;

let wechatPollingTimer: ReturnType<typeof setInterval> | null = null;
let wechatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let googlePollingTimer: ReturnType<typeof setInterval> | null = null;
let googleTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

const WECHAT_POLL_INTERVAL = 1000;
const WECHAT_TIMEOUT = 5 * 60 * 1000;
const GOOGLE_POLL_INTERVAL = 1000;
const GOOGLE_POLL_TIMEOUT = 5 * 60 * 1000;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  wechatQrUrl: null,
  wechatSceneId: null,
  wechatExpired: false,
  googlePending: false,

  checkAuth: async () => {
    if (!api) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const auth = await api.authGet();
      if (auth?.token && auth?.user) {
        const result = await api.authRefreshUser();
        if (result.success && result.user) {
          set({ user: result.user, isAuthenticated: true, isLoading: false });
          get().fetchUserMoney();
          return;
        }
      }
    } catch {}
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loginEmail: async (email, password) => {
    if (!api) return false;
    set({ isLoading: true, error: null });
    const result = await api.authLoginEmail(email, password);
    if (result.success && result.user) {
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      get().fetchUserMoney();
      return true;
    }
    set({ isLoading: false, error: result.error || "loginFailed" });
    return false;
  },

  sendEmailCode: async (email) => {
    if (!api) return false;
    set({ error: null });
    const result = await api.authSendEmailCode(email);
    if (!result.success) {
      set({ error: result.error || "codeSendFailed" });
      return false;
    }
    return true;
  },

  loginEmailCode: async (email, code) => {
    if (!api) return false;
    set({ isLoading: true, error: null });
    const result = await api.authLoginEmailCode(email, code);
    if (result.success && result.user) {
      set({ user: result.user, isAuthenticated: true, isLoading: false });
      get().fetchUserMoney();
      return true;
    }
    set({ isLoading: false, error: result.error || "loginFailed" });
    return false;
  },

  loginGoogle: async () => {
    if (!api) return;
    get().stopGooglePolling();
    set({ error: null, googlePending: true });

    const result = await api.authGoogleLogin();
    if (result.success && result.user) {
      set({ user: result.user, isAuthenticated: true, googlePending: false });
      get().fetchUserMoney();
      return;
    }
    if (result.error !== "__google_opened__" || !result.state) {
      set({ googlePending: false, error: result.error || "googleLoginFailed" });
      return;
    }

    const googleState = result.state as string;

    googlePollingTimer = setInterval(async () => {
      const check = await api.authGoogleCheck(googleState);
      if (check.success && check.user) {
        get().stopGooglePolling();
        set({ user: check.user, isAuthenticated: true, googlePending: false });
        get().fetchUserMoney();
      }
    }, GOOGLE_POLL_INTERVAL);

    googleTimeoutTimer = setTimeout(() => {
      get().stopGooglePolling();
      set({ googlePending: false, error: "googleTimeout" });
    }, GOOGLE_POLL_TIMEOUT);
  },

  stopGooglePolling: () => {
    if (googlePollingTimer) {
      clearInterval(googlePollingTimer);
      googlePollingTimer = null;
    }
    if (googleTimeoutTimer) {
      clearTimeout(googleTimeoutTimer);
      googleTimeoutTimer = null;
    }
  },

  startWechatLogin: async () => {
    if (!api) return;
    get().stopWechatPolling();
    set({ error: null, wechatQrUrl: null, wechatSceneId: null, wechatExpired: false });

    const result = await api.authWechatQrcode();
    if (!result.success || !result.url || !result.scene_id) {
      set({ error: result.error || "qrcodeFailed" });
      return;
    }

    set({ wechatQrUrl: result.url, wechatSceneId: result.scene_id });

    wechatPollingTimer = setInterval(async () => {
      const sceneId = get().wechatSceneId;
      if (!sceneId) {
        get().stopWechatPolling();
        return;
      }
      const check = await api.authWechatCheck(sceneId);
      if (check.success && check.user) {
        get().stopWechatPolling();
        set({
          user: check.user,
          isAuthenticated: true,
          wechatQrUrl: null,
          wechatSceneId: null,
        });
        get().fetchUserMoney();
      }
    }, WECHAT_POLL_INTERVAL);

    wechatTimeoutTimer = setTimeout(() => {
      if (wechatPollingTimer) {
        clearInterval(wechatPollingTimer);
        wechatPollingTimer = null;
      }
      set({ wechatExpired: true });
    }, WECHAT_TIMEOUT);
  },

  stopWechatPolling: () => {
    if (wechatPollingTimer) {
      clearInterval(wechatPollingTimer);
      wechatPollingTimer = null;
    }
    if (wechatTimeoutTimer) {
      clearTimeout(wechatTimeoutTimer);
      wechatTimeoutTimer = null;
    }
  },

  fetchUserMoney: async () => {
    if (!api) return;
    try {
      const data = await api.authGetUserMoney();
      if (data?.points_balance !== undefined) {
        const user = get().user;
        if (user) {
          set({ user: { ...user, pointsBalance: data.points_balance } });
        }
      }
    } catch {}
  },

  forgotPassword: async (email) => {
    if (!api) return false;
    set({ error: null });
    const result = await api.authForgotPassword(email);
    return result.success;
  },

  refreshUser: async () => {
    if (!api) return;
    const result = await api.authRefreshUser();
    if (result.success && result.user) {
      set({ user: result.user });
    } else {
      set({ user: null, isAuthenticated: false });
    }
  },

  logout: async () => {
    if (!api) return;
    get().stopWechatPolling();
    get().stopGooglePolling();
    await api.authLogout();
    set({ user: null, isAuthenticated: false, error: null, googlePending: false, wechatQrUrl: null, wechatSceneId: null, wechatExpired: false });
  },

  clearError: () => set({ error: null }),
}));
