import { env } from "./env.js";
import type { TtsConfig } from "./tts.js";

export const ttsConfig: TtsConfig =
  env.ttsProvider === "elevenlabs"
    ? { provider: "elevenlabs", apiKey: env.elevenLabsApiKey, voiceId: env.elevenLabsVoiceId }
    : { provider: "openai", apiKey: env.openaiApiKey, voice: env.openaiTtsVoice };
