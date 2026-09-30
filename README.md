# Blood Bowl Sideline

A bilingual BB2025 team builder for the Ukrainian community, built with Next.js, React, Convex and `gt-next`. English is the source language; Ukrainian is a persistent language choice using local dictionaries.

The app is actively in development, with no real users or backward-compatibility commitments. Tests describe current behavior. Do not add migrations just to preserve obsolete development data.

## Team flow

- Choose a roster at `/teams` and start building. Guest drafts save automatically on the current device.
- Sign in with Telegram to upload **all** guest drafts. Signed-in creation, imports and edits save automatically to the account.
- `/my-teams` is one library with search by name, coach, roster or ruleset, plus roster, ruleset and archive filters. Draft/Ready describes roster validation, not where a team is saved.
- Successful cloud saves clear the local recovery copy. Failed or unfinished edits remain on the device; retry from the library or editor. Account recovery copies are isolated from other accounts. A blank name needs to be filled in before upload.
- `/teams/[uuid]` opens directly in edit mode for its owner and as a read-only public view for everyone else. Archiving hides the public link; restoring makes it available again.
- Team names behave like document filenames: type inline, Enter to finish, Escape to restore the previous name. Long names wrap on narrow screens.
- `/team/[roster]` contains roster details. `/leagues/[league]` lists affiliated rosters and clickable star-player details. Special rules have full help on hover, keyboard focus and tap.

Costs and legality come from the shared catalog and validator, including on the server. UUID pages never expose owner IDs or authentication records. League progression and tournament management are outside scope.

## Development

```sh
pnpm install --frozen-lockfile
pnpm exec convex dev
pnpm dev
```

Convex sets up `.env.local`. Use [.env.example](.env.example) for frontend variable names. Keep Telegram credentials and signing keys only in Convex environment variables. Never commit `.env` files or expose secrets through `NEXT_PUBLIC_*`.

```sh
pnpm check
pnpm test
pnpm build
```

Before shipping, also check creation, ruleset changes, draft restoration, language switching, owner/public UUID pages, account synchronization, library filters and narrow-screen name editing in a browser.

## Structure

- `src/app/`: routes and server-rendered public team views.
- `src/components/`: application UI; compose installed vendor components without modifying `ui/` or `magic-ui/`.
- `src/domain/`: factual catalogs, shared validators, costs and reference relationships.
- `src/lib/`: browser drafts, account synchronization and document utilities.
- `src/i18n/`: complete English/Ukrainian dictionaries.
- `convex/`: Telegram authentication, owner-scoped persistence, indexed search and public projections. See [backend notes](convex/README.md).
- `tests/`: current rules, authentication, ownership and user-flow coverage.

Read [rules provenance](docs/rules-sources.md) before changing factual catalogs. There are 31 rosters, 108 skills/traits, 66 star players and four presets: Default, Matched Play, EuroBowl 2026 and NAF World Cup 2027 v2.1.

## Telegram authentication

Convex Auth uses Telegram OpenID Connect with authorization codes, S256 PKCE and state protection. ID tokens are verified against Telegram's JWKS and checked for issuer, audience, expiry and subject. No phone or messaging permission is requested. The optional bot webhook responds only to explicit private `/start` requests.

Configure `TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`, `SITE_URL`, `JWT_PRIVATE_KEY` and `JWKS` in Convex. The setup script, `scripts/setup-telegram.mjs`, verifies the bot identity, signing-key configuration and webhook. Read its options before running it against a deployment.

Register exact callback URLs with BotFather:

- Production: `https://blood-bowl-sideline.vercel.app/api/auth/callback/telegram`
- Development: `https://pleasant-buffalo-91.convex.site/api/auth/callback/telegram`

Production uses `CUSTOM_AUTH_SITE_URL=https://blood-bowl-sideline.vercel.app` in Convex. The Next.js auth route forwards Telegram requests to `NEXT_PUBLIC_CONVEX_SITE_URL` while preserving redirects and state/PKCE cookies. Local development uses the development callback and `SITE_URL=http://localhost:3000`. Keep the shared bot webhook pointed at production. Set `NEXT_PUBLIC_TELEGRAM_AUTH_READY=true` only once authentication is configured.

## Deployment

GitHub `main` triggers the linked Vercel project, `blood-bowl-sideline`. GitHub Actions runs checks, tests and the build. Backend changes must be deployed before the frontend push:

```sh
pnpm exec convex deploy -y
git push origin main
```

Confirm the target first: personal development is `pleasant-buffalo-91`; production is `expert-grasshopper-80`. Vercel production must use the production Convex URL. A deployment key, if automation is configured later, belongs in protected platform secrets.

## Attribution

Independent community software; Blood Bowl is a Games Workshop trademark. No affiliation or endorsement. English skill definitions match the user-supplied export described in the rules provenance. Player artwork comes from the FUMBBL community; see [asset attribution and mappings](public/assets/fumbbl/README.md).
