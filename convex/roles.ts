import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "./_generated/server";

export const roleValidator = v.union(v.literal("admin"), v.literal("user"));

export async function currentUser(ctx: QueryCtx) {
  const id = await getAuthUserId(ctx);
  return id ? ctx.db.get("users", id) : null;
}

export async function requireUser(ctx: QueryCtx) {
  const user = await currentUser(ctx);
  if (!user) throw new ConvexError("UNAUTHENTICATED");
  return user;
}

export async function requireAdmin(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw new ConvexError("FORBIDDEN");
  return user;
}
