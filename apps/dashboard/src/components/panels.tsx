"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconCalendar, IconCopy, IconDraft, IconHeart, IconPulse, IconTarget, IconTasks } from "./icons";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type StatusRow = Database["public"]["Tables"]["amsw_status"]["Row"];
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
type WellbeingRow = Database["public"]["Tables"]["wellbeing_entries"]["Row"];
type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

const STATE_LABELS: Record<string, string> = { green: "OK", yellow: "Advarsel", red: "Kritisk" };

export function PanelHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-header">
      <span className="panel-icon">{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}

export function TasksPanel({
  tasks,
  onToggleDone,
}: {
  tasks: TaskRow[];
  onToggleDone: (id: string, done: boolean) => void;
}) {
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  return (
    <section className="panel">
      <PanelHeader icon={<IconTasks />} title="Opgaver" />
      {open.length === 0 && <p className="empty">Ingen åbne opgaver.</p>}
      {open.map((task) => (
        <label className="item item-checkable" key={task.id}>
          <input type="checkbox" onChange={() => onToggleDone(task.id, true)} />
          <div>
            {task.title}
            <div className="meta">
              {task.priority.toUpperCase()} · {task.source}
              {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
            </div>
          </div>
        </label>
      ))}
    </section>
  );
}

export function CalendarPanel({ events }: { events: CalendarRow[] }) {
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() >= Date.now());
  return (
    <section className="panel">
      <PanelHeader icon={<IconCalendar />} title="Kalender" />
      {upcoming.length === 0 && <p className="empty">Ingen kommende begivenheder.</p>}
      {upcoming.map((event) => (
        <div className="item" key={event.id}>
          {event.title}
          <div className="meta">
            {formatDate(event.starts_at)}
            {event.location ? ` · ${event.location}` : ""}
          </div>
        </div>
      ))}
    </section>
  );
}

export function StatusPanel({ statuses }: { statuses: StatusRow[] }) {
  const latestByArea = new Map<string, StatusRow>();
  for (const status of statuses) {
    const existing = latestByArea.get(status.area);
    if (!existing || new Date(status.recorded_at) > new Date(existing.recorded_at)) {
      latestByArea.set(status.area, status);
    }
  }
  const latest = [...latestByArea.values()];
  return (
    <section className="panel">
      <PanelHeader icon={<IconPulse />} title="AMSW-status" />
      {latest.length === 0 && <p className="empty">Ingen status endnu.</p>}
      {latest.map((status) => {
        const metrics = status.metrics as { ordersToday?: number; revenueToday?: number; currency?: string | null };
        const hasOrderMetrics = typeof metrics?.ordersToday === "number";
        return (
          <div className="item status-item" key={status.id}>
            <div className="status-item-top">
              <span className="status-name">
                <span className={`badge ${status.state}`} />
                {status.area}
              </span>
              <span className={`status-pill ${status.state}`}>{STATE_LABELS[status.state] ?? status.state}</span>
            </div>
            {hasOrderMetrics && (
              <div className="status-stats">
                <div className="stat">
                  <span className="stat-value">{metrics.ordersToday}</span>
                  <span className="stat-label">ordrer i dag</span>
                </div>
                <div className="stat">
                  <span className="stat-value">
                    {metrics.revenueToday} {metrics.currency ?? ""}
                  </span>
                  <span className="stat-label">omsætning</span>
                </div>
              </div>
            )}
            <div className="meta">
              {hasOrderMetrics ? "" : (status.note ?? "")} {formatDate(status.recorded_at)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function GoalsPanel({ goals }: { goals: GoalRow[] }) {
  const active = goals.filter((g) => g.status === "active");
  return (
    <section className="panel">
      <PanelHeader icon={<IconTarget />} title="Mål" />
      {active.length === 0 && <p className="empty">Ingen aktive mål.</p>}
      {active.map((goal) => (
        <div className="item" key={goal.id}>
          {goal.title}
          <div className="progress-bar">
            <div style={{ width: `${goal.progress}%` }} />
          </div>
          <div className="meta">
            {goal.progress}% {goal.target_date ? `· frist ${goal.target_date}` : ""}
          </div>
        </div>
      ))}
    </section>
  );
}

export function WellbeingPanel({ entries }: { entries: WellbeingRow[] }) {
  const recent = [...entries].reverse().slice(0, 7);
  return (
    <section className="panel">
      <PanelHeader icon={<IconHeart />} title="Velvære" />
      {recent.length === 0 && <p className="empty">Ingen registreringer endnu.</p>}
      {recent.map((entry) => (
        <div className="item" key={entry.id}>
          Humør {entry.mood}/5 · Energi {entry.energy}/5
          <div className="meta">
            {entry.sleep_hours ? `${entry.sleep_hours}t søvn · ` : ""}
            {formatDate(entry.recorded_at)}
          </div>
        </div>
      ))}
    </section>
  );
}

function DraftCard({ draft, onDelete }: { draft: DraftRow; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(draft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="draft-card">
      <div className="draft-card-header">
        <label className="draft-request-row">
          <input type="checkbox" onChange={() => onDelete(draft.id)} />
          <div>
            <div className="draft-request">{draft.request}</div>
            <div className="meta">{formatDate(draft.created_at)}</div>
          </div>
        </label>
        <button className="copy-button" onClick={handleCopy} type="button">
          <IconCopy />
          {copied ? "Kopieret!" : "Kopiér"}
        </button>
      </div>
      <pre className="draft-content">{draft.content}</pre>
    </div>
  );
}

export function DraftsPanel({ drafts, onDelete }: { drafts: DraftRow[]; onDelete: (id: string) => void }) {
  const recent = [...drafts].reverse().slice(0, 10);
  return (
    <section className="panel panel-wide">
      <PanelHeader icon={<IconDraft />} title="Udkast" />
      {recent.length === 0 && <p className="empty">Ingen udkast endnu.</p>}
      {recent.map((draft) => (
        <DraftCard draft={draft} onDelete={onDelete} key={draft.id} />
      ))}
    </section>
  );
}
