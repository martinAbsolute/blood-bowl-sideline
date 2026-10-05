/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, newTeam } from "../src/domain/catalog";
import { TEAM_NAME_MAX_LENGTH } from "../src/domain/team-name";
const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => ({
    a: await ctx.db.insert("users", { name: "Olexandr" }),
    b: await ctx.db.insert("users", { name: "B" }),
  }));
  return {
    t,
    a: t.withIdentity({ subject: String(ids.a) }),
    b: t.withIdentity({ subject: String(ids.b) }),
  };
}
describe("Convex team ownership and sharing", () => {
  it("keeps archiving idempotent across tabs and refuses pending edits until an explicit restore", async () => {
    const { a } = await setup();
    const team = newTeam(randomUUID());
    await a.mutation(api.teams.save, { team, expectedRevision: 0 });
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: true,
    });
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: true,
    });
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 1 }),
    ).rejects.toThrow("ARCHIVED");
    expect(await a.query(api.teams.getByUuid, { uuid: team.uuid })).toBeNull();
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: false,
    });
    expect(
      (await a.query(api.teams.getByUuid, { uuid: team.uuid }))?.revision,
    ).toBe(3);
  });
  it("acknowledges a repeated save after a lost response without another write, while rejecting different stale edits", async () => {
    const { a, b } = await setup();
    const team = {
      ...newTeam(randomUUID(), "black-orc"),
      name: "Renamed Black Orcs",
    };
    const request = { team, expectedRevision: 0 };
    const saved = await a.mutation(api.teams.save, request);
    expect(await a.mutation(api.teams.save, request)).toEqual(saved);
    await expect(b.mutation(api.teams.save, request)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(
      a.mutation(api.teams.save, {
        ...request,
        team: { ...team, name: "A different stale edit" },
      }),
    ).rejects.toThrow("CONFLICT");
    const changed = await a.mutation(api.teams.save, {
      team: { ...team, name: "Latest server name" },
      expectedRevision: saved.revision,
    });
    await expect(a.mutation(api.teams.save, request)).rejects.toThrow(
      "CONFLICT",
    );
    expect(
      (await a.query(api.teams.getByUuid, { uuid: team.uuid }))?.revision,
    ).toBe(changed.revision);
  });
  it("enforces the team-name boundary for both creates and renames", async () => {
    const { a } = await setup();
    const team = {
      ...newTeam(randomUUID()),
      name: "Ж".repeat(TEAM_NAME_MAX_LENGTH),
    };
    const saved = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(saved.team.name).toBe(team.name);
    for (const name of ["x".repeat(TEAM_NAME_MAX_LENGTH + 1), "   "]) {
      await expect(
        a.mutation(api.teams.save, {
          team: { ...team, uuid: randomUUID(), name },
          expectedRevision: 0,
        }),
      ).rejects.toThrow("INVALID_TEAM");
      await expect(
        a.mutation(api.teams.save, {
          team: { ...team, name },
          expectedRevision: saved.revision,
        }),
      ).rejects.toThrow("INVALID_TEAM");
    }
    expect(
      (await a.query(api.teams.getByUuid, { uuid: team.uuid }))?.team.name,
    ).toBe(team.name);
  });
  it("keeps Telegram ownership on the private user record and discards obsolete notes", async () => {
    const { a, b, t } = await setup();
    const team = {
      ...newTeam(randomUUID()),
      notes: "Obsolete notes",
    };
    const saved = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(saved.team).not.toHaveProperty("coach");
    expect(saved.team.notes).toBe("");
    const viewer = await a.query(api.teams.viewer, {});
    expect(viewer).toEqual({ id: expect.any(String) });
    expect(viewer).not.toHaveProperty("name");
    expect(await b.query(api.teams.viewer, {})).toEqual({
      id: expect.any(String),
    });
    expect(await t.query(api.teams.viewer, {})).toBeNull();
    const shared = await t.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(shared?.team).not.toHaveProperty("coach");
    expect(JSON.stringify(shared)).not.toContain("Olexandr");
    await t.run(async (ctx) => {
      const doc = await ctx.db
        .query("teams")
        .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
        .unique();
      expect(doc?.team).not.toHaveProperty("coach");
      expect(doc?.searchText).not.toContain("Olexandr");
      expect((await ctx.db.get("users", doc!.ownerId))?.name).toBe("Olexandr");
    });
    expect(shared).not.toHaveProperty("id");
  });
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
      (await a.query(api.teams.listMine, { ...args, search: "Olex" })).page,
    ).toEqual([]);
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

