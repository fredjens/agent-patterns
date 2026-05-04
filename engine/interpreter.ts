import { callClaude, streamClaude, callClaudeWithTools, streamClaudeReAct } from "./claude-client";
import {
  EventSink,
  RunOptions,
  Flow,
  Step,
  NodeDef,
  OutputSpec,
  InputSpec,
  Context,
  ToolCall,
} from "./types";
import { MODEL_ID } from "@/lib/model";

function isToolCall(value: unknown): value is ToolCall {
  return typeof value === "object" && value !== null && "to" in value && typeof (value as { to: unknown }).to === "string";
}

// Pull the `output` field from a context entry, regardless of which variant.
function outputOf(entry: { output: unknown } | { prompt: string } | undefined): unknown {
  return entry && "output" in entry ? entry.output : undefined;
}

export async function interpret(flow: Flow, prompt: string, emit: EventSink, options?: RunOptions) {
  const context: Context = { input: { prompt } };
  const runStart = Date.now();

  emit({ type: "run_start", pattern: flow.id, model: MODEL_ID });
  await executeStep(flow.execution, flow, context, emit, options);

  // Try declared output path first; fall back to last node that produced text.
  let finalOutput: string = "";
  if (flow.output) {
    const resolved = resolvePath(flow.output, context);
    if (typeof resolved === "string") finalOutput = resolved;
  }
  if (!finalOutput) {
    const last = Object.entries(context)
      .filter(([k]) => k !== "input")
      .reverse()
      .find(([, v]) => "output" in v && typeof v.output === "string" && v.output.length > 0);
    finalOutput = last ? (outputOf(last[1]) as string) : "";
  }
  emit({
    type: "run_complete",
    finalOutput,
    stats: {
      totalTokens: 0,
      totalDurationMs: Date.now() - runStart,
      agentCount: Object.keys(context).length - 1,
    },
  });
}

