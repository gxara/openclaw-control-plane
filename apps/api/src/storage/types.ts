import type { IngestEvent } from "@control-plane/event-schema";

export interface AgentState {
  id: string;
  label: string;
  status: "idle" | "thinking" | "working" | "error";
  last_message: string;
  agent: IngestEvent["agent"];
}

export interface StoredEvent extends IngestEvent {
  _id: string;
}
