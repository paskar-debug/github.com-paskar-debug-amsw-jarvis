import {
  checkAnthropicStatus,
  checkOpenAiStatus,
  checkRailwayStatus,
  checkSupabaseStatus,
  checkTelegramStatus,
  checkVercelStatus,
  type InfraServiceStatus,
} from "@amsw/integrations";
import { env } from "./env.js";
import { recordFailure, recordSuccess, type StatusSource } from "./statusStore.js";

/** Checks the platforms AMSW Jarvis itself runs on. Run on a long interval - the
 *  OpenAI/Anthropic checks make a real (tiny, paid) API call each time. */
export async function checkInfra() {
  const checks: [StatusSource, () => Promise<InfraServiceStatus>][] = [
    ["telegram", () => checkTelegramStatus({ botToken: env.telegramBotToken })],
  ];

  if (env.infra.supabaseAccessToken) {
    checks.push(["supabase", () => checkSupabaseStatus({ accessToken: env.infra.supabaseAccessToken, projectUrl: env.supabaseUrl })]);
  }
  if (env.infra.vercelApiToken) {
    checks.push(["vercel", () => checkVercelStatus({ apiToken: env.infra.vercelApiToken, projectName: env.infra.vercelProjectName })]);
  }
  if (env.infra.railwayApiToken) {
    checks.push(["railway", () => checkRailwayStatus({ apiToken: env.infra.railwayApiToken })]);
  }
  if (env.openaiApiKey) {
    checks.push(["openai", () => checkOpenAiStatus({ apiKey: env.openaiApiKey })]);
  }
  if (env.anthropicApiKey) {
    checks.push(["anthropic", () => checkAnthropicStatus({ apiKey: env.anthropicApiKey })]);
  }

  for (const [source, fn] of checks) {
    try {
      const result = await fn();
      await recordSuccess(source, "infrastructure", result);
    } catch (err) {
      await recordFailure(source, "infrastructure", (err as Error).message);
    }
  }
}
