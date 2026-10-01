/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { decodeJwt, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { verifyDevImpersonationToken } from "../convex/devAuth";
import { newTeam } from "../src/domain/catalog";

const modules = import.meta.glob("../convex/**/*.ts");
const secret = "dev-auth-test-secret-at-least-32-bytes";
const signingKey = generateKeyPairSync("rsa", { modulusLength: 2048 });

beforeEach(() => {
  vi.stubEnv("DEV_AUTH_ENABLED", "true");
  vi.stubEnv("DEV_AUTH_DEPLOYMENT_TYPE", "dev");
  vi.stubEnv("DEV_AUTH_DEPLOYMENT_NAME", "test-deployment-123");
  vi.stubEnv("DEV_AUTH_SECRET", secret);
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test-deployment-123.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://test-deployment-123.convex.site");
  vi.stubEnv("SITE_URL", "https://app.test");
  vi.stubEnv(
    "JWT_PRIVATE_KEY",
    signingKey.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .trimEnd()
      .replace(/\n/g, " "),
  );
});
afterEach(() => vi.unstubAllEnvs());

async function signedSubject(subject: string) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    environment: "development",
    deploymentName: "test-deployment-123",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("sideline-dev-auth")
    .setAudience("dev-impersonation")
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(secret));
}

