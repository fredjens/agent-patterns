import "server-only";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getTools } from "./tools";
import { MODEL_ID } from "@/lib/model";

// Model is pinned via the shared MODEL_ID constant so the API endpoint can't be
// coerced into using a more expensive tier (e.g. Opus) by anyone POSTing to /api/run.
const model = anthropic(MODEL_ID);

interface BaseOptions {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function callClaude({
  system,
  messages,
  maxOutputTokens = 1024,
}: BaseOptions & { maxOutputTokens?: number }): Promise<string> {
  const { text } = await generateText({ model, system, messages, maxOutputTokens });
  return text;
}

export async function* streamClaude({ system, messages, maxTokens }: BaseOptions & { maxTokens?: number }): AsyncGenerator<string> {
  const result = streamText({ model, system, messages, maxOutputTokens: maxTokens });
  for await (const chunk of result.textStream) {
    yield chunk;
  }
}

export async function streamClaudeReAct({
  system,
  initialPrompt,
  maxSteps,
  toolNames,
  onChunk,
  onToolCall,
  onToolResult,
}: {
  system: string;
  initialPrompt: string;
  maxSteps: number;
  toolNames: string[];
  onChunk: (chunk: string) => void;
  onToolCall: (toolName: string, args: unknown) => void;
  onToolResult: (toolName: string, result: string) => void;
}): Promise<string> {
  let finalText = "";

  const result = streamText({
    model,
    system,
    messages: [{ role: "user", content: initialPrompt }],
    tools: getTools(toolNames),
    stopWhen: stepCountIs(maxSteps),
  });

  // The AI SDK's stream-part union doesn't surface `input`/`output` in its public
  // narrowings even though they're present at runtime; assert the narrow shape.
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      finalText += part.text;
      onChunk(part.text);
    } else if (part.type === "tool-call") {
      const tc = part as { toolName: string; input: unknown };
      onToolCall(tc.toolName, tc.input);
    } else if (part.type === "tool-result") {
      const tr = part as { toolName: string; output: unknown };
      onToolResult(tr.toolName, String(tr.output ?? ""));
    }
  }

  return finalText;
}

export async function callClaudeWithTools({
  system,
  messages,
  targets,
  required,
}: BaseOptions & { targets: string[]; required: boolean }): Promise<{
  text: string;
  toolCall?: { to: string; reason?: string };
}> {
  const { text, toolCalls } = await generateText({
    model,
    system,
    messages,
    tools: {
      transfer: tool({
        description: "Hand off or route to another agent",
        inputSchema: z.object({
          to: z.enum(targets as [string, ...string[]]),
          reason: z.string().optional(),
        }),
      }),
    },
    toolChoice: required ? "required" : "auto",
    stopWhen: stepCountIs(1),
  });

  const tc = toolCalls?.[0];
  if (tc) {
    // Tool input is validated against the Zod schema above, so the runtime shape
    // matches the schema's inferred type. The SDK types it as unknown.
    const input = (tc as { input: { to: string; reason?: string } }).input;
    return { text: "", toolCall: { to: input.to, reason: input.reason } };
  }
  return { text };
}
