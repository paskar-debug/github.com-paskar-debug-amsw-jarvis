import { google } from "googleapis";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

export interface GmailSearchResult {
  id: string;
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
      return { id: m.id, from: header("From"), subject: header("Subject"), date: header("Date"), snippet: data.snippet ?? "" };
    }),
  );
  return results.filter((r): r is GmailSearchResult => r !== null);
}

/** Creates a Gmail draft replying to `messageId` - never sends anything. Threading headers
 *  (In-Reply-To/References + threadId) are pulled from the original message so the draft lands
 *  correctly in the same conversation. */
export async function createDraftReply(config: GmailConfig, messageId: string, body: string): Promise<string> {
  const auth = createOAuthClient(config);
  const gmail = google.gmail({ version: "v1", auth });

  const { data: original } = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "Subject", "Message-ID"],
  });
  const header = (name: string) => original.payload?.headers?.find((h) => h.name === name)?.value ?? "";
  const to = header("From");
  const originalSubject = header("Subject");
  const messageIdHeader = header("Message-ID");
  const subject = originalSubject.toLowerCase().startsWith("re:") ? originalSubject : `Re: ${originalSubject}`;

  const headerLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    messageIdHeader ? `In-Reply-To: ${messageIdHeader}` : null,
    messageIdHeader ? `References: ${messageIdHeader}` : null,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
  ].filter((l): l is string => l !== null);
  const raw = Buffer.from(`${headerLines.join("\r\n")}\r\n\r\n${body}`).toString("base64url");

  const { data: draft } = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: original.threadId ?? undefined } },
  });
  if (!draft.id) throw new Error("Gmail returnerede intet udkast-id.");
  return draft.id;
}

/** Sends a previously-created draft as-is - whatever currently sits in the Gmail draft, including
 *  any manual edits made directly in Gmail since it was created. */
export async function sendDraft(config: GmailConfig, draftId: string): Promise<void> {
  const auth = createOAuthClient(config);
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.drafts.send({ userId: "me", requestBody: { id: draftId } });
}

export async function discardDraft(config: GmailConfig, draftId: string): Promise<void> {
  const auth = createOAuthClient(config);
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
}
