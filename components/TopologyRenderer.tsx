"use client";

import { AgentNodeState, Flow, Step, NodeDef } from "@/engine/types";
import { AgentNode } from "@/components/AgentNode";

interface Props {
  flow: Flow;
  nodes: AgentNodeState[];
  onNodeClick?: (id: string) => void;
  selectedId?: string | null;
}

function ghost(id: string, def: { role?: string } | undefined): AgentNodeState {
  return { id, role: def?.role ?? id, state: "idle", output: "", tokens: 0, durationMs: 0 };
}

function getNode(id: string, def: NodeDef | undefined, nodes: AgentNodeState[]): AgentNodeState {
  return nodes.find((n) => n.id === id) ?? ghost(id, def);
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-3">{children}</div>;
}

// Shared label style: pill chip used for all floating and container meta-labels
function Tag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
      {text}
    </span>
  );
}

// Solid border — for groups that always run (loop body, handoff pool)
function GroupBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded-xl px-5 py-4 flex flex-col items-center gap-4 bg-zinc-900/40">
      <Tag text={label} />
      {children}
    </div>
  );
}

// Dashed border — for templates whose count is determined at runtime
function TemplateBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-zinc-700 rounded-xl px-4 py-3 flex flex-col items-center gap-3">
      <Tag text={label} />
      {children}
    </div>
  );
}

// Stacked diagonal cards — parallel map template (multiple copies, all at once)
function StackedTemplate({ node, countHint, onClick, selected }: { node: AgentNodeState; countHint?: string; onClick?: () => void; selected: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* outer wrapper provides overflow space; inner relative is sized to the card only */}
      <div className="pb-2.5 pr-2.5">
        <div className="relative">
          <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60" />
          <div className="absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-lg border border-zinc-700/40 bg-zinc-800/40" />
          <div className="relative">
            <AgentNode node={node} onClick={onClick} selected={selected} />
          </div>
        </div>
      </div>
      <Tag text={`×${countHint ?? "N"} · parallel`} />
    </div>
  );
}

