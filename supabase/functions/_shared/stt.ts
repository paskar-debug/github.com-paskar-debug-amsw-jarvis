export async function transcribeVoice(audio: Uint8Array, mimeType: string, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimeType }), filename);
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Whisper transskription fejlede: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}
