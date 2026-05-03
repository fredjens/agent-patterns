"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentNodeState, RunStats } from "@/engine/types";

const mdComponents: Components = {
  p:          ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  h1:         ({ children }) => <h1 className="text-base font-bold text-zinc-100 mt-3 mb-1.5">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-sm font-semibold text-zinc-100 mt-3 mb-1">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-medium text-zinc-200 mt-2 mb-1">{children}</h3>,
  ul:         ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol:         ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong:     ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em:         ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-600 pl-3 text-zinc-400 my-2">{children}</blockquote>,
  hr:         () => <hr className="border-zinc-700 my-3" />,
  a:          ({ href, children }) => <a href={href} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">{children}</a>,
  // react-markdown 9 distinguishes inline from block code by checking className.
  // Block code has a `language-x` class added by remark; inline code does not.
  code:       ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    return isBlock
      ? <code className="block bg-zinc-800/80 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto my-2 whitespace-pre">{children}</code>
      : <code className="bg-zinc-800 rounded px-1 py-px text-[11px] font-mono text-zinc-300">{children}</code>;
  },
  pre:        ({ children }) => <>{children}</>,
  table:      ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs w-full border-collapse">{children}</table></div>,
  th:         ({ children }) => <th className="border border-zinc-700 px-2 py-1 text-left text-zinc-300 font-medium bg-zinc-800/60">{children}</th>,
  td:         ({ children }) => <td className="border border-zinc-700 px-2 py-1 text-zinc-400">{children}</td>,
};

function Markdown({ children, bright }: { children: string; bright?: boolean }) {
  return (
    <div className={`text-sm ${bright ? "text-zinc-100" : "text-zinc-300"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

const STATE_BORDER: Record<string, string> = {
  idle: "border-zinc-700",
  active: "border-blue-500",
  streaming: "border-blue-400",
  done: "border-emerald-600",
  error: "border-red-500",
  waiting: "border-amber-500",
};

const STATE_LABEL: Record<string, string> = {
  idle: "text-zinc-600",
  active: "text-blue-400",
  streaming: "text-blue-300",
  done: "text-emerald-400",
  error: "text-red-400",
  waiting: "text-amber-400",
};

interface PendingApproval {
  runId: string;
  agentId: string;
  action: string;
  mode: "approval" | "question";
}

interface Props {
  nodes: AgentNodeState[];
  finalOutput: string;
  stats: RunStats | null;
  pendingApproval: PendingApproval | null;
  onApprove?: (feedback?: string) => void;
  onReject?: (feedback: string) => void;
}

function ApprovalUI({ action, onApprove, onReject }: {
  action: string;
  onApprove?: (feedback?: string) => void;
  onReject?: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-amber-300/80 italic">{action}</p>
      <textarea
        className="w-full text-xs bg-zinc-800 rounded px-2 py-1.5 text-zinc-300 resize-none border border-zinc-700 focus:border-zinc-500 outline-none"
        rows={2}
        placeholder="Optional notes for the next agent…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          onClick={() => onApprove?.(feedback || undefined)}
          className="px-3 py-1 text-xs rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onReject?.(feedback || "Rejected")}
          className="px-3 py-1 text-xs rounded bg-red-800 hover:bg-red-700 text-white font-medium transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function QuestionUI({ question, onAnswer }: {
  question: string;
  onAnswer?: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs text-amber-300/80 italic">{question}</p>
      <textarea
        className="w-full text-xs bg-zinc-800 rounded px-2 py-1.5 text-zinc-300 resize-none border border-zinc-700 focus:border-zinc-500 outline-none"
        rows={2}
        placeholder="Type your answer…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        autoFocus
      />
      <button
        onClick={() => { if (answer.trim()) onAnswer?.(answer.trim()); }}
        disabled={!answer.trim()}
        className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
      >
        Send
      </button>
    </div>
  );
}

export function AgentOutputLog({ nodes, finalOutput, stats, pendingApproval, onApprove, onReject }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = nodes.filter(
    (n) => n.output || n.toolCall || n.state === "active" || n.state === "streaming" || n.state === "waiting"
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nodes]);

  if (visible.length === 0 && !finalOutput) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-zinc-600">Agent outputs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {visible.map((node) => (
        <div key={node.id} className={`border-l-2 pl-4 ${STATE_BORDER[node.state] ?? "border-zinc-700"}`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-semibold uppercase tracking-widest ${STATE_LABEL[node.state]}`}>
              {node.role}
            </span>
            {node.state === "active" && (
              <span className="text-xs text-zinc-600 animate-pulse">thinking…</span>
            )}
            {node.state === "waiting" && (
              <span className="text-xs text-amber-600 animate-pulse">awaiting review…</span>
            )}
            {node.state === "done" && node.durationMs > 0 && (
              <span className="text-xs text-zinc-600">{(node.durationMs / 1000).toFixed(1)}s</span>
            )}
            {node.error && (
              <span className="text-xs text-red-400">{node.error}</span>
            )}
          </div>

          {node.output && node.state !== "waiting" && <Markdown>{node.output}</Markdown>}

          {node.toolCall && (() => {
            const isAgentHandoff = nodes.some((n) => n.id === node.toolCall!.to);
            if (isAgentHandoff) {
              return (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500">
                  <span>↪</span>
                  <span>
                    transferred to <span className="text-zinc-300">{nodes.find((n) => n.id === node.toolCall!.to)?.role ?? node.toolCall!.to}</span>
                    {node.toolCall.reason && <span className="text-zinc-600"> — {node.toolCall.reason}</span>}
                  </span>
                </div>
              );
            }
            // ReAct tool call
            let argsDisplay = node.toolCall.reason ?? "";
            try { argsDisplay = JSON.stringify(JSON.parse(argsDisplay), null, 0); } catch { /* use raw */ }
            return (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-zinc-500 font-mono">
                <span className="text-zinc-600">⚙</span>
                <span>
                  <span className="text-zinc-400">{node.toolCall.to}</span>
                  <span className="text-zinc-600">({argsDisplay})</span>
                </span>
              </div>
            );
          })()}

          {node.state === "waiting" && pendingApproval?.agentId === node.id && (
            pendingApproval.mode === "question"
              ? <QuestionUI question={pendingApproval.action} onAnswer={onApprove} />
              : <ApprovalUI action={pendingApproval.action} onApprove={onApprove} onReject={onReject} />
          )}
        </div>
      ))}

      {finalOutput && stats && (
        <div className="border-t border-zinc-800 pt-4 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Final Output</span>
            <span className="text-xs text-zinc-600">
              {stats.agentCount} agents · {(stats.totalDurationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <Markdown bright>{finalOutput}</Markdown>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
