"use client";

import { RunStats } from "@/engine/types";

interface Props {
  output: string;
  stats: RunStats | null;
}

export function FinalOutput({ output, stats }: Props) {
  if (!output) return null;
  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Final Output</p>
        {stats && (
          <p className="text-xs text-zinc-600">
            {stats.agentCount} agents · {(stats.totalDurationMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 text-sm text-zinc-100 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
        {output}
      </div>
    </div>
  );
}
