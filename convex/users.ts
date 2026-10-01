import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { currentUser, requireAdmin, roleValidator } from "./roles";
import { presence, ROOM_ID } from "./presence";

const profile = v.object({
  id: v.id("users"),
  name: v.union(v.string(), v.null()),
  image: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  role: roleValidator,
});

export const viewer = query({
  args: {},
  returns: v.union(profile, v.null()),
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return user
      ? {
          id: user._id,
          name: user.name ?? null,
          image: user.image ?? null,
          email: user.email ?? null,
          role: user.role ?? "user",
        }
      : null;
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    profile.extend({
      joinedAt: v.number(),
      online: v.boolean(),
      lastSeenAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const admin = await requireAdmin(ctx);
    if (
      !Number.isSafeInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 30
    )
      throw new ConvexError("INVALID_INPUT");
    const result = await ctx.db
      .query("users")
      .withIndex("by_creation_time")
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page
        .filter((user) => user._id !== admin._id)
        .map(async (user) => {
          const state = (await presence.listUser(ctx, user._id, false, 1)).find(
            (entry) => entry.roomId === ROOM_ID,
          );
          return {
            id: user._id,
            name: user.name ?? null,
            image: user.image ?? null,
            email: user.email ?? null,
            role: user.role ?? "user",
            joinedAt: user._creationTime,
            online: state?.online ?? false,
            lastSeenAt: state?.lastDisconnected || null,
          };
        }),
    );
    return { ...result, page };
  },
});

// Dashboard / internal calls only. There is deliberately no public admin setter.
export const setAdmin = internalMutation({
  args: { userId: v.id("users"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, enabled }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError("NOT_FOUND");
    await ctx.db.patch("users", userId, { role: enabled ? "admin" : "user" });
    return null;
  },
});
