"use client";

import type { Database } from "@amsw/db";
import { PanelHeader } from "./panels";
import { IconPlug } from "./icons";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];

const BUSINESS_SOURCES: { key: SyncRow["source"]; label: string }[] = [
  { key: "google_calendar", label: "Google Kalender" },
  { key: "shopify", label: "Shopify" },
];

const INFRA_SOURCES: { key: SyncRow["source"]; label: string }[] = [
  { key: "supabase", label: "Supabase" },
  { key: "vercel", label: "Vercel" },
  { key: "railway", label: "Railway" },
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
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

export function IntegrationsPanel({ states }: { states: SyncRow[] }) {
  return (
    <section className="panel">
      <PanelHeader icon={<IconPlug />} title="Integrationer" />
      <div className="integrations-group-label">Forretning</div>
      {BUSINESS_SOURCES.map(({ key, label }) => (
        <StatusRow label={label} state={states.find((s) => s.source === key)} key={key} />
      ))}
      <div className="integrations-group-label">Infrastruktur</div>
      {INFRA_SOURCES.map(({ key, label }) => (
        <StatusRow label={label} state={states.find((s) => s.source === key)} key={key} />
      ))}
    </section>
  );
}
