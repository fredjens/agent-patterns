"use client";

import { MODEL_LABEL } from "@/lib/model";

const FALLBACK_PROMPTS = [
  "Trade-offs between microservices and monolithic architecture",
  "Getting started with Rust for Python developers",
  "Is remote work better for productivity than office?",
  "Meal plan for someone training for a marathon",
];

interface Props {
  prompt: string;
  running: boolean;
  examplePrompts?: string[];
  onPromptChange: (v: string) => void;
  onRun: () => void;
  onAbort: () => void;
}

export function PromptPanel({ prompt, running, examplePrompts, onPromptChange, onRun, onAbort }: Props) {
  const prompts = examplePrompts && examplePrompts.length > 0 ? examplePrompts : FALLBACK_PROMPTS;
  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-3">

      {!prompt && !running && (
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => onPromptChange(p)}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <textarea
        className="w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-600 min-h-[80px]"
        placeholder="Enter a prompt…"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={running}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running && prompt.trim()) {
            onRun();
          }
        }}
      />

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{MODEL_LABEL}</span>

        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-zinc-600 hidden sm:block">⌘↵ to run</p>
          {running && (
            <button
              onClick={onAbort}
              className="rounded-md px-4 py-1.5 text-sm font-medium border border-zinc-600 text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Stop
            </button>
          )}
          <button
            onClick={onRun}
            disabled={running || !prompt.trim()}
            className="rounded-md px-5 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
          >
            {running ? "Running…" : "Run"}
          </button>
        </div>
      </div>

    </div>
  );
}
