import { convexAuth } from "@convex-dev/auth/server";
import { telegramProvider } from "../src/lib/telegram-oidc";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const isTelegramConfigured = action({
  args: {},
  returns: v.boolean(),
  handler: async () =>
    Boolean(
      process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET,
    ),
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [telegramProvider()],
});
