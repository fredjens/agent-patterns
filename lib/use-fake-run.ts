"use client";

import { useEffect, useState, useRef } from "react";
import { AgentNodeState, Flow, Step } from "@/engine/types";

// Fake walker that drives a TopologyRenderer through idle → active → done states
// without any LLM calls. Mirrors the real interpreter's step types, but each "node
// execution" is just an async sleep. Loops forever for thumbnail animations.
//
// The real interpreter walks the same JSON. This proves the renderer is engine-agnostic
// — both runners produce AgentNodeState[] and the renderer doesn't care which.

// Each timing is a [min, max] range; rand() picks fresh each call so every
// loop iteration looks slightly different and the cards don't feel mechanical.
const IDLE_HOLD     = [500, 800];     // idle (gray) before going active
const NODE_DURATION = [900, 1500];    // active before going done
const STEP_GAP      = [250, 450];     // pause between sequential steps
const RESTART_GAP   = [2000, 3000];   // pause before looping the demo

function rand([min, max]: number[]): number {
  return min + Math.random() * (max - min);
}

function getCount(countHint: string | undefined, fallback = 3): number {
  if (!countHint) return fallback;
  const first = countHint.split(/[–-]/)[0];
  const n = parseInt(first, 10);
  return Number.isFinite(n) ? n : fallback;
}

interface WalkerOptions {
  flow: Flow;
  setNodes: (updater: (prev: AgentNodeState[]) => AgentNodeState[]) => void;
  cancelled: () => boolean;
}

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    function tick() {
      if (cancelled()) return resolve();
      if (Date.now() - start >= ms) return resolve();
      setTimeout(tick, Math.min(ms - (Date.now() - start), 100));
    }
    tick();
  });
}

function spawnNode(setNodes: WalkerOptions["setNodes"], id: string, role: string) {
  setNodes((prev) => {
    if (prev.some((n) => n.id === id)) return prev;
    return [...prev, { id, role, state: "idle", output: "", tokens: 0, durationMs: 0, events: [] }];
  });
}

function setState(setNodes: WalkerOptions["setNodes"], id: string, state: AgentNodeState["state"], extra: Partial<AgentNodeState> = {}) {
  setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, state, ...extra } : n)));
}

async function runNode(id: string, role: string, opts: WalkerOptions) {
  spawnNode(opts.setNodes, id, role);
  await sleep(rand(IDLE_HOLD), opts.cancelled);
  if (opts.cancelled()) return;
  const startedAt = Date.now();
  setState(opts.setNodes, id, "active", { startedAt });
  await sleep(rand(NODE_DURATION), opts.cancelled);
  if (opts.cancelled()) return;
  setState(opts.setNodes, id, "done", { durationMs: Date.now() - startedAt });
}

