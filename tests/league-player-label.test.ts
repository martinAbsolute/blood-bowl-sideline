import { describe, expect, it } from "vitest";
import {
  leaguePlayerLabel,
  leaguePlayerNumbers,
  snapshotPlayerNumber,
} from "../src/lib/league-player-label";

describe("league player identification", () => {
  it("labels unnamed players by their canonical roster slot and position", () => {
    expect(leaguePlayerLabel("", "Human Lineman", 1)).toBe("#1 Human Lineman");
    expect(leaguePlayerLabel("   ", "Human Lineman", 2)).toBe(
      "#2 Human Lineman",
    );
    expect(leaguePlayerLabel("  Griff  ", "Human Blitzer", 3)).toBe("Griff");
  });

  it("numbers each team separately before table sorting and retains historical players", () => {
    const canonical = [
      { id: "retired-home", entryId: "home" },
      { id: "away-a", entryId: "away" },
      { id: "home-active", entryId: "home" },
      { id: "away-b", entryId: "away" },
    ];
    const numbers = leaguePlayerNumbers(canonical);
    expect(numbers.get("home-active")).toBe(2);
    expect(numbers.get("away-a")).toBe(1);
    expect(numbers.get("away-b")).toBe(2);
    const afterHire = leaguePlayerNumbers([
      ...canonical,
      { id: "new-hire", entryId: "home" },
    ]);
    expect(afterHire.get("home-active")).toBe(numbers.get("home-active"));
    expect(afterHire.get("new-hire")).toBe(3);
  });

  it("uses frozen roster order when report rows omit an unavailable player", () => {
    const frozen = [{ id: "first" }, { id: "second" }, { id: "third" }];
    expect(snapshotPlayerNumber("third", frozen, 2)).toBe(3);
    expect(snapshotPlayerNumber("missing", frozen, 4)).toBe(4);
    expect(snapshotPlayerNumber("third", undefined, 2)).toBe(2);
  });
});
