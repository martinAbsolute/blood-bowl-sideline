/// <reference types="vite/client" />
import { randomUUID } from "node:crypto";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { getRoster, newTeam } from "../src/domain/catalog";
import { PREVIOUS_RULES_VERSION, RULES_VERSION } from "../src/domain/types";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup(incompatible = false, customBudget = false) {
  const t = convexTest(schema, modules);
  const team = newTeam(randomUUID());
  team.rulesVersion = PREVIOUS_RULES_VERSION;
  team.players = Array.from({ length: 11 }, () => ({
    id: randomUUID(),
    positionId: getRoster("human")!.players[0].id,
    name: "",
    skills: [] as string[],
  }));
  team.captainId = team.players[0].id;
  if (incompatible) team.players[1].skills = ["bullseye"];
  if (customBudget)
    team.staff = {
      rerolls: 8,
      apothecary: 1,
      assistantCoaches: 6,
      cheerleaders: 6,
      dedicatedFans: 0,
    };
  const result = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner" });
    const strangerId = await ctx.db.insert("users", { name: "Stranger" });
    const draftLeagueId = customBudget
      ? await ctx.db.insert("leagues", {
          name: "Draft league",
          ownerId,
          commissionerName: "Owner",
          status: "registration",
          rulesVersion: PREVIOUS_RULES_VERSION,
          startAt: 1,
          roundDays: 7,
          startingTreasury: 1250000,
          activeRound: null,
          updatedAt: 1,
        })
      : undefined;
    const teamId = await ctx.db.insert("teams", {
      uuid: team.uuid,
      ownerId,
      team,
      revision: 7,
      legal: true,
      updatedAt: 1,
      archived: false,
      searchText: "Legacy Human",
      favorite: true,
      draftLeagueId,
    });
    return { ownerId, strangerId, teamId };
  });
  return {
    t,
    team,
    teamId: result.teamId,
    owner: t.withIdentity({ subject: result.ownerId }),
    stranger: t.withIdentity({ subject: result.strangerId }),
  };
}

it("reads an existing snapshot under corrected rules without mutating or falsely certifying it", async () => {
  const { t, owner, team, teamId } = await setup(true);
  const viewed = await t.query(api.teams.getByUuid, { uuid: team.uuid });
  expect(viewed).toMatchObject({
    team: { ...team, rulesVersion: RULES_VERSION },
    revision: 7,
    legal: false,
    canEdit: false,
  });
  const library = await owner.query(api.teams.listMine, {
    archived: false,
    paginationOpts: { numItems: 12, cursor: null },
  });
  expect(library.page[0]).toMatchObject({
    team: viewed?.team,
    legal: false,
    canEdit: true,
    favorite: true,
  });
  expect(await t.run((ctx) => ctx.db.get("teams", teamId))).toMatchObject({
    team,
    revision: 7,
    legal: true,
  });
  await expect(
    owner.mutation(api.teams.save, { team, expectedRevision: 7 }),
  ).rejects.toThrow("INVALID_TEAM");
  expect(await t.run((ctx) => ctx.db.get("teams", teamId))).toMatchObject({
    team,
    revision: 7,
  });
});

it("preserves ownership and revisions when a legacy team is repaired and saved", async () => {
  const { t, owner, stranger, team, teamId } = await setup(true);
  team.players[1].skills = [];
  await expect(
    stranger.mutation(api.teams.save, { team, expectedRevision: 7 }),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    owner.mutation(api.teams.save, { team, expectedRevision: 6 }),
  ).rejects.toThrow("CONFLICT");
  const saved = await owner.mutation(api.teams.save, {
    team,
    expectedRevision: 7,
  });
  expect(saved).toMatchObject({
    team: { ...team, rulesVersion: RULES_VERSION },
    legal: true,
    revision: 8,
    favorite: true,
  });
  const retry = await owner.mutation(api.teams.save, {
    team,
    expectedRevision: 7,
  });
  expect(retry.revision).toBe(8);
  expect(await t.run((ctx) => ctx.db.get("teams", teamId))).toMatchObject({
    team: saved.team,
    revision: 8,
  });
});

it("rechecks old drafts using their stored league treasury allowance", async () => {
  const { t, team } = await setup(false, true);
  expect((await t.query(api.teams.getByUuid, { uuid: team.uuid }))?.legal).toBe(
    true,
  );
});

it("removes an obsolete invalid badge when the corrected elite-copy rule permits the roster", async () => {
  const { t, team, teamId } = await setup();
  team.rulesetId = "bb2025-matched-play";
  team.players.slice(0, 4).forEach((player) => {
    player.skills = ["block"];
  });
  team.players.slice(4, 6).forEach((player) => {
    player.skills = ["dodge"];
  });
  await t.run((ctx) => ctx.db.patch("teams", teamId, { team, legal: false }));
  const viewed = await t.query(api.teams.getByUuid, { uuid: team.uuid });
  expect(viewed).toMatchObject({
    legal: true,
    revision: 7,
    team: { rulesVersion: RULES_VERSION },
  });
  expect(await t.run((ctx) => ctx.db.get("teams", teamId))).toMatchObject({
    legal: false,
    team: { rulesVersion: PREVIOUS_RULES_VERSION },
  });
});
