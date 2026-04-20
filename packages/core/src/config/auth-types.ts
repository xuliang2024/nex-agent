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
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loginAt: string | null;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export interface SendCodeResult {
  success: boolean;
  error?: string;
}

export const AUTH_API_BASE = "https://api.apiz.ai/api";

export function createEmptyAuthState(): AuthState {
  return { token: null, user: null, loginAt: null };
}
