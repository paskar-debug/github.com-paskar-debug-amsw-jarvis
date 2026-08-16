import { searchGmail } from "@amsw/integrations";
import { env } from "./env.js";

const MAX_TOOL_ROUNDS = 4;

const TOOLS = [
  {
    name: "search_email",
    description:
      "Søg i brugerens Gmail med almindelig Gmail-søgesyntaks (fx 'subject:faktura after:2026/07/01 before:2026/08/01', 'from:shopify'). Returnerer afsender/emne/dato/uddrag for de bedste match, ikke hele mailen. Brug det når anmodningen kræver at slå noget op i mailen (fakturaer, kvitteringer, bekræftelser) i stedet for at gætte.",
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

async function callClaude(system: string, messages: unknown[], apiKey: string): Promise<{ content: ContentBlock[] }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  if (!response.ok) {
    throw new Error(`Claude-udkast fejlede: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<{ content: ContentBlock[] }>;
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Generates a written draft/analysis via Claude, with real Gmail search available as a tool when
 *  the request needs to look something up (fakturaer, kvitteringer) rather than write from scratch.
 *  Uses a stronger model than classification since this is the actual deliverable, not just categorization.
 *  `context`: an optional short summary of the user's current tasks/calendar, so the draft can reference their real situation instead of writing blind. */
export async function generateDraft(request: string, apiKey: string, context?: string): Promise<string> {
  const canSearchEmail = Boolean(env.google.clientId && env.google.refreshToken);
  const system = `Du er en skriveassistent for en personlig Telegram-bot. Brugeren beder om et udkast, en analyse, en opsummering, en procedure eller anden research/viden om et emne, leveret med det samme. Skriv grundigt, struktureret og brugbart, på dansk, klar til direkte brug.${canSearchEmail ? " Hvis anmodningen kræver oplysninger fra brugerens mail (fx fakturaer, kvitteringer, bekræftelser), brug search_email i stedet for at gætte eller sige at du ikke har adgang til mailen - det har du." : ""} Hvis anmodningen kræver aktuelle tal, statistikker eller fakta du hverken kan slå op eller er sikker på er korrekte, gør det tydeligt i teksten at de bør verificeres i stedet for at opfinde præcise tal.${context ? `\n\nBrugerens aktuelle situation (brug det kun hvis det er relevant for anmodningen, ignorér ellers): ${context}` : ""}`;

  const messages: unknown[] = [{ role: "user", content: request }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callClaude(system, messages, apiKey);
    const toolUses = response.content.filter((b) => b.type === "tool_use" && b.name && b.id);

    if (toolUses.length === 0) {
      const text = extractText(response.content);
      if (!text) throw new Error("Claude returnerede intet udkast.");
      return text;
    }

    // A single turn can contain several parallel tool_use blocks - every one needs a matching
    // tool_result in the next message, or the API rejects the whole request as malformed.
    const toolResults = await Promise.all(
      toolUses.map(async (toolUse) => {
        let toolResultText: string;
        if (toolUse.name === "search_email" && canSearchEmail) {
          const query = String((toolUse.input as { query?: string } | undefined)?.query ?? "");
          try {
            const results = await searchGmail(env.google, query, 15);
            toolResultText =
              results.length === 0
                ? `Ingen mails fundet for søgningen "${query}".`
                : results.map((r) => `Fra: ${r.from} | Emne: ${r.subject} | Dato: ${r.date}\nUddrag: ${r.snippet}`).join("\n\n");
          } catch (err) {
            toolResultText = `Mail-søgning fejlede: ${(err as Error).message}`;
          }
        } else {
          toolResultText = "Værktøjet er ikke tilgængeligt lige nu.";
        }
        return { type: "tool_result" as const, tool_use_id: toolUse.id as string, content: toolResultText };
      }),
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("Claude brugte for mange værktøjs-kald uden at levere et udkast.");
}
