"use client";

interface NodeDef {
  role: string;
  description?: string;
  system?: string;
  inputs?: Record<string, { from: string; description?: string }>;
  output?: { format?: string; description?: string };
}

interface Props {
  nodeId: string;
  nodeDef: NodeDef | undefined;
  onClose: () => void;
}

export function NodeInspector({ nodeId, nodeDef, onClose }: Props) {
  if (!nodeDef) return null;

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-4 text-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-0.5">{nodeId}</p>
          <p className="text-base font-semibold text-zinc-100">{nodeDef.role}</p>
          {nodeDef.description && (
            <p className="text-zinc-400 mt-0.5 text-xs">{nodeDef.description}</p>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors ml-4 mt-0.5">
          ✕
        </button>
      </div>

      {nodeDef.system && (
        <section className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">System Prompt</p>
          <pre className="text-xs text-zinc-300 bg-zinc-900 rounded-lg px-3 py-2 whitespace-pre-wrap font-mono leading-relaxed border border-zinc-800">
            {nodeDef.system}
          </pre>
        </section>
      )}

      {nodeDef.inputs && Object.keys(nodeDef.inputs).length > 0 && (
        <section className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Inputs</p>
          <div className="flex flex-col gap-1">
            {Object.entries(nodeDef.inputs).map(([key, inp]) => (
              <div key={key} className="flex items-baseline gap-2 bg-zinc-900 rounded px-3 py-1.5 border border-zinc-800">
                <span className="text-zinc-300 font-mono text-xs shrink-0">{key}</span>
                <span className="text-zinc-600 text-xs">←</span>
                <span className="text-blue-400 font-mono text-xs shrink-0">{inp.from}</span>
                {inp.description && (
                  <span className="text-zinc-500 text-xs ml-1">— {inp.description}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {nodeDef.output && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">Output</p>
          <div className="flex items-baseline gap-2 bg-zinc-900 rounded px-3 py-1.5 border border-zinc-800">
            {nodeDef.output.format && (
              <span className="text-emerald-400 font-mono text-xs">{nodeDef.output.format}</span>
            )}
            {nodeDef.output.description && (
              <span className="text-zinc-400 text-xs">— {nodeDef.output.description}</span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
