"use client";

import { useState } from "react";
import type { Database } from "@amsw/db";
import { IconChevron, IconClose, IconMail, IconTasks } from "./icons";
import { panelClass, PanelHeader, QuickAdd, Skeleton } from "./panels";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

const VISIBLE_LIMIT = 8;
const DONE_LIMIT = 5;

function TaskItem({ task, onDone, onDelete }: { task: TaskRow; onDone?: () => void; onDelete: () => void }) {
  return (
    <div className={`task${onDone ? "" : " task-done"}`}>
      {onDone ? (
        <input type="checkbox" className="task-check" onChange={onDone} aria-label="Marker som udført" />
      ) : (
        <span className="task-check task-check-done" aria-hidden="true" />
      )}
      <span className="task-title">
        {task.origin === "email_triage" && <IconMail className="task-origin" />}
        {task.title}
      </span>
      <button type="button" className="row-delete" onClick={onDelete} aria-label="Slet">
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
  const [showAll, setShowAll] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = tasks
    .filter((t) => t.status === "todo" || t.status === "in_progress")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const visibleOpen = showAll ? open : open.slice(0, VISIBLE_LIMIT);
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, DONE_LIMIT);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTasks />} title="Opgaver" aside={!isLoading && <span className="count">{open.length}</span>} />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          <QuickAdd placeholder="Ny opgave…" onSubmit={onCreate} />
          <div className="task-list">
            {open.length === 0 && <p className="empty">Ingen åbne opgaver. Godt gået.</p>}
            {visibleOpen.map((task) => (
              <TaskItem task={task} key={task.id} onDone={() => onToggleDone(task.id)} onDelete={() => onDelete(task.id)} />
            ))}
          </div>
          {open.length > VISIBLE_LIMIT && (
            <button type="button" className="more-button" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Vis færre" : `Vis alle ${open.length}`}
            </button>
          )}
          {done.length > 0 && (
            <div className="disclosure">
              <button type="button" className={`disclosure-toggle${showDone ? " open" : ""}`} onClick={() => setShowDone((v) => !v)}>
                Senest udført
                <IconChevron />
              </button>
              {showDone && (
                <div className="task-list">
                  {done.map((task) => (
                    <TaskItem task={task} key={task.id} onDelete={() => onDelete(task.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
