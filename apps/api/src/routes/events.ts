import type { FastifyInstance } from "fastify";
import { IngestEventSchema } from "@control-plane/event-schema";
import { appendEvent } from "../storage/fs-storage.js";
import { broadcast } from "../realtime.js";

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/events", async (request, reply) => {
    const parsed = IngestEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }

    const inserted = await appendEvent(parsed.data);
    if (!inserted) {
      return reply.status(200).send({ ok: true, duplicate: true });
    }

    broadcast({
      type: "event.created",
      payload: parsed.data,
    });
    broadcast({
      type: "agent.updated",
      payload: {
        workspace_id: parsed.data.workspace_id,
        run_id: parsed.data.run_id,
      },
    });

    return reply.send({ ok: true });
  });
}
