import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSessions, recordCommit, lookupCommit } from "./storage.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "git-why-"));
  execFileSync("git", ["init", "-b", "main"], { cwd: tmp });
});

afterEach(() => {
  if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});

describe("storage", () => {
  it("returns empty when no file exists", () => {
    const out = loadSessions(tmp);
    expect(out.commits).toEqual({});
  });

  it("records and looks up commits", () => {
    recordCommit(tmp, "abc123", {
      sessionId: "session-1",
      sessionPath: "/tmp/session-1.jsonl",
      recordedAt: "2026-06-09T20:00:00.000Z",
    });
    const found = lookupCommit(tmp, "abc123");
    expect(found?.sessionId).toBe("session-1");
  });

  it("persists across loads", () => {
    recordCommit(tmp, "abc123", {
      sessionId: "session-1",
      sessionPath: "/tmp/session-1.jsonl",
      recordedAt: "2026-06-09T20:00:00.000Z",
    });
    recordCommit(tmp, "def456", {
      sessionId: "session-2",
      sessionPath: "/tmp/session-2.jsonl",
      recordedAt: "2026-06-09T21:00:00.000Z",
    });
    const data = loadSessions(tmp);
    expect(Object.keys(data.commits).sort()).toEqual(["abc123", "def456"]);
  });
});
