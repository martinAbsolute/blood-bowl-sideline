import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { jwtVerify } from "jose";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";

type Environment = Readonly<Record<string, string | undefined>>;
type VerificationFailure = {
  name: string;
  code: string;
};
export type DevAuthConfig = {
  deploymentName: string;
  environment: "development" | "preview";
  secret: string;
};

/** Backend configuration is checked independently of the frontend's opt-in. */
export function devAuthConfig(
  environment: Environment = process.env,
): DevAuthConfig | null {
  const type = environment.DEV_AUTH_DEPLOYMENT_TYPE;
  const name = environment.DEV_AUTH_DEPLOYMENT_NAME;
  const secret = environment.DEV_AUTH_SECRET;
  if (
    environment.DEV_AUTH_ENABLED !== "true" ||
    (type !== "dev" && type !== "preview") ||
    !name ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) ||
    name.length > 120 ||
    !secret ||
    new TextEncoder().encode(secret).length < 32 ||
    !environment.CONVEX_CLOUD_URL
  )
    return null;
  let target: URL;
  try {
    target = new URL(environment.CONVEX_CLOUD_URL);
  } catch {
    return null;
  }
  const labels = target.hostname.split(".");
  const boundHost =
    target.hostname === `${name}.convex.cloud` ||
    (labels.length === 4 &&
      labels[0] === name &&
      /^[a-z]{2}(?:-[a-z]+)+-[1-9][0-9]*$/.test(labels[1]) &&
      labels[2] === "convex" &&
      labels[3] === "cloud");
  if (
    target.protocol !== "https:" ||
    !boundHost ||
    (environment.CONVEX_CLOUD_URL !== `https://${target.hostname}` &&
      environment.CONVEX_CLOUD_URL !== `https://${target.hostname}/`) ||
    target.port ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/"
  )
    return null;
  return {
    deploymentName: name,
    environment: type === "dev" ? "development" : "preview",
    secret,
  };
}

function requireDevAuth() {
  const configuration = devAuthConfig();
  if (!configuration) throw new ConvexError("DEV_AUTH_DISABLED");
  return configuration;
}

/** Only a verified signed subject reaches the internal user lookup. */
export async function verifyDevImpersonationToken(
  token: unknown,
  environment: Environment = process.env,
  reportFailure?: (failure: VerificationFailure) => void,
): Promise<string> {
  const configuration = devAuthConfig(environment);
  if (!configuration) throw new ConvexError("DEV_AUTH_DISABLED");
  if (typeof token !== "string" || token.length > 4096 || !token)
    throw new ConvexError("INVALID_DEV_AUTH_TOKEN");
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(configuration.secret),
      {
        algorithms: ["HS256"],
        issuer: "sideline-dev-auth",
        audience: "dev-impersonation",
        requiredClaims: ["sub", "iat", "exp"],
        maxTokenAge: "60s",
        clockTolerance: 0,
      },
    );
    if (
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.sub.length > 200 ||
      !Number.isSafeInteger(payload.iat) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp! <= payload.iat! ||
      payload.exp! - payload.iat! > 60 ||
      payload.environment !== configuration.environment ||
      payload.deploymentName !== configuration.deploymentName
    )
      throw new Error("Invalid development authentication claims");
    return payload.sub;
  } catch (error) {
    // Never log an exception message, claims, credentials, or the signing key.
    const name = error instanceof Error ? error.name : "UnknownError";
    const code =
      error && typeof error === "object" && "code" in error
        ? error.code
        : "DEV_AUTH_VERIFICATION_FAILED";
    reportFailure?.({
      name: /^[A-Za-z]{1,80}$/.test(name) ? name : "UnknownError",
      code:
        typeof code === "string" && /^[A-Z_]{1,80}$/.test(code)
          ? code
          : "DEV_AUTH_VERIFICATION_FAILED",
    });
    throw new ConvexError("INVALID_DEV_AUTH_TOKEN");
  }
}

export function devImpersonationProvider() {
  return ConvexCredentials<DataModel>({
    id: "dev-impersonation",
    authorize: async (credentials, ctx) => {
      const subject = await verifyDevImpersonationToken(
        credentials.token,
        process.env,
        (failure) =>
          console.warn("Development auth token verification failed", failure),
      );
      const userId = await ctx.runQuery(internal.devAuth.userForSignIn, {
        subject,
      });
      if (!userId) throw new ConvexError("DEV_AUTH_USER_NOT_FOUND");
      return { userId };
    },
  });
}

const publicUser = v.object({ id: v.id("users"), name: v.string() });
export const status = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    environment: v.union(
      v.literal("development"),
      v.literal("preview"),
      v.null(),
    ),
    deploymentName: v.union(v.string(), v.null()),
  }),
  handler: async () => {
    const configuration = devAuthConfig();
    return {
      enabled: !!configuration,
      environment: configuration?.environment ?? null,
      deploymentName: configuration?.deploymentName ?? null,
    };
  },
});
export const listUsers = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(publicUser),
  handler: async (ctx, { paginationOpts }) => {
    requireDevAuth();
    if (
      !Number.isSafeInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 30
    )
      throw new ConvexError("INVALID_INPUT");
    const result = await ctx.db
      .query("users")
      .withIndex("by_creation_time")
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((user) => ({
        id: user._id,
        name: user.name ?? "Coach",
      })),
    };
  },
});
export const ensureTestUsers = mutation({
  args: {},
  returns: v.object({ users: v.array(publicUser) }),
  handler: async (ctx) => {
    requireDevAuth();
    const users = [];
    for (const [identifier, name] of [
      ["coach-a", "Dev Coach A"],
      ["coach-b", "Dev Coach B"],
    ] as const) {
      const account = await ctx.db
        .query("devAuthAccounts")
        .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
        .unique();
      const existing = account
        ? await ctx.db.get("users", account.userId)
        : null;
      if (existing) {
        users.push({ id: existing._id, name: existing.name ?? name });
        continue;
      }
      const userId = await ctx.db.insert("users", { name, role: "user" });
      if (account)
        await ctx.db.patch("devAuthAccounts", account._id, { userId });
      else await ctx.db.insert("devAuthAccounts", { identifier, userId });
      users.push({ id: userId, name });
    }
    return { users };
  },
});
export const userForSignIn = internalQuery({
  args: { subject: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, { subject }) => {
    requireDevAuth();
    const id = ctx.db.normalizeId("users", subject);
    return id && (await ctx.db.get("users", id)) ? id : null;
  },
});
