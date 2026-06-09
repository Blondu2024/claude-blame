# claude-blame

> **`git blame` says WHO. `claude-blame` says WHICH CLAUDE SESSION.**
>
> Link every git commit to the Claude Code conversation that wrote it — then jump back into it with one command.

```bash
$ claude-blame src/auth.ts:42
commit a1b2c3d4e5f6  fix: handle expired refresh tokens
session 9e297d8a-ef72-483e-8599-d2d6c2874a6a
first prompt: refresh tokens are getting rejected after 24h, debug this

→ opening: claude --resume 9e297d8a-ef72-483e-8599-d2d6c2874a6a
```

A tiny CLI that records which **Claude Code session** was active when each commit was made. Later, you can run `claude-blame <file>:<line>` and jump straight back into the exact conversation that produced that code — full context, intact.

No cloud. No telemetry. Everything stays local in `.git/ai-sessions.json`.

---

## Why this exists

You're 3 weeks into a project. A bug surfaces. You open the file, find the suspect line, and think:

> "I wrote this with Claude... last Tuesday? Wednesday? Which session was it?"

Claude Code already saves every session as a `.jsonl` file. The conversation is on your disk. The problem is finding **the specific one** that wrote **the specific line** you're staring at.

`claude-blame` solves that with a post-commit hook + `git blame`.

---

## Install

```bash
npm install -g claude-blame
```

Then, in any git repository where you use Claude Code:

```bash
claude-blame install
```

This adds a `post-commit` hook. From now on, every commit gets linked to your currently-active Claude Code session.

For commits made **before** you installed, try:

```bash
claude-blame backfill
```

It matches past commits to sessions by timestamp (best-effort — not perfect, but usually close).

---

## Usage

```bash
# By file + line — jumps to the session that authored that line
claude-blame src/auth.ts:42

# By commit SHA — direct lookup
claude-blame a1b2c3d

# Print the transcript instead of opening Claude Code
claude-blame src/auth.ts:42 --print

# List recent commits and their linked sessions
claude-blame list
claude-blame list -n 25
```

---

## How it works

1. **`claude-blame install`** writes a `post-commit` hook into `.git/hooks/post-commit`.
2. After every commit, the hook calls `claude-blame _record`, which:
   - reads `~/.claude/projects/<encoded-cwd>/*.jsonl`,
   - picks the **most recently modified** session file (= the one you were just using),
   - saves `commit_sha → session_id` into `.git/ai-sessions.json`.
3. When you run `claude-blame <file>:<line>`, it:
   - runs `git blame` on that line to find the commit,
   - looks up the session in `.git/ai-sessions.json`,
   - runs `claude --resume <session_id>` to drop you back into the conversation.

All local. No daemon. No network call.

---

## What gets stored

`.git/ai-sessions.json`:

```json
{
  "version": 1,
  "commits": {
    "a1b2c3d4...": {
      "sessionId": "9e297d8a-ef72-483e-8599-d2d6c2874a6a",
      "sessionPath": "/Users/you/.claude/projects/-Users-you-proj/9e297d8a-....jsonl",
      "recordedAt": "2026-06-09T20:35:00.000Z"
    }
  }
}
```

The actual session transcript stays where Claude Code put it. `claude-blame` only stores the pointer.

You can `.gitignore` `ai-sessions.json` if you don't want to share session IDs across the team, or commit it if you do.

---

## Requirements

- Node.js ≥ 18
- Git
- [Claude Code](https://claude.com/code) installed (`claude` on PATH) — only needed for the `--resume` jump, not for recording

---

## Roadmap

- [ ] MCP server version (so Claude Code can answer "why was this written?" without leaving the editor)
- [ ] Cursor / Aider session detection
- [ ] `claude-blame --since=2.weeks` (range lookups)
- [ ] HTML transcript viewer fallback when Claude Code isn't installed
- [ ] Team mode: optional shared session metadata via a separate sync repo

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## FAQ

**Does this send my conversations anywhere?**
No. Everything is local. The tool reads `~/.claude/projects/` (already on your disk) and writes `.git/ai-sessions.json` (in your repo).

**What if I use multiple Claude Code sessions per commit?**
`claude-blame` records the **most recently active** one at the moment of commit. If you switch sessions a lot, the post-commit hook captures whichever was touched last.

**Does it work for Cursor / Aider / Continue?**
Not yet — only Claude Code for now. PRs welcome.

**Will it leak my session IDs if I `git push` `ai-sessions.json`?**
The session ID itself is harmless — but the **path** to the session file may reveal your home directory. If you push, consider `.gitignore`-ing the file.

---

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Cristian Tanase](https://github.com/Blondu2024) because I kept losing track of which Claude session wrote which line.
