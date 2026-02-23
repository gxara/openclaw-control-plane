import fs from "node:fs/promises";
import path from "node:path";
import { extractObjects } from "./parser.js";

export interface SessionFile {
  filePath: string;
  agentName: string;
  channel: string;
  sessionId: string;
}

/** sessions.json: sessionKey -> { sessionId, updatedAt, ... } */
interface SessionsStore {
  [key: string]: { sessionId?: string; updatedAt?: number; lastChannel?: string };
}

const fileOffsets = new Map<string, number>();

function getActiveSessions(store: SessionsStore): Record<string, { updatedAt?: number; channel?: string }> {
  const sessions: Record<string, { updatedAt?: number; channel?: string }> = {};
  for (const entry of Object.values(store)) {
    if (entry?.sessionId) sessions[entry.sessionId] = {
      updatedAt: entry.updatedAt,
      channel: entry.lastChannel,
    };
  }
  return sessions;
}

export async function scanSessions(rootDir: string): Promise<SessionFile[]> {
  const sessions: SessionFile[] = [];

  try {
    const agentDirs = await fs.readdir(rootDir, { withFileTypes: true });
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      const sessionsPath = path.join(rootDir, agentDir.name, "sessions");
      try {
        const storePath = path.join(sessionsPath, "sessions.json");
        let agentSessions: Record<string, { updatedAt?: number; channel?: string }> | null = null;
        try {
          const data = await fs.readFile(storePath, "utf-8");
          const store = JSON.parse(data) as SessionsStore;
          agentSessions = getActiveSessions(store);
        } catch {
          // No sessions.json or parse failed → process all .jsonl (fallback)
        }

        const entries = await fs.readdir(sessionsPath, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isFile() || !ent.name.endsWith(".jsonl")) continue;
          const sessionId = ent.name.replace(/\.jsonl$/, "");
          if (agentSessions !== null && !agentSessions[sessionId]) continue;
          sessions.push({
            filePath: path.join(sessionsPath, ent.name),
            agentName: agentDir.name,
            channel: agentSessions?.[sessionId]?.channel ?? "openclaw",
            sessionId,
          });
        }
      } catch {
        // No sessions dir or not readable
      }
    }
  } catch {
    // Root not readable
  }

  return sessions;
}

export async function scanAgentNames(rootDir: string): Promise<string[]> {
  const agentNames: string[] = [];
  try {
    const agentDirs = await fs.readdir(rootDir, { withFileTypes: true });
    for (const agentDir of agentDirs) {
      if (!agentDir.isDirectory()) continue;
      agentNames.push(agentDir.name);
    }
  } catch {
    // Root not readable
  }
  return agentNames;
}

export async function readNewObjects(
  filePath: string,
  fromOffset: number
): Promise<{ objects: string[]; newOffset: number }> {
  const fd = await fs.open(filePath, "r");
  try {
    const stat = await fd.stat();
    if (stat.size <= fromOffset) {
      return { objects: [], newOffset: fromOffset };
    }
    const buffer = Buffer.alloc(stat.size - fromOffset);
    await fd.read(buffer, 0, buffer.length, fromOffset);
    const text = buffer.toString("utf-8");
    const { objects, tail } = extractObjects(text);
    const tailLen = Buffer.byteLength(tail, "utf-8");
    const newOffset = tail ? stat.size - tailLen : stat.size;
    return { objects, newOffset };
  } finally {
    await fd.close();
  }
}

export function getOffset(filePath: string): number {
  return fileOffsets.get(filePath) ?? 0;
}

export function setOffset(filePath: string, offset: number): void {
  fileOffsets.set(filePath, offset);
}
