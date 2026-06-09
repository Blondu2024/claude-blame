import pc from "picocolors";
import { isGitRepo, recentCommits } from "../git.js";
import { loadSessions } from "../storage.js";

export function listCmd(cwd: string, n = 10): void {
  if (!isGitRepo(cwd)) {
    console.error(pc.red("✗ Not inside a git repository."));
    process.exit(1);
  }

  const commits = recentCommits(cwd, n);
  const { commits: map } = loadSessions(cwd);

  if (commits.length === 0) {
    console.log(pc.dim("No commits yet."));
    return;
  }

  for (const c of commits) {
    const rec = map[c.sha];
    let sid: string;
    if (!rec) {
      sid = pc.dim("—       ");
    } else {
      const short = rec.sessionId.slice(0, 8);
      const marker =
        rec.matchKind === "guess"
          ? pc.yellow("?")
          : rec.matchKind === "parent"
            ? pc.yellow("~")
            : " ";
      sid = pc.cyan(short) + marker;
    }
    const date = c.date.slice(0, 10);
    const subject =
      c.subject.length > 56 ? c.subject.slice(0, 53) + "..." : c.subject;
    console.log(`${pc.yellow(c.sha.slice(0, 7))}  ${date}  ${sid}  ${subject}`);
  }

  console.log(
    pc.dim(
      "\nLegend:  ? = backfill guess   ~ = parent-dir match   blank = exact match",
    ),
  );
}
