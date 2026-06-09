import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { projectSessionDirCandidates } from "./paths.js";

export interface SessionInfo {
  sessionId: string;
  path: string;
  mtimeMs: number;
  firstUserMessage?: string;
  startedAt?: string;
}

function findProjectDir(cwd: string): string | null {
  for (const candidate of projectSessionDirCandidates(cwd)) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

export function listSessions(cwd: string): SessionInfo[] {
  const dir = findProjectDir(cwd);
  if (!dir) return [];

  const out: SessionInfo[] = [];
  for (const entry of readdirSync(dir)) {
    if (extname(entry) !== ".jsonl") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (!stat.isFile()) continue;
    out.push({
      sessionId: basename(entry, ".jsonl"),
      path: full,
      mtimeMs: stat.mtimeMs,
    });
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function activeSession(cwd: string): SessionInfo | null {
  return listSessions(cwd)[0] ?? null;
}

export function sessionAtTime(cwd: string, atMs: number): SessionInfo | null {
  const sessions = listSessions(cwd);
  if (sessions.length === 0) return null;
  let best: SessionInfo | null = null;
  let bestDelta = Infinity;
  for (const s of sessions) {
    if (s.mtimeMs < atMs - 60_000) continue;
    const delta = Math.abs(s.mtimeMs - atMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best ?? sessions[0];
}

export function enrichSession(info: SessionInfo): SessionInfo {
  try {
    const content = readFileSync(info.path, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!info.startedAt && typeof obj.timestamp === "string") {
        info.startedAt = obj.timestamp;
      }
      if (
        !info.firstUserMessage &&
        (obj.type === "user" || obj.role === "user")
      ) {
        const msg = extractText(obj);
        if (msg) {
          info.firstUserMessage = msg.slice(0, 140);
          break;
        }
      }
    }
  } catch {
    /* ignore — best-effort enrichment */
  }
  return info;
}

function extractText(obj: Record<string, unknown>): string | null {
  const message = obj.message as Record<string, unknown> | undefined;
  const content = (message?.content ?? obj.content) as unknown;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
      ) {
        return (part as { text: string }).text.trim();
      }
    }
  }
  return null;
}