describe("development impersonation backend", () => {
  it("reports only safe error name and code when runtime crypto fails", async () => {
    const token = await signedSubject("private-user-subject");
    const diagnostic = vi.fn();
    const importer = vi
      .spyOn(crypto.subtle, "importKey")
      .mockRejectedValueOnce(
        new DOMException(
          `Private token ${token} and key ${secret}`,
          "NotSupportedError",
        ),
      );
    try {
      await expect(
        verifyDevImpersonationToken(token, process.env, diagnostic),
      ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
      expect(diagnostic).toHaveBeenCalledExactlyOnceWith({
        name: "NotSupportedError",
        code: "DEV_AUTH_VERIFICATION_FAILED",
      });
    } finally {
      importer.mockRestore();
    }
  });
  it("creates two stable ordinary users and exposes only bounded names and IDs", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("users", {
        name: "Existing Telegram coach",
        email: "private@example.test",
        image: "https://private.example/image",
        role: "admin",
      }),
    );
    expect(await t.query(api.devAuth.status, {})).toEqual({
      enabled: true,
      environment: "development",
      deploymentName: "test-deployment-123",
    });
    const first = await t.mutation(api.devAuth.ensureTestUsers, {});
    expect(first.users.map((user) => user.name)).toEqual([
      "Dev Coach A",
      "Dev Coach B",
    ]);
    expect(await t.mutation(api.devAuth.ensureTestUsers, {})).toEqual(first);
    const stored = await t.run((ctx) => ctx.db.query("users").collect());
    expect(stored).toHaveLength(3);
    expect(
      stored
        .filter((user) => first.users.some((coach) => coach.id === user._id))
        .every((user) => user.role === "user"),
    ).toBe(true);
    const firstPage = await t.query(api.devAuth.listUsers, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    const nextPage = await t.query(api.devAuth.listUsers, {
      paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
    });
    expect(firstPage.page).toHaveLength(2);
    expect([...firstPage.page, ...nextPage.page]).toHaveLength(3);
    for (const user of [...firstPage.page, ...nextPage.page])
      expect(Object.keys(user).sort()).toEqual(["id", "name"]);
    await expect(
      t.query(api.devAuth.listUsers, {
        paginationOpts: { numItems: 31, cursor: null },
      }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(
      await t.run((ctx) => ctx.db.query("authAccounts").collect()),
    ).toHaveLength(0);
  });

  it.each(["disabled", "production", "wrong-deployment"])(
    "fails closed before reading or creating users for %s configuration",
    async (scenario) => {
      const t = convexTest(schema, modules);
      if (scenario === "disabled") vi.stubEnv("DEV_AUTH_ENABLED", "false");
      if (scenario === "production")
        vi.stubEnv("DEV_AUTH_DEPLOYMENT_TYPE", "prod");
      if (scenario === "wrong-deployment")
        vi.stubEnv(
          "CONVEX_CLOUD_URL",
          "https://production-target.convex.cloud",
        );
      expect(await t.query(api.devAuth.status, {})).toEqual({
        enabled: false,
        environment: null,
        deploymentName: null,
      });
      await expect(
        t.query(api.devAuth.listUsers, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow("DEV_AUTH_DISABLED");
      await expect(t.mutation(api.devAuth.ensureTestUsers, {})).rejects.toThrow(
        "DEV_AUTH_DISABLED",
      );
      await expect(
        t.action(api.auth.signIn, {
          provider: "dev-impersonation",
          params: { token: await signedSubject("untrusted-user") },
        }),
      ).rejects.toThrow("DEV_AUTH_DISABLED");
      expect(
        await t.run((ctx) => ctx.db.query("users").collect()),
      ).toHaveLength(0);
      expect(
        await t.run((ctx) => ctx.db.query("authSessions").collect()),
      ).toHaveLength(0);
    },
  );

  it("creates standard separate Convex Auth sessions while preserving normal ownership checks", async () => {
    const t = convexTest(schema, modules);
    const { users } = await t.mutation(api.devAuth.ensureTestUsers, {});
    const signedIn = [];
    for (const user of users) {
      const result = await t.action(api.auth.signIn, {
        provider: "dev-impersonation",
        params: {
          token: await signedSubject(user.id),
          userId: users[0].id,
          role: "admin",
        },
      });
      expect(result.tokens?.token).toBeTruthy();
      expect(result.tokens?.refreshToken).toBeTruthy();
      const claims = decodeJwt(result.tokens!.token);
      expect(claims.sub?.split("|")[0]).toBe(user.id);
      signedIn.push(t.withIdentity({ subject: claims.sub! }));
    }
    expect(await signedIn[0].query(api.users.viewer, {})).toMatchObject({
      id: users[0].id,
      role: "user",
    });
    expect(await signedIn[1].query(api.users.viewer, {})).toMatchObject({
      id: users[1].id,
      role: "user",
    });
    const team = newTeam(randomUUID());
    team.name = "Coach A team";
    await signedIn[0].mutation(api.teams.save, { team, expectedRevision: 0 });
    expect(
      await signedIn[0].query(api.teams.getByUuid, { uuid: team.uuid }),
    ).toMatchObject({ canEdit: true });
    expect(
      await signedIn[1].query(api.teams.getByUuid, { uuid: team.uuid }),
    ).toMatchObject({ canEdit: false });
    await expect(
      signedIn[1].mutation(api.teams.save, {
        team: { ...team, name: "Unauthorized edit" },
        expectedRevision: 1,
      }),
    ).rejects.toThrow("FORBIDDEN");
    const sessions = await t.run((ctx) =>
      ctx.db.query("authSessions").collect(),
    );
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => session.userId))).toEqual(
      new Set(users.map((user) => user.id)),
    );
    await signedIn[0].action(api.auth.signOut, {});
    expect(
      await t.run((ctx) => ctx.db.query("authSessions").collect()),
    ).toHaveLength(1);
    expect(await signedIn[1].query(api.users.viewer, {})).toMatchObject({
      id: users[1].id,
    });
  });

  it("refuses unsigned actor overrides and nonexistent signed subjects without creating a session", async () => {
    const t = convexTest(schema, modules);
    const { users } = await t.mutation(api.devAuth.ensureTestUsers, {});
    await expect(
      t.action(api.auth.signIn, {
        provider: "dev-impersonation",
        params: { userId: users[0].id, role: "admin" },
      }),
    ).rejects.toThrow("INVALID_DEV_AUTH_TOKEN");
    await expect(
      t.action(api.auth.signIn, {
        provider: "dev-impersonation",
        params: { token: await signedSubject("not-a-users-id") },
      }),
    ).rejects.toThrow("DEV_AUTH_USER_NOT_FOUND");
    const removed = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "Removed user" });
      await ctx.db.delete("users", id);
      return id;
    });
    await expect(
      t.action(api.auth.signIn, {
        provider: "dev-impersonation",
        params: { token: await signedSubject(removed) },
      }),
    ).rejects.toThrow("DEV_AUTH_USER_NOT_FOUND");
    expect(
      await t.run((ctx) => ctx.db.query("authSessions").collect()),
    ).toHaveLength(0);
  });
});
