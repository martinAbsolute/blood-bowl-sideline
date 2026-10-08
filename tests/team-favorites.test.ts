/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { newTeam } from "../src/domain/catalog";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const [owner, other] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { name: "Owner" }),
    await ctx.db.insert("users", { name: "Other", role: "admin" }),
  ]);
  return {
    t,
    owner: t.withIdentity({ subject: owner }),
    other: t.withIdentity({ subject: other }),
  };
}

it("persists a guest favorite on upload and protects it from stale roster saves", async () => {
  const { t, owner, other } = await setup();
  const team = newTeam(randomUUID());
  const first = await owner.mutation(api.teams.save, {
    team,
    expectedRevision: 0,
    favorite: true,
  });
  expect(first.favorite).toBe(true);
  expect(
    (await owner.query(api.teams.getByUuid, { uuid: team.uuid }))?.favorite,
  ).toBe(true);
  expect(
    (await t.query(api.teams.getByUuid, { uuid: team.uuid }))?.favorite,
  ).toBeUndefined();
  expect(
    (await other.query(api.teams.getByUuid, { uuid: team.uuid }))?.favorite,
  ).toBeUndefined();
  const edited = await owner.mutation(api.teams.save, {
    team: { ...team, name: "Edited roster" },
    expectedRevision: first.revision,
    favorite: false,
  });
  expect(edited.favorite).toBe(true);
  await owner.mutation(api.teams.setFavorite, {
    uuid: team.uuid,
    favorite: false,
  });
  const saved = await owner.mutation(api.teams.save, {
    team: edited.team,
    expectedRevision: edited.revision,
    favorite: true,
  });
  expect(saved.favorite).toBeUndefined();
});

it("requires ownership, rejects archived teams, and blocks archiving until unfavorited", async () => {
  const { t, owner, other } = await setup();
  const team = newTeam(randomUUID());
  await owner.mutation(api.teams.save, { team, expectedRevision: 0 });
  const args = { uuid: team.uuid, favorite: true };
  await expect(t.mutation(api.teams.setFavorite, args)).rejects.toThrow(
    "UNAUTHENTICATED",
  );
  await expect(other.mutation(api.teams.setFavorite, args)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    owner.mutation(api.teams.setFavorite, { ...args, uuid: "bad" }),
  ).rejects.toThrow("INVALID_INPUT");
  await owner.mutation(api.teams.setFavorite, args);
  await owner.mutation(api.teams.setFavorite, args);
  expect(
    (await owner.query(api.teams.getByUuid, { uuid: team.uuid }))?.revision,
  ).toBe(1);
  await expect(
    owner.mutation(api.teams.setArchived, { uuid: team.uuid, archived: true }),
  ).rejects.toThrow("TEAM_FAVORITED");
  await owner.mutation(api.teams.setFavorite, { ...args, favorite: false });
  await owner.mutation(api.teams.setArchived, {
    uuid: team.uuid,
    archived: true,
  });
  await expect(owner.mutation(api.teams.setFavorite, args)).rejects.toThrow(
    "ARCHIVED",
  );
  await owner.mutation(api.teams.setArchived, {
    uuid: team.uuid,
    archived: false,
  });
  expect(
    (await owner.query(api.teams.getByUuid, { uuid: team.uuid }))?.favorite,
  ).toBeUndefined();
});

it("pages old favorites before newer teams for every roster/ruleset filter, without duplicates", async () => {
  const { owner } = await setup();
  const teams = Array.from({ length: 7 }, (_, n) => ({
    ...newTeam(randomUUID()),
    name: `Humans ${n}`,
  }));
  for (const team of teams)
    await owner.mutation(api.teams.save, { team, expectedRevision: 0 });
  for (const team of teams.slice(0, 2))
    await owner.mutation(api.teams.setFavorite, {
      uuid: team.uuid,
      favorite: true,
    });
  for (const filter of [
    {},
    { rosterId: "human" },
    { rulesetId: teams[0].rulesetId },
    { rosterId: "human", rulesetId: teams[0].rulesetId },
  ]) {
    const uuids: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: FunctionReturnType<typeof api.teams.listMine> =
        await owner.query(api.teams.listMine, {
          archived: false,
          ...filter,
          paginationOpts: { numItems: 2, cursor },
        });
      uuids.push(...page.page.map((row) => row.team.uuid));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(uuids.slice(0, 2)).toEqual([teams[1].uuid, teams[0].uuid]);
    expect(new Set(uuids).size).toBe(teams.length);
    expect(uuids).toHaveLength(teams.length);
  }
});

it("finds matching favorites independently of search relevance and keeps account scope", async () => {
  const { owner, other } = await setup();
  const favorite = { ...newTeam(randomUUID()), name: "Favorite Humans" };
  const regular = { ...newTeam(randomUUID()), name: "Regular Humans" };
  await owner.mutation(api.teams.save, {
    team: favorite,
    expectedRevision: 0,
    favorite: true,
  });
  await owner.mutation(api.teams.save, { team: regular, expectedRevision: 0 });
  const args = {
    archived: false,
    search: "Humans",
    favoritesOnly: true,
    paginationOpts: { numItems: 1, cursor: null },
  };
  expect(
    (await owner.query(api.teams.listMine, args)).page.map(
      (row) => row.team.uuid,
    ),
  ).toEqual([favorite.uuid]);
  expect((await other.query(api.teams.listMine, args)).page).toEqual([]);
  expect(
    (await owner.query(api.teams.listMine, { ...args, rosterId: "dwarf" }))
      .page,
  ).toEqual([]);
});
