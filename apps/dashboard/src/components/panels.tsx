"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconCalendar, IconCopy, IconDraft, IconHeart, IconPulse, IconTasks } from "./icons";
import { Sparkline } from "./Sparkline";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type StatusRow = Database["public"]["Tables"]["amsw_status"]["Row"];
type WellbeingRow = Database["public"]["Tables"]["wellbeing_entries"]["Row"];
type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function panelClass(...extra: (string | false | undefined)[]) {
  return ["panel", ...extra].filter(Boolean).join(" ");
}

const STATE_LABELS: Record<string, string> = { green: "OK", yellow: "Advarsel", red: "Kritisk" };

export function PanelHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="panel-header">
      <span className="panel-icon">{icon}</span>
      <div className="panel-header-text">
        <h2>{title}</h2>
        {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-group" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div className="skeleton-line" key={i} />
      ))}
    </div>
  );
}

export function TasksPanel({
  tasks,
  isLoading,
  flash,
  onToggleDone,
}: LiveProps & {
  tasks: TaskRow[];
  onToggleDone: (id: string, done: boolean) => void;
}) {
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTasks />} title="Opgaver" subtitle="Huskesedler du sender via tekst eller tale i Telegram" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}

export function CalendarPanel({ events, isLoading, flash }: LiveProps & { events: CalendarRow[] }) {
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() >= Date.now());
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconCalendar />} title="Kalender" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}

interface ShopifyMetrics {
  ordersToday?: number;
  revenueToday?: number;
  ordersLast7Days?: number;
  revenueLast7Days?: number;
  totalCustomers?: number;
  currency?: string | null;
  dailyRevenue?: { date: string; orders: number; revenue: number }[];
}

export function StatusPanel({ statuses, isLoading, flash }: LiveProps & { statuses: StatusRow[] }) {
  const latestByArea = new Map<string, StatusRow>();
  for (const status of statuses) {
    const existing = latestByArea.get(status.area);
    if (!existing || new Date(status.recorded_at) > new Date(existing.recorded_at)) {
      latestByArea.set(status.area, status);
    }
  }
  const latest = [...latestByArea.values()];
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconPulse />} title="AMSW Shopify status" />
      {isLoading ? (
        <Skeleton lines={4} />
      ) : (
        <>
          {latest.length === 0 && <p className="empty">Ingen status endnu.</p>}
          {latest.map((status) => {
            const metrics = status.metrics as ShopifyMetrics;
            const hasOrderMetrics = typeof metrics?.ordersToday === "number";
            const trendPoints = (metrics.dailyRevenue ?? [])
              .filter((d) => !Number.isNaN(new Date(d.date).getTime()))
              .map((d) => ({
                label: new Date(d.date).toLocaleDateString("da-DK", { weekday: "short" }),
                value: d.revenue,
              }));
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
                      <span className="stat-label">omsætning i dag</span>
                    </div>
                    {typeof metrics.ordersLast7Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">{metrics.ordersLast7Days}</span>
                        <span className="stat-label">ordrer, 7 dage</span>
                      </div>
                    )}
                    {typeof metrics.revenueLast7Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">
                          {metrics.revenueLast7Days} {metrics.currency ?? ""}
                        </span>
                        <span className="stat-label">omsætning, 7 dage</span>
                      </div>
                    )}
                    {typeof metrics.totalCustomers === "number" && (
                      <div className="stat">
                        <span className="stat-value">{metrics.totalCustomers}</span>
                        <span className="stat-label">kunder i alt</span>
                      </div>
                    )}
                  </div>
                )}
                {trendPoints.length >= 2 && (
                  <div className="sparkline-block">
                    <Sparkline
                      points={trendPoints}
                      formatValue={(v) => `${v.toFixed(0)} ${metrics.currency ?? ""}`}
                      ariaLabel="Omsætning de sidste 7 dage"
                    />
                    <span className="stat-label">omsætning, 7-dages trend</span>
                  </div>
                )}
                <div className="meta">
                  {hasOrderMetrics ? "" : (status.note ?? "")} {formatDate(status.recorded_at)}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

export function WellbeingPanel({ entries, isLoading, flash }: LiveProps & { entries: WellbeingRow[] }) {
  const recent = [...entries].reverse().slice(0, 7);
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconHeart />} title="Velvære" />
      {isLoading ? (
        <Skeleton lines={2} />
      ) : (
        <>
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
        </>
      )}
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

export function DraftsPanel({ drafts, isLoading, flash, onDelete }: LiveProps & { drafts: DraftRow[]; onDelete: (id: string) => void }) {
  const recent = [...drafts].reverse().slice(0, 10);
  return (
    <section className={panelClass("panel-wide", flash && "panel-flash")}>
      <PanelHeader icon={<IconDraft />} title="Udkast" subtitle="Analyser, opsummeringer og tekster du beder botten skrive med det samme" />
      {isLoading ? (
        <Skeleton lines={2} />
      ) : (
        <>
          {recent.length === 0 && <p className="empty">Ingen udkast endnu.</p>}
          {recent.map((draft) => (
            <DraftCard draft={draft} onDelete={onDelete} key={draft.id} />
          ))}
        </>
      )}
    </section>
  );
}
