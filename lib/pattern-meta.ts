import { PatternMeta, Flow, Step, NodeDef } from "@/engine/types";

import pipeline from "@/engine/patterns/pipeline.json";
import decomposition from "@/engine/patterns/decomposition.json";
import planExecute from "@/engine/patterns/plan-execute.json";
import debate from "@/engine/patterns/debate.json";
import reflection from "@/engine/patterns/reflection.json";
import routing from "@/engine/patterns/routing.json";
import voting from "@/engine/patterns/voting.json";
import handoff from "@/engine/patterns/handoff.json";
import react from "@/engine/patterns/react.json";
import hitl from "@/engine/patterns/hitl.json";
import rag from "@/engine/patterns/rag.json";
import swarm from "@/engine/patterns/swarm.json";
import treeOfThought from "@/engine/patterns/tree-of-thought.json";
import evaluatorOptimizer from "@/engine/patterns/evaluator-optimizer.json";
import humanAsTool from "@/engine/patterns/human-as-tool.json";

// JSON imports come in as inferred types from the .json files; cast at the
// boundary so the rest of this module works with the proper Flow type.
const flows: Flow[] = [
  pipeline, react, rag, reflection, planExecute,
  routing, handoff, swarm,
  decomposition, voting, debate, treeOfThought,
  evaluatorOptimizer, hitl, humanAsTool,
] as unknown as Flow[];

// Walk the execution tree and any node defs to derive a flat set of tags.
// Tags answer "what does this pattern do mechanically?" and stay in sync with the JSON.
function deriveTags(flow: Flow): string[] {
  const tags = new Set<string>();
  const nodes: NodeDef[] = flow.nodes ? Object.values(flow.nodes) : [];
  let nodeStepCount = 0;
  let hasConcurrency = false;

  for (const n of nodes) {
    if ((n.routes_to?.length ?? 0) > 0 || (n.can_handoff_to?.length ?? 0) > 0) tags.add("autonomous");
  }

  function walk(step: Step) {
    switch (step.type) {
      case "node":
        nodeStepCount++;
        break;
      case "parallel":
        tags.add("parallel");
        hasConcurrency = true;
        break;
      case "loop":
        tags.add("iterative");
        step.steps.forEach(walk);
        break;
      case "map":
        if (step.sequential) {
          tags.add("sequential");
        } else {
          tags.add("parallel");
          hasConcurrency = true;
        }
        break;
      case "repeat":
        tags.add("parallel");
        hasConcurrency = true;
        break;
      case "branch":
        tags.add("branching");
        break;
      case "tool_loop":
        tags.add("tools");
        break;
      case "hitl_checkpoint":
        tags.add("human");
        break;
      case "dynamic":
        tags.add("autonomous");
        break;
      case "sequence":
        step.steps.forEach(walk);
        break;
    }
  }
  walk(flow.execution);

  // Pure chains (multiple nodes, no concurrency, no autonomy) are sequential
  if (!hasConcurrency && nodeStepCount > 1 && !tags.has("autonomous")) {
    tags.add("sequential");
  }

  return Array.from(tags);
}

function collectAgentRoles(flow: Flow): string[] {
  if (flow.nodes) {
    return Object.values(flow.nodes)
      .filter((n) => !n.template)
      .map((n) => n.role);
  }
  if (flow.execution.type === "dynamic") {
    return flow.execution.pool.map((n) => n.role);
  }
  return [];
}

export const PATTERNS: PatternMeta[] = flows.map((f) => ({
  id: f.id,
  name: f.name,
  category: f.category,
  summary: f.summary,
  about: f.about,
  agentRoles: collectAgentRoles(f),
  tags: deriveTags(f),
}));

export function listPatterns(): PatternMeta[] {
  return PATTERNS;
}

export function getPatternMeta(id: string): PatternMeta | undefined {
  return PATTERNS.find((p) => p.id === id);
}

export function getFlow(id: string): Flow | undefined {
  return flows.find((f) => f.id === id);
}
