import http from "node:http";
import { env } from "./env.js";
import { handleFreeformMessage } from "./handlers.js";
import { transcribeVoice } from "./stt.js";
import { synthesizeSpeech } from "./tts.js";
import { ttsConfig } from "./ttsConfig.js";

// Lets the dashboard talk to the same assistant brain the Telegram bot uses,
// instead of duplicating Anthropic/OpenAI/Google credentials on Vercel. The
// dashboard never calls this directly from the browser - it proxies through
// a Next.js API route that holds ASSISTANT_API_KEY server-side.

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: http.IncomingMessage): boolean {
  return req.headers.authorization === `Bearer ${env.assistantApiKey}`;
}

export function startAssistantServer(): void {
  if (!env.assistantApiKey) {
    console.log("ASSISTANT_API_KEY er ikke sat - dashboard-assistenten er deaktiveret.");
    return;
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (!isAuthorized(req)) return sendJson(res, 401, { error: "Unauthorized" });

      if (req.method === "POST" && req.url === "/assistant/chat") {
        const body = JSON.parse((await readBody(req)).toString("utf8")) as { message?: string };
        if (!body.message) return sendJson(res, 400, { error: "Mangler 'message'." });
        const reply = await handleFreeformMessage(body.message);
        return sendJson(res, 200, { reply });
      }

      if (req.method === "POST" && req.url === "/assistant/transcribe") {
        if (!env.openaiApiKey) return sendJson(res, 400, { error: "OPENAI_API_KEY mangler." });
        const audio = await readBody(req);
        const contentType = req.headers["content-type"] ?? "audio/webm";
        const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("wav") ? "wav" : "webm";
        const text = await transcribeVoice(audio, env.openaiApiKey, { mimeType: contentType, filename: `voice.${ext}` });
        return sendJson(res, 200, { text });
      }

      if (req.method === "POST" && req.url === "/assistant/speak") {
        const body = JSON.parse((await readBody(req)).toString("utf8")) as { text?: string };
        if (!body.text) return sendJson(res, 400, { error: "Mangler 'text'." });
        const { audio, format } = await synthesizeSpeech(body.text, ttsConfig);
        res.writeHead(200, { "Content-Type": format === "ogg" ? "audio/ogg" : "audio/mpeg" });
        res.end(audio);
        return;
      }

      return sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      console.error("Assistant-server fejl:", err);
      return sendJson(res, 500, { error: (err as Error).message });
    }
  });

  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, () => console.log(`Assistent-server kører på port ${port}.`));
}
