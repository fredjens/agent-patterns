import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import { listPatterns, getFlow } from "@/lib/pattern-meta";
import { MODEL_LABEL } from "@/lib/model";

export default function GalleryPage() {
  // Filter out any pattern whose flow can't be resolved (shouldn't happen — every
  // pattern in the registry corresponds to a JSON file — but keeps the type narrow).
  const patterns = listPatterns()
    .map((p) => ({ ...p, flow: getFlow(p.id) }))
    .filter((p): p is typeof p & { flow: NonNullable<typeof p.flow> } => p.flow !== undefined);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="px-8 md:px-12 lg:px-16 py-8">
        <header className="mb-7 max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-7 text-zinc-100 hover:text-white transition-colors">
<span className="text-xl font-semibold tracking-tight">Agent Patterns</span>
          </Link>
          <p className="text-sm text-zinc-300 leading-snug">Runnable patterns for building with agents</p>
          <p className="text-sm text-zinc-500 leading-relaxed whitespace-nowrap">
            Open one to inspect its topology, send it a prompt, and watch the agents work.
          </p>
        </header>

        <Gallery patterns={patterns} />

        <footer className="mt-16 pt-8 border-t border-zinc-800/60 max-w-3xl">
          <p className="text-xs text-zinc-600">Demos run on {MODEL_LABEL}</p>
        </footer>
      </main>
    </div>
  );
}
