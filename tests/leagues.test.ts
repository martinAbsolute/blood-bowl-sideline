/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { getRoster, newTeam } from "../src/domain/catalog";
import { emptyPlayerStats } from "../src/domain/league-rules";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.ts");
function rookie(name = "Rookie") {
  const team = newTeam(randomUUID());
  team.name = name;
  team.players = Array.from({ length: 11 }, (_, i) => ({
    id: randomUUID(),
    positionId: getRoster("human")!.players[0].id,
    name: `${name} ${i + 1}`,
    skills: [],
  }));
  team.captainId = team.players[0].id;
  return team;
}
async function setup(count = 2) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const coaches = [];
    for (let i = 0; i < count; i++)
      coaches.push(await ctx.db.insert("users", { name: `Coach ${i}` }));
    const outsider = await ctx.db.insert("users", {
      name: "Global admin",
      role: "admin",
    });
    return { coaches, outsider };
  });
  const coaches = ids.coaches.map((id) => t.withIdentity({ subject: id }));
  const admin = t.withIdentity({ subject: ids.outsider });
  const leagueId = await coaches[0].mutation(api.leagues.create, {
    name: "Season 1",
    startAt: Date.UTC(2026, 9, 11),
    roundDays: 14,
  });
  const entries: Id<"leagueTeams">[] = [],
    teams = [];
  for (let i = 0; i < count; i++) {
    const team = rookie(`Team ${i}`);
    await coaches[i].mutation(api.teams.save, { team, expectedRevision: 0 });
    entries.push(
      await coaches[i].mutation(api.leagues.register, {
        leagueId,
        teamUuid: team.uuid,
      }),
    );
    teams.push(team);
  }
  await coaches[0].mutation(api.leagues.launch, { leagueId });
  const detail = await t.query(api.leagues.get, { leagueId });
  const match = detail.matches.find((m) => m.status === "scheduled")!;
  return { t, ids, coaches, admin, leagueId, entries, teams, match };
}
async function readyReport(
  s: Awaited<ReturnType<typeof setup>>,
  matchId = s.match._id,
) {
  const details = await s.t.query(api.leagues.getMatch, { matchId });
  const homeIndex = s.entries.indexOf(details.home._id),
    awayIndex = s.entries.indexOf(details.away!._id);
  const home = s.coaches[homeIndex],
    away = s.coaches[awayIndex];
  await home.mutation(api.leagues.startMatch, { matchId });
  let view = await s.t.query(api.leagues.getMatch, { matchId });
  const scorer = view.players.find(
    (p) => p.entryId === view.home._id && p.participated,
  )!;
  const otherMvp = view.players.find(
    (p) => p.entryId === view.away!._id && p.participated,
  )!;
  let revision = await home.mutation(api.leagues.updateMatchPlayer, {
    matchId,
    playerId: scorer.playerId,
    stats: { ...emptyPlayerStats(), td: 1, mvp: 1 },
    expectedRevision: view.match.revision,
  });
  revision = await away.mutation(api.leagues.updateMatchPlayer, {
    matchId,
    playerId: otherMvp.playerId,
    stats: { ...emptyPlayerStats(), mvp: 1 },
    expectedRevision: revision,
  });
  revision = await home.mutation(api.leagues.updateMatchDetails, {
    matchId,
    scoreHome: 1,
    scoreAway: 0,
    homeFanRoll: 1,
    awayFanRoll: 1,
    homeFansRoll: 6,
    awayFansRoll: 6,
    expectedRevision: revision,
  });
  view = await s.t.query(api.leagues.getMatch, { matchId });
  return { home, away, scorer, otherMvp, revision, view, matchId };
}
async function finalize(s: Awaited<ReturnType<typeof setup>>) {
  const report = await readyReport(s);
  expect(
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    }),
  ).toMatchObject({ completed: false });
  expect(
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    }),
  ).toMatchObject({ completed: true });
  return report;
}

