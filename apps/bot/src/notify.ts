import { env } from "./env.js";

/** Sends a Telegram message directly via the HTTP API, independent of the grammy Bot instance/polling loop. */
export async function notifyOwner(text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.telegramAllowedUserId, text }),
  }).catch((err) => console.error("Kunne ikke sende Telegram-notifikation:", err));
}
