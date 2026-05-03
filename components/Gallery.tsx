"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopologyRenderer } from "@/components/TopologyRenderer";
import { PatternMeta, Flow } from "@/engine/types";
import { useFakeRun } from "@/lib/use-fake-run";

interface Props {
  // Each entry includes the flow JSON so we can render the topology preview client-side
  patterns: (PatternMeta & { flow: Flow })[];
}

const TAG_LABEL: Record<string, string> = {
  parallel:        "Parallel",
  sequential:      "Sequential",
  iterative:       "Iterative",
  branching:       "Branching",
  autonomous:      "Autonomous",
  tools:           "Tools",
  human:           "Human",
  "fixed-count":   "Fixed N",
  "variable-count": "Variable N",
};

function TagChip({ tag, active, onClick }: { tag: string; active?: boolean; onClick?: () => void }) {
  const label = TAG_LABEL[tag] ?? tag;
  return (
    <button
      onClick={onClick}
      type="button"
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
        active
          ? "border-zinc-500 bg-zinc-700 text-zinc-100"
          : "border-zinc-700/60 bg-zinc-800/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {label}
    </button>
  );
}

function ReadOnlyChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
      {TAG_LABEL[tag] ?? tag}
    </span>
  );
}

function PatternCard({ pattern, staggerDelay }: { pattern: PatternMeta & { flow: Flow }; staggerDelay: number }) {
  // Each card runs its own fake animation loop. Staggered start prevents all cards
  // pulsing in lockstep, which looks busier than it is.
  const nodes = useFakeRun(pattern.flow, { startDelay: staggerDelay });

  return (
    <Link
      href={`/patterns/${pattern.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80 transition-colors overflow-hidden"
    >
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-white transition-colors">{pattern.name}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed mt-1.5 line-clamp-2 min-h-[2.4rem]">{pattern.summary}</p>
        <div className="flex flex-wrap gap-1 mt-3 min-h-[20px]">
          {pattern.tags.map((t) => <ReadOnlyChip key={t} tag={t} />)}
        </div>
      </div>
      <div className="border-t border-zinc-800/60 bg-zinc-950/40 px-4 h-[240px] flex items-center justify-center overflow-hidden">
        <div className="scale-[0.6] origin-center pointer-events-none">
          <TopologyRenderer flow={pattern.flow} nodes={nodes} />
        </div>
      </div>
    </Link>
  );
}

export function Gallery({ patterns }: Props) {
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  // Collect all tags actually present, sorted by frequency
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of patterns) for (const t of p.tags) counts[t] = (counts[t] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [patterns]);

  const filtered = activeTags.size === 0
    ? patterns
    : patterns.filter((p) => Array.from(activeTags).every((t) => p.tags.includes(t)));

  function toggle(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-600 mr-1">Filter</span>
        {allTags.map((t) => (
          <TagChip key={t} tag={t} active={activeTags.has(t)} onClick={() => toggle(t)} />
        ))}
        {activeTags.size > 0 && (
          <button
            onClick={() => setActiveTags(new Set())}
            className="text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 ml-1 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((p, i) => (
          <PatternCard key={p.id} pattern={p} staggerDelay={i * 350} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-12">No patterns match these filters.</p>
      )}
    </div>
  );
}
