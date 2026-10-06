import type { OIDCConfig } from "@auth/core/providers";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
export const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const telegramKeys = createRemoteJWKSet(
  new URL(`${TELEGRAM_ISSUER}/.well-known/jwks.json`),
);
const profileSchema = z.object({
  sub: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  preferred_username: z.string().optional(),
  picture: z.url().optional(),
});
export async function verifyTelegramIdToken(
  token: string,
  clientId: string,
  keySet: JWTVerifyGetKey = telegramKeys,
) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: TELEGRAM_ISSUER,
    audience: clientId,
    algorithms: ["RS256", "ES256", "EdDSA", "ES256K"],
    requiredClaims: ["sub", "iat", "exp"],
    clockTolerance: 5,
  });
  const p = profileSchema.parse(payload);
  const username = p.preferred_username;
  return {
    id: p.sub,
    name: p.name ?? "Telegram coach",
    ...(username && /^[A-Za-z0-9_]{1,32}$/.test(username)
      ? { telegramUsername: username }
      : {}),
    ...(p.picture ? { image: p.picture } : {}),
  };
}
export function telegramProvider(): OIDCConfig<Record<string, unknown>> {
  return {
    id: "telegram",
    name: "Telegram",
    type: "oidc",
    issuer: TELEGRAM_ISSUER,
    wellKnown: `${TELEGRAM_ISSUER}/.well-known/openid-configuration`,
    clientId: process.env.TELEGRAM_CLIENT_ID,
    clientSecret: process.env.TELEGRAM_CLIENT_SECRET,
    client: { token_endpoint_auth_method: "client_secret_basic" },
    checks: ["pkce", "state"],
    idToken: true,
    authorization: { params: { scope: "openid profile" } },
    async profile(_profile, tokens) {
      if (!tokens.id_token || !process.env.TELEGRAM_CLIENT_ID)
        throw new Error("Telegram OIDC credentials are not configured");
      // Convex Auth checks the code, PKCE, state, and OIDC claims. Independently
      // verify Telegram's signature before projecting any profile into a user.
      return verifyTelegramIdToken(
        tokens.id_token,
        process.env.TELEGRAM_CLIENT_ID,
      );
    },
  };
}
