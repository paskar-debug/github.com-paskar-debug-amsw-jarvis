import { Bot, InputFile, type Context } from "grammy";
import type { AmswState } from "@amsw/core";
import { env } from "./env.js";
import { transcribeVoice } from "./stt.js";
import { synthesizeSpeech, type TtsConfig } from "./tts.js";
import { createGoal, createTask, logWellbeing, runSync, setStatus } from "./handlers.js";
import { syncAll } from "./sync.js";

const bot = new Bot(env.telegramBotToken);

const ttsConfig: TtsConfig =
  env.ttsProvider === "elevenlabs"
    ? { provider: "elevenlabs", apiKey: env.elevenLabsApiKey, voiceId: env.elevenLabsVoiceId }
    : { provider: "openai", apiKey: env.openaiApiKey, voice: env.openaiTtsVoice };

// Personligt system: kun ejeren må tale med botten.
bot.use(async (ctx, next) => {
  if (String(ctx.from?.id) !== env.telegramAllowedUserId) {
    await ctx.reply("Denne bot er privat.");
    return;
  }
  await next();
});

async function replyText(ctx: Context, text: string, spokenInput: boolean) {
  await ctx.reply(text);
  if (!spokenInput) return;
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
      "/status <område> <green|yellow|red> [note] - sæt AMSW-status",
      "/maal <titel> - opret mål",
      "/velvaere <humør 1-5> <energi 1-5> [søvntimer] [note] - log velvære",
      "/sync - hent nyt fra Google Kalender, Todoist og Shopify",
      "Almindelig tekst eller en stemmebesked bliver automatisk til en opgave.",
    ].join("\n"),
  ),
);

bot.command("opgave", async (ctx) => {
  const title = ctx.match.trim();
  if (!title) return ctx.reply("Brug: /opgave <tekst>");
  await replyText(ctx, await createTask(title), false);
});

bot.command("status", async (ctx) => {
  const [area, rawState, ...noteParts] = ctx.match.trim().split(/\s+/);
  const state = rawState ? STATE_ALIASES[rawState.toLowerCase()] : undefined;
  if (!area || !state) return ctx.reply("Brug: /status <område> <green|yellow|red> [note]");
  await replyText(ctx, await setStatus(area, state, noteParts.join(" ") || undefined), false);
});

bot.command("maal", async (ctx) => {
  const title = ctx.match.trim();
  if (!title) return ctx.reply("Brug: /maal <titel>");
  await replyText(ctx, await createGoal(title), false);
});

bot.command("velvaere", async (ctx) => {
  const parts = ctx.match.trim().split(/\s+/);
  const mood = Number(parts[0]);
  const energy = Number(parts[1]);
  const sleepHours = parts[2] !== undefined && !Number.isNaN(Number(parts[2])) ? Number(parts[2]) : undefined;
  const note = parts.slice(sleepHours !== undefined ? 3 : 2).join(" ") || undefined;
  if (!mood || !energy || mood < 1 || mood > 5 || energy < 1 || energy > 5) {
    return ctx.reply("Brug: /velvaere <humør 1-5> <energi 1-5> [søvntimer] [note]");
  }
  await replyText(ctx, await logWellbeing(mood, energy, sleepHours, note), false);
});

bot.command("sync", async (ctx) => {
  await ctx.reply("Synkroniserer...");
  await replyText(ctx, await runSync(), false);
});

bot.on("message:text", async (ctx) => {
  await replyText(ctx, await createTask(ctx.message.text), false);
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
  await replyText(ctx, await createTask(text), true);
});

bot.catch((err) => console.error("Bot-fejl:", err));

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  syncAll().catch((err) => console.error("Baggrunds-sync fejlede:", err));
}, SYNC_INTERVAL_MS);

bot.start();
console.log("AMSW Jarvis-bot kører.");
