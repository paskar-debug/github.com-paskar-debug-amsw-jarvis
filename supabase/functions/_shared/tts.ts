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
    body: JSON.stringify({
      // gpt-4o-mini-tts kan styres med instruktioner, så den taler dansk med dansk udtale
      // i stedet for tts-1's amerikanske accent.
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions:
        "Du er en varm og nærværende dansk mand midt i 30'erne fra København. Tal naturligt, afslappet og " +
        "venligt, som når man taler med en kollega man holder af – ikke som en oplæser eller en telefonsvarer. " +
        "Brug et roligt tempo med små naturlige pauser, let smil i stemmen og tydelig, ægte dansk udtale med bløde d'er og stød. " +
        "Undgå monoton og robotagtig betoning.",
      // mp3 i stedet for opus: Safari kan ikke afspille Ogg/Opus, og så faldt den tilbage til Mac'ens robotstemme.
      response_format: "mp3",
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI TTS fejlede: ${response.status} ${await response.text()}`);
  }
  return { audio: await response.arrayBuffer(), format: "mp3" };
}

async function synthesizeWithElevenLabs(text: string, voiceId: string): Promise<TtsResult> {
  // Eleven v4: ElevenLabs' mest følelsesfulde model. mp3, så Safari kan afspille den.
  const model = Deno.env.get("ELEVENLABS_MODEL") ?? "eleven_v4";
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY") ?? "",
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: model, language_code: "da" }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS fejlede: ${response.status} ${await response.text()}`);
  }
  return { audio: await response.arrayBuffer(), format: "mp3" };
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