describe("league registration and fixtures", () => {
  it.each([
    [6, 15, 5],
    [7, 21, 7],
    [8, 28, 7],
  ])(
    "generates a complete round robin for %i coaches",
    async (count, fixtures, rounds) => {
      const s = await setup(count),
        detail = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
      expect(detail.rounds).toHaveLength(rounds);
      expect(detail.matches.filter((m) => m.awayEntryId)).toHaveLength(
        fixtures,
      );
      const pairs = detail.matches
        .filter((m) => m.awayEntryId)
        .map((m) => [m.homeEntryId, m.awayEntryId].sort().join("/"));
      expect(new Set(pairs).size).toBe(fixtures);
      for (const round of detail.rounds) {
        const playing = detail.matches
          .filter((m) => m.roundId === round._id)
          .flatMap((m) =>
            m.awayEntryId ? [m.homeEntryId, m.awayEntryId] : [m.homeEntryId],
          );
        expect(new Set(playing).size).toBe(count);
        expect(playing).toHaveLength(count);
      }
      if (count % 2)
        for (const entry of s.entries)
          expect(
            detail.matches.filter(
              (m) => m.status === "bye" && m.homeEntryId === entry,
            ),
          ).toHaveLength(1);
      await expect(
        s.coaches[0].mutation(api.leagues.launch, { leagueId: s.leagueId }),
      ).rejects.toThrow("ALREADY_LAUNCHED");
    },
  );
  it("keeps commissioner authority scoped, including a participating commissioner", async () => {
    const s = await setup();
    const detail = await s.coaches[0].query(api.leagues.get, {
      leagueId: s.leagueId,
    });
    expect(detail.canCommission).toBe(true);
    expect(detail.entries.some((e) => e.coachId === s.ids.coaches[0])).toBe(
      true,
    );
    await expect(
      s.admin.mutation(api.leagues.extendRound, {
        roundId: detail.rounds[0]._id,
        deadlineAt: detail.rounds[0].deadlineAt + 1,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      s.t.mutation(api.leagues.create, { name: "Anonymous", startAt: 0 }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      s.coaches[1].mutation(api.leagues.startMatch, { matchId: s.match._id }),
    ).resolves.toBeNull();
    await expect(
      s.admin.mutation(api.leagues.updateMatchDetails, {
        matchId: s.match._id,
        scoreHome: 0,
        scoreAway: 0,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("permits team replacement after launch before a match and isolates it from the original builder", async () => {
    const s = await setup(),
      replacement = rookie("Replacement");
    await s.coaches[0].mutation(api.teams.save, {
      team: replacement,
      expectedRevision: 0,
    });
    await s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
      entryId: s.entries[0],
      teamUuid: replacement.uuid,
      expectedRevision: 1,
    });
    await s.coaches[0].mutation(api.teams.save, {
      team: { ...replacement, name: "Edited draft" },
      expectedRevision: 1,
    });
    await s.coaches[0].mutation(api.teams.setArchived, {
      uuid: replacement.uuid,
      archived: true,
    });
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(career.entry.team.name).toBe("Replacement");
    await s.coaches[0].mutation(api.leagues.startMatch, {
      matchId: s.match._id,
    });
    const match = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    expect(match.match.homeSnapshot?.name).toBe("Replacement");
    expect(match.players[0].snapshot.baseCost).toBeGreaterThan(0);
    expect(match.players[0].snapshot.profile.ma).toBeGreaterThan(0);
    await expect(
      s.coaches[0].mutation(api.leagues.replaceEntryTeam, {
        entryId: s.entries[0],
        teamUuid: s.teams[0].uuid,
        expectedRevision: career.entry.revision + 1,
      }),
    ).rejects.toThrow("MATCH_IN_PROGRESS");
  });
});

describe("one shared revision and atomic match finalization", () => {
  it("invalidates both approvals on edits and awards progression exactly once", async () => {
    const s = await setup(),
      report = await readyReport(s);
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: report.revision,
    });
    const next = await report.away.mutation(api.leagues.updateMatchPlayer, {
      matchId: report.matchId,
      playerId: report.otherMvp.playerId,
      stats: { ...emptyPlayerStats(), mvp: 1, com: 1 },
      expectedRevision: report.revision,
    });
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: report.matchId })).match
        .confirmedBy,
    ).toEqual([]);
    await expect(
      report.home.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: report.revision,
      }),
    ).rejects.toThrow("CONFLICT");
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: report.matchId,
      expectedRevision: next,
    });
    const results = await Promise.all([
      report.away.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: next,
      }),
      report.away.mutation(api.leagues.confirmMatch, {
        matchId: report.matchId,
        expectedRevision: next,
      }),
    ]);
    expect(results.every((r) => r.completed)).toBe(true);
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const scorer = career.players.find(
      (p) => p._id === report.scorer.playerId,
    )!;
    expect(scorer.sppEarned).toBe(7);
    expect(scorer.stats.mp).toBe(1);
    expect(career.entry.stats).toMatchObject({ mp: 1, pts: 3, tdFor: 1 });
    expect(career.entry.postGamePending).toBe(true);
    expect(career.entry.treasury).toBe(490000);
    expect(career.entry.team.staff.dedicatedFans).toBe(2);
    await expect(
      report.home.mutation(api.leagues.updateMatchDetails, {
        matchId: report.matchId,
        scoreHome: 0,
        scoreAway: 0,
        expectedRevision: next,
      }),
    ).rejects.toThrow("REPORT_LOCKED");
    const standings = (
      await s.t.query(api.leagues.get, { leagueId: s.leagueId })
    ).standings;
    expect(standings[0]).toMatchObject({ pts: 3, winDrawPercent: 1, cu: 3 });
  });
  it("rejects forged statistics and incomplete confirmations without partial awards", async () => {
    const s = await setup();
    await s.coaches[0].mutation(api.leagues.startMatch, {
      matchId: s.match._id,
    });
    const report = await s.t.query(api.leagues.getMatch, {
      matchId: s.match._id,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.updateMatchPlayer, {
        matchId: s.match._id,
        playerId: report.players[0].playerId,
        stats: { ...emptyPlayerStats(), td: -1 },
        expectedRevision: report.match.revision,
      }),
    ).rejects.toThrow("INVALID_INPUT");
    await expect(
      s.coaches[0].mutation(api.leagues.updateMatchPlayer, {
        matchId: s.match._id,
        playerId: report.players[0].playerId,
        stats: { ...emptyPlayerStats(), cas: 1, sppCas: 2 },
        expectedRevision: report.match.revision,
      }),
    ).rejects.toThrow("INVALID_STATS");
    await expect(
      s.coaches[0].mutation(api.leagues.confirmMatch, {
        matchId: s.match._id,
        expectedRevision: report.match.revision,
      }),
    ).rejects.toThrow("ONE_MVP_PER_TEAM_REQUIRED");
    const career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(career.entry.stats.mp).toBe(0);
    expect(career.players.every((p) => p.sppEarned === 0)).toBe(true);
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: s.match._id })).match
        .confirmedBy,
    ).toEqual([]);
  });
  it("replays a commissioner correction atomically but protects later spent SPP", async () => {
    const s = await setup(),
      report = await finalize(s);
    await expect(
      report.away.mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        scoreHome: 2,
        scoreAway: 0,
        reason: "Incorrect touchdown",
        expectedRevision: report.revision,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      report.home.mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        scoreHome: 2,
        scoreAway: 0,
        reason: "Incorrect touchdown",
        expectedRevision: report.revision,
      }),
    ).rejects.toThrow("TOUCHDOWN_TOTAL_MISMATCH");
    const next = await s.coaches[0].mutation(api.leagues.correctMatch, {
      matchId: report.matchId,
      scoreHome: 2,
      scoreAway: 0,
      reason: "Corrected scorer sheet",
      expectedRevision: report.revision,
      playerChanges: [
        {
          playerId: report.scorer.playerId,
          stats: { ...emptyPlayerStats(), td: 2, mvp: 1 },
        },
      ],
    });
    const career = await s.t.query(api.leagues.getCareer, {
        entryId: report.view.home._id,
      }),
      player = career.players.find((p) => p._id === report.scorer.playerId)!;
    expect(player.sppEarned).toBe(10);
    expect(player.stats.mp).toBe(1);
    expect(career.entry.treasury).toBe(500000);
    expect(career.entry.stats).toMatchObject({ mp: 1, pts: 3, tdFor: 2 });
    expect(
      (await s.t.query(api.leagues.getMatch, { matchId: report.matchId })).match
        .homeSnapshot,
    ).toEqual(report.view.match.homeSnapshot);
    const choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.correctMatch, {
        matchId: report.matchId,
        scoreHome: 0,
        scoreAway: 0,
        reason: "Late correction",
        expectedRevision: next,
        playerChanges: [
          { playerId: player._id, stats: { ...emptyPlayerStats(), mvp: 1 } },
        ],
      }),
    ).rejects.toThrow("DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION");
    expect(
      (
        await s.t.query(api.leagues.getCareer, { entryId: career.entry._id })
      ).players.find((p) => p._id === player._id)?.sppSpent,
    ).toBe(6);
    const metadataRevision = await s.coaches[0].mutation(
      api.leagues.correctMatch,
      {
        matchId: report.matchId,
        scoreHome: 2,
        scoreAway: 0,
        venue: "Corrected venue",
        evidenceUrl: "https://example.com/photo.jpg",
        reason: "Metadata correction",
        expectedRevision: next,
        homeFanRoll: 1,
        awayFanRoll: 1,
        homeFansRoll: 6,
        awayFansRoll: 6,
        homeStalled: false,
        awayStalled: false,
      },
    );
    expect(metadataRevision).toBe(next + 1);
    const afterMetadata = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(afterMetadata.entry.treasury).toBe(career.entry.treasury);
    expect(
      afterMetadata.players.find((p) => p._id === player._id)?.sppSpent,
    ).toBe(6);
    const audit = await s.t.query(api.leagues.audit, {
      leagueId: s.leagueId,
      paginationOpts: { cursor: null, numItems: 30 },
    });
    expect(
      audit.page.some(
        (row) =>
          row.action === "match-corrected" &&
          row.reason === "Corrected scorer sheet",
      ),
    ).toBe(true);
  });
});

