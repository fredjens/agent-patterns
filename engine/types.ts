export type AgentState = "idle" | "active" | "streaming" | "done" | "error" | "waiting";

// Result of an agent's transfer/handoff/route decision. Reused on AgentNodeState,
// in RunEvent's agent_tool_call payload, and as the return shape of callClaudeWithTools.
export interface ToolCall {
  to: string;
  reason?: string;
}

export interface AgentNodeState {
  id: string;
  role: string;
  state: AgentState;
  output: string;
  tokens: number;
  durationMs: number;
  startedAt?: number;
  parentId?: string;
  error?: string;
  toolCall?: ToolCall;
}

export type RunEvent =
  | { type: "run_start"; pattern: string; model: string; agentCount?: number }
  | { type: "agent_spawn"; agentId: string; role: string; parentId?: string }
  | { type: "agent_start"; agentId: string }
  | { type: "agent_chunk"; agentId: string; chunk: string }
  | { type: "agent_complete"; agentId: string; tokens: number; durationMs: number }
  | { type: "agent_error"; agentId: string; error: string }
  | ({ type: "agent_tool_call"; agentId: string } & ToolCall)
  | { type: "agent_tool_result"; agentId: string; toolName: string; result: string }
  | { type: "hitl_waiting"; agentId: string }
  | { type: "human_approval_required"; agentId: string; action: string; runId: string }
  | { type: "human_approval_received"; approved: boolean; feedback?: string }
  | { type: "phase_change"; phase: string; description: string }
  | { type: "run_complete"; finalOutput: string; stats: RunStats }
  | { type: "run_error"; error: string };

export interface RunStats {
  totalTokens: number;
  totalDurationMs: number;
  agentCount: number;
}

export interface RunRequest {
  prompt: string;
  pattern: string;
}

export type EventSink = (event: RunEvent) => void;

export interface PatternMeta {
  id: string;
  name: string;
  category: string;
  summary: string;
  about: string;
  agentRoles: string[];
  tags: string[];
}

export interface RunOptions {
  awaitApproval?: (action: string, agentId: string) => Promise<string>;
}

export interface PatternDefinition extends PatternMeta {
  run: (prompt: string, emit: EventSink, options?: RunOptions) => Promise<void>;
}

// ── Flow JSON shape ──────────────────────────────────────────────────────────
// Mirrors the structure of the files in engine/patterns/. JSON is loaded at
// build time and cast to Flow at the import site.

export interface InputSpec {
  from: string;
  description?: string;
}

export interface OutputSpec {
  format?: "text" | "json_array" | "json_object";
  description?: string;
  schema?: Record<string, string>;
  on_parse_error?: "retry_once";
}

export interface NodeDef {
  role: string;
  description?: string;
  system: string;
  template?: boolean;
  inputs?: Record<string, InputSpec>;
  output?: OutputSpec;
  routes_to?: string[];
  can_handoff_to?: string[];
  route_only?: boolean;
}

// Discriminated union of every step type the interpreter recognises
export type Step =
  | { type: "node"; id: string }
  | { type: "sequence"; steps: Step[] }
  | { type: "parallel"; nodes: string[]; id?: string; label?: string }
  | { type: "map"; over: string; template: string; id: string; sequential?: boolean; count_hint?: string }
  | { type: "repeat"; template: string; count: number; id?: string }
  | { type: "branch"; selector: string; candidates: string[] }
  | { type: "loop"; steps: Step[]; max_iterations?: number; until?: { node?: string; output?: unknown; output_contains?: string } }
  | { type: "dynamic"; entry: string; pool: (NodeDef & { id: string })[]; max_steps?: number }
  | { type: "tool_loop"; agent: string; tools: string[]; max_steps?: number }
  | { type: "hitl_checkpoint"; id?: string; action?: string };

export interface Flow {
  id: string;
  name: string;
  category: string;
  summary: string;
  about: string;
  output?: string;
  nodes?: Record<string, NodeDef>;
  execution: Step;
}

// Runtime context the interpreter passes between steps. Each entry holds the
// output of a node (or input.prompt for the initial entry). Output is `unknown`
// because it can be a string, a ToolCall, or an array of any of those.
export type Context = Record<string, { output: unknown } | { prompt: string }>;
