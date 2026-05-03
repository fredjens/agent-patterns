import { tool } from "ai";
import { z } from "zod";

export const retrieve = tool({
  description:
    "Retrieve relevant document chunks from the knowledge base by semantic query. Returns ranked results with source labels.",
  inputSchema: z.object({
    query: z.string().describe("The retrieval query to search the knowledge base"),
    top_k: z.number().optional().describe("Number of document chunks to return (default 3)"),
  }),
  execute: async ({ query, top_k = 3 }) =>
    `[Knowledge base retrieval — query: "${query}", top_k: ${top_k}]

Chunk 1 (score 0.94, source: docs/overview.md)
Simulated content related to "${query}". In a real system this chunk comes from a vector index (Pinecone, pgvector, Weaviate) by finding embeddings nearest to the query embedding.

Chunk 2 (score 0.88, source: docs/guide.md)
Additional context on "${query}" from a second document. Each chunk is typically 200-500 tokens, split with overlap so no information falls between boundaries.

Chunk 3 (score 0.81, source: docs/faq.md)
A third perspective on "${query}". The generator should synthesize these chunks rather than quote them verbatim, and cite sources when relevant.

Note: this is a demo simulation — no live index is queried. Swap execute() for a real vector-store client to use in production.`,
});
