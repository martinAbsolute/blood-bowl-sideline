import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const BATCH_SIZE = 16;

/** The parent league is removed first, so no new league writes can race this sweep. */
export const sweep = internalMutation({
  args: {
    leagueId: v.id("leagues"),
    teamIds: v.array(v.id("teams")),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const continueSweep = async () => {
      await ctx.scheduler.runAfter(0, internal.leagueDeletion.sweep, args);
      return null;
    };
    const match = await ctx.db
      .query("leagueMatches")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .first();
    if (match) {
      const playEvents = await ctx.db
        .query("leaguePlayEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
        .take(BATCH_SIZE);
      if (playEvents.length) {
        for (const row of playEvents)
          await ctx.db.delete("leaguePlayEvents", row._id);
        return continueSweep();
      }
      const matchPlayers = await ctx.db
        .query("leagueMatchPlayers")
        .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
        .take(BATCH_SIZE);
      if (matchPlayers.length) {
        for (const row of matchPlayers)
          await ctx.db.delete("leagueMatchPlayers", row._id);
        return continueSweep();
      }
      const matchEvents = await ctx.db
        .query("leagueMatchEvents")
        .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
        .take(BATCH_SIZE);
      if (matchEvents.length) {
        for (const row of matchEvents)
          await ctx.db.delete("leagueMatchEvents", row._id);
        return continueSweep();
      }
      await ctx.db.delete("leagueMatches", match._id);
      return continueSweep();
    }

    const players = await ctx.db
      .query("leaguePlayers")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .take(BATCH_SIZE);
    if (players.length) {
      for (const row of players) await ctx.db.delete("leaguePlayers", row._id);
      return continueSweep();
    }
    const rounds = await ctx.db
      .query("leagueRounds")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .take(BATCH_SIZE);
    if (rounds.length) {
      for (const row of rounds) await ctx.db.delete("leagueRounds", row._id);
      return continueSweep();
    }
    const audit = await ctx.db
      .query("leagueAudit")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .take(BATCH_SIZE);
    if (audit.length) {
      for (const row of audit) await ctx.db.delete("leagueAudit", row._id);
      return continueSweep();
    }
    const entries = await ctx.db
      .query("leagueTeams")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", args.leagueId))
      .take(BATCH_SIZE);
    if (entries.length) {
      for (const row of entries) await ctx.db.delete("leagueTeams", row._id);
      return continueSweep();
    }
    const drafts = await ctx.db
      .query("teams")
      .withIndex("by_draftLeagueId", (q) =>
        q.eq("draftLeagueId", args.leagueId),
      )
      .take(BATCH_SIZE);
    if (drafts.length) {
      for (const row of drafts)
        await ctx.db.patch("teams", row._id, { draftLeagueId: undefined });
      return continueSweep();
    }
    for (const teamId of args.teamIds) {
      if (!(await ctx.db.get("teams", teamId))) continue;
      const otherEntry = await ctx.db
        .query("leagueTeams")
        .withIndex("by_teamId", (q) => q.eq("teamId", teamId))
        .first();
      await ctx.db.patch("teams", teamId, {
        leagueExperienced: otherEntry !== null,
      });
    }
    return null;
  },
});
