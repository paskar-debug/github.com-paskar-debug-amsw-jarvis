"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Database } from "@amsw/db";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useLiveTable } from "@/lib/useLiveTable";
import { CalendarPanel, DraftsPanel, GoalsPanel, StatusPanel, TasksPanel, WhoopPanel } from "@/components/panels";
import { Clock } from "@/components/Clock";
import { QuotePanel } from "@/components/QuotePanel";
import { NewsPanel } from "@/components/NewsPanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { AssistantWidget } from "@/components/AssistantWidget";
import { IconLogout } from "@/components/icons";

type Tables = Database["public"]["Tables"];

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId === null) router.replace("/login");
  }, [userId, router]);

  const tasksLive = useLiveTable<"tasks", Tables["tasks"]["Row"]>("tasks", userId ?? null, { column: "created_at", ascending: false });
  const eventsLive = useLiveTable<"calendar_events", Tables["calendar_events"]["Row"]>("calendar_events", userId ?? null, { column: "starts_at" });
  const statusesLive = useLiveTable<"amsw_status", Tables["amsw_status"]["Row"]>("amsw_status", userId ?? null, { column: "recorded_at", ascending: false });
  const draftsLive = useLiveTable<"drafts", Tables["drafts"]["Row"]>("drafts", userId ?? null, { column: "created_at" });
  const integrationsLive = useLiveTable<"integration_sync_state", Tables["integration_sync_state"]["Row"]>(
    "integration_sync_state",
    userId ?? null,
    { column: "source" },
  );
  const goalsLive = useLiveTable<"goals", Tables["goals"]["Row"]>("goals", userId ?? null, { column: "target_date" });

  // Routed through /api/tasks/action (not a direct table write) because a task sourced from
  // Todoist needs to be closed/deleted there too - otherwise the next Todoist sync just pulls
  // the still-open task back in, silently undoing the checkbox or the delete.
  async function callTaskAction(taskId: string, action: "complete" | "delete") {
    const { data } = await getSupabaseClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/tasks/action", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, action }),
    });
  }

  async function handleToggleDone(id: string) {
    await callTaskAction(id, "complete");
  }

  async function handleToggleGoalDone(id: string) {
    await getSupabaseClient().from("goals").update({ status: "done", progress: 100 }).eq("id", id);
  }

  async function handleDeleteDraft(id: string) {
    await getSupabaseClient().from("drafts").delete().eq("id", id);
  }

  async function handleDeleteTask(id: string) {
    await callTaskAction(id, "delete");
  }

  async function handleLogout() {
    await getSupabaseClient().auth.signOut();
  }

  if (!userId) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="brand">
          <Image src="/logo-icon.png" alt="Paramasamy" width={84} height={90} priority />
          <span className="brand-text">askar&apos;s kontor</span>
        </div>
        <Clock />
        <div className="page-header-right">
          <span className="live-pill">
            <span className="live-dot" />
            Live
          </span>
          <button type="button" className="logout-button" onClick={handleLogout} aria-label="Log ud">
            <IconLogout />
          </button>
        </div>
      </div>

      <QuotePanel />

      <div className="section section-system">
        <IntegrationsPanel states={integrationsLive.rows} isLoading={integrationsLive.isLoading} flash={integrationsLive.flash} />
      </div>

      <div className="main-column">
        <StatusPanel statuses={statusesLive.rows} isLoading={statusesLive.isLoading} flash={statusesLive.flash} />

        <TasksPanel
          tasks={tasksLive.rows}
          isLoading={tasksLive.isLoading}
          flash={tasksLive.flash}
          onToggleDone={handleToggleDone}
          onDelete={handleDeleteTask}
        />

        <CalendarPanel events={eventsLive.rows} isLoading={eventsLive.isLoading} flash={eventsLive.flash} />

        <GoalsPanel goals={goalsLive.rows} isLoading={goalsLive.isLoading} flash={goalsLive.flash} onToggleDone={handleToggleGoalDone} />

        <WhoopPanel statuses={statusesLive.rows} isLoading={statusesLive.isLoading} flash={statusesLive.flash} />

        <WeatherPanel />

        <NewsPanel source="dr" label="DR Nyheder" />
        <NewsPanel source="tv2" label="TV2 Nyheder" />

        <DraftsPanel drafts={draftsLive.rows} isLoading={draftsLive.isLoading} flash={draftsLive.flash} onDelete={handleDeleteDraft} />
      </div>
      <AssistantWidget />
    </div>
  );
}
