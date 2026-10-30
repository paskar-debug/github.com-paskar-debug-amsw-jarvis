"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconCheck, IconChevron, IconClose, IconSparkle } from "./icons";
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

const APPROVALS_VISIBLE = 5;

function ageLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  return `${days} d`;
}

/** Suggestions from the agents, as a short one-line list: newest few up front, the rest behind a toggle,
 *  and each description only when its row is opened - a wall of cards was unreadable at ~100 items. */
export function ApprovalsPanel({
  tasks,
  onApprove,
  onReject,
}: {
  tasks: TaskRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const suggested = tasks
    .filter((t) => t.status === "suggested")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (suggested.length === 0) return null;
  const visible = showAll ? suggested : suggested.slice(0, APPROVALS_VISIBLE);
  const hidden = suggested.length - APPROVALS_VISIBLE;

  return (
    <section className="approvals">
      <div className="approvals-header">
        <IconSparkle />
        <span>Afventer din godkendelse</span>
        <span className="count">{suggested.length}</span>
      </div>
      <div className="approvals-list">
        {visible.map((task) => {
          const open = openId === task.id;
          return (
            <div className={`approval${open ? " approval-open" : ""}`} key={task.id}>
              <button type="button" className="approval-body" onClick={() => setOpenId(open ? null : task.id)} aria-expanded={open}>
                <span className="approval-title">{task.title}</span>
                {open && task.description && <span className="approval-desc">{task.description}</span>}
              </button>
              <span className="approval-age">{ageLabel(task.created_at)}</span>
              <div className="approval-actions">
                <button type="button" className="icon-button icon-button-approve" onClick={() => onApprove(task.id)} aria-label="Godkend">
                  <IconCheck />
                </button>
                <button type="button" className="icon-button icon-button-reject" onClick={() => onReject(task.id)} aria-label="Afvis">
                  <IconClose />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <div className="disclosure">
          <button type="button" className={`disclosure-toggle${showAll ? " open" : ""}`} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Vis færre" : `Vis alle (${hidden} mere)`}
            <IconChevron />
          </button>
        </div>
      )}
    </section>
  );
}
