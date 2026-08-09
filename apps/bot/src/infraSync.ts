import {
  checkAnthropicStatus,
  checkOpenAiStatus,
  checkRailwayStatus,
  checkSupabaseStatus,
  checkVercelStatus,
  type InfraServiceStatus,
} from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";

type InfraSource = "supabase" | "vercel" | "railway" | "openai" | "anthropic";

async function record(source: InfraSource, result: InfraServiceStatus | { error: string }) {
  if ("error" in result) {
    await supabase.from("integration_sync_state").upsert(
      { owner_id: env.ownerId, source, category: "infrastructure", last_error: result.error, last_error_at: new Date().toISOString() },
      { onConflict: "owner_id,source" },
    );
  } else {
    await supabase.from("integration_sync_state").upsert(
      {
        owner_id: env.ownerId,
        source,
        category: "infrastructure",
        plan: result.plan,
        detail: result.detail,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        last_error_at: null,
      },
      { onConflict: "owner_id,source" },
    );
  }
}

/** Checks the platforms AMSW Jarvis itself runs on. Run on a long interval - the
 *  OpenAI/Anthropic checks make a real (tiny, paid) API call each time. */
export async function checkInfra() {
  const checks: [InfraSource, () => Promise<InfraServiceStatus>][] = [];

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
      await record(source, result);
    } catch (err) {
      await record(source, { error: (err as Error).message });
    }
  }
}
