"use client";

import type { Database } from "@amsw/db";
import { IconBriefcase, IconClose, IconKey, IconShield } from "./icons";
import { QuickAdd, Skeleton } from "./panels";

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
    <div className="engvang-deadlines">
      <p className="engvang-deadlines-label">Kommende frister</p>
      {upcoming.map((item) => (
        <div className="engvang-deadline-row" key={item.id}>
          <span className="engvang-deadline-date">{formatDate(item.next_deadline)}</span>
          <span>{item.title}</span>
          {item.deadline_label && <span className="engvang-deadline-tag">({item.deadline_label})</span>}
        </div>
      ))}
    </div>
  );
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
    <div className="engvang-section">
      <p className="engvang-section-label">
        {meta.icon}
        {meta.title} ({items.length})
      </p>
      {items.length === 0 && <p className="empty">Ingen registreret endnu.</p>}
      {items.map((item) => (
        <div className="item item-checkable" key={item.id}>
          <div className="task-label">
            <div>
              {item.title}
              <div className="meta">
                {item.detail}
                {item.next_deadline ? `${item.detail ? " · " : ""}${item.deadline_label ?? "Frist"}: ${formatDate(item.next_deadline)}` : ""}
              </div>
            </div>
          </div>
          <button type="button" className="task-delete-button" onClick={() => onClose(item.id)} aria-label="Arkiver">
            <IconClose />
          </button>
        </div>
      ))}
      <QuickAdd placeholder={meta.placeholder} onSubmit={onCreate} />
    </div>
  );
}

export function EngvangPanels({
  items,
  isLoading,
  flash,
  onCreate,
  onClose,
}: LiveProps & {
  items: EngvangRow[];
  onCreate: (type: EngvangType, raw: string) => Promise<void>;
  onClose: (id: string) => void;
}) {
  if (isLoading) return <Skeleton lines={3} />;

  return (
    <section className={["panel panel-engvang", flash && "panel-flash"].filter(Boolean).join(" ")}>
      <EngvangDeadlines items={items} />
      {(["leverandoraftale", "forsikring", "noegle"] as const).map((type, i) => (
        <div key={type} className={i > 0 ? "engvang-section-divider" : undefined}>
          <EngvangSection
            type={type}
            items={items.filter((it) => it.type === type && it.status === "active")}
            onCreate={(raw) => onCreate(type, raw)}
            onClose={onClose}
          />
        </div>
      ))}
    </section>
  );
}
