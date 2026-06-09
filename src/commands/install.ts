import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { hooksPath, isGitRepo } from "../git.js";

const HOOK_MARKER = "# git-why hook v1";
const HOOK_LINE = `${HOOK_MARKER}
git-why _record >/dev/null 2>&1 || true`;

const HOOK_TEMPLATE = `#!/bin/sh
${HOOK_LINE}
`;

export function install(cwd: string): void {
  if (!isGitRepo(cwd)) {
    console.error(pc.red("✗ Not inside a git repository."));
    process.exit(1);
  }

  const hookFile = join(hooksPath(cwd), "post-commit");

  if (existsSync(hookFile)) {
    const current = readFileSync(hookFile, "utf8");
    if (current.includes(HOOK_MARKER)) {
      console.log(pc.green("✓ git-why hook already installed."));
      return;
    }
    const next = current.trimEnd() + "\n\n" + HOOK_LINE + "\n";
    writeFileSync(hookFile, next, "utf8");
    chmodSync(hookFile, 0o755);
    console.log(pc.green("✓ Appended git-why to existing post-commit hook."));
    return;
  }

  writeFileSync(hookFile, HOOK_TEMPLATE, "utf8");
  chmodSync(hookFile, 0o755);
  console.log(pc.green(`✓ Installed post-commit hook at ${hookFile}`));
  console.log(
    pc.dim(
      "  Every commit from now on will be linked to your active Claude Code session.",
    ),
  );
}
