import type { IngestEvent } from "@control-plane/event-schema";

const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "ws_default";

export interface MappingContext {
  agentId: string;
  agentName: string;
  runId: string;
}

export interface OpenClawEvent {
  type?: string;
  role?: string;
  session?: { id?: string };
  text?: string;
  stopReason?: string;
  toolCall?: { name?: string };
  details?: { status?: string };
  [key: string]: unknown;
}

export function mapToControlPlane(
  raw: OpenClawEvent,
  ctx: MappingContext,
  lineIndex: number
): IngestEvent[] {
  const ts = new Date().toISOString();
  const dedupe = (key: string) =>
    `${ctx.agentId}:${ctx.runId}:${lineIndex}:${key}`;
  const out: IngestEvent[] = [];

  const base = {
    workspace_id: WORKSPACE_ID,
    run_id: ctx.runId,
    agent: {
      id: ctx.agentId,
      name: ctx.agentName,
      kind: "openclaw",
    },
  };

  if (raw.type === "session" && raw.session?.id) {
    out.push({
      ...base,
      event: {
        type: "agent.register",
        ts,
        dedupe_key: dedupe("session"),
        data: { session_id: raw.session.id },
      },
    });
    out.push({
      ...base,
      event: {
        type: "run.started",
        ts,
        dedupe_key: dedupe("run"),
        data: {},
      },
    });
  }

  if (raw.type === "message" && raw.role === "user" && raw.text) {
    const title = String(raw.text).slice(0, 80);
    out.push({
      ...base,
      event: {
        type: "task_started",
        ts,
        dedupe_key: dedupe("task:" + title),
        data: { message: title, status: "working", progress: 0 },
      },
    });
  }

  if (raw.type === "message" && raw.role === "assistant") {
    const toolName = raw.toolCall?.name ?? "thinking";
    out.push({
      ...base,
      event: {
        type: "task_progress",
        ts,
        dedupe_key: dedupe("assistant:" + lineIndex),
        data: { message: toolName, status: "working", progress: 0.5 },
      },
    });
  }

  if (raw.type === "message" && raw.role === "toolResult") {
    const failed = raw.details?.status === "error";
    out.push({
      ...base,
      event: {
        type: failed ? "task_failed" : "task_progress",
        ts,
        dedupe_key: dedupe("tool:" + lineIndex),
        data: {
          message: failed ? "Error" : "Tool completed",
          status: failed ? "error" : "working",
          progress: failed ? 0 : 0.7,
        },
      },
    });
  }

  if (raw.stopReason === "stop") {
    out.push({
      ...base,
      event: {
        type: "task_progress",
        ts,
        dedupe_key: dedupe("done"),
        data: { message: "Completed", status: "idle", progress: 1 },
      },
    });
  }

  return out;
}
