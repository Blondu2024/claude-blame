# Contributing to git-why

Thanks for your interest!

## Dev setup

```bash
git clone https://github.com/Blondu2024/git-why
cd git-why
npm install
npm run build
npm test
```

## Run locally without publishing

```bash
npm link
# Now `git-why` on PATH points at your local build
git-why --version
```

## Tests

```bash
npm test          # one-off
npm run test:watch
```

## What's in scope for PRs

- Bug fixes (always welcome)
- Cursor / Aider / Continue session detection
- HTML transcript viewer
- MCP server version
- Cross-platform fixes (Linux/macOS edge cases)

## What's out of scope

- Cloud sync, telemetry, accounts — `git-why` is intentionally local-first
- Heavy dependencies — keep the binary small

## Code style

- TypeScript, strict mode
- No comments unless the *why* is non-obvious
- Small functions, plain functions over classes when possible
