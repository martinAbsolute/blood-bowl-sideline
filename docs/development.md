# Development and deployment

## Run locally

Use Node.js 24 and the pnpm version pinned in `package.json`, plus your own Convex development deployment.

```sh
corepack enable
pnpm install --frozen-lockfile
vercel env pull .env.local --environment development
pnpm dev
```

This command configures and syncs Convex first, then runs its watcher and Next.js together using [Convex's `--start` option](https://docs.convex.dev/cli/reference/dev). Pull the Vercel Development environment to use its development `CONVEX_DEPLOY_KEY`; Convex adds the deployment URLs to `.env.local`. See [.env.example](../.env.example). Both processes stop with Ctrl-C. Use `pnpm dev:frontend` or `pnpm dev:backend` to run either server independently.

Open [localhost:3000](http://localhost:3000). Guest team building works without Telegram credentials. To enable sign-in, configure `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`, `JWT_PRIVATE_KEY`, and `JWKS` in your Convex deployment, and set its `SITE_URL` to `http://localhost:3000`. For local HTTP sites, OAuth automatically uses Convex's HTTPS callback. Register that callback with Telegram. The frontend checks credential availability in Convex when signing in.

For local and preview testing without Telegram, enable [development sign-in](development-auth.md) on both servers. The account menu creates two test coaches and can switch between existing users through normal authenticated sessions. Vercel production flags disable the route; Convex independently checks its opt-in type, deployment binding and secret.

## Users and access control

Accounts have either the `admin` or `user` role. Existing accounts without a stored role are treated as users. Admins can edit and archive any team without changing its owner, and can view `/users`. The directory excludes the current admin, loads every account in batches, and sorts online users first, then by most recent activity. Convex's presence component handles multiple tabs, disconnects, and session timeouts. Accounts without recorded activity are displayed with that status.

To grant admin access, open the intended deployment in the Convex dashboard, copy the account's ID from the `users` table, and run the internal mutation `users:setAdmin`:

```json
{ "userId": "<users document ID>", "enabled": true }
```

Run it with `enabled: false` to restore the user role. This mutation is internal and cannot be invoked through the public client API. No role controls are exposed in the UI. Commissioner permissions derive from league ownership; a commissioner can also be a participating coach, and there is no global organizer role. `/leagues` lists competitions, while existing roster-affiliation references retain their URLs. Tournaments remains disabled in navigation.

## Stack and project layout

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, and Magic UI power the frontend. Convex provides authentication and reactive persistence; `next-intl` provides local English and Ukrainian messages, ICU pluralization, and locale-aware formatting. The `bbs_locale` cookie stores the language preference; routes are shared across languages. Vercel Web Analytics and Speed Insights are mounted in the root layout.

| Directory               | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `src/app/`              | Routes, metadata, sitemap, robots, and application icons            |
| `src/components/`       | Application UI and installed vendor components                      |
| `src/domain/`           | Shared factual catalogs, costs, and roster validation               |
| `src/lib/`              | Browser drafts, account synchronization, and utilities              |
| `src/i18n/`             | English and Ukrainian dictionaries                                  |
| `convex/`               | Telegram authentication, owner-scoped writes, and public team views |
| `tests/`                | Rules, authentication, ownership, translations, and team flows      |
| `docs/`                 | Rules provenance and component notes                                |
| `public/brand/`         | Brand artwork                                                       |
| `public/assets/fumbbl/` | Player artwork, source manifest, and attribution                    |

Both the browser and backend compute costs and validate teams from the same catalog. Cloud writes require authenticated ownership. Public UUID views omit owner IDs and authentication records; archived teams hide their public links. Read [rules provenance](rules-sources.md) before changing factual data and [backend notes](../convex/README.md) before changing persistence.

## Deployment

The live application is [sideline.com.ua](https://sideline.com.ua/). The linked Vercel project deploys GitHub `main`; its production build deploys Convex functions and builds the frontend together. [vercel.json](../vercel.json) defines the command:

```sh
pnpm exec convex deploy --cmd 'pnpm run build'
```

For your own deployment, import your fork into Vercel and connect your own Convex project. The only manually configured Vercel variable is `CONVEX_DEPLOY_KEY`: use a production deploy key for Production and a preview deploy key for Preview. Use the development deploy key for Development and pull it into `.env.local` for `pnpm dev`.

Keep Vercel's Automatically expose System Environment Variables enabled. Metadata and sitemap URLs use `VERCEL_PROJECT_PRODUCTION_URL`, with `http://localhost:3000` for local development. Convex supplies `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` to the build, so neither needs to be defined manually on Vercel. The auth proxy uses that HTTP endpoint directly. Telegram readiness comes from Convex credentials rather than a frontend flag.

Configure authentication secrets in Convex as described above. Set `SITE_URL` to the hosted application's public HTTPS origin in the corresponding Convex deployment. The Convex Auth package patch in `patches/` uses this value for both redirects and the frontend OAuth proxy. Register that origin's `/api/auth/callback/telegram` with Telegram. These settings remain in Convex because Vercel's system variables are not available inside Convex functions. The optional bot webhook also needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in Convex.

The production origin is `https://sideline.com.ua`: set Convex `SITE_URL` to this value, and register `https://sideline.com.ua/api/auth/callback/telegram` in Telegram's Allowed URLs. Vercel redirects `sideline.com.ua` and the previous Vercel domain to `sideline.com.ua`.

Preview builds deploy an isolated Convex preview backend for the Git branch. Set required auth signing keys and optional Telegram credentials in Convex preview environment defaults; never expose the production deploy key to Preview. Preview metadata and robots prevent indexing. The sitemap includes public reference pages and the builder entry, while UUID team pages carry `noindex`.

Enable **Web Analytics** and **Speed Insights** for the Vercel project in its dashboard; the application already includes both SDKs. See Vercel's [Analytics setup](https://vercel.com/docs/analytics/quickstart) and [Speed Insights setup](https://vercel.com/docs/speed-insights/quickstart).

GitHub Actions runs formatting, type checking, linting, tests, and a frontend build. To release, bump the version in `package.json` (shown in the footer), run the local checks, and push to `main`:

```sh
pnpm format:check
pnpm check
pnpm test
pnpm build
git push origin main
```

Never commit `.env` files, deploy keys, Telegram tokens, auth payloads, or signing keys. [.env.example](../.env.example) contains safe placeholders only.
