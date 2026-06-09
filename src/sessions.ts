import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { projectSessionDirCandidates } from "./paths.js";

export type SessionMatchKind = "exact" | "parent";

export interface SessionInfo {
  sessionId: string;
  path: string;
  mtimeMs: number;
  matchKind?: SessionMatchKind;
  firstUserMessage?: string;
  startedAt?: string;
}

interface SessionDir {
  dir: string;
  kind: SessionMatchKind;
}

function findExactDir(cwd: string): string | null {
  for (const candidate of projectSessionDirCandidates(cwd)) {
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}

function findAllDirs(cwd: string): SessionDir[] {
  const out: SessionDir[] = [];
  const seen = new Set<string>();

  const exact = findExactDir(cwd);
  if (exact) {
    out.push({ dir: exact, kind: "exact" });
    seen.add(exact);
  }

  let current = cwd;
  while (true) {
    const parent = dirname(current);
    if (!parent || parent === current) break;
    const parentDir = findExactDir(parent);
    if (parentDir && !seen.has(parentDir)) {
      out.push({ dir: parentDir, kind: "parent" });
      seen.add(parentDir);
    }
    current = parent;
  }

  return out;
}

function readJsonlSessions(dir: string, kind: SessionMatchKind): SessionInfo[] {
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
      matchKind: kind,
    });
  }
  return out;
}

export interface ListSessionsOptions {
  includeParents?: boolean;
}

export function listSessions(
  cwd: string,
  opts: ListSessionsOptions = {},
): SessionInfo[] {
  if (!opts.includeParents) {
    const exact = findExactDir(cwd);
    if (!exact) return [];
    return readJsonlSessions(exact, "exact").sort(
      (a, b) => b.mtimeMs - a.mtimeMs,
    );
  }

  const out: SessionInfo[] = [];
  for (const d of findAllDirs(cwd)) {
    out.push(...readJsonlSessions(d.dir, d.kind));
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function activeSession(cwd: string): SessionInfo | null {
  const exact = listSessions(cwd);
  if (exact.length > 0) return exact[0];
  const withParents = listSessions(cwd, { includeParents: true });
  return withParents[0] ?? null;
}

const DEFAULT_TOLERANCE_MS = 30 * 60 * 1000;

export function sessionAtTime(
  cwd: string,
  atMs: number,
  opts: { toleranceMs?: number } = {},
): SessionInfo | null {
  const tolerance = opts.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  const sessions = listSessions(cwd, { includeParents: true });
  if (sessions.length === 0) return null;

  let best: SessionInfo | null = null;
  let bestDelta = Infinity;
  for (const s of sessions) {
    const delta = Math.abs(s.mtimeMs - atMs);
    if (delta > tolerance) continue;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
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
