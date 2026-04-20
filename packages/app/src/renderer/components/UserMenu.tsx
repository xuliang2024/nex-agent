import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/auth-store";

import { APP_VERSION } from "../version";

export function UserMenu({ compact }: { compact?: boolean } = {}) {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!user) return null;

  const initials = (user.name || user.email || "U").slice(0, 1).toUpperCase();
  const displayName = user.name || user.email?.split("@")[0] || "User";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`w-full flex items-center rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 transition-colors ${compact ? "justify-center p-2" : "gap-2.5 px-3 py-2"}`}>
        {user.head_img ? (
          <img src={user.head_img} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-white">{initials}</span>
          </div>
        )}
        {!compact && <span className="truncate flex-1 text-left">{displayName}</span>}
        {!compact && (
          <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className={`absolute z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden ${
          compact ? "bottom-0 left-full ml-2 w-56" : "bottom-full left-0 right-0 mb-1"
        }`}>
          <div className="px-3 py-2.5 border-b border-zinc-800">
            <p className="text-sm text-zinc-200 truncate">{displayName}</p>
            <p className="text-xs text-zinc-500 truncate">ID: {user.id}</p>
            {user.pointsBalance != null && (
              <p className="text-xs text-zinc-500 mt-1">
                {t("points")}: <span className="text-amber-400 font-medium">{Number(user.pointsBalance).toLocaleString()}</span>
              </p>
            )}
          </div>
          <button onClick={async () => { setOpen(false); await logout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-zinc-800/50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("logout")}
          </button>
          <div className="px-3 py-1.5 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600">v{APP_VERSION}</p>
          </div>
        </div>
      )}
    </div>
  );
}
