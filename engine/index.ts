import "server-only";
import { PatternDefinition, Flow } from "./types";
import { interpret } from "./interpreter";

import pipeline from "./patterns/pipeline.json";
import decomposition from "./patterns/decomposition.json";
import planExecute from "./patterns/plan-execute.json";
import debate from "./patterns/debate.json";
import reflection from "./patterns/reflection.json";
import routing from "./patterns/routing.json";
import voting from "./patterns/voting.json";
import handoff from "./patterns/handoff.json";
import react from "./patterns/react.json";
import hitl from "./patterns/hitl.json";
import rag from "./patterns/rag.json";
import swarm from "./patterns/swarm.json";
import treeOfThought from "./patterns/tree-of-thought.json";
import evaluatorOptimizer from "./patterns/evaluator-optimizer.json";
import humanAsTool from "./patterns/human-as-tool.json";

// JSON imports come in as `unknown`-ish; cast to Flow at the boundary so the
// rest of the engine works with proper types.
const flows: Flow[] = [
  pipeline, react, rag, reflection, planExecute,
  routing, handoff, swarm,
  decomposition, voting, debate, treeOfThought,
  evaluatorOptimizer, hitl, humanAsTool,
] as unknown as Flow[];

function collectAgentRoles(flow: Flow): string[] {
  if (flow.nodes) {
    return Object.values(flow.nodes).filter((n) => !n.template).map((n) => n.role);
  }
  if (flow.execution.type === "dynamic") {
    return flow.execution.pool.map((n) => n.role);
  }
  return [];
}

export const patternRegistry: Record<string, PatternDefinition> = Object.fromEntries(
  flows.map((flow) => [
    flow.id,
    {
      id: flow.id,
      name: flow.name,
      category: flow.category,
      summary: flow.summary,
      about: flow.about,
      agentRoles: collectAgentRoles(flow),
      tags: [],
      run: (prompt, emit, opts) => interpret(flow, prompt, emit, opts),
    } satisfies PatternDefinition,
  ])
);

export function getPattern(id: string): PatternDefinition | undefined {
  return patternRegistry[id];
}

export function listPatterns(): PatternDefinition[] {
  return Object.values(patternRegistry);
}
