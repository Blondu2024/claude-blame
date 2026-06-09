#!/usr/bin/env node
import { Command } from "commander";
import { install } from "./commands/install.js";
import { record } from "./commands/record.js";
import { why } from "./commands/why.js";
import { listCmd } from "./commands/list.js";
import { backfill } from "./commands/backfill.js";

const VERSION = "0.1.0";

const program = new Command();

program
  .name("claude-blame")
  .description(
    "git blame says WHO. claude-blame says WHICH CLAUDE SESSION. Link every git commit to the Claude Code conversation that wrote it — then jump back in with one command.",
  )
  .version(VERSION);

program
  .command("install")
  .description("Install the post-commit hook in the current repo")
  .action(() => install(process.cwd()));

program
  .command("_record", { hidden: true })
  .description("(internal) record current HEAD ↔ active session")
  .option("-q, --quiet", "suppress output")
  .action((opts: { quiet?: boolean }) =>
    record(process.cwd(), { quiet: opts.quiet }),
  );

program
  .command("list")
  .description("Show recent commits and their linked sessions")
  .option("-n, --number <n>", "number of commits to show", "10")
  .action((opts: { number: string }) =>
    listCmd(process.cwd(), parseInt(opts.number, 10)),
  );

program
  .command("backfill")
  .description("Best-effort: link past commits to sessions by timestamp")
  .option("-n, --number <n>", "how many recent commits to scan", "100")
  .action((opts: { number: string }) =>
    backfill(process.cwd(), parseInt(opts.number, 10)),
  );

program
  .argument("[target]", "<file>:<line> or <commit-sha>")
  .option("-p, --print", "print transcript instead of resuming in Claude Code")
  .action((target: string | undefined, opts: { print?: boolean }) => {
    if (!target) {
      program.outputHelp();
      return;
    }
    why(process.cwd(), target, opts);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
