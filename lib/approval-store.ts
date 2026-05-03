type Resolver = {
  resolve: (feedback: string) => void;
  reject: (reason: string) => void;
};

// Module-level store for pending HITL approvals.
// Works in single-process environments (Next.js dev + next start).
export const pendingApprovals = new Map<string, Resolver>();
