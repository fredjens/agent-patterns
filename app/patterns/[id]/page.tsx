"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { PromptPanel } from "@/components/PromptPanel";
import { PatternInfo } from "@/components/PatternInfo";
import { AgentOutputLog } from "@/components/AgentOutputLog";
import { TopologyRenderer } from "@/components/TopologyRenderer";
import { NodeInspector } from "@/components/NodeInspector";
import { listPatterns, getFlow } from "@/lib/pattern-meta";
import { useRun } from "@/lib/use-run";
import { Flow, NodeDef } from "@/engine/types";

export default function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patternId } = use(params);
  const [prompt, setPrompt] = useState("");
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const { state, startRun, abort, approve, reject } = useRun();

  const pattern = listPatterns().find((p) => p.id === patternId);
  const flow = getFlow(patternId);

  if (!pattern || !flow) notFound();

  // After notFound, we know flow is defined; alias to a non-undefined local
  // so closures below don't need to re-narrow.
  const definedFlow: Flow = flow;

  function handleNodeClick(id: string) {
    setInspectedNodeId((prev) => (prev === id ? null : id));
  }

  function getNodeDef(id: string): NodeDef | undefined {
    if (definedFlow.nodes?.[id]) return definedFlow.nodes[id];
    if (definedFlow.execution.type === "dynamic") {
      return definedFlow.execution.pool.find((n) => n.id === id);
    }
    return undefined;
  }

  function handleRun() {
    if (!prompt.trim()) return;
    startRun(prompt, patternId);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <PatternInfo pattern={pattern} />

        {state.error && (
          <div className="mx-4 mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {state.error}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 border-r border-zinc-800 flex flex-col overflow-y-auto">
            <p className="px-6 pt-4 text-sm text-zinc-400 leading-relaxed">{pattern.about}</p>
            <div className="flex-1 flex items-center justify-center p-6">
              <TopologyRenderer flow={flow} nodes={state.nodes} onNodeClick={handleNodeClick} />
            </div>
            {inspectedNodeId && (
              <NodeInspector
                nodeId={inspectedNodeId}
                nodeDef={getNodeDef(inspectedNodeId)}
                onClose={() => setInspectedNodeId(null)}
              />
            )}
          </div>

          <div className="w-[55%] shrink-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              <AgentOutputLog
                nodes={state.nodes}
                finalOutput={state.finalOutput}
                stats={state.stats}
                pendingApproval={state.pendingApproval}
                onApprove={approve}
                onReject={reject}
              />
            </div>
            <PromptPanel
              prompt={prompt}
              running={state.status === "running"}
              onPromptChange={setPrompt}
              onRun={handleRun}
              onAbort={abort}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
