import React from "react";
import { useSessionStore } from "../../stores/session-store";

interface Props {
  session: { id: string; name: string; updatedAt: string };
  isActive: boolean;
}

export function SessionItem({ session, isActive }: Props) {
  const selectSession = useSessionStore((s) => s.selectSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const isStreaming = useSessionStore(
    (s) => !!s.sessionStreams[session.id]?.streaming,
  );

  return (
    <div
      onClick={() => selectSession(session.id)}
      className={`group flex items-center justify-between px-3 py-2 rounded-lg
                  cursor-pointer text-sm transition-colors mb-0.5
                  ${isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}
    >
      <span className="truncate flex items-center gap-1.5">
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
        )}
        {session.name}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteSession(session.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
