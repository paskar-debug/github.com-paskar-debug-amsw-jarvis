import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// apps/bot is started with the workspace dir as cwd, but .env lives at the repo root.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(repoRoot, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  ownerId: required("SUPABASE_OWNER_USER_ID"),

  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramAllowedUserId: required("TELEGRAM_ALLOWED_USER_ID"),

  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // Bruges kun til at klassificere beskeder som opgave/kalenderaftale - Whisper/TTS bruger stadig OPENAI_API_KEY.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",

  ttsProvider: (process.env.TTS_PROVIDER ?? "openai") as "openai" | "elevenlabs",
  openaiTtsVoice: process.env.OPENAI_TTS_VOICE ?? "alloy",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "primary",
  },
  shopify: {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN ?? "",
    adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN ?? "",
    apiVersion: process.env.SHOPIFY_API_VERSION ?? "2024-10",
  },
  whoop: {
    clientId: process.env.WHOOP_CLIENT_ID ?? "",
    clientSecret: process.env.WHOOP_CLIENT_SECRET ?? "",
  },

  // Status/plan for platformene selv (Supabase/Vercel/Railway/OpenAI/Anthropic),
  // adskilt fra forretnings-integrationerne ovenfor.
  infra: {
    supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN ?? "",
    vercelApiToken: process.env.VERCEL_API_TOKEN ?? "",
    vercelProjectName: process.env.VERCEL_PROJECT_NAME ?? "amsw",
    railwayApiToken: process.env.RAILWAY_API_TOKEN ?? "",
  },
};
