"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconCalendar, IconClose, IconCopy, IconDraft, IconPulse, IconRing, IconTarget, IconTasks, IconTrophy } from "./icons";
import { Sparkline } from "./Sparkline";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type StatusRow = Database["public"]["Tables"]["amsw_status"]["Row"];
type DraftRow = Database["public"]["Tables"]["drafts"]["Row"];
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function formatDayBadge(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("da-DK", { day: "2-digit" }),
    month: d.toLocaleDateString("da-DK", { month: "short" }).replace(".", "").toUpperCase(),
  };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
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

const TASKS_VISIBLE_LIMIT = 6;

export function TasksPanel({
  tasks,
  isLoading,
  flash,
  onToggleDone,
  onDelete,
}: LiveProps & {
  tasks: TaskRow[];
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const visible = open.slice(0, TASKS_VISIBLE_LIMIT);
  const remaining = open.length - visible.length;
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTasks />} title="Opgaver" subtitle="Huskesedler du sender via tekst eller tale i Telegram" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {open.length === 0 && <p className="empty">Ingen åbne opgaver.</p>}
          {visible.map((task) => (
            <div className="item item-checkable" key={task.id}>
              <label className="task-label">
                <input type="checkbox" onChange={() => onToggleDone(task.id)} />
                <div>
                  {task.title}
                  <div className="meta">
                    {task.priority.toUpperCase()} · {task.source}
                    {task.due_at ? ` · ${formatDate(task.due_at)}` : ""}
                  </div>
                </div>
              </label>
              <button type="button" className="task-delete-button" onClick={() => onDelete(task.id)} aria-label="Slet opgave">
                <IconClose />
              </button>
            </div>
          ))}
          {remaining > 0 && <p className="empty">+{remaining} flere opgaver.</p>}
        </>
      )}
    </section>
  );
}

const CALENDAR_VISIBLE_LIMIT = 5;

