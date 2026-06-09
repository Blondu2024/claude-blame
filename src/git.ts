import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function run(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export function gitDir(cwd: string): string {
  try {
    const out = run(["rev-parse", "--git-dir"], cwd);
    return out.startsWith(".") ? join(cwd, out) : out;
  } catch {
    throw new Error("Not inside a git repository.");
  }
}

export function repoRoot(cwd: string): string {
  return run(["rev-parse", "--show-toplevel"], cwd);
}

export function headSha(cwd: string): string {
  return run(["rev-parse", "HEAD"], cwd);
}

export function blameLine(
  cwd: string,
  file: string,
  line: number,
): string | null {
  try {
    const out = run(
      ["blame", "-L", `${line},${line}`, "--porcelain", "--", file],
      cwd,
    );
    const sha = out.split(/\s+/)[0];
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) return null;
    if (/^0+$/.test(sha)) return null;
    return sha;
  } catch {
    return null;
  }
}

export function commitTimestamp(cwd: string, sha: string): Date | null {
  try {
    const out = run(["show", "-s", "--format=%cI", sha], cwd);
    const d = new Date(out);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function commitSubject(cwd: string, sha: string): string {
  try {
    return run(["show", "-s", "--format=%s", sha], cwd);
  } catch {
    return "";
  }
}

export function recentCommits(
  cwd: string,
  n: number,
): { sha: string; subject: string; date: string }[] {
  const out = run(["log", `-n${n}`, "--format=%H%x09%cI%x09%s"], cwd);
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, date, ...rest] = line.split("\t");
      return { sha, date, subject: rest.join("\t") };
    });
}

export function isGitRepo(cwd: string): boolean {
  try {
    run(["rev-parse", "--git-dir"], cwd);
    return true;
  } catch {
    return false;
  }
}

export function hooksPath(cwd: string): string {
  const dir = gitDir(cwd);
  if (existsSync(join(dir, "hooks"))) return join(dir, "hooks");
  return join(dir, "hooks");
}
