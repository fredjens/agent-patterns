"use client";

import { useEffect, useState } from "react";
import { AgentNodeState } from "@/engine/types";

const STATE_BORDER: Record<string, string> = {
  idle:      "border-zinc-800",
  active:    "border-blue-500/50",
  streaming: "border-blue-400/50",
  done:      "border-emerald-500/30",
  error:     "border-red-500/50",
  waiting:   "border-amber-500/50",
};

const STATE_ACCENT: Record<string, string> = {
  idle:      "bg-zinc-700/50",
  active:    "bg-blue-500 animate-pulse",
  streaming: "bg-blue-400 animate-pulse",
  done:      "bg-emerald-500",
  error:     "bg-red-500",
  waiting:   "bg-amber-400 animate-pulse",
};

const STATE_BG: Record<string, string> = {
  idle:      "bg-zinc-900",
  active:    "bg-blue-950/50",
  streaming: "bg-blue-950/40",
  done:      "bg-zinc-900",
  error:     "bg-red-950/30",
  waiting:   "bg-amber-950/30",
};

const STATE_TEXT: Record<string, string> = {
  idle:      "text-zinc-500",
  active:    "text-zinc-200",
  streaming: "text-zinc-100",
  done:      "text-zinc-300",
  error:     "text-red-300",
  waiting:   "text-amber-200",
};

interface Props {
  node: AgentNodeState;
  onClick?: () => void;
}

// Re-renders every 100ms while running so the timer counts up live; freezes on `done`.
function useLiveElapsedMs(startedAt: number | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running, startedAt]);
  return startedAt ? now - startedAt : 0;
}

export function AgentNode({ node, onClick }: Props) {
  const state = node.state ?? "idle";
  const isRunning = state === "active" || state === "streaming";
  const liveMs = useLiveElapsedMs(node.startedAt, isRunning);
  const elapsedMs = state === "done" ? node.durationMs : isRunning ? liveMs : 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative flex flex-col rounded-lg border overflow-hidden min-w-[110px] max-w-[160px]
        transition-colors duration-300
        ${STATE_BORDER[state] ?? STATE_BORDER.idle}
        ${STATE_BG[state] ?? STATE_BG.idle}
        ${onClick ? "cursor-pointer hover:brightness-110" : ""}
      `}
    >
      <div className={`h-[2px] w-full shrink-0 ${STATE_ACCENT[state] ?? STATE_ACCENT.idle}`} />

      <div className="px-3 py-2.5 pr-9">
        <span className={`text-xs font-semibold uppercase tracking-wide leading-tight block ${STATE_TEXT[state] ?? STATE_TEXT.idle}`}>
          {node.role}
        </span>

        {/* Always rendered to reserve vertical space — opacity flips so the card doesn't shrink on done */}
        <div className={`flex gap-[3px] mt-2 transition-opacity duration-200 ${isRunning ? "opacity-100" : "opacity-0"}`}>
          <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce [animation-delay:120ms]" />
          <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce [animation-delay:240ms]" />
        </div>

        {state === "error" && node.error && (
          <p className="text-[10px] text-red-400 mt-1 leading-tight break-words">{node.error}</p>
        )}
      </div>

      {elapsedMs > 0 && (
        <span className={`absolute bottom-1.5 right-2 text-[10px] font-mono tabular-nums transition-colors duration-200 ${
          state === "done" ? "text-zinc-500" : "text-blue-300/70"
        }`}>
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
