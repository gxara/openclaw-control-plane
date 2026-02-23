import type { IngestEvent } from "@control-plane/event-schema";

const WORKSPACE_ID = process.env.WORKSPACE_ID ?? "ws_default";

export interface MappingContext {
  agentId: string;
  agentName: string;
  runId: string;
  lastChannel?: string;
}

export interface OpenClawEvent {
  type?: string;
  message?: { role?: string; content?: { text?: string }[] };
  session?: { id?: string };
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
        data: { session_id: raw.session.id, last_channel: ctx.lastChannel },
      },
    });
    out.push({
      ...base,
      event: {
        type: "run.started",
        ts,
        dedupe_key: dedupe("run"),
        data: { last_channel: ctx.lastChannel },
      },
    });
  }

  if (raw.type === "message" && raw?.message?.role === "user") {
    const content = raw.message?.content?.map(c => c?.text)?.join("\n");
    const title = content ? String(content).slice(0, 80) : "User message";
    out.push({
      ...base,
      event: {
        type: "user_message",
        ts,
        dedupe_key: dedupe("user:" + title),
        data: { message: title, last_channel: ctx.lastChannel },
      },
    });
  }

  if (raw.type === "message" && raw?.message?.role === "assistant") {
    const content = raw.message?.content?.map(c => c?.text)?.join("\n");
    const toolName = content ? String(content).slice(0, 80) : "Assistant message";
    out.push({
      ...base,
      event: {
        type: "assistant_message",
        ts,
        dedupe_key: dedupe("assistant:" + lineIndex),
        data: { message: toolName, last_channel: ctx.lastChannel },
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
          last_channel: ctx.lastChannel,
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
        data: { message: "Completed", status: "idle", progress: 1, last_channel: ctx.lastChannel },
      },
    });
  }

  return out;
}
