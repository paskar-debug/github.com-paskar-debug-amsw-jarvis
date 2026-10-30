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

const DONE_LIMIT = 5;
const PLAN_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayHeading(dayStart: number, todayStart: number): string {
  const diff = Math.round((dayStart - todayStart) / DAY_MS);
  if (diff === 0) return "I dag";
  if (diff === 1) return "I morgen";
  const label = new Date(dayStart).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface TaskGroup {
  key: string;
  label: string;
  tone?: "overdue" | "today";
  tasks: TaskRow[];
}

/** Splits open tasks into a 14-day plan: overdue first, then one group per day that has something,
 *  then whatever has no date. Tasks dated beyond the window are only counted, not listed. */
function planGroups(open: TaskRow[]): { groups: TaskGroup[]; undated: TaskRow[]; laterCount: number } {
  const todayStart = startOfDay(new Date());
  const windowEnd = todayStart + PLAN_DAYS * DAY_MS;
  const overdue: TaskRow[] = [];
  const byDay = new Map<number, TaskRow[]>();
  const undated: TaskRow[] = [];
  let laterCount = 0;
  for (const task of open) {
    if (!task.due_at) {
      undated.push(task);
      continue;
    }
    const day = startOfDay(new Date(task.due_at));
    if (day < todayStart) overdue.push(task);
    else if (day >= windowEnd) laterCount++;
    else byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  const byPriority = (a: TaskRow, b: TaskRow) => a.priority.localeCompare(b.priority);
  const groups: TaskGroup[] = [];
  if (overdue.length > 0) groups.push({ key: "overdue", label: "Forsinket", tone: "overdue", tasks: overdue.sort(byPriority) });
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    groups.push({
      key: String(day),
      label: dayHeading(day, todayStart),
      tone: day === todayStart ? "today" : undefined,
      tasks: byDay.get(day)!.sort(byPriority),
    });
  }
  return { groups, undated: undated.sort(byPriority), laterCount };
}

function TaskItem({ task, onDone, onDelete }: { task: TaskRow; onDone?: () => void; onDelete: () => void }) {
  return (
    <div className={`task${onDone ? "" : " task-done"}`}>
      {onDone ? (
        <input type="checkbox" className="task-check" onChange={onDone} aria-label="Marker som udført" />
      ) : (
        <span className="task-check task-check-done" aria-hidden="true" />
      )}
      {task.priority !== "p4" && <span className={`priority-dot priority-${task.priority}`} title={`Prioritet ${task.priority.toUpperCase()}`} />}
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
  const [showUndated, setShowUndated] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const { groups, undated, laterCount } = planGroups(open);
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, DONE_LIMIT);

  const renderTask = (task: TaskRow) => (
    <TaskItem task={task} key={task.id} onDone={() => onToggleDone(task.id)} onDelete={() => onDelete(task.id)} />
  );

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconTasks />} title="Opgaver · 14 dage" aside={!isLoading && <span className="count">{open.length}</span>} />
      {isLoading ? (
        <Skeleton lines={3} />
      ) : (
        <>
          <QuickAdd placeholder="Ny opgave…" onSubmit={onCreate} />
          {open.length === 0 && <p className="empty">Ingen åbne opgaver. Godt gået.</p>}
          {open.length > 0 && groups.length === 0 && <p className="empty">Intet planlagt de næste 14 dage.</p>}
          {groups.map((group) => (
            <div className={`plan-day${group.tone ? ` plan-day-${group.tone}` : ""}`} key={group.key}>
              <p className="plan-day-label">
                {group.label}
                <span className="plan-day-count">{group.tasks.length}</span>
              </p>
              <div className="task-list">{group.tasks.map(renderTask)}</div>
            </div>
          ))}
          {laterCount > 0 && <p className="more">+{laterCount} planlagt senere end 14 dage</p>}
          {undated.length > 0 && (
            <div className="disclosure">
              <button type="button" className={`disclosure-toggle${showUndated ? " open" : ""}`} onClick={() => setShowUndated((v) => !v)}>
                Uden dato ({undated.length})
                <IconChevron />
              </button>
              {showUndated && <div className="task-list">{undated.map(renderTask)}</div>}
            </div>
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
