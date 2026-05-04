import { Gallery } from "@/components/Gallery";
import { listPatterns, getFlow } from "@/lib/pattern-meta";
import { MODEL_LABEL } from "@/lib/model";
import { AppHeader } from "@/components/AppHeader";

export default function GalleryPage() {
  const patterns = listPatterns()
    .map((p) => ({ ...p, flow: getFlow(p.id) }))
    .filter((p): p is typeof p & { flow: NonNullable<typeof p.flow> } => p.flow !== undefined);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppHeader />

      <main className="px-4 md:px-12 lg:px-16 py-8">
        <div className="mb-7 max-w-3xl">
          <p className="text-2xl font-semibold text-zinc-100 leading-snug mb-2">Runnable patterns for building with agents</p>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Open one to inspect its topology, send it a prompt, and watch the agents work.
          </p>
        </div>

        <Gallery patterns={patterns} />

        <footer className="mt-16 pt-8 border-t border-zinc-800/60 max-w-3xl">
          <p className="text-xs text-zinc-600">Demos run on {MODEL_LABEL}</p>
        </footer>
      </main>
    </div>
  );
}
