/** Generates a written draft/analysis via Claude. Uses a stronger model than classification since this is the actual deliverable, not just categorization. */
export async function generateDraft(request: string, apiKey: string): Promise<string> {
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
      system: `Du er en skriveassistent for en personlig Telegram-bot. Brugeren beder om et udkast, en analyse, en opsummering, en procedure eller anden research/viden om et emne, leveret med det samme. Skriv grundigt, struktureret og brugbart, på dansk, klar til direkte brug. Hvis anmodningen kræver aktuelle tal, statistikker eller fakta du ikke er sikker på er korrekte eller opdaterede, gør det tydeligt i teksten at de bør verificeres i stedet for at opfinde præcise tal.`,
      messages: [{ role: "user", content: request }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude-udkast fejlede: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const text = data.content.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returnerede intet udkast.");
  return text;
}
