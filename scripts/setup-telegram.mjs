import { execFileSync } from "node:child_process";
import { randomBytes, generateKeyPairSync } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Secrets stay in captured process output and temporary files, never logs or argv.
const args = process.argv.slice(2),
  production = args.includes("--prod");
const siteArg = args.find((a) => a.startsWith("--site="));
const convexSiteArg = args.find((a) => a.startsWith("--convex-site="));
if (!siteArg || !convexSiteArg)
  throw new Error(
    "Pass --site=https://your-app and --convex-site=https://your-deployment.convex.site, optionally --prod --copy-dev-credentials.",
  );
const site = new URL(siteArg.slice(7)),
  convexSite = new URL(convexSiteArg.slice(14));
if (
  site.protocol !== "https:" ||
  convexSite.protocol !== "https:" ||
  !convexSite.hostname.endsWith(".convex.site")
)
  throw new Error("HTTPS app and Convex site URLs are required.");
const selection = production ? ["--prod"] : [];
function convex(command, selected = selection) {
  try {
    return execFileSync(
      process.execPath,
      [
        resolve("node_modules/convex/bin/main.js"),
        "env",
        ...selected,
        ...command,
      ],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  } catch (cause) {
    throw new Error(
      `Convex environment command failed at ${command[0]} ${command[1]}`,
      { cause },
    );
  }
}
function setVariables(values) {
  const file = join(tmpdir(), `bbs-env-${randomBytes(16).toString("hex")}`);
  try {
    writeFileSync(
      file,
      Object.entries(values)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join("\n"),
      { mode: 0o600 },
    );
    try {
      convex(["set", "--from-file", file, "--force"]);
    } catch (error) {
      let safe = String(error.cause?.stderr ?? "No CLI diagnostics");
      for (const value of Object.values(values)) {
        if (value)
          safe = safe
            .split(value)
            .join("[redacted]")
            .split(JSON.stringify(value))
            .join("[redacted]");
      }
      throw new Error(safe);
    }
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* Nothing is retained intentionally. */
    }
  }
}
async function telegram(token, method, body) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error();
    return data.result;
  } catch {
    throw new Error(`Telegram ${method} failed; no credentials were logged.`);
  }
}
async function main() {
  const names = convex(["list", "--names-only"]);
  let token;
  if (production && args.includes("--copy-dev-credentials")) {
    token = convex(["get", "TELEGRAM_BOT_TOKEN"], []);
  } else token = convex(["get", "TELEGRAM_BOT_TOKEN"]);
  if (!token || token === "undefined")
    throw new Error(
      "Add TELEGRAM_BOT_TOKEN in the selected Convex deployment first.",
    );
  const bot = await telegram(token, "getMe", {});
  const clientId =
    args.find((a) => a.startsWith("--client-id="))?.slice(12) ??
    convex(["get", "TELEGRAM_CLIENT_ID"]);
  if (String(bot.id) !== clientId)
    throw new Error(
      "The OIDC client ID and bot token refer to different bots.",
    );
  const clientSecret = convex(
    ["get", "TELEGRAM_CLIENT_SECRET"],
    production && args.includes("--copy-dev-credentials") ? [] : selection,
  );
  if (!clientSecret || clientSecret === "undefined")
    throw new Error("Add TELEGRAM_CLIENT_SECRET to Convex first.");
  const values = {
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_BOT_USERNAME: bot.username,
    TELEGRAM_CLIENT_ID: clientId,
    TELEGRAM_CLIENT_SECRET: clientSecret,
    SITE_URL: site.origin,
  };
  if (!names.includes("JWT_PRIVATE_KEY")) {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    values.JWT_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .trimEnd()
      .replace(/\n/g, " ");
    values.JWKS = JSON.stringify({
      keys: [{ use: "sig", ...keys.publicKey.export({ format: "jwk" }) }],
    });
  }
  const secret =
    names.includes("TELEGRAM_WEBHOOK_SECRET") &&
    names.includes("TELEGRAM_BOT_USERNAME") &&
    convex(["get", "TELEGRAM_BOT_USERNAME"]) === bot.username
      ? convex(["get", "TELEGRAM_WEBHOOK_SECRET"])
      : randomBytes(32).toString("hex");
  values.TELEGRAM_WEBHOOK_SECRET = secret;
  setVariables(values);
  await telegram(token, "setWebhook", {
    url: `${convexSite.origin}/telegram-webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
  });
  const info = await telegram(token, "getWebhookInfo", {});
  if (info.url !== `${convexSite.origin}/telegram-webhook`)
    throw new Error("Webhook verification failed.");
  console.log(
    `Configured @${bot.username} for ${production ? "production" : "development"}. Signing keys and webhook secret are stored only in Convex.`,
  );
  console.log(
    `OIDC redirect URI: ${convexSite.origin}/api/auth/callback/telegram. Trusted origin: ${site.origin}.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
