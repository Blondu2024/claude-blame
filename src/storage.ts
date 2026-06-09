import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { gitDir } from "./git.js";

export interface CommitRecord {
  sessionId: string;
  sessionPath: string;
  recordedAt: string;
}

export interface SessionsFile {
  version: 1;
  commits: Record<string, CommitRecord>;
}

const FILENAME = "ai-sessions.json";

function filePath(cwd: string): string {
  return join(gitDir(cwd), FILENAME);
}

export function loadSessions(cwd: string): SessionsFile {
  const path = filePath(cwd);
  if (!existsSync(path)) return { version: 1, commits: {} };
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as SessionsFile;
    if (!data.commits) return { version: 1, commits: {} };
    return data;
  } catch {
    return { version: 1, commits: {} };
  }
}

export function saveSessions(cwd: string, data: SessionsFile): void {
  const path = filePath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function recordCommit(
  cwd: string,
  sha: string,
  rec: CommitRecord,
): void {
  const data = loadSessions(cwd);
  data.commits[sha] = rec;
  saveSessions(cwd, data);
}

export function lookupCommit(cwd: string, sha: string): CommitRecord | null {
  const data = loadSessions(cwd);
  return data.commits[sha] ?? null;
}
