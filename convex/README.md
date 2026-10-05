# Convex backend

Read `_generated/ai/guidelines.md` before editing backend code.

- `schema.ts` defines authenticated users and teams. UUID and owner/archive indexes support public lookups and paginated account listings. Roster/ruleset indexes and a full-text search index support library filters.
- `teams.ts` exposes owner-scoped listing and saving, public UUID views, the authenticated viewer ID, and reversible archive/restore. Each save verifies ownership and revision and computes legality from the shared catalog. Public views omit owner and auth records.
- `validators.ts` defines the shared transport shape; `src/domain/types.ts` applies strict domain validation. Costs and legal status are never accepted from the client.
- `auth.ts`, `telegram.ts` and `http.ts` implement Telegram OIDC and the optional bot webhook.

Guest drafts are browser-local. Signing in uploads all guest drafts through the same authenticated save mutation as the editor. Local recovery copies are account-scoped and removed only after their exact contents have been acknowledged.

Signed-in creation and copying save directly to Convex. The editor keeps only unsaved recovery snapshots in browser storage, each with its own base revision and account. Never replace that base with the latest revision from another tab: doing so bypasses conflict protection. Idle editors follow Convex subscriptions; dirty editors retain their changes until acknowledged or explicitly discarded. A conflict offers loading the saved version or copying the edits into a new team. Recovery drafts can also be discarded from the signed-in library to reveal the saved team and its archive control.

Origin-scoped Web Locks keep background uploads from racing open editors. Concurrent editors still use Convex revision checks; storage locks are not authorization or a substitute for server transactions. A cloud acknowledgement remains successful even if browser cleanup fails, and the background uploader does not repeatedly send an acknowledged snapshot. Archiving is reversible and idempotent; pending saves cannot restore an archived team.

Run `pnpm dev` to watch Convex and Next.js together during development. Run the root checks and tests before deployment. Pushing to GitHub `main` starts Vercel’s combined Convex/frontend production build. Confirm the intended deployment before any manual `pnpm exec convex deploy -y`. Generated files are managed by Convex; credentials belong in deployment environment variables.
