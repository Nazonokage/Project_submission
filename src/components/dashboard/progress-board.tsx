'use client';

import { ProgressSelect } from '@/components/student/progress-select';
import { PROGRESS_LABELS, PROGRESS_STATUSES, type ProgressStatus } from '@/lib/progress';

export type BoardTitle = {
  id: string;
  text: string;
  status: string;
  progressStatus?: string | null;
  groupId: string;
  members: { id: string; name: string; idNumber: string }[];
  latestReport?: { version: string | null; progressSummary: string | null } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-warn dark:bg-yellow-900/40',
  verified: 'bg-green-100 text-ok dark:bg-green-900/40',
  rejected: 'bg-red-100 text-danger dark:bg-red-900/40',
};

export function ProgressBoard({
  titles,
  highlightStudentId,
  onProgress,
  onOpen,
  onEdit,
  onDelete,
}: {
  titles: BoardTitle[];
  highlightStudentId?: string | null;
  onProgress: (titleId: string, next: ProgressStatus) => void;
  onOpen?: (title: BoardTitle) => void;
  onEdit?: (title: BoardTitle) => void;
  onDelete?: (title: BoardTitle) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4 items-start">
      {PROGRESS_STATUSES.map((status) => {
        const col = titles.filter((t) => (t.progressStatus || 'planning') === status);
        return (
          <section key={status} className="doodle-border bg-secondary/50 p-2 space-y-2 min-h-[12rem]">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted px-1">
              {PROGRESS_LABELS[status]} ({col.length})
            </h2>
            {col.length === 0 ? (
              <p className="text-xs text-muted px-1">None yet</p>
            ) : (
              col.map((t) => {
                const highlighted = highlightStudentId
                  ? t.members.some((m) => m.id === highlightStudentId)
                  : false;
                return (
                  <div
                    key={t.id}
                    id={`group-card-${t.groupId}`}
                    className={`card p-3 space-y-2 ${highlighted ? 'ring-2 ring-accent' : ''}`}
                  >
                    <button
                      type="button"
                      className="text-left w-full"
                      onClick={() => onOpen?.(t)}
                    >
                      <p className="text-sm font-medium leading-snug">{t.text}</p>
                      <p className="text-xs text-muted mt-1">
                        {t.members.map((m) => m.name).join(', ') || 'No members listed'}
                      </p>
                      {t.latestReport && (
                        <p className="text-xs text-muted mt-1 line-clamp-2">
                          {t.latestReport.version ? `v${t.latestReport.version} · ` : ''}
                          {t.latestReport.progressSummary || 'Latest report on file'}
                        </p>
                      )}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${STATUS_STYLES[t.status] || ''}`}>{t.status}</span>
                      <ProgressSelect value={t.progressStatus} onChange={(next) => onProgress(t.id, next)} />
                    </div>
                    <div className="flex gap-2">
                      {onEdit && (
                        <button className="btn-secondary text-xs py-1" onClick={() => onEdit(t)}>
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button className="btn-danger text-xs py-1" onClick={() => onDelete(t)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        );
      })}
    </div>
  );
}

export { STATUS_STYLES };
