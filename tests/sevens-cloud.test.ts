/// <reference types="vite/client" />
import { randomUUID } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, newTeam } from "../src/domain/catalog";
import { isLineman } from "../src/domain/rules";
import type { Team } from "../src/domain/types";

const modules = import.meta.glob("../convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Coach" }),
  );
  return { t, owner: t.withIdentity({ subject: String(ownerId) }) };
}

function sevensTeam(): Team {
  const team = newTeam(randomUUID());
  team.rulesetId = "kyiv-seven-sins-sevens";
  const lineman = getRoster("human")!.players.find(isLineman)!;
  team.players = Array.from({ length: 7 }, () => ({
    id: randomUUID(),
    positionId: lineman.id,
    name: "",
    skills: [],
  }));
  team.captainId = team.players[0].id;
  team.veteranId = team.players[1].id;
  return team;
}

describe("Kyiv Seven Sins cloud persistence and enforcement", () => {
  it("accepts the tier-two primary skill allowance on a non-captain", async () => {
    const { owner } = await setup();
    const team = sevensTeam();
    team.players[2].skills = ["block"];
    const saved = await owner.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(saved.legal).toBe(true);
    expect(saved.team.players[2].skills).toEqual(["block"]);
  });

  it("persists the veteran across create, update, public sharing and filtered library reads", async () => {
    const { t, owner } = await setup();
    const team = sevensTeam();
    const created = await owner.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(created.legal).toBe(true);
    expect(created.team.veteranId).toBe(team.veteranId);
    team.veteranId = team.players[2].id;
    const updated = await owner.mutation(api.teams.save, {
      team,
      expectedRevision: created.revision,
    });
    expect(updated.legal).toBe(true);
    const shared = await t.query(api.teams.getByUuid, { uuid: team.uuid });
    expect(shared?.team).toEqual(updated.team);
    expect(shared?.canEdit).toBe(false);
    const library = await owner.query(api.teams.listMine, {
      archived: false,
      rulesetId: "kyiv-seven-sins-sevens",
      paginationOpts: { numItems: 12, cursor: null },
    });
    expect(library.page.map((row) => row.team.veteranId)).toEqual([
      team.veteranId,
    ]);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("teams")
        .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
        .unique();
      expect(row?.team.veteranId).toBe(team.veteranId);
    });
  });

  it("saves a missing-veteran draft, recomputes legality on selection, and permits removing it again", async () => {
    const { owner } = await setup();
    const team = sevensTeam();
    delete team.veteranId;
    const draft = await owner.mutation(api.teams.save, {
      team,
      expectedRevision: 0,
    });
    expect(draft.legal).toBe(false);
    team.veteranId = team.players[1].id;
    const ready = await owner.mutation(api.teams.save, {
      team,
      expectedRevision: draft.revision,
    });
    expect(ready.legal).toBe(true);
    delete team.veteranId;
    expect(
      (
        await owner.mutation(api.teams.save, {
          team,
          expectedRevision: ready.revision,
        })
      ).legal,
    ).toBe(false);
  });

  const invalidCases: [string, (team: Team) => void][] = [
    [
      "tier-two secondary skill",
      (team) => {
        team.players[2].skills = ["dodge"];
      },
    ],
    [
      "unknown veteran",
      (team) => {
        team.veteranId = randomUUID();
      },
    ],
    [
      "specialist veteran",
      (team) => {
        team.players[1].positionId = getRoster("human")!.players.find((p) =>
          p.position.includes("Blitzer"),
        )!.id;
      },
    ],
    [
      "veteran outside Sevens",
      (team) => {
        team.rulesetId = "bb2025-default";
      },
    ],
    [
      "Leader",
      (team) => {
        team.players[2].skills = ["leader"];
      },
    ],
    [
      "skilled tier-two captain",
      (team) => {
        team.players[0].skills = ["block"];
      },
    ],
    [
      "stacked skills",
      (team) => {
        team.players[2].skills = ["block", "tackle"];
      },
    ],
    [
      "excess skill points",
      (team) => {
        team.players[2].skills = ["block"];
        team.players[3].skills = ["tackle"];
      },
    ],
    [
      "over-budget roster",
      (team) => {
        team.staff.rerolls = 4;
      },
    ],
    [
      "excess Sevens staff",
      (team) => {
        team.staff.assistantCoaches = 4;
      },
    ],
    [
      "twelve-player roster",
      (team) => {
        team.players.push(
          ...Array.from({ length: 5 }, () => ({
            ...team.players[3],
            id: randomUUID(),
            skills: [],
          })),
        );
      },
    ],
  ];

  it.each(invalidCases)(
    "rejects %s and preserves the last shared snapshot",
    async (_name, mutate) => {
      const { t, owner } = await setup();
      const team = sevensTeam();
      const saved = await owner.mutation(api.teams.save, {
        team,
        expectedRevision: 0,
      });
      mutate(team);
      await expect(
        owner.mutation(api.teams.save, {
          team,
          expectedRevision: saved.revision,
        }),
      ).rejects.toThrow("INVALID_TEAM");
      const shared = await t.query(api.teams.getByUuid, { uuid: team.uuid });
      expect(shared?.team).toEqual(saved.team);
      expect(shared?.revision).toBe(saved.revision);
    },
  );
});
