import { decodeJwt, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { devAuthConfig, verifyDevImpersonationToken } from "../convex/devAuth";
import {
  getFrontendDevAuthConfig,
  mintDevAuthToken,
} from "../src/lib/dev-auth";

const secret = "test-only-development-authentication-key-1234567890";
const backendEnvironment = {
  DEV_AUTH_ENABLED: "true",
  DEV_AUTH_DEPLOYMENT_TYPE: "dev",
  DEV_AUTH_DEPLOYMENT_NAME: "test-deployment-123",
  DEV_AUTH_SECRET: secret,
  CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud",
};
const frontendEnvironment = {
  NODE_ENV: "development",
  DEV_AUTH_ENABLED: "true",
  DEV_AUTH_SECRET: secret,
  NEXT_PUBLIC_CONVEX_URL: backendEnvironment.CONVEX_CLOUD_URL,
};

describe("server-side frontend development authentication gate", () => {
  it("allows explicitly enabled local development and Vercel previews", () => {
    expect(getFrontendDevAuthConfig(frontendEnvironment)).toMatchObject({
      environment: "development",
      deploymentName: "test-deployment-123",
    });
    expect(
      getFrontendDevAuthConfig({
        ...frontendEnvironment,
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_ENV: "preview",
      }),
    ).toMatchObject({ environment: "preview" });
    expect(
      getFrontendDevAuthConfig({
        ...frontendEnvironment,
        VERCEL: "1",
        VERCEL_ENV: "development",
      }),
    ).toMatchObject({ environment: "development" });
    expect(
      getFrontendDevAuthConfig({
        ...frontendEnvironment,
        NEXT_PUBLIC_CONVEX_URL:
          "https://test-deployment-123.eu-west-1.convex.cloud",
      }),
    ).toMatchObject({
      environment: "development",
      deploymentName: "test-deployment-123",
    });
  });

  it.each([
    { DEV_AUTH_ENABLED: undefined },
    { DEV_AUTH_ENABLED: "false" },
    { DEV_AUTH_SECRET: undefined },
    { DEV_AUTH_SECRET: "short-secret" },
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "preview" },
    { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" },
    { VERCEL_ENV: "staging" },
    { VERCEL_ENV: "" },
    { CONVEX_DEPLOY_KEY: "prod:production-deployment|test-deploy-key" },
    { NEXT_PUBLIC_CONVEX_URL: undefined },
    { NEXT_PUBLIC_CONVEX_URL: "invalid" },
    { NEXT_PUBLIC_CONVEX_URL: "http://test-deployment-123.convex.cloud" },
    {
      NEXT_PUBLIC_CONVEX_URL:
        "https://test-deployment-123.convex.cloud.attacker.example",
    },
    {
      NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123.extra.convex.cloud",
    },
    {
      NEXT_PUBLIC_CONVEX_URL:
        "https://test-deployment-123.eu-west-1.extra.convex.cloud",
    },
    {
      NEXT_PUBLIC_CONVEX_URL:
        "https://test-deployment-123.eu-west-0.convex.cloud",
    },
    { NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123-.convex.cloud" },
    { NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123.convex.cloud:8443" },
    { NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123.convex.cloud:443" },
    {
      NEXT_PUBLIC_CONVEX_URL:
        "https://test-deployment-123.convex.cloud/path/..",
    },
    { NEXT_PUBLIC_CONVEX_URL: "https://user@test-deployment-123.convex.cloud" },
    { NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123.convex.cloud/path" },
    {
      NEXT_PUBLIC_CONVEX_URL:
        "https://test-deployment-123.convex.cloud?target=dev",
    },
    { NEXT_PUBLIC_CONVEX_URL: "https://test-deployment-123.convex.cloud#dev" },
  ])(
    "denies production, missing opt-in and malformed deployment URLs %j",
    (patch) => {
      expect(
        getFrontendDevAuthConfig({ ...frontendEnvironment, ...patch }),
      ).toBeNull();
    },
  );

  it("mints a token accepted only by the matching independent backend gate", async () => {
    const config = getFrontendDevAuthConfig(frontendEnvironment)!;
    const signed = await mintDevAuthToken("existing-test-user", config);
    expect(await verifyDevImpersonationToken(signed, backendEnvironment)).toBe(
      "existing-test-user",
    );
    await expect(
      verifyDevImpersonationToken(signed, {
        ...backendEnvironment,
        DEV_AUTH_DEPLOYMENT_TYPE: "preview",
      }),
    ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    await expect(
      verifyDevImpersonationToken(signed, {
        ...backendEnvironment,
        DEV_AUTH_DEPLOYMENT_NAME: "other-deployment",
        CONVEX_CLOUD_URL: "https://other-deployment.convex.cloud",
      }),
    ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
  });

  it("accepts a frontend clock three seconds ahead within the same 60-second signed window", async () => {
    const backendTime = Math.floor(Date.now() / 1000) * 1000;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(backendTime + 3000);
      const signed = await mintDevAuthToken(
        "existing-test-user",
        getFrontendDevAuthConfig(frontendEnvironment)!,
      );
      const claims = decodeJwt(signed);
      expect(claims.iat).toBe(backendTime / 1000 - 2);
      expect(claims.exp).toBe(backendTime / 1000 + 58);
      expect(claims.exp! - claims.iat!).toBe(60);
      vi.setSystemTime(backendTime);
      expect(
        await verifyDevImpersonationToken(signed, backendEnvironment),
      ).toBe("existing-test-user");
      vi.setSystemTime((claims.exp! + 1) * 1000);
      await expect(
        verifyDevImpersonationToken(signed, backendEnvironment),
      ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("still rejects a frontend clock six seconds ahead because its issued-at time is future", async () => {
    const backendTime = Math.floor(Date.now() / 1000) * 1000;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(backendTime + 6000);
      const signed = await mintDevAuthToken(
        "existing-test-user",
        getFrontendDevAuthConfig(frontendEnvironment)!,
      );
      expect(decodeJwt(signed).iat).toBe(backendTime / 1000 + 1);
      vi.setSystemTime(backendTime);
      await expect(
        verifyDevImpersonationToken(signed, backendEnvironment),
      ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("independent Convex development authentication gate", () => {
  it("allows explicitly enabled, correctly bound dev and preview deployments", () => {
    expect(devAuthConfig(backendEnvironment)).toMatchObject({
      environment: "development",
      deploymentName: "test-deployment-123",
    });
    expect(
      devAuthConfig({
        ...backendEnvironment,
        DEV_AUTH_DEPLOYMENT_TYPE: "preview",
      }),
    ).toMatchObject({ environment: "preview" });
    expect(
      devAuthConfig({
        ...backendEnvironment,
        CONVEX_CLOUD_URL: "https://test-deployment-123.eu-west-1.convex.cloud",
      }),
    ).toMatchObject({
      environment: "development",
      deploymentName: "test-deployment-123",
    });
  });

  it.each([
    {},
    { DEV_AUTH_ENABLED: undefined },
    { DEV_AUTH_ENABLED: "false" },
    { DEV_AUTH_ENABLED: "TRUE" },
    { DEV_AUTH_DEPLOYMENT_TYPE: undefined },
    { DEV_AUTH_DEPLOYMENT_TYPE: "prod" },
    { DEV_AUTH_DEPLOYMENT_TYPE: "production" },
    { DEV_AUTH_DEPLOYMENT_TYPE: "staging" },
    { DEV_AUTH_DEPLOYMENT_NAME: undefined },
    { DEV_AUTH_DEPLOYMENT_NAME: "other-deployment" },
    { DEV_AUTH_SECRET: undefined },
    { DEV_AUTH_SECRET: "short-secret" },
    { CONVEX_CLOUD_URL: undefined },
    { CONVEX_CLOUD_URL: "invalid" },
    { CONVEX_CLOUD_URL: "http://test-deployment-123.convex.cloud" },
    { CONVEX_CLOUD_URL: "https://production-deployment.convex.cloud" },
    {
      CONVEX_CLOUD_URL:
        "https://test-deployment-123.convex.cloud.attacker.example",
    },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.extra.convex.cloud" },
    {
      CONVEX_CLOUD_URL:
        "https://test-deployment-123.eu-west-1.extra.convex.cloud",
    },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.eu-west-0.convex.cloud" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.site" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud:8443" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud:443" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud/path/.." },
    { CONVEX_CLOUD_URL: "https://user@test-deployment-123.convex.cloud" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud/path" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud?target=dev" },
    { CONVEX_CLOUD_URL: "https://test-deployment-123.convex.cloud#dev" },
  ])(
    "denies incomplete, production, mismatched or malformed configuration %j",
    (patch) => {
      expect(
        devAuthConfig(
          Object.keys(patch).length ? { ...backendEnvironment, ...patch } : {},
        ),
      ).toBeNull();
    },
  );
});

const now = () => Math.floor(Date.now() / 1000);
async function token(
  claims: Record<string, unknown> = {},
  signingKey = secret,
  algorithm = "HS256",
) {
  const issuedAt = now();
  const payload = {
    iss: "sideline-dev-auth",
    aud: "dev-impersonation",
    sub: "existing-test-user",
    iat: issuedAt,
    exp: issuedAt + 60,
    environment: "development",
    deploymentName: "test-deployment-123",
    ...claims,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .sign(new TextEncoder().encode(signingKey));
}

describe("development impersonation token boundary", () => {
  it("accepts a short server-signed token and returns only its signed subject", async () => {
    expect(
      await verifyDevImpersonationToken(
        await token({ role: "admin", userId: "forged-user" }),
        backendEnvironment,
      ),
    ).toBe("existing-test-user");
  });

  it("rejects production even with an otherwise valid token", async () => {
    await expect(
      verifyDevImpersonationToken(await token(), {
        ...backendEnvironment,
        DEV_AUTH_DEPLOYMENT_TYPE: "prod",
      }),
    ).rejects.toMatchObject({ data: "DEV_AUTH_DISABLED" });
  });

  it.each([
    { iss: "attacker" },
    { aud: "other-application" },
    { environment: "preview" },
    { deploymentName: "production-deployment" },
    { sub: undefined },
    { sub: "" },
    { sub: 123 },
    { iat: undefined },
    { exp: undefined },
    { iat: now() - 61, exp: now() - 1 },
    { iat: now() + 60, exp: now() + 120 },
    { iat: now(), exp: now() + 61 },
    { iat: now(), exp: now() },
    { iat: now() + 0.5, exp: now() + 59.5 },
  ])(
    "rejects forged, expired or improperly scoped claims %j",
    async (claims) => {
      await expect(
        verifyDevImpersonationToken(await token(claims), backendEnvironment),
      ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    },
  );

  it("rejects a wrong signature, algorithm and tampered subject", async () => {
    await expect(
      verifyDevImpersonationToken(
        await token({}, "different-secret-signing-key-123456789"),
        backendEnvironment,
      ),
    ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    await expect(
      verifyDevImpersonationToken(
        await token({}, secret, "HS384"),
        backendEnvironment,
      ),
    ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    const signed = (await token()).split(".");
    const forgedClaims = JSON.parse(
      Buffer.from(signed[1], "base64url").toString(),
    );
    signed[1] = Buffer.from(
      JSON.stringify({ ...forgedClaims, sub: "victim-user" }),
    ).toString("base64url");
    await expect(
      verifyDevImpersonationToken(signed.join("."), backendEnvironment),
    ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
  });

  it.each([undefined, null, 123, "", "invalid", "x".repeat(4097)])(
    "rejects invalid token input %j",
    async (input) => {
      await expect(
        verifyDevImpersonationToken(input, backendEnvironment),
      ).rejects.toMatchObject({ data: "INVALID_DEV_AUTH_TOKEN" });
    },
  );
});
