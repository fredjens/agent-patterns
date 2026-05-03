import "server-only";
import { calculate } from "./calculate";
import { search } from "./search";
import { retrieve } from "./retrieve";
import { ask_human } from "./ask-human";

// Tool registry. To add a new tool: create a file in this folder, import it here,
// add it to TOOLS, and reference its name in any pattern's `tool_loop.tools` array.
// Patterns declare what they need by name; this module decides what's available.
const TOOLS = {
  calculate,
  search,
  retrieve,
  ask_human,
};

type ToolName = keyof typeof TOOLS;

// Returns only the requested tools that exist. Unknown names are silently ignored
// so a typo in pattern JSON doesn't crash the run. Pass overrides to replace
// specific tool implementations (e.g. wiring ask_human to a real pause mechanism).
export function getTools(names: string[], overrides?: Partial<typeof TOOLS>): Partial<typeof TOOLS> {
  const base = Object.fromEntries(
    names
      .filter((n): n is ToolName => n in TOOLS)
      .map((n) => [n, TOOLS[n]])
  ) as Partial<typeof TOOLS>;
  return overrides ? { ...base, ...overrides } : base;
}
