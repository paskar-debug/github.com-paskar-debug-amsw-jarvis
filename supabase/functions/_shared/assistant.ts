import { buildAssistantContext, createCalendarEvent, createTask, saveFact, searchEmail, type FactCategory } from "./tools.ts";
import { loadRecentHistory, saveHistoryTurn } from "./history.ts";

function copenhagenNowDescription(): string {
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(new Date());
}

const TOOLS = [
  {
    name: "create_task",
    description: "Opret en opgave for brugeren.",
    input_schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "create_event",
    description: "Opret en ny kalenderaftale med et konkret tidspunkt.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        starts_at: { type: "string", description: "ISO 8601 med tidszone-offset, fx 2026-08-14T14:00:00+02:00" },
        ends_at: { type: "string", description: "ISO 8601 med tidszone-offset" },
      },
      required: ["title", "starts_at", "ends_at"],
    },
  },
  {
    name: "save_fact",
    description: "Gem et varigt fakta om brugeren (navne, relationer, forretningsinfo, præferencer for hvordan du skal opføre dig).",
    input_schema: {
      type: "object",
      properties: {
        fact: { type: "string" },
        category: { type: "string", enum: ["familie", "forretning", "praeference", "andet"] },
      },
      required: ["fact", "category"],
    },
  },
  {
    name: "search_email",
    description: "Søg i brugerens Gmail efter relevante mails. Brug almindelig Gmail-søgesyntaks (fx 'from:shopify', 'faktura', 'subject:ordre'). Returnerer afsender/emne/dato/uddrag for de bedste match, ikke hele mailen.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
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

async function callClaude(system: string, messages: unknown[]): Promise<{ content: ContentBlock[]; stop_reason: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude-assistent fejlede: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<{ content: ContentBlock[]; stop_reason: string }>;
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "create_task") {
    return createTask(String(input.title));
  }
  if (name === "create_event") {
    return createCalendarEvent(String(input.title), String(input.starts_at), String(input.ends_at));
  }
  if (name === "save_fact") {
    return saveFact(String(input.fact), (input.category as FactCategory) ?? "andet");
  }
  if (name === "search_email") {
    return searchEmail(String(input.query));
  }
  return "Ukendt værktøj.";
}

export function extractText(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
}

const MAX_TOOL_ROUNDS = 4;

/** Conversational assistant for the dashboard chat widget: answers questions directly using live
 *  context, and can take action (create_task/create_event/save_fact/search_email) via tool-use -
 *  possibly several tools across several rounds (e.g. search_email then create_task from a result). */
export async function answerAssistantMessage(message: string): Promise<string> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) throw new Error("ANTHROPIC_API_KEY mangler.");

  const context = await buildAssistantContext().catch(() => "");
  const system = `Du er en personlig assistent for brugeren, tilgængelig via deres dashboard-chat. Svar hjælpsomt, kortfattet og direkte på spørgsmål ved hjælp af den kontekst du får nedenfor - gæt aldrig på tal du kan slå op i konteksten eller finde via søg_email. Du kan også handle for brugeren ved at bruge et af de tilgængelige værktøjer (opret opgave, opret kalenderaftale, gem et fakta, søg i mail), hvis beskeden beder om det. Svar altid på dansk, i almindelig prosa uden overskrifter/markdown, som i en samtale.

Nu er det: ${copenhagenNowDescription()} (tidszone Europe/Copenhagen).

Kontekst om brugeren: ${context || "Ingen kontekst tilgængelig endnu."}`;

  const history = await loadRecentHistory().catch(() => []);
  const messages: unknown[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: message }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callClaude(system, messages);
    const toolUses = response.content.filter((b) => b.type === "tool_use" && b.name && b.id);

    if (toolUses.length === 0) {
      const text = extractText(response.content) || "Jeg er ikke sikker på hvordan jeg skal svare på det.";
      await Promise.all([saveHistoryTurn("user", message), saveHistoryTurn("assistant", text)]);
      return text;
    }

    // A single turn can contain several parallel tool_use blocks - every one needs a matching
    // tool_result in the next message, or the API rejects the whole request as malformed.
    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        const result = await executeTool(toolUse.name!, toolUse.input ?? {}).catch((err) => `Fejl: ${(err as Error).message}`);
        return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: result };
      }),
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    if (round === MAX_TOOL_ROUNDS - 1) {
      const fallback = toolResults.map((r) => r.content).join("\n");
      await Promise.all([saveHistoryTurn("user", message), saveHistoryTurn("assistant", fallback)]);
      return fallback;
    }
  }

  throw new Error("Uventet: værktøjs-løkken sluttede uden svar.");
}
