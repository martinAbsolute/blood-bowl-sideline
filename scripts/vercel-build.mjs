import { spawnSync } from "node:child_process";

const production = process.env.VERCEL_ENV === "production";
const hostname = production
  ? process.env.VERCEL_PROJECT_PRODUCTION_URL
  : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
if (!hostname || !process.env.NEXT_PUBLIC_CONVEX_URL)
  throw new Error("Run this script through convex deploy on Vercel");

const origin = new URL(`https://${hostname}`).origin;
const deployment = new URL(process.env.NEXT_PUBLIC_CONVEX_URL).hostname.split(
  ".",
)[0];
// Production deploy keys already select their backend. Named selection makes
// the CLI use its control-plane API, which does not accept deployment keys.
const selector = production ? [] : ["--deployment", deployment];

function run(args) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Convex Auth needs both origins in its own environment; Vercel variables are
// only available to the build. Target the backend selected by convex deploy.
console.log(
  `Configuring auth origin for ${production ? "prod" : "preview"}: ${deployment}`,
);
run(["exec", "convex", "env", "set", "SITE_URL", origin, ...selector]);
run([
  "exec",
  "convex",
  "env",
  "set",
  "CUSTOM_AUTH_SITE_URL",
  origin,
  ...selector,
]);
run(["run", "build"]);
