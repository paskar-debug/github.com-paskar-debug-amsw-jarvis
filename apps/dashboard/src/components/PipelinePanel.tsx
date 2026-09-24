"use client";

import type { Database } from "@amsw/db";
import { IconClose, IconMail, IconTasks, IconTrophy } from "./icons";
import { panelClass, PanelHeader, QuickAdd, Skeleton } from "./panels";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

const VISIBLE_LIMIT = 6;

function Card({ task, onDone, onDelete }: { task: TaskRow; onDone?: () => void; onDelete: () => void }) {
  return (
    <div className="pipeline-card">
      {onDone && (
        <label className="pipeline-done-check">
          <input type="checkbox" onChange={onDone} />
        </label>
      )}
      <span className="pipeline-card-title">
        {task.origin === "email_triage" && <IconMail className="pipeline-card-origin" />}
        {task.title}
      </span>
      <button type="button" className="task-delete-button" onClick={onDelete} aria-label="Slet">
        <IconClose />
      </button>
    </div>
  );
}

export function PipelinePanel({
  tasks,
  isLoading,
  flash,
  onToggleDone,
  onDelete,
  onCreate,
}: LiveProps & {
  tasks: TaskRow[];
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string) => Promise<void>;
}) {
  if (isLoading) return <Skeleton lines={3} />;

  const open = tasks
    .filter((t) => t.status === "todo" || t.status === "in_progress")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const visibleOpen = open.slice(0, VISIBLE_LIMIT);
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, VISIBLE_LIMIT);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTasks />} title="Opgaver" subtitle="Godkendte forslag lander her, sammen med det du selv opretter" />
      <QuickAdd placeholder="Tilføj opgave..." onSubmit={onCreate} />
      <div className="pipeline-columns pipeline-columns-2">
        <div className="pipeline-column">
          <p className="pipeline-column-label">Åbne ({open.length})</p>
          {open.length === 0 && <p className="empty">Ingen åbne opgaver.</p>}
          {visibleOpen.map((task) => (
            <Card task={task} key={task.id} onDone={() => onToggleDone(task.id)} onDelete={() => onDelete(task.id)} />
          ))}
          {open.length > visibleOpen.length && <p className="empty">+{open.length - visibleOpen.length} flere.</p>}
        </div>

        <div className="pipeline-column">
          <p className="pipeline-column-label">
            <IconTrophy className="pipeline-column-icon" /> Udført
          </p>
          {done.length === 0 && <p className="empty">Ingen færdige endnu.</p>}
          {done.map((task) => (
            <Card task={task} key={task.id} onDelete={() => onDelete(task.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
