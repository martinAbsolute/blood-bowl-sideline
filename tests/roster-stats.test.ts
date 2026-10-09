import { describe, expect, it } from "vitest";
import { rosters } from "../src/domain/catalog";
import audit from "./fixtures/roster-profiles-bb2025.json";
import fumbbl from "./fixtures/fumbbl-roster-profiles-bb2025.json";

// Extracted from external roster tables, not from the application catalog.
// Source conflicts and the FUMBBL browser comparison are documented in
// docs/roster-stat-audit.md.
describe("verified BB2025 regular player profiles", () => {
  const players = rosters.flatMap((roster) => roster.players);

  it("covers all 163 positions across all 31 rosters exactly once", () => {
    expect(rosters).toHaveLength(31);
    expect(audit.profiles).toHaveLength(163);
    expect(audit.profiles.map((profile) => profile.id).sort()).toEqual(
      players.map((player) => player.id).sort(),
    );
  });

  it.each(audit.profiles)(
    "matches characteristics, cost, quantity, and skill access for $id",
    ({ sources, skills, primarySkills, secondarySkills, ...expected }) => {
      const player = players.find((candidate) => candidate.id === expected.id)!;
      expect(sources).toHaveLength(2);
      expect(player).toMatchObject(expected);
      expect([...player.skills].sort()).toEqual(skills);
      expect([...player.primarySkills].sort()).toEqual(primarySkills);
      expect([...player.secondarySkills].sort()).toEqual(secondarySkills);
    },
  );

  it("keeps unavailable PA only on the six confirmed positions", () => {
    expect(
      players
        .filter((player) => player.pa === "-")
        .map((player) => player.id)
        .sort(),
    ).toEqual([
      "dwarf-4",
      "gnome-1",
      "goblin-1",
      "goblin-5",
      "necromantic-horror-2",
      "norse-1",
    ]);
  });

  it("requires an armour target for every regular position", () => {
    for (const player of players) {
      expect(player.av, player.id).toMatch(/^\d+\+$/);
    }
  });

  it("matches independently captured reroll costs and apothecary access for every roster", () => {
    expect(audit.teamProfiles.map(({ id }) => id).sort()).toEqual(
      rosters.map(({ id }) => id).sort(),
    );
    for (const { source, ...expected } of audit.teamProfiles) {
      expect(source).toMatch(/^https:\/\/bbtc.pl\/roster\/bb2025\//);
      expect(rosters.find(({ id }) => id === expected.id)).toMatchObject(
        expected,
      );
    }
    expect(fumbbl.teamProfiles.map(({ id }) => id).sort()).toEqual(
      rosters
        .filter(({ id }) => id !== "slann")
        .map(({ id }) => id)
        .sort(),
    );
    for (const { id, rerollCost, apothecary, tier } of fumbbl.teamProfiles) {
      expect(rosters.find((roster) => roster.id === id)).toMatchObject({
        rerolls: { cost: rerollCost },
        apothecary,
        tier,
      });
    }
  });

  it("covers all 159 FUMBBL positions and explicitly resolves every disagreement", () => {
    const standardPlayers = players.filter(
      (player) => !player.id.startsWith("slann-"),
    );
    expect(fumbbl.profiles.map((profile) => profile.id).sort()).toEqual(
      standardPlayers.map((player) => player.id).sort(),
    );
    const disagreements: string[] = [];
    for (const { id, source, ...observed } of fumbbl.profiles) {
      expect(source).toMatch(/^https:\/\/fumbbl.com\/help:BB25/);
      const player = standardPlayers.find((candidate) => candidate.id === id)!;
      for (const [field, value] of Object.entries(observed)) {
        const actual = player[field as keyof typeof player];
        const normalized = Array.isArray(actual) ? [...actual].sort() : actual;
        const resolution = fumbbl.resolutions.find(
          (entry) => entry.id === id && entry.field === field,
        );
        if (resolution) {
          expect(value).toEqual(resolution.observed);
          expect(normalized).toEqual(resolution.accepted);
          expect(normalized).not.toEqual(value);
          expect(resolution.corroboratingSource).toMatch(/^https:\/\//);
          disagreements.push(`${id}:${field}`);
        } else {
          expect(normalized, `${id}:${field}`).toEqual(value);
        }
      }
    }
    expect(disagreements.sort()).toEqual(
      fumbbl.resolutions.map(({ id, field }) => `${id}:${field}`).sort(),
    );
    expect(disagreements).toHaveLength(12);
  });
});
