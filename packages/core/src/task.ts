export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "p1" | "p2" | "p3" | "p4";
export type TaskSource = "manual" | "telegram" | "todoist";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string | null;
  source: TaskSource;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewTask {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
  source?: TaskSource;
  externalId?: string | null;
}
