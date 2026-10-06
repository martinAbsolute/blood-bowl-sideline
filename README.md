# Blood Bowl Sideline.

**Your Blood Bowl Sideline. From the first roster to the final whistle.**

A home for building and sharing teams, managing player advancements, tracking games, and running leagues and tournaments. Made with love for the Ukrainian Blood Bowl community, with an English and Ukrainian interface.

**[Open Blood Bowl Sideline](https://sideline.com.ua/)** · [Contributing](CONTRIBUTING.md) · [License](LICENSE) · [Attribution](NOTICE.md)

![Blood Bowl Sideline](src/app/opengraph-image.png)

## Teams, players, and the season ahead

Build a team around your play style, compare players and star hires, and keep your roster close at hand on game day. Sideline brings roster planning, team sharing, player development, match records, and competition management into one community workspace.

The roster builder includes:

- All 31 BB2025 rosters, player and star-player references, skill definitions, inducements, and special-rule help.
- Default, Matched Play, EuroBowl 2026, and NAF World Cup 2027 v2.1 presets, with shared validation of budgets, skills, and eligibility.
- Guest drafts that save on your device; Telegram sign-in brings all guest teams into your account library.
- Automatic cloud saving with account-scoped recovery copies for unfinished or failed edits.
- Team search, filters, duplication, and shareable UUID links. Owners and admins edit teams; visitors see the public roster. The expandable Archive loads on demand and supports restore or permanent deletion; archived and deleted team links return 404.
- Responsive sidebar navigation and an admin-only user directory with online and last-seen status.
- Portrait and landscape printouts with full skill references and clearly marked advancements.
- English and Ukrainian, with a persistent language choice.
- BB2025 leagues with rookie team registration, automatic round-robin fixtures, shared match reports, two-coach confirmation, official standings, player SPP and commissioner history.

## League play

Sign in through Telegram, open **Leagues**, and create a league. The creator is its commissioner and can register a team as a coach. Share the league link with the other participants; each registers a legal BB2025 starting team from their account. Launch the regular-season phase to generate the round robin. Two teams are enough for the minimum testing setup.

Both coaches fill the same match report during or after play, save their player statistics and match details, and confirm the current report. Both confirmations lock the official result and apply standings and player development once. The commissioner can review and correct locked reports with a recorded reason. Team progression, purchases and administrative changes remain in the league history.

Open the official league roster to spend earned SPP, manage the team and complete the post-game sequence. League rosters link to existing Teams but have their own sanctioned state; edits in the exhibition builder do not change official progression. The initial league workflow uses standard BB2025 and chosen skill advancements. See [the two-coach test guide](docs/league-testing.md), [league architecture](docs/league-play-design.md) and [league rules provenance](docs/league-rules-sources.md).

The commissioner can withdraw entrants, resolve unplayed fixtures and correct treasury balances with a recorded reason. Result corrections apply directly before either career progresses further; corrections with later dependencies require reconciliation and are rejected in this release. Random skills, characteristic advancement, automated concession consequences, season redrafting and venue-specific photo enforcement remain future work. Reports accept evidence links.

## Run locally

Use Node.js 24 and the pnpm version pinned in `package.json`, plus your own Convex development deployment.

```sh
corepack enable
pnpm install --frozen-lockfile
vercel env pull .env.local --environment development
pnpm dev
```

This command configures and syncs Convex first, then runs its watcher and Next.js together using [Convex's `--start` option](https://docs.convex.dev/cli/reference/dev). Pull the Vercel Development environment to use its development `CONVEX_DEPLOY_KEY`; Convex adds the deployment URLs to `.env.local`. See [.env.example](.env.example). Both processes stop with Ctrl-C. Use `pnpm dev:frontend` or `pnpm dev:backend` to run either server independently.

Open [localhost:3000](http://localhost:3000). Guest team building works without Telegram credentials. To enable sign-in, configure `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`, `JWT_PRIVATE_KEY`, and `JWKS` in your Convex deployment, and set its `SITE_URL` to `http://localhost:3000`. For local HTTP sites, OAuth automatically uses Convex's HTTPS callback. Register that callback with Telegram. The frontend checks credential availability in Convex when signing in.

For local and preview testing without Telegram, enable [development sign-in](docs/development-auth.md) on both servers. The account menu creates two test coaches and can switch between existing users through normal authenticated sessions. Vercel production flags disable the route; Convex independently checks its opt-in type, deployment binding and secret.

## Users and access control

Accounts have either the `admin` or `user` role. Existing accounts without a stored role are treated as users. Admins can edit and archive any team without changing its owner, and can view `/users`. The directory excludes the current admin, loads every account in batches, and sorts online users first, then by most recent activity. Convex's presence component handles multiple tabs, disconnects, and session timeouts. Accounts without recorded activity are displayed with that status.

To grant admin access, open the intended deployment in the Convex dashboard, copy the account's ID from the `users` table, and run the internal mutation `users:setAdmin`:

```json
{ "userId": "<users document ID>", "enabled": true }
```

Run it with `enabled: false` to restore the user role. This mutation is internal and cannot be invoked through the public client API. No role controls are exposed in the UI. Commissioner permissions derive from league ownership; a commissioner can also be a participating coach, and there is no global organizer role. `/leagues` lists competitions, while existing roster-affiliation references retain their URLs. Tournaments remains disabled in navigation.

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

The live application is [sideline.com.ua](https://sideline.com.ua/). The linked Vercel project deploys GitHub `main`; its production build deploys Convex functions and builds the frontend together. [vercel.json](vercel.json) defines the command:

```sh
pnpm exec convex deploy --cmd 'pnpm run build'
```

For your own deployment, import your fork into Vercel and connect your own Convex project. The only manually configured Vercel variable is `CONVEX_DEPLOY_KEY`: use a **production deploy key** for Production and a **preview deploy key** for Preview. Use the **development deploy key** for Development and pull it into `.env.local` for `pnpm dev`.

Keep Vercel's **Automatically expose System Environment Variables** enabled. Metadata and sitemap URLs use `VERCEL_PROJECT_PRODUCTION_URL`, with `http://localhost:3000` for local development. Convex supplies `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` to the build, so neither needs to be defined manually on Vercel. The auth proxy uses that HTTP endpoint directly. Telegram readiness comes from Convex credentials rather than a frontend flag.

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

Never commit `.env` files, deploy keys, Telegram tokens, auth payloads, or signing keys. [.env.example](.env.example) contains safe placeholders only.

## Contributing and forks

**Forking is welcome**, and so are issues and pull requests. Report bugs, suggest improvements, help with translations, or adapt Sideline for your community. See [CONTRIBUTING.md](CONTRIBUTING.md) for practical steps. This is a community project maintained as time allows; there is no guaranteed response, review, support, or release schedule.

## License and credits

Copyright © 2026 martinAbsolute. Original project code and documentation are licensed under **GNU AGPL-3.0-only**, with the attribution-preservation term in [NOTICE.md](NOTICE.md). Keep credit and a link back to this project in distributed copies and appropriate legal notices. Hosted modified versions must provide their corresponding source under the AGPL.

Blood Bowl is a trademark of Games Workshop. This independent community project is not affiliated with, endorsed by, or sponsored by Games Workshop or FUMBBL. Game names, rules, and third-party artwork remain subject to their respective rights; this project's license does not grant rights to them.

Player icons come from the **[FUMBBL BB2025 roster pages](https://fumbbl.com/help:BB25RaceStrategy)** and **[Star Player league lists](https://fumbbl.com/help:Rosters+Special+Rules)**. Source URLs, labels, checksums, and crop mappings are preserved in the asset manifest. See the [player artwork notes](public/assets/fumbbl/README.md) and [third-party notices](THIRD_PARTY_NOTICES.md); attribution does not relicense that artwork.

Created by [martinAbsolute on GitHub](https://github.com/martinAbsolute/) · [@martinAbsolute on Telegram](https://t.me/martinAbsolute).
