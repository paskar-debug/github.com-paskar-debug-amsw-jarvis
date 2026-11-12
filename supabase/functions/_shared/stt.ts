export async function transcribeVoice(audio: Uint8Array, mimeType: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), filename);
  form.append("model", "gpt-4o-mini-transcribe");
  // Fast dansk: uden sprog-hint gætter Whisper nogle gange forkert sprog på korte beskeder.
  form.append("language", "da");
  // Hjælper genkendelsen med navne og fagord, Paskar typisk siger.
  form.append("prompt", "Paskar taler dansk til sin assistent Palma om AMSW, Shopify, ordrer, salg, Whoop, Todoist, kalender, Engvang og Dinero.");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Transskription fejlede: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}