async function runStep(step: Step, flow: Flow, opts: WalkerOptions) {
  if (opts.cancelled()) return;

  switch (step.type) {
    case "node": {
      const node = flow.nodes?.[step.id];
      if (!node) return;
      await runNode(step.id, node.role, opts);
      break;
    }

    case "sequence": {
      for (const s of step.steps) {
        if (opts.cancelled()) return;
        await runStep(s, flow, opts);
        await sleep(rand(STEP_GAP), opts.cancelled);
      }
      break;
    }

    case "parallel": {
      await Promise.all(step.nodes.map((id) => runNode(id, flow.nodes?.[id]?.role ?? id, opts)));
      break;
    }

    case "map": {
      const tmpl = flow.nodes?.[step.template];
      if (!tmpl) return;
      const count = getCount(step.count_hint, 3);
      const role = (tmpl.role ?? step.template).replace(/\{\{[^}]+\}\}/g, "").trim() || step.template;
      const instances = Array.from({ length: count }, (_, i) => ({
        id: `${step.template}-${i}`,
        role,
      }));
      if (step.sequential) {
        for (const inst of instances) {
          if (opts.cancelled()) return;
          await runNode(inst.id, inst.role, opts);
          await sleep(rand(STEP_GAP), opts.cancelled);
        }
      } else {
        await Promise.all(instances.map((inst) => runNode(inst.id, inst.role, opts)));
      }
      break;
    }

    case "repeat": {
      const tmpl = flow.nodes?.[step.template];
      if (!tmpl) return;
      const role = (tmpl.role ?? step.template).replace(/\{\{[^}]+\}\}/g, "").trim() || step.template;
      const instances = Array.from({ length: step.count }, (_, i) => ({
        id: `${step.template}-${i}`,
        role,
      }));
      await Promise.all(instances.map((inst) => runNode(inst.id, inst.role, opts)));
      break;
    }

    case "branch": {
      // Pick a random candidate from the JSON-declared list
      if (step.candidates.length === 0) break;
      const chosen = step.candidates[Math.floor(Math.random() * step.candidates.length)];
      await runNode(chosen, flow.nodes?.[chosen]?.role ?? chosen, opts);
      break;
    }

    case "loop": {
      const iterations = 2;
      for (let i = 0; i < iterations; i++) {
        if (opts.cancelled()) return;
        for (const s of step.steps) {
          if (opts.cancelled()) return;
          await runStep(s, flow, opts);
          await sleep(rand(STEP_GAP), opts.cancelled);
        }
      }
      break;
    }

    case "dynamic": {
      // Walk a random valid handoff path declared in the JSON.
      // Uses each node's `can_handoff_to`, capped by `max_steps`.
      const pool = step.pool;
      const byId = (id: string) => pool.find((n) => n.id === id);
      const maxSteps = step.max_steps ?? 6;

      let current = byId(step.entry);
      const visited = new Set<string>();
      for (let i = 0; i < maxSteps && current && !visited.has(current.id); i++) {
        if (opts.cancelled()) return;
        visited.add(current.id);
        await runNode(current.id, current.role, opts);
        const targets = current.can_handoff_to ?? [];
        if (targets.length === 0) break;
        current = byId(targets[Math.floor(Math.random() * targets.length)]);
      }
      break;
    }

    case "tool_loop": {
      // Agent thinks → calls a random tool from the declared list → repeats.
      // Number of calls is bounded by JSON's `max_steps`. Synthetic `tool:<name>`
      // nodes light up the tool boxes via the renderer's existing check.
      const node = flow.nodes?.[step.agent];
      if (!node) break;
      const id = step.agent;
      const tools = step.tools;
      const maxSteps = step.max_steps ?? 4;

      if (tools.length === 0) {
        await runNode(id, node.role, opts);
        break;
      }

      spawnNode(opts.setNodes, id, node.role);
      await sleep(rand(IDLE_HOLD), opts.cancelled);
      if (opts.cancelled()) return;
      const startedAt = Date.now();
      setState(opts.setNodes, id, "active", { startedAt });

      const numCalls = 1 + Math.floor(Math.random() * Math.max(1, maxSteps - 1));
      for (let i = 0; i < numCalls; i++) {
        if (opts.cancelled()) return;
        await sleep(rand(NODE_DURATION), opts.cancelled);
        if (opts.cancelled()) return;
        const tool = tools[Math.floor(Math.random() * tools.length)];
        const toolId = `tool:${tool}`;
        spawnNode(opts.setNodes, toolId, tool);
        setState(opts.setNodes, toolId, "active");
        await sleep(rand(STEP_GAP), opts.cancelled);
        if (opts.cancelled()) return;
        setState(opts.setNodes, toolId, "done");
      }

      await sleep(rand(STEP_GAP), opts.cancelled);
      if (opts.cancelled()) return;
      setState(opts.setNodes, id, "done", { durationMs: Date.now() - startedAt });
      break;
    }

    case "hitl_checkpoint": {
      const id = step.id ?? "checkpoint";
      const role = flow.nodes?.[id]?.role ?? "Human";
      await runNode(id, role, opts);
      break;
    }
  }
}

export function useFakeRun(flow: Flow | undefined, options: { startDelay?: number; enabled?: boolean } = {}) {
  const { startDelay = 0, enabled = true } = options;
  const [nodes, setNodes] = useState<AgentNodeState[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled || !flow) return;
    cancelledRef.current = false;

    const opts: WalkerOptions = {
      flow,
      setNodes: (updater) => {
        if (cancelledRef.current) return;
        setNodes(updater);
      },
      cancelled: () => cancelledRef.current,
    };

    (async () => {
      await sleep(startDelay, opts.cancelled);
      while (!cancelledRef.current) {
        opts.setNodes(() => []);
        await sleep(120, opts.cancelled);
        await runStep(flow.execution, flow, opts);
        await sleep(rand(RESTART_GAP), opts.cancelled);
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [flow, enabled, startDelay]);

  return nodes;
}
