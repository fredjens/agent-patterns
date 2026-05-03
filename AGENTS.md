<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This is Next.js 16. The App Router has breaking changes from older versions — APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notably: dynamic route `params` are now `Promise`s, accessed via React's `use(params)` hook in client components. `cookies()` and `headers()` are async.
<!-- END:nextjs-agent-rules -->

# Agent Patterns codebase rules

## Hard rules

- **No `any` types anywhere.** Use proper types or `unknown` with narrowing. The codebase has zero `any` and should stay that way.
- **The model is pinned server-side.** Defined in `lib/model.ts` (`MODEL_ID`, `MODEL_LABEL`). The API route does not accept a `model` parameter from the request — adding one would let anyone burn tokens on Opus.

## Project structure

- `engine/` — server-only. Runs LLM calls.
  - `interpreter.ts` — walks a flow's execution tree, makes real API calls.
  - `claude-client.ts` — thin wrapper over Vercel AI SDK. Model is pinned here.
  - `tools/` — tool definitions. Add a file, register in `tools/index.ts`. Patterns reference tools by name.
  - `patterns/*.json` — every pattern's definition.
  - `types.ts` — single source of truth for `Flow`, `Step`, `NodeDef`, `AgentNodeState`, `RunEvent`, `ToolCall`, etc. Both server and client import from here.
- `lib/` — shared client+server utilities. `pattern-meta.ts` (loads JSON, derives tags), `use-run.ts` (real run hook), `use-fake-run.ts` (animation hook), `model.ts` (model constants).
- `components/` — UI. `TopologyRenderer` consumes `Flow` + `AgentNodeState[]` and is engine-agnostic — it can be driven by either the real interpreter or the fake walker.
- `app/` — Next routes. `/` gallery, `/patterns/[id]` detail.

## Two interpreters, one JSON

The real interpreter (`engine/interpreter.ts`) and the fake walker (`lib/use-fake-run.ts`) walk the same pattern JSON. Both produce `AgentNodeState[]` for the renderer. **The fake walker must stay generic** — only use data declared in the JSON (e.g. `step.tools`, `node.can_handoff_to`, `step.max_steps`). Never hardcode pattern-specific behavior in the fake walker.

## Adding a new pattern

1. Create `engine/patterns/your-pattern.json` matching the `Flow` type in `engine/types.ts`.
2. Register it in `engine/index.ts` and `lib/pattern-meta.ts` (just add the import + push to `flows`).

The UI, the auto-derived tags, the topology renderer, and the fake animation all pick it up automatically. No further code changes.

## Adding a new tool

1. Create `engine/tools/your-tool.ts` exporting a `tool({...})` def.
2. Register it in `engine/tools/index.ts`'s `TOOLS` map.
3. Reference its name in any pattern's `tool_loop.tools` array.

## Tags

Tags shown on gallery cards (`parallel`, `iterative`, `tools`, etc.) are derived from the JSON in `lib/pattern-meta.ts`'s `deriveTags()`. Do not hand-author tags on patterns.
