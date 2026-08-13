import { env } from "./env.js";
import type { InlineKeyboardMarkup } from "./notice.js";

/** Sends a Telegram message directly via the HTTP API, independent of the grammy Bot instance/polling loop.
 *  `replyMarkup` (e.g. an inline keyboard) still gets its callback_query delivered to the bot's own
 *  long-polling loop regardless of which code path sent the original message. */
export async function notifyOwner(text: string, replyMarkup?: InlineKeyboardMarkup): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.telegramAllowedUserId, text, reply_markup: replyMarkup }),
  }).catch((err) => console.error("Kunne ikke sende Telegram-notifikation:", err));
}
