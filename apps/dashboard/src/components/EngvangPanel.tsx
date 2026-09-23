"use client";

import type { Database } from "@amsw/db";
import { IconBriefcase, IconClose, IconKey, IconShield } from "./icons";
import { panelClass, PanelHeader, QuickAdd, Skeleton } from "./panels";

type EngvangRow = Database["public"]["Tables"]["engvang_items"]["Row"];
type EngvangType = EngvangRow["type"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

const TYPE_META: Record<Exclude<EngvangType, "andet">, { title: string; icon: React.ReactNode; subtitle: string; placeholder: string }> = {
  leverandoraftale: {
    title: "Leverandøraftaler",
    icon: <IconBriefcase />,
    subtitle: "Kontrakter, bindingsperioder og opsigelsesfrister",
    placeholder: "Titel | Detaljer | Frist (YYYY-MM-DD) | Label",
  },
  forsikring: {
    title: "Forsikringer",
    icon: <IconShield />,
    subtitle: "Policer og fornyelsesdatoer",
    placeholder: "Titel | Detaljer | Frist (YYYY-MM-DD) | Label",
  },
  noegle: {
    title: "Nøgler",
    icon: <IconKey />,
    subtitle: "Hvem har hvad",
    placeholder: "Titel | Hvem har den",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("da-DK", { dateStyle: "medium" });
}

function EngvangTypePanel({
  type,
  items,
  flash,
  onCreate,
  onClose,
}: {
  type: Exclude<EngvangType, "andet">;
  items: EngvangRow[];
  flash?: boolean;
  onCreate: (raw: string) => Promise<void>;
  onClose: (id: string) => void;
}) {
  const meta = TYPE_META[type];
  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={meta.icon} title={meta.title} subtitle={meta.subtitle} />
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
    </section>
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
    <>
      {(["leverandoraftale", "forsikring", "noegle"] as const).map((type) => (
        <EngvangTypePanel
          key={type}
          type={type}
          items={items.filter((i) => i.type === type)}
          flash={flash}
          onCreate={(raw) => onCreate(type, raw)}
          onClose={onClose}
        />
      ))}
    </>
  );
}
