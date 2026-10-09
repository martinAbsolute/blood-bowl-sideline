import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { newTeam, rosters, rulesets, stars } from "../src/domain/catalog";
import {
  serializeTeamStructuredData,
  teamStructuredData,
} from "../src/lib/team-structured-data";
import type { Team } from "../src/domain/types";

const saved = (team: Team) => ({
  team,
  revision: 3,
  legal: false,
  updatedAt: Date.UTC(2026, 9, 9),
  leagueLocked: false,
  leagueExperienced: false,
  // These must never be serialized, even if returned by a future query.
  canEdit: true,
  favorite: true,
  ownerId: "private-owner",
  draftLeagueId: "private-league",
});

it("expands a saved roster with named skills, stats, staff, inducements and explicit cost units", () => {
  const team = newTeam(randomUUID(), "orc");
  team.name = "Orcland Raiders";
  team.notes = "Private recovery notes";
  team.players = [
    { id: randomUUID(), name: "Gruk", positionId: "orc-3", skills: ["guard"] },
  ];
  team.captainId = team.players[0].id;
  team.staff.rerolls = 2;
  team.staff.apothecary = 1;
  team.inducements["blitzers-best-kegs"] = 2;
  team.stars = [stars[0].id];
  const data = saved(team);
  const result = teamStructuredData(data);
  const snapshot = result.mainEntity.teamSnapshot;
  expect(result).toMatchObject({
    "@type": "WebPage",
    dateModified: "2026-10-09T00:00:00.000Z",
    mainEntity: {
      "@type": "SportsTeam",
      identifier: team.uuid,
      name: team.name,
    },
  });
  expect(result.mainEntity.athlete).toHaveLength(2);
  expect(snapshot).toMatchObject({
    revision: 3,
    legal: false,
    roster: { id: "orc", name: "Orc" },
    ruleset: { id: "bb2025-default", skillCurrency: "gold pieces" },
    summary: {
      playerCount: 2,
      staffCost: { value: 170000, unit: "gold pieces" },
      inducementsCost: { value: 100000, unit: "gold pieces" },
    },
  });
  expect(snapshot.players[0]).toMatchObject({
    number: 1,
    name: "Gruk",
    position: { id: "orc-3" },
    attributes: { strength: 3, agility: "3+" },
    builtInSkills: [
      { id: "block", name: "Block" },
      { id: "break_tackle", name: "Break Tackle" },
    ],
    addedSkills: [{ id: "guard", name: "Guard" }],
    captainSkills: [{ id: "pro", name: "Pro" }],
    captain: true,
    advancementCost: { value: 30000, unit: "gold pieces" },
    cost: { value: 115000, unit: "gold pieces" },
  });
  expect(snapshot.starPlayers[0]).toMatchObject({
    number: 2,
    name: stars[0].name,
  });
  expect(snapshot.staff.find((s) => s.id === "rerolls")).toMatchObject({
    name: "Team re-rolls",
    count: 2,
    purchased: 2,
  });
  const json = serializeTeamStructuredData(data);
  for (const privateField of [
    "notes",
    "canEdit",
    "favorite",
    "ownerId",
    "draftLeagueId",
    "Private recovery notes",
    "private-owner",
    "private-league",
  ]) {
    expect(json).not.toContain(privateField);
  }
  // League-specific allowances are not available to this anonymous query.
  expect(snapshot.summary).not.toHaveProperty("remaining");
  expect(snapshot.summary).not.toHaveProperty("budget");
});

it("uses Sevens veteran movement and free dedicated fans, with SP separate from gold", () => {
  const team = newTeam(randomUUID(), "orc");
  team.rulesetId = "kyiv-seven-sins-sevens";
  team.players = [
    { id: randomUUID(), name: "", positionId: "orc-3", skills: ["guard"] },
  ];
  team.veteranId = team.players[0].id;
  const snapshot = teamStructuredData(saved(team)).mainEntity.teamSnapshot;
  expect(snapshot.players[0]).toMatchObject({
    veteran: true,
    attributes: { movementAllowance: 5 },
    advancementCost: { value: 1, unit: "SP" },
    cost: { value: 85000, unit: "gold pieces" },
  });
  expect(snapshot.staff.find((s) => s.id === "dedicatedFans")).toMatchObject({
    count: 1,
    purchased: 0,
    cost: { value: 0, unit: "gold pieces" },
  });
});

it("resolves parameterized skills and escapes script termination without changing user text", () => {
  const team = newTeam(randomUUID(), "human");
  team.name = '</script><script>alert("team")</script> Київ & Co';
  team.players = [
    {
      id: randomUUID(),
      name: "</script><img src=x onerror=alert(1)>",
      positionId: "human-1",
      skills: ["loner:4+"],
    },
  ];
  const json = serializeTeamStructuredData(saved(team));
  expect(json).not.toContain("<");
  const parsed = JSON.parse(json);
  expect(parsed.mainEntity.name).toBe(team.name);
  expect(parsed.mainEntity.teamSnapshot.players[0].name).toBe(
    team.players[0].name,
  );
  expect(parsed.mainEntity.teamSnapshot.players[0].addedSkills).toEqual([
    { id: "loner:4+", name: "Loner (4+)" },
  ]);
});

it("can describe every catalog roster and ruleset, including empty drafts and stars", () => {
  for (const roster of rosters) {
    for (const ruleset of rulesets) {
      const team = newTeam(randomUUID(), roster.id);
      team.rulesetId = ruleset.id;
      expect(teamStructuredData(saved(team)).mainEntity.athlete).toEqual([]);
      team.players = roster.players.map((p) => ({
        id: randomUUID(),
        positionId: p.id,
        name: "",
        skills: [],
      }));
      team.stars = stars.map((s) => s.id);
      const result = teamStructuredData(saved(team));
      expect(result.mainEntity.athlete).toHaveLength(
        roster.players.length + stars.length,
      );
      expect(serializeTeamStructuredData(saved(team))).not.toContain(
        "undefined",
      );
    }
  }
});
