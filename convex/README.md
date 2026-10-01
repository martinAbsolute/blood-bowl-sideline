# Convex backend

Read `_generated/ai/guidelines.md` before editing backend code.

- `schema.ts` defines authenticated users and teams. UUID and owner/archive indexes support public lookups and paginated account listings. Roster/ruleset indexes and a full-text search index support library filters.
- `teams.ts` exposes owner-scoped listing and saving, public UUID views, the authenticated viewer ID, and reversible archive/restore. Each save verifies ownership and revision and computes legality from the shared catalog. Public views omit owner and auth records.
- `validators.ts` defines the shared transport shape; `src/domain/types.ts` applies strict domain validation. Costs and legal status are never accepted from the client.
- `auth.ts`, `telegram.ts` and `http.ts` implement Telegram OIDC and the optional bot webhook.

Guest drafts are browser-local. Signing in uploads all guest drafts through the same authenticated save mutation as the editor. Local recovery copies are account-scoped and removed only after their exact contents have been acknowledged.

Run `pnpm dev` to watch Convex and Next.js together during development. Run the root checks and tests before deployment. Pushing to GitHub `main` starts Vercel’s combined Convex/frontend production build. Confirm the intended deployment before any manual `pnpm exec convex deploy -y`. Generated files are managed by Convex; credentials belong in deployment environment variables.
