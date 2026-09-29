/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { newTeam } from "../src/domain/catalog";
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
