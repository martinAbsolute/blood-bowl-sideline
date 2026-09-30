import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { z } from "zod";

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().max(4096).optional(),
      chat: z.object({
        id: z.number().int().positive().safe(),
        type: z.literal("private"),
      }),
      from: z.object({
        id: z.number().int().positive().safe(),
        is_bot: z.boolean(),
      }),
    })
    .optional(),
});
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({
  path: "/telegram-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (
      !secret ||
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret
    )
      return new Response("Unauthorized", { status: 401 });
    const raw: unknown = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) return new Response("Invalid update", { status: 400 });
    const message = parsed.data.message;
    if (
      message?.text?.match(/^\/start(?:@[a-zA-Z0-9_]+)?(?:\s|$)/) &&
      !message.from.is_bot &&
      message.from.id === message.chat.id
    ) {
      try {
        await ctx.runAction(internal.telegram.sendLogin, {
          chatId: message.chat.id,
        });
      } catch {
        return new Response("Login prompt unavailable", { status: 503 });
      }
    }
    return new Response("OK");
  }),
});
export default http;
