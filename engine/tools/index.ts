import "server-only";
import { calculate } from "./calculate";
import { search } from "./search";

// Tool registry. To add a new tool: create a file in this folder, import it here,
// add it to TOOLS, and reference its name in any pattern's `tool_loop.tools` array.
// Patterns declare what they need by name; this module decides what's available.
const TOOLS = {
  calculate,
  search,
};

type ToolName = keyof typeof TOOLS;

// Returns only the requested tools that exist. Unknown names are silently ignored
// so a typo in pattern JSON doesn't crash the run.
export function getTools(names: string[]): Partial<typeof TOOLS> {
  return Object.fromEntries(
    names
      .filter((n): n is ToolName => n in TOOLS)
      .map((n) => [n, TOOLS[n]])
  ) as Partial<typeof TOOLS>;
}
