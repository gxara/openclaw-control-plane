import Fastify from "fastify";
import cors from "@fastify/cors";
import { eventsRoutes } from "./routes/events.js";
import { graphRoutes } from "./routes/graph.js";
import { streamRoutes } from "./routes/stream.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(eventsRoutes);
await app.register(graphRoutes);
await app.register(streamRoutes);

const port = parseInt(process.env.PORT ?? "3001", 10);
await app.listen({ port, host: "0.0.0.0" });
console.log(`API listening on http://localhost:${port}`);
