import React, { useState, useEffect, useRef, useMemo } from "react";

interface ModelInfo {
  id: string;
  owned_by: string;
}

const OWNER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  coze: "Doubao",
  custom: "Custom",
  ali: "Alibaba",
  minimax: "MiniMax",
  moonshot: "Moonshot",
  xai: "xAI",
  xunfei: "iFlytek",
  zhipu_4v: "Zhipu",
  "vertex-ai": "Google",
  codex: "Codex",
};

export function ModelSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!window.api?.listModels) return;
    setLoading(true);
    window.api.listModels().then((data: ModelInfo[]) => {
      setModels(data ?? []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = models.filter(
      (m) =>
        (m.id ?? "").toLowerCase().includes(q) ||
        (m.owned_by ?? "").toLowerCase().includes(q),
    );
    const groups: Record<string, ModelInfo[]> = {};
    for (const m of filtered) {
      const key = m.owned_by || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    const order = ["openai", "anthropic", "deepseek", "xai", "vertex-ai", "coze", "minimax", "moonshot", "ali", "codex", "xunfei", "zhipu_4v", "custom"];
    return Object.entries(groups).sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [models, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-xs text-zinc-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="w-full flex items-center justify-between bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
      >
        <span className="truncate">{value || "Select model..."}</span>
        <svg className={`w-4 h-4 text-zinc-500 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && <p className="text-xs text-zinc-600 text-center py-4">Loading...</p>}
            {!loading && grouped.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">No models found</p>
            )}
            {grouped.map(([owner, items]) => (
              <div key={owner}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-800/30 sticky top-0">
                  {OWNER_LABELS[owner] || owner}
                </div>
                {items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelect(m.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                      m.id === value ? "text-blue-400 bg-blue-900/20" : "text-zinc-300"
                    }`}
                  >
                    {m.id}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
