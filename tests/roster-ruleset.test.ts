import { describe, expect, it } from "vitest";
import { rosterReferenceHref, rosterRuleset } from "../src/lib/roster-ruleset";

describe("roster reference ruleset navigation", () => {
  it("falls back to default for absent, unknown or repeated query values", () => {
    for (const value of [
      undefined,
      "unknown",
      ["kyiv-seven-sins-sevens", "eurobowl-2026"],
    ])
      expect(rosterRuleset(value)).toBe("bb2025-default");
  });
  it("preserves an allowed ruleset across roster details and the return link", () => {
    const ruleset = rosterRuleset("kyiv-seven-sins-sevens");
    expect(rosterReferenceHref("human", ruleset)).toBe(
      "/rosters/human?ruleset=kyiv-seven-sins-sevens",
    );
    expect(rosterReferenceHref(undefined, ruleset)).toBe(
      "/rosters?ruleset=kyiv-seven-sins-sevens",
    );
    expect(rosterReferenceHref("human", "bb2025-default")).toBe(
      "/rosters/human",
    );
  });
});
