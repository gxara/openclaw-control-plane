import { useState, useEffect, useCallback } from "react";
import { Graph } from "./Graph";
import { EventSidebar } from "./EventSidebar";
import { NodeInspector } from "./NodeInspector";

const API = "";

interface GraphNode {
  id: string;
  label: string;
  status: string;
  last_message: string;
  last_heartbeat?: string;
  nodeType?: "agent" | "session";
  runId?: string;
  lastChannel?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string }>;
}

interface StoredEvent {
  _id: string;
  agent: { id: string; name: string };
  event: { type: string; ts: string; data: Record<string, unknown> };
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspaceId, setWorkspaceId] = useState("ws_default");
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    const res = await fetch(`${API}/v1/workspaces`);
    const data = await res.json();
    const list = data.workspaces ?? [];
    setWorkspaces(list);
    setWorkspaceId((prev) =>
      list.length > 0 && !list.includes(prev) ? list[0] : prev
    );
  }, []);

  const fetchGraph = useCallback(async (wsId: string) => {
    const res = await fetch(`${API}/v1/workspaces/${wsId}/graph`);
    const data = await res.json();
    setGraph(data);
  }, []);

  const fetchEvents = useCallback(async (wsId: string) => {
    const res = await fetch(
      `${API}/v1/workspaces/${wsId}/events?limit=50`
    );
    const data = await res.json();
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (workspaceId) {
      fetchGraph(workspaceId);
      fetchEvents(workspaceId);
    }
  }, [workspaceId, fetchGraph, fetchEvents]);

  useEffect(() => {
    if (!workspaceId) return;
    const es = new EventSource(`${API}/v1/stream?workspace_id=${workspaceId}`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as { type: string };
      if (ev.type === "event.created" || ev.type === "agent.updated") {
        fetchWorkspaces();
        fetchGraph(workspaceId);
        fetchEvents(workspaceId);
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [workspaceId, fetchWorkspaces, fetchGraph, fetchEvents]);

  return (
    <div style={layout}>
      <header style={header}>
        <h1 style={title}>Visual control center for AI agents</h1>
        <div style={selectors}>
          <select
            style={select}
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {(workspaces.length === 0 ? [workspaceId] : workspaces).map(
              (ws) => (
                <option key={ws} value={ws}>
                  {ws}
                </option>
              )
            )}
          </select>
        </div>
      </header>
      <main style={main}>
        <div style={graphContainer}>
          <Graph
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeSelect={setSelectedNode}
          />
        </div>
        <aside style={sidebar}>
          <EventSidebar events={events} />
        </aside>
        {selectedNode && (
          <NodeInspector node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </main>
    </div>
  );
}

const layout: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const header: React.CSSProperties = {
  padding: "12px 20px",
  borderBottom: "1px solid #27272a",
  display: "flex",
  alignItems: "baseline",
  gap: 12,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
};

const selectors: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const select: React.CSSProperties = {
  background: "#27272a",
  color: "#e4e4e7",
  border: "1px solid #3f3f46",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 12,
  cursor: "pointer",
};

const main: React.CSSProperties = {
  flex: 1,
  display: "flex",
  overflow: "hidden",
};

const graphContainer: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const sidebar: React.CSSProperties = {
  width: 320,
  borderLeft: "1px solid #27272a",
  overflow: "auto",
};
