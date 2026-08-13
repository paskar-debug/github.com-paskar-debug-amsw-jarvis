export interface TtsResult {
  audio: ArrayBuffer;
  format: "ogg" | "mp3";
}

async function synthesizeWithOpenAi(text: string, voice: string): Promise<TtsResult> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "opus" }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI TTS fejlede: ${response.status} ${await response.text()}`);
  }
  return { audio: await response.arrayBuffer(), format: "ogg" };
}

async function synthesizeWithElevenLabs(text: string, voiceId: string): Promise<TtsResult> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=opus_48000_64`, {
    method: "POST",
    headers: {
      "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY") ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS fejlede: ${response.status} ${await response.text()}`);
  }
  return { audio: await response.arrayBuffer(), format: "ogg" };
}

/** `voiceOverride` lets the caller pick a specific OpenAI voice per-request (ignored for ElevenLabs,
 *  which is keyed by voice id, not name). */
export async function synthesizeSpeech(text: string, voiceOverride?: string): Promise<TtsResult> {
  const provider = Deno.env.get("TTS_PROVIDER") ?? "openai";
  if (provider === "elevenlabs") {
    return synthesizeWithElevenLabs(text, Deno.env.get("ELEVENLABS_VOICE_ID") ?? "");
  }
  return synthesizeWithOpenAi(text, voiceOverride || Deno.env.get("OPENAI_TTS_VOICE") || "alloy");
}
