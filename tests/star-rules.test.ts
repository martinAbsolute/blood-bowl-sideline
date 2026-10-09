import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getRoster, newTeam, rosters, stars } from "../src/domain/catalog";
import { starEligible, summarize, validateTeam } from "../src/domain/rules";
import type { RulesetId } from "../src/domain/types";

function draft(rulesetId: RulesetId, rosterId = "human") {
  const team = newTeam(randomUUID(), rosterId);
  team.rulesetId = rulesetId;
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: getRoster(rosterId)!.players[0].id,
    name: "",
    skills: [],
  }));
  return team;
}
const star = (id: string) => stars.find((entry) => entry.id === id)!;
const issues = (team: ReturnType<typeof draft>) =>
  validateTeam(team).issues.map((issue) => issue.code);

describe("verified Star Player ruleset restrictions", () => {
  it.each(["bb2025-sevens", "kyiv-seven-sins-sevens"] as const)(
    "%s excludes every Star Player for every roster and rejects imported hires",
    (rulesetId) => {
      for (const roster of rosters) {
        const team = draft(rulesetId, roster.id);
        expect(
          stars.some((entry) => starEligible(team, entry)),
          roster.id,
        ).toBe(false);
      }
      const team = draft(rulesetId);
      team.stars = ["akhorne-the-squirrel"];
      expect(issues(team)).toContain("starEligibility");
    },
  );

  it("permits exhibition stars while preserving league and god affiliations", () => {
    const team = draft("bb2025-default");
    expect(starEligible(team, star("griff-oberwald"))).toBe(true);
    expect(starEligible(team, star("lord-borak-the-despoiler"))).toBe(false);
    team.rosterId = "chaos-chosen";
    expect(starEligible(team, star("lord-borak-the-despoiler"))).toBe(true);
  });

  it("charges four SP per Mega-star, permits only one, and allows an ordinary partner", () => {
    const team = draft("bb2025-matched-play");
    team.stars = ["griff-oberwald"];
    expect(starEligible(team, star("griff-oberwald"))).toBe(true);
    expect(summarize(team).starTax).toBe(4);
    team.stars.push("akhorne-the-squirrel");
    expect(summarize(team).starTax).toBe(6);
    expect(issues(team)).not.toContain("starLimit");
    team.stars = ["griff-oberwald", "morg-n-thorg"];
    expect(summarize(team).starTax).toBe(8);
    expect(issues(team)).toContain("starLimit");
  });

  it.each([
    ["griff-oberwald", "human"],
    ["hakflem-skuttlespike", "skaven"],
    ["hthark-the-unstoppable", "chaos-dwarf"],
    ["ivan-the-animal-deathshroud", "shambling-undead"],
    ["morg-n-thorg", "human"],
  ])("classifies official Mega-star %s at four SP", (id, rosterId) => {
    const team = draft("bb2025-matched-play", rosterId);
    team.stars = [id];
    expect(starEligible(team, star(id))).toBe(true);
    expect(summarize(team).starTax).toBe(4);
  });

  it("limits tier-one Matched Play to one total choice including Mega-stars and pairs", () => {
    const team = draft("bb2025-matched-play", "amazon");
    team.stars = ["morg-n-thorg", "akhorne-the-squirrel"];
    expect(issues(team)).toContain("starLimit");
    team.stars = ["grak", "crumbleberry"];
    expect(issues(team)).not.toContain("starLimit");
    expect(summarize(team).starTax).toBe(2);
    expect(summarize(team).playerCount).toBe(13);
  });

  it("allows EuroBowl stars only in tiers five to seven and rejects mixed classes", () => {
    const team = draft("eurobowl-2026");
    expect(stars.some((entry) => starEligible(team, entry))).toBe(false);
    team.rosterId = "halfling";
    expect(starEligible(team, star("deeproot-strongbranch"))).toBe(true);
    expect(starEligible(team, star("griff-oberwald"))).toBe(false);
    team.stars = ["deeproot-strongbranch", "akhorne-the-squirrel"];
    expect(issues(team)).toContain("starLimit");
  });

  it("enforces the World Cup roster allowlist, banned stars and eleven regular hires", () => {
    const allowed = new Set([
      "black-orc",
      "bretonnian",
      "chaos-renegade",
      "gnome",
      "goblin",
      "halfling",
      "norse",
      "ogre",
      "snotling",
    ]);
    for (const roster of rosters) {
      const team = draft("world-cup-2027", roster.id);
      expect(
        stars.some((entry) => starEligible(team, entry)),
        roster.id,
      ).toBe(allowed.has(roster.id));
    }
    const team = draft("world-cup-2027", "halfling");
    expect(starEligible(team, star("griff-oberwald"))).toBe(false);
    team.stars = ["akhorne-the-squirrel"];
    team.players.pop();
    expect(issues(team)).toContain("regularPlayers");
  });
});
