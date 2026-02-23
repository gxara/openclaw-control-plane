import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scanSessions,
  readNewObjects,
  getOffset,
  setOffset,
  scanAgentNames,
} from "./file-scanner.js";
import { parseObject } from "./parser.js";
import { mapToControlPlane, type MappingContext } from "./mapper.js";
import { sendEvent } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadRoot(): Promise<string> {
  const env = process.env.OPENCLAW_SESSIONS_DIR;
  if (env) return env;
  try {
    const configPath = path.join(__dirname, "..", "config.json");
    const data = await fs.readFile(configPath, "utf-8");
    const cfg = JSON.parse(data) as { sessions_dir?: string };
    if (cfg.sessions_dir) return cfg.sessions_dir;
  } catch {
    // No config
  }
  return "";
}

const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "3000", 10);

const runIdByFile = new Map<string, string>();
let ROOT = "";

async function processFile(
  filePath: string,
  agentName: string,
  sessionId: string,
  channel: string
): Promise<void> {
  const offset = getOffset(filePath);
  const { objects, newOffset } = await readNewObjects(filePath, offset);

  console.log("Objects:", objects);
  if (objects.length === 0) {
    setOffset(filePath, newOffset);
    return;
  }

  // const agentMessages = objects.filter(o => o.type === "message" && o.role === "assistant");
  // const userMessages = objects.filter(o => o.type === "message" && o.role === "user");


  const runIdOverride = process.env.RUN_ID;

  let runId = runIdOverride ?? runIdByFile.get(filePath) ?? sessionId;

  const ctx: MappingContext = {
    agentId: `openclaw:${agentName}`,
    agentName,
    runId,
    lastChannel: channel,
  };

  const messages = [];

  for (let i = 0; i < objects.length; i++) {
    const raw = parseObject(objects[i]);
    // console.log("Parsed object:", raw);
    if (!raw) {
      console.warn(`[openclaw-adapter] Failed to parse object at index ${i}`);
      continue;
    }

    if (raw.type === "message") {
      messages.push(raw);
    }

    if (!runIdOverride && raw.type === "session" && raw.session?.id) {
      runId = raw.session.id;
      runIdByFile.set(filePath, runId);
      ctx.runId = runId;
    }

    const events = mapToControlPlane(raw, ctx, i);
    // console.log("Mapped events:", events);
    for (const ev of events) {
      const ok = await sendEvent(ev);
      if (!ok && ev.event.type !== "agent.register") {
        // Retry next cycle - don't advance offset
        return;
      }
    }
  }


  setOffset(filePath, newOffset);
}

async function registerAgent(agentName: string): Promise<boolean> {
  const ok = await sendEvent({
    workspace_id: process.env.WORKSPACE_ID ?? "ws_default",
    run_id: "run_default",
    agent: {
      id: `openclaw:${agentName}`,
      name: agentName,
      kind: "openclaw",
    },
    event: {
      type: "agent.register",
      ts: new Date().toISOString(),
      dedupe_key: `openclaw:${agentName}`,
      data: { agent_name: agentName },
    },
  });

  console.log("Registered agent:", agentName, ok);
  return ok;
}

async function poll(): Promise<void> {
  const resolved = path.resolve(ROOT);
  const sessions = await scanSessions(resolved);
  const agentNames = await scanAgentNames(resolved);

  // First we register agents
  for (const agentName of agentNames) {
    const ok = await registerAgent(agentName);
    if (!ok) {
      console.warn(`[openclaw-adapter] Failed to register agent ${agentName}`);
      return;
    }
  }


  // Then we record events
  for (const { filePath, agentName, sessionId, channel } of sessions) {
    try {
      await processFile(filePath, agentName, sessionId, channel);
    } catch (err) {
      console.warn(`[openclaw-adapter] Error processing ${filePath}:`, err);
    }
  }

}

async function main(): Promise<void> {
  ROOT = await loadRoot();
  if (!ROOT) {
    console.error(
      "[openclaw-adapter] Set OPENCLAW_SESSIONS_DIR or create config.json with { \"sessions_dir\": \"/path/to/agents\" }"
    );
    process.exit(1);
  }
  console.log(`[openclaw-adapter] Polling ${ROOT} every ${POLL_MS}ms`);

  const run = (): void => {
    poll().catch((err) => console.error("[openclaw-adapter]", err));
    setTimeout(run, POLL_MS);
  };
  run();
}

main();
