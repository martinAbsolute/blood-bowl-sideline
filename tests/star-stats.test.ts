import { describe, expect, it } from "vitest";
import { newTeam, stars } from "../src/domain/catalog";
import { summarize } from "../src/domain/rules";
import verifiedStats from "./fixtures/bb2025-star-stats.json";

// Independently transcribed source profiles; see docs/star-stat-audit.md.
describe("verified BB2025 Star Player characteristics", () => {
  it.each([
    { ids: ["dribl", "drull"], cost: 230000 },
    { ids: ["grak", "crumbleberry"], cost: 250000 },
    { ids: ["lucien-swift", "valen-swift"], cost: 300000 },
  ])(
    "charges the published $cost total for paired hire $ids",
    ({ ids, cost }) => {
      const team = newTeam("00000000-0000-4000-8000-000000000001", "lizardmen");
      team.stars = ids;
      expect(summarize(team).starGold).toBe(cost);
    },
  );

  it("retains Black Gobbo's Stunty from the official card", () => {
    expect(
      stars.find((star) => star.id === "the-black-gobbo")?.skills,
    ).toContain("stunty");
  });

  it("covers every catalog star exactly once", () => {
    expect(verifiedStats.map((s) => s.id).sort()).toEqual(
      stars.map((s) => s.id).sort(),
    );
  });

  it.each(verifiedStats)(
    "matches all five characteristics for $id",
    (profile) => {
      const { source, ...expected } = profile;
      expect(source).toMatch(
        /^https:\/\/bloodbowlbase.ru\/bb2025\/starplayers\//,
      );
      expect(stars.find((star) => star.id === profile.id)).toMatchObject(
        expected,
      );
    },
  );

  it("reserves unavailable PA for the seven confirmed No Ball stars", () => {
    expect(
      stars
        .filter((s) => s.pa === "-")
        .map((s) => s.id)
        .sort(),
    ).toEqual([
      "akhorne-the-squirrel",
      "fungus-the-loon",
      "gretchen-wachter",
      "helmut-wulf",
      "kreek-rustgouger",
      "max-spleenripper",
      "nobbla-blackwart",
    ]);
  });
});
