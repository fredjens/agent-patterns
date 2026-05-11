"use client";

import { useReducer, useCallback, useRef } from "react";
import { AgentNodeState, NodeEvent, RunEvent, RunStats } from "@/engine/types";

interface PendingApproval {
  runId: string;
  agentId: string;
  action: string;
  mode: "approval" | "question";
}

interface RunState {
  status: "idle" | "running" | "done" | "error";
  nodes: AgentNodeState[];
  phase: string;
  finalOutput: string;
  stats: RunStats | null;
  error: string | null;
  pendingApproval: PendingApproval | null;
}

type Action =
  | { type: "start" }
  | { type: "abort" }
  | { type: "spawn"; agentId: string; role: string; parentId?: string }
  | { type: "agent_start"; agentId: string }
  | { type: "agent_chunk"; agentId: string; chunk: string }
  | { type: "agent_complete"; agentId: string; tokens: number; durationMs: number }
  | { type: "agent_error"; agentId: string; error: string }
  | { type: "agent_tool_call"; agentId: string; to: string; reason?: string }
  | { type: "agent_tool_result"; agentId: string; toolName: string; result: string }
  | { type: "agent_waiting"; agentId: string }
  | { type: "approval_required"; runId: string; agentId: string; action: string; mode: "approval" | "question" }
  | { type: "approval_received"; approved: boolean; feedback?: string }
  | { type: "phase_change"; phase: string }
  | { type: "complete"; finalOutput: string; stats: RunStats }
  | { type: "error"; error: string };

function updateNode(nodes: AgentNodeState[], id: string, update: Partial<AgentNodeState>): AgentNodeState[] {
  return nodes.map((n) => (n.id === id ? { ...n, ...update } : n));
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "start":
      return { status: "running", nodes: [], phase: "", finalOutput: "", stats: null, error: null, pendingApproval: null };
    case "abort":
      return { ...state, status: "idle", error: null, pendingApproval: null };
    case "spawn":
      if (state.nodes.some((n) => n.id === action.agentId)) return state;
      return {
        ...state,
        nodes: [
          ...state.nodes,
          { id: action.agentId, role: action.role, state: "idle", output: "", tokens: 0, durationMs: 0, parentId: action.parentId, events: [] },
        ],
      };
    case "agent_start":
      return { ...state, nodes: updateNode(state.nodes, action.agentId, { state: "active", startedAt: Date.now() }) };
    case "agent_chunk":
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id !== action.agentId) return n;
          const events = [...n.events];
          const last = events[events.length - 1];
          if (last?.type === "text") {
            events[events.length - 1] = { type: "text", content: last.content + action.chunk };
          } else {
            events.push({ type: "text", content: action.chunk });
          }
          return { ...n, state: "streaming", output: n.output + action.chunk, events };
        }),
      };
    case "agent_complete":
      return {
        ...state,
        nodes: updateNode(state.nodes, action.agentId, { state: "done", tokens: action.tokens, durationMs: action.durationMs }),
      };
    case "agent_error":
      return { ...state, nodes: updateNode(state.nodes, action.agentId, { state: "error", error: action.error }) };
    case "agent_tool_call": {
      const toolId = `tool:${action.to}`;
      const withAgentUpdate = state.nodes.map((n) => {
        if (n.id !== action.agentId) return n;
        return {
          ...n,
          toolCall: { to: action.to, reason: action.reason },
          events: [...n.events, { type: "tool_call" as const, name: action.to, args: action.reason ?? "" }],
        };
      });
      const nodes = withAgentUpdate.some((n) => n.id === toolId)
        ? updateNode(withAgentUpdate, toolId, { state: "active" })
        : [...withAgentUpdate, { id: toolId, role: action.to, state: "active" as const, output: "", tokens: 0, durationMs: 0, events: [] as NodeEvent[] }];
      return { ...state, nodes };
    }
    case "agent_tool_result":
      return {
        ...state,
        nodes: state.nodes.map((n) => {
          if (n.id === action.agentId) {
            return { ...n, events: [...n.events, { type: "tool_result" as const, name: action.toolName, result: action.result }] };
          }
          if (n.id === `tool:${action.toolName}`) return { ...n, state: "done" as const };
          return n;
        }),
      };
    case "agent_waiting":
      return { ...state, nodes: updateNode(state.nodes, action.agentId, { state: "waiting" }) };
    case "approval_required":
      return { ...state, pendingApproval: { runId: action.runId, agentId: action.agentId, action: action.action, mode: action.mode } };
    case "approval_received":
      return { ...state, pendingApproval: null };
    case "phase_change":
      return { ...state, phase: action.phase };
    case "complete":
      return { ...state, status: "done", finalOutput: action.finalOutput, stats: action.stats };
    case "error":
      return { ...state, status: "error", error: action.error };
    default:
      return state;
  }
}

