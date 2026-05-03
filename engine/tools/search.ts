import { tool } from "ai";
import { z } from "zod";

export const search = tool({
  description: "Search for factual information about a topic. Returns relevant context.",
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async ({ query }) =>
    `[Simulated search for "${query}"]: No live search available in this demo. Use your training knowledge about "${query}" to reason toward an answer.`,
});
