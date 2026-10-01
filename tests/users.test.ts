/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { FunctionReturnType } from "convex/server";
import presenceTest from "@convex-dev/presence/test";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { setAdmin } from "../convex/users";
import { newTeam } from "../src/domain/catalog";
import { sortUsers } from "../src/lib/user-directory";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  presenceTest.register(t);
  const ids = await t.run(async (ctx) => ({
    admin: await ctx.db.insert("users", { name: "Admin", role: "admin" }),
    owner: await ctx.db.insert("users", {
      name: "Owner",
      image: "https://example.com/avatar.png",
    }),
    user: await ctx.db.insert("users", { name: "User", role: "user" }),
  }));
  return {
    t,
    ids,
    admin: t.withIdentity({ subject: ids.admin }),
    owner: t.withIdentity({ subject: ids.owner }),
    user: t.withIdentity({ subject: ids.user }),
  };
}
const paginationOpts = { numItems: 30, cursor: null };
const heartbeatArgs = (userId: string, sessionId = randomUUID()) => ({
  roomId: "sideline",
  userId,
  sessionId,
  interval: 30_000,
});

afterEach(() => vi.useRealTimers());

describe("roles and user directory", () => {
  it("defaults existing accounts to user and only returns the current profile", async () => {
    const { t, owner, ids } = await setup();
    expect(await t.query(api.users.viewer, {})).toBeNull();
    expect(await owner.query(api.users.viewer, {})).toEqual({
      id: ids.owner,
      name: "Owner",
      image: "https://example.com/avatar.png",
      email: null,
      role: "user",
    });
  });

  it("denies anonymous and regular users access, and excludes the current admin", async () => {
    const { t, admin, owner, user, ids } = await setup();
    await expect(t.query(api.users.list, { paginationOpts })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    for (const account of [owner, user])
      await expect(
        account.query(api.users.list, { paginationOpts }),
      ).rejects.toThrow("FORBIDDEN");
    const result = await admin.query(api.users.list, { paginationOpts });
    expect(result.page.map((entry) => entry.id).sort()).toEqual(
      [ids.owner, ids.user].sort(),
    );
    expect(result.page.every((entry) => entry.role === "user")).toBe(true);
    expect(result.page[0]).not.toHaveProperty("phone");
  });

  it("paginates every account including through a page containing only the current admin", async () => {
    const { t, admin, ids } = await setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < 35; index++)
        await ctx.db.insert("users", { name: `Coach ${index}` });
    });
    const found: string[] = [];
    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const result: FunctionReturnType<typeof api.users.list> =
        await admin.query(api.users.list, {
          paginationOpts: { numItems: 1, cursor },
        });
      found.push(...result.page.map((entry) => entry.id));
      done = result.isDone;
      cursor = result.continueCursor;
    }
    expect(found).toHaveLength(37);
    expect(new Set(found).size).toBe(37);
    expect(found).not.toContain(ids.admin);
    await expect(
      admin.query(api.users.list, {
        paginationOpts: { numItems: 31, cursor: null },
      }),
    ).rejects.toThrow("INVALID_INPUT");
  });

  it("only registers admin assignment as an internal mutation and immediately enforces revocation", async () => {
    const { t, user, ids } = await setup();
    expect(setAdmin.isInternal).toBe(true);
    expect(setAdmin).not.toHaveProperty("isPublic", true);
    await t.mutation(internal.users.setAdmin, {
      userId: ids.user,
      enabled: true,
    });
    expect((await user.query(api.users.viewer, {}))?.role).toBe("admin");
    expect(
      (await user.query(api.users.list, { paginationOpts })).page,
    ).toHaveLength(2);
    await t.mutation(internal.users.setAdmin, {
      userId: ids.user,
      enabled: false,
    });
    expect((await user.query(api.users.viewer, {}))?.role).toBe("user");
    await expect(
      user.query(api.users.list, { paginationOpts }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("admin team permissions", () => {
  it("allows edits and archiving of another user's team while preserving ownership and revision checks", async () => {
    const { t, admin, owner, user, ids } = await setup();
    const team = newTeam(randomUUID());
    await owner.mutation(api.teams.save, { team, expectedRevision: 0 });
    expect(
      (await admin.query(api.teams.getByUuid, { uuid: team.uuid }))?.canEdit,
    ).toBe(true);
    expect(
      (await user.query(api.teams.getByUuid, { uuid: team.uuid }))?.canEdit,
    ).toBe(false);
    await expect(
      user.mutation(api.teams.save, { team, expectedRevision: 1 }),
    ).rejects.toThrow("FORBIDDEN");
    const saved = await admin.mutation(api.teams.save, {
      team: { ...team, name: "Admin edit" },
      expectedRevision: 1,
    });
    expect(saved.revision).toBe(2);
    await expect(
      owner.mutation(api.teams.save, { team, expectedRevision: 1 }),
    ).rejects.toThrow("CONFLICT");
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("teams")
        .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
        .unique();
      expect(doc?.ownerId).toBe(ids.owner);
    });
    expect(
      (
        await admin.query(api.teams.listMine, {
          archived: false,
          paginationOpts,
        })
      ).page,
    ).toEqual([]);
    expect(
      (
        await owner.query(api.teams.listMine, {
          archived: false,
          paginationOpts,
        })
      ).page[0].team.name,
    ).toBe("Admin edit");
    await admin.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: true,
    });
    expect(
      await owner.query(api.teams.getByUuid, { uuid: team.uuid }),
    ).toBeNull();
    await admin.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: false,
    });
    await t.mutation(internal.users.setAdmin, {
      userId: ids.admin,
      enabled: false,
    });
    expect(
      (await admin.query(api.teams.getByUuid, { uuid: team.uuid }))?.canEdit,
    ).toBe(false);
    await expect(
      admin.mutation(api.teams.save, { team, expectedRevision: 4 }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      admin.mutation(api.teams.setArchived, {
        uuid: team.uuid,
        archived: true,
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("user presence", () => {
  it("derives identity server-side and keeps other users' activity private", async () => {
    const { t, owner, user, ids } = await setup();
    await expect(
      t.mutation(api.presence.heartbeat, heartbeatArgs(ids.owner)),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      user.mutation(api.presence.heartbeat, heartbeatArgs(ids.owner)),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      owner.mutation(api.presence.heartbeat, {
        ...heartbeatArgs(ids.owner),
        interval: 1,
      }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      owner.mutation(api.presence.heartbeat, {
        ...heartbeatArgs(ids.owner),
        roomId: "another-room",
      }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(await t.query(api.presence.list, { roomToken: "unknown" })).toEqual(
      [],
    );
  });

  it("aggregates tabs into one online user and records last seen when their last tab disconnects", async () => {
    vi.useFakeTimers();
    const { t, admin, owner, ids } = await setup();
    const first = await owner.mutation(
      api.presence.heartbeat,
      heartbeatArgs(ids.owner),
    );
    const second = await owner.mutation(
      api.presence.heartbeat,
      heartbeatArgs(ids.owner),
    );
    const entry = async () =>
      (await admin.query(api.users.list, { paginationOpts })).page.find(
        (user) => user.id === ids.owner,
      )!;
    expect(await entry()).toMatchObject({ online: true, lastSeenAt: null });
    await t.mutation(api.presence.disconnect, {
      sessionToken: first.sessionToken,
    });
    expect((await entry()).online).toBe(true);
    await t.mutation(api.presence.disconnect, {
      sessionToken: second.sessionToken,
    });
    expect(await entry()).toMatchObject({
      online: false,
      lastSeenAt: expect.any(Number),
    });
    expect(
      (
        await owner.query(api.presence.list, { roomToken: first.roomToken })
      ).map((user) => user.userId),
    ).toEqual([ids.owner]);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });

  it("times out an abandoned session without a disconnect message", async () => {
    vi.useFakeTimers();
    const { t, admin, owner, ids } = await setup();
    await owner.mutation(api.presence.heartbeat, heartbeatArgs(ids.owner));
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const entry = (
      await admin.query(api.users.list, { paginationOpts })
    ).page.find((user) => user.id === ids.owner)!;
    expect(entry.online).toBe(false);
    expect(entry.lastSeenAt).toBeTypeOf("number");
  });
});

it("sorts online users first and then recent activity across pagination batches without mutating input", () => {
  const users = [
    { id: "old", online: false, lastSeenAt: 10, joinedAt: 1 },
    { id: "recent", online: false, lastSeenAt: 100, joinedAt: 2 },
    { id: "online", online: true, lastSeenAt: null, joinedAt: 3 },
  ];
  expect(sortUsers(users).map((user) => user.id)).toEqual([
    "online",
    "recent",
    "old",
  ]);
  expect(users[0].id).toBe("old");
});
