import type { TypedSupabaseClient } from "@amsw/db";

export interface WhoopConfig {
  clientId: string;
  clientSecret: string;
}

interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
}

async function refreshWhoopTokens(config: WhoopConfig, refreshToken: string): Promise<WhoopTokens> {
  const response = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "offline",
    }),
  });
  if (!response.ok) {
    throw new Error(`Whoop token-fornyelse fejlede: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token: string; refresh_token: string };
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function getStoredRefreshToken(supabase: TypedSupabaseClient, ownerId: string): Promise<string> {
  const { data } = await supabase.from("whoop_auth").select("refresh_token").eq("owner_id", ownerId).maybeSingle();
  if (!data?.refresh_token) throw new Error("Ingen Whoop refresh-token gemt - kør OAuth-godkendelsen igen.");
  return data.refresh_token;
}

async function storeRefreshToken(supabase: TypedSupabaseClient, ownerId: string, refreshToken: string): Promise<void> {
  const { error } = await supabase
    .from("whoop_auth")
    .upsert({ owner_id: ownerId, refresh_token: refreshToken, updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
  if (error) throw error;
}

interface RecoveryResponse {
  records: Array<{ score_state: string; score?: { recovery_score: number; resting_heart_rate: number; hrv_rmssd_milli: number } }>;
}

interface SleepResponse {
  records: Array<{
    score_state: string;
    score?: {
      sleep_performance_percentage: number;
      stage_summary: { total_light_sleep_time_milli: number; total_slow_wave_sleep_time_milli: number; total_rem_sleep_time_milli: number };
    };
  }>;
}

interface CycleResponse {
  records: Array<{ score_state: string; score?: { strain: number; average_heart_rate: number; max_heart_rate: number } }>;
}

/** Actual sleep time excludes awake/no-data time within the sleep window - light + SWS + REM. */
export function computeSleepDurationHours(stages: {
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
} | null | undefined): number | null {
  if (!stages) return null;
  const milli = stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli;
  return Math.round((milli / 3_600_000) * 10) / 10;
}

/** Whoop's own recovery color-coding: green >=67, yellow 34-66, red <34. Null (no score yet) maps to yellow, not red - it's unknown, not bad. */
export function recoveryState(score: number | null): "green" | "yellow" | "red" {
  if (score === null) return "yellow";
  if (score < 34) return "red";
  if (score < 67) return "yellow";
  return "green";
}

export interface WhoopSummary {
  recoveryScore: number | null;
  restingHeartRate: number | null;
  hrvMilli: number | null;
  sleepPerformancePercentage: number | null;
  sleepDurationHours: number | null;
  strain: number | null;
  averageHeartRate: number | null;
}

/** Pulls the latest scored recovery/sleep/cycle from Whoop. Rotates and re-persists the refresh
 *  token immediately after use (before any data fetch), since Whoop invalidates the old one on
 *  every refresh regardless of what happens next. */
export async function syncWhoop(supabase: TypedSupabaseClient, ownerId: string, config: WhoopConfig): Promise<WhoopSummary> {
  const currentRefreshToken = await getStoredRefreshToken(supabase, ownerId);
  const tokens = await refreshWhoopTokens(config, currentRefreshToken);
  await storeRefreshToken(supabase, ownerId, tokens.refreshToken);

  const headers = { Authorization: `Bearer ${tokens.accessToken}` };
  const base = "https://api.prod.whoop.com/developer/v2";

  const [recoveryRes, sleepRes, cycleRes] = await Promise.all([
    fetch(`${base}/recovery?limit=1`, { headers }),
    fetch(`${base}/activity/sleep?limit=1`, { headers }),
    fetch(`${base}/cycle?limit=1`, { headers }),
  ]);
  if (!recoveryRes.ok) throw new Error(`Whoop recovery-opslag fejlede: ${recoveryRes.status} ${await recoveryRes.text()}`);
  if (!sleepRes.ok) throw new Error(`Whoop sleep-opslag fejlede: ${sleepRes.status} ${await sleepRes.text()}`);
  if (!cycleRes.ok) throw new Error(`Whoop cycle-opslag fejlede: ${cycleRes.status} ${await cycleRes.text()}`);

  const recovery = ((await recoveryRes.json()) as RecoveryResponse).records[0];
  const sleep = ((await sleepRes.json()) as SleepResponse).records[0];
  const cycle = ((await cycleRes.json()) as CycleResponse).records[0];

  const summary: WhoopSummary = {
    recoveryScore: recovery?.score?.recovery_score ?? null,
    restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
    hrvMilli: recovery?.score?.hrv_rmssd_milli ?? null,
    sleepPerformancePercentage: sleep?.score?.sleep_performance_percentage ?? null,
    sleepDurationHours: computeSleepDurationHours(sleep?.score?.stage_summary),
    strain: cycle?.score?.strain ?? null,
    averageHeartRate: cycle?.score?.average_heart_rate ?? null,
  };

  const { error } = await supabase.from("amsw_status").insert({
    owner_id: ownerId,
    area: "whoop",
    state: recoveryState(summary.recoveryScore),
    note: summary.recoveryScore !== null ? `Recovery ${summary.recoveryScore}%` : "Ingen recovery-score endnu",
    metrics: { ...summary },
  });
  if (error) throw error;

  return summary;
}
