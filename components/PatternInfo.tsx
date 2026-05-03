"use client";

import { PatternMeta } from "@/engine/types";

interface Props {
  pattern: PatternMeta;
}

export function PatternInfo({ pattern }: Props) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <p className="text-base font-semibold text-zinc-100">{pattern.name}</p>
    </div>
  );
}
