import { z } from "zod";

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
});

export const IngestEventSchema = z.object({
  workspace_id: z.string(),
  run_id: z.string(),
  agent: AgentSchema,
  event: z.object({
    type: z.string(),
    ts: z.string(),
    dedupe_key: z.string(),
    data: z.record(z.unknown()),
  }),
});

export type IngestEvent = z.infer<typeof IngestEventSchema>;
export type Agent = z.infer<typeof AgentSchema>;