async function executeStep(step: Step, flow: Flow, context: Context, emit: EventSink, options?: RunOptions): Promise<void> {
  switch (step.type) {

    case "node": {
      const node = flow.nodes?.[step.id];
      if (!node) throw new Error(`node: "${step.id}" not found`);
      await executeNode(node, step.id, context, emit);
      break;
    }

    case "sequence": {
      for (const s of step.steps) {
        await executeStep(s, flow, context, emit, options);
      }
      break;
    }

    case "parallel": {
      if (step.label) emit({ type: "phase_change", phase: step.label, description: "" });
      await Promise.all(
        step.nodes.map((id) => executeStep({ type: "node", id }, flow, context, emit, options))
      );
      // Collect outputs under step id so downstream nodes can use $stepId.*
      if (step.id) {
        context[step.id] = { output: step.nodes.map((id) => outputOf(context[id])) };
      }
      break;
    }

    case "tool_loop": {
      const id = step.agent;
      const node = flow.nodes?.[id];
      if (!node) throw new Error(`tool_loop: node "${id}" not found`);
      emit({ type: "agent_spawn", agentId: id, role: node.role });
      emit({ type: "agent_start", agentId: id });
      const start = Date.now();
      const inputs = resolveInputs(node.inputs, context);
      const userContent = buildUserContent(inputs);

      const onHumanInput = options?.awaitApproval
        ? async (question: string) => {
            emit({ type: "hitl_waiting", agentId: id });
            const response = await options.awaitApproval!(question, id, "question");
            emit({ type: "human_approval_received", approved: true, feedback: response });
            return response;
          }
        : undefined;

      const finalOutput = await streamClaudeReAct({
        system: node.system,
        initialPrompt: userContent,
        maxSteps: step.max_steps ?? 8,
        toolNames: step.tools ?? [],
        onChunk: (chunk) => emit({ type: "agent_chunk", agentId: id, chunk }),
        onToolCall: (toolName, args) =>
          emit({ type: "agent_tool_call", agentId: id, to: toolName, reason: JSON.stringify(args) }),
        onToolResult: (toolName, result) =>
          emit({ type: "agent_tool_result", agentId: id, toolName, result }),
        onHumanInput,
      });
      context[id] = { output: finalOutput };
      emit({ type: "agent_complete", agentId: id, tokens: 0, durationMs: Date.now() - start });
      break;
    }

    case "hitl_checkpoint": {
      const id = step.id ?? "checkpoint";
      const nodeDef = flow.nodes?.[id] ?? { role: "Human Review" };
      const action: string = step.action ?? "Approve to continue";
      emit({ type: "agent_spawn", agentId: id, role: nodeDef.role });
      emit({ type: "agent_start", agentId: id });
      emit({ type: "agent_chunk", agentId: id, chunk: action });
      const start = Date.now();
      if (options?.awaitApproval) {
        emit({ type: "hitl_waiting", agentId: id });
        try {
          const feedback = await options.awaitApproval(action, id, "approval");
          context[id] = { output: feedback || "Approved" };
          emit({ type: "human_approval_received", approved: true, feedback });
          emit({ type: "agent_complete", agentId: id, tokens: 0, durationMs: Date.now() - start });
        } catch (reason) {
          context[id] = { output: String(reason) };
          emit({ type: "human_approval_received", approved: false, feedback: String(reason) });
          emit({ type: "agent_error", agentId: id, error: "Rejected" });
          throw new Error("Run stopped by reviewer");
        }
      } else {
        context[id] = { output: "Auto-approved" };
        emit({ type: "agent_complete", agentId: id, tokens: 0, durationMs: Date.now() - start });
      }
      break;
    }

    case "map": {
      const list = resolvePath(step.over, context);
      if (!Array.isArray(list)) throw new Error(`map: could not resolve list from ${step.over}`);
      const template = flow.nodes?.[step.template];
      if (!template) throw new Error(`map: template "${step.template}" not found`);
      const instances = list.map((item, i) => instantiateTemplate(template, step.template, i, item));
      for (const n of instances) {
        emit({ type: "agent_spawn", agentId: n.id, role: n.role });
      }
      if (step.sequential) {
        const accumulated: string[] = [];
        for (const n of instances) {
          await executeNode(n, n.id, context, emit, {
            item: { output: n._item },
            [`${step.id}_prev`]: { output: accumulated.length > 0 ? accumulated.join("\n\n---\n\n") : undefined },
          });
          const out = outputOf(context[n.id]);
          accumulated.push(typeof out === "string" ? out : "");
        }
      } else {
        await Promise.all(instances.map((n) => executeNode(n, n.id, context, emit, { item: { output: n._item } })));
      }
      if (step.id) {
        context[step.id] = { output: instances.map((n) => outputOf(context[n.id])) };
      }
      break;
    }

    case "repeat": {
      const template = flow.nodes?.[step.template];
      if (!template) throw new Error(`repeat: template "${step.template}" not found`);
      const instances = Array.from({ length: step.count }, (_, i) =>
        instantiateTemplate(template, step.template, i, {})
      );
      for (const n of instances) {
        emit({ type: "agent_spawn", agentId: n.id, role: n.role });
      }
      await Promise.all(instances.map((n) => executeNode(n, n.id, context, emit)));
      if (step.id) {
        context[step.id] = { output: instances.map((n) => outputOf(context[n.id])) };
      }
      break;
    }

    case "branch": {
      const selector = resolvePath(step.selector, context);
      const selectorStr = typeof selector === "string" ? selector : "";
      const chosen = step.candidates.includes(selectorStr) ? selectorStr : step.candidates[0];
      await executeStep({ type: "node", id: chosen }, flow, context, emit, options);
      break;
    }

    case "loop": {
      const max = step.max_iterations ?? 3;
      for (let i = 0; i < max; i++) {
        for (const s of step.steps) {
          await executeStep(s, flow, context, emit, options);
        }
        if (step.until && checkCondition(step.until, context)) break;
      }
      break;
    }

    case "dynamic": {
      const pool = Object.fromEntries(step.pool.map((n) => [n.id, n]));
      for (const n of step.pool) {
        emit({ type: "agent_spawn", agentId: n.id, role: n.role });
      }
      let currentId: string = step.entry;
      const visited: string[] = [];
      for (let i = 0; i < (step.max_steps ?? 6); i++) {
        if (!currentId || visited.filter((v) => v === currentId).length > 1) break;
        visited.push(currentId);
        const node = pool[currentId];
        if (!node) break;
        await executeNode(node, currentId, context, emit);
        const output = outputOf(context[currentId]);
        // Expose prior agent's output to the next agent as $prev.output.
        // For handoffs, use the transfer reason so the next agent gets a useful brief.
        context["prev"] = {
          output: isToolCall(output) ? (output.reason ?? "") : (typeof output === "string" ? output : ""),
        };
        if (isToolCall(output) && pool[output.to]) {
          currentId = output.to;
          continue;
        }
        // Plain text answer — done
        context["dynamic"] = { output: typeof output === "string" ? output : "" };
        break;
      }
      if (!context["dynamic"]) {
        const finalOut = outputOf(context[currentId]);
        context["dynamic"] = { output: typeof finalOut === "string" ? finalOut : "" };
      }
      break;
    }
  }
}

// Template instances are NodeDefs that have been concretised with a specific
// `id` and bound `_item`. The interpolation already replaced {{item.x}} placeholders.
type TemplateInstance = NodeDef & { id: string; _item: unknown };

