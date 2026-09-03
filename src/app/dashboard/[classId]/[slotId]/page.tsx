'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { LeaveRequestsPanel, type LeaveRequestRow } from '@/components/dashboard/leave-requests-panel';
import { TitleEditor, type ProfTitle } from '@/components/dashboard/title-editor';
import { ProgressSelect } from '@/components/student/progress-select';
import { PROGRESS_LABELS, PROGRESS_STATUSES, type ProgressStatus } from '@/lib/progress';

type Title = ProfTitle & {
  members: { id: string; name: string; idNumber: string }[];
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-warn',
  verified: 'bg-green-100 text-ok',
  rejected: 'bg-red-100 text-danger',
};

export default function VerificationQueuePage() {
  const { classId, slotId } = useParams<{ classId: string; slotId: string }>();
  const [titles, setTitles] = useState<Title[]>([]);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | ''>('pending');
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [editing, setEditing] = useState<Title | null>(null);

  async function load() {
    setLoading(true);
    const qs = view === 'board' || !filter ? '' : `?status=${filter}`;
    const [titlesRes, leavesRes] = await Promise.all([
      fetch(`/api/dashboard/${classId}/${slotId}/titles${qs}`),
      fetch(`/api/classes/${classId}/leave-requests?status=pending&slotId=${slotId}`),
    ]);
    if (titlesRes.ok) setTitles((await titlesRes.json()).titles);
    if (leavesRes.ok) setLeaveRequests((await leavesRes.json()).requests || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, slotId, filter, view]);

  async function setProgress(titleId: string, progressStatus: ProgressStatus) {
    const res = await fetch(`/api/dashboard/titles/${titleId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressStatus }),
    });
    if (res.ok) load();
  }

  async function decide(titleId: string, decision: 'verified' | 'rejected') {
    await fetch(`/api/dashboard/titles/${titleId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        comment: decision === 'rejected' ? comments[titleId] : undefined,
      }),
    });
    load();
  }

  async function removeTitle(title: Title) {
    const ok = window.confirm(
      `Delete “${title.text}”? This cannot be undone. Related progress notes for this title will also be removed.`
    );
    if (!ok) return;
    const res = await fetch(`/api/dashboard/titles/${title.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not delete title');
      return;
    }
    toast.success('Title deleted');
    load();
  }

  return (
    <main className={`${view === 'board' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-6 py-10 space-y-6`}>
      <div>
        <Link href={`/dashboard/${classId}`} className="text-sm text-muted hover:underline">
          ← Back to class
        </Link>
        <h1 className="text-xl font-semibold mt-1">Verification queue</h1>
      </div>

      {leaveRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Leave requests awaiting confirmation
          </h2>
          <LeaveRequestsPanel requests={leaveRequests} onChanged={load} compact />
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {(['pending', 'verified', 'rejected', ''] as const).map((s) => (
            <button
              key={s || 'all'}
              className={`btn-secondary ${filter === s && view === 'list' ? 'bg-accent text-white border-accent' : ''}`}
              onClick={() => {
                setView('list');
                setFilter(s);
              }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <button
          className={`btn-secondary ${view === 'board' ? 'bg-accent text-white border-accent' : ''}`}
          onClick={() => setView('board')}
        >
          Board
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : view === 'board' ? (
        <ProgressBoard
          titles={titles}
          onProgress={setProgress}
          onEdit={setEditing}
          onDelete={removeTitle}
        />
      ) : titles.length === 0 ? (
        <p className="text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="grid gap-3">
          {titles.map((t) => (
            <div key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{t.text}</p>
                  <p className="text-sm text-muted mt-0.5">{t.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`badge ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  <ProgressSelect value={t.progressStatus} onChange={(next) => setProgress(t.id, next)} />
                </div>
              </div>
              {t.techStack && t.techStack.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {t.techStack.map((tag) => (
                    <span key={tag} className="badge bg-gray-100 text-ink">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {t.targetUsers && <p className="text-sm text-muted">Target users: {t.targetUsers}</p>}
              <p className="text-sm text-muted">
                Group: {t.members.map((m) => m.name).join(', ') || '—'}
              </p>
              {t.repoUrl && (
                <p className="text-sm">
                  Repo:{' '}
                  <a className="text-accent hover:underline" href={t.repoUrl} target="_blank">
                    {t.repoUrl}
                  </a>
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setEditing(t)}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => removeTitle(t)}>
                  Delete
                </button>
              </div>
              {t.status === 'pending' && (
                <div className="space-y-2 pt-1">
                  <input
                    className="input"
                    placeholder="Optional reject comment (shown to the group)"
                    value={comments[t.id] || ''}
                    onChange={(e) => setComments((cur) => ({ ...cur, [t.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button className="btn-primary" onClick={() => decide(t.id, 'verified')}>
                      Approve
                    </button>
                    <button className="btn-danger" onClick={() => decide(t.id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TitleEditor
          key={editing.id}
          title={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </main>
  );
}

function ProgressBoard({
  titles,
  onProgress,
  onEdit,
  onDelete,
}: {
  titles: Title[];
  onProgress: (titleId: string, next: ProgressStatus) => void;
  onEdit: (title: Title) => void;
  onDelete: (title: Title) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4 items-start">
      {PROGRESS_STATUSES.map((status) => {
        const col = titles.filter((t) => (t.progressStatus || 'planning') === status);
        return (
          <section key={status} className="rounded-xl border border-line bg-secondary/50 p-2 space-y-2 min-h-[12rem]">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted px-1">
              {PROGRESS_LABELS[status]} ({col.length})
            </h2>
            {col.length === 0 ? (
              <p className="text-xs text-muted px-1">None yet</p>
            ) : (
              col.map((t) => (
                <div key={t.id} className="card p-3 space-y-2">
                  <p className="text-sm font-medium leading-snug">{t.text}</p>
                  <p className="text-xs text-muted">{t.members.map((m) => m.name).join(', ') || 'No members listed'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                    <ProgressSelect value={t.progressStatus} onChange={(next) => onProgress(t.id, next)} />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary text-xs py-1" onClick={() => onEdit(t)}>
                      Edit
                    </button>
                    <button className="btn-danger text-xs py-1" onClick={() => onDelete(t)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