export function CalendarPanel({ events, isLoading, flash }: LiveProps & { events: CalendarRow[] }) {
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() >= Date.now());
  const visible = upcoming.slice(0, CALENDAR_VISIBLE_LIMIT);
  const remaining = upcoming.length - visible.length;
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconCalendar />} title="Kalender" subtitle="Kommende aftaler fra Google Kalender og botten" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {upcoming.length === 0 && <p className="empty">Ingen kommende begivenheder.</p>}
          {visible.map((event) => {
            const { day, month } = formatDayBadge(event.starts_at);
            return (
              <div className="item calendar-item" key={event.id}>
                <div className="date-badge">
                  <span className="date-badge-day">{day}</span>
                  <span className="date-badge-month">{month}</span>
                </div>
                <div className="calendar-item-body">
                  {event.title}
                  <div className="meta">
                    {formatTime(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {remaining > 0 && <p className="empty">+{remaining} flere i kalenderen.</p>}
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
  ordersLast14Days?: number;
  revenueLast14Days?: number;
  ordersLast30Days?: number;
  revenueLast30Days?: number;
  totalCustomers?: number;
  currency?: string | null;
  dailyRevenue?: { date: string; orders: number; revenue: number }[];
}

export function StatusPanel({ statuses, isLoading, flash }: LiveProps & { statuses: StatusRow[] }) {
  const latestByArea = new Map<string, StatusRow>();
  for (const status of statuses) {
    if (status.area !== "shopify") continue;
    const existing = latestByArea.get(status.area);
    if (!existing || new Date(status.recorded_at) > new Date(existing.recorded_at)) {
      latestByArea.set(status.area, status);
    }
  }
  const latest = [...latestByArea.values()];
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconPulse />} title="AMSW Shopify status" subtitle="Ordrer, omsætning og status hentet automatisk fra Shopify" />
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
                    {typeof metrics.ordersLast14Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">{metrics.ordersLast14Days}</span>
                        <span className="stat-label">ordrer, 14 dage</span>
                      </div>
                    )}
                    {typeof metrics.revenueLast14Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">
                          {metrics.revenueLast14Days} {metrics.currency ?? ""}
                        </span>
                        <span className="stat-label">omsætning, 14 dage</span>
                      </div>
                    )}
                    {typeof metrics.ordersLast30Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">{metrics.ordersLast30Days}</span>
                        <span className="stat-label">ordrer, 30 dage</span>
                      </div>
                    )}
                    {typeof metrics.revenueLast30Days === "number" && (
                      <div className="stat">
                        <span className="stat-value">
                          {metrics.revenueLast30Days} {metrics.currency ?? ""}
                        </span>
                        <span className="stat-label">omsætning, 30 dage</span>
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

const GOAL_STATUS_LABELS: Record<string, string> = { done: "Nået", paused: "Pause", cancelled: "Annulleret" };

// Fixed categorical order + hues - never cycled/generated, so a category always reads as the same
// color. Unrecognized categories (a new one Claude infers via Telegram) fall back to a neutral tone
// rather than an arbitrary hue.
const CATEGORY_ORDER = ["Salg", "Økonomi", "Kunder"];
const CATEGORY_COLORS: Record<string, string> = {
  Salg: "#00c2ff",
  Økonomi: "#2fe08a",
  Kunder: "#9757f5",
};
const FALLBACK_CATEGORY_COLOR = "#8b93a7";

function categoryColor(category: string | null): string {
  return (category && CATEGORY_COLORS[category]) || FALLBACK_CATEGORY_COLOR;
}

function groupGoalsByCategory(goals: GoalRow[]): [string, GoalRow[]][] {
  const groups = new Map<string, GoalRow[]>();
  for (const goal of goals) {
    const key = goal.category ?? "Andet";
    const list = groups.get(key) ?? [];
    list.push(goal);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const targetA = a.metric_target ?? Infinity;
      const targetB = b.metric_target ?? Infinity;
      return targetA !== targetB ? targetA - targetB : a.title.localeCompare(b.title);
    });
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((c) => groups.has(c)),
    ...[...groups.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];
  return orderedKeys.map((key) => [key, groups.get(key)!]);
}

export function GoalsPanel({
  goals,
  isLoading,
  flash,
  onToggleDone,
}: LiveProps & { goals: GoalRow[]; onToggleDone: (id: string) => void }) {
  const visible = goals.filter((g) => g.status !== "cancelled");
  const wonCount = visible.filter((g) => g.status === "done").length;
  const grouped = groupGoalsByCategory(visible);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTarget />} title="Mål" subtitle="AMSW's vision - salg, økonomi og udvidelse til udlandet" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {visible.length > 0 && (
            <div className="goal-summary">
              <IconTrophy className="goal-summary-icon" />
              {wonCount} af {visible.length} mål nået
            </div>
          )}
          {visible.length === 0 && <p className="empty">Ingen mål endnu.</p>}
          {grouped.map(([category, categoryGoals]) => (
            <div className="goal-group" key={category}>
              <div className="goal-group-label" style={{ color: categoryColor(category === "Andet" ? null : category) }}>
                {category}
              </div>
              {categoryGoals.map((goal) => {
                const done = goal.status === "done";
                const color = categoryColor(goal.category);
                return (
                  <label className={`goal-item${done ? " goal-item-won" : ""}`} key={goal.id}>
                    <input type="checkbox" checked={done} disabled={done} onChange={() => onToggleDone(goal.id)} />
                    <div className="goal-item-body">
                      <div className="goal-item-top">
                        <span className="goal-title">
                          <span className="goal-dot" style={{ background: done ? "var(--green)" : color }} />
                          {goal.title}
                        </span>
                        {done ? (
                          <span className="goal-won-badge">
                            <IconTrophy /> Nået!
                          </span>
                        ) : (
                          <span className="goal-progress-value">{goal.progress}%</span>
                        )}
                      </div>
                      {!done && (
                        <div className="progress-bar">
                          <div style={{ width: `${goal.progress}%`, background: `linear-gradient(90deg, ${color}55, ${color})`, boxShadow: `0 0 12px ${color}99` }} />
                        </div>
                      )}
                      {(goal.status === "paused" || goal.target_date) && (
                        <div className="meta">
                          {goal.status === "paused" && (
                            <span className={`status-pill yellow`} style={{ marginRight: "0.5rem" }}>
                              {GOAL_STATUS_LABELS.paused}
                            </span>
                          )}
                          {goal.target_date ? `mål: ${new Date(goal.target_date).toLocaleDateString("da-DK", { dateStyle: "medium" })}` : ""}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

interface WhoopMetrics {
  recoveryScore?: number | null;
  restingHeartRate?: number | null;
  sleepPerformancePercentage?: number | null;
  sleepDurationHours?: number | null;
  strain?: number | null;
}

const WHOOP_MESSAGES: Record<"green" | "yellow" | "red", string> = {
  green: "Kroppen er klar. God dag til at presse på.",
  yellow: "Delvist restitueret. Hold et roligt til moderat tempo i dag.",
  red: "Lav restitution. Prioritér hvile og genopladning i dag.",
};

function whoopState(score: number | null | undefined): "green" | "yellow" | "red" {
  if (score == null) return "yellow";
  if (score < 34) return "red";
  if (score < 67) return "yellow";
  return "green";
}

const WHOOP_STRAIN_MAX = 21;

function ringStyle(pct: number): React.CSSProperties {
  return { "--whoop-pct": `${Math.max(0, Math.min(100, pct)) * 3.6}deg` } as React.CSSProperties;
}

export function WhoopPanel({ statuses, isLoading, flash }: LiveProps & { statuses: StatusRow[] }) {
  const latest = [...statuses]
    .filter((s) => s.area === "whoop")
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
  const metrics = latest?.metrics as WhoopMetrics | undefined;
  const state = whoopState(metrics?.recoveryScore);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconRing />} title="Whoop" subtitle="Recovery, søvn og strain fra din Whoop" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : !metrics ? (
        <p className="empty">Ingen Whoop-data endnu.</p>
      ) : (
        <>
          <div className="whoop-rings">
            <div className="whoop-ring-item">
              <div className="whoop-ring whoop-ring-sleep" style={ringStyle(metrics.sleepPerformancePercentage ?? 0)}>
                <span className="whoop-ring-value">{metrics.sleepPerformancePercentage ?? "–"}%</span>
              </div>
              <span className="whoop-ring-label">Søvn</span>
            </div>
            <div className="whoop-ring-item">
              <div className={`whoop-ring whoop-ring-${state}`} style={ringStyle(metrics.recoveryScore ?? 0)}>
                <span className="whoop-ring-value">{metrics.recoveryScore ?? "–"}%</span>
              </div>
              <span className="whoop-ring-label">Recovery</span>
            </div>
            <div className="whoop-ring-item">
              <div
                className="whoop-ring whoop-ring-strain"
                style={ringStyle(((metrics.strain ?? 0) / WHOOP_STRAIN_MAX) * 100)}
              >
                <span className="whoop-ring-value">{typeof metrics.strain === "number" ? metrics.strain.toFixed(1) : "–"}</span>
              </div>
              <span className="whoop-ring-label">Strain</span>
            </div>
          </div>
          <p className={`whoop-message whoop-message-${state}`}>{WHOOP_MESSAGES[state]}</p>
          {(typeof metrics.sleepDurationHours === "number" || typeof metrics.restingHeartRate === "number") && (
            <div className="status-stats whoop-stats">
              {typeof metrics.sleepDurationHours === "number" && (
                <div className="stat">
                  <span className="stat-value">{metrics.sleepDurationHours}t</span>
                  <span className="stat-label">søvn i alt</span>
                </div>
              )}
              {typeof metrics.restingHeartRate === "number" && (
                <div className="stat">
                  <span className="stat-value">{metrics.restingHeartRate}</span>
                  <span className="stat-label">hvilepuls</span>
                </div>
              )}
            </div>
          )}
          <div className="meta">Sidst opdateret: {formatDate(latest.recorded_at)}</div>
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
