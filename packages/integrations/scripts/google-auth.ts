// One-off helper: run `npm run google:auth --workspace=@amsw/integrations`,
// approve access in the browser, and paste the printed refresh token into
// GOOGLE_REFRESH_TOKEN in your .env file.
import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:53682/oauth2callback";

if (!clientId || !clientSecret) {
  console.error("Sæt GOOGLE_CLIENT_ID og GOOGLE_CLIENT_SECRET i miljøet før du kører dette script.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
  ],
});

const { port } = new URL(redirectUri);

const server = http.createServer(async (req, res) => {
  if (!req.url) return;
  const url = new URL(req.url, redirectUri);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Mangler code parameter");
    return;
  }
  const { tokens } = await oauth2Client.getToken(code);
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Godkendt! Du kan lukke denne fane og gå tilbage til terminalen.");
  console.log("\nGOOGLE_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
  server.close();
  process.exit(0);
});

server.listen(Number(port), () => {
  console.log("Åbn denne URL i din browser og log ind:\n\n" + authUrl + "\n");
});
