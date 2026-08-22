import { Bot, InputFile, type Context } from "grammy";
import type { AmswState } from "@amsw/core";
import { discardDraft, sendDraft } from "@amsw/integrations";
import { env } from "./env.js";
import { transcribeVoice } from "./stt.js";
import { synthesizeSpeech } from "./tts.js";
import { ttsConfig } from "./ttsConfig.js";
import { createGoal, createTask, handleFreeformMessage, runSync, saveFact, setStatus, updateGoalProgress } from "./handlers.js";
import { syncAll } from "./sync.js";
import { checkInfra } from "./infraSync.js";
import { sendDailyBriefing } from "./briefing.js";
import { checkRecentActivity, formatTriageOutcome, runProactiveCheck } from "./notice.js";
import { scheduleDaily } from "./scheduler.js";
import { buildGoalsReview, runWeeklyGoalsCheck } from "./goalsReview.js";

const bot = new Bot(env.telegramBotToken);

// Personligt system: kun ejeren må tale med botten.
bot.use(async (ctx, next) => {
  if (String(ctx.from?.id) !== env.telegramAllowedUserId) {
    await ctx.reply("Denne bot er privat.");
    return;
  }
  await next();
});

const TELEGRAM_MESSAGE_LIMIT = 3500;

function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TELEGRAM_MESSAGE_LIMIT) {
    const breakPoint = remaining.lastIndexOf("\n\n", TELEGRAM_MESSAGE_LIMIT);
    const cut = breakPoint > TELEGRAM_MESSAGE_LIMIT * 0.5 ? breakPoint : TELEGRAM_MESSAGE_LIMIT;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function replyText(ctx: Context, text: string, spokenInput: boolean) {
  for (const chunk of splitForTelegram(text)) {
    await ctx.reply(chunk);
  }
  // Lange udkast/analyser er ikke egnede til at læse højt - kun korte svar bliver til tale.
  if (!spokenInput || text.length > 600) return;
  try {
    const { audio, format } = await synthesizeSpeech(text, ttsConfig);
    if (format === "ogg") {
      await ctx.replyWithVoice(new InputFile(audio, "svar.ogg"));
    } else {
      await ctx.replyWithAudio(new InputFile(audio, "svar.mp3"));
    }
  } catch (err) {
    console.error("TTS fejlede, sender kun tekst:", err);
  }
}

const STATE_ALIASES: Record<string, AmswState> = {
  green: "green",
  grøn: "green",
  yellow: "yellow",
  gul: "yellow",
  red: "red",
  rød: "red",
};

bot.command("start", (ctx) => ctx.reply("Hej! Jeg er Jarvis. Skriv eller indtal en besked, så opretter jeg en opgave. Se /help for kommandoer."));

bot.command("help", (ctx) =>
  ctx.reply(
    [
      "/opgave <tekst> - opret opgave",
      "/husk <tekst> - gem et fakta om dig selv (fx navne, præferencer), som botten bruger som kontekst i udkast",
      "/status <område> <green|yellow|red> [note] - sæt AMSW-status",
      "/maal <kategori> | <titel> [| YYYY-MM-DD] - opret et mål for AMSW's fremtid (fx salg, økonomi, udland)",
      "/maal_fremgang <tekst der matcher målet> <0-100> - opdater fremgang på et mål i procent",
      "/maal_tjek - få en mål-gennemgang med det samme (ellers kommer den automatisk hver mandag kl. 08:00)",
      "/sync - hent nyt fra Google Kalender, Todoist, Shopify og Whoop",
      "/tjek - tjek selv med det samme for noget der kræver din opmærksomhed (mails, status, fejl)",
      "Hver morgen kl. 07:00 får du automatisk en briefing med dagens aftaler, åbne opgaver og status.",
      "Hver mandag kl. 08:00 får du en varm, opmuntrende gennemgang af AMSW's mål - kun observation, ingen automatiske ændringer.",
      "Kl. 12:00 og 18:00 tjekker botten selv for noget der kræver din opmærksomhed, og skriver kun til dig hvis den finder noget.",
      "Almindelig tekst eller en stemmebesked bliver automatisk til en opgave, en kalenderaftale, en sletning af en aftale eller opgave, et fakta der skal huskes, et mål for AMSW (start gerne med \"mål:\"), eller et udkast/analyse du beder om at få skrevet med det samme, alt efter indholdet.",
    ].join("\n"),
  ),
);

bot.command("opgave", async (ctx) => {
  const title = ctx.match.trim();
  if (!title) return ctx.reply("Brug: /opgave <tekst>");
  await replyText(ctx, await createTask(title), false);
});

bot.command("husk", async (ctx) => {
  const fact = ctx.match.trim();
  if (!fact) return ctx.reply("Brug: /husk <tekst>");
  await replyText(ctx, await saveFact(fact), false);
});

bot.command("maal", async (ctx) => {
  const raw = ctx.match.trim();
  const [category, title, targetDate] = raw.split("|").map((s) => s.trim());
  if (!title) return ctx.reply("Brug: /maal <kategori> | <titel> [| YYYY-MM-DD]");
  await replyText(ctx, await createGoal(title, category || undefined, targetDate || undefined), false);
});

bot.command("maal_fremgang", async (ctx) => {
  const raw = ctx.match.trim();
  const lastSpace = raw.lastIndexOf(" ");
  const query = lastSpace === -1 ? "" : raw.slice(0, lastSpace).trim();
  const progress = Number(raw.slice(lastSpace + 1));
  if (!query || Number.isNaN(progress)) return ctx.reply("Brug: /maal_fremgang <tekst der matcher målet> <0-100>");
  await replyText(ctx, await updateGoalProgress(query, progress), false);
});

bot.command("maal_tjek", async (ctx) => {
  const message = await buildGoalsReview();
  await ctx.reply(message ?? "Ingen mål oprettet endnu.");
});

bot.command("status", async (ctx) => {
  const [area, rawState, ...noteParts] = ctx.match.trim().split(/\s+/);
  const state = rawState ? STATE_ALIASES[rawState.toLowerCase()] : undefined;
  if (!area || !state) return ctx.reply("Brug: /status <område> <green|yellow|red> [note]");
  await replyText(ctx, await setStatus(area, state, noteParts.join(" ") || undefined), false);
});

bot.command("sync", async (ctx) => {
  await ctx.reply("Synkroniserer...");
  await replyText(ctx, await runSync(), false);
});

bot.command("tjek", async (ctx) => {
  await ctx.reply("Tjekker seneste aktivitet...");
  const { result, drafts } = await checkRecentActivity();
  if (!result.flag || !result.message) {
    await ctx.reply("Ingen ting at bemærke lige nu.");
    return;
  }
  const { text, replyMarkup } = formatTriageOutcome(result, drafts);
  await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
});

bot.on("callback_query:data", async (ctx) => {
  const [action, draftId] = ctx.callbackQuery.data.split(":");
  if (!draftId || (action !== "send_draft" && action !== "discard_draft")) {
    await ctx.answerCallbackQuery();
    return;
  }
  try {
    if (action === "send_draft") {
      await sendDraft(env.google, draftId);
      await ctx.answerCallbackQuery({ text: "Sendt!" });
    } else {
      await discardDraft(env.google, draftId);
      await ctx.answerCallbackQuery({ text: "Udkast slettet." });
    }
    await ctx.editMessageReplyMarkup(undefined);
  } catch (err) {
    await ctx.answerCallbackQuery({ text: `Fejlede: ${(err as Error).message}`, show_alert: true });
  }
});

bot.on("message:text", async (ctx) => {
  await replyText(ctx, await handleFreeformMessage(ctx.message.text), false);
});

bot.on("message:voice", async (ctx) => {
  if (!env.openaiApiKey) {
    await ctx.reply("OPENAI_API_KEY mangler, kan ikke transskribere stemmebeskeder.");
    return;
  }
  const file = await ctx.getFile();
  const fileUrl = `https://api.telegram.org/file/bot${env.telegramBotToken}/${file.file_path}`;
  const response = await fetch(fileUrl);
  const audio = Buffer.from(await response.arrayBuffer());

  const text = await transcribeVoice(audio, env.openaiApiKey);
  await replyText(ctx, await handleFreeformMessage(text), true);
});

bot.catch((err) => console.error("Bot-fejl:", err));

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  syncAll().catch((err) => console.error("Baggrunds-sync fejlede:", err));
}, SYNC_INTERVAL_MS);

// Sjældnere end data-syncen: OpenAI/Anthropic-tjekket laver et rigtigt (men meget billigt) API-kald hver gang.
const INFRA_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  checkInfra().catch((err) => console.error("Infrastruktur-tjek fejlede:", err));
}, INFRA_CHECK_INTERVAL_MS);
checkInfra().catch((err) => console.error("Infrastruktur-tjek fejlede:", err));

scheduleDaily(7, 0, "Europe/Copenhagen", sendDailyBriefing);
scheduleDaily(8, 0, "Europe/Copenhagen", runWeeklyGoalsCheck);
scheduleDaily(12, 0, "Europe/Copenhagen", runProactiveCheck);
scheduleDaily(18, 0, "Europe/Copenhagen", runProactiveCheck);

bot.start();
console.log("AMSW Jarvis-bot kører.");
