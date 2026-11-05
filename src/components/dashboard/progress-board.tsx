'use client';
import { PROGRESS_LABELS, PROGRESS_STATUSES, projectProgressStatus } from '@/lib/progress';

export type BoardTitle = {
  id: string;
  text: string;
  status: string;
  progressStatus?: string | null;
  groupId: string;
  members: { id: string; name: string; idNumber: string }[];
  latestReport?: {
    version: string | null; progressSummary: string | null; changelog: string | null;
    repoUrl: string | null; deploymentUrl: string | null; extraLinks: string[] | null; createdAt: string;
  } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-warn dark:bg-yellow-900/40',
  verified: 'bg-green-100 text-ok dark:bg-green-900/40',
  rejected: 'bg-red-100 text-danger dark:bg-red-900/40',
};

export function ProgressBoard({
  titles,
  highlightStudentId,
  onOpen,
}: {
  titles: BoardTitle[];
  highlightStudentId?: string | null;
  onOpen: (title: BoardTitle) => void;
}) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:snap-none items-start">
      {PROGRESS_STATUSES.map((status) => {
        const col = titles.filter((t) => t.status === 'verified' && projectProgressStatus(t) === status);
        return (
          <section key={status} className="doodle-border bg-secondary/50 p-2 space-y-2 min-h-[12rem] min-w-[min(16.5rem,calc(100vw-2.5rem))] snap-start md:min-w-0">
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
                  <button
                    key={t.id}
                    id={`group-card-${t.groupId}`}
                    type="button"
                    aria-label={t.text}
                    aria-haspopup="dialog"
                    onClick={() => onOpen(t)}
                    className={`card block w-full space-y-2 p-3 text-left hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary ${highlighted ? 'ring-2 ring-accent' : ''}`}
                  >
                    <span className="block break-words text-sm font-medium leading-snug">{t.text}</span>
                    <span className="block text-xs text-muted">
                      {t.members.map((m) => m.name).join(', ') || 'No members listed'}
                    </span>
                    <span className={`badge ${STATUS_STYLES[t.status] || ''}`}>{t.status}</span>
                    {t.latestReport && (
                      <span className="block rounded-md border border-primary/15 bg-primary/5 p-2">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">
                          Latest report{t.latestReport.version ? ` · v${t.latestReport.version}` : ''}
                        </span>
                        <span className="mt-1 line-clamp-2 text-xs text-muted">
                          {t.latestReport.progressSummary || 'Latest report on file'}
                        </span>
                      </span>
                    )}
                  </button>
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
