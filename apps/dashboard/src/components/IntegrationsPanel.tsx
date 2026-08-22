"use client";

import type { Database } from "@amsw/db";
import {
  LogoAnthropic,
  LogoGoogleCalendar,
  LogoOpenAI,
  LogoRailway,
  LogoShopify,
  LogoSupabase,
  LogoTelegram,
  LogoTodoist,
  LogoVercel,
} from "./logos";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];
type Status = "green" | "yellow" | "red";

interface SourceMeta {
  key: SyncRow["source"];
  label: string;
  logo: React.ComponentType<{ className?: string }>;
  color: string;
}

const SOURCES: SourceMeta[] = [
  { key: "google_calendar", label: "Google Kalender", logo: LogoGoogleCalendar, color: "#4285F4" },
  { key: "todoist", label: "Todoist", logo: LogoTodoist, color: "#E44332" },
  { key: "shopify", label: "Shopify", logo: LogoShopify, color: "#95BF47" },
  { key: "telegram", label: "Telegram", logo: LogoTelegram, color: "#29A9EA" },
  { key: "supabase", label: "Supabase", logo: LogoSupabase, color: "#3ECF8E" },
  { key: "vercel", label: "Vercel", logo: LogoVercel, color: "#000000" },
  { key: "railway", label: "Railway", logo: LogoRailway, color: "#9757F5" },
  { key: "openai", label: "OpenAI", logo: LogoOpenAI, color: "#10A37F" },
  { key: "anthropic", label: "Anthropic", logo: LogoAnthropic, color: "#D97757" },
];

const WHOOP_META = { label: "Whoop", letter: "W", color: "#FF4D6D" };

// No source (real API) or public brand mark available - shown for completeness, not live health.
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

function statusOf(state: SyncRow | undefined): { status: Status; statusLabel: string } {
  const hasError = Boolean(state?.last_error);
  if (!state) return { status: "yellow", statusLabel: "Ikke sat op" };
  return hasError ? { status: "red", statusLabel: "Fejl" } : { status: "green", statusLabel: "OK" };
}

function tooltipFor(label: string, state: SyncRow | undefined): string {
  const { statusLabel } = statusOf(state);
  const plan = planLine(state);
  const detail =
    state?.last_error ?? plan ?? (state?.last_synced_at ? `Sidst tjekket: ${formatDate(state.last_synced_at)}` : "Aldrig tjekket endnu");
  return `${label} — ${statusLabel} — ${detail}`;
}

function Chip({
  label,
  title,
  color,
  children,
  status,
}: {
  label: string;
  title: string;
  color: string;
  children: React.ReactNode;
  status: Status;
}) {
  return (
    <span className="integration-chip" title={title}>
      <span className="integration-chip-label">{label}</span>
      <span className="integration-chip-avatar-wrap">
        <span className="integration-chip-avatar" style={{ background: color }}>
          {children}
        </span>
        <span className={`integration-chip-dot ${status}`} />
      </span>
    </span>
  );
}

function LogoChip({ meta, state }: { meta: SourceMeta; state: SyncRow | undefined }) {
  const { status } = statusOf(state);
  return (
    <Chip label={meta.label} title={tooltipFor(meta.label, state)} color={meta.color} status={status}>
      <meta.logo className="integration-chip-logo" />
    </Chip>
  );
}

function WhoopChip({ state }: { state: SyncRow | undefined }) {
  const { status } = statusOf(state);
  return (
    <Chip label={WHOOP_META.label} title={tooltipFor(WHOOP_META.label, state)} color={WHOOP_META.color} status={status}>
      {WHOOP_META.letter}
    </Chip>
  );
}

function ManualToolChip({ label, letter, color, note }: { label: string; letter: string; color: string; note: string }) {
  return (
    <Chip label={label} title={`${label} — Ikke overvåget — ${note}`} color={color} status="yellow">
      {letter}
    </Chip>
  );
}

function Skeleton() {
  return (
    <div className="integrations-strip" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <span className="integration-chip" key={i}>
          <span className="skeleton-chip-label" />
          <span className="integration-chip-avatar skeleton-chip" />
        </span>
      ))}
    </div>
  );
}

export function IntegrationsPanel({ states, isLoading, flash }: { states: SyncRow[]; isLoading?: boolean; flash?: boolean }) {
  if (isLoading) return <Skeleton />;
  return (
    <div className={["integrations-strip", flash && "integrations-strip-flash"].filter(Boolean).join(" ")}>
      {SOURCES.map((meta) => (
        <LogoChip meta={meta} state={states.find((s) => s.source === meta.key)} key={meta.key} />
      ))}
      <WhoopChip state={states.find((s) => s.source === "whoop")} />
      {MANUAL_TOOLS.map((tool) => (
        <ManualToolChip {...tool} key={tool.label} />
      ))}
    </div>
  );
}
