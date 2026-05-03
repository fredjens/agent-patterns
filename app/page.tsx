import Link from "next/link";
import { Logo } from "@/components/Logo";
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
            <Logo size={24} />
            <span className="text-xl font-semibold tracking-tight">Agent Patterns</span>
          </Link>
          <p className="text-sm text-zinc-300 leading-snug">Runnable patterns for building with agents</p>
          <p className="text-sm text-zinc-500 leading-relaxed whitespace-nowrap">
            Open one to inspect its topology, send it a prompt, and watch the agents work.
          </p>
        </header>

        <Gallery patterns={patterns} />

        <footer className="mt-16 pt-8 border-t border-zinc-800/60 max-w-3xl">
          <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Why {MODEL_LABEL}?</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Every pattern in the gallery runs on {MODEL_LABEL} — chosen because it streams fast,
            costs fractions of a cent per run, supports tool calling (needed for Routing and Handoff),
            and produces reliable JSON (needed for Plan → Execute and Decomposition).
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mt-2">
            Tradeoff: less reasoning depth than Sonnet or Opus on hard problems, so syntheses can be
            terse on complex prompts. For a runnable gallery focused on showing pattern shape and behaviour,
            it&apos;s the right deal.
          </p>
        </footer>
      </main>
    </div>
  );
}
