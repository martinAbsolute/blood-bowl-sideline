import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** Existing career records also establish experience for teams enrolled before this flag existed. */
export async function teamLeagueState(ctx: QueryCtx, team: Doc<"teams">) {
  let leagueExperienced = team.leagueExperienced ?? false;
  const careers = ctx.db
    .query("leagueTeams")
    .withIndex("by_teamId", (q) => q.eq("teamId", team._id));
  for await (const entry of careers) {
    leagueExperienced = true;
    if (entry.withdrawn) continue;
    const league = await ctx.db.get("leagues", entry.leagueId);
    if (league && league.status !== "completed")
      return { leagueLocked: true, leagueExperienced };
  }
  return { leagueLocked: false, leagueExperienced };
}
