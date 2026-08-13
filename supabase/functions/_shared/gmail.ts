import { getAccessToken, googleConfigFromEnv } from "./google.ts";

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "(ukendt)";
}

/** Searches Gmail with the given query (standard Gmail search syntax, e.g. "from:shopify nyeste ordre")
 *  and returns a short plain-text summary of the top matches (subject/from/date/snippet) for Claude to
 *  read - not the full message bodies, to keep this fast and avoid pulling private content unnecessarily. */
export async function searchGmail(query: string, maxResults = 5): Promise<string> {
  const config = googleConfigFromEnv();
  if (!config.clientId || !config.refreshToken) {
    return "Mail-søgning er ikke sat op endnu.";
  }
  const accessToken = await getAccessToken(config);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) throw new Error(`Gmail-søgning fejlede: ${listRes.status} ${await listRes.text()}`);
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  if (!list.messages || list.messages.length === 0) {
    return `Ingen mails fundet for søgningen "${query}".`;
  }

  const messages = await Promise.all(
    list.messages.map(async (m) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      return (await res.json()) as GmailMessage;
    }),
  );

  const lines = messages
    .filter((m): m is GmailMessage => m !== null)
    .map((m) => `Fra: ${header(m, "From")} | Emne: ${header(m, "Subject")} | Dato: ${header(m, "Date")}\nUddrag: ${m.snippet ?? ""}`);

  return lines.join("\n\n");
}
