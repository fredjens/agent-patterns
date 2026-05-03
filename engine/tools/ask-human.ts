import { tool } from "ai";
import { z } from "zod";

const DESCRIPTION =
  "Ask the human a clarifying question when you need information only they can provide — preferences, constraints, or decisions that cannot be inferred. Use sparingly: only when the answer would meaningfully change your recommendation.";

const SCHEMA = z.object({
  question: z.string().describe("The specific question to ask the human"),
});

export function makeAskHumanTool(onInput?: (question: string) => Promise<string>) {
  return tool({
    description: DESCRIPTION,
    inputSchema: SCHEMA,
    execute: ({ question }) =>
      onInput
        ? onInput(question)
        : Promise.resolve(
            `[Simulated human response to: "${question}"]: In a real deployment this tool pauses execution, surfaces the question to a human operator, and resumes once they respond. For this demo, assume the human gave a reasonable answer and continue your reasoning accordingly.`
          ),
  });
}

export const ask_human = makeAskHumanTool();
