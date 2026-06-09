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
import { listSessions, activeSession, sessionAtTime } from "./sessions.js";

let fakeHome: string;
let projectCwd: string;
let projectDir: string;

beforeEach(() => {
  fakeHome = mkdtempSync(join(tmpdir(), "git-why-home-"));
  vi.spyOn({ homedir }, "homedir").mockReturnValue(fakeHome);
  // Patch process env so any indirect lookups behave
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;

  projectCwd = "C:\\Users\\Test\\proj";
  projectDir = join(fakeHome, ".claude", "projects", "C--Users-Test-proj");
  mkdirSync(projectDir, { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (fakeHome && existsSync(fakeHome)) {
    rmSync(fakeHome, { recursive: true, force: true });
  }
});

function writeSession(id: string, mtimeSeconds: number, content = "") {
  const p = join(projectDir, `${id}.jsonl`);
  writeFileSync(p, content || `{"sessionId":"${id}"}\n`);
  utimesSync(p, mtimeSeconds, mtimeSeconds);
  return p;
}

describe("sessions", () => {
  it("returns empty list when project dir missing", () => {
    expect(listSessions("C:\\Users\\Test\\nonexistent")).toEqual([]);
  });

  it("lists sessions sorted by mtime desc", () => {
    writeSession("old", 1_000_000_000);
    writeSession("new", 2_000_000_000);
    writeSession("mid", 1_500_000_000);
    const list = listSessions(projectCwd);
    expect(list.map((s) => s.sessionId)).toEqual(["new", "mid", "old"]);
  });

  it("activeSession returns most recent", () => {
    writeSession("a", 1_000_000_000);
    writeSession("b", 2_000_000_000);
    const active = activeSession(projectCwd);
    expect(active?.sessionId).toBe("b");
  });

  it("sessionAtTime picks closest session", () => {
    writeSession("a", 1_000_000_000);
    writeSession("b", 1_500_000_000);
    writeSession("c", 2_000_000_000);
    const chosen = sessionAtTime(projectCwd, 1_490_000_000 * 1000);
    expect(chosen?.sessionId).toBe("b");
  });
});
