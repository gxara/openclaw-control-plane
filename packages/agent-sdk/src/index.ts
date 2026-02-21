import type { IngestEvent } from "@control-plane/event-schema";

export async function sendEvent(
  baseUrl: string,
  event: IngestEvent
): Promise<Response> {
  return fetch(`${baseUrl}/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}