describe("Direct API input hardening", () => {
  const invalidTeams: [string, (team: ReturnType<typeof newTeam>) => void][] = [
    [
      "unknown roster",
      (team) => {
        team.rosterId = "fake";
      },
    ],
    [
      "unknown position",
      (team) => {
        team.players = [
          { id: randomUUID(), positionId: "fake", name: "", skills: [] },
        ];
      },
    ],
    [
      "foreign position",
      (team) => {
        team.players = [
          {
            id: randomUUID(),
            positionId: getRoster("dwarf")!.players[0].id,
            name: "",
            skills: [],
          },
        ];
      },
    ],
    [
      "duplicate identities",
      (team) => {
        const p = {
          id: randomUUID(),
          positionId: getRoster("human")!.players[0].id,
          name: "",
          skills: [],
        };
        team.players = [p, p];
      },
    ],
    [
      "unknown skill",
      (team) => {
        team.players = [
          {
            id: randomUUID(),
            positionId: getRoster("human")!.players[0].id,
            name: "",
            skills: ["fake"],
          },
        ];
      },
    ],
    [
      "duplicate skills",
      (team) => {
        team.players = [
          {
            id: randomUUID(),
            positionId: getRoster("human")!.players[0].id,
            name: "",
            skills: ["block", "block"],
          },
        ];
      },
    ],
    [
      "unknown star",
      (team) => {
        team.stars = ["fake"];
      },
    ],
    [
      "unknown zero-quantity inducement",
      (team) => {
        team.inducements = { fake: 0 };
      },
    ],
    [
      "unknown captain",
      (team) => {
        team.captainId = randomUUID();
      },
    ],
    [
      "negative staff",
      (team) => {
        team.staff.rerolls = -1;
      },
    ],
    [
      "fractional staff",
      (team) => {
        team.staff.rerolls = 1.5;
      },
    ],
    [
      "non-finite staff",
      (team) => {
        team.staff.rerolls = NaN;
      },
    ],
    [
      "over-budget roster",
      (team) => {
        team.staff = {
          rerolls: 8,
          apothecary: 1,
          assistantCoaches: 6,
          cheerleaders: 6,
          dedicatedFans: 6,
        };
        team.players = Array.from({ length: 16 }, () => ({
          id: randomUUID(),
          positionId: getRoster("human")!.players[0].id,
          name: "",
          skills: [],
        }));
      },
    ],
    [
      "forged UUID",
      (team) => {
        team.uuid = "a".repeat(36);
      },
    ],
    [
      "oversized notes",
      (team) => {
        team.notes = "x".repeat(2001);
      },
    ],
    [
      "obsolete rules snapshot",
      (team) => {
        Object.assign(team, { rulesVersion: "old" });
      },
    ],
    [
      "client supplied cost",
      (team) => {
        Object.assign(team, { cost: 0 });
      },
    ],
    [
      "client supplied owner",
      (team) => {
        Object.assign(team, { ownerId: "victim" });
      },
    ],
    [
      "client supplied legality",
      (team) => {
        Object.assign(team, { legal: true });
      },
    ],
    [
      "client supplied revision",
      (team) => {
        Object.assign(team, { revision: 100 });
      },
    ],
  ];
  it.each(invalidTeams)(
    "rejects %s without inserting a row",
    async (_name, mutate) => {
      const { t, a } = await setup();
      const team = newTeam(randomUUID());
      mutate(team);
      await expect(
        a.mutation(api.teams.save, { team, expectedRevision: 0 }),
      ).rejects.toThrow();
      expect(await t.run((ctx) => ctx.db.query("teams").collect())).toEqual([]);
    },
  );
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid revision %s",
    async (expectedRevision) => {
      const { a } = await setup();
      await expect(
        a.mutation(api.teams.save, {
          team: newTeam(randomUUID()),
          expectedRevision,
        }),
      ).rejects.toThrow("INVALID_INPUT");
    },
  );
  it("keeps the last valid snapshot when an invalid update is rejected", async () => {
    const { t, a } = await setup();
    const team = newTeam(randomUUID());
    const saved = await a.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    await expect(
      a.mutation(api.teams.save, {
        team: { ...team, stars: ["fake"] },
        expectedRevision: 1,
      }),
    ).rejects.toThrow("INVALID_TEAM");
    const publicView = await t.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(publicView?.team).toEqual(saved.team);
    expect(publicView?.revision).toBe(1);
    expect(Object.keys(publicView!).sort()).toEqual([
      "canEdit",
      "leagueExperienced",
      "leagueLocked",
      "legal",
      "revision",
      "team",
      "updatedAt",
    ]);
  });
  it("rejects unauthenticated archives and writes to archived teams", async () => {
    const { t, a } = await setup();
    const team = newTeam(randomUUID());
    await a.mutation(api.teams.save, { team, expectedRevision: 0 });
    await expect(
      t.mutation(api.teams.setArchived, { uuid: team.uuid, archived: true }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await a.mutation(api.teams.setArchived, {
      uuid: team.uuid,
      archived: true,
    });
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 2 }),
    ).rejects.toThrow("ARCHIVED");
    await expect(
      a.mutation(api.teams.setArchived, {
        uuid: "x".repeat(36),
        archived: true,
      }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(
      await t.query(api.teams.getByUuid, { uuid: "a".repeat(36) }),
    ).toBeNull();
  });
  it.each([0, -1, 0.5, 31, NaN, Infinity])(
    "rejects invalid page size %s",
    async (numItems) => {
      const { a } = await setup();
      await expect(
        a.query(api.teams.listMine, {
          archived: false,
          paginationOpts: { numItems, cursor: null },
        }),
      ).rejects.toThrow("INVALID_INPUT");
    },
  );
  it("rejects oversized searches and invalid roster filters", async () => {
    const { a } = await setup();
    const args = {
      archived: false,
      paginationOpts: { numItems: 12, cursor: null },
    };
    await expect(
      a.query(api.teams.listMine, { ...args, search: "x".repeat(161) }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      a.query(api.teams.listMine, { ...args, rosterId: "fake" }),
    ).rejects.toThrow("INVALID_INPUT");
  });
});

describe("Server enforcement of catalog and tournament rules", () => {
  it.each(["bb2025-matched-play", "eurobowl-2026"] as const)(
    "rejects illegal advancement stacks for %s",
    async (rulesetId) => {
      const { a } = await setup();
      const team = newTeam(randomUUID());
      team.rulesetId = rulesetId;
      team.players = [
        {
          id: randomUUID(),
          positionId: getRoster("human")!.players[0].id,
          name: "",
          skills: ["block", "dodge"],
        },
      ];
      await expect(
        a.mutation(api.teams.save, { team, expectedRevision: 0 }),
      ).rejects.toThrow("INVALID_TEAM");
    },
  );
  it("rejects traits, starting skills, invalid captain Pro, and position excesses", async () => {
    const { a } = await setup();
    const team = newTeam(randomUUID());
    const player = {
      id: randomUUID(),
      positionId: getRoster("human")!.players[0].id,
      name: "",
      skills: ["loner"],
    };
    team.players = [player];
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
    player.skills = ["pro"];
    team.captainId = player.id;
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
    delete team.captainId;
    const blitzer = getRoster("human")!.players.find((p) =>
      p.position.includes("Human Blitzer"),
    )!;
    team.players = [{ ...player, positionId: blitzer.id, skills: ["block"] }];
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
    team.players = Array.from({ length: 3 }, () => ({
      ...player,
      id: randomUUID(),
      positionId: blitzer.id,
      skills: [],
    }));
    await expect(
      a.mutation(api.teams.save, { team, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
  });
  it("rejects roster-specific staff and tournament-only restrictions", async () => {
    const { a } = await setup();
    const undead = newTeam(randomUUID(), "shambling-undead");
    undead.staff.apothecary = 1;
    await expect(
      a.mutation(api.teams.save, { team: undead, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
    const tournament = newTeam(randomUUID());
    tournament.rulesetId = "world-cup-2027";
    tournament.staff.dedicatedFans = 1;
    await expect(
      a.mutation(api.teams.save, { team: tournament, expectedRevision: 0 }),
    ).rejects.toThrow("INVALID_TEAM");
  });
});
