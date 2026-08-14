"use client";

import type { Database } from "@amsw/db";
import { PanelHeader } from "./panels";
import { IconPlug } from "./icons";
import { LogoAnthropic, LogoGoogleCalendar, LogoOpenAI, LogoRailway, LogoShopify, LogoSupabase, LogoTelegram, LogoVercel } from "./logos";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];

interface SourceMeta {
  key: SyncRow["source"];
  label: string;
  logo: React.ComponentType<{ className?: string }>;
  color: string;
}

const BUSINESS_SOURCES: SourceMeta[] = [
  { key: "google_calendar", label: "Google Kalender", logo: LogoGoogleCalendar, color: "#4285F4" },
  { key: "shopify", label: "Shopify", logo: LogoShopify, color: "#95BF47" },
];

const INFRA_SOURCES: SourceMeta[] = [
  { key: "telegram", label: "Telegram", logo: LogoTelegram, color: "#29A9EA" },
  { key: "supabase", label: "Supabase", logo: LogoSupabase, color: "#3ECF8E" },
  { key: "vercel", label: "Vercel", logo: LogoVercel, color: "#000000" },
  { key: "railway", label: "Railway", logo: LogoRailway, color: "#9757F5" },
  { key: "openai", label: "OpenAI", logo: LogoOpenAI, color: "#10A37F" },
  { key: "anthropic", label: "Anthropic", logo: LogoAnthropic, color: "#D97757" },
];

// No source (real API) or public brand mark available - shown for completeness, not live health.
const MANUAL_TOOLS: { label: string; letter: string; color: string; note: string }[] = [
  { label: "Wispr Flow", letter: "W", color: "#94A3B8", note: "Diktering på din enhed – ingen API, tjek selv i appen hvis noget virker mærkeligt" },
];

const WHOOP_META = { key: "whoop" as const, label: "Whoop", letter: "W", color: "#FF4D6D" };

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

function LogoAvatar({ Logo, color }: { Logo: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <span className="integration-avatar" style={{ background: color }}>
      <Logo className="integration-avatar-logo" />
    </span>
  );
}

function LetterAvatar({ letter, color }: { letter: string; color: string }) {
  return (
    <span className="integration-avatar" style={{ background: color }}>
      {letter}
    </span>
  );
}

function TileBody({ label, status, statusLabel, detail }: { label: string; status: string; statusLabel: string; detail: string }) {
  return (
    <div className="integration-tile-body">
      <div className="integration-tile-top">
        <span className="integration-tile-name">{label}</span>
        <span className={`status-pill ${status}`}>{statusLabel}</span>
      </div>
      <div className="meta">{detail}</div>
    </div>
  );
}

function StatusTile({ meta, state }: { meta: SourceMeta; state: SyncRow | undefined }) {
  const hasError = Boolean(state?.last_error);
  const status = !state ? "yellow" : hasError ? "red" : "green";
  const statusLabel = !state ? "Ikke sat op" : hasError ? "Fejl" : "OK";
  const plan = planLine(state);
  const detail = hasError && state?.last_error ? state.last_error : plan ? plan : state?.last_synced_at ? `Sidst tjekket: ${formatDate(state.last_synced_at)}` : "Aldrig tjekket endnu";

  return (
    <div className="integration-tile">
      <LogoAvatar Logo={meta.logo} color={meta.color} />
      <TileBody label={meta.label} status={status} statusLabel={statusLabel} detail={detail} />
    </div>
  );
}

function WhoopTile({ state }: { state: SyncRow | undefined }) {
  const hasError = Boolean(state?.last_error);
  const status = !state ? "yellow" : hasError ? "red" : "green";
  const statusLabel = !state ? "Ikke sat op" : hasError ? "Fejl" : "OK";
  const detail = hasError && state?.last_error ? state.last_error : state?.last_synced_at ? `Sidst tjekket: ${formatDate(state.last_synced_at)}` : "Aldrig tjekket endnu";

  return (
    <div className="integration-tile">
      <LetterAvatar letter={WHOOP_META.letter} color={WHOOP_META.color} />
      <TileBody label={WHOOP_META.label} status={status} statusLabel={statusLabel} detail={detail} />
    </div>
  );
}

function ManualToolTile({ label, letter, color, note }: { label: string; letter: string; color: string; note: string }) {
  return (
    <div className="integration-tile">
      <LetterAvatar letter={letter} color={color} />
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
            <WhoopTile state={states.find((s) => s.source === WHOOP_META.key)} />
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
