export interface TtsResult {
  audio: Buffer;
  /** "ogg" plays as a native Telegram voice bubble (sendVoice), "mp3" falls back to sendAudio. */
  format: "ogg" | "mp3";
}

export interface OpenAiTtsConfig {
  provider: "openai";
  apiKey: string;
  voice: string;
}

export interface ElevenLabsTtsConfig {
  provider: "elevenlabs";
  apiKey: string;
  voiceId: string;
}

export type TtsConfig = OpenAiTtsConfig | ElevenLabsTtsConfig;

async function synthesizeWithOpenAi(text: string, config: OpenAiTtsConfig): Promise<TtsResult> {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    // "opus" from OpenAI TTS is an Ogg/Opus stream, which is exactly what
    // Telegram's sendVoice expects for a native voice-message bubble.
    body: JSON.stringify({ model: "tts-1", voice: config.voice, input: text, response_format: "opus" }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI TTS fejlede: ${response.status} ${await response.text()}`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, format: "ogg" };
}

async function synthesizeWithElevenLabs(text: string, config: ElevenLabsTtsConfig): Promise<TtsResult> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}?output_format=opus_48000_64`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS fejlede: ${response.status} ${await response.text()}`);
  }
  const audio = Buffer.from(await response.arrayBuffer());
  return { audio, format: "ogg" };
}

export async function synthesizeSpeech(text: string, config: TtsConfig): Promise<TtsResult> {
  if (config.provider === "elevenlabs") {
    return synthesizeWithElevenLabs(text, config);
  }
  return synthesizeWithOpenAi(text, config);
}