const initial: RunState = {
  status: "idle",
  nodes: [],
  phase: "",
  finalOutput: "",
  stats: null,
  error: null,
  pendingApproval: null,
};

function normalizeError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("credit") || s.includes("402") || s.includes("billing")) {
    return "Out of API credits";
  }
  if (s.includes("rate_limit") || s.includes("429") || s.includes("rate limit")) {
    return "Rate limit reached. Wait a moment and try again.";
  }
  if (s.includes("529") || s.includes("overloaded")) {
    return "The API is overloaded right now. Try again in a few seconds.";
  }
  return raw;
}

export function useRun() {
  const [state, dispatch] = useReducer(reducer, initial);
  const abortRef = useRef<AbortController | null>(null);

  const startRun = useCallback(async (prompt: string, pattern: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: "start" });

    let completed = false;

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, pattern }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        dispatch({ type: "error", error: normalizeError(err.error ?? "Request failed") });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: RunEvent = JSON.parse(line.slice(6));
            handleEvent(event);
          } catch {
            console.warn("[run] Failed to parse SSE line:", line);
          }
        }
      }

      if (controller.signal.aborted) {
        dispatch({ type: "abort" });
      } else if (!completed) {
        dispatch({ type: "error", error: normalizeError("Connection closed before run completed. Check server logs.") });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        dispatch({ type: "abort" });
      } else {
        dispatch({ type: "error", error: normalizeError(String(err)) });
      }
    }

    function handleEvent(event: RunEvent) {
      switch (event.type) {
        case "agent_spawn":
          dispatch({ type: "spawn", agentId: event.agentId, role: event.role, parentId: event.parentId });
          break;
        case "agent_start":
          dispatch({ type: "agent_start", agentId: event.agentId });
          break;
        case "agent_chunk":
          dispatch({ type: "agent_chunk", agentId: event.agentId, chunk: event.chunk });
          break;
        case "agent_complete":
          dispatch({ type: "agent_complete", agentId: event.agentId, tokens: event.tokens, durationMs: event.durationMs });
          break;
        case "agent_error":
          dispatch({ type: "agent_error", agentId: event.agentId, error: event.error });
          break;
        case "agent_tool_call":
          dispatch({ type: "agent_tool_call", agentId: event.agentId, to: event.to, reason: event.reason });
          break;
        case "agent_tool_result":
          dispatch({ type: "agent_tool_result", agentId: event.agentId, toolName: event.toolName, result: event.result });
          break;
        case "hitl_waiting":
          dispatch({ type: "agent_waiting", agentId: event.agentId });
          break;
        case "human_approval_required":
          dispatch({ type: "approval_required", runId: event.runId, agentId: event.agentId, action: event.action, mode: event.mode ?? "approval" });
          break;
        case "human_approval_received":
          dispatch({ type: "approval_received", approved: event.approved, feedback: event.feedback });
          break;
        case "phase_change":
          dispatch({ type: "phase_change", phase: event.phase });
          break;
        case "run_complete":
          completed = true;
          dispatch({ type: "complete", finalOutput: event.finalOutput, stats: event.stats });
          break;
        case "run_error":
          completed = true;
          dispatch({ type: "error", error: normalizeError(event.error) });
          break;
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const approve = useCallback(async (feedback?: string) => {
    const pa = state.pendingApproval;
    if (!pa) return;
    await fetch("/api/run/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: pa.runId, approved: true, feedback }),
    });
  }, [state.pendingApproval]);

  const reject = useCallback(async (feedback: string) => {
    const pa = state.pendingApproval;
    if (!pa) return;
    await fetch("/api/run/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: pa.runId, approved: false, feedback }),
    });
  }, [state.pendingApproval]);

  return { state, startRun, abort, approve, reject };
}
