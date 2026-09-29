import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { teamValidator } from "./validators";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  teams: defineTable({
    ownerId: v.id("users"),
    uuid: v.string(),
    team: teamValidator,
    revision: v.number(),
    legal: v.boolean(),
    updatedAt: v.number(),
    archived: v.boolean(),
  })
    .index("by_uuid", ["uuid"])
    .index("by_ownerId_and_archived", ["ownerId", "archived"]),
});