describe("postgame roster management and administrative results", () => {
  it("lets only the commissioner reverse a new advancement before it enters another match", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const player = career.players.find(
        (p) => p._id === report.scorer.playerId,
      )!,
      choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    career = await report.home.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(
      career.players.find((p) => p._id === player._id)?.canUndoAdvancement,
    ).toBe(true);
    await expect(
      report.away.mutation(api.leagues.undoLatestAdvancement, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
        reason: "Wrong skill",
      }),
    ).rejects.toThrow("FORBIDDEN");
    await s.coaches[0].mutation(api.leagues.undoLatestAdvancement, {
      playerId: player._id,
      expectedRevision: career.entry.revision,
      reason: "Wrong skill selected",
    });
    career = await s.coaches[0].query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.players.find((p) => p._id === player._id)).toMatchObject({
      sppEarned: 7,
      sppSpent: 0,
      valueIncrease: 0,
      skills: [],
      advancements: [],
      canUndoAdvancement: false,
    });
    await expect(
      s.coaches[0].mutation(api.leagues.undoLatestAdvancement, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
        reason: "Another undo",
      }),
    ).rejects.toThrow("ADVANCEMENT_ALREADY_CAPTURED_IN_MATCH");
  });
  it("denies foreign career actions, forged skills and stale spends without changing balances", async () => {
    const s = await setup(),
      report = await finalize(s);
    const career = await s.t.query(api.leagues.getCareer, {
        entryId: report.view.home._id,
      }),
      player = career.players.find((p) => p._id === report.scorer.playerId)!,
      choice = player.availableAdvancements.find((c) => c.cost === 6)!;
    for (const outsider of [report.away, s.admin]) {
      await expect(
        outsider.mutation(api.leagues.advancePlayer, {
          playerId: player._id,
          skillId: choice.skillId,
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        outsider.mutation(api.leagues.hirePlayer, {
          entryId: career.entry._id,
          positionId: player.positionId,
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        outsider.mutation(api.leagues.correctCareer, {
          entryId: career.entry._id,
          treasury: 1000000,
          reason: "Forged balance",
          expectedRevision: career.entry.revision,
        }),
      ).rejects.toThrow("FORBIDDEN");
    }
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "fake",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("ILLEGAL_ADVANCEMENT");
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "dodge",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("INSUFFICIENT_SPP");
    expect(
      (await s.t.query(api.leagues.getCareer, { entryId: career.entry._id }))
        .entry.revision,
    ).toBe(career.entry.revision);
    await report.home.mutation(api.leagues.advancePlayer, {
      playerId: player._id,
      skillId: choice.skillId,
      expectedRevision: career.entry.revision,
    });
    await expect(
      report.home.mutation(api.leagues.advancePlayer, {
        playerId: player._id,
        skillId: "dodge",
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("CONFLICT");
    expect(
      (
        await s.t.query(api.leagues.getCareer, { entryId: career.entry._id })
      ).players.find((p) => p._id === player._id),
    ).toMatchObject({ sppEarned: 7, sppSpent: 6 });
  });
  it("enforces hiring before firing, minimum eligible roster, and permanent rerolls", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const player = career.players[1],
      position = getRoster("human")!.players[0];
    await expect(
      report.home.mutation(api.leagues.retirePlayer, {
        playerId: player._id,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("MINIMUM_ROSTER");
    await expect(
      report.home.mutation(api.leagues.manageStaff, {
        entryId: career.entry._id,
        staff: "rerolls",
        change: -1,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("REROLLS_CANNOT_BE_REMOVED");
    await report.home.mutation(api.leagues.hirePlayer, {
      entryId: career.entry._id,
      positionId: position.id,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    await report.home.mutation(api.leagues.retirePlayer, {
      playerId: player._id,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    await expect(
      report.home.mutation(api.leagues.hirePlayer, {
        entryId: career.entry._id,
        positionId: getRoster("human")!.players[1].id,
        expectedRevision: career.entry.revision,
      }),
    ).rejects.toThrow("HIRING_MUST_PRECEDE_FIRING");
    expect(career.entry.team.players).toHaveLength(11);
  });
  it("buys players before applying expensive mistakes to the remaining treasury", async () => {
    const s = await setup(),
      report = await finalize(s);
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: report.view.home._id,
    });
    const positionId = getRoster("human")!.players[0].id;
    await report.home.mutation(api.leagues.hirePlayer, {
      entryId: career.entry._id,
      positionId,
      name: "New recruit",
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.entry.treasury).toBe(440000);
    await report.home.mutation(api.leagues.completePostGame, {
      entryId: career.entry._id,
      expectedRevision: career.entry.revision,
      mistakeRoll: 1,
    });
    career = await s.t.query(api.leagues.getCareer, {
      entryId: career.entry._id,
    });
    expect(career.entry.treasury).toBe(220000);
    expect(career.entry.postGamePending).toBe(false);
    await expect(
      report.home.mutation(api.leagues.completePostGame, {
        entryId: career.entry._id,
        expectedRevision: career.entry.revision,
        mistakeRoll: 1,
      }),
    ).rejects.toThrow("POSTGAME_ALREADY_COMPLETED");
  });
  it("retains MNG players, adds temporary journeymen and preserves their SPP when hired", async () => {
    const s = await setup();
    await s.t.run(async (ctx) => {
      const players = await ctx.db
        .query("leaguePlayers")
        .withIndex("by_entryId", (q) => q.eq("entryId", s.entries[0]))
        .take(16);
      await ctx.db.patch("leaguePlayers", players[1]._id, {
        status: "missing-next-game",
      });
    });
    const report = await readyReport(s),
      view = await s.t.query(api.leagues.getMatch, { matchId: s.match._id }),
      journey = view.players.find(
        (p) => p.entryId === s.entries[0] && p.temporary,
      )!;
    expect(view.players.filter((p) => p.entryId === s.entries[0])).toHaveLength(
      12,
    );
    expect(view.match.homeSnapshot!.players).toHaveLength(12);
    expect(journey.skills).toContain("loner:4+");
    const revision = await report.home.mutation(api.leagues.updateMatchPlayer, {
      matchId: s.match._id,
      playerId: journey.playerId,
      stats: { ...emptyPlayerStats(), com: 2 },
      expectedRevision: report.revision,
    });
    await report.home.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: revision,
    });
    await report.away.mutation(api.leagues.confirmMatch, {
      matchId: s.match._id,
      expectedRevision: revision,
    });
    let career = await s.t.query(api.leagues.getCareer, {
      entryId: s.entries[0],
    });
    expect(
      career.players
        .filter((p) => !p.temporary)
        .every((p) => p.status === "active"),
    ).toBe(true);
    expect(
      career.players.find((p) => p._id === journey.playerId)?.canHireJourneyman,
    ).toBe(true);
    await report.home.mutation(api.leagues.hireJourneyman, {
      playerId: journey.playerId,
      expectedRevision: career.entry.revision,
    });
    career = await s.t.query(api.leagues.getCareer, { entryId: s.entries[0] });
    expect(
      career.players.find((p) => p._id === journey.playerId),
    ).toMatchObject({
      temporary: false,
      sppEarned: 2,
      skills: [],
      status: "active",
    });
  });
  it("adjudicates unplayed results without invented player stats and preserves records on withdrawal", async () => {
    const s = await setup(3),
      detail = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    const match = detail.matches.find((m) => m.awayEntryId)!;
    await expect(
      s.admin.mutation(api.leagues.adjudicateMatch, {
        matchId: match._id,
        outcome: "home-win",
        reason: "No cooperation",
        expectedRevision: match.revision,
      }),
    ).rejects.toThrow("FORBIDDEN");
    await s.coaches[0].mutation(api.leagues.adjudicateMatch, {
      matchId: match._id,
      outcome: "home-win",
      reason: "No cooperation",
      expectedRevision: match.revision,
    });
    let after = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    expect(
      after.entries.find((e) => e._id === match.homeEntryId)?.stats,
    ).toMatchObject({ pts: 3, mp: 1, tdFor: 0, casFor: 0 });
    expect(
      after.playerStats.every((p) => p.sppEarned === 0 && p.stats.mp === 0),
    ).toBe(true);
    expect(
      after.standings.find((e) => e.entryId === match.homeEntryId),
    ).toMatchObject({ w: 1, d: 0, latest: ["W"], winDrawPercent: 1, cu: 3 });
    await s.coaches[0].mutation(api.leagues.withdrawEntry, {
      entryId: match.homeEntryId,
      reason: "Coach withdrew",
    });
    after = await s.t.query(api.leagues.get, { leagueId: s.leagueId });
    expect(
      after.entries.find((e) => e._id === match.homeEntryId),
    ).toMatchObject({ withdrawn: true, stats: { pts: 3 } });
    expect(
      after.matches.find((m) => m._id === match._id)?.administrativeResult,
    ).toBe("home-win");
    expect(
      after.matches
        .filter(
          (m) =>
            (m.homeEntryId === match.homeEntryId ||
              m.awayEntryId === match.homeEntryId) &&
            m._id !== match._id &&
            m.awayEntryId,
        )
        .every((m) => m.status === "void"),
    ).toBe(true);
  });
  it("omits withdrawals before launching a new draw", async () => {
    const s = await setup(3),
      id = await s.coaches[0].mutation(api.leagues.create, {
        name: "New season",
        startAt: 0,
      });
    const entries = [];
    for (let i = 0; i < 3; i++)
      entries.push(
        await s.coaches[i].mutation(api.leagues.register, {
          leagueId: id,
          teamUuid: s.teams[i].uuid,
        }),
      );
    await s.coaches[0].mutation(api.leagues.withdrawEntry, {
      entryId: entries[2],
      reason: "Unavailable",
    });
    await s.coaches[0].mutation(api.leagues.launch, { leagueId: id });
    const detail = await s.t.query(api.leagues.get, { leagueId: id });
    expect(detail.entries).toHaveLength(3);
    expect(detail.matches).toHaveLength(1);
    expect(detail.matches[0].homeEntryId).not.toBe(entries[2]);
    expect(detail.matches[0].awayEntryId).not.toBe(entries[2]);
    expect(
      (await s.coaches[2].query(api.leagues.getCareer, { entryId: entries[2] }))
        .canManage,
    ).toBe(false);
  });
});
