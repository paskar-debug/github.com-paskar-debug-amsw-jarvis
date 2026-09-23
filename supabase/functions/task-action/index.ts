// Completing or deleting a task from the dashboard needs to also close/delete it in Todoist when
// that's where it lives - otherwise the next Todoist sync would just pull the still-open task
// back in, silently undoing the checkbox. The dashboard only holds the anon key, and Todoist's
// token is a server-side secret, so this has to be a server round-trip rather than a direct
// Supabase table write from the browser.

import { requireOwner } from "../_shared/auth.ts";
import { OWNER_ID, serviceClient } from "../_shared/db.ts";
import { closeTodoistTask, createTodoistTask, deleteTodoistTask } from "../_shared/todoist.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://paskars-kontor.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const unauthorized = await requireOwner(req);
  if (unauthorized) return json(401, { error: "Unauthorized" });

  const body = (await req.json().catch(() => null)) as
    | { action: "create"; title?: string }
    | { action: "complete" | "delete" | "approve" | "reject"; taskId?: string }
    | null;
  if (!body?.action || !["create", "complete", "delete", "approve", "reject"].includes(body.action)) {
    return json(400, { error: "Ugyldig action." });
  }

  const supabase = serviceClient();
  const apiToken = Deno.env.get("TODOIST_API_TOKEN");

  if (body.action === "create") {
    const title = body.title?.trim();
    if (!title) return json(400, { error: "Mangler titel." });

    if (apiToken) {
      try {
        const todoistTask = await createTodoistTask({ apiToken }, title);
        const { data, error } = await supabase
          .from("tasks")
          .insert({ owner_id: OWNER_ID, title, source: "todoist", external_id: todoistTask.id })
          .select()
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      } catch (err) {
        console.error("Kunne ikke oprette opgave i Todoist, gemmer kun lokalt:", err);
      }
    }

    const { data, error } = await supabase.from("tasks").insert({ owner_id: OWNER_ID, title, source: "manual" }).select().single();
    if (error) return json(500, { error: error.message });
    return json(200, data);
  }

  if (!body.taskId) return json(400, { error: "Mangler taskId." });

  // A task proactively suggested from an email (notice.ts's triage) sits as status 'suggested'
  // until approved here or in Telegram - nothing was ever pushed to Todoist for it yet, so
  // approving needs its own path rather than reusing complete/delete's Todoist-sync logic below.
  if (body.action === "approve" || body.action === "reject") {
    const { data: suggestion, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("id", body.taskId)
      .eq("owner_id", OWNER_ID)
      .eq("status", "suggested")
      .maybeSingle();
    if (fetchError) return json(500, { error: fetchError.message });
    if (!suggestion) return json(404, { error: "Forslaget findes ikke længere." });

    if (body.action === "reject") {
      const { error } = await supabase.from("tasks").delete().eq("id", suggestion.id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    if (apiToken) {
      try {
        const todoistTask = await createTodoistTask({ apiToken }, suggestion.title);
        const { error } = await supabase
          .from("tasks")
          .update({ status: "todo", source: "todoist", external_id: todoistTask.id })
          .eq("id", suggestion.id);
        if (error) return json(500, { error: error.message });
        return json(200, { ok: true });
      } catch (err) {
        console.error("Kunne ikke oprette opgave i Todoist, gemmer kun lokalt:", err);
      }
    }

    const { error } = await supabase.from("tasks").update({ status: "todo" }).eq("id", suggestion.id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, title, source, external_id")
    .eq("id", body.taskId)
    .eq("owner_id", OWNER_ID)
    .maybeSingle();
  if (fetchError) return json(500, { error: fetchError.message });
  if (!task) return json(404, { error: "Opgave ikke fundet." });

  if (task.source === "todoist" && task.external_id && apiToken) {
    try {
      if (body.action === "complete") await closeTodoistTask({ apiToken }, task.external_id);
      else await deleteTodoistTask({ apiToken }, task.external_id);
    } catch (err) {
      console.error("Todoist-kald fejlede, fortsætter kun lokalt:", err);
    }
  }

  if (body.action === "complete") {
    const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", task.id);
    if (error) return json(500, { error: error.message });
  } else {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return json(500, { error: error.message });
  }

  return json(200, { ok: true });
});
