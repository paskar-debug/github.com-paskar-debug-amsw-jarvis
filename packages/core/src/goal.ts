export type GoalStatus = "active" | "paused" | "done" | "cancelled";

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: GoalStatus;
  progress: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewGoal {
  title: string;
  description?: string | null;
  category?: string | null;
  targetDate?: string | null;
}
