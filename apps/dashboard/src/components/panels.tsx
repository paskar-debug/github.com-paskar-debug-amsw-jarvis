"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconCalendar, IconChevron, IconCopy, IconDraft, IconPulse, IconRing, IconTarget, IconTrophy } from "./icons";
import { Sparkline } from "./Sparkline";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

export function panelClass(...extra: (string | false | undefined)[]) {
  return ["panel", ...extra].filter(Boolean).join(" ");
}

const STATE_LABELS: Record<string, string> = { green: "OK", yellow: "Advarsel", red: "Kritisk" };

export function PanelHeader({ icon, title, aside }: { icon: React.ReactNode; title: string; aside?: React.ReactNode }) {
  return (
    <div className="panel-header">
      <span className="panel-icon">{icon}</span>
      <h2>{title}</h2>
      {aside && <div className="panel-aside">{aside}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-group" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div className="skeleton-line" key={i} />
      ))}
    </div>
  );
}

export function QuickAdd({ placeholder, onSubmit }: { placeholder: string; onSubmit: (value: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input type="text" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} />
      <button type="submit" disabled={busy || !value.trim()} aria-label="Tilføj">
        +
      </button>
    </form>
  );
}

const CALENDAR_VISIBLE_LIMIT = 6;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "I dag";
  if (d.toDateString() === tomorrow.toDateString()) return "I morgen";
  const label = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Grouped by day so "today" and "later" read as one list instead of two panels repeating each other. */
