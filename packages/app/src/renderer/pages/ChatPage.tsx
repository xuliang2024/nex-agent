import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useSessionStore,
  type Message,
  type MessageAttachment,
  type StreamBlock,
  type StreamStats,
} from "../stores/session-store";
import { SessionConfigDrawer } from "../components/SessionConfigDrawer";

const EMPTY_BLOCKS: StreamBlock[] = [];

const MAX_IMAGE_DIMENSION = 1568;
const MAX_IMAGE_BYTES = 800_000;

// 匹配三类绝对路径：
// - macOS/Linux: /Users/..., /tmp/..., /Volumes/...（至少 2 段，避免单段误判，允许末尾 /）
// - Home: ~/Downloads/...
// - Windows: C:\... 或 C:/...
// 前置 (?<!\S) 防止匹配 URL 内的 /path
const PATH_REGEX =
  /(?<!\S)(?:~\/[^\s<>"'`,;]+|\/[A-Za-z][\w\-.\u4e00-\u9fa5]*(?:\/[\w\-.\u4e00-\u9fa5 ]+)+\/?|[A-Za-z]:[\\/][^\s<>"'`,;]+)/g;

const TRAILING_PUNCT = /[)\]）】.,;:!?，。、]+$/;

function cleanPath(raw: string): string {
  return raw.replace(TRAILING_PUNCT, "");
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_IMAGE_BYTES * 1.37 && quality > 0.3) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function ChatPage() {
  const { t } = useTranslation("chat");
  const navigate = useNavigate();
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const messages = useSessionStore((s) => s.messages);
  const streaming = useSessionStore((s) =>
    s.currentSessionId ? !!s.sessionStreams[s.currentSessionId]?.streaming : false,
  );
  const streamingBlocks = useSessionStore((s) =>
    s.currentSessionId ? s.sessionStreams[s.currentSessionId]?.blocks ?? EMPTY_BLOCKS : EMPTY_BLOCKS,
  );
  const streamStats = useSessionStore((s) => {
    if (!s.currentSessionId) return undefined;
    return s.sessionStreams[s.currentSessionId]?.stats ?? s.lastStats[s.currentSessionId];
  });
  const sendMessage = useSessionStore((s) => s.sendMessage);

  const [input, setInput] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingBlocks]);

  useEffect(() => {
    const urls = pendingImages.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingImages]);

  const addImages = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    setPendingImages((prev) => [...prev, ...images]);
  }, []);

  const removeImage = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && !pendingImages.length) || streaming) return;
    const imagesToSend = [...pendingImages];
    const text = input;
    setInput("");
    setPendingImages([]);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.focus();
    }

    let attachments: MessageAttachment[] | undefined;
    if (imagesToSend.length) {
      attachments = await Promise.all(
        imagesToSend.map(async (f) => {
          const compressed = await compressImage(f);
          return { type: "image" as const, data: compressed, name: f.name };
        }),
      );
    }
    sendMessage(text, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) { e.preventDefault(); addImages(files); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addImages(Array.from(e.dataTransfer.files));
  };

  if (!currentSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-400 mb-2">{t("emptyTitle")}</h2>
          <p className="text-zinc-600 text-sm mb-6">{t("emptySubtitle")}</p>
          <button onClick={() => useSessionStore.getState().createSession()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors">
            {t("newSession")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-12 flex-shrink-0 flex items-center px-4 border-b border-zinc-800 gap-3 drag-region">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-zinc-300 truncate block">
            {useSessionStore.getState().sessions.find((s) => s.id === currentSessionId)?.name ?? t("session")}
          </span>
        </div>
        <button onClick={() => setConfigOpen(true)} title={t("sessionConfig")}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
        <button onClick={() => navigate("/settings")} title={t("globalSettings")}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <SessionConfigDrawer open={configOpen} onClose={() => setConfigOpen(false)} />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">{t("emptyMessages")}</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] w-full">
                  {streamingBlocks.length > 0 ? (
                    <BlockRenderer blocks={streamingBlocks} isStreaming />
                  ) : (
                    <div className="rounded-xl px-4 py-2.5 text-sm bg-zinc-800 text-zinc-200 inline-block">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                        <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-zinc-800 p-4" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <div className="max-w-3xl mx-auto">
          {previewUrls.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt={pendingImages[i]?.name} className="w-16 h-16 object-cover rounded-lg border border-zinc-700" />
                  <button onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <button onClick={() => fileInputRef.current?.click()} title={t("uploadImage")} className="px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addImages(Array.from(e.target.files)); e.target.value = ""; }} />
            <textarea ref={inputRef} value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 200) + "px";
              }}
              onKeyDown={handleKeyDown} onPaste={handlePaste}
              placeholder={t("inputPlaceholder")} rows={1}
              className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none overflow-y-auto"
              style={{ maxHeight: 200 }} />
            {streaming ? (
              <button
                onClick={() => {/* TODO: stop streaming */}}
                className="relative px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="w-3 h-3 bg-white rounded-sm" />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim() && !pendingImages.length}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-full text-sm transition-colors flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1 ml-1">
            <InlineModelPicker />
            {streamStats && streamStats.totalTokens > 0 && (
              <div className="flex items-center gap-3 text-[11px] text-zinc-600 mr-1">
                <span title="Tokens (input/output)">{streamStats.promptTokens.toLocaleString()} / {streamStats.completionTokens.toLocaleString()} tokens</span>
                <span title="Steps">{streamStats.steps} steps</span>
                {streamStats.toolCalls > 0 && <span title="Tool calls">{streamStats.toolCalls} tools</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Message Bubble ---- */

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-blue-600 text-white">
          {msg.attachments?.length ? (
            <div className="flex gap-1.5 flex-wrap mb-2">
              {msg.attachments.map((att, i) => <img key={i} src={att.data} alt={att.name || "image"} className="max-w-[200px] max-h-[200px] rounded-lg object-cover" />)}
            </div>
          ) : null}
          {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
        </div>
      </div>
    );
  }
  if (msg.blocks?.length) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] w-full"><BlockRenderer blocks={msg.blocks} /></div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-zinc-800 text-zinc-200">
        <MarkdownContent content={msg.content} />
      </div>
    </div>
  );
}

/* ---- Block Renderer ---- */

function BlockRenderer({ blocks, isStreaming }: { blocks: StreamBlock[]; isStreaming?: boolean }) {
  const { t } = useTranslation("chat");
  let stepCount = 0;
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i} className="rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-zinc-800 text-zinc-200">
                <MarkdownContent content={block.content} />
                {isStreaming && i === blocks.length - 1 && <span className="inline-block w-2 h-4 ml-0.5 bg-zinc-400 animate-pulse rounded-sm align-text-bottom" />}
              </div>
            );
          case "reasoning":
            return <ReasoningBlock key={i} content={block.content} isStreaming={isStreaming && i === blocks.length - 1} />;
          case "tool-call":
            return <ToolCallBlock key={i} block={block} />;
          case "tool-result":
            return <ToolResultBlock key={i} block={block} />;
          case "step-boundary":
            stepCount++;
            return (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="flex-1 border-t border-zinc-800" />
                <span className="text-xs text-zinc-600">{t("step", { n: stepCount })}</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ---- Reasoning Block ---- */

function ReasoningBlock({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const { t } = useTranslation("chat");
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        {isStreaming ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
        )}
        <span>{isStreaming ? t("thinking") : t("thoughtProcess")}</span>
        <svg className={`w-3 h-3 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {(expanded || isStreaming) && (
        <div className="px-3 pb-2 text-xs text-zinc-500 leading-relaxed border-t border-zinc-800/50"><div className="pt-2 whitespace-pre-wrap">{content}</div></div>
      )}
    </div>
  );
}

/* ---- Tool Call Block ---- */

function ToolCallBlock({ block }: { block: Extract<StreamBlock, { type: "tool-call" }> }) {
  const { t } = useTranslation("chat");
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-zinc-800/30">
        {block.status === "running" ? (
          <svg className="w-3.5 h-3.5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        ) : block.status === "error" ? (
          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        )}
        <span className="text-zinc-300 font-mono">{block.name}</span>
        <span className="text-zinc-600">{block.status === "running" ? t("running") : block.status}</span>
        <svg className={`w-3 h-3 ml-auto text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {expanded && block.args != null && (
        <div className="px-3 pb-2 border-t border-zinc-800/50">
          <pre className="text-xs text-zinc-500 pt-2 overflow-x-auto whitespace-pre-wrap">{typeof block.args === "string" ? block.args : JSON.stringify(block.args, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/* ---- Tool Result Block ---- */

function ToolResultBlock({ block }: { block: Extract<StreamBlock, { type: "tool-result" }> }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeResult(block.result);
  return (
    <div className={`rounded-lg border overflow-hidden ${block.isError ? "border-red-900/50 bg-red-950/20" : "border-zinc-800 bg-zinc-900/30"}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800/20">
        <svg className={`w-3 h-3 ${block.isError ? "text-red-400" : "text-zinc-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-zinc-500 truncate">{summary}</span>
        <svg className={`w-3 h-3 ml-auto text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-zinc-800/50">
          <pre className="text-xs text-zinc-500 pt-2 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">{typeof block.result === "string" ? block.result : JSON.stringify(block.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/* ---- Path Chip ---- */

function PathChip({ path }: { path: string }) {
  const { t } = useTranslation("chat");
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    try {
      const res = await window.api.openPath(path);
      if (!res?.ok) console.warn("openPath failed:", res?.error);
    } catch (err) {
      console.warn("openPath threw:", err);
    }
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.warn("clipboard write failed:", err);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 align-baseline rounded-md bg-zinc-900/60 border border-zinc-700/60 px-1.5 py-0.5 mx-0.5 text-[0.85em]">
      <code className="text-amber-300 break-all bg-transparent p-0">{path}</code>
      <button
        type="button"
        onClick={handleOpen}
        title={t("openInFinder")}
        className="text-zinc-400 hover:text-blue-400 transition-colors shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? t("copied") : t("copyPath")}
        className={`shrink-0 transition-colors ${copied ? "text-green-400" : "text-zinc-400 hover:text-blue-400"}`}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V5a2 2 0 012-2h7a2 2 0 012 2v10a2 2 0 01-2 2h-2M5 9h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z"
            />
          </svg>
        )}
      </button>
    </span>
  );
}

/* ---- Render helper: identify local paths in plain text children ---- */

function renderChildrenWithPaths(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, idx) => {
    if (typeof child !== "string") return child;
    const text = child;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    PATH_REGEX.lastIndex = 0;
    while ((m = PATH_REGEX.exec(text)) !== null) {
      const start = m.index;
      const raw = m[0];
      const cleaned = cleanPath(raw);
      if (start > last) parts.push(text.slice(last, start));
      parts.push(<PathChip key={`p-${idx}-${start}`} path={cleaned} />);
      // 把被剥离的尾标点放回正文
      if (cleaned.length < raw.length) parts.push(raw.slice(cleaned.length));
      last = start + raw.length;
    }
    if (last === 0) return child;
    if (last < text.length) parts.push(text.slice(last));
    return <React.Fragment key={`f-${idx}`}>{parts}</React.Fragment>;
  });
}

/* ---- Markdown Renderer ---- */

const mdComponents: Record<string, React.FC<any>> = {
  pre({ children }: { children: React.ReactNode }) { return <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed">{children}</pre>; },
  code({ className, children, ...props }: any) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) return <code className={`${className ?? ""} text-zinc-300`} {...props}>{children}</code>;
    // 如果 inline code 整体就是一个本地路径，则渲染成可打开/复制的 PathChip
    const text = React.Children.toArray(children)
      .map((c) => (typeof c === "string" ? c : ""))
      .join("")
      .trim();
    if (text) {
      PATH_REGEX.lastIndex = 0;
      const m = PATH_REGEX.exec(text);
      if (m && m[0] === text) {
        return <PathChip path={cleanPath(m[0])} />;
      }
    }
    return <code className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[0.85em] text-amber-300" {...props}>{children}</code>;
  },
  table({ children }: { children: React.ReactNode }) { return <div className="my-2 overflow-x-auto"><table className="min-w-full border-collapse text-xs">{children}</table></div>; },
  thead({ children }: { children: React.ReactNode }) { return <thead className="border-b border-zinc-700 text-zinc-400">{children}</thead>; },
  th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-1.5 text-left font-medium">{renderChildrenWithPaths(children)}</th>; },
  td({ children }: { children: React.ReactNode }) { return <td className="px-3 py-1.5 border-b border-zinc-800/50">{renderChildrenWithPaths(children)}</td>; },
  a({ href, children }: { href?: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{children}</a>; },
  ul({ children }: { children: React.ReactNode }) { return <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-zinc-600">{children}</ul>; },
  ol({ children }: { children: React.ReactNode }) { return <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-zinc-600">{children}</ol>; },
  li({ children }: { children: React.ReactNode }) { return <li className="pl-1">{renderChildrenWithPaths(children)}</li>; },
  blockquote({ children }: { children: React.ReactNode }) { return <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 text-zinc-400 italic">{renderChildrenWithPaths(children)}</blockquote>; },
  h1({ children }: { children: React.ReactNode }) { return <h1 className="mt-3 mb-1.5 text-base font-semibold text-zinc-100">{renderChildrenWithPaths(children)}</h1>; },
  h2({ children }: { children: React.ReactNode }) { return <h2 className="mt-3 mb-1.5 text-sm font-semibold text-zinc-100">{renderChildrenWithPaths(children)}</h2>; },
  h3({ children }: { children: React.ReactNode }) { return <h3 className="mt-2 mb-1 text-sm font-medium text-zinc-200">{renderChildrenWithPaths(children)}</h3>; },
  hr() { return <hr className="my-3 border-zinc-700" />; },
  p({ children }: { children: React.ReactNode }) { return <p className="my-1.5 leading-relaxed">{renderChildrenWithPaths(children)}</p>; },
  strong({ children }: { children: React.ReactNode }) { return <strong className="font-semibold text-zinc-100">{renderChildrenWithPaths(children)}</strong>; },
  em({ children }: { children: React.ReactNode }) { return <em className="italic text-zinc-200">{renderChildrenWithPaths(children)}</em>; },
};

function MarkdownContent({ content }: { content: string }) {
  return <div className="markdown-body"><Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</Markdown></div>;
}

function summarizeResult(result: any): string {
  if (result == null) return "No result";
  if (typeof result === "string") return result.length > 80 ? result.slice(0, 80) + "..." : result;
  const json = JSON.stringify(result);
  return json.length > 80 ? json.slice(0, 80) + "..." : json;
}

/* ---- Inline Model Picker ---- */

interface ModelInfo {
  id: string;
  owned_by: string;
}

function InlineModelPicker() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const getConfig = useSessionStore((s) => s.getConfig);
  const updateConfig = useSessionStore((s) => s.updateConfig);

  useEffect(() => {
    if (!window.api?.listModels) return;
    window.api.listModels().then((data: ModelInfo[]) => setModels(data ?? []));
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;
    getConfig().then((c: any) => {
      if (c?.model) setCurrentModel(c.model);
    });
  }, [currentSessionId, getConfig]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        (m.id ?? "").toLowerCase().includes(q) ||
        (m.owned_by ?? "").toLowerCase().includes(q),
    );
  }, [models, search]);

  const handleSelect = async (id: string) => {
    setCurrentModel(id);
    setOpen(false);
    setSearch("");
    await updateConfig({ model: id });
  };

  const displayName = currentModel
    ? currentModel.split("/").pop() || currentModel
    : "Model";

  if (!currentSessionId) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors max-w-[180px]"
        title={currentModel}
      >
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="truncate">{displayName}</span>
        <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-zinc-800">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-3">No models found</p>
            )}
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-zinc-800 ${
                  m.id === currentModel ? "text-blue-400 bg-blue-900/20" : "text-zinc-300"
                }`}
              >
                {m.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
