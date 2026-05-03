# Agent Patterns

Runnable patterns for building with agents.

Each pattern (Pipeline, Decomposition, Plan → Execute, Debate, Reflection, Routing, Best-of-N, Handoff, ReAct, Human-in-the-Loop) is defined as a JSON file describing its agent topology. Open one to inspect the structure, send it a prompt, and watch the agents work.

## Stack

- Next.js 16 (App Router)
- Vercel AI SDK + `@ai-sdk/anthropic`
- Tailwind CSS
- All patterns run on Claude Haiku 4.5

## Run locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How patterns work

Each pattern is a JSON file in `engine/patterns/` describing:

- `nodes` — agent definitions (role, system prompt, inputs, outputs)
- `execution` — a tree of step types (`sequence`, `parallel`, `map`, `loop`, `branch`, `dynamic`, `tool_loop`, `hitl_checkpoint`)

The interpreter in `engine/interpreter.ts` walks that tree and calls Claude. The same JSON drives the topology visualization, the gallery's auto-derived tags, and the fake animated previews on the home page.

To add a new pattern: create a JSON file, register it in `engine/index.ts` and `lib/pattern-meta.ts`. Both the runtime and the UI pick it up for free.
