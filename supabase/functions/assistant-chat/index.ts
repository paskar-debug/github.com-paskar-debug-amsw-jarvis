import { requireOwner, jsonResponse } from "../_shared/auth.ts";
import { answerAssistantMessage } from "../_shared/assistant.ts";

Deno.serve(async (req) => {
  const authError = await requireOwner(req);
  if (authError) return authError;

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  if (!body?.message) return jsonResponse(400, { error: "Mangler 'message'." });

  try {
    const reply = await answerAssistantMessage(body.message);
    return jsonResponse(200, { reply });
  } catch (err) {
    console.error("assistant-chat fejl:", err);
    return jsonResponse(500, { error: (err as Error).message });
  }
});
