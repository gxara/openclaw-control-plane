import fs from "node:fs/promises";
import path from "node:path";
import type { IngestEvent } from "@control-plane/event-schema";
import type { AgentState, StoredEvent } from "./types.js";

const DATA_ROOT = process.env.DATA_ROOT ?? "./data";
const WORKSPACES_ROOT = path.join(DATA_ROOT, "workspaces");
const OPENCLAW_SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR ?? "";

function runPath(workspaceId: string, runId: string): string {
  return path.join(DATA_ROOT, "workspaces", workspaceId, "runs", runId);
}

/** sessions.json: sessionKey -> { sessionId, lastChannel, ... } */
async function readLastChannelFromSessions(
  sessionId: string
): Promise<string | undefined> {
  if (!OPENCLAW_SESSIONS_DIR) return undefined;
  const root = path.resolve(OPENCLAW_SESSIONS_DIR);
  try {
    const agentDirs = await fs.readdir(root, { withFileTypes: true });
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      const storePath = path.join(root, agentDir.name, "sessions", "sessions.json");
      try {
        const data = await fs.readFile(storePath, "utf-8");
        const store = JSON.parse(data) as Record<string, { sessionId?: string; lastChannel?: string }>;
        for (const entry of Object.values(store)) {
          if (entry?.sessionId === sessionId) return entry.lastChannel;
        }
      } catch {
        // skip
      }
    }
  } catch {
    // ignore
  }
  return undefined;
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
  if (eventType === "error" || eventType.includes("error") || eventType === "task_failed")
    return "error";
  if (eventType === "user_message" || eventType === "assistant_message") {
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
    last_heartbeat: event.event.ts,
    agent: event.agent,
  };

  await fs.writeFile(
    statePath,
    JSON.stringify(agents, null, 2),
    "utf-8"
  );
}

export interface GraphNodeData {
  id: string;
  label: string;
  status: string;
  last_message: string;
  last_heartbeat?: string;
  parent?: string;
  nodeType?: "agent" | "session";
  runId?: string;
  lastChannel?: string;
}

export interface GraphData {
  nodes: GraphNodeData[];
  edges: Array<{ source: string; target: string }>;
}

export async function listWorkspaces(): Promise<string[]> {
  try {
    const entries = await fs.readdir(WORKSPACES_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function listRuns(workspaceId: string): Promise<string[]> {
  const runsDir = path.join(WORKSPACES_ROOT, workspaceId, "runs");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
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

  console.log(workspaceId, runId);
  console.log(agents);

  const nodes = Object.values(agents).map((a) => ({
    id: a.id,
    label: a.label,
    lastChannel: a.lastChannel,
    status: a.status,
    last_message: a.last_message,
    last_heartbeat: a.last_heartbeat,
  }));

  return { nodes, edges: [] };
}

export async function getGraphAllRuns(workspaceId: string): Promise<GraphData> {
  const runs = await listRuns(workspaceId);
  const agentsById = new Map<string, GraphNodeData>();
  const nodes: GraphNodeData[] = [];
  const edgeList: Array<{ source: string; target: string }> = [];

  for (const runId of runs) {
    const graph = await getGraph(workspaceId, runId);
    const lastChannel = await readLastChannelFromSessions(runId);
    for (const node of graph.nodes) {
      const existing = agentsById.get(node.id);
      const nodeHb = node.last_heartbeat ?? "";
      const existingHb = existing?.last_heartbeat ?? "";
      if (!existing || nodeHb > existingHb) {
        const agentNode: GraphNodeData = {
          ...node,
          nodeType: "agent",
        };
        agentsById.set(node.id, agentNode);
      }
      const sessionId = `session:${node.id}:${runId}`;
      nodes.push({
        id: sessionId,
        label: runId.slice(0, 8),
        status: node.status,
        last_message: node.last_message,
        last_heartbeat: node.last_heartbeat,
        nodeType: "session",
        runId,
        lastChannel,
      });
      edgeList.push({ source: node.id, target: sessionId });
    }
  }

  const agentNodes = Array.from(agentsById.values());
  return {
    nodes: [...agentNodes, ...nodes],
    edges: edgeList,
  };
}


export async function getEventsAllRuns(
  workspaceId: string,
  limit = 50
): Promise<StoredEvent[]> {
  const runs = await listRuns(workspaceId);
  const all: StoredEvent[] = [];
  for (const runId of runs) {
    const events = await getEvents(workspaceId, runId, limit);
    all.push(...events);
  }
  all.sort((a, b) => {
    const ta = a.event?.ts ?? "";
    const tb = b.event?.ts ?? "";
    return tb.localeCompare(ta);
  });
  return all.slice(0, limit);
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
