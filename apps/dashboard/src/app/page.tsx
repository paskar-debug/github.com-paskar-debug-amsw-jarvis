"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Database } from "@amsw/db";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useLiveTable } from "@/lib/useLiveTable";
import { CalendarPanel, DraftsPanel, StatusPanel, TasksPanel, WhoopPanel } from "@/components/panels";
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

  async function handleToggleDone(id: string, done: boolean) {
    await getSupabaseClient()
      .from("tasks")
      .update({ status: done ? "done" : "todo" })
      .eq("id", id);
  }

  async function handleDeleteDraft(id: string) {
    await getSupabaseClient().from("drafts").delete().eq("id", id);
  }

  async function handleDeleteTask(id: string) {
    await getSupabaseClient().from("tasks").delete().eq("id", id);
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
      <div className="page-layout">
        <div className="main-column">
          <QuotePanel />

          <div className="section">
            <div className="section-label">I dag</div>
            <div className="grid">
              <TasksPanel
                tasks={tasksLive.rows}
                isLoading={tasksLive.isLoading}
                flash={tasksLive.flash}
                onToggleDone={handleToggleDone}
                onDelete={handleDeleteTask}
              />
              <CalendarPanel events={eventsLive.rows} isLoading={eventsLive.isLoading} flash={eventsLive.flash} />
              <WeatherPanel />
            </div>
          </div>

          <div className="section">
            <div className="section-label">Overblik</div>
            <div className="grid">
              <WhoopPanel statuses={statusesLive.rows} isLoading={statusesLive.isLoading} flash={statusesLive.flash} />
              <StatusPanel statuses={statusesLive.rows} isLoading={statusesLive.isLoading} flash={statusesLive.flash} />
            </div>
          </div>

          <DraftsPanel drafts={draftsLive.rows} isLoading={draftsLive.isLoading} flash={draftsLive.flash} onDelete={handleDeleteDraft} />

          <div className="section section-system">
            <div className="section-label">System</div>
            <div className="grid">
              <IntegrationsPanel states={integrationsLive.rows} isLoading={integrationsLive.isLoading} flash={integrationsLive.flash} />
            </div>
          </div>
        </div>
        <aside className="sidebar">
          <NewsPanel source="dr" label="DR Nyheder" />
          <NewsPanel source="tv2" label="TV2 Nyheder" />
        </aside>
      </div>
      <AssistantWidget />
    </div>
  );
}
