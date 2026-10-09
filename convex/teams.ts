import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { publicTeam, teamValidator } from "./validators";
import {
  RULES_VERSION,
  teamSchema,
  upgradeTeamRules,
} from "../src/domain/types";
import { z } from "zod";
import { getRoster, getRuleset } from "../src/domain/catalog";
import { teamSaveIssues, validateTeam } from "../src/domain/rules";
import { currentUser, requireUser } from "./roles";
import { teamLeagueState } from "./teamLeagueState";

// Catalog corrections must not delete saved teams or silently keep an obsolete
// legal badge. Reads project a current draft without mutating the stored row or
// historical league snapshots. Normal revision-checked saves persist upgrades.
async function currentDraft(ctx: QueryCtx, doc: Doc<"teams">) {
  if (doc.team.rulesVersion === RULES_VERSION)
    return { team: doc.team, legal: doc.legal };
  const team = upgradeTeamRules(doc.team);
  const league = doc.draftLeagueId
    ? await ctx.db.get("leagues", doc.draftLeagueId)
    : null;
  return { team, legal: validateTeam(team, league?.startingTreasury).valid };
}

export const getByUuid = query({
  args: { uuid: v.string() },
  returns: v.union(v.null(), publicTeam),
  handler: async (ctx, { uuid }) => {
    if (!z.uuid().safeParse(uuid).success) return null;
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || doc.archived) return null;
    const viewer = await currentUser(ctx);
    const leagueState = await teamLeagueState(ctx, doc);
    return {
      ...(await currentDraft(ctx, doc)),
      favorite: viewer?._id === doc.ownerId ? doc.favorite : undefined,
      draftLeagueId: doc.draftLeagueId,
      revision: doc.revision,
      updatedAt: doc.updatedAt,
      ...leagueState,
      canEdit:
        !leagueState.leagueLocked &&
        (viewer?._id === doc.ownerId || viewer?.role === "admin"),
    };
  },
});
export const viewer = query({
  args: {},
  returns: v.union(v.object({ id: v.id("users") }), v.null()),
  handler: async (ctx) => {
    const id = await getAuthUserId(ctx);
    if (!id) return null;
    const user = await ctx.db.get("users", id);
    return user ? { id } : null;
  },
});
export const listMine = query({
  args: {
    paginationOpts: paginationOptsValidator,
    archived: v.boolean(),
    search: v.optional(v.string()),
    favoritesOnly: v.optional(v.boolean()),
    rosterId: v.optional(v.string()),
    rulesetId: v.optional(teamValidator.fields.rulesetId),
  },
  returns: paginationResultValidator(publicTeam),
  handler: async (
    ctx,
    { paginationOpts, archived, search, rosterId, rulesetId, favoritesOnly },
  ) => {
    const owner = await getAuthUserId(ctx);
    if (!owner) throw new ConvexError("UNAUTHENTICATED");
    if (
      (search !== undefined && search.length > 160) ||
      (rosterId !== undefined && !getRoster(rosterId)) ||
      !Number.isSafeInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 30 ||
      [paginationOpts.maximumRowsRead, paginationOpts.maximumBytesRead].some(
        (limit) =>
          limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1),
      )
    )
      throw new ConvexError("INVALID_INPUT");
    const text = search?.trim();
    if (favoritesOnly && !text) throw new ConvexError("INVALID_INPUT");
    const table = ctx.db.query("teams");
    const source = text
      ? table.withSearchIndex("search_library", (q) => {
          let filter = q
            .search("searchText", text)
            .eq("ownerId", owner)
            .eq("archived", archived);
          if (rosterId) filter = filter.eq("team.rosterId", rosterId);
          if (rulesetId) filter = filter.eq("team.rulesetId", rulesetId);
          if (favoritesOnly) filter = filter.eq("favorite", true);
          return filter;
        })
      : rosterId && rulesetId
        ? table
            .withIndex(
              "by_ownerId_and_archived_and_roster_and_ruleset_and_favorite",
              (q) =>
                q
                  .eq("ownerId", owner)
                  .eq("archived", archived)
                  .eq("team.rosterId", rosterId)
                  .eq("team.rulesetId", rulesetId),
            )
            .order("desc")
        : rosterId
          ? table
              .withIndex(
                "by_ownerId_and_archived_and_roster_and_favorite",
                (q) =>
                  q
                    .eq("ownerId", owner)
                    .eq("archived", archived)
                    .eq("team.rosterId", rosterId),
              )
              .order("desc")
          : rulesetId
            ? table
                .withIndex(
                  "by_ownerId_and_archived_and_ruleset_and_favorite",
                  (q) =>
                    q
                      .eq("ownerId", owner)
                      .eq("archived", archived)
                      .eq("team.rulesetId", rulesetId),
                )
                .order("desc")
            : table
                .withIndex("by_ownerId_and_archived_and_favorite", (q) =>
                  q.eq("ownerId", owner).eq("archived", archived),
                )
                .order("desc");
    // Reactive pages can grow beyond numItems. Bound reads while preserving
    // endCursor/id and the native split metadata used by usePaginatedQuery.
    paginationOpts.maximumRowsRead = Math.min(
      paginationOpts.maximumRowsRead ?? 60,
      60,
    );
    paginationOpts.maximumBytesRead = Math.min(
      paginationOpts.maximumBytesRead ?? 512 * 1024,
      512 * 1024,
    );
    const result = await source.paginate(paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (d) => {
          const leagueState = await teamLeagueState(ctx, d);
          return {
            ...(await currentDraft(ctx, d)),
            favorite: d.favorite,
            draftLeagueId: d.draftLeagueId,
            revision: d.revision,
            updatedAt: d.updatedAt,
            ...leagueState,
            canEdit: !leagueState.leagueLocked,
          };
        }),
      ),
    };
  },
});
export const save = mutation({
  args: {
    team: teamValidator,
    expectedRevision: v.number(),
    // Only used on initial upload. Roster saves must not overwrite preferences.
    favorite: v.optional(v.boolean()),
    leagueId: v.optional(v.id("leagues")),
  },
  returns: publicTeam,
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    const ownerId = viewer._id;
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    )
      throw new ConvexError("INVALID_INPUT");
    // The shared schema enforces the same name limit as the editor, including
    // requests that bypass the UI. Never silently truncate a saved name.
    const parsed = teamSchema.safeParse(args.team);
    if (!parsed.success || !getRoster(parsed.data.rosterId))
      throw new ConvexError("INVALID_TEAM");
    const team = {
      ...upgradeTeamRules(parsed.data),
      notes: "",
    };
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
      .unique();
    if (
      !existing &&
      (await ctx.db
        .query("deletedTeams")
        .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
        .unique())
    )
      throw new ConvexError("ARCHIVED");
    if (existing && existing.ownerId !== ownerId && viewer.role !== "admin")
      throw new ConvexError("FORBIDDEN");
    // A draft keeps its league allowance across navigation and background saves.
    // Resolve the allowance from the league; never accept a client-supplied budget.
    const draftLeagueId = args.leagueId ?? existing?.draftLeagueId;
    const draftLeague = draftLeagueId
      ? await ctx.db.get("leagues", draftLeagueId)
      : null;
    if (draftLeagueId && !draftLeague) throw new ConvexError("INVALID_INPUT");
    if (teamSaveIssues(team, draftLeague?.startingTreasury).length)
      throw new ConvexError("INVALID_TEAM");
    const leagueState = existing
      ? await teamLeagueState(ctx, existing)
      : { leagueLocked: false, leagueExperienced: false };
    if (leagueState.leagueLocked) throw new ConvexError("TEAM_IN_LEAGUE");
    if (existing?.archived) throw new ConvexError("ARCHIVED");
    if ((existing?.revision ?? 0) !== args.expectedRevision) {
      // A lost response or a second uploader can repeat a committed snapshot.
      // Acknowledge it without advancing the revision or overwriting changes.
      if (
        existing &&
        existing.team.rulesVersion === RULES_VERSION &&
        !existing.archived &&
        args.expectedRevision < existing.revision &&
        JSON.stringify(teamSchema.parse(existing.team)) === JSON.stringify(team)
      )
        return {
          team: existing.team,
          favorite: existing.favorite,
          draftLeagueId: existing.draftLeagueId,
          revision: existing.revision,
          updatedAt: existing.updatedAt,
          legal: existing.legal,
          canEdit: true,
          ...leagueState,
        };
      throw new ConvexError("CONFLICT");
    }
    const revision = (existing?.revision ?? 0) + 1,
      updatedAt = Date.now(),
      legal = validateTeam(team, draftLeague?.startingTreasury).valid;
    const searchText = [
      team.name,
      getRoster(team.rosterId)!.name,
      getRuleset(team.rulesetId).name,
    ].join(" ");
    if (existing)
      await ctx.db.patch(existing._id, {
        team,
        draftLeagueId,
        revision,
        updatedAt,
        legal,
        searchText,
      });
    else
      await ctx.db.insert("teams", {
        favorite: args.favorite ? true : undefined,
        ownerId,
        uuid: team.uuid,
        team,
        draftLeagueId,
        revision,
        updatedAt,
        legal,
        archived: false,
        searchText,
      });
    return {
      team,
      favorite:
        existing?.favorite ?? (!existing && args.favorite ? true : undefined),
      draftLeagueId,
      revision,
      updatedAt,
      legal,
      canEdit: true,
      ...leagueState,
    };
  },
});
export const setArchived = mutation({
  args: { uuid: v.string(), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { uuid, archived }) => {
    const viewer = await requireUser(ctx);
    const ownerId = viewer._id;
    if (!z.uuid().safeParse(uuid).success)
      throw new ConvexError("INVALID_INPUT");
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || (doc.ownerId !== ownerId && viewer.role !== "admin"))
      throw new ConvexError("FORBIDDEN");
    if (archived && (await teamLeagueState(ctx, doc)).leagueLocked)
      throw new ConvexError("TEAM_IN_LEAGUE");
    if (archived && doc.favorite) throw new ConvexError("TEAM_FAVORITED");
    if (doc.archived === archived) return null;
    await ctx.db.patch(doc._id, {
      archived,
      updatedAt: Date.now(),
      revision: doc.revision + 1,
    });
    return null;
  },
});

