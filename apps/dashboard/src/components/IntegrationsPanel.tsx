"use client";

import type { Database } from "@amsw/db";
import { PanelHeader } from "./panels";
import { IconPlug } from "./icons";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];

interface SourceMeta {
  key: SyncRow["source"];
  label: string;
  letter: string;
  color: string;
}

const BUSINESS_SOURCES: SourceMeta[] = [
  { key: "google_calendar", label: "Google Kalender", letter: "G", color: "#4A90D9" },
  { key: "shopify", label: "Shopify", letter: "S", color: "#95BF47" },
  { key: "whoop", label: "Whoop", letter: "W", color: "#FF4D6D" },
];

const INFRA_SOURCES: SourceMeta[] = [
  { key: "telegram", label: "Telegram", letter: "T", color: "#29B6F6" },
  { key: "supabase", label: "Supabase", letter: "S", color: "#2DBE7E" },
  { key: "vercel", label: "Vercel", letter: "V", color: "#EDEDED" },
  { key: "railway", label: "Railway", letter: "R", color: "#C084FC" },
  { key: "openai", label: "OpenAI", letter: "O", color: "#74AA9C" },
  { key: "anthropic", label: "Anthropic", letter: "A", color: "#D97757" },
];

// Tools we depend on but can't check programmatically (no API, runs locally on your device) -
// listed for completeness, not live health.
const MANUAL_TOOLS: { label: string; letter: string; color: string; note: string }[] = [
  { label: "Wispr Flow", letter: "W", color: "#94A3B8", note: "Diktering på din enhed – ingen API, tjek selv i appen hvis noget virker mærkeligt" },
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

function Avatar({ letter, color }: { letter: string; color: string }) {
  return (
    <span className="integration-avatar" style={{ background: color }}>
      {letter}
    </span>
  );
}

function StatusTile({ meta, state }: { meta: SourceMeta; state: SyncRow | undefined }) {
  const hasError = Boolean(state?.last_error);
  const status = !state ? "yellow" : hasError ? "red" : "green";
  const statusLabel = !state ? "Ikke sat op" : hasError ? "Fejl" : "OK";
  const plan = planLine(state);

  return (
    <div className="integration-tile">
      <Avatar letter={meta.letter} color={meta.color} />
      <div className="integration-tile-body">
        <div className="integration-tile-top">
          <span className="integration-tile-name">{meta.label}</span>
          <span className={`status-pill ${status}`}>{statusLabel}</span>
        </div>
        <div className="meta">
          {hasError && state?.last_error
            ? state.last_error
            : plan
              ? plan
              : state?.last_synced_at
                ? `Sidst tjekket: ${formatDate(state.last_synced_at)}`
                : "Aldrig tjekket endnu"}
        </div>
      </div>
    </div>
  );
}

function ManualToolTile({ label, letter, color, note }: { label: string; letter: string; color: string; note: string }) {
  return (
    <div className="integration-tile">
      <Avatar letter={letter} color={color} />
      <div className="integration-tile-body">
        <div className="integration-tile-top">
          <span className="integration-tile-name">{label}</span>
          <span className="status-pill gray">Ikke overvåget</span>
        </div>
        <div className="meta">{note}</div>
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

export function IntegrationsPanel({ states, isLoading, flash }: { states: SyncRow[]; isLoading?: boolean; flash?: boolean }) {
  return (
    <section className={["panel", flash && "panel-flash"].filter(Boolean).join(" ")}>
      <PanelHeader icon={<IconPlug />} title="Integrationer" subtitle="Status og forbrug for tjenesterne systemet er bygget på" />
      {isLoading ? (
        <Skeleton lines={5} />
      ) : (
        <>
          <div className="integrations-group-label">Forretning</div>
          <div className="integration-grid">
            {BUSINESS_SOURCES.map((meta) => (
              <StatusTile meta={meta} state={states.find((s) => s.source === meta.key)} key={meta.key} />
            ))}
          </div>
          <div className="integrations-group-label">Infrastruktur</div>
          <div className="integration-grid">
            {INFRA_SOURCES.map((meta) => (
              <StatusTile meta={meta} state={states.find((s) => s.source === meta.key)} key={meta.key} />
            ))}
          </div>
          <div className="integrations-group-label">Eksternt værktøj</div>
          <div className="integration-grid">
            {MANUAL_TOOLS.map((tool) => (
              <ManualToolTile {...tool} key={tool.label} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