async function executeNode(
  node: NodeDef | TemplateInstance,
  id: string,
  context: Context,
  emit: EventSink,
  extra: Context = {}
): Promise<void> {
  emit({ type: "agent_spawn", agentId: id, role: node.role });
  console.log(`[node] start id=${id} role=${node.role}`);
  emit({ type: "agent_start", agentId: id });
  const start = Date.now();

  const localContext = { ...context, ...extra };
  const inputs = resolveInputs(node.inputs, localContext);
  const userContent = buildUserContent(inputs)
    || String(resolvePath("$input.prompt", localContext) ?? "");

  // Brevity suffix keeps demo outputs short and scannable
  const system = node.system + "\n\nBe concise — 2–3 short paragraphs or a tight bullet list. No preamble or filler.";

  const targets: string[] | undefined = (node.can_handoff_to?.length ?? 0) > 0
    ? node.can_handoff_to
    : (node.routes_to?.length ?? 0) > 0
    ? node.routes_to
    : undefined;

  let output: unknown = "";

  try {
    if (targets) {
      const result = await callClaudeWithTools({
        system,
        messages: [{ role: "user", content: userContent }],
        targets,
        required: node.route_only === true,
      });
      if (result.toolCall) {
        emit({ type: "agent_tool_call", agentId: id, to: result.toolCall.to, reason: result.toolCall.reason });
        emit({ type: "agent_tool_result", agentId: id, toolName: result.toolCall.to, result: "transferring" });
        output = result.toolCall;
      } else {
        output = result.text;
      }
    } else if (!node.output?.format || node.output.format === "text") {
      let acc = "";
      for await (const chunk of streamClaude({
        system,
        messages: [{ role: "user", content: userContent }],
        maxTokens: 500,
      })) {
        acc += chunk;
        emit({ type: "agent_chunk", agentId: id, chunk });
      }
      output = acc;
    } else {
      const raw = await callClaude({
        system,
        messages: [{ role: "user", content: userContent }],
        maxOutputTokens: 1024,
      });
      output = parseOutput(raw, node.output, id, emit);
      // Emit parsed JSON as a formatted code block so it shows in the output log
      if (typeof output !== "string") {
        emit({ type: "agent_chunk", agentId: id, chunk: "```json\n" + JSON.stringify(output, null, 2) + "\n```" });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[node] error id=${id}:`, err);
    emit({ type: "agent_error", agentId: id, error: msg });
    throw err; // re-throw so the run fails fast rather than silently continuing
  }

  context[id] = { output };
  const durationMs = Date.now() - start;
  console.log(`[node] done id=${id} duration=${durationMs}ms`);
  emit({ type: "agent_complete", agentId: id, tokens: 0, durationMs });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveInputs(inputs: Record<string, InputSpec> | undefined, context: Context): Record<string, unknown> {
  if (!inputs) return {};
  return Object.fromEntries(
    Object.entries(inputs).map(([key, spec]) => [key, resolvePath(spec.from, context)])
  );
}

// Walks paths like `$node.output` or `$step.*` against the context tree.
// `*` returns the children as an array (used after parallel/map collects outputs).
function resolvePath(path: string, context: Context | Record<string, unknown>): unknown {
  if (!path) return undefined;
  const parts = path.replace(/^\$/, "").split(".");
  if (parts[parts.length - 1] === "*") {
    const parent = parts.slice(0, -1).reduce<unknown>((o, k) => {
      if (o && typeof o === "object" && k in (o as Record<string, unknown>)) return (o as Record<string, unknown>)[k];
      return undefined;
    }, context);
    return Array.isArray(parent) ? parent : (parent as { outputs?: unknown[] } | undefined)?.outputs ?? [];
  }
  return parts.reduce<unknown>((o, k) => {
    if (o && typeof o === "object" && k in (o as Record<string, unknown>)) return (o as Record<string, unknown>)[k];
    return undefined;
  }, context);
}

function buildUserContent(inputs: Record<string, unknown>): string {
  return Object.entries(inputs)
    .filter(([, val]) => val !== undefined && val !== null && val !== "")
    .map(([key, val]) => {
      const text = Array.isArray(val) ? val.join("\n\n---\n\n") : String(val);
      return `${key}:\n${text}`;
    })
    .join("\n\n");
}

function instantiateTemplate(template: NodeDef, templateId: string, index: number, item: unknown): TemplateInstance {
  return {
    ...template,
    id: `${templateId}-${index}`,
    role: interpolate(template.role, { item }),
    system: interpolate(template.system, { item }),
    _item: item,
  };
}

function interpolate(str: string, vars: Record<string, unknown>): string {
  return str.replace(/\{\{(.+?)\}\}/g, (_, path: string) => {
    const value = resolvePath("$" + path.trim(), vars);
    return value == null ? "" : String(value);
  });
}

function parseOutput(raw: string, outputSpec: OutputSpec, id: string, emit: EventSink): unknown {
  const format = outputSpec.format;
  if (format === "json_array" || format === "json_object") {
    // Strip markdown code fences that models sometimes add despite instructions
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      console.error(`[node] JSON parse failed id=${id}, raw preview: ${cleaned.slice(0, 200)}`);
      if (outputSpec.on_parse_error === "retry_once") {
        emit({ type: "agent_error", agentId: id, error: "JSON parse failed — check model output" });
      }
      return raw;
    }
  }
  return raw;
}

// `until` shape comes from the `loop` step variant in the Step union
function checkCondition(until: NonNullable<Extract<Step, { type: "loop" }>["until"]>, context: Context): boolean {
  if (until.output_contains) {
    const val = until.node ? resolvePath(`$${until.node}.output`, context) : "";
    return String(val ?? "").includes(until.output_contains);
  }
  if (until.node && until.output !== undefined) {
    const val = resolvePath(`$${until.node}.output`, context);
    return val === until.output;
  }
  return false;
}
