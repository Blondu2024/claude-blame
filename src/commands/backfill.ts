import pc from "picocolors";
import { commitTimestamp, isGitRepo, recentCommits } from "../git.js";
import { listSessions, sessionAtTime } from "../sessions.js";
import { loadSessions, saveSessions } from "../storage.js";

export function backfill(cwd: string, n = 100): void {
  if (!isGitRepo(cwd)) {
    console.error(pc.red("✗ Not inside a git repository."));
    process.exit(1);
  }

  const sessions = listSessions(cwd, { includeParents: true });
  if (sessions.length === 0) {
    console.error(
      pc.yellow("⚠ No Claude Code sessions found for this project."),
    );
    return;
  }

  const commits = recentCommits(cwd, n);
  const data = loadSessions(cwd);
  let added = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const c of commits) {
    if (data.commits[c.sha]) {
      skipped++;
      continue;
    }
    const when = commitTimestamp(cwd, c.sha);
    if (!when) {
      unmatched++;
      continue;
    }
    const guess = sessionAtTime(cwd, when.getTime());
    if (!guess) {
      unmatched++;
      continue;
    }
    data.commits[c.sha] = {
      sessionId: guess.sessionId,
      sessionPath: guess.path,
      recordedAt: new Date().toISOString(),
      matchKind: "guess",
    };
    added++;
  }

  saveSessions(cwd, data);
  const parts = [
    pc.green(`✓ backfilled ${added} commits`),
    pc.dim(`skipped ${skipped} already recorded`),
  ];
  if (unmatched > 0) {
    parts.push(pc.yellow(`${unmatched} unmatched (no session within 30min)`));
  }
  console.log(parts.join("  "));
}
