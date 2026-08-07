export interface WellbeingEntry {
  id: string;
  mood: number;
  energy: number;
  sleepHours: number | null;
  note: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface NewWellbeingEntry {
  mood: number;
  energy: number;
  sleepHours?: number | null;
  note?: string | null;
  recordedAt?: string;
}
