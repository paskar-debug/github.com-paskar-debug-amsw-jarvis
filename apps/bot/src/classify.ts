export type FactCategory = "familie" | "forretning" | "praeference" | "andet";

export type ClassifyResult =
  | { kind: "task"; title: string }
  | { kind: "event"; title: string; startsAt: string; endsAt: string }
  | { kind: "delete_event"; query: string }
  | { kind: "delete_task"; query: string }
  | { kind: "draft" }
  | { kind: "question" }
  | { kind: "fact"; fact: string; category: FactCategory }
  | { kind: "goal"; title: string; category: string | null };

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
  description:
    "Klassificerer en besked som en opgave, en ny kalenderaftale, en anmodning om at slette en aftale, en anmodning om at få udarbejdet et udkast/analyse, et fakta om brugeren der skal huskes, eller et strategisk mål for AMSW.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["task", "event", "delete_event", "delete_task", "draft", "question", "fact", "goal"] },
      title: { type: "string" },
      starts_at: { type: ["string", "null"] },
      ends_at: { type: ["string", "null"] },
      category: { type: ["string", "null"], enum: ["familie", "forretning", "praeference", "andet", null] },
      goal_category: { type: ["string", "null"] },
    },
    required: ["kind", "title", "starts_at", "ends_at", "category", "goal_category"],
  },
};

interface RawClassification {
  kind: "task" | "event" | "delete_event" | "delete_task" | "draft" | "question" | "fact" | "goal";
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  category: FactCategory | null;
  goal_category: string | null;
}

/** Pure mapping from Claude's raw tool-call shape to our result type - the actual branching logic worth testing directly. */
export function toClassifyResult(parsed: RawClassification): ClassifyResult {
  if (parsed.kind === "event" && parsed.starts_at && parsed.ends_at) {
    return { kind: "event", title: parsed.title, startsAt: parsed.starts_at, endsAt: parsed.ends_at };
  }
  if (parsed.kind === "delete_event") {
    return { kind: "delete_event", query: parsed.title };
  }
  if (parsed.kind === "delete_task") {
    return { kind: "delete_task", query: parsed.title };
  }
  if (parsed.kind === "draft") {
    return { kind: "draft" };
  }
  if (parsed.kind === "question") {
    return { kind: "question" };
  }
  if (parsed.kind === "fact") {
    return { kind: "fact", fact: parsed.title, category: parsed.category ?? "andet" };
  }
  if (parsed.kind === "goal") {
    return { kind: "goal", title: parsed.title, category: parsed.goal_category };
  }
  return { kind: "task", title: parsed.title };
}

/** Classifies a message as a task, a new calendar event, a delete request, a request to actually write/research something, or a fact to remember about the user. */
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
- OPGAVE (task): noget der skal gøres af brugeren selv senere, uden fast tidspunkt. Kort huskeseddel-agtig ting.
- KALENDERAFTALE (event): en ny aftale med en konkret dato og/eller klokkeslæt, fx et møde.
- SLET AFTALE (delete_event): en anmodning om at slette, aflyse eller annullere en EKSISTERENDE kalenderaftale (fx "aflys mødet med Lars", "slet tandlægeaftalen").
- SLET OPGAVE (delete_task): en anmodning om at slette eller fjerne en EKSISTERENDE opgave/huskeseddel (fx "slet opgaven om at ringe til Thomas", "fjern indkøbsopgaven"). Forveksl ikke med at markere en opgave som færdig - det gøres i dashboardet, ikke via besked.
- UDKAST (draft): en anmodning om at FÅ UDARBEJDET en konkret tekst der skal BRUGES eller GENBRUGES et andet sted — en mail, et opslag, en analyse, en rapport, en procedure. Kendetegn: resultatet er en selvstændig tekst brugeren vil kopiere, sende eller gemme, ikke et svar der bare skal læses i chatten. Ofte "skriv...", "lav et udkast til...", "opsummer...".
- SPØRGSMÅL (question): brugeren spørger om noget og vil bare have et svar her i chatten — en forklaring, en vurdering, "hvorfor...", "hvordan...", "hvad er status på...", "kan du tjekke...". Kendetegn: intet dokument skal produceres, det er en samtale. Dette er default hvis brugeren stiller et direkte spørgsmål uden at bede om at få noget skrevet/udarbejdet.
- FAKTA (fact): en varig oplysning OM brugeren selv, der ikke er en handling og ikke udløber — fx navne på familie ("min kone hedder Maria"), forretningsinfo ("AMSW blev startet i 2007"), eller en præference for hvordan assistenten skal opføre sig ("giv altid korte svar", "jeg foretrækker dansk"). Kendetegn: ingen handling skal udføres, det er noget der skal huskes fremover og bruges som kontekst senere. Forveksl ikke med en opgave — "husk at ringe til Thomas i morgen" er en OPGAVE (en handling), ikke et fakta.
- MÅL (goal): et strategisk mål eller en vision for AMSW's fremtid — salg, økonomi, eller udvidelse til udlandet, fx "mål: fordoble omsætningen i 2027" eller "vi skal åbne i Tyskland næste år". Kendetegn: en langsigtet ambition der skal spores med fremgang over tid, ikke en enkeltstående handling. Sætninger der starter med "mål" eller "vision" er næsten altid denne kategori.

Nu er det: ${copenhagenNowDescription()} (tidszone Europe/Copenhagen).

For event: udled starts_at og ends_at som ISO 8601-tidsstempler med tidszone-offset (fx 2026-08-10T14:00:00+02:00), ud fra relative udtryk som "i morgen", "fredag kl 14", "om en time". Er der ikke angivet en varighed, sæt ends_at til én time efter starts_at.
For task, delete_event, delete_task, draft, question, fact og goal: sæt starts_at og ends_at til null.
title er en kort, ren version af indholdet (uden dato/tid) for task/event. For delete_event og delete_task er title en søgetekst der beskriver hvilken aftale/opgave der skal findes — genbrug ordene fra beskeden ordret, stav dem ikke om. For draft og question er title ligegyldig (sæt til tom streng), da hele originalbeskeden bruges direkte. For fact er title selve faktumet, kort og præcist omskrevet i tredje person hvis naturligt. For goal er title en kort, ren version af selve målet (uden ordet "mål:" foran).
category bruges kun for fact: "familie" (familie/relationer), "forretning" (AMSW/forretning), "praeference" (hvordan assistenten skal opføre sig), eller "andet". Sæt category til null for alle andre kinds.
goal_category bruges kun for goal: kort kategori-navn udledt af indholdet, fx "Salg", "Økonomi" eller "Udland". Sæt goal_category til null hvis det ikke er tydeligt, og til null for alle andre kinds.`,
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
  return toClassifyResult(toolUse.input);
}
