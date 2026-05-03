import { tool } from "ai";
import { z } from "zod";

export const calculate = tool({
  description:
    "Evaluate a mathematical expression. Use for arithmetic, percentages, and unit conversions.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "A valid math expression, e.g. '42 * 0.15' or '(100 - 32) * 5/9'",
      ),
  }),
  execute: async ({ expression }) => {
    try {
      const normalised = expression
        .replace(/\^/g, "**")
        .replace(/Math\.pow\(([^,)]+),([^)]+)\)/g, "(($1)**($2))");
      const safe = normalised.replace(/[^0-9+\-*/().%\s]/g, "");
      if (!safe.trim()) return "Error: empty or invalid expression";
      const result = new Function(`return (${safe})`)();
      return typeof result === "number"
        ? String(Number(result.toFixed(6)))
        : "Error: result is not a number";
    } catch {
      return "Error: could not evaluate expression";
    }
  },
});
