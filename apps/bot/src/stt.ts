export async function transcribeVoice(
  audio: Buffer,
  apiKey: string,
  file: { mimeType: string; filename: string } = { mimeType: "audio/ogg", filename: "voice.ogg" },
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: file.mimeType }), file.filename);
  form.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Whisper transskription fejlede: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { text: string };
  return data.text;
}
