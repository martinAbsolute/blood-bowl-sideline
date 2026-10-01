# Development and preview sign-in

The account menu can create **Dev Coach A** and **Dev Coach B**, switch between them, or impersonate an existing user in the selected nonproduction backend. These are normal Convex Auth sessions: ownership and league commissioner checks still apply. Each account keeps its own team drafts.

The bypass defaults to disabled. Next.js and Convex independently opt in, and the server issues a signed token valid for at most 60 seconds. The shared secret stays on the two servers. A browser cannot choose a role or enable the bypass through a request.

## Local development

Use your development Convex deployment and configure its normal Convex Auth signing keys (`JWT_PRIVATE_KEY` and `JWKS`). Telegram credentials are unnecessary for development sign-in.

Set these server variables in `.env.local`:

```dotenv
DEV_AUTH_ENABLED=true
DEV_AUTH_SECRET=<a randomly generated secret of at least 32 bytes>
```

Use the same secret in the development Convex dashboard and set:

```dotenv
DEV_AUTH_ENABLED=true
DEV_AUTH_SECRET=<the same secret>
DEV_AUTH_DEPLOYMENT_TYPE=dev
DEV_AUTH_DEPLOYMENT_NAME=<actual development deployment name>
```

The name must match the built-in `CONVEX_CLOUD_URL`, including deployments that use a regional hostname. Keep these values in ignored environment files or the dashboard. Restart `pnpm dev` after configuring them. Local sign-in requires `NODE_ENV=development`; running an unclassified production build locally leaves it disabled.

Open the account menu, choose **Create test coaches**, and sign in as either coach. Use separate browser profiles to test simultaneous report editing, or switch accounts in one browser to test sequential entry and confirmation. The coach who creates the league becomes its commissioner.

## Vercel previews

Enable Vercel's automatic system environment variables. Scope `DEV_AUTH_ENABLED=true` and the shared secret to **Preview**, and use an isolated Convex preview backend with its own auth signing keys. Configure that backend with the same variables above, using `DEV_AUTH_DEPLOYMENT_TYPE=preview` and its actual deployment name. Each newly created preview deployment needs its own name binding; copying defaults without that binding leaves the bypass disabled. No build command enables it automatically.

The frontend requires `VERCEL_ENV=preview` and matching backend metadata. A Vercel preview runs with `NODE_ENV=production`, which is supported because the Vercel classification is explicit. Vercel Development uses `VERCEL_ENV=development` with a Convex development backend.

Either `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production` disables the route, even when opt-in variables are accidentally present. A production Convex deploy key also disables the frontend. Convex separately requires an explicit `dev` or `preview` type, the bound deployment name and its built-in cloud URL; missing, production or inconsistent settings reject impersonation, user listing and test-account creation. Convex documents deployment URLs as runtime built-ins, so its type is deliberately configured per deployment. Never set these opt-in variables on a production backend.

Preview sign-in lets anyone with access to that preview act as its users. Use Vercel Deployment Protection and isolated test data when enabling it on a hosted preview. Disable the bypass by removing either server's opt-in flag.

## Verification

`tests/dev-auth-env.test.ts`, `tests/dev-auth-route.test.ts` and `tests/dev-auth.test.ts` cover production denial, missing or mismatched settings, regional URL binding, same-origin requests, tampered/expired tokens and ordinary ownership enforcement. Preview gating is tested with production `NODE_ENV` and explicit preview metadata. Follow [the two-coach league test](league-testing.md) for the complete playable workflow.
