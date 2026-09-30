import { beforeAll, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from "jose";
import {
  TELEGRAM_ISSUER,
  verifyTelegramIdToken,
} from "../src/lib/telegram-oidc";
let key: CryptoKey, keys: ReturnType<typeof createLocalJWKSet>;
const clientId = "8809799343";
beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test" }],
  });
});
function sign(issuer = TELEGRAM_ISSUER, audience = clientId, expiry = "5m") {
  return new SignJWT({
    name: "Test coach",
    phone_number: "never-retain-this",
    preferred_username: "test",
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("opaque-telegram-subject")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(key);
}
it("verifies signed Telegram identity and projects only needed user fields", async () => {
  expect(await verifyTelegramIdToken(await sign(), clientId, keys)).toEqual({
    id: "opaque-telegram-subject",
    name: "Test coach",
  });
});
it("rejects an issuer or audience from a different service or bot", async () => {
  await expect(
    verifyTelegramIdToken(
      await sign("https://attacker.invalid"),
      clientId,
      keys,
    ),
  ).rejects.toThrow();
  await expect(
    verifyTelegramIdToken(
      await sign(TELEGRAM_ISSUER, "wrong-bot"),
      clientId,
      keys,
    ),
  ).rejects.toThrow();
});
it("rejects expired tokens and altered signatures", async () => {
  await expect(
    verifyTelegramIdToken(
      await sign(TELEGRAM_ISSUER, clientId, "-1h"),
      clientId,
      keys,
    ),
  ).rejects.toThrow();
  const token = await sign();
  const parts = token.split(".");
  parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
  await expect(
    verifyTelegramIdToken(parts.join("."), clientId, keys),
  ).rejects.toThrow();
});
