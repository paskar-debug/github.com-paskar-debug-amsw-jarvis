"use client";

import type { Database } from "@amsw/db";
import { PanelHeader } from "./panels";
import { IconPlug } from "./icons";

type SyncRow = Database["public"]["Tables"]["integration_sync_state"]["Row"];

const SOURCES: { key: SyncRow["source"]; label: string }[] = [
  { key: "google_calendar", label: "Google Kalender" },
  { key: "todoist", label: "Todoist" },
  { key: "shopify", label: "Shopify" },
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export function IntegrationsPanel({ states }: { states: SyncRow[] }) {
  return (
    <section className="panel">
      <PanelHeader icon={<IconPlug />} title="Integrationer" />
      {SOURCES.map(({ key, label }) => {
        const state = states.find((s) => s.source === key);
        const hasError = Boolean(state?.last_error);
        const status = !state ? "yellow" : hasError ? "red" : "green";
        const statusLabel = !state ? "Ikke sat op" : hasError ? "Fejl" : "OK";

        return (
          <div className="item status-item" key={key}>
            <div className="status-item-top">
              <span className="status-name">
                <span className={`badge ${status}`} />
                {label}
              </span>
              <span className={`status-pill ${status}`}>{statusLabel}</span>
            </div>
            <div className="meta">
              {state?.last_synced_at ? `Sidst synkroniseret: ${formatDate(state.last_synced_at)}` : "Aldrig synkroniseret endnu"}
              {hasError && state?.last_error ? ` · ${state.last_error}` : ""}
            </div>
          </div>
        );
      })}
    </section>
  );
}
