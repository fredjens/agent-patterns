import { NextRequest } from "next/server";
import { pendingApprovals } from "@/lib/approval-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { runId, approved, feedback } = await req.json();

  if (!runId) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const resolver = pendingApprovals.get(runId);
  if (!resolver) {
    return Response.json({ error: "No pending approval for this run" }, { status: 404 });
  }

  pendingApprovals.delete(runId);

  if (approved) {
    resolver.resolve(feedback ?? "");
  } else {
    resolver.reject(feedback || "Rejected");
  }

  return Response.json({ ok: true });
}
