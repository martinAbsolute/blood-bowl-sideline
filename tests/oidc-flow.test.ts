/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { createHash, generateKeyPairSync } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { TELEGRAM_ISSUER } from "../src/lib/telegram-oidc";
const modules = import.meta.glob("../convex/**/*.ts");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("completes code + PKCE + state + signed ID-token exchange into a Convex session", async () => {
  const clientId = "8809799343",
    signer = generateKeyPairSync("rsa", { modulusLength: 2048 }),
    telegram = await generateKeyPair("RS256");
  vi.stubEnv("TELEGRAM_CLIENT_ID", clientId);
  vi.stubEnv("TELEGRAM_CLIENT_SECRET", "test-secret");
  vi.stubEnv(
    "JWT_PRIVATE_KEY",
    signer.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .trimEnd()
      .replace(/\n/g, " "),
  );
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SITE_URL", "https://app.test");
  const jwks = {
    keys: [
      {
        ...(await exportJWK(telegram.publicKey)),
        kid: "flow-test",
        alg: "RS256",
      },
    ],
  };
  const idToken = await new SignJWT({ name: "OIDC test coach" })
    .setProtectedHeader({ alg: "RS256", kid: "flow-test" })
    .setSubject("fixture-subject")
    .setIssuer(TELEGRAM_ISSUER)
    .setAudience(clientId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(telegram.privateKey);
  let challenge = "",
    tokenCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/.well-known/openid-configuration"))
        return Response.json({
          issuer: TELEGRAM_ISSUER,
          authorization_endpoint: `${TELEGRAM_ISSUER}/auth`,
          token_endpoint: `${TELEGRAM_ISSUER}/token`,
          jwks_uri: `${TELEGRAM_ISSUER}/.well-known/jwks.json`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
        });
      if (url.endsWith("/.well-known/jwks.json")) return Response.json(jwks);
      if (url.endsWith("/token")) {
        tokenCalls++;
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("redirect_uri")).toBe(
          "https://test.convex.site/api/auth/callback/telegram",
        );
        expect(
          createHash("sha256")
            .update(body.get("code_verifier")!)
            .digest("base64url"),
        ).toBe(challenge);
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Basic ${Buffer.from(`${clientId}:test-secret`).toString("base64")}`,
        );
        return Response.json({
          access_token: "fixture-access-token",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: idToken,
        });
      }
      throw new Error("Unexpected OIDC request");
    }),
  );
  const t = convexTest(schema, modules);
  const beginning = await t.action(api.auth.signIn, {
    provider: "telegram",
    params: { redirectTo: "/builder" },
  });
  const redirect = new URL(beginning.redirect!);
  const signin = await t.fetch(redirect.pathname + redirect.search);
  expect(signin.status).toBe(302);
  const authorization = new URL(signin.headers.get("Location")!);
  expect(authorization.origin).toBe(TELEGRAM_ISSUER);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorization.searchParams.get("scope")).toBe("openid profile");
  challenge = authorization.searchParams.get("code_challenge")!;
  const cookies = signin.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const state = authorization.searchParams.get("state")!;
  const invalid = await t.fetch(
    `/api/auth/callback/telegram?code=fixture-code&state=invalid`,
    { headers: { Cookie: cookies } },
  );
  expect(invalid.status).toBe(302);
  expect(tokenCalls).toBe(0);
  const callback = await t.fetch(
    `/api/auth/callback/telegram?code=fixture-code&state=${encodeURIComponent(state)}`,
    { headers: { Cookie: cookies } },
  );
  expect(callback.status).toBe(302);
  expect(tokenCalls).toBe(1);
  const completion = new URL(callback.headers.get("Location")!);
  expect(completion.origin).toBe("https://app.test");
  expect(completion.pathname).toBe("/builder");
  const code = completion.searchParams.get("code");
  expect(code).toBeTruthy();
  const session = await t.action(api.auth.signIn, {
    params: { code: code! },
    verifier: beginning.verifier,
  });
  expect(session.tokens?.token).toBeTruthy();
  expect(
    await t.run((ctx) => ctx.db.query("authAccounts").collect()),
  ).toHaveLength(1);
});
