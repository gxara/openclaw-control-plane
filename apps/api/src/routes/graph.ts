import type { FastifyInstance } from "fastify";
import { getGraph, getEvents, listWorkspaces, listRuns } from "../storage/fs-storage.js";

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/workspaces", async (_request, reply) => {
    const workspaces = await listWorkspaces();
    return reply.send({ workspaces });
  });

  app.get<{ Params: { id: string } }>("/v1/workspaces/:id/runs", async (request, reply) => {
    const { id } = request.params;
    const runs = await listRuns(id);
    return reply.send({ runs });
  });

  app.get<{
    Params: { id: string };
    Querystring: { run_id?: string };
  }>("/v1/workspaces/:id/graph", async (request, reply) => {
    const { id } = request.params;
    const runId = request.query.run_id ?? "default";
    const graph = await getGraph(id, runId);
    return reply.send(graph);
  });

  app.get<{
    Params: { id: string };
    Querystring: { run_id?: string; limit?: string };
  }>("/v1/workspaces/:id/events", async (request, reply) => {
    const { id } = request.params;
    const runId = request.query.run_id ?? "default";
    const limit = Math.min(100, parseInt(request.query.limit ?? "50", 10) || 50);
    const events = await getEvents(id, runId, limit);
    return reply.send({ events });
  });
}