export function CalendarPanel({ events, isLoading, flash }: LiveProps & { events: CalendarRow[] }) {
  const upcoming = events
    .filter((e) => new Date(e.ends_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const visible = upcoming.slice(0, CALENDAR_VISIBLE_LIMIT);
  const remaining = upcoming.length - visible.length;
  const groups: [string, CalendarRow[]][] = [];
  for (const event of visible) {
    const key = dayKey(event.starts_at);
    const group = groups.find(([k]) => k === key);
    if (group) group[1].push(event);
    else groups.push([key, [event]]);
  }

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconCalendar />} title="Kalender" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {upcoming.length === 0 && <p className="empty">Ingen kommende aftaler.</p>}
          {groups.map(([key, dayEvents]) => (
            <div className="agenda-day" key={key}>
              <p className="agenda-day-label">{dayHeading(dayEvents[0].starts_at)}</p>
              {dayEvents.map((event) => (
                <div className="agenda-item" key={event.id}>
                  <span className="agenda-time">{formatTime(event.starts_at)}</span>
                  <div className="agenda-body">
                    <span className="agenda-title">{event.title}</span>
                    {event.location && <span className="meta">{event.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {remaining > 0 && <p className="more">+{remaining} flere i kalenderen</p>}
        </>
      )}
    </section>
  );
}

interface ShopifyMetrics {
  ordersToday?: number;
  revenueToday?: number;
  ordersMTD?: number;
  revenueMTD?: number;
  ordersLast7Days?: number;
  revenueLast7Days?: number;
  ordersPrevious7Days?: number;
  revenuePrevious7Days?: number;
  ordersLast30Days?: number;
  revenueLast30Days?: number;
  totalCustomers?: number;
  customerStats?: { newCustomersThisMonth: number; returningCustomersPercent: number; repeatPurchaseRatePercent: number } | null;
  currency?: string | null;
  dailyRevenue?: { date: string; orders: number; revenue: number }[];
  productProfitLast30Days?:
    | { title: string; quantity: number; revenue: number; cost: number | null; profit: number | null; marginPercent: number | null }[]
    | null;
  costDataCoveragePercent?: number | null;
}

const PRODUCT_PROFIT_VISIBLE_LIMIT = 8;

/** A period-over-period change, expressed as a direction + whole-percent magnitude. Returns null
 *  when there's nothing meaningful to compare (no prior-period activity to divide by). */
function computeDelta(current: number, previous: number): { direction: "up" | "down" | "flat"; percent: number } | null {
  if (previous === 0) return current === 0 ? null : { direction: "up", percent: 100 };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { direction: "flat", percent: 0 };
  return { direction: percent > 0 ? "up" : "down", percent: Math.abs(percent) };
}

/** Status color carries the direction; an arrow + text label repeats it, so the meaning never rests
 *  on color alone (a plain color-coded number would fail that on its own). */
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = computeDelta(current, previous);
  if (!delta) return null;
  const arrow = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—";
  return (
    <span className={`delta delta-${delta.direction}`}>
      {arrow} {delta.percent}% <span className="delta-label">vs. forrige uge</span>
    </span>
  );
}

function money(value: number, currency?: string | null): string {
  return `${value.toLocaleString("da-DK", { maximumFractionDigits: 0 })}${currency ? ` ${currency}` : ""}`;
}

type Period = "7d" | "mtd" | "30d";
const PERIOD_LABELS: Record<Period, string> = { "7d": "7 dage", mtd: "Måned", "30d": "30 dage" };

function periodNumbers(m: ShopifyMetrics, period: Period): { orders?: number; revenue?: number; prevOrders?: number; prevRevenue?: number } {
  if (period === "7d") {
    return { orders: m.ordersLast7Days, revenue: m.revenueLast7Days, prevOrders: m.ordersPrevious7Days, prevRevenue: m.revenuePrevious7Days };
  }
  if (period === "mtd") return { orders: m.ordersMTD, revenue: m.revenueMTD };
  return { orders: m.ordersLast30Days, revenue: m.revenueLast30Days };
}

/** All of AMSW's commerce numbers in one place: one period at a time instead of a wall of twelve
 *  stats, with customers and per-product profit tucked below. */
export function ShopifyPanel({ statuses, isLoading, flash }: LiveProps & { statuses: StatusRow[] }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [showProducts, setShowProducts] = useState(false);
  const status = [...statuses]
    .filter((s) => s.area === "shopify")
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
  const metrics = (status?.metrics ?? {}) as ShopifyMetrics;
  const currency = metrics.currency ?? "";
  const { orders, revenue, prevOrders, prevRevenue } = periodNumbers(metrics, period);
  const aov = typeof orders === "number" && typeof revenue === "number" && orders > 0 ? revenue / orders : null;
  const trendPoints = (metrics.dailyRevenue ?? [])
    .filter((d) => !Number.isNaN(new Date(d.date).getTime()))
    .map((d) => ({ label: new Date(d.date).toLocaleDateString("da-DK", { weekday: "short" }), value: d.revenue }));
  const products = metrics.productProfitLast30Days;

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader
        icon={<IconPulse />}
        title="AMSW · Shopify"
        aside={status && <span className={`status-pill ${status.state}`}>{STATE_LABELS[status.state] ?? status.state}</span>}
      />
      {isLoading ? (
        <Skeleton lines={4} />
      ) : !status ? (
        <p className="empty">Ingen Shopify-data endnu.</p>
      ) : typeof metrics.ordersToday !== "number" ? (
        <p className="empty">{status.note ?? "Ingen ordredata."}</p>
      ) : (
        <>
          <div className="segmented" role="tablist">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button type="button" role="tab" aria-selected={p === period} className={p === period ? "active" : ""} onClick={() => setPeriod(p)} key={p}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Omsætning</span>
              <span className="metric-value">{typeof revenue === "number" ? money(revenue, currency) : "–"}</span>
              {typeof revenue === "number" && typeof prevRevenue === "number" && <DeltaBadge current={revenue} previous={prevRevenue} />}
            </div>
            <div className="metric">
              <span className="metric-label">Ordrer</span>
              <span className="metric-value">{orders ?? "–"}</span>
              {typeof orders === "number" && typeof prevOrders === "number" && <DeltaBadge current={orders} previous={prevOrders} />}
            </div>
            <div className="metric">
              <span className="metric-label">Gns. ordre</span>
              <span className="metric-value">{aov === null ? "–" : money(aov, currency)}</span>
            </div>
          </div>

          {trendPoints.length >= 2 && (
            <div className="chart-block">
              <span className="sub-label">Omsætning pr. dag</span>
              <Sparkline points={trendPoints} formatValue={(v) => money(v, currency)} ariaLabel="Omsætning de sidste 7 dage" />
            </div>
          )}

          {(typeof metrics.totalCustomers === "number" || metrics.customerStats) && (
            <div className="mini-stats">
              {typeof metrics.totalCustomers === "number" && (
                <div>
                  <span className="mini-value">{metrics.totalCustomers}</span>
                  <span className="mini-label">kunder i alt</span>
                </div>
              )}
              {metrics.customerStats && (
                <>
                  <div>
                    <span className="mini-value">{metrics.customerStats.newCustomersThisMonth}</span>
                    <span className="mini-label">nye i måneden</span>
                  </div>
                  <div>
                    <span className="mini-value">{metrics.customerStats.returningCustomersPercent}%</span>
                    <span className="mini-label">tilbagevendende</span>
                  </div>
                  <div>
                    <span className="mini-value">{metrics.customerStats.repeatPurchaseRatePercent}%</span>
                    <span className="mini-label">genkøbsrate</span>
                  </div>
                </>
              )}
            </div>
          )}

          {products === null && (
            <p className="note">
              Vare-profit kræver <code>read_products</code>-adgang på Shopify-appen.
            </p>
          )}
          {products && products.length > 0 && (
            <div className="disclosure">
              <button type="button" className={`disclosure-toggle${showProducts ? " open" : ""}`} onClick={() => setShowProducts((v) => !v)}>
                Indtjening pr. vare, 30 dage
                <IconChevron />
              </button>
              {showProducts && (
                <>
                  {typeof metrics.costDataCoveragePercent === "number" && metrics.costDataCoveragePercent < 95 && (
                    <p className="note">Baseret på {metrics.costDataCoveragePercent}% af omsætningen — resten mangler vareomkostning i Shopify.</p>
                  )}
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Vare</th>
                          <th>Antal</th>
                          <th>Omsætning</th>
                          <th>Profit</th>
                          <th>DG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.slice(0, PRODUCT_PROFIT_VISIBLE_LIMIT).map((p) => (
                          <tr key={p.title}>
                            <td>{p.title}</td>
                            <td>{p.quantity}</td>
                            <td>{money(p.revenue, currency)}</td>
                            <td>{p.profit === null ? "–" : money(p.profit, currency)}</td>
                            <td>{p.marginPercent === null ? "–" : `${p.marginPercent}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          <p className="updated">Opdateret {formatDate(status.recorded_at)}</p>
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
  Salg: "#38bdf8",
  Økonomi: "#34d399",
  Kunder: "#a78bfa",
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

export function GoalsPanel({ goals, isLoading, flash, onToggleDone }: LiveProps & { goals: GoalRow[]; onToggleDone: (id: string) => void }) {
  const visible = goals.filter((g) => g.status !== "cancelled");
  const wonCount = visible.filter((g) => g.status === "done").length;
  const grouped = groupGoalsByCategory(visible);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader
        icon={<IconTarget />}
        title="Mål"
        aside={
          visible.length > 0 && (
            <span className="count-pill">
              <IconTrophy /> {wonCount}/{visible.length}
            </span>
          )
        }
      />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          {visible.length === 0 && <p className="empty">Ingen mål endnu.</p>}
          <div className="goal-groups">
            {grouped.map(([category, categoryGoals]) => (
              <div className="goal-group" key={category}>
                <p className="sub-label" style={{ color: categoryColor(category === "Andet" ? null : category) }}>
                  {category}
                </p>
                {categoryGoals.map((goal) => {
                  const done = goal.status === "done";
                  const color = categoryColor(goal.category);
                  return (
                    <label className={`goal${done ? " goal-done" : ""}`} key={goal.id}>
                      <input type="checkbox" checked={done} disabled={done} onChange={() => onToggleDone(goal.id)} />
                      <div className="goal-body">
                        <div className="goal-top">
                          <span className="goal-title">{goal.title}</span>
                          <span className="goal-value">{done ? <IconTrophy /> : `${goal.progress}%`}</span>
                        </div>
                        {!done && (
                          <div className="progress">
                            <div style={{ width: `${goal.progress}%`, background: color }} />
                          </div>
                        )}
                        {(goal.status === "paused" || goal.target_date) && (
                          <span className="meta">
                            {goal.status === "paused" && `${GOAL_STATUS_LABELS.paused} · `}
                            {goal.target_date ? `mål ${new Date(goal.target_date).toLocaleDateString("da-DK", { dateStyle: "medium" })}` : ""}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
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
      <PanelHeader icon={<IconRing />} title="Krop · Whoop" />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : !metrics ? (
        <p className="empty">Ingen Whoop-data endnu.</p>
      ) : (
        <>
          <div className="rings">
            <div className="ring-item">
              <div className={`ring ring-${state}`} style={ringStyle(metrics.recoveryScore ?? 0)}>
                <span className="ring-value">{metrics.recoveryScore ?? "–"}%</span>
              </div>
              <span className="ring-label">Recovery</span>
            </div>
            <div className="ring-item">
              <div className="ring ring-sleep" style={ringStyle(metrics.sleepPerformancePercentage ?? 0)}>
                <span className="ring-value">{metrics.sleepPerformancePercentage ?? "–"}%</span>
              </div>
              <span className="ring-label">Søvn</span>
            </div>
            <div className="ring-item">
              <div className="ring ring-strain" style={ringStyle(((metrics.strain ?? 0) / WHOOP_STRAIN_MAX) * 100)}>
                <span className="ring-value">{typeof metrics.strain === "number" ? metrics.strain.toFixed(1) : "–"}</span>
              </div>
              <span className="ring-label">Strain</span>
            </div>
          </div>
          <p className={`callout callout-${state}`}>{WHOOP_MESSAGES[state]}</p>
          {(typeof metrics.sleepDurationHours === "number" || typeof metrics.restingHeartRate === "number") && (
            <div className="mini-stats">
              {typeof metrics.sleepDurationHours === "number" && (
                <div>
                  <span className="mini-value">{metrics.sleepDurationHours}t</span>
                  <span className="mini-label">søvn</span>
                </div>
              )}
              {typeof metrics.restingHeartRate === "number" && (
                <div>
                  <span className="mini-value">{metrics.restingHeartRate}</span>
                  <span className="mini-label">hvilepuls</span>
                </div>
              )}
            </div>
          )}
          <p className="updated">Opdateret {formatDate(latest.recorded_at)}</p>
        </>
      )}
    </section>
  );
}

function DraftCard({ draft, onDelete }: { draft: DraftRow; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(draft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="draft">
      <div className="draft-header">
        <label className="draft-check">
          <input type="checkbox" onChange={() => onDelete(draft.id)} aria-label="Færdig – fjern udkast" />
        </label>
        <button type="button" className="draft-request" onClick={() => setOpen((v) => !v)}>
          <span>{draft.request}</span>
          <span className="meta">{formatDate(draft.created_at)}</span>
        </button>
        <button className="ghost-button" onClick={handleCopy} type="button">
          <IconCopy />
          {copied ? "Kopieret" : "Kopiér"}
        </button>
      </div>
      {open && <pre className="draft-content">{draft.content}</pre>}
    </div>
  );
}

export function DraftsPanel({ drafts, isLoading, flash, onDelete }: LiveProps & { drafts: DraftRow[]; onDelete: (id: string) => void }) {
  const recent = [...drafts].reverse().slice(0, 10);
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconDraft />} title="Udkast" aside={recent.length > 0 && <span className="count">{recent.length}</span>} />
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
