import type { TypedSupabaseClient } from "@amsw/db";

export interface TodoistConfig {
  apiToken: string;
}

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: 1 | 2 | 3 | 4; // Todoist: 4 = highest
  due: { datetime?: string; date?: string } | null;
}

const priorityFromTodoist: Record<TodoistTask["priority"], "p1" | "p2" | "p3" | "p4"> = {
  4: "p1",
  3: "p2",
  2: "p3",
  1: "p4",
};

/** Pulls open tasks from Todoist and upserts them into the tasks table. */
export async function syncTodoist(
  supabase: TypedSupabaseClient,
  ownerId: string,
  config: TodoistConfig,
): Promise<number> {
  const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (!response.ok) {
    throw new Error(`Todoist API fejlede: ${response.status} ${await response.text()}`);
  }
  const tasks = (await response.json()) as TodoistTask[];

  const rows = tasks.map((task) => ({
    owner_id: ownerId,
    title: task.content,
    description: task.description || null,
    status: "todo" as const,
    priority: priorityFromTodoist[task.priority],
    due_at: task.due?.datetime ?? (task.due?.date ? `${task.due.date}T00:00:00Z` : null),
    source: "todoist" as const,
    external_id: task.id,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("tasks")
      .upsert(rows, { onConflict: "owner_id,source,external_id" });
    if (error) throw error;
  }

  await supabase
    .from("integration_sync_state")
    .upsert(
      { owner_id: ownerId, source: "todoist", last_synced_at: new Date().toISOString() },
      { onConflict: "owner_id,source" },
    );

  return rows.length;
}

/** Creates a task directly in Todoist (e.g. from a Telegram command). */
export async function createTodoistTask(config: TodoistConfig, content: string, dueString?: string) {
  const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, due_string: dueString }),
  });
  if (!response.ok) {
    throw new Error(`Todoist API fejlede: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as TodoistTask;
}
