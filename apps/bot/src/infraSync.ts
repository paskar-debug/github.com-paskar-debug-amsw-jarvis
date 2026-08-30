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
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";
import { LABELS, recordFailure, recordSuccess, type StatusSource } from "./statusStore.js";

// Below either threshold, the owner gets a heads-up before it actually breaks something (a
// trial expiring, or a pay-as-you-go balance running out) rather than only finding out once
// requests start failing outright.
const TRIAL_WARNING_THRESHOLD_DAYS = 7;
const LOW_CREDIT_THRESHOLD = 2;

function copenhagenDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

/** If this service's plan/trial/credit data looks risky, sends at most one Telegram warning per
 *  calendar day (re-checked every 6h, but re-warning every cycle would be noise) - the "already
 *  warned today" marker rides along in the same `detail` blob recordSuccess writes anyway, so
 *  this needs no extra table. */
async function warnIfAtRisk(source: StatusSource, result: InfraServiceStatus): Promise<InfraServiceStatus> {
  const detail = result.detail as { isTrialing?: boolean; trialDaysRemaining?: number; creditBalance?: number };
  const trialAtRisk = detail?.isTrialing && typeof detail.trialDaysRemaining === "number" && detail.trialDaysRemaining <= TRIAL_WARNING_THRESHOLD_DAYS;
  const creditAtRisk = typeof detail?.creditBalance === "number" && detail.creditBalance <= LOW_CREDIT_THRESHOLD;
  if (!trialAtRisk && !creditAtRisk) return result;

  const today = copenhagenDateKey();
  const { data: existing } = await supabase
    .from("integration_sync_state")
    .select("detail")
    .eq("owner_id", env.ownerId)
    .eq("source", source)
    .maybeSingle();
  const previousDetail = (existing?.detail ?? {}) as { lastRiskWarningAt?: string };
  if (previousDetail.lastRiskWarningAt === today) return result;

  const label = LABELS[source];
  const message = trialAtRisk
    ? `⚠️ ${label}: kun ${detail.trialDaysRemaining} ${detail.trialDaysRemaining === 1 ? "dag" : "dage"} tilbage af trial-perioden. Husk at sætte betaling op, ellers stopper det.`
    : `⚠️ ${label}: kun ${detail.creditBalance} kr./$ tilbage i forbrugskredit.`;
  await notifyOwner(message);

  return { ...result, detail: { ...result.detail, lastRiskWarningAt: today } };
}

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
      const result = await warnIfAtRisk(source, await fn());
      await recordSuccess(source, "infrastructure", result);
    } catch (err) {
      await recordFailure(source, "infrastructure", (err as Error).message);
    }
  }
}
