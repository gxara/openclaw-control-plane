interface GraphNode {
  id: string;
  label: string;
  status: string;
  last_message: string;
}

interface NodeInspectorProps {
  node: GraphNode;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  thinking: "Thinking",
  working: "Working",
  error: "Error",
};

export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  return (
    <div style={overlay}>
      <div style={panel}>
        <div style={header}>
          <h3 style={title}>{node.label}</h3>
          <button style={closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <dl style={dl}>
          <dt style={dt}>ID</dt>
          <dd style={dd}>{node.id}</dd>
          <dt style={dt}>Status</dt>
          <dd style={dd}>{STATUS_LABELS[node.status] ?? node.status}</dd>
          <dt style={dt}>Last Message</dt>
          <dd style={dd}>{node.last_message || "—"}</dd>
        </dl>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.5)",
  zIndex: 100,
};

const panel: React.CSSProperties = {
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  padding: 20,
  minWidth: 280,
  maxWidth: 400,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#71717a",
  fontSize: 24,
  cursor: "pointer",
  padding: "0 4px",
  lineHeight: 1,
};

const dl: React.CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "100px 1fr",
  gap: "8px 16px",
};

const dt: React.CSSProperties = {
  margin: 0,
  color: "#71717a",
  fontSize: 12,
};

const dd: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
};
