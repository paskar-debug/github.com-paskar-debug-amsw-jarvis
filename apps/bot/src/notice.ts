import { createDraftReply, searchGmail } from "@amsw/integrations";
import { env } from "./env.js";
import { supabase } from "./supabase.js";
import { notifyOwner } from "./notify.js";

const LOOKBACK_HOURS = 14;
const MAX_TOOL_ROUNDS = 4;

export interface FlagResult {
  flag: boolean;
  message: string | null;
}

export interface DraftedReply {
  draftId: string;
  body: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: { text: string; callback_data: string }[][];
}

const TOOLS = [
  {
    name: "draft_reply",
    description:
      "Opret et UDKAST til svar på en specifik mail (id fra listen ovenfor). Sender IKKE noget - kræver brugerens godkendelse bagefter. Brug kun hvis en mail reelt kalder på et svar.",
    input_schema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "id'et på mailen der skal svares på, fra 'id:' i konteksten." },
        body: { type: "string", description: "Selve svarteksten, kort, på samme sprog som den oprindelige mail." },
      },
      required: ["message_id", "body"],
    },
  },
  {
    name: "flag_review",
    description: "Afslut vurderingen: afgør om noget kræver brugerens opmærksomhed nu, og skriv den endelige besked til brugeren.",
    input_schema: {
      type: "object",
      properties: {
        flag: { type: "boolean" },
        message: { type: ["string", "null"], description: "Kort besked til brugeren hvis flag er true, ellers null." },
      },
      required: ["flag", "message"],
    },
  },
];

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

async function callClaude(messages: unknown[]): Promise<{ content: ContentBlock[] }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system:
        "Du overvåger brugerens forretning (AMSW) og konti for aktivitet der kræver opmærksomhed UOPFORDRET - fx uventede konto-/betalingsændringer, sikkerhedsadvarsler, fejl der er dukket op, eller noget der ser forkert eller mistænkeligt ud. Vær konservativ: flag kun hvis det reelt kræver brugerens opmærksomhed nu - de fleste gennemgange bør ende med flag=false. Hvis en mail reelt kalder på et svar (fx et konkret spørgsmål fra en person), kan du oprette et udkast til svar med draft_reply, FØR du afslutter med flag_review. Opret aldrig et udkast for rutine-mails, nyhedsbreve eller noget der ikke behøver svar. Afslut altid med præcis ét kald til flag_review. Skriv altid på dansk, kort og direkte.",
      messages,
      tools: TOOLS,
    }),
  });
  if (!response.ok) throw new Error(`Claude-overvågning fejlede: ${response.status} ${await response.text()}`);
  return response.json() as Promise<{ content: ContentBlock[] }>;
}

async function runTriageLoop(context: string): Promise<{ result: FlagResult; drafts: DraftedReply[] }> {
  const messages: unknown[] = [{ role: "user", content: context }];
  const drafts: DraftedReply[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callClaude(messages);
    const toolUses = response.content.filter((b) => b.type === "tool_use" && b.name && b.id);

    if (toolUses.length === 0) {
      return { result: { flag: false, message: null }, drafts };
    }

    // A single turn can contain several parallel tool_use blocks (e.g. more than one draft_reply,
    // or a draft_reply alongside flag_review) - every one needs a matching tool_result, or the API
    // rejects the whole request as malformed.
    let finalResult: FlagResult | null = null;
    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        if (toolUse.name === "flag_review") {
          const input = (toolUse.input ?? {}) as Partial<FlagResult>;
          finalResult = { flag: input.flag ?? false, message: input.message ?? null };
          return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: "Registreret." };
        }
        if (toolUse.name === "draft_reply") {
          const input = (toolUse.input ?? {}) as { message_id?: string; body?: string };
          let toolResultText: string;
          if (input.message_id && input.body) {
            try {
              const draftId = await createDraftReply(env.google, input.message_id, input.body);
              drafts.push({ draftId, body: input.body });
              toolResultText = `Udkast oprettet (id: ${draftId}). Nævn i din afsluttende besked at der ligger et udkast klar til godkendelse.`;
            } catch (err) {
              toolResultText = `Kunne ikke oprette udkast: ${(err as Error).message}`;
            }
          } else {
            toolResultText = "Mangler message_id eller body.";
          }
          return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: toolResultText };
        }
        return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: "Ukendt værktøj." };
      }),
    );

    if (finalResult) return { result: finalResult, drafts };

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
  return { result: { flag: false, message: null }, drafts };
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
            emails.map((e) => `- [id:${e.id}] Fra: ${e.from} | Emne: ${e.subject} | ${e.snippet}`).join("\n"),
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

export async function checkRecentActivity(): Promise<{ result: FlagResult; drafts: DraftedReply[] }> {
  if (!env.anthropicApiKey) return { result: { flag: false, message: null }, drafts: [] };

  const context = await gatherRecentSignals();
  if (!context.trim()) return { result: { flag: false, message: null }, drafts: [] };

  return runTriageLoop(context).catch((err) => {
    console.error("Proaktivt tjek fejlede:", err);
    return { result: { flag: false, message: null }, drafts: [] };
  });
}

/** Builds the message text + Telegram inline-keyboard for a triage result. The drafted reply's exact
 *  text is always shown verbatim - never just Claude's paraphrase of it - so a tap on "Send" is an
 *  informed approval, not a blind one. */
export function formatTriageOutcome(result: FlagResult, drafts: DraftedReply[]): { text: string; replyMarkup?: InlineKeyboardMarkup } {
  const lines = [`👀 ${result.message}`];
  for (const [i, d] of drafts.entries()) {
    lines.push("", `📝 Udkast til svar${drafts.length > 1 ? ` ${i + 1}` : ""}:`, `"${d.body}"`);
  }
  const replyMarkup =
    drafts.length > 0
      ? {
          inline_keyboard: drafts.map((d, i) => [
            { text: `✅ Send udkast${drafts.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `send_draft:${d.draftId}` },
            { text: `🗑 Slet udkast${drafts.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `discard_draft:${d.draftId}` },
          ]),
        }
      : undefined;
  return { text: lines.join("\n"), replyMarkup };
}

/** Runs a silent triage pass over recent activity; only messages the owner if something is actually
 *  flagged. Deliberately says nothing when there's nothing to report - a job that pings twice a day
 *  with "all clear" trains the owner to ignore it, which defeats the point. */
export async function runProactiveCheck(): Promise<void> {
  const { result, drafts } = await checkRecentActivity();
  if (!result.flag || !result.message) return;

  const { text, replyMarkup } = formatTriageOutcome(result, drafts);
  await notifyOwner(text, replyMarkup);
}
