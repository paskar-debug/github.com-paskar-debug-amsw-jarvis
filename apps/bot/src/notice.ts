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

export interface SuggestedTask {
  taskId: string;
  title: string;
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
    name: "suggest_task",
    description:
      "Foreslå en opgave ud fra en mail der beskriver et konkret stykke arbejde (fx en kunde beder om noget, en leverandør skal følges op). Opretter IKKE opgaven - kræver brugerens godkendelse bagefter.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Kort, handlingsorienteret opgavetitel." },
        description: { type: "string", description: "Ekstra kontekst fra mailen, valgfrit." },
      },
      required: ["title"],
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
      max_tokens: 2048,
      // Extended thinking is on by default for this model and draws from the same max_tokens
      // budget - for a mechanical triage/tool-calling task like this, that risks burning the
      // whole budget on thinking with stop_reason "max_tokens" and zero actual output. Disabled
      // rather than just raising the budget, since a bigger number only narrows the window.
      thinking: { type: "disabled" },
      system: [
        "Du gennemgår brugerens seneste aktivitet for AMSW (mails, status, fejl) for at afgøre om der er noget brugeren bør se nu. Der er to helt ligeværdige grunde til at flagge:",
        "1. Noget er GALT eller uventet - fx sikkerhedsadvarsler, fejl, uventede konto-/betalingsændringer.",
        "2. En mail kræver en konkret handling fra brugeren - nogen beder om noget (informationer, en godkendelse, et møde-tidspunkt), venter på svar, eller der er et stykke arbejde der tydeligt skal udføres. Dette er lige så vigtigt at flagge som punkt 1, og er den langt hyppigste grund til at flagge - lad ikke ordet 'GALT' narre dig til kun at reagere på fejl.",
        "For punkt 2: brug draft_reply hvis mailen kalder på et svar, og/eller suggest_task hvis der er et konkret stykke arbejde at udføre (de kan begge bruges på samme mail). Ignorer kun: nyhedsbreve, marketing, kvitteringer/fakturaer og pakke-tracking uden handling krævet, rutine-notifikationer (logins, engangskoder), og mails der reelt ikke beder om noget fra brugeren.",
        "Brug de relevante værktøjer FØR du afslutter, og sæt flag=true når du har brugt draft_reply og/eller suggest_task, så brugeren rent faktisk ser det. Bedre at flagge 2-3 reelle ting fra én gennemgang end at overse dem af forsigtighed - men opret aldrig udkast/opgaveforslag for mails der ikke reelt beder om noget.",
        "Afslut altid med præcis ét kald til flag_review. Skriv altid på dansk, kort og direkte.",
      ].join(" "),
      messages,
      tools: TOOLS,
    }),
  });
  if (!response.ok) throw new Error(`Claude-overvågning fejlede: ${response.status} ${await response.text()}`);
  return response.json() as Promise<{ content: ContentBlock[] }>;
}

async function runTriageLoop(context: string): Promise<{ result: FlagResult; drafts: DraftedReply[]; suggestions: SuggestedTask[] }> {
  const messages: unknown[] = [{ role: "user", content: context }];
  const drafts: DraftedReply[] = [];
  const suggestions: SuggestedTask[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callClaude(messages);
    const toolUses = response.content.filter((b) => b.type === "tool_use" && b.name && b.id);

    if (toolUses.length === 0) {
      return { result: { flag: false, message: null }, drafts, suggestions };
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
        if (toolUse.name === "suggest_task") {
          const input = (toolUse.input ?? {}) as { title?: string; description?: string };
          let toolResultText: string;
          if (input.title) {
            try {
              const { data, error } = await supabase
                .from("tasks")
                .insert({
                  owner_id: env.ownerId,
                  title: input.title,
                  description: input.description,
                  source: "email",
                  status: "suggested",
                  origin: "email_triage",
                })
                .select("id")
                .single();
              if (error) throw error;
              suggestions.push({ taskId: data.id as string, title: input.title });
              toolResultText = `Opgaveforslag oprettet (id: ${data.id}). Nævn i din afsluttende besked at der ligger et opgaveforslag klar til godkendelse.`;
            } catch (err) {
              toolResultText = `Kunne ikke oprette opgaveforslag: ${(err as Error).message}`;
            }
          } else {
            toolResultText = "Mangler title.";
          }
          return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: toolResultText };
        }
        return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: "Ukendt værktøj." };
      }),
    );

    if (finalResult) return { result: finalResult, drafts, suggestions };

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
  return { result: { flag: false, message: null }, drafts, suggestions };
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

export async function checkRecentActivity(): Promise<{ result: FlagResult; drafts: DraftedReply[]; suggestions: SuggestedTask[] }> {
  if (!env.anthropicApiKey) return { result: { flag: false, message: null }, drafts: [], suggestions: [] };

  const context = await gatherRecentSignals();
  if (!context.trim()) return { result: { flag: false, message: null }, drafts: [], suggestions: [] };

  return runTriageLoop(context).catch((err) => {
    console.error("Proaktivt tjek fejlede:", err);
    return { result: { flag: false, message: null }, drafts: [], suggestions: [] };
  });
}

/** Builds the message text + Telegram inline-keyboard for a triage result. The drafted reply's exact
 *  text is always shown verbatim - never just Claude's paraphrase of it - so a tap on "Send" is an
 *  informed approval, not a blind one. Same principle for a suggested task's title. */
export function formatTriageOutcome(
  result: FlagResult,
  drafts: DraftedReply[],
  suggestions: SuggestedTask[] = [],
): { text: string; replyMarkup?: InlineKeyboardMarkup } {
  const lines = [`👀 ${result.message}`];
  for (const [i, d] of drafts.entries()) {
    lines.push("", `📝 Udkast til svar${drafts.length > 1 ? ` ${i + 1}` : ""}:`, `"${d.body}"`);
  }
  for (const [i, s] of suggestions.entries()) {
    lines.push("", `✅ Forslag til opgave${suggestions.length > 1 ? ` ${i + 1}` : ""}: "${s.title}"`);
  }
  const draftButtons = drafts.map((d, i) => [
    { text: `✅ Send udkast${drafts.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `send_draft:${d.draftId}` },
    { text: `🗑 Slet udkast${drafts.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `discard_draft:${d.draftId}` },
  ]);
  const suggestionButtons = suggestions.map((s, i) => [
    { text: `✅ Opret opgave${suggestions.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `approve_task:${s.taskId}` },
    { text: `❌ Afvis${suggestions.length > 1 ? ` ${i + 1}` : ""}`, callback_data: `reject_task:${s.taskId}` },
  ]);
  const allButtons = [...draftButtons, ...suggestionButtons];
  const replyMarkup = allButtons.length > 0 ? { inline_keyboard: allButtons } : undefined;
  return { text: lines.join("\n"), replyMarkup };
}

/** Runs a silent triage pass over recent activity; only messages the owner if something is actually
 *  flagged. Deliberately says nothing when there's nothing to report - a job that pings twice a day
 *  with "all clear" trains the owner to ignore it, which defeats the point. */
export async function runProactiveCheck(): Promise<void> {
  const { result, drafts, suggestions } = await checkRecentActivity();
  if (!result.flag || !result.message) return;

  const { text, replyMarkup } = formatTriageOutcome(result, drafts, suggestions);
  await notifyOwner(text, replyMarkup);
}
