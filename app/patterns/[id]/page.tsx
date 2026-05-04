"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PromptPanel } from "@/components/PromptPanel";
import { AgentOutputLog } from "@/components/AgentOutputLog";
import { TopologyRenderer } from "@/components/TopologyRenderer";
import { NodeInspector } from "@/components/NodeInspector";
import { listPatterns, getFlow } from "@/lib/pattern-meta";
import { useRun } from "@/lib/use-run";
import { Flow, NodeDef } from "@/engine/types";

type Tab = "flow" | "run";

export default function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patternId } = use(params);
  const [prompt, setPrompt] = useState("");
  const [tab, setTab] = useState<Tab>("flow");
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const { state, startRun, abort, approve, reject } = useRun();

  const pattern = listPatterns().find((p) => p.id === patternId);
  const flow = getFlow(patternId);

  if (!pattern || !flow) notFound();

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
    setPrompt("");
    setTab("run");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      <AppHeader>
        <span className="text-zinc-700 select-none">/</span>
        <span className="text-sm font-semibold text-zinc-100 truncate">{pattern.name}</span>
        {/* Tabs: mobile only — desktop shows both panels side-by-side */}
        <div className="ml-auto flex gap-1 shrink-0 md:hidden">
          {(["flow", "run"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize tracking-wide transition-colors ${
                tab === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </AppHeader>

      {state.error && (
        <div className="mx-4 mt-3 shrink-0 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Topology panel — always visible on desktop, tab-controlled on mobile */}
        <div className={`flex-1 flex flex-col overflow-y-auto border-zinc-800 md:border-r ${tab === "flow" ? "flex" : "hidden md:flex"}`}>
          <p className="px-6 pt-4 text-sm text-zinc-400 leading-relaxed">{pattern.about}</p>
          <div className="flex-1 flex items-center justify-center p-6">
            <TopologyRenderer flow={flow} nodes={state.nodes} onNodeClick={handleNodeClick} selectedId={inspectedNodeId} />
          </div>
          {inspectedNodeId && (
            <NodeInspector
              nodeId={inspectedNodeId}
              nodeDef={getNodeDef(inspectedNodeId)}
              onClose={() => setInspectedNodeId(null)}
            />
          )}
        </div>

        {/* Output panel — always visible on desktop, tab-controlled on mobile */}
        <div className={`flex flex-col md:w-[55%] shrink-0 min-h-0 ${tab === "run" ? "flex-1" : "hidden md:flex"}`}>
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
            examplePrompts={flow.example_prompts}
            onPromptChange={setPrompt}
            onRun={handleRun}
            onAbort={abort}
          />
        </div>
      </div>
    </div>
  );
}
