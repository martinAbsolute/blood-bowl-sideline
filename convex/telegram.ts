"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendLogin = internalAction({
  args: { chatId: v.number() },
  returns: v.null(),
  handler: async (_ctx, { chatId }) => {
    if (!Number.isSafeInteger(chatId) || chatId <= 0)
      throw new Error("Invalid Telegram chat");
    const token = process.env.TELEGRAM_BOT_TOKEN,
      site = process.env.SITE_URL;
    if (!token || !site)
      throw new Error("Telegram authentication is not configured");
    let response: Response;
    try {
      response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🏈 Blood Bowl Sideline\n\nWelcome, coach! / Вітаємо, тренере!\nSign in to save your teams. / Увійди, щоб зберегти команди.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Open Sideline / Відкрити",
                    url: `${site}/builder`,
                  },
                ],
              ],
            },
          }),
        },
      );
    } catch {
      throw new Error("Telegram delivery failed");
    }
    const result = (await response.json()) as { ok?: boolean };
    if (!response.ok || !result.ok) throw new Error("Telegram delivery failed");
    return null;
  },
});
