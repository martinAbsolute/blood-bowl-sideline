import { SignJWT } from "jose";

export type DevAuthEnvironment = "development" | "preview";
export type FrontendDevAuthConfig = {
  environment: DevAuthEnvironment;
  deploymentName: string;
  secret: string;
};

/** Server-only configuration: no client argument may enable impersonation. */
export function getFrontendDevAuthConfig(
  environment: Record<string, string | undefined> = process.env,
): FrontendDevAuthConfig | null {
  if (
    environment.VERCEL_ENV === "production" ||
    environment.VERCEL_TARGET_ENV === "production" ||
    environment.CONVEX_DEPLOY_KEY?.startsWith("prod:") ||
    environment.DEV_AUTH_ENABLED !== "true" ||
    !environment.DEV_AUTH_SECRET ||
    new TextEncoder().encode(environment.DEV_AUTH_SECRET).length < 32
  )
    return null;

  let frontendEnvironment: DevAuthEnvironment;
  if (
    environment.VERCEL_ENV === "development" ||
    environment.VERCEL_ENV === "preview"
  ) {
    frontendEnvironment = environment.VERCEL_ENV;
  } else if (
    environment.VERCEL_ENV === undefined &&
    !environment.VERCEL &&
    environment.NODE_ENV === "development"
  ) {
    frontendEnvironment = "development";
  } else return null;

  try {
    const cloud = new URL(environment.NEXT_PUBLIC_CONVEX_URL ?? "");
    const deploymentName = cloud.hostname.split(".")[0];
    const labels = cloud.hostname.split(".");
    const canonicalHost =
      cloud.hostname === `${deploymentName}.convex.cloud` ||
      (labels.length === 4 &&
        /^[a-z]{2}(?:-[a-z]+)+-[1-9][0-9]*$/.test(labels[1]) &&
        cloud.hostname === `${deploymentName}.${labels[1]}.convex.cloud`);
    if (
      cloud.protocol !== "https:" ||
      !canonicalHost ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deploymentName) ||
      deploymentName.length > 120 ||
      cloud.port ||
      cloud.username ||
      cloud.password ||
      cloud.search ||
      cloud.hash ||
      cloud.pathname !== "/" ||
      ![`https://${cloud.hostname}`, `https://${cloud.hostname}/`].includes(
        environment.NEXT_PUBLIC_CONVEX_URL!,
      )
    )
      return null;
    return {
      environment: frontendEnvironment,
      deploymentName,
      secret: environment.DEV_AUTH_SECRET,
    };
  } catch {
    return null;
  }
}

export async function mintDevAuthToken(
  userId: string,
  config: FrontendDevAuthConfig,
) {
  // A small backdate handles clock drift without accepting future or expired tokens.
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    environment: config.environment,
    deploymentName: config.deploymentName,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("sideline-dev-auth")
    .setAudience("dev-impersonation")
    .setSubject(userId)
    .setIssuedAt(now - 5)
    .setExpirationTime(now + 55)
    .sign(new TextEncoder().encode(config.secret));
}
