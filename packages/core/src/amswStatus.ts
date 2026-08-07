export type AmswState = "green" | "yellow" | "red";

export interface AmswStatus {
  id: string;
  area: string;
  state: AmswState;
  note: string | null;
  metrics: Record<string, unknown>;
  recordedAt: string;
  createdAt: string;
}

export interface NewAmswStatus {
  area: string;
  state: AmswState;
  note?: string | null;
  metrics?: Record<string, unknown>;
}
