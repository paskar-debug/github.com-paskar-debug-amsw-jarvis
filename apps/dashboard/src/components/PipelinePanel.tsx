"use client";

import type { Database } from "@amsw/db";
import { IconCheck, IconClose, IconDraft, IconMail, IconTrophy } from "./icons";
import { panelClass, PanelHeader, QuickAdd, Skeleton } from "./panels";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface LiveProps {
  isLoading?: boolean;
  flash?: boolean;
}

const DONE_VISIBLE_LIMIT = 6;

function Card({ task, children }: { task: TaskRow; children?: React.ReactNode }) {
  return (
    <div className="pipeline-card">
      <div className="pipeline-card-body">
        <span className="pipeline-card-title">
          {task.origin === "email_triage" && <IconMail className="pipeline-card-origin" />}
          {task.title}
        </span>
        {task.description && <span className="pipeline-card-desc">{task.description}</span>}
      </div>
      {children}
    </div>
  );
}

export function PipelinePanel({
  tasks,
  isLoading,
  flash,
  onApprove,
  onReject,
  onToggleDone,
  onCreate,
}: LiveProps & {
  tasks: TaskRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onToggleDone: (id: string) => void;
  onCreate: (title: string) => Promise<void>;
}) {
  if (isLoading) return <Skeleton lines={3} />;

  const suggested = tasks.filter((t) => t.status === "suggested");
  const approved = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, DONE_VISIBLE_LIMIT);

  return (
    <section className={panelClass(flash && "panel-flash")}>
      <PanelHeader icon={<IconDraft />} title="Forløb" subtitle="Fra mail-forslag til færdig opgave, i ét overblik" />
      <div className="pipeline-columns">
        <div className="pipeline-column">
          <p className="pipeline-column-label">Forslag ({suggested.length})</p>
          {suggested.length === 0 && <p className="empty">Ingen forslag lige nu.</p>}
          {suggested.map((task) => (
            <Card task={task} key={task.id}>
              <div className="pipeline-card-actions">
                <button type="button" className="pipeline-approve" onClick={() => onApprove(task.id)} aria-label="Godkend">
                  <IconCheck />
                </button>
                <button type="button" className="pipeline-reject" onClick={() => onReject(task.id)} aria-label="Afvis">
                  <IconClose />
                </button>
              </div>
            </Card>
          ))}
        </div>

        <div className="pipeline-column">
          <p className="pipeline-column-label">Godkendt ({approved.length})</p>
          {approved.length === 0 && <p className="empty">Ingen åbne opgaver.</p>}
          {approved.map((task) => (
            <Card task={task} key={task.id}>
              <label className="pipeline-done-check">
                <input type="checkbox" onChange={() => onToggleDone(task.id)} />
              </label>
            </Card>
          ))}
          <QuickAdd placeholder="Tilføj direkte..." onSubmit={onCreate} />
        </div>

        <div className="pipeline-column">
          <p className="pipeline-column-label">
            <IconTrophy className="pipeline-column-icon" /> Udført
          </p>
          {done.length === 0 && <p className="empty">Ingen færdige endnu.</p>}
          {done.map((task) => (
            <Card task={task} key={task.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
