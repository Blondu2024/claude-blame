import pc from "picocolors";
import { headSha, isGitRepo } from "../git.js";
import { activeSession } from "../sessions.js";
import { recordCommit } from "../storage.js";

export function record(cwd: string, opts: { quiet?: boolean } = {}): void {
  if (!isGitRepo(cwd)) return;

  let sha: string;
  try {
    sha = headSha(cwd);
  } catch {
    return;
  }

  const session = activeSession(cwd);
  if (!session) {
    if (!opts.quiet) {
      console.log(
        pc.dim(`claude-blame: no active Claude Code session found for ${cwd}`),
      );
    }
    return;
  }

  recordCommit(cwd, sha, {
    sessionId: session.sessionId,
    sessionPath: session.path,
    recordedAt: new Date().toISOString(),
  });

  if (!opts.quiet) {
    console.log(
      pc.green(
        `✓ claude-blame: linked ${sha.slice(0, 7)} → session ${session.sessionId.slice(0, 8)}`,
      ),
    );
  }
}
