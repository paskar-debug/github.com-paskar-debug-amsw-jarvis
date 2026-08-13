import { google } from "googleapis";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

export interface GmailSearchResult {
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

function createOAuthClient(config: GmailConfig) {
  const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });
  return oauth2Client;
}

/** Searches Gmail with standard Gmail search syntax and returns headers + snippet per match -
 *  not full message bodies, since that's enough for triage/summary use without over-reading. */
export async function searchGmail(config: GmailConfig, query: string, maxResults = 20): Promise<GmailSearchResult[]> {
  const auth = createOAuthClient(config);
  const gmail = google.gmail({ version: "v1", auth });

  const { data: list } = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const messages = list.messages ?? [];

  const results = await Promise.all(
    messages.map(async (m) => {
      if (!m.id) return null;
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id: m.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const header = (name: string) => data.payload?.headers?.find((h) => h.name === name)?.value ?? "(ukendt)";
      return { from: header("From"), subject: header("Subject"), date: header("Date"), snippet: data.snippet ?? "" };
    }),
  );
  return results.filter((r): r is GmailSearchResult => r !== null);
}
