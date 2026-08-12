"use client";

import type { Database } from "@amsw/db";
import { PanelHeader } from "./panels";
import { IconPlug } from "./icons";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];

const BUSINESS_SOURCES: { key: SyncRow["source"]; label: string }[] = [
  { key: "google_calendar", label: "Google Kalender" },
  { key: "shopify", label: "Shopify" },
  { key: "whoop", label: "Whoop" },
];

const INFRA_SOURCES: { key: SyncRow["source"]; label: string }[] = [
  { key: "telegram", label: "Telegram" },
  { key: "supabase", label: "Supabase" },
  { key: "vercel", label: "Vercel" },
  { key: "railway", label: "Railway" },
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
];

// Tools we depend on but can't check programmatically (no API, runs locally on your device) -
// listed for completeness, not live health.
const MANUAL_TOOLS: { label: string; note: string }[] = [
  { label: "Wispr Flow", note: "Diktering på din enhed – ingen API, tjek selv i appen hvis noget virker mærkeligt" },
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function planLine(state: SyncRow | undefined): string | null {
  if (!state) return null;
  const parts: string[] = [];
  if (state.plan) parts.push(`Plan: ${state.plan}`);
  const detail = state.detail as { isTrialing?: boolean; trialDaysRemaining?: number; creditBalance?: number };
  if (detail?.isTrialing) {
    parts.push(`Trial${typeof detail.trialDaysRemaining === "number" ? ` · ${detail.trialDaysRemaining} dage tilbage` : ""}`);
  }
  if (typeof detail?.creditBalance === "number") parts.push(`${detail.creditBalance} kr./$ tilbage`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function StatusRow({ label, state }: { label: string; state: SyncRow | undefined }) {
  const hasError = Boolean(state?.last_error);
  const status = !state ? "yellow" : hasError ? "red" : "green";
  const statusLabel = !state ? "Ikke sat op" : hasError ? "Fejl" : "OK";
  const plan = planLine(state);

  return (
    <div className="item status-item">
      <div className="status-item-top">
        <span className="status-name">
          <span className={`badge ${status}`} />
          {label}
        </span>
        <span className={`status-pill ${status}`}>{statusLabel}</span>
      </div>
      <div className="meta">
        {plan ? `${plan} · ` : ""}
        {state?.last_synced_at ? `Sidst tjekket: ${formatDate(state.last_synced_at)}` : "Aldrig tjekket endnu"}
        {hasError && state?.last_error ? ` · ${state.last_error}` : ""}
      </div>
    </div>
  );
}

function ManualToolRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="item status-item">
      <div className="status-item-top">
        <span className="status-name">
          <span className="badge gray" />
          {label}
        </span>
        <span className="status-pill gray">Ikke overvåget</span>
      </div>
      <div className="meta">{note}</div>
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

export function IntegrationsPanel({ states, isLoading, flash }: { states: SyncRow[]; isLoading?: boolean; flash?: boolean }) {
  return (
    <section className={["panel", flash && "panel-flash"].filter(Boolean).join(" ")}>
      <PanelHeader icon={<IconPlug />} title="Integrationer" subtitle="Status og forbrug for tjenesterne systemet er bygget på" />
      {isLoading ? (
        <Skeleton lines={5} />
      ) : (
        <>
          <div className="integrations-group-label">Forretning</div>
          {BUSINESS_SOURCES.map(({ key, label }) => (
            <StatusRow label={label} state={states.find((s) => s.source === key)} key={key} />
          ))}
          <div className="integrations-group-label">Infrastruktur</div>
          {INFRA_SOURCES.map(({ key, label }) => (
            <StatusRow label={label} state={states.find((s) => s.source === key)} key={key} />
          ))}
          <div className="integrations-group-label">Eksternt værktøj</div>
          {MANUAL_TOOLS.map(({ label, note }) => (
            <ManualToolRow label={label} note={note} key={label} />
          ))}
        </>
      )}
    </section>
  );
}
