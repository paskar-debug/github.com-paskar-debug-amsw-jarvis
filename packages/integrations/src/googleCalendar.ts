import { google } from "googleapis";
import type { TypedSupabaseClient } from "@amsw/db";

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  calendarId: string;
}

function createOAuthClient(config: GoogleCalendarConfig) {
  const oauth2Client = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });
  return oauth2Client;
}

/** Pulls events from now through `daysAhead` and upserts them into calendar_events. */
export async function syncGoogleCalendar(
  supabase: TypedSupabaseClient,
  ownerId: string,
  config: GoogleCalendarConfig,
  daysAhead = 30,
): Promise<number> {
  const auth = createOAuthClient(config);
  const calendar = google.calendar({ version: "v3", auth });

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await calendar.events.list({
    calendarId: config.calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const events = data.items ?? [];
  const rows = events
    .filter((event) => event.id && (event.start?.dateTime || event.start?.date))
    .map((event) => ({
      owner_id: ownerId,
      title: event.summary ?? "(uden titel)",
      description: event.description ?? null,
      location: event.location ?? null,
      starts_at: event.start?.dateTime ?? `${event.start?.date}T00:00:00Z`,
      ends_at: event.end?.dateTime ?? `${event.end?.date}T00:00:00Z`,
      source: "google" as const,
      external_id: event.id!,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("calendar_events")
    .upsert(rows, { onConflict: "owner_id,source,external_id" });

  if (error) throw error;

  return rows.length;
}

/** Creates a real event on the user's Google Calendar and returns its id.
 *  `allDay`: startsAt/endsAt are "YYYY-MM-DD" dates (endsAt exclusive, per Google's all-day convention). */
export async function createGoogleCalendarEvent(
  config: GoogleCalendarConfig,
  event: { title: string; description?: string | null; startsAt: string; endsAt: string; allDay?: boolean },
): Promise<string> {
  const auth = createOAuthClient(config);
  const calendar = google.calendar({ version: "v3", auth });

  const { data } = await calendar.events.insert({
    calendarId: config.calendarId,
    requestBody: {
      summary: event.title,
      description: event.description ?? undefined,
      start: event.allDay ? { date: event.startsAt } : { dateTime: event.startsAt },
      end: event.allDay ? { date: event.endsAt } : { dateTime: event.endsAt },
    },
  });

  if (!data.id) throw new Error("Google Calendar returnerede ingen event-id.");
  return data.id;
}

/** Deletes an event from the user's Google Calendar. */
export async function deleteGoogleCalendarEvent(config: GoogleCalendarConfig, eventId: string): Promise<void> {
  const auth = createOAuthClient(config);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId: config.calendarId, eventId });
}
