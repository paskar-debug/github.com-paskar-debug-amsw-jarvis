import { requireOwner, jsonResponse } from "../_shared/auth.ts";
import { transcribeVoice } from "../_shared/stt.ts";

Deno.serve(async (req) => {
  const authError = await requireOwner(req);
  if (authError) return authError;

  if (!Deno.env.get("OPENAI_API_KEY")) return jsonResponse(400, { error: "OPENAI_API_KEY mangler." });

  // Safari optager som audio/mp4, Chrome som audio/webm. Filendelsen skal passe til formatet,
  // ellers afviser OpenAI filen som "corrupted or unsupported".
  const rawType = req.headers.get("content-type") ?? "audio/webm";
  const contentType = rawType.split(";")[0].trim();
  const ext = contentType.includes("ogg")
    ? "ogg"
    : contentType.includes("wav")
      ? "wav"
      : contentType.includes("mp4") || contentType.includes("m4a") || contentType.includes("aac")
        ? "mp4"
        : contentType.includes("mpeg") || contentType.includes("mp3")
          ? "mp3"
          : "webm";
  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.byteLength < 2000) {
    return jsonResponse(400, { error: "Optagelsen var for kort. Tryk på kuglen, tal, og tryk igen når du er færdig." });
  }

  try {
    const text = await transcribeVoice(audio, contentType, `voice.${ext}`);
    return jsonResponse(200, { text });
  } catch (err) {
    console.error("assistant-transcribe fejl:", err);
    return jsonResponse(500, { error: (err as Error).message });
  }
});
