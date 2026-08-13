import { searchGmail } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";

const LOOKBACK_HOURS = 14;

interface FlagResult {
  flag: boolean;
  message: string | null;
}

async function callClaudeForFlag(context: string): Promise<FlagResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      system:
        "Du overvåger brugerens forretning (AMSW) og konti for aktivitet der kræver opmærksomhed UOPFORDRET - fx uventede konto-/betalingsændringer, sikkerhedsadvarsler, fejl der er dukket op, eller noget der ser forkert eller mistænkeligt ud. Vær konservativ: flag kun hvis det reelt kræver brugerens opmærksomhed nu. Almindelige kvitteringer, rutine-notifikationer og ting brugeren selv tydeligvis har foretaget sig, skal IKKE flages - de fleste gennemgange bør ende med flag=false. Skriv altid på dansk, kort og direkte, i én besked à få linjer.",
      messages: [{ role: "user", content: context }],
      tools: [
        {
          name: "flag_review",
          description: "Afgør om noget fra den seneste aktivitet kræver brugerens opmærksomhed nu.",
          input_schema: {
            type: "object",
            properties: {
              flag: { type: "boolean" },
              message: { type: ["string", "null"], description: "Kort besked til brugeren hvis flag er true, ellers null." },
            },
            required: ["flag", "message"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "flag_review" },
    }),
  });
  if (!response.ok) throw new Error(`Claude-overvågning fejlede: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { content: Array<{ type: string; input?: FlagResult }> };
  const toolUse = data.content.find((b) => b.type === "tool_use");
  return toolUse?.input ?? { flag: false, message: null };
}

/** Pulls together only what's changed/arrived since the last lookback window - not the full daily
 *  briefing's picture - so the triage call (and the user, if flagged) only sees fresh signal. */
async function gatherRecentSignals(): Promise<string> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const parts: string[] = [];

  if (env.google.clientId && env.google.refreshToken) {
    try {
      const sinceUnix = Math.floor(since.getTime() / 1000);
      const emails = await searchGmail(env.google, `after:${sinceUnix}`, 20);
      if (emails.length > 0) {
        parts.push(
          `Mails modtaget siden sidste tjek (${emails.length}):\n` +
            emails.map((e) => `- Fra: ${e.from} | Emne: ${e.subject} | ${e.snippet}`).join("\n"),
        );
      }
    } catch (err) {
      console.error("Kunne ikke hente mails til overvågning:", err);
    }
  }

  const { data: statusRows } = await supabase
    .from("amsw_status")
    .select("area, state, note, recorded_at")
    .eq("owner_id", env.ownerId)
    .gte("recorded_at", since.toISOString())
    .in("state", ["yellow", "red"]);
  if (statusRows && statusRows.length > 0) {
    parts.push(
      `Status-ændringer siden sidste tjek:\n` +
        statusRows.map((s) => `- ${s.area}: ${s.state}${s.note ? ` (${s.note})` : ""}`).join("\n"),
    );
  }

  const { data: errorRows } = await supabase
    .from("integration_sync_state")
    .select("source, last_error, last_error_at")
    .eq("owner_id", env.ownerId)
    .not("last_error", "is", null)
    .gte("last_error_at", since.toISOString());
  if (errorRows && errorRows.length > 0) {
    parts.push(`Nye integrations-fejl siden sidste tjek:\n` + errorRows.map((e) => `- ${e.source}: ${e.last_error}`).join("\n"));
  }

  return parts.join("\n\n");
}

export async function checkRecentActivity(): Promise<FlagResult> {
  if (!env.anthropicApiKey) return { flag: false, message: null };

  const context = await gatherRecentSignals();
  if (!context.trim()) return { flag: false, message: null };

  return callClaudeForFlag(context).catch((err) => {
    console.error("Proaktivt tjek fejlede:", err);
    return { flag: false, message: null };
  });
}

/** Runs a silent triage pass over recent activity; only messages the owner if something is actually
 *  flagged. Deliberately says nothing when there's nothing to report - a job that pings daily with
 *  "all clear" trains the owner to ignore it, which defeats the point. */
export async function runProactiveCheck(): Promise<void> {
  const result = await checkRecentActivity();
  if (result.flag && result.message) {
    await notifyOwner(`👀 ${result.message}`);
  }
}