function Seq({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-5">{children}</div>;
}

function click(onNodeClick: ((id: string) => void) | undefined, id: string): (() => void) | undefined {
  return onNodeClick ? () => onNodeClick(id) : undefined;
}

function RenderStep({ step, flow, nodes, onNodeClick, selectedId }: { step: Step; flow: Flow; nodes: AgentNodeState[]; onNodeClick: ((id: string) => void) | undefined; selectedId: string | null | undefined }) {
  switch (step.type) {

    case "sequence": {
      return (
        <Seq>
          {step.steps.map((s, i) => (
            <RenderStep key={i} step={s} flow={flow} nodes={nodes} onNodeClick={onNodeClick} selectedId={selectedId} />
          ))}
        </Seq>
      );
    }

    case "node": {
      const node = getNode(step.id, flow.nodes?.[step.id], nodes);
      return <AgentNode node={node} onClick={click(onNodeClick, step.id)} selected={selectedId === step.id} />;
    }

    case "parallel": {
      const parallelNodes = step.nodes.map((id) => getNode(id, flow.nodes?.[id], nodes));
      return (
        <div className="flex flex-col items-center gap-2">
          {step.label && <Tag text={step.label} />}
          <Row>{parallelNodes.map((n) => <AgentNode key={n.id} node={n} onClick={click(onNodeClick, n.id)} selected={selectedId === n.id} />)}</Row>
        </div>
      );
    }

    case "map": {
      const spawned = nodes.filter((n) => n.id.startsWith(step.template + "-") && !n.id.includes("-ghost-"));
      const templateDef = flow.nodes?.[step.template];

      if (spawned.length > 0) {
        if (step.sequential) {
          return <Seq>{spawned.map((n) => <AgentNode key={n.id} node={n} onClick={click(onNodeClick, n.id)} selected={selectedId === n.id} />)}</Seq>;
        }
        return <Row>{spawned.map((n) => <AgentNode key={n.id} node={n} onClick={click(onNodeClick, n.id)} selected={selectedId === n.id} />)}</Row>;
      }

      const hasTemplate = /\{\{[^}]+\}\}/.test(templateDef?.role ?? "");
      const cleanRole = hasTemplate
        ? step.template.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : (templateDef?.role ?? step.template);
      const templateGhost = ghost(`${step.template}-ghost-0`, { role: cleanRole });

      if (step.sequential) {
        return (
          <TemplateBox label={`×${step.count_hint ?? "N"} · sequential`}>
            <AgentNode node={templateGhost} onClick={click(onNodeClick, step.template)} selected={selectedId === step.template} />
          </TemplateBox>
        );
      }
      return <StackedTemplate node={templateGhost} countHint={step.count_hint} onClick={click(onNodeClick, step.template)} selected={selectedId === step.template} />;
    }

    case "repeat": {
      const spawned = nodes.filter((n) => n.id.startsWith(step.template + "-"));
      const templateDef = flow.nodes?.[step.template];
      const displayNodes = spawned.length > 0
        ? spawned
        : Array.from({ length: step.count }, (_, i) => ghost(`${step.template}-${i}`, templateDef));
      return (
        <Row>{displayNodes.map((n) => <AgentNode key={n.id} node={n} onClick={click(onNodeClick, step.template)} selected={selectedId === step.template} />)}</Row>
      );
    }

    case "branch": {
      const candidates = step.candidates.map((id) => getNode(id, flow.nodes?.[id], nodes));
      return (
        <div className="flex flex-wrap justify-center items-center gap-2">
          {candidates.map((n, i) => (
            <div key={n.id} className="flex items-center gap-2">
              {i > 0 && <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-0.5">or</span>}
              <AgentNode node={n} onClick={click(onNodeClick, n.id)} selected={selectedId === n.id} />
            </div>
          ))}
        </div>
      );
    }

    case "loop": {
      return (
        <GroupBox label={`loop · max ${step.max_iterations ?? 3}`}>
          <Seq>
            {step.steps.map((s, i) => (
              <RenderStep key={i} step={s} flow={flow} nodes={nodes} onNodeClick={onNodeClick} selectedId={selectedId} />
            ))}
          </Seq>
        </GroupBox>
      );
    }

    case "dynamic": {
      const pool = step.pool;
      const entryDef = pool.find((n) => n.id === step.entry);
      const specialists = pool.filter((n) => n.id !== step.entry);
      const entryNode = entryDef ? (nodes.find((ln) => ln.id === step.entry) ?? ghost(step.entry, entryDef)) : null;
      const anyCanReroute = specialists.some((n) => (n.can_handoff_to?.length ?? 0) > 0);
      return (
        <Seq>
          {entryNode && <AgentNode node={entryNode} onClick={click(onNodeClick, step.entry)} selected={selectedId === step.entry} />}
          <GroupBox label={anyCanReroute ? "pool · agents may re-route" : "pool"}>
            <Row>
              {specialists.map((def) => {
                const n = nodes.find((ln) => ln.id === def.id) ?? ghost(def.id, def);
                const targets = def.can_handoff_to ?? [];
                const targetRoles = targets.map((tid) => pool.find((p) => p.id === tid)?.role ?? tid);
                return (
                  <div key={def.id} className="flex flex-col items-center gap-1">
                    <AgentNode node={n} onClick={click(onNodeClick, def.id)} selected={selectedId === def.id} />
                    {targetRoles.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1 mt-1">
                        {targetRoles.map((r) => (
                          <span key={r} className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                            <span className="text-zinc-600">→</span>{r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Row>
          </GroupBox>
        </Seq>
      );
    }

    case "tool_loop": {
      const agentId = step.agent;
      const agentDef = flow.nodes?.[agentId];
      const agentNode = nodes.find((n) => n.id === agentId) ?? ghost(agentId, agentDef);
      const toolNames = step.tools ?? ["calculate", "search"];
      return (
        <GroupBox label={`tool loop · max ${step.max_steps ?? 8} steps`}>
          <Seq>
            <AgentNode node={agentNode} onClick={click(onNodeClick, agentId)} selected={selectedId === agentId} />
            <Row>
              {toolNames.map((t) => {
                // Fake walker spawns synthetic `tool:<name>` nodes to flash these on
                const toolState = nodes.find((n) => n.id === `tool:${t}`)?.state;
                const isActive = toolState === "active" || toolState === "streaming";
                return (
                  <div
                    key={t}
                    className={`border border-dashed rounded px-2 py-1.5 transition-colors duration-200 ${
                      isActive
                        ? "border-blue-400 bg-blue-950/50"
                        : "border-zinc-700 bg-zinc-900/60"
                    }`}
                  >
                    <span className={`text-xs font-mono ${isActive ? "text-blue-200" : "text-zinc-500"}`}>{t}()</span>
                  </div>
                );
              })}
            </Row>
          </Seq>
        </GroupBox>
      );
    }

    case "hitl_checkpoint": {
      const cpId = step.id ?? "checkpoint";
      const cpDef = flow.nodes?.[cpId];
      const cpNode = nodes.find((n) => n.id === cpId) ?? ghost(cpId, cpDef);
      return (
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs text-amber-700 uppercase tracking-widest">▼ human review</p>
          <AgentNode node={cpNode} onClick={click(onNodeClick, cpId)} selected={selectedId === cpId} />
        </div>
      );
    }

    default:
      return null;
  }
}

export function TopologyRenderer({ flow, nodes, onNodeClick, selectedId }: Props) {
  return (
    <div className="flex items-center justify-center w-full py-4">
      <RenderStep step={flow.execution} flow={flow} nodes={nodes} onNodeClick={onNodeClick} selectedId={selectedId} />
    </div>
  );
}
