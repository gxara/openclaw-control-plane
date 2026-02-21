import type { IngestEvent } from "@control-plane/event-schema";

const API_URL = process.env.CONTROL_PLANE_API ?? "http://127.0.0.1:3001";

export async function sendEvent(event: IngestEvent): Promise<boolean> {
  try {
    console.log("Sending event to API:", event);
    const res = await fetch(`${API_URL}/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    console.log("Response from API:", res);
    return res.ok;
  } catch {
    console.error("Failed to send event to API");
    return false;
  }
}
