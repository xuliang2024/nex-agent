import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import zhCommon from "./locales/zh-CN/common.json";
import zhLogin from "./locales/zh-CN/login.json";
import zhSettings from "./locales/zh-CN/settings.json";
import zhChat from "./locales/zh-CN/chat.json";
import zhSidebar from "./locales/zh-CN/sidebar.json";
import zhTemplate from "./locales/zh-CN/template.json";

import enCommon from "./locales/en/common.json";
import enLogin from "./locales/en/login.json";
import enSettings from "./locales/en/settings.json";
import enChat from "./locales/en/chat.json";
import enSidebar from "./locales/en/sidebar.json";
import enTemplate from "./locales/en/template.json";

import jaCommon from "./locales/ja/common.json";
import jaLogin from "./locales/ja/login.json";
import jaSettings from "./locales/ja/settings.json";
import jaChat from "./locales/ja/chat.json";
import jaSidebar from "./locales/ja/sidebar.json";
import jaTemplate from "./locales/ja/template.json";

export const supportedLanguages = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
] as const;

export type SupportedLocale = (typeof supportedLanguages)[number]["code"];

const resources = {
  "zh-CN": { common: zhCommon, login: zhLogin, settings: zhSettings, chat: zhChat, sidebar: zhSidebar, template: zhTemplate },
  en: { common: enCommon, login: enLogin, settings: enSettings, chat: enChat, sidebar: enSidebar, template: enTemplate },
  ja: { common: jaCommon, login: jaLogin, settings: jaSettings, chat: jaChat, sidebar: jaSidebar, template: jaTemplate },
};

export async function initI18n() {
  let savedLocale: string | undefined;
  try {
    if (window.api?.getLocale) {
      savedLocale = await window.api.getLocale();
    }
  } catch {}

  const lng = savedLocale || navigator.language || "zh-CN";
  const resolved = lng.startsWith("ja") ? "ja" : lng.startsWith("zh") ? "zh-CN" : "en";

  await i18n.use(initReactI18next).init({
    resources,
    lng: resolved,
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "login", "settings", "chat", "sidebar", "template"],
    interpolation: { escapeValue: false },
  });

  document.documentElement.lang = resolved;
  return i18n;
}

export default i18n;
