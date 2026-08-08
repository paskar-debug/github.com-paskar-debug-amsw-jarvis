export type ClassifyResult =
  | { kind: "task"; title: string }
  | { kind: "event"; title: string; startsAt: string; endsAt: string }
  | { kind: "delete_event"; query: string };

function copenhagenNowDescription(): string {
  const formatter = new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  });
  return formatter.format(new Date());
}

const TOOL_SCHEMA = {
  name: "classify",
  description: "Klassificerer en besked som en opgave, en ny kalenderaftale, eller en anmodning om at slette/aflyse en eksisterende aftale.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["task", "event", "delete_event"] },
      title: { type: "string" },
      starts_at: { type: ["string", "null"] },
      ends_at: { type: ["string", "null"] },
    },
    required: ["kind", "title", "starts_at", "ends_at"],
  },
};

interface RawClassification {
  kind: "task" | "event" | "delete_event";
  title: string;
  starts_at: string | null;
  ends_at: string | null;
}

/** Classifies a message as a task, a new calendar event, or a request to delete an existing one. */
export async function classifyMessage(text: string, apiKey: string): Promise<ClassifyResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `Du klassificerer beskeder til en personlig assistent som én af:
- OPGAVE (task): noget der skal gøres, uden fast tidspunkt.
- KALENDERAFTALE (event): en ny aftale med en konkret dato og/eller klokkeslæt, fx et møde.
- SLET AFTALE (delete_event): en anmodning om at slette, aflyse eller annullere en EKSISTERENDE aftale (fx "aflys mødet med Lars", "slet tandlægeaftalen").

Nu er det: ${copenhagenNowDescription()} (tidszone Europe/Copenhagen).

For event: udled starts_at og ends_at som ISO 8601-tidsstempler med tidszone-offset (fx 2026-08-10T14:00:00+02:00), ud fra relative udtryk som "i morgen", "fredag kl 14", "om en time". Er der ikke angivet en varighed, sæt ends_at til én time efter starts_at.
For task og delete_event: sæt starts_at og ends_at til null.
title er en kort, ren version af indholdet (uden dato/tid) for task/event. For delete_event er title en søgetekst der beskriver hvilken aftale der skal findes (fx "møde med Lars" eller "tandlæge") — genbrug ordene fra beskeden ordret, stav dem ikke om.`,
      messages: [{ role: "user", content: text }],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "classify" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude-klassificering fejlede: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; input?: RawClassification }>;
  };
  const toolUse = data.content.find((block) => block.type === "tool_use");
  if (!toolUse?.input) throw new Error("Claude returnerede intet klassificerings-resultat.");
  const parsed = toolUse.input;

  if (parsed.kind === "event" && parsed.starts_at && parsed.ends_at) {
    return { kind: "event", title: parsed.title, startsAt: parsed.starts_at, endsAt: parsed.ends_at };
  }
  if (parsed.kind === "delete_event") {
    return { kind: "delete_event", query: parsed.title };
  }
  return { kind: "task", title: parsed.title };
}
