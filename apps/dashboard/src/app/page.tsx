"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Database } from "@amsw/db";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useLiveTable } from "@/lib/useLiveTable";
import { CalendarPanel, DraftsPanel, StatusPanel, TasksPanel, WellbeingPanel } from "@/components/panels";
import { Clock } from "@/components/Clock";
import { QuotePanel } from "@/components/QuotePanel";
import { NewsPanel } from "@/components/NewsPanel";

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

  const tasks = useLiveTable<"tasks", Tables["tasks"]["Row"]>("tasks", userId ?? null, { column: "created_at", ascending: false });
  const events = useLiveTable<"calendar_events", Tables["calendar_events"]["Row"]>("calendar_events", userId ?? null, { column: "starts_at" });
  const statuses = useLiveTable<"amsw_status", Tables["amsw_status"]["Row"]>("amsw_status", userId ?? null, { column: "recorded_at", ascending: false });
  const wellbeing = useLiveTable<"wellbeing_entries", Tables["wellbeing_entries"]["Row"]>("wellbeing_entries", userId ?? null, { column: "recorded_at" });
  const drafts = useLiveTable<"drafts", Tables["drafts"]["Row"]>("drafts", userId ?? null, { column: "created_at" });

  async function handleToggleDone(id: string, done: boolean) {
    await getSupabaseClient()
      .from("tasks")
      .update({ status: done ? "done" : "todo" })
      .eq("id", id);
  }

  async function handleDeleteDraft(id: string) {
    await getSupabaseClient().from("drafts").delete().eq("id", id);
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
        <span className="live-pill">
          <span className="live-dot" />
          Live
        </span>
      </div>
      <div className="page-layout">
        <div className="grid">
          <QuotePanel />
          <StatusPanel statuses={statuses} />
          <TasksPanel tasks={tasks} onToggleDone={handleToggleDone} />
          <CalendarPanel events={events} />
          <WellbeingPanel entries={wellbeing} />
          <DraftsPanel drafts={drafts} onDelete={handleDeleteDraft} />
        </div>
        <aside className="sidebar">
          <NewsPanel source="dr" label="DR Nyheder" />
          <NewsPanel source="tv2" label="TV2 Nyheder" />
        </aside>
      </div>
    </div>
  );
}
