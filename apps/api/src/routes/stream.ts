import type { FastifyInstance } from "fastify";
import { subscribe } from "../realtime.js";

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspace_id: string } }>(
    "/v1/stream",
    async (request, reply) => {
      const workspaceId = request.query.workspace_id;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspace_id required" });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const unsubscribe = subscribe(workspaceId, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      request.raw.on("close", () => unsubscribe());
    }
  );
}
