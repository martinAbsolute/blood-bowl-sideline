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
    searchText: v.optional(v.string()),
  })
    .index("by_uuid", ["uuid"])
    .index("by_ownerId_and_archived", ["ownerId", "archived"])
    .index("by_owner_archive_roster", ["ownerId", "archived", "team.rosterId"])
    .index("by_owner_archive_ruleset", [
      "ownerId",
      "archived",
      "team.rulesetId",
    ])
    .index("by_owner_archive_roster_ruleset", [
      "ownerId",
      "archived",
      "team.rosterId",
      "team.rulesetId",
    ])
    .searchIndex("search_library", {
      searchField: "searchText",
      filterFields: ["ownerId", "archived", "team.rosterId", "team.rulesetId"],
    }),
});
