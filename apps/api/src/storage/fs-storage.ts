import fs from "node:fs/promises";
import path from "node:path";
import type { IngestEvent } from "@control-plane/event-schema";
import type { AgentState, StoredEvent } from "./types.js";

const DATA_ROOT = process.env.DATA_ROOT ?? "./data";

function runPath(workspaceId: string, runId: string): string {
  return path.join(DATA_ROOT, "workspaces", workspaceId, "runs", runId);
}

export async function appendEvent(event: IngestEvent): Promise<boolean> {
  const dir = runPath(event.workspace_id, event.run_id);
  await fs.mkdir(dir, { recursive: true });

  const dedupePath = path.join(dir, "dedupe_index.json");
  let dedupeIndex: Record<string, boolean> = {};
  try {
    const data = await fs.readFile(dedupePath, "utf-8");
    dedupeIndex = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  const dedupeKey = event.event.dedupe_key;
  if (dedupeIndex[dedupeKey]) {
    return false; // Skip duplicate
  }
  dedupeIndex[dedupeKey] = true;

  const stored: StoredEvent = {
    ...event,
    _id: `${event.agent.id}:${event.event.ts}:${dedupeKey}`,
  };

  const eventsPath = path.join(dir, "events.jsonl");
  await fs.appendFile(eventsPath, JSON.stringify(stored) + "\n");
  await fs.writeFile(
    dedupePath,
    JSON.stringify(dedupeIndex, null, 0),
    "utf-8"
  );

  await updateAgentState(event);
  return true;
}

function inferStatus(eventType: string, data: Record<string, unknown>): AgentState["status"] {
  if (eventType === "error" || eventType.includes("error")) return "error";
  if (eventType === "task_progress") {
    const progress = data.progress as number | undefined;
    if (progress !== undefined && progress > 0 && progress < 1) return "working";
  }
  if (eventType.includes("think") || eventType === "planning") return "thinking";
  return "idle";
}

async function updateAgentState(event: IngestEvent): Promise<void> {
  const dir = runPath(event.workspace_id, event.run_id);
  const statePath = path.join(dir, "agents_state.json");

  let agents: Record<string, AgentState> = {};
  try {
    const data = await fs.readFile(statePath, "utf-8");
    agents = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  const status = inferStatus(event.event.type, event.event.data);
  const message = (event.event.data?.message as string) ?? event.event.type;

  agents[event.agent.id] = {
    id: event.agent.id,
    label: event.agent.name,
    status,
    last_message: message,
    agent: event.agent,
  };

  await fs.writeFile(
    statePath,
    JSON.stringify(agents, null, 2),
    "utf-8"
  );
}

export interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    status: string;
    last_message: string;
  }>;
  edges: Array<{ source: string; target: string }>;
}

export async function getGraph(
  workspaceId: string,
  runId: string
): Promise<GraphData> {
  const dir = runPath(workspaceId, runId);
  const statePath = path.join(dir, "agents_state.json");

  let agents: Record<string, AgentState> = {};
  try {
    const data = await fs.readFile(statePath, "utf-8");
    agents = JSON.parse(data);
  } catch {
    return { nodes: [], edges: [] };
  }

  const nodes = Object.values(agents).map((a) => ({
    id: a.id,
    label: a.label,
    status: a.status,
    last_message: a.last_message,
  }));

  return { nodes, edges: [] };
}

export async function getEvents(
  workspaceId: string,
  runId: string,
  limit = 50
): Promise<StoredEvent[]> {
  const eventsPath = path.join(
    runPath(workspaceId, runId),
    "events.jsonl"
  );
  try {
    const content = await fs.readFile(eventsPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const events = lines.slice(-limit).map((line: string) => JSON.parse(line) as StoredEvent);
    return events.reverse();
  } catch {
    return [];
  }
}
