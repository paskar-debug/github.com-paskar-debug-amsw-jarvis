"use client";

import type { Database } from "@amsw/db";
import { IconCheck, IconClose, IconSparkle } from "./icons";
import { QuotePanel } from "./QuotePanel";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CalendarRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type StatusRow = Database["public"]["Tables"]["amsw_status"]["Row"];

interface ShopifyMetrics {
  ordersToday?: number;
  revenueToday?: number;
  currency?: string | null;
}

interface WhoopMetrics {
  recoveryScore?: number | null;
}

const dateFormatter = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function greeting(): string {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false });
  const h = Number(hour);
  if (h < 10) return "God morgen";
  if (h < 18) return "God eftermiddag";
  return "God aften";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

export function latestByArea(statuses: StatusRow[], area: string): StatusRow | undefined {
  return [...statuses].filter((s) => s.area === area).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
}

export function formatAmount(value: number, currency?: string | null): string {
  return `${value.toLocaleString("da-DK", { maximumFractionDigits: 0 })}${currency ? ` ${currency}` : ""}`;
}

function recoveryTone(score: number): "green" | "yellow" | "red" {
  if (score < 34) return "red";
  if (score < 67) return "yellow";
  return "green";
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "green" | "yellow" | "red" }) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

/** The top of the page: who/when, plus the four numbers worth seeing before anything else.
 *  Everything here is a summary - the detail lives in exactly one panel further down. */
export function TodayHero({ tasks, events, statuses }: { tasks: TaskRow[]; events: CalendarRow[]; statuses: StatusRow[] }) {
  const shopify = latestByArea(statuses, "shopify")?.metrics as ShopifyMetrics | undefined;
  const whoop = latestByArea(statuses, "whoop")?.metrics as WhoopMetrics | undefined;
  const openTasks = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const nextEvent = events
    .filter((e) => new Date(e.ends_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const date = dateFormatter.format(new Date());
  const recovery = whoop?.recoveryScore;

  return (
    <section className="hero">
      <div className="hero-intro">
        <p className="hero-date">{date.charAt(0).toUpperCase() + date.slice(1)}</p>
        <h1 className="hero-title">{greeting()}, Paskar</h1>
        <QuotePanel />
      </div>
      <div className="kpi-row">
        <Kpi
          label="Omsætning i dag"
          value={typeof shopify?.revenueToday === "number" ? formatAmount(shopify.revenueToday, shopify.currency) : "–"}
          hint={typeof shopify?.ordersToday === "number" ? `${shopify.ordersToday} ordrer` : undefined}
        />
        <Kpi
          label="Recovery"
          value={typeof recovery === "number" ? `${recovery}%` : "–"}
          hint="Whoop"
          tone={typeof recovery === "number" ? recoveryTone(recovery) : undefined}
        />
        <Kpi label="Åbne opgaver" value={String(openTasks.length)} />
        <Kpi
          label="Næste aftale"
          value={nextEvent ? formatTime(nextEvent.starts_at) : "–"}
          hint={nextEvent ? nextEvent.title : "Intet i kalenderen"}
        />
      </div>
    </section>
  );
}

export function ApprovalsPanel({
  tasks,
  onApprove,
  onReject,
}: {
  tasks: TaskRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const suggested = tasks.filter((t) => t.status === "suggested");
  if (suggested.length === 0) return null;

  return (
    <section className="approvals">
      <div className="approvals-header">
        <IconSparkle />
        <span>Afventer din godkendelse</span>
        <span className="count">{suggested.length}</span>
      </div>
      <div className="approvals-list">
        {suggested.map((task) => (
          <div className="approval" key={task.id}>
            <div className="approval-body">
              <span className="approval-title">{task.title}</span>
              {task.description && <span className="approval-desc">{task.description}</span>}
            </div>
            <div className="approval-actions">
              <button type="button" className="icon-button icon-button-approve" onClick={() => onApprove(task.id)} aria-label="Godkend">
                <IconCheck />
              </button>
              <button type="button" className="icon-button icon-button-reject" onClick={() => onReject(task.id)} aria-label="Afvis">
                <IconClose />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
