"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Database } from "@amsw/db";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useLiveTable } from "@/lib/useLiveTable";
import { CalendarPanel, GoalsPanel, StatusPanel, TasksPanel, WellbeingPanel } from "@/components/panels";

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
  const goals = useLiveTable<"goals", Tables["goals"]["Row"]>("goals", userId ?? null, { column: "created_at", ascending: false });
  const wellbeing = useLiveTable<"wellbeing_entries", Tables["wellbeing_entries"]["Row"]>("wellbeing_entries", userId ?? null, { column: "recorded_at" });

  async function handleToggleDone(id: string, done: boolean) {
    await getSupabaseClient()
      .from("tasks")
      .update({ status: done ? "done" : "todo" })
      .eq("id", id);
  }

  if (!userId) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="brand">
          <Image src="/logo.png" alt="Paramasamy" width={36} height={36} priority />
          <h1>AMSW Jarvis</h1>
        </div>
        <span className="live-pill">
          <span className="live-dot" />
          Live
        </span>
      </div>
      <div className="grid">
        <StatusPanel statuses={statuses} />
        <TasksPanel tasks={tasks} onToggleDone={handleToggleDone} />
        <CalendarPanel events={events} />
        <GoalsPanel goals={goals} />
        <WellbeingPanel entries={wellbeing} />
      </div>
    </div>
  );
}
