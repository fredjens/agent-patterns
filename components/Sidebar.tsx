"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { listPatterns } from "@/lib/pattern-meta";
import { Logo } from "@/components/Logo";

export function Sidebar() {
  const pathname = usePathname();
  const selected = pathname?.match(/\/patterns\/([^/]+)/)?.[1];
  const patterns = listPatterns();

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-800 overflow-y-auto bg-zinc-950 p-4">
      <Link href="/" className="flex items-center gap-2 mb-6 text-zinc-200 hover:text-zinc-100 transition-colors">
        <Logo size={18} />
        <span className="font-semibold text-sm tracking-tight">Agent Patterns</span>
      </Link>
      <p className="text-xs text-zinc-600 uppercase tracking-wide mb-2">Patterns</p>
      {patterns.map((p) => (
        <Link
          key={p.id}
          href={`/patterns/${p.id}`}
          className={`block w-full text-left rounded-md px-3 py-2 mb-1 text-sm transition-colors ${
            selected === p.id
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
          }`}
        >
          <span className="font-medium">{p.name}</span>
        </Link>
      ))}
    </aside>
  );
}
