# Blood Bowl Sideline

**Your Blood Bowl sideline, from the first roster to the final whistle.**

A home for building and sharing teams, managing player advancements, tracking games, and running leagues and tournaments. Made with love for the Ukrainian Blood Bowl community, with an English and Ukrainian interface.

**[Open Blood Bowl Sideline](https://blood-bowl-sideline.vercel.app/)** · [Contributing](CONTRIBUTING.md) · [License](LICENSE) · [Attribution](NOTICE.md)

![Blood Bowl Sideline](src/app/opengraph-image.png)

## Teams, players, and the season ahead

Build a team around your play style, compare players and star hires, and keep your roster close at hand on game day. Sideline brings roster planning, team sharing, player development, match records, and competition management into one community workspace.

The roster builder includes:

- All 31 BB2025 rosters, player and star-player references, skill definitions, inducements, and special-rule help.
- Default, Matched Play, EuroBowl 2026, and NAF World Cup 2027 v2.1 presets, with shared validation of budgets, skills, and eligibility.
- Guest drafts that save on your device; Telegram sign-in brings all guest teams into your account library.
- Automatic cloud saving with account-scoped recovery copies for unfinished or failed edits.
- Team search, filters, duplication, archiving, and shareable UUID links. Owners edit their teams; visitors see the public roster.
- Portrait and landscape printouts with full skill references and clearly marked advancements.
- English and Ukrainian, with a persistent language choice.

## Run locally

Use Node.js 24 and the pnpm version pinned in `package.json`, plus your own Convex development deployment.

```sh
corepack enable
pnpm install --frozen-lockfile
vercel env pull .env.local --environment development
pnpm dev
```

This command configures and syncs Convex first, then runs its watcher and Next.js together using [Convex's `--start` option](https://docs.convex.dev/cli/reference/dev). Pull the Vercel Development environment to use its development `CONVEX_DEPLOY_KEY`; Convex adds the deployment URLs to `.env.local`. See [.env.example](.env.example). Both processes stop with Ctrl-C. Use `pnpm dev:frontend` or `pnpm dev:backend` to run either server independently.

Open [localhost:3000](http://localhost:3000). Guest team building works without Telegram credentials. To enable sign-in, configure `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`, `JWT_PRIVATE_KEY`, and `JWKS` in your Convex deployment, and set its `SITE_URL` to `http://localhost:3000`. Leave `CUSTOM_AUTH_SITE_URL` unset locally so OAuth uses Convex's HTTPS callback. Register that callback with Telegram. The frontend checks credential availability in Convex when signing in.

## Stack and project layout

Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, and Magic UI power the frontend. Convex provides authentication and reactive persistence; `gt-next` uses local English and Ukrainian dictionaries. Vercel Web Analytics and Speed Insights are mounted in the root layout.

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

Both the browser and backend compute costs and validate teams from the same catalog. Cloud writes require authenticated ownership. Public UUID views omit owner IDs and authentication records; archived teams hide their public links. Read [rules provenance](docs/rules-sources.md) before changing factual data and [backend notes](convex/README.md) before changing persistence.

## Deployment

The live application is [blood-bowl-sideline.vercel.app](https://blood-bowl-sideline.vercel.app/). The linked Vercel project deploys GitHub `main`; its production build deploys Convex functions and builds the frontend together. [vercel.json](vercel.json) defines the command:

```sh
pnpm exec convex deploy --cmd 'pnpm run build'
```

For your own deployment, import your fork into Vercel and connect your own Convex project. The only manually configured Vercel variable is `CONVEX_DEPLOY_KEY`: use a **production deploy key** for Production and a **preview deploy key** for Preview. Use the **development deploy key** for Development and pull it into `.env.local` for `pnpm dev`.

Keep Vercel's **Automatically expose System Environment Variables** enabled. Metadata and sitemap URLs use `VERCEL_PROJECT_PRODUCTION_URL`, with `http://localhost:3000` for local development. Convex supplies `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` to the build, so neither needs to be defined manually on Vercel. The auth proxy uses that HTTP endpoint directly. Telegram readiness comes from Convex credentials rather than a frontend flag.

Configure authentication secrets in Convex as described above. Convex Auth requires `SITE_URL` for redirects and `CUSTOM_AUTH_SITE_URL` for the frontend OAuth proxy; configure both to the hosted application's public origin in the corresponding Convex deployment. Register that origin's `/api/auth/callback/telegram` with Telegram. These settings remain in Convex because Vercel's system variables are not available inside Convex functions. The optional bot webhook also needs `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in Convex.

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

Never commit `.env` files, deploy keys, Telegram tokens, auth payloads, or signing keys. [.env.example](.env.example) contains safe placeholders only.

## Contributing and forks

**Forking is welcome**, and so are issues and pull requests. Report bugs, suggest improvements, help with translations, or adapt Sideline for your community. See [CONTRIBUTING.md](CONTRIBUTING.md) for practical steps. This is a community project maintained as time allows; there is no guaranteed response, review, support, or release schedule.

## License and credits

Copyright © 2026 martinAbsolute. Original project code and documentation are licensed under **GNU AGPL-3.0-only**, with the attribution-preservation term in [NOTICE.md](NOTICE.md). Keep credit and a link back to this project in distributed copies and appropriate legal notices. Hosted modified versions must provide their corresponding source under the AGPL.

Blood Bowl is a trademark of Games Workshop. This independent community project is not affiliated with, endorsed by, or sponsored by Games Workshop or FUMBBL. Game names, rules, and third-party artwork remain subject to their respective rights; this project's license does not grant rights to them.

Player icons come from the **[FUMBBL community icon collection](https://fumbbl.com/p/icons)**. Source URLs, labels, checksums, and crop mappings are preserved in the asset manifest. See the [player artwork notes](public/assets/fumbbl/README.md) and [third-party notices](THIRD_PARTY_NOTICES.md); attribution does not relicense that artwork.

Created by [martinAbsolute on GitHub](https://github.com/martinAbsolute/) · [@martinAbsolute on Telegram](https://t.me/martinAbsolute).
