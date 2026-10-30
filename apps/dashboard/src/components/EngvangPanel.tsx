"use client";

import type { Database } from "@amsw/db";
import { IconBriefcase, IconCalendar, IconClose, IconKey, IconShield } from "./icons";
import { PanelHeader, QuickAdd, Skeleton } from "./panels";

type EngvangRow = Database["public"]["Tables"]["engvang_items"]["Row"];
type EngvangType = EngvangRow["type"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

const TYPE_META: Record<Exclude<EngvangType, "andet">, { title: string; icon: React.ReactNode; placeholder: string }> = {
  leverandoraftale: { title: "Leverandøraftaler", icon: <IconBriefcase />, placeholder: "Titel | Detaljer | Frist (YYYY-MM-DD) | Label" },
  forsikring: { title: "Forsikringer", icon: <IconShield />, placeholder: "Titel | Detaljer | Frist (YYYY-MM-DD) | Label" },
  noegle: { title: "Nøgler", icon: <IconKey />, placeholder: "Titel | Hvem har den" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("da-DK", { dateStyle: "medium" });
}

/** One glanceable list of everything with a deadline, across all three types, sorted soonest
 *  first - without this, seeing what's actually coming up meant scanning three separate panels. */
function EngvangDeadlines({ items }: { items: EngvangRow[] }) {
  const upcoming = items
    .filter((i) => i.status === "active" && i.next_deadline)
    .sort((a, b) => new Date(a.next_deadline!).getTime() - new Date(b.next_deadline!).getTime());

  if (upcoming.length === 0) return null;

  return (
    <section className="panel engvang-deadlines">
      <PanelHeader icon={<IconCalendar />} title="Kommende frister" />
      <div className="deadline-list">
        {upcoming.map((item) => {
          const days = daysUntil(item.next_deadline!);
          return (
            <div className={`deadline${days <= 14 ? " deadline-soon" : ""}`} key={item.id}>
              <span className="deadline-date">{formatDate(item.next_deadline)}</span>
              <span className="deadline-title">
                {item.title}
                {item.deadline_label && <span className="meta"> · {item.deadline_label}</span>}
              </span>
              <span className="deadline-days">{days < 0 ? "overskredet" : days === 0 ? "i dag" : `${days} dage`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function EngvangSection({
  type,
  items,
  onCreate,
  onClose,
}: {
  type: Exclude<EngvangType, "andet">;
  items: EngvangRow[];
  onCreate: (raw: string) => Promise<void>;
  onClose: (id: string) => void;
}) {
  const meta = TYPE_META[type];
  return (
    <section className="panel">
      <PanelHeader icon={meta.icon} title={meta.title} aside={<span className="count">{items.length}</span>} />
      <div className="row-list">
        {items.length === 0 && <p className="empty">Ingen registreret endnu.</p>}
        {items.map((item) => (
          <div className="row" key={item.id}>
            <div className="row-body">
              <span>{item.title}</span>
              {(item.detail || item.next_deadline) && (
                <span className="meta">
                  {item.detail}
                  {item.next_deadline ? `${item.detail ? " · " : ""}${item.deadline_label ?? "Frist"}: ${formatDate(item.next_deadline)}` : ""}
                </span>
              )}
            </div>
            <button type="button" className="row-delete" onClick={() => onClose(item.id)} aria-label="Arkiver">
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <QuickAdd placeholder={meta.placeholder} onSubmit={onCreate} />
    </section>
  );
}

export function EngvangPanels({
  items,
  isLoading,
  onCreate,
  onClose,
}: LiveProps & {
  items: EngvangRow[];
  onCreate: (type: EngvangType, raw: string) => Promise<void>;
  onClose: (id: string) => void;
}) {
  if (isLoading) return <Skeleton lines={3} />;

  return (
    <>
      <EngvangDeadlines items={items} />
      <div className="engvang-grid">
        {(["leverandoraftale", "forsikring", "noegle"] as const).map((type) => (
          <EngvangSection
            key={type}
            type={type}
            items={items.filter((it) => it.type === type && it.status === "active")}
            onCreate={(raw) => onCreate(type, raw)}
            onClose={onClose}
          />
        ))}
      </div>
    </>
  );
}
