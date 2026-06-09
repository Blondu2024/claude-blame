import { describe, it, expect } from "vitest";
import { encodeCwd, projectSessionDirCandidates } from "./paths.js";

describe("encodeCwd", () => {
  it("replaces backslashes and colons with dashes", () => {
    expect(encodeCwd("C:\\Users\\MEDION\\creazaapp")).toBe(
      "C--Users-MEDION-creazaapp",
    );
  });
  it("handles forward slashes (POSIX paths)", () => {
    expect(encodeCwd("/home/user/proj")).toBe("-home-user-proj");
  });
});

describe("projectSessionDirCandidates", () => {
  it("returns multiple casing variants", () => {
    const out = projectSessionDirCandidates("C:\\Users\\MEDION");
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.some((p) => p.includes("C--Users-MEDION"))).toBe(true);
    expect(out.some((p) => p.includes("c--Users-MEDION"))).toBe(true);
  });
});
