import { EventEmitter } from "node:events";

export type StreamEvent =
  | { type: "event.created"; payload: unknown }
  | { type: "agent.updated"; payload: { workspace_id: string; run_id: string } };

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

export function broadcast(event: StreamEvent): void {
  emitter.emit("broadcast", event);
}

export function subscribe(
  workspaceId: string,
  callback: (event: StreamEvent) => void
): () => void {
  const handler = (event: StreamEvent) => {
    if (
      event.type === "event.created" ||
      (event.type === "agent.updated" &&
        (event.payload as { workspace_id: string }).workspace_id === workspaceId)
    ) {
      callback(event);
    }
  };
  emitter.on("broadcast", handler);
  return () => emitter.off("broadcast", handler);
}
