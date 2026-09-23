"use client";

import type { Database } from "@amsw/db";
import { IconCalendar, IconCheck, IconClose, IconSun } from "./icons";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type StatusRow = Database["public"]["Tables"]["amsw_status"]["Row"];
type EngvangRow = Database["public"]["Tables"]["engvang_items"]["Row"];

interface ShopifyMetrics {
  ordersToday?: number;
  revenueToday?: number;
  currency?: string | null;
}

interface WhoopMetrics {
  recoveryScore?: number | null;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

function greeting(): string {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false });
  const h = Number(hour);
  if (h < 10) return "God morgen";
  if (h < 18) return "God eftermiddag";
  return "God aften";
}

function latestByArea(statuses: StatusRow[], area: string): StatusRow | undefined {
  return [...statuses].filter((s) => s.area === area).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
}

export function TodayPanel({
  tasks,
  events,
  statuses,
  engvangItems,
  isLoading,
  onApprove,
  onReject,
}: {
  tasks: TaskRow[];
  events: CalendarRow[];
  statuses: StatusRow[];
  engvangItems?: EngvangRow[];
  isLoading?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (isLoading) return null;

  const suggested = tasks.filter((t) => t.status === "suggested");
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled" && t.status !== "suggested");
  const todaysEvents = events
    .filter((e) => isToday(e.starts_at))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const engvangDeadlineSoon = (engvangItems ?? []).filter((i) => {
    if (!i.next_deadline || i.status !== "active") return false;
    const days = (new Date(i.next_deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    return days <= 14;
  });

  const shopify = latestByArea(statuses, "shopify")?.metrics as ShopifyMetrics | undefined;
  const whoop = latestByArea(statuses, "whoop")?.metrics as WhoopMetrics | undefined;

  return (
    <section className="today-hero">
      <div className="today-hero-header">
        <IconSun className="today-hero-icon" />
        <h1>{greeting()}</h1>
      </div>

      <div className="today-stats">
        {typeof whoop?.recoveryScore === "number" && (
          <div className="stat">
            <span className="stat-value">{whoop.recoveryScore}%</span>
            <span className="stat-label">recovery</span>
          </div>
        )}
        {typeof shopify?.ordersToday === "number" && (
          <div className="stat">
            <span className="stat-value">{shopify.ordersToday}</span>
            <span className="stat-label">ordrer i dag</span>
          </div>
        )}
        {typeof shopify?.revenueToday === "number" && (
          <div className="stat">
            <span className="stat-value">
              {shopify.revenueToday} {shopify.currency ?? ""}
            </span>
            <span className="stat-label">omsætning i dag</span>
          </div>
        )}
        <div className="stat">
          <span className="stat-value">{openTasks.length}</span>
          <span className="stat-label">åbne opgaver</span>
        </div>
        <div className="stat">
          <span className="stat-value">{todaysEvents.length}</span>
          <span className="stat-label">aftaler i dag</span>
        </div>
        {engvangDeadlineSoon.length > 0 && (
          <div className="stat">
            <span className="stat-value">{engvangDeadlineSoon.length}</span>
            <span className="stat-label">arbejds-frister snart</span>
          </div>
        )}
      </div>

      {suggested.length > 0 && (
        <div className="today-suggestions">
          <p className="today-section-label">Afventer din godkendelse ({suggested.length})</p>
          {suggested.map((task) => (
            <div className="today-suggestion-item" key={task.id}>
              <div className="today-suggestion-body">
                <span className="today-suggestion-title">{task.title}</span>
                {task.description && <span className="today-suggestion-desc">{task.description}</span>}
              </div>
              <div className="today-suggestion-actions">
                <button type="button" className="today-suggestion-approve" onClick={() => onApprove(task.id)} aria-label="Godkend">
                  <IconCheck />
                </button>
                <button type="button" className="today-suggestion-reject" onClick={() => onReject(task.id)} aria-label="Afvis">
                  <IconClose />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {todaysEvents.length > 0 && (
        <div className="today-events">
          <p className="today-section-label">
            <IconCalendar className="today-section-icon" /> I dag
          </p>
          {todaysEvents.map((event) => (
            <div className="today-event-item" key={event.id}>
              <span className="today-event-time">{formatTime(event.starts_at)}</span>
              <span className="today-event-title">{event.title}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
