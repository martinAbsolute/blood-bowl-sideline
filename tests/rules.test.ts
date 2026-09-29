import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  getRoster,
  newTeam,
  rosters,
  rulesets,
  skills,
  stars,
  inducements,
} from "../src/domain/catalog";
import {
  budgetFor,
  inducementInfo,
  playerSkillCost,
  starEligible,
  summarize,
  validateTeam,
} from "../src/domain/rules";
import type { Team } from "../src/domain/types";
function human(rulesetId: Team["rulesetId"] = "bb2025-default"): Team {
  const team = newTeam(randomUUID());
  team.rulesetId = rulesetId;
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: getRoster("human")!.players[0].id,
    name: "",
    skills: [],
  }));
  return team;
}
const codes = (t: Team) => validateTeam(t).issues.map((i) => i.code);
describe("BB2025 roster checks", () => {
  it("accepts a basic eleven-player team and calculates from catalog costs", () => {
    const t = human();
    t.staff.rerolls = 2;
    expect(validateTeam(t).valid).toBe(true);
    expect(summarize(t).teamGold).toBe(
      getRoster("human")!.players[0].cost * 11 +
        getRoster("human")!.rerolls.cost * 2,
    );
  });
  it("rejects incomplete, oversized, and duplicated player identities", () => {
    const t = human();
    t.players.pop();
    expect(codes(t)).toContain("minPlayers");
    t.players = Array.from({ length: 17 }, () => t.players[0]);
    expect(codes(t)).toContain("invalidData");
    t.players = Array.from({ length: 11 }, () => t.players[0]);
    expect(codes(t)).toContain("duplicatePlayer");
  });
  it("rejects positions and skills from another roster", () => {
    const t = human();
    t.players[0].positionId = "fake";
    expect(codes(t)).toContain("unknownPosition");
    t.players[0].positionId = getRoster("human")!.players[0].id;
    t.players[0].skills = ["not-a-skill"];
    expect(codes(t)).toContain("skillAccess");
  });
  it("enforces positional maximums", () => {
    const t = human();
    const p = getRoster("human")!.players.find((p) => p.qty === "0-2")!;
    t.players.slice(0, 3).forEach((x) => (x.positionId = p.id));
    expect(codes(t)).toContain("positionLimit");
  });
  it("validates a free captain without changing gold or skill allowance", () => {
    const t = human("bb2025-matched-play"),
      before = summarize(t);
    t.captainId = t.players[0].id;
    expect(codes(t)).not.toContain("captain");
    expect(summarize(t).teamGold).toBe(before.teamGold);
    t.players[0].skills = ["pro"];
    expect(codes(t)).toContain("captain");
    t.captainId = randomUUID();
    expect(codes(t)).toContain("captain");
  });
  it("retains invalid selections when changing presets", () => {
    const t = human();
    t.players[0].skills = ["block", "tackle"];
    expect(codes(t)).not.toContain("maxSkills");
    t.rulesetId = "bb2025-matched-play";
    expect(codes(t)).toContain("maxSkills");
    expect(t.players[0].skills).toHaveLength(2);
  });
  it("gives every supported roster a defined tier budget for all presets", () => {
    for (const r of rosters)
      for (const rules of rulesets) {
        const t = newTeam(randomUUID(), r.id);
        t.rulesetId = rules.id;
        expect(budgetFor(t), `${r.id}/${rules.id}`).toBeDefined();
        expect(Number.isFinite(summarize(t).teamGold)).toBe(true);
      }
  });
  it("uses unique stable catalog IDs and complete numeric data", () => {
    for (const data of [rosters, stars, skills, inducements])
      expect(new Set(data.map((x) => x.id)).size).toBe(data.length);
    for (const r of rosters)
      for (const p of r.players) {
        expect(p.cost).toBeGreaterThan(0);
        expect(Number(p.qty.split("-")[1])).toBeGreaterThan(0);
      }
  });
});
describe("Tournament currencies and restrictions", () => {
  it("counts paired stars as one choice and charges their SP tax once", () => {
    const t = human("bb2025-matched-play");
    t.stars = ["grak", "crumbleberry"];
    expect(summarize(t).starTax).toBe(2);
    expect(codes(t)).not.toContain("starLimit");
    expect(summarize(t).playerCount).toBe(13);
    expect(summarize(t).starGold).toBe(250000);
  });
  it("prices Matched primary/secondary and checks the four-elite cap", () => {
    const t = human("bb2025-matched-play"),
      p = getRoster("human")!.players[0];
    expect(playerSkillCost(t, p, ["block"])).toBe(1);
    expect(playerSkillCost(t, p, ["dodge"])).toBe(2);
    const elite = skills.find((s) => s.category === "general" && s.isElite)!;
    t.players.slice(0, 5).forEach((p) => (p.skills = [elite.id]));
    expect(codes(t)).toContain("eliteLimit");
  });
  it("prices Euro primary stacks and rejects secondary stacks", () => {
    const t = human("eurobowl-2026"),
      p = getRoster("human")!.players[0];
    const primary = skills
      .filter((s) => s.category === "general" && !s.isElite)
      .slice(0, 2);
    expect(
      playerSkillCost(
        t,
        p,
        primary.map((s) => s.id),
      ),
    ).toBe(50000);
    t.players[0].skills = ["block", "dodge"];
    expect(codes(t)).toContain("primaryStack");
  });
  it("shares Euro Flowing Funds between roster and skills overspending", () => {
    const t = human("eurobowl-2026");
    t.staff.rerolls = 8;
    t.staff.assistantCoaches = 6;
    t.staff.cheerleaders = 6;
    t.players.forEach((p) => (p.skills = ["block", "tackle"]));
    const s = summarize(t);
    expect(s.fundsUsed).toBe(
      Math.max(0, s.teamGold - s.budget.teamBudget) +
        Math.max(0, s.skills - s.budget.skillGold),
    );
    expect(codes(t)).toContain("flowingFunds");
  });
  it("prices ordered World Cup advancements at their successive costs", () => {
    const t = human("world-cup-2027"),
      p = getRoster("human")!.players[0];
    const a = skills
      .filter((s) => s.category === "general" && !s.isElite)
      .slice(0, 2);
    expect(
      playerSkillCost(
        t,
        p,
        a.map((s) => s.id),
      ),
    ).toBe(14);
    t.players.slice(0, 2).forEach((p) => (p.skills = a.map((s) => s.id)));
    expect(codes(t)).toContain("stackLimit");
  });
  it("uses cumulative World Cup star tax and requires eleven regular players", () => {
    const t = newTeam(randomUUID(), "halfling");
    t.rulesetId = "world-cup-2027";
    const eligible = stars.filter((s) => starEligible(t, s));
    t.stars = eligible.slice(0, 2).map((s) => s.id);
    const sum = eligible.slice(0, 2).reduce((n, s) => n + s.cost, 0);
    expect(summarize(t).starTax).toBe(
      sum <= 199000 ? 18 : sum <= 299000 ? 24 : 32,
    );
    expect(codes(t)).toContain("regularPlayers");
  });
  it("applies cheap bribes and rejects unavailable inducements", () => {
    const t = newTeam(randomUUID(), "goblin"),
      bribes = inducements.find((i) => i.id === "bribes")!;
    expect(inducementInfo(t, bribes).cost).toBe(50000);
    t.inducements = { "wandering-apothecary": 1 };
    t.rosterId = "shambling-undead";
    expect(codes(t)).toContain("inducementEligibility");
  });
  it("rejects unpaired stars and forbidden affiliations", () => {
    const t = human();
    t.stars = ["grak"];
    expect(codes(t)).toContain("starPair");
    t.rosterId = "chaos-chosen";
    t.favouredOf = "Hashut";
    expect(codes(t)).toContain("affiliation");
  });
});
