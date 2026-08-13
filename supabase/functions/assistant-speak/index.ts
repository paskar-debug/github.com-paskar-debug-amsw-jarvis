import { requireOwner, jsonResponse } from "../_shared/auth.ts";
import { synthesizeSpeech } from "../_shared/tts.ts";

Deno.serve(async (req) => {
  const authError = await requireOwner(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as { text?: string; voice?: string } | null;
  if (!body?.text) return jsonResponse(400, { error: "Mangler 'text'." });

  try {
    const { audio, format } = await synthesizeSpeech(body.text, body.voice);
    return new Response(audio, { status: 200, headers: { "Content-Type": format === "ogg" ? "audio/ogg" : "audio/mpeg" } });
  } catch (err) {
    console.error("assistant-speak fejl:", err);
    return jsonResponse(500, { error: (err as Error).message });
  }
});
