import { homedir } from "node:os";
import { join } from "node:path";

export function claudeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

export function encodeCwd(cwd: string): string {
  return cwd.replace(/[:\\/]/g, "-");
}

export function projectSessionDirCandidates(cwd: string): string[] {
  const base = claudeProjectsDir();
  const encoded = encodeCwd(cwd);
  return [
    join(base, encoded),
    join(base, encoded.toLowerCase()),
    join(base, encoded.charAt(0).toLowerCase() + encoded.slice(1)),
  ];
}
