import { getAuthUserId } from "@convex-dev/auth/server";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { publicTeam, teamValidator } from "./validators";
import { teamSchema } from "../src/domain/types";
import { z } from "zod";
import { getRoster, getRuleset } from "../src/domain/catalog";
import { teamSaveIssues, validateTeam } from "../src/domain/rules";
import { currentUser, requireUser } from "./roles";

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
    return {
      team: doc.team,
      revision: doc.revision,
      legal: doc.legal,
      updatedAt: doc.updatedAt,
      canEdit: viewer?._id === doc.ownerId || viewer?.role === "admin",
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
    rosterId: v.optional(v.string()),
    rulesetId: v.optional(teamValidator.fields.rulesetId),
  },
  returns: paginationResultValidator(publicTeam),
  handler: async (
    ctx,
    { paginationOpts, archived, search, rosterId, rulesetId },
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
    const table = ctx.db.query("teams");
    const source = text
      ? table.withSearchIndex("search_library", (q) => {
          let filter = q
            .search("searchText", text)
            .eq("ownerId", owner)
            .eq("archived", archived);
          if (rosterId) filter = filter.eq("team.rosterId", rosterId);
          if (rulesetId) filter = filter.eq("team.rulesetId", rulesetId);
          return filter;
        })
      : rosterId && rulesetId
        ? table
            .withIndex("by_owner_archive_roster_ruleset", (q) =>
              q
                .eq("ownerId", owner)
                .eq("archived", archived)
                .eq("team.rosterId", rosterId)
                .eq("team.rulesetId", rulesetId),
            )
            .order("desc")
        : rosterId
          ? table
              .withIndex("by_owner_archive_roster", (q) =>
                q
                  .eq("ownerId", owner)
                  .eq("archived", archived)
                  .eq("team.rosterId", rosterId),
              )
              .order("desc")
          : rulesetId
            ? table
                .withIndex("by_owner_archive_ruleset", (q) =>
                  q
                    .eq("ownerId", owner)
                    .eq("archived", archived)
                    .eq("team.rulesetId", rulesetId),
                )
                .order("desc")
            : table
                .withIndex("by_ownerId_and_archived", (q) =>
                  q.eq("ownerId", owner).eq("archived", archived),
                )
                .order("desc");
    const result = await source.paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((d) => ({
        team: d.team,
        revision: d.revision,
        legal: d.legal,
        updatedAt: d.updatedAt,
        canEdit: true,
      })),
    };
  },
});
export const save = mutation({
  args: { team: teamValidator, expectedRevision: v.number() },
  returns: publicTeam,
  handler: async (ctx, args) => {
    const viewer = await requireUser(ctx);
    const ownerId = viewer._id;
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 0
    )
      throw new ConvexError("INVALID_INPUT");
    const parsed = teamSchema.safeParse(args.team);
    if (!parsed.success || !getRoster(parsed.data.rosterId))
      throw new ConvexError("INVALID_TEAM");
    const team = {
      ...parsed.data,
      notes: "",
    };
    if (teamSaveIssues(team).length) throw new ConvexError("INVALID_TEAM");
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
      .unique();
    if (existing && existing.ownerId !== ownerId && viewer.role !== "admin")
      throw new ConvexError("FORBIDDEN");
    if ((existing?.revision ?? 0) !== args.expectedRevision)
      throw new ConvexError("CONFLICT");
    if (existing?.archived) throw new ConvexError("ARCHIVED");
    const revision = (existing?.revision ?? 0) + 1,
      updatedAt = Date.now(),
      legal = validateTeam(team).valid;
    const searchText = [
      team.name,
      getRoster(team.rosterId)!.name,
      getRuleset(team.rulesetId).name,
    ].join(" ");
    if (existing)
      await ctx.db.patch(existing._id, {
        team,
        revision,
        updatedAt,
        legal,
        searchText,
      });
    else
      await ctx.db.insert("teams", {
        ownerId,
        uuid: team.uuid,
        team,
        revision,
        updatedAt,
        legal,
        archived: false,
        searchText,
      });
    return { team, revision, updatedAt, legal, canEdit: true };
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
    await ctx.db.patch(doc._id, {
      archived,
      updatedAt: Date.now(),
      revision: doc.revision + 1,
    });
    return null;
  },
});
