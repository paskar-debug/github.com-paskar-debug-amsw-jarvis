import { requireOwner, jsonResponse } from "../_shared/auth.ts";
import { transcribeVoice } from "../_shared/stt.ts";

Deno.serve(async (req) => {
  const authError = await requireOwner(req);
  if (authError) return authError;

  if (!Deno.env.get("OPENAI_API_KEY")) return jsonResponse(400, { error: "OPENAI_API_KEY mangler." });

  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("wav") ? "wav" : "webm";
  const audio = new Uint8Array(await req.arrayBuffer());

  try {
    const text = await transcribeVoice(audio, contentType, `voice.${ext}`);
    return jsonResponse(200, { text });
  } catch (err) {
    console.error("assistant-transcribe fejl:", err);
    return jsonResponse(500, { error: (err as Error).message });
  }
});
