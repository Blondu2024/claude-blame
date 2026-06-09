import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  utimesSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
  listSessions,
  activeSession,
  sessionAtTime,
} from "./sessions.js";

let fakeHome: string;
let projectCwd: string;
let projectDir: string;
let parentCwd: string;
let parentDir: string;

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), "git-why-home-"));
  vi.spyOn({ homedir }, "homedir").mockReturnValue(fakeHome);
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;

  parentCwd = "C:\\Users\\Test";
  projectCwd = "C:\\Users\\Test\\proj";
  parentDir = join(fakeHome, ".claude", "projects", "C--Users-Test");
  projectDir = join(fakeHome, ".claude", "projects", "C--Users-Test-proj");
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(parentDir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fakeHome && existsSync(fakeHome)) {
    rmSync(fakeHome, { recursive: true, force: true });
  }
});

function writeSession(dir: string, id: string, mtimeSeconds: number) {
  const p = join(dir, `${id}.jsonl`);
  writeFileSync(p, `{"sessionId":"${id}"}\n`);
  utimesSync(p, mtimeSeconds, mtimeSeconds);
  return p;
}

describe("sessions", () => {
  it("returns empty list when project dir missing", () => {
    expect(listSessions("C:\\Users\\Test\\nonexistent")).toEqual([]);
  });

  it("lists sessions sorted by mtime desc, marks as exact", () => {
    writeSession(projectDir, "old", 1_000_000_000);
    writeSession(projectDir, "new", 2_000_000_000);
    const list = listSessions(projectCwd);
    expect(list.map((s) => s.sessionId)).toEqual(["new", "old"]);
    expect(list.every((s) => s.matchKind === "exact")).toBe(true);
  });

  it("by default ignores parent-dir sessions", () => {
    writeSession(parentDir, "parent-only", 1_000_000_000);
    expect(listSessions(projectCwd)).toEqual([]);
  });

  it("includeParents merges parent-dir sessions, marking them", () => {
    writeSession(projectDir, "exact-one", 2_000_000_000);
    writeSession(parentDir, "parent-one", 1_500_000_000);
    const list = listSessions(projectCwd, { includeParents: true });
    expect(list).toHaveLength(2);
    expect(list[0].sessionId).toBe("exact-one");
    expect(list[0].matchKind).toBe("exact");
    expect(list[1].sessionId).toBe("parent-one");
    expect(list[1].matchKind).toBe("parent");
  });

  it("activeSession prefers exact, falls back to parent", () => {
    writeSession(parentDir, "parent-only", 1_000_000_000);
    const active = activeSession(projectCwd);
    expect(active?.sessionId).toBe("parent-only");
    expect(active?.matchKind).toBe("parent");
  });

  it("activeSession returns exact when present even if parent newer", () => {
    writeSession(projectDir, "exact-old", 1_000_000_000);
    writeSession(parentDir, "parent-new", 2_000_000_000);
    const active = activeSession(projectCwd);
    expect(active?.sessionId).toBe("exact-old");
    expect(active?.matchKind).toBe("exact");
  });

  it("sessionAtTime returns null when no session within tolerance", () => {
    writeSession(projectDir, "one", 1_000_000_000);
    const farFuture = 1_000_000_000 * 1000 + 24 * 60 * 60 * 1000;
    const chosen = sessionAtTime(projectCwd, farFuture);
    expect(chosen).toBeNull();
  });

  it("sessionAtTime picks closest session inside tolerance", () => {
    const base = 1_500_000_000;
    writeSession(projectDir, "near", base);
    writeSession(projectDir, "far", base + 7200);
    const target = base * 1000 + 5 * 60 * 1000;
    const chosen = sessionAtTime(projectCwd, target);
    expect(chosen?.sessionId).toBe("near");
  });

  it("sessionAtTime falls back to parent-dir sessions", () => {
    const base = 1_500_000_000;
    writeSession(parentDir, "parent-near", base);
    const target = base * 1000 + 5 * 60 * 1000;
    const chosen = sessionAtTime(projectCwd, target);
    expect(chosen?.sessionId).toBe("parent-near");
    expect(chosen?.matchKind).toBe("parent");
  });
});
