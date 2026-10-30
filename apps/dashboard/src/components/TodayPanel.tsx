"use client";

import type { Database } from "@amsw/db";
import { IconCheck, IconClose, IconSparkle } from "./icons";
import { QuotePanel } from "./QuotePanel";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

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

/** The top of the page: who/when and the day's quote. The numbers live in the panels right below. */
export function TodayHero() {
  const date = dateFormatter.format(new Date());
  return (
    <section className="hero">
      <p className="kicker">{date}</p>
      <h1 className="hero-title">{greeting()}, Paskar</h1>
      <QuotePanel />
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
