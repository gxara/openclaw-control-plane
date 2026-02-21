interface StoredEvent {
  _id: string;
  agent: { id: string; name: string };
  event: { type: string; ts: string; data: Record<string, unknown> };
}

interface EventSidebarProps {
  events: StoredEvent[];
}

export function EventSidebar({ events }: EventSidebarProps) {
  return (
    <div style={container}>
      <h3 style={heading}>Latest Events</h3>
      <ul style={list}>
        {events.map((ev) => (
          <li key={ev._id} style={item}>
            <span style={meta}>
              {ev.agent.name} · {ev.event.type}
            </span>
            <span style={time}>
              {new Date(ev.event.ts).toLocaleTimeString()}
            </span>
            {"message" in (ev.event.data || {}) && (
              <span style={msg}>{String(ev.event.data?.message)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const container: React.CSSProperties = {
  padding: 16,
};

const heading: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 600,
};

const list: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const item: React.CSSProperties = {
  padding: "8px 0",
  borderBottom: "1px solid #27272a",
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const meta: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 11,
};

const time: React.CSSProperties = {
  color: "#71717a",
  fontSize: 10,
};

const msg: React.CSSProperties = {
  fontSize: 12,
  wordBreak: "break-word",
};
