import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";
import { blameLine, commitSubject, commitTimestamp, isGitRepo } from "../git.js";
import { lookupCommit } from "../storage.js";
import { sessionAtTime, enrichSession, listSessions } from "../sessions.js";

export interface WhyOptions {
  print?: boolean;
}

export function why(cwd: string, target: string, opts: WhyOptions = {}): void {
  if (!isGitRepo(cwd)) {
    console.error(pc.red("✗ Not inside a git repository."));
    process.exit(1);
  }

  const sha = resolveSha(cwd, target);
  if (!sha) {
    console.error(pc.red(`✗ Could not find a commit for "${target}".`));
    console.error(
      pc.dim(
        '  Try `claude-blame <file>:<line>` or `claude-blame <commit-sha>`.',
      ),
    );
    process.exit(1);
  }

  const subject = commitSubject(cwd, sha);
  console.log(pc.bold(`commit ${sha.slice(0, 12)}`) + pc.dim(`  ${subject}`));

  let record = lookupCommit(cwd, sha);
  let source: "hook" | "backfill" = "hook";
  if (!record) {
    const when = commitTimestamp(cwd, sha);
    if (when) {
      const guess = sessionAtTime(cwd, when.getTime());
      if (guess) {
        record = {
          sessionId: guess.sessionId,
          sessionPath: guess.path,
          recordedAt: new Date().toISOString(),
          matchKind: "guess",
        };
        source = "backfill";
      }
    }
  }

  if (!record) {
    console.error(pc.yellow("⚠ No Claude Code session recorded for this commit."));
    console.error(
      pc.dim(
        "  Run `claude-blame install` to start tracking, or `claude-blame backfill` for past commits.",
      ),
    );
    process.exit(2);
  }

  const enriched = enrichSession({
    sessionId: record.sessionId,
    path: record.sessionPath,
    mtimeMs: 0,
  });

  let confidence = "";
  if (source === "backfill" || record.matchKind === "guess") {
    confidence = pc.yellow("  (guess — backfill, may be inaccurate)");
  } else if (record.matchKind === "parent") {
    confidence = pc.yellow("  (parent-dir match — Claude launched outside repo)");
  }
  console.log(pc.dim(`session ${record.sessionId}`) + confidence);
  if (enriched.firstUserMessage) {
    console.log(pc.cyan(`first prompt: ${enriched.firstUserMessage}`));
  }

  if (opts.print) {
    printTranscript(record.sessionPath);
    return;
  }

  resumeInClaude(record.sessionId);
}

function resolveSha(cwd: string, target: string): string | null {
  if (/^[0-9a-f]{7,40}$/i.test(target)) return target;
  const m = target.match(/^(.+):(\d+)$/);
  if (m) {
    const [, file, lineStr] = m;
    const line = parseInt(lineStr, 10);
    return blameLine(cwd, file, line);
  }
  return null;
}

function resumeInClaude(sessionId: string): void {
  console.log(pc.dim(`\n→ opening: claude --resume ${sessionId}`));
  const child = spawn("claude", ["--resume", sessionId], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("error", (err) => {
    console.error(pc.red(`✗ Failed to launch claude: ${err.message}`));
    console.error(
      pc.dim("  Install Claude Code, or use `claude-blame <target> --print`."),
    );
    process.exit(1);
  });
}

function printTranscript(path: string): void {
  if (!existsSync(path)) {
    console.error(pc.red(`✗ Session file missing: ${path}`));
    process.exit(1);
  }
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const role =
      obj.type === "user" || obj.role === "user"
        ? "user"
        : obj.type === "assistant" || obj.role === "assistant"
          ? "assistant"
          : null;
    if (!role) continue;
    const text = extractText(obj);
    if (!text) continue;
    const prefix = role === "user" ? pc.cyan("user │") : pc.green("claude │");
    console.log(`${prefix} ${text}`);
  }

  // Avoid unused-import warning
  void listSessions;
}

function extractText(obj: Record<string, unknown>): string | null {
  const message = obj.message as Record<string, unknown> | undefined;
  const content = (message?.content ?? obj.content) as unknown;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
      ) {
        parts.push((part as { text: string }).text.trim());
      }
    }
    return parts.length ? parts.join("\n") : null;
  }
  return null;
}
