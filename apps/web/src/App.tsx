import { useState, useEffect, useCallback } from "react";
import { Graph } from "./Graph";
import { EventSidebar } from "./EventSidebar";
import { NodeInspector } from "./NodeInspector";

const WORKSPACE_ID = "ws_default";
const RUN_ID = "run_demo";
const API = "";

interface GraphNode {
  id: string;
  label: string;
  status: string;
  last_message: string;
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
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const fetchGraph = useCallback(async () => {
    const res = await fetch(
      `${API}/v1/workspaces/${WORKSPACE_ID}/graph?run_id=${RUN_ID}`
    );
    const data = await res.json();
    setGraph(data);
  }, []);

  const fetchEvents = useCallback(async () => {
    const res = await fetch(
      `${API}/v1/workspaces/${WORKSPACE_ID}/events?run_id=${RUN_ID}&limit=50`
    );
    const data = await res.json();
    setEvents(data.events ?? []);
  }, []);

  useEffect(() => {
    fetchGraph();
    fetchEvents();
  }, [fetchGraph, fetchEvents]);

  useEffect(() => {
    const es = new EventSource(
      `${API}/v1/stream?workspace_id=${WORKSPACE_ID}`
    );
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as { type: string };
      if (ev.type === "event.created" || ev.type === "agent.updated") {
        fetchGraph();
        fetchEvents();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [fetchGraph, fetchEvents]);

  return (
    <div style={layout}>
      <header style={header}>
        <h1 style={title}>Control Plane</h1>
        <span style={subtitle}>
          {WORKSPACE_ID} / {RUN_ID}
        </span>
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

const subtitle: React.CSSProperties = {
  color: "#71717a",
  fontSize: 12,
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
