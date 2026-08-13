interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
}

async function getAccessToken(config: GoogleConfig): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh fejlede: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/** Creates a real event on the user's Google Calendar and returns its id. */
export async function createGoogleCalendarEvent(
  config: GoogleConfig,
  event: { title: string; startsAt: string; endsAt: string },
): Promise<string> {
  const accessToken = await getAccessToken(config);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.title,
        start: { dateTime: event.startsAt },
        end: { dateTime: event.endsAt },
      }),
    },
  );
  if (!res.ok) throw new Error(`Google Calendar oprettelse fejlede: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Google Calendar returnerede ingen event-id.");
  return data.id;
}
