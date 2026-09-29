import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { publicTeam, teamValidator } from "./validators";
import { teamSchema } from "../src/domain/types";
import { getRoster } from "../src/domain/catalog";
import { validateTeam } from "../src/domain/rules";

export const getByUuid = query({
  args: { uuid: v.string() },
  returns: v.union(v.null(), publicTeam),
  handler: async (ctx, { uuid }) => {
    if (!/^[a-f\d-]{36}$/i.test(uuid)) return null;
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || doc.archived) return null;
    const owner = await getAuthUserId(ctx);
    return {
      team: doc.team,
      revision: doc.revision,
      legal: doc.legal,
      updatedAt: doc.updatedAt,
      canEdit: owner === doc.ownerId,
    };
  },
});
export const listMine = query({
  args: { paginationOpts: paginationOptsValidator, archived: v.boolean() },
  returns: v.object({
    page: v.array(publicTeam),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, { paginationOpts, archived }) => {
    const owner = await getAuthUserId(ctx);
    if (!owner) throw new ConvexError("UNAUTHENTICATED");
    const result = await ctx.db
      .query("teams")
      .withIndex("by_ownerId_and_archived", (q) =>
        q.eq("ownerId", owner).eq("archived", archived),
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 30),
      });
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
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new ConvexError("UNAUTHENTICATED");
    const parsed = teamSchema.safeParse(args.team);
    if (!parsed.success || !getRoster(parsed.data.rosterId))
      throw new ConvexError("INVALID_TEAM");
    const team = parsed.data;
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", team.uuid))
      .unique();
    if (existing && existing.ownerId !== ownerId)
      throw new ConvexError("FORBIDDEN");
    if ((existing?.revision ?? 0) !== args.expectedRevision)
      throw new ConvexError("CONFLICT");
    if (existing?.archived) throw new ConvexError("ARCHIVED");
    const revision = (existing?.revision ?? 0) + 1,
      updatedAt = Date.now(),
      legal = validateTeam(team).valid;
    if (existing)
      await ctx.db.patch(existing._id, { team, revision, updatedAt, legal });
    else
      await ctx.db.insert("teams", {
        ownerId,
        uuid: team.uuid,
        team,
        revision,
        updatedAt,
        legal,
        archived: false,
      });
    return { team, revision, updatedAt, legal, canEdit: true };
  },
});
export const setArchived = mutation({
  args: { uuid: v.string(), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { uuid, archived }) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new ConvexError("UNAUTHENTICATED");
    const doc = await ctx.db
      .query("teams")
      .withIndex("by_uuid", (q) => q.eq("uuid", uuid))
      .unique();
    if (!doc || doc.ownerId !== ownerId) throw new ConvexError("FORBIDDEN");
    await ctx.db.patch(doc._id, {
      archived,
      updatedAt: Date.now(),
      revision: doc.revision + 1,
    });
    return null;
  },
});
