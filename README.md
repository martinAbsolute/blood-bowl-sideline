# Blood Bowl Sideline

A bilingual BB2025 team builder for the Ukrainian community. English is the default; Ukrainian is a persistent language choice powered by `gt-next` and local dictionaries. No translation API account is required.

31 rosters, 108 skill/trait facts, 66 star players, and four presets: Default, Matched Play, EuroBowl 2026, NAF World Cup **2027 v2.1** (the edition shown by both reference builders). Guest drafts stay on the device; Telegram-authenticated coaches can save teams in Convex and share public UUID views. Incomplete teams save as drafts. Ownership, costs, legality, and edit revisions are enforced on the backend.

## Run locally

```sh
npm ci
npx convex dev
npm run dev
```

Convex writes the deployment URL into `.env.local`. See `.env.example` for other public frontend settings. Store Telegram credentials in the Convex dashboard; never put them in browser variables or commit them. Development OIDC uses the cloud callback registered below and returns to localhost through `SITE_URL`.

```sh
npm run check
npm test
npm run build
```

## Project structure

- `src/app/`: Next.js App Router and SSR public team views.
- `src/components/`: original composed application UI.
- `src/components/ui/`, `src/components/magic-ui/`: installed vendor components; do not directly edit them.
- `src/domain/`: versioned factual catalogs, shared validation and budget engine.
- `src/i18n/`: paired English/Ukrainian `gt-next` dictionaries.
- `convex/`: auth, webhook, owner-scoped teams, public projections, and reversible archives.
- `tests/`: tournament calculations, Telegram security, and Convex authorization/concurrency.

Read [rules provenance and coverage](docs/rules-sources.md) before changing data. The Default preset is an exhibition draft; enhanced recruitment needs organiser agreement. Squad-level rules and event rulings are outside individual-roster checks. League play and tournament running are intentionally future work. Team snapshots, stable UUIDs, owners, rules revisions, and soft archives provide a foundation without adding those features prematurely.

## Telegram OpenID Connect

Authentication uses Telegram's standard authorization-code flow with S256 PKCE and state protection, through Convex Auth. Telegram ID-token signatures are independently verified against the official JWKS, along with issuer, audience, expiry, and subject. Only the opaque account subject, name, and optional photo are projected into account records. No phone or messaging permission is requested. The optional bot webhook only answers explicit private /start requests with a link to the application.

Bot identity is configured through `TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CLIENT_ID` in Convex. Current bot: @bb_sideline_bot; client ID: 8809799343. Store `TELEGRAM_CLIENT_SECRET` only in Convex environment variables.

Register the following OIDC redirect URIs in BotFather's app:

- Production: https://expert-grasshopper-80.convex.site/api/auth/callback/telegram
- Development: https://pleasant-buffalo-91.convex.site/api/auth/callback/telegram
- Trusted website origin: https://blood-bowl-sideline.vercel.app

Native Login is unnecessary. For localhost OIDC testing, use the development callback and SITE_URL=http://localhost:3000; register any additional trusted origin Telegram requires. The shared bot's single webhook remains pointed at production.

```sh
node scripts/setup-telegram.mjs --prod --copy-dev-credentials --client-id=8809799343 --site=https://blood-bowl-sideline.vercel.app --convex-site=https://expert-grasshopper-80.convex.site
```

The script verifies the bot ID, copies credentials securely, creates signing keys only when absent, rotates the webhook secret when changing bots, and verifies the registered webhook. Set NEXT_PUBLIC_TELEGRAM_AUTH_READY=true in Vercel and redeploy after configuration. The frontend sign-in button starts OIDC directly; no legacy login widget or signed-query callback remains.

## Deployment

The frontend is linked to Vercel project `blood-bowl-sideline` in `martin-bahniuks-projects`. Convex project is `martin-bahniuk:blood-bowl-sideline`, with dev `pleasant-buffalo-91` and production `expert-grasshopper-80`. Configure Vercel production with the **production** Convex URL. Never expose the Convex deploy key or Telegram token using `NEXT_PUBLIC_`.

```sh
npx convex deploy -y
vercel --prod
```

Deploy backend changes before frontend changes. CI runs checks, tests, and the Next.js build. For future automated Convex deployment, create a project deploy key in the dashboard and store it as a protected Vercel environment variable; none is stored in this repository.

When `bbsideline.com.ua` is registered, add it to Vercel, apply the DNS records Vercel provides, update `SITE_URL` in Convex and `NEXT_PUBLIC_SITE_URL` in Vercel, add `https://bbsideline.com.ua` to Telegram's trusted origins, and redeploy. The Convex OIDC callback URL and team UUID paths remain the same.

## Tooling compatibility

Application libraries were checked against current stable npm releases. TypeScript 7 is the checker; Microsoft's `@typescript/typescript6` compatibility alias supplies the compiler API required by Next.js/ESLint. The latest ESLint uses the official `@eslint/compat` adapter for Next.js's shipped plugins. Cobe stays on 0.6.5 because the installed current Magic UI Globe registry component requires its pre-2.0 API. See `AGENTS.md` for installed Next.js and Convex AI guidance.

Independent community software. Blood Bowl is a Games Workshop trademark; no affiliation or endorsement. No third-party rulebook text or artwork is redistributed.
