/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, newTeam } from "../src/domain/catalog";
const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    a: await ctx.db.insert("users", { name: "A" }),
    b: await ctx.db.insert("users", { name: "B" }),
  }));
  return {
    t,
    a: t.withIdentity({ subject: String(ids.a) }),
    b: t.withIdentity({ subject: String(ids.b) }),
  };
}
describe("Convex team ownership and sharing", () => {
  it("a fresh account starts empty even when another coach has saved teams", async () => {
    const { t, a, b } = await setup();
    await a.mutation(api.teams.save, {
      team: newTeam(randomUUID()),
      expectedRevision: 0,
    });
    const args = {
      archived: false,
      paginationOpts: { numItems: 12, cursor: null },
    };
    expect((await b.query(api.teams.listMine, args)).page).toEqual([]);
    await expect(t.query(api.teams.listMine, args)).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });
  it("keeps a complete captain roster in draft until a captain is selected", async () => {
    const { a } = await setup();
    const team = newTeam(randomUUID());
    team.players = Array.from({ length: 11 }, () => ({
      id: randomUUID(),
      positionId: getRoster("human")!.players[0].id,
      name: "",
      skills: [],
    }));
    const draft = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(draft.legal).toBe(false);
    team.captainId = team.players[0].id;
    const ready = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 1,
    });
    expect(ready.legal).toBe(true);
    delete team.captainId;
    const incomplete = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 2,
    });
    expect(incomplete.legal).toBe(false);
  });
  it("requires sign-in for writes and computes draft legality on the server", async () => {
    const { t, a } = await setup(),
      team = newTeam(randomUUID());
    await expect(
      t.mutation(api.teams.save, { team, expectedRevision: 0 }),
    ).rejects.toThrow("UNAUTHENTICATED");
    const saved = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(saved.legal).toBe(false);
    expect(saved.revision).toBe(1);
  });
  it("exposes only the public projection and prevents another user changing it", async () => {
    const { t, a, b } = await setup(),
      team = newTeam(randomUUID());
    await a.mutation(api.teams.save, { team, expectedRevision: 0 });
    const shared = await t.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(shared?.canEdit).toBe(false);
    expect(Object.keys(shared!)).toEqual(
      expect.arrayContaining([
        "team",
        "revision",
        "legal",
        "updatedAt",
        "canEdit",
      ]),
    );
    expect(shared).not.toHaveProperty("ownerId");
    expect(
      (await a.query(api.teams.getByUuid, { uuid: team.uuid }))?.canEdit,
    ).toBe(true);
    await expect(
      b.mutation(api.teams.save, { team, expectedRevision: 1 }),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("rejects stale edits rather than overwriting a newer roster", async () => {
    const { a } = await setup(),
      team = newTeam(randomUUID());
    await a.mutation(api.teams.save, { team, expectedRevision: 0 });
    await a.mutation(api.teams.save, {
      team: { ...team, name: "Updated" },
      expectedRevision: 1,
    });
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 1 }),
    ).rejects.toThrow("CONFLICT");
  });
  it("archives reversibly, hides public links, and isolates account listings", async () => {
    const { t, a, b } = await setup(),
      team = newTeam(randomUUID());
    await a.mutation(api.teams.save, { team, expectedRevision: 0 });
    await expect(
      b.mutation(api.teams.setArchived, { uuid: team.uuid, archived: true }),
    ).rejects.toThrow("FORBIDDEN");
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: true,
    });
    expect(await t.query(api.teams.getByUuid, { uuid: team.uuid })).toBeNull();
    expect(
      (
        await a.query(api.teams.listMine, {
          archived: true,
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(1);
    expect(
      (
        await b.query(api.teams.listMine, {
          archived: true,
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(0);
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: false,
    });
    expect(
      await t.query(api.teams.getByUuid, { uuid: team.uuid }),
    ).not.toBeNull();
  });
});

describe("Account library search and filters", () => {
  it("searches beyond the first page, combining owner, archive, roster and ruleset restrictions", async () => {
    const { a, b } = await setup();
    const target = {
      ...newTeam(randomUUID(), "goblin"),
      name: "Needle Squad",
      coach: "Olexandr",
      rulesetId: "eurobowl-2026" as const,
    };
    await a.mutation(api.teams.save, { team: target, expectedRevision: 0 });
    for (let i = 0; i < 20; i++)
      await a.mutation(api.teams.save, {
        team: newTeam(randomUUID(), "dwarf"),
        expectedRevision: 0,
      });
    await b.mutation(api.teams.save, {
      team: { ...target, uuid: randomUUID() },
      expectedRevision: 0,
    });
    const args = {
      archived: false,
      search: "Needle",
      rosterId: "goblin",
      rulesetId: "eurobowl-2026" as const,
      paginationOpts: { numItems: 12, cursor: null },
    };
    expect(
      (await a.query(api.teams.listMine, args)).page.map((d) => d.team.uuid),
    ).toEqual([target.uuid]);
    expect(
      (await a.query(api.teams.listMine, { ...args, search: "Olex" })).page.map(
        (d) => d.team.uuid,
      ),
    ).toEqual([target.uuid]);
    expect(
      (await a.query(api.teams.listMine, { ...args, rosterId: "dwarf" })).page,
    ).toEqual([]);
    expect(
      (await a.query(api.teams.listMine, { ...args, search: "" })).page.map(
        (d) => d.team.uuid,
      ),
    ).toEqual([target.uuid]);
    await a.mutation(api.teams.setArchived, {
      uuid: target.uuid,
      archived: true,
    });
    expect((await a.query(api.teams.listMine, args)).page).toEqual([]);
    expect(
      (await a.query(api.teams.listMine, { ...args, archived: true })).page,
    ).toHaveLength(1);
  });
});
