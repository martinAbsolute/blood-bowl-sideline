<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Blood Bowl Sideline project rules

- Frontend code belongs in `src/`. Backend code belongs in `convex/`.
- `src/components/ui/` and `src/components/magic-ui/` contain installed vendor components. **Do not directly modify files in either folder.** Compose or wrap them in other components and override presentation with Tailwind classes. Official registry reinstallation for upgrades is allowed; never patch vendor implementations.
- Keep rules and factual catalogs in `src/domain/`. Both the browser and Convex must use the same validator and compute all costs from the catalog. Never trust client-supplied costs, legal status, owner IDs, or revision numbers.
- Read `docs/rules-sources.md` before changing roster or tournament rules. Ruleset revisions are explicit; do not silently apply new rules to old snapshots.
- English is the source language. Use `gt-next` and keep `src/i18n/en.json` and `src/i18n/uk.json` complete. Proper skill and player names may remain English to match the Ukrainian reference.
- Anonymous teams are browser-local drafts. Convex writes require authenticated ownership. UUID links expose only the intended public team view, never Telegram IDs or auth records.
- League and tournament-running features are future work. Do not add scaffolding for those features until requested.
- Before shipping, run `npm run check`, `npm test`, `npm run build`, and deploy Convex functions. Verify roster creation, ruleset switches, draft restoration, English/Ukrainian switching, and UUID pages in a browser.
- Never commit `.env*`, research assets, bot tokens, authentication payloads, or signing keys. `.env.example` contains names and safe placeholders only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
