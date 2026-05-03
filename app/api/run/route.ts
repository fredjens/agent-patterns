import { NextRequest } from "next/server";
import { getPattern } from "@/engine";
import { RunEvent, RunRequest } from "@/engine/types";
import { pendingApprovals } from "@/lib/approval-store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body: RunRequest = await req.json();
  const { prompt, pattern: patternId } = body;

  console.log(`[run] start pattern=${patternId}`);

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const pattern = getPattern(patternId);
  if (!pattern) {
    return new Response(
      JSON.stringify({ error: `Unknown pattern: ${patternId}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const runId = crypto.randomUUID();
        const awaitApproval = (action: string, agentId: string, mode?: "approval" | "question"): Promise<string> =>
          new Promise((resolve, reject) => {
            pendingApprovals.set(runId, { resolve, reject });
            emit({ type: "human_approval_required", agentId, action, runId, mode });
          });

        await pattern.run(prompt, emit, { awaitApproval });
        console.log(`[run] complete pattern=${patternId}`);
      } catch (err) {
        console.error(`[run] error pattern=${patternId}:`, err);
        emit({ type: "run_error", error: String(err) });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      closed = true;
      console.log(`[run] client disconnected pattern=${patternId}`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