export const setFavorite = mutation({
  args: { uuid: v.string(), favorite: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { uuid, favorite }) => {
    const viewer = await requireUser(ctx);
    if (!z.uuid().safeParse(uuid).success)
      throw new ConvexError("INVALID_INPUT");
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || doc.ownerId !== viewer._id) throw new ConvexError("FORBIDDEN");
    if (doc.archived) throw new ConvexError("ARCHIVED");
    // Preferences do not alter roster revisions or conflict with open editors.
    await ctx.db.patch(doc._id, { favorite: favorite ? true : undefined });
    return null;
  },
});

export const deleteArchived = mutation({
  args: { uuid: v.string() },
  returns: v.null(),
  handler: async (ctx, { uuid }) => {
    const viewer = await requireUser(ctx);
    if (!z.uuid().safeParse(uuid).success)
      throw new ConvexError("INVALID_INPUT");
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || doc.ownerId !== viewer._id) throw new ConvexError("FORBIDDEN");
    if (!doc.archived) throw new ConvexError("NOT_ARCHIVED");
    if ((await teamLeagueState(ctx, doc)).leagueLocked)
      throw new ConvexError("TEAM_IN_LEAGUE");
    // League entries retain their own team snapshots and match history.
    await ctx.db.insert("deletedTeams", { uuid });
    await ctx.db.delete("teams", doc._id);
    return null;
  },
});
export const isArchived = query({
  args: { uuid: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { uuid }) => {
    if (!z.uuid().safeParse(uuid).success) return false;
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (doc) return doc.archived;
    return (
      (await ctx.db
        .query("deletedTeams")
        .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
        .unique()) !== null
    );
  },
});
