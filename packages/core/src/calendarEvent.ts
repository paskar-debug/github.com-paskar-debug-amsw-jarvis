export type CalendarSource = "manual" | "google";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  source: CalendarSource;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}
