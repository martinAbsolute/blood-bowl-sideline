import { convexAuth } from "@convex-dev/auth/server";
import { telegramProvider } from "../src/lib/telegram-oidc";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [telegramProvider()],
});
