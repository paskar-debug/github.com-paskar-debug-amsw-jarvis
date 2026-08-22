export interface TodoistConfig {
  apiToken: string;
}

interface TodoistTask {
  id: string;
  content: string;
}

export async function createTodoistTask(config: TodoistConfig, content: string): Promise<TodoistTask> {
  const response = await fetch("https://api.todoist.com/api/v1/tasks", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Todoist API fejlede: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as TodoistTask;
}

/** Marks a Todoist task done. Kept in sync with packages/integrations/src/todoist.ts (Node/Deno
 *  can't share a module here - this Edge Function runtime has no access to that npm workspace). */
export async function closeTodoistTask(config: TodoistConfig, todoistTaskId: string): Promise<void> {
  const response = await fetch(`https://api.todoist.com/api/v1/tasks/${todoistTaskId}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (!response.ok) {
    throw new Error(`Todoist API fejlede: ${response.status} ${await response.text()}`);
  }
}

export async function deleteTodoistTask(config: TodoistConfig, todoistTaskId: string): Promise<void> {
  const response = await fetch(`https://api.todoist.com/api/v1/tasks/${todoistTaskId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.apiToken}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Todoist API fejlede: ${response.status} ${await response.text()}`);
  }
}
